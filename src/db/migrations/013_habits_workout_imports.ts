import type { SQLiteDatabase } from 'expo-sqlite';

// - Daily habits: water (fl oz) and creatine (taken / not), one row per entry.
// - Snapshot jobs can also be "workout" imports (an Instagram reel's caption + images).
//   SQLite can't change a CHECK constraint, so the table is rebuilt with the data copied over.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE habit_log (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      habit TEXT NOT NULL,          -- 'water' | 'creatine'
      amount REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_habit_date ON habit_log(date, habit);

    CREATE TABLE snapshot_job_new (
      id INTEGER PRIMARY KEY,
      photo_path TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('label','meal','menu','recipe','workout')),
      status TEXT NOT NULL CHECK (status IN ('queued','processing','needs_review','done')),
      model_output_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      date TEXT,
      meal TEXT,
      error TEXT,
      extra_photos TEXT,
      context TEXT
    );
    INSERT INTO snapshot_job_new SELECT id, photo_path, kind, status, model_output_json, created_at, date, meal, error, extra_photos, context FROM snapshot_job;
    DROP TABLE snapshot_job;
    ALTER TABLE snapshot_job_new RENAME TO snapshot_job;
  `);
}
