import type { SQLiteDatabase } from 'expo-sqlite';

// Restaurant menu items reuse the grocery table (store = restaurant name, one "item" serving),
// so they get the same search, serving buttons and snapshot matching.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE pantry_item ADD COLUMN place_type TEXT NOT NULL DEFAULT 'grocery'; -- 'grocery' | 'restaurant'
  `);
}
