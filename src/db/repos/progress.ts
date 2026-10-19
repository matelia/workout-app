import type { SQLiteDatabase } from 'expo-sqlite';

import { dayTotals } from '@/db/repos/food';
import { addDays, parseDate, toDateStr, todayStr } from '@/lib/dates';

// ── Lifts ──
export type LiftPoint = { date: string; top: number; e1rm: number; volume: number };

export function loggedExercises(db: SQLiteDatabase) {
  return db.getAllAsync<{ id: number; name: string; sessions: number }>(
    `SELECT e.id, e.name, COUNT(DISTINCT l.session_id) AS sessions
     FROM set_log l JOIN exercise e ON e.id = l.exercise_id
     WHERE l.done = 1 AND l.weight_lb IS NOT NULL
     GROUP BY e.id ORDER BY MAX(l.id) DESC`,
  );
}

/** Per session: heaviest set, best estimated 1RM (Epley), and total volume. */
export async function liftHistory(db: SQLiteDatabase, exerciseId: number): Promise<LiftPoint[]> {
  const rows = await db.getAllAsync<{ session_id: number; date: string; reps: number | null; weight_lb: number | null }>(
    `SELECT l.session_id, s.date, l.reps, l.weight_lb FROM set_log l JOIN workout_session s ON s.id = l.session_id
     WHERE l.exercise_id = ? AND l.done = 1 AND l.weight_lb IS NOT NULL ORDER BY s.date, s.id`,
    exerciseId,
  );
  const bySession = new Map<number, LiftPoint>();
  for (const r of rows) {
    const w = r.weight_lb ?? 0;
    const reps = r.reps ?? 0;
    const p = bySession.get(r.session_id) ?? { date: r.date, top: 0, e1rm: 0, volume: 0 };
    p.top = Math.max(p.top, w);
    p.e1rm = Math.max(p.e1rm, reps > 0 ? w * (1 + reps / 30) : w);
    p.volume += w * reps;
    bySession.set(r.session_id, p);
  }
  return [...bySession.values()];
}

// ── Nutrition ──
/** Monday of the week containing `date`. */
function weekStart(date: string) {
  const d = parseDate(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toDateStr(d);
}

/** Average daily kcal/protein per week, over days that have any food logged. */
export async function weeklyNutrition(db: SQLiteDatabase, weeks = 8) {
  const today = todayStr();
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const logged = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM food_log WHERE date BETWEEN ? AND ? ORDER BY date',
    start,
    today,
  );
  const sums = new Map<string, { kcal: number; protein: number; days: number }>();
  for (let i = 0; i < weeks; i++) sums.set(addDays(start, i * 7), { kcal: 0, protein: 0, days: 0 });
  for (const { date } of logged) {
    const t = await dayTotals(db, date);
    const w = sums.get(weekStart(date));
    if (!w) continue;
    w.kcal += t.kcal;
    w.protein += t.protein;
    w.days += 1;
  }
  return [...sums.entries()].map(([week, s]) => ({
    week,
    kcal: s.days ? s.kcal / s.days : 0,
    protein: s.days ? s.protein / s.days : 0,
    days: s.days,
  }));
}
