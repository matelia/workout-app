import type { SQLiteDatabase } from 'expo-sqlite';

// Weekly schedule from the Google Calendar "Gym (…)" events: Mon 6:05, Tue 6:05, Thu 7:30.
const SCHEDULE: [routine: string, weekday: number, time: string][] = [
  ['Back & Shoulder', 1, '06:05'],
  ['Upper Body', 2, '06:05'],
  ['Legs & Abs', 4, '07:30'],
];

export async function up(db: SQLiteDatabase) {
  for (const [name, weekday, time] of SCHEDULE) {
    const r = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM routine WHERE name = ? AND archived = 0',
      name,
    );
    if (!r) continue;
    await db.runAsync(
      'INSERT INTO scheduled_workout (routine_id, weekday, reminder_time) VALUES (?, ?, ?)',
      r.id,
      weekday,
      time,
    );
  }
  await db.runAsync('INSERT OR IGNORE INTO targets (id) VALUES (1)');
}
