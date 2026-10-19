import type { SQLiteDatabase } from 'expo-sqlite';

export type ScheduledWorkout = {
  id: number;
  routine_id: number;
  routine_name: string;
  weekday: number | null;
  date: string | null;
  reminder_time: string | null;
};

const SELECT = `SELECT s.id, s.routine_id, r.name AS routine_name, s.weekday, s.date, s.reminder_time
  FROM scheduled_workout s JOIN routine r ON r.id = s.routine_id AND r.archived = 0`;

export function listSchedule(db: SQLiteDatabase) {
  return db.getAllAsync<ScheduledWorkout>(`${SELECT} ORDER BY s.weekday IS NULL, s.weekday, s.date, s.reminder_time`);
}

/** Weekly entries for that weekday plus one-offs on that exact date. */
export function scheduleForDate(db: SQLiteDatabase, date: string, weekday: number) {
  return db.getAllAsync<ScheduledWorkout>(
    `${SELECT} WHERE s.weekday = ? OR s.date = ? ORDER BY s.reminder_time`,
    weekday,
    date,
  );
}

export async function addScheduled(
  db: SQLiteDatabase,
  routineId: number,
  when: { weekday: number } | { date: string },
  reminderTime: string | null,
) {
  await db.runAsync(
    'INSERT INTO scheduled_workout (routine_id, weekday, date, reminder_time) VALUES (?, ?, ?, ?)',
    routineId,
    'weekday' in when ? when.weekday : null,
    'date' in when ? when.date : null,
    reminderTime,
  );
}

export async function updateReminder(db: SQLiteDatabase, id: number, reminderTime: string | null) {
  await db.runAsync('UPDATE scheduled_workout SET reminder_time = ? WHERE id = ?', reminderTime, id);
}

export async function removeScheduled(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM scheduled_workout WHERE id = ?', id);
}
