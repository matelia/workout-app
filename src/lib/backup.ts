import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrate } from '@/db/migrate';
import { copyTablesFromAttached } from '@/db/restore';
import { todayStr } from '@/lib/dates';

// Full backup: a consistent copy of the database (VACUUM INTO) plus every media folder,
// written into a folder you pick (iCloud Drive / On My iPhone). Restore reads that folder back.

const MEDIA_FOLDERS = ['videos', 'snapshots', 'checkins', 'body-photos', 'screenshots'];
const DB_NAME = 'steady.db';

const fsPath = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));
const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

export async function createBackup(db: SQLiteDatabase): Promise<string> {
  const target = await Directory.pickDirectoryAsync();
  const stamp = new Date().toTimeString().slice(0, 5).replace(':', '');
  const name = `Tend backup ${todayStr()} ${stamp}`;
  const dest = new Directory(target, name);
  dest.create({ idempotent: true });

  const tmp = new File(Paths.cache, 'backup.db');
  if (tmp.exists) tmp.delete();
  await db.execAsync(`VACUUM INTO ${sqlString(fsPath(tmp.uri))}`);
  tmp.copySync(new File(dest, DB_NAME));
  tmp.delete();

  for (const folder of MEDIA_FOLDERS) {
    const dir = new Directory(Paths.document, folder);
    if (dir.exists) dir.copySync(dest);
  }
  const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  const manifest = new File(dest, 'manifest.json');
  manifest.create({ overwrite: true });
  manifest.write(JSON.stringify({ app: 'Tend', schema: version, created: new Date().toISOString() }, null, 2));
  return name;
}

export async function restoreBackup(db: SQLiteDatabase): Promise<Record<string, number>> {
  const picked = await Directory.pickDirectoryAsync();
  const entries = picked.list();
  const backupDb = entries.find((e): e is File => e instanceof File && e.name === DB_NAME);
  if (!backupDb) throw new Error('That folder isn’t a Tend backup (no steady.db inside). Pick the “Tend backup …” folder itself.');

  // Bring the backup up to the current schema in a scratch database first.
  const sqliteDir = new Directory(Paths.document, 'SQLite');
  sqliteDir.create({ idempotent: true, intermediates: true });
  const scratch = new File(sqliteDir, 'restore.db');
  if (scratch.exists) scratch.delete();
  backupDb.copySync(scratch);
  const rdb = await openDatabaseAsync('restore.db');
  await migrate(rdb);
  await rdb.closeAsync();

  await db.execAsync('PRAGMA foreign_keys = OFF');
  await db.execAsync(`ATTACH DATABASE ${sqlString(fsPath(scratch.uri))} AS b`);
  let counts: Record<string, number>;
  try {
    counts = await copyTablesFromAttached(db);
  } finally {
    await db.execAsync('DETACH DATABASE b');
    await db.execAsync('PRAGMA foreign_keys = ON');
    if (scratch.exists) scratch.delete();
  }

  for (const folder of MEDIA_FOLDERS) {
    const src = entries.find((e): e is Directory => e instanceof Directory && e.name === folder);
    if (!src) continue;
    const local = new Directory(Paths.document, folder);
    if (local.exists) local.delete();
    src.copySync(new Directory(Paths.document));
  }
  return counts;
}
