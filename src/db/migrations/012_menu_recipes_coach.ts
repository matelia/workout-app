import type { SQLiteDatabase } from 'expo-sqlite';

// - Snapshot jobs can now be restaurant-menu and recipe screenshots (several photos per job).
//   SQLite can't change a CHECK constraint, so the table is rebuilt with the data copied over.
// - Cookbook recipes. Their per-serving nutrition is a food + "recipe" pantry item, so logging,
//   search and snapshot matching work like groceries/restaurants.
// - Coach chat messages, queued while the laptop is offline.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE snapshot_job_new (
      id INTEGER PRIMARY KEY,
      photo_path TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('label','meal','menu','recipe')),
      status TEXT NOT NULL CHECK (status IN ('queued','processing','needs_review','done')),
      model_output_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      date TEXT,
      meal TEXT,
      error TEXT,
      extra_photos TEXT,   -- JSON array of more photo paths (menu/recipe screenshots)
      context TEXT         -- JSON, e.g. {"restaurant":"Chick-fil-A"}
    );
    INSERT INTO snapshot_job_new (id, photo_path, kind, status, model_output_json, created_at, date, meal, error)
      SELECT id, photo_path, kind, status, model_output_json, created_at, date, meal, error FROM snapshot_job;
    DROP TABLE snapshot_job;
    ALTER TABLE snapshot_job_new RENAME TO snapshot_job;

    CREATE TABLE recipe (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      source_url TEXT,
      image_url TEXT,
      servings REAL NOT NULL DEFAULT 1,
      ingredients TEXT NOT NULL DEFAULT '[]',   -- JSON array of lines
      steps TEXT NOT NULL DEFAULT '[]',         -- JSON array of steps
      food_id INTEGER REFERENCES food(id),      -- per-serving nutrition (null until known)
      nutrition_note TEXT,                      -- e.g. "Estimated from ingredients"
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE coach_message (
      id INTEGER PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      kind TEXT NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','plan')),
      text TEXT NOT NULL,
      payload TEXT,                             -- JSON (plan proposals)
      status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('queued','sending','done','error')),
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
