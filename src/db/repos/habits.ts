import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, nowLocalIso, todayStr } from '@/lib/dates';

export type Habit = 'water' | 'creatine';

export async function habitTotal(db: SQLiteDatabase, date: string, habit: Habit) {
  return (
    (await db.getFirstAsync<{ n: number }>('SELECT COALESCE(SUM(amount), 0) AS n FROM habit_log WHERE date = ? AND habit = ?', date, habit))?.n ?? 0
  );
}

export async function logHabit(db: SQLiteDatabase, date: string, habit: Habit, amount = 1) {
  await db.runAsync('INSERT INTO habit_log (date, habit, amount, created_at) VALUES (?, ?, ?, ?)', date, habit, amount, nowLocalIso());
}

/** Removes the most recent entry (undo for water, un-tick for creatine). */
export async function undoHabit(db: SQLiteDatabase, date: string, habit: Habit) {
  await db.runAsync(
    'DELETE FROM habit_log WHERE id = (SELECT id FROM habit_log WHERE date = ? AND habit = ? ORDER BY id DESC LIMIT 1)',
    date,
    habit,
  );
}

/** Consecutive days (ending today or yesterday) with the habit logged. */
export async function habitStreak(db: SQLiteDatabase, habit: Habit) {
  const rows = await db.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM habit_log WHERE habit = ? ORDER BY date DESC LIMIT 400', habit);
  const days = new Set(rows.map((r) => r.date));
  let d = days.has(todayStr()) ? todayStr() : addDays(todayStr(), -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
