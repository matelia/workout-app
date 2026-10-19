import type { SQLiteDatabase } from 'expo-sqlite';

// "My groceries": the specific products you buy (usually scanned by barcode), where from,
// and what kind of food they are, so snapshots and searches can default to them.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE pantry_item (
      id INTEGER PRIMARY KEY,
      food_id INTEGER NOT NULL UNIQUE REFERENCES food(id),
      store TEXT,                       -- e.g. Costco, Wegmans, Whole Foods
      kind TEXT NOT NULL,               -- generic name used for matching, e.g. "peanut butter"
      aliases TEXT,                     -- JSON array of extra words, e.g. ["pb"]
      serving_g REAL,                   -- e.g. 38 (one slice)
      serving_label TEXT,               -- e.g. "slice"
      in_rotation INTEGER NOT NULL DEFAULT 1,
      last_bought TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
