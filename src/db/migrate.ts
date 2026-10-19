import type { SQLiteDatabase } from 'expo-sqlite';

import * as m001 from './migrations/001_initial';
import * as m002 from './migrations/002_seed_exercises';
import * as m003 from './migrations/003_calendar_import';
import * as m004 from './migrations/004_schedule_from_calendar';
import * as m005 from './migrations/005_snapshot_date_meal';
import * as m006 from './migrations/006_checkin_media_photos_metrics';
import * as m007 from './migrations/007_exercise_equipment_muscles';
import * as m008 from './migrations/008_pantry';
import * as m009 from './migrations/009_more_nutrients';
import * as m010 from './migrations/010_restaurants';
import * as m011 from './migrations/011_video_start_times';
import * as m012 from './migrations/012_menu_recipes_coach';
import * as m013 from './migrations/013_habits_workout_imports';

// Append new migrations here. Never edit one that has shipped; add a new file instead.
// The applied version is stored in SQLite's built-in PRAGMA user_version.
const MIGRATIONS: { version: number; up: (db: SQLiteDatabase) => Promise<void> }[] = [
  { version: 1, up: m001.up },
  { version: 2, up: m002.up },
  { version: 3, up: m003.up },
  { version: 4, up: m004.up },
  { version: 5, up: m005.up },
  { version: 6, up: m006.up },
  { version: 7, up: m007.up },
  { version: 8, up: m008.up },
  { version: 9, up: m009.up },
  { version: 10, up: m010.up },
  { version: 11, up: m011.up },
  { version: 12, up: m012.up },
  { version: 13, up: m013.up },
];

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
  }
}
