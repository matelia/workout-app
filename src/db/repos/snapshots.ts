import type { SQLiteDatabase } from 'expo-sqlite';

export type SnapshotKind = 'label' | 'meal' | 'menu' | 'recipe';
export type SnapshotStatus = 'queued' | 'processing' | 'needs_review' | 'done';

export type SnapshotJob = {
  id: number;
  photo_path: string; // relative to the documents folder
  kind: SnapshotKind;
  status: SnapshotStatus;
  model_output_json: string | null;
  created_at: string;
  date: string | null;
  meal: string | null;
  error: string | null;
  extra_photos: string | null; // JSON array of more photo paths
  context: string | null; // JSON, e.g. {"restaurant":"Chick-fil-A"}
};

/** All photo paths of a job (menu/recipe jobs can have several screenshots). */
export function jobPhotos(job: Pick<SnapshotJob, 'photo_path' | 'extra_photos'>): string[] {
  return [job.photo_path, ...(job.extra_photos ? (JSON.parse(job.extra_photos) as string[]) : [])];
}

/** Where to review a finished job. */
export function reviewRoute(job: Pick<SnapshotJob, 'id' | 'kind'>): string {
  if (job.kind === 'menu') return `/food/restaurants/review?id=${job.id}`;
  if (job.kind === 'recipe') return `/food/cookbook/review?id=${job.id}`;
  return `/food/review/${job.id}`;
}

/** Screenshot job (restaurant menu or recipe) with one or more photos. */
export async function createScreenshotJob(db: SQLiteDatabase, paths: string[], kind: 'menu' | 'recipe', context: object = {}) {
  return (
    await db.runAsync(
      "INSERT INTO snapshot_job (photo_path, kind, status, extra_photos, context) VALUES (?, ?, 'queued', ?, ?)",
      paths[0],
      kind,
      paths.length > 1 ? JSON.stringify(paths.slice(1)) : null,
      JSON.stringify(context),
    )
  ).lastInsertRowId;
}

export async function createJob(db: SQLiteDatabase, photoPath: string, kind: SnapshotKind, date: string, meal: string) {
  return (
    await db.runAsync(
      "INSERT INTO snapshot_job (photo_path, kind, status, date, meal) VALUES (?, ?, 'queued', ?, ?)",
      photoPath,
      kind,
      date,
      meal,
    )
  ).lastInsertRowId;
}

export function getJob(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<SnapshotJob>('SELECT * FROM snapshot_job WHERE id = ?', id);
}

export function listOpenJobs(db: SQLiteDatabase) {
  return db.getAllAsync<SnapshotJob>("SELECT * FROM snapshot_job WHERE status != 'done' ORDER BY id DESC");
}

export function listQueuedJobs(db: SQLiteDatabase) {
  // 'processing' rows left over from a crash/kill are retried too.
  return db.getAllAsync<SnapshotJob>("SELECT * FROM snapshot_job WHERE status IN ('queued', 'processing') ORDER BY id");
}

export async function pendingSnapshotCount(db: SQLiteDatabase) {
  return (await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM snapshot_job WHERE status != 'done'"))?.n ?? 0;
}

export async function setJobStatus(
  db: SQLiteDatabase,
  id: number,
  status: SnapshotStatus,
  extra: { output?: string | null; error?: string | null } = {},
) {
  await db.runAsync(
    'UPDATE snapshot_job SET status = ?, model_output_json = COALESCE(?, model_output_json), error = ? WHERE id = ?',
    status,
    extra.output ?? null,
    extra.error ?? null,
    id,
  );
}

export async function deleteJob(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM snapshot_job WHERE id = ?', id);
}
