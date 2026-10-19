import type { SQLiteDatabase } from 'expo-sqlite';

export type SnapshotKind = 'label' | 'meal';
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
};

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
