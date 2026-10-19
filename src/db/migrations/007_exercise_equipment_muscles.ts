import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_INFO } from '@/data/exerciseInfo';

// Adds equipment + targeted muscles to exercises and fills in how-to text, a YouTube video,
// equipment and muscles for the calendar exercises. Never overwrites anything already set.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE exercise ADD COLUMN equipment TEXT;
    ALTER TABLE exercise ADD COLUMN muscles_primary TEXT;    -- JSON array of body-diagram slugs
    ALTER TABLE exercise ADD COLUMN muscles_secondary TEXT;  -- JSON array of body-diagram slugs
  `);
  for (const [name, info] of Object.entries(EXERCISE_INFO)) {
    await db.runAsync(
      `UPDATE exercise SET
         equipment = COALESCE(equipment, ?),
         muscles_primary = COALESCE(muscles_primary, ?),
         muscles_secondary = COALESCE(muscles_secondary, ?),
         notes = CASE WHEN notes IS NULL OR trim(notes) = '' THEN ? ELSE notes END,
         video_url_or_path = CASE WHEN video_type IS NULL THEN ? ELSE video_url_or_path END,
         video_type = COALESCE(video_type, 'youtube')
       WHERE name = ?`,
      info.equipment,
      JSON.stringify(info.primary),
      JSON.stringify(info.secondary),
      info.how,
      `https://youtu.be/${info.video}`,
      name,
    );
  }
}
