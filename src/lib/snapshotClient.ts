import { File, Directory, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { pantryKinds } from '@/db/repos/pantry';
import { getSetting } from '@/db/repos/settings';
import { getJob, listQueuedJobs, setJobStatus, type SnapshotJob } from '@/db/repos/snapshots';

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
  new File(uri).copy(new File(dir, name));
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
    form.append('photo', { uri: photoUri(job.photo_path), name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
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
          content: { title: 'Snapshot ready to review', body: 'Tap to check it and add it to your log.', data: { url: `/food/review/${job.id}` } },
          trigger: null,
        }).catch(() => {});
      }
    }
  } finally {
    running = false;
  }
}

/** Retries the queue while the app is open (iOS doesn't let it run while closed). */
export function startQueueRetries(db: SQLiteDatabase, everyMs = 120_000) {
  const t = setInterval(() => processQueue(db).catch(() => {}), everyMs);
  return () => clearInterval(t);
}
