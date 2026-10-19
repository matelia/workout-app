import type { SQLiteDatabase } from 'expo-sqlite';

// Simple key/value settings (rest timer default, USDA key, snapshot server URL, …).
export async function getSetting(db: SQLiteDatabase, key: string) {
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM setting WHERE key = ?', key))?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string | null) {
  if (value === null) await db.runAsync('DELETE FROM setting WHERE key = ?', key);
  else
    await db.runAsync(
      'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
}
