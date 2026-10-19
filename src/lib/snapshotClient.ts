import { File, Directory, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { listExercises } from '@/db/repos/exercises';
import { pantryKinds } from '@/db/repos/pantry';
import { listPendingNutrition, setRecipeNutrition } from '@/db/repos/recipes';
import { getSetting } from '@/db/repos/settings';
import type { NutritionPerServing } from '@/lib/recipeImport';
import { getJob, jobPhotos, listQueuedJobs, reviewRoute, setJobStatus, type SnapshotJob } from '@/db/repos/snapshots';

// Talks to the FastAPI server on the home laptop (see server/README.md), reached over Tailscale.
// Only the photo is sent. Barcodes and saved meals never use this.

export type LabelResult = {
  kind: 'label';
  food: {
    name: string;
    serving_g: number | null;
    kcal_100g: number | null;
    protein_100g: number | null;
    carbs_100g: number | null;
    fat_100g: number | null;
    fiber_100g?: number | null;
    sugar_100g?: number | null;
    sat_fat_100g?: number | null;
    sodium_mg_100g?: number | null;
  };
};

export type MealItem = {
  name: string;
  grams: number;
  usda: {
    fdc_id: number;
    description: string;
    kcal_100g: number | null;
    protein_100g: number | null;
    carbs_100g: number | null;
    fat_100g: number | null;
    fiber_100g?: number | null;
    sugar_100g?: number | null;
    sat_fat_100g?: number | null;
    sodium_mg_100g?: number | null;
  } | null;
};
export type MealResult = { kind: 'meal'; items: MealItem[] };

const PHOTO_DIR = 'snapshots';

/** Copies a picked/captured photo into the app's documents folder; returns its relative path. */
export function storePhoto(uri: string): string {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  dir.create({ idempotent: true, intermediates: true });
  const name = `${Date.now()}.jpg`;
  new File(uri).copySync(new File(dir, name));
  return `${PHOTO_DIR}/${name}`;
}

export function photoUri(relative: string) {
  return new File(Paths.document, relative).uri;
}

async function serverConfig(db: SQLiteDatabase) {
  const url = await getSetting(db, 'snapshot_server_url');
  const token = await getSetting(db, 'snapshot_server_token');
  return { url, headers: token ? { 'X-Token': token } : ({} as Record<string, string>) };
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function checkServer(db: SQLiteDatabase): Promise<{ ok: boolean; message: string }> {
  const { url, headers } = await serverConfig(db);
  if (!url) return { ok: false, message: 'Enter the server address first.' };
  try {
    const res = await fetchWithTimeout(`${url}/health`, { headers }, 6000);
    if (res.status === 401) return { ok: false, message: 'Reached the server, but the token is wrong.' };
    const json = await res.json();
    return json.ok
      ? { ok: true, message: `Connected. Model: ${json.model}${json.model_ready ? '' : ' (not downloaded yet!)'}` }
      : { ok: false, message: json.error ?? 'Server responded with an error.' };
  } catch {
    return { ok: false, message: 'Can’t reach the laptop. Is it on, with Tailscale connected on both devices?' };
  }
}

class Unreachable extends Error {}

/** Sends one job to the server. Unreachable → back to 'queued'; bad response → error kept for the user. */
export async function processJob(db: SQLiteDatabase, job: SnapshotJob): Promise<'ok' | 'unreachable' | 'failed'> {
  const { url, headers } = await serverConfig(db);
  if (!url) return 'unreachable';
  await setJobStatus(db, job.id, 'processing');
  try {
    const form = new FormData();
    // React Native's FormData accepts { uri, name, type } file parts.
    if (job.kind === 'workout') {
      // Instagram import: caption + your library names, plus the thumbnail/screenshots if any.
      const ctx = job.context ? (JSON.parse(job.context) as { caption?: string }) : {};
      form.append('caption', ctx.caption ?? '');
      form.append('library', JSON.stringify((await listExercises(db)).map((e) => e.name)));
      jobPhotos(job)
        .filter(Boolean)
        .forEach((p, i) => form.append('photos', { uri: photoUri(p), name: `photo${i}.jpg`, type: 'image/jpeg' } as unknown as Blob));
    } else if (job.kind === 'menu' || job.kind === 'recipe') {
      jobPhotos(job).forEach((p, i) =>
        form.append('photos', { uri: photoUri(p), name: `photo${i}.jpg`, type: 'image/jpeg' } as unknown as Blob),
      );
    } else {
      form.append('photo', { uri: photoUri(job.photo_path), name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    }
    // What you usually eat (e.g. "peanut butter"), so the model names foods the way your groceries are named.
    if (job.kind === 'meal') form.append('hints', JSON.stringify(await pantryKinds(db)));
    let res: Response;
    try {
      // Vision models on a laptop can take a while.
      res = await fetchWithTimeout(`${url}/${job.kind}`, { method: 'POST', body: form, headers }, 180_000);
    } catch {
      throw new Unreachable();
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    await setJobStatus(db, job.id, 'needs_review', { output: JSON.stringify(json) });
    return 'ok';
  } catch (e) {
    if (e instanceof Unreachable) {
      await setJobStatus(db, job.id, 'queued');
      return 'unreachable';
    }
    await setJobStatus(db, job.id, 'queued', { error: e instanceof Error ? e.message : String(e) });
    return 'failed';
  }
}

let running = false;

/**
 * Processes queued jobs one by one; stops at the first sign the laptop is unreachable.
 * Jobs live in SQLite, so nothing is lost if the app is closed. They simply wait for the next try.
 */
export async function processQueue(db: SQLiteDatabase) {
  if (running) return;
  running = true;
  try {
    for (const job of await listQueuedJobs(db)) {
      const fresh = await getJob(db, job.id);
      if (!fresh || fresh.status === 'done' || fresh.status === 'needs_review') continue;
      const result = await processJob(db, fresh);
      if (result === 'unreachable') break;
      if (result === 'ok') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title:
              job.kind === 'recipe'
                ? 'Recipe ready'
                : job.kind === 'menu'
                  ? 'Menu items ready'
                  : job.kind === 'workout'
                    ? 'Instagram workout ready'
                    : 'Snapshot ready to review',
            body: 'Tap to check it.',
            data: { url: reviewRoute(job) },
          },
          trigger: null,
        }).catch(() => {});
      }
    }
    await processPendingRecipes(db);
  } finally {
    running = false;
  }
}

/** Estimates nutrition for recipes imported without it (e.g. links with no nutrition, saved offline). */
async function processPendingRecipes(db: SQLiteDatabase) {
  for (const r of await listPendingNutrition(db)) {
    const res = await serverPost<{ per_serving: NutritionPerServing; missing: string[] }>(db, '/recipe/nutrition', {
      ingredients: JSON.parse(r.ingredients),
      servings: r.servings,
    });
    if (!res.ok) {
      if (res.unreachable) return;
      continue;
    }
    const note = res.data.missing.length
      ? `Estimated from ingredients (USDA); not counted: ${res.data.missing.join(', ')}`
      : 'Estimated from ingredients (USDA)';
    await setRecipeNutrition(db, r.id, res.data.per_serving, note);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Recipe nutrition ready', body: r.name, data: { url: `/food/cookbook/${r.id}` } },
      trigger: null,
    }).catch(() => {});
  }
}

/** Retries the queue while the app is open (iOS doesn't let it run while closed). */
export function startQueueRetries(db: SQLiteDatabase, everyMs = 120_000, extra?: () => Promise<void>) {
  const t = setInterval(() => {
    processQueue(db).catch(() => {});
    extra?.().catch(() => {});
  }, everyMs);
  return () => clearInterval(t);
}

export type ServerResult<T> = { ok: true; data: T } | { ok: false; unreachable: boolean; error: string };

/** POST JSON to the laptop (recipe nutrition, coach chat, plan builder). */
export async function serverPost<T>(db: SQLiteDatabase, path: string, body: unknown, timeoutMs = 180_000): Promise<ServerResult<T>> {
  const { url, headers } = await serverConfig(db);
  if (!url) return { ok: false, unreachable: true, error: 'No laptop address set (Settings → Home laptop).' };
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${url}${path}`,
      { method: 'POST', body: JSON.stringify(body), headers: { ...headers, 'Content-Type': 'application/json' } },
      timeoutMs,
    );
  } catch {
    return { ok: false, unreachable: true, error: 'Laptop not reachable.' };
  }
  if (!res.ok) return { ok: false, unreachable: false, error: `Server error ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { ok: true, data: (await res.json()) as T };
}

/** Quick reachability check for offline banners. */
export async function isServerOnline(db: SQLiteDatabase): Promise<boolean> {
  const { url, headers } = await serverConfig(db);
  if (!url) return false;
  try {
    const res = await fetchWithTimeout(`${url}/health`, { headers }, 4000);
    return res.ok;
  } catch {
    return false;
  }
}
