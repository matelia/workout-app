import type { SQLiteDatabase } from 'expo-sqlite';

// Queued snapshots may be processed hours later, so remember which day/meal they belong to.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE snapshot_job ADD COLUMN date TEXT;
    ALTER TABLE snapshot_job ADD COLUMN meal TEXT;
    ALTER TABLE snapshot_job ADD COLUMN error TEXT;
  `);
}
