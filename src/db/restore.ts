import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Replaces every table in `db` with the rows from the attached backup `b` (same columns by name).
 * Exported separately so it can be tested without the file system.
 */
export async function copyTablesFromAttached(db: SQLiteDatabase): Promise<Record<string, number>> {
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const counts: Record<string, number> = {};
  await db.withTransactionAsync(async () => {
    for (const { name } of tables) {
      const inBackup = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM b.sqlite_master WHERE type = 'table' AND name = ?", name);
      if (!inBackup?.n) continue;
      const mainCols = (await db.getAllAsync<{ name: string }>(`PRAGMA main.table_info(${name})`)).map((c) => c.name);
      const bCols = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA b.table_info(${name})`)).map((c) => c.name));
      const cols = mainCols.filter((c) => bCols.has(c)).map((c) => `"${c}"`).join(', ');
      await db.execAsync(`DELETE FROM main."${name}"; INSERT INTO main."${name}" (${cols}) SELECT ${cols} FROM b."${name}";`);
      counts[name] = (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM main."${name}"`))?.n ?? 0;
    }
  });
  return counts;
}
