import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, parseDate, toDateStr, todayStr } from '@/lib/dates';

// Personal records and weekly streaks, computed from logged sets (no extra tables).

/** Estimated one-rep max (Epley). */
export const e1rm = (weight: number, reps: number) => (reps > 1 ? weight * (1 + reps / 30) : weight);

export type PR = { exercise: string; weight: number; reps: number; kind: 'weight' | 'e1rm' };

/** Best weight and best e1RM for an exercise in sessions before the given one. */
async function priorBest(db: SQLiteDatabase, exerciseId: number, sessionId: number) {
  const rows = await db.getAllAsync<{ weight_lb: number; reps: number }>(
    `SELECT l.weight_lb, l.reps FROM set_log l
     WHERE l.exercise_id = ? AND l.done = 1 AND l.weight_lb IS NOT NULL AND l.reps IS NOT NULL AND l.session_id != ?`,
    exerciseId,
    sessionId,
  );
  return {
    count: rows.length,
    weight: Math.max(0, ...rows.map((r) => r.weight_lb)),
    e1rm: Math.max(0, ...rows.map((r) => e1rm(r.weight_lb, r.reps))),
  };
}

/** Is this just-completed set a PR? Only counts when there is history to beat. */
export async function checkSetPR(db: SQLiteDatabase, setId: number): Promise<PR | null> {
  const s = await db.getFirstAsync<{ session_id: number; exercise_id: number; name: string; weight_lb: number | null; reps: number | null }>(
    'SELECT l.session_id, l.exercise_id, e.name, l.weight_lb, l.reps FROM set_log l JOIN exercise e ON e.id = l.exercise_id WHERE l.id = ?',
    setId,
  );
  if (!s?.weight_lb || !s.reps) return null;
  const prior = await priorBest(db, s.exercise_id, s.session_id);
  // Earlier sets in this same session also count as the bar to beat.
  const same = await db.getAllAsync<{ weight_lb: number; reps: number }>(
    'SELECT weight_lb, reps FROM set_log WHERE session_id = ? AND exercise_id = ? AND done = 1 AND id != ? AND weight_lb IS NOT NULL AND reps IS NOT NULL',
    s.session_id,
    s.exercise_id,
    setId,
  );
  if (!prior.count) return null;
  const barWeight = Math.max(prior.weight, ...same.map((x) => x.weight_lb));
  const barE1rm = Math.max(prior.e1rm, ...same.map((x) => e1rm(x.weight_lb, x.reps)));
  if (s.weight_lb > barWeight) return { exercise: s.name, weight: s.weight_lb, reps: s.reps, kind: 'weight' };
  if (e1rm(s.weight_lb, s.reps) > barE1rm + 0.01) return { exercise: s.name, weight: s.weight_lb, reps: s.reps, kind: 'e1rm' };
  return null;
}

/** PRs set in a session (best set per exercise vs everything before it). */
export async function sessionPRs(db: SQLiteDatabase, sessionId: number): Promise<PR[]> {
  const sets = await db.getAllAsync<{ exercise_id: number; name: string; weight_lb: number; reps: number }>(
    `SELECT l.exercise_id, e.name, l.weight_lb, l.reps FROM set_log l JOIN exercise e ON e.id = l.exercise_id
     WHERE l.session_id = ? AND l.done = 1 AND l.weight_lb IS NOT NULL AND l.reps IS NOT NULL`,
    sessionId,
  );
  const out: PR[] = [];
  for (const exId of new Set(sets.map((s) => s.exercise_id))) {
    const mine = sets.filter((s) => s.exercise_id === exId);
    const prior = await priorBest(db, exId, sessionId);
    if (!prior.count) continue;
    const heaviest = mine.reduce((a, b) => (b.weight_lb > a.weight_lb ? b : a));
    const strongest = mine.reduce((a, b) => (e1rm(b.weight_lb, b.reps) > e1rm(a.weight_lb, a.reps) ? b : a));
    if (heaviest.weight_lb > prior.weight) out.push({ exercise: heaviest.name, weight: heaviest.weight_lb, reps: heaviest.reps, kind: 'weight' });
    else if (e1rm(strongest.weight_lb, strongest.reps) > prior.e1rm + 0.01)
      out.push({ exercise: strongest.name, weight: strongest.weight_lb, reps: strongest.reps, kind: 'e1rm' });
  }
  return out;
}

/** Best set (by e1RM) per exercise, most recent records first. */
export async function listRecords(db: SQLiteDatabase, limit = 20) {
  const rows = await db.getAllAsync<{ name: string; weight_lb: number; reps: number; date: string }>(
    `SELECT e.name, l.weight_lb, l.reps, s.date FROM set_log l
     JOIN exercise e ON e.id = l.exercise_id JOIN workout_session s ON s.id = l.session_id
     WHERE l.done = 1 AND l.weight_lb IS NOT NULL AND l.reps IS NOT NULL`,
  );
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = best.get(r.name);
    if (!cur || e1rm(r.weight_lb, r.reps) > e1rm(cur.weight_lb, cur.reps)) best.set(r.name, r);
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

const mondayOf = (date: string) => {
  const d = parseDate(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateStr(d);
};

/**
 * Weeks in a row (Monday-based) with at least `perWeek` finished workouts. The current week
 * counts once it reaches the target; until then the streak runs through last week.
 */
export async function weeklyStreak(db: SQLiteDatabase, perWeek: number) {
  const rows = await db.getAllAsync<{ date: string }>('SELECT date FROM workout_session WHERE end_time IS NOT NULL ORDER BY date DESC LIMIT 1000');
  const perWeekCount = new Map<string, number>();
  for (const r of rows) {
    const w = mondayOf(r.date);
    perWeekCount.set(w, (perWeekCount.get(w) ?? 0) + 1);
  }
  const target = Math.max(1, perWeek);
  let week = mondayOf(todayStr());
  if ((perWeekCount.get(week) ?? 0) < target) week = addDays(week, -7);
  let n = 0;
  while ((perWeekCount.get(week) ?? 0) >= target) {
    n++;
    week = addDays(week, -7);
  }
  return { weeks: n, thisWeek: perWeekCount.get(mondayOf(todayStr())) ?? 0, target };
}
