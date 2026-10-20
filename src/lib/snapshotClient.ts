import { File, Directory, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { listExercises } from '@/db/repos/exercises';
import { pantryKinds } from '@/db/repos/pantry';
import { listPendingNutrition, setRecipeNutrition } from '@/db/repos/recipes';
import { getSetting } from '@/db/repos/settings';
import type { NutritionPerServing } from '@/lib/recipeImport';
import { resolveServerUrl } from '@/lib/serverAddress';
import { getJob, jobPhotos, listQueuedJobs, reviewRoute, setJobStatus, type SnapshotJob } from '@/db/repos/snapshots';

// Talks to the FastAPI server on the home laptop (see server/README.md), reached directly or through
// a Cloudflare tunnel whose address the laptop publishes to a gist (see serverAddress.ts).
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
  const { url } = await resolveServerUrl(db);
  const token = await getSetting(db, 'snapshot_server_token');
  return { url, headers: token ? { 'X-Token': token } : ({} as Record<string, string>) };
}

class Unreachable extends Error {}

// The laptop runs one model request at a time on its CPU, so a request can wait behind another one.
// Matches the server's OLLAMA_TIMEOUT (900 s); the server keeps slow responses alive meanwhile.
const LAPTOP_TIMEOUT_MS = 900_000;

/**
 * Calls the laptop. If it doesn't answer and the address comes from a gist, re-reads the gist once and
 * retries at the new address (the tunnel address changes whenever the laptop restarts).
 * `init` is a factory because a request body (FormData) can't be sent twice.
 * Throws Unreachable when there's no address or nothing answers.
 */
async function serverFetch(db: SQLiteDatabase, path: string, init: (headers: Record<string, string>) => RequestInit, ms: number) {
  const { url, headers } = await serverConfig(db);
  if (!url) throw new Unreachable('No laptop address set (Settings → Home laptop).');
  try {
    return await fetchWithTimeout(`${url}${path}`, init(headers), ms);
  } catch (e) {
    const fresh = await resolveServerUrl(db, true);
    if (!fresh.changed || !fresh.url) throw new Unreachable(e instanceof Error ? e.message : String(e));
    try {
      return await fetchWithTimeout(`${fresh.url}${path}`, init(headers), ms);
    } catch (e2) {
      throw new Unreachable(e2 instanceof Error ? e2.message : String(e2));
    }
  }
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
  if (!(await getSetting(db, 'snapshot_server_url'))) return { ok: false, message: 'Enter the server address first.' };
  try {
    const res = await serverFetch(db, '/health', (headers) => ({ headers }), 10_000);
    if (res.status === 401) return { ok: false, message: 'Reached the server, but the token is wrong.' };
    const json = await res.json();
    return json.ok
      ? { ok: true, message: `Connected. Model: ${json.model}${json.model_ready ? '' : ' (not downloaded yet!)'}` }
      : { ok: false, message: json.error ?? 'Server responded with an error.' };
  } catch {
    return { ok: false, message: 'Can’t reach the laptop. Is it on and awake, with the server running?' };
  }
}

/** Sends one job to the server. Unreachable → back to 'queued'; bad response → error kept for the user. */
export async function processJob(db: SQLiteDatabase, job: SnapshotJob): Promise<'ok' | 'unreachable' | 'failed'> {
  if (!(await getSetting(db, 'snapshot_server_url'))) return 'unreachable';
  await setJobStatus(db, job.id, 'processing');
  try {
    const library = job.kind === 'workout' ? (await listExercises(db)).map((e) => e.name) : [];
    const hints = job.kind === 'meal' ? await pantryKinds(db) : [];
    const buildForm = () => {
      const form = new FormData();
      // React Native's FormData accepts { uri, name, type } file parts.
      if (job.kind === 'workout') {
        // Instagram import: caption + your library names, plus the thumbnail/screenshots if any.
        const ctx = job.context ? (JSON.parse(job.context) as { caption?: string }) : {};
        form.append('caption', ctx.caption ?? '');
        form.append('library', JSON.stringify(library));
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
      if (job.kind === 'meal') form.append('hints', JSON.stringify(hints));
      return form;
    };
    // Vision models on a laptop can take a while.
    const res = await serverFetch(db, `/${job.kind}`, (headers) => ({ method: 'POST', body: buildForm(), headers }), LAPTOP_TIMEOUT_MS);
    const json = await readJson(res);
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

/**
 * Reads a laptop response, turning every kind of failure into a short message: an HTTP error (including
 * Cloudflare's HTML error pages) or an error the server put in the body as `_status` after it had already
 * started a slow response.
 */
async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON, e.g. a Cloudflare error page
  }
  const body = json as { _status?: number; detail?: unknown } | null;
  const status = !res.ok ? res.status : (body?._status ?? 0);
  if (status >= 400) {
    const detail = typeof body?.detail === 'string' ? body.detail : null;
    if (detail) throw new Error(detail);
    if (status === 524 || status === 504) throw new Error('The laptop took too long to answer. Try again.');
    if (status === 401) throw new Error('The laptop rejected the token (Settings → Home laptop).');
    throw new Error(`Laptop error ${status}.`);
  }
  if (json === null) throw new Error('The laptop sent an answer the app couldn’t read.');
  return json;
}

/** POST JSON to the laptop (recipe nutrition, coach chat, plan builder). */
export async function serverPost<T>(db: SQLiteDatabase, path: string, body: unknown, timeoutMs = LAPTOP_TIMEOUT_MS): Promise<ServerResult<T>> {
  let res: Response;
  try {
    res = await serverFetch(
      db,
      path,
      (headers) => ({ method: 'POST', body: JSON.stringify(body), headers: { ...headers, 'Content-Type': 'application/json' } }),
      timeoutMs,
    );
  } catch (e) {
    return { ok: false, unreachable: true, error: e instanceof Unreachable && e.message.startsWith('No laptop') ? e.message : 'Laptop not reachable.' };
  }
  try {
    return { ok: true, data: (await readJson(res)) as T };
  } catch (e) {
    return { ok: false, unreachable: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Quick reachability check for offline banners. */
export async function isServerOnline(db: SQLiteDatabase): Promise<boolean> {
  try {
    const res = await serverFetch(db, '/health', (headers) => ({ headers }), 6000);
    return res.ok;
  } catch {
    return false;
  }
}
