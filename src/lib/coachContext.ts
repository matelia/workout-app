import type { SQLiteDatabase } from 'expo-sqlite';

import { latestMetrics, listMetrics } from '@/db/repos/bodyMetrics';
import { getGoals, goalsText } from '@/db/repos/coach';
import { dayTotals, getTargets } from '@/db/repos/food';
import { listRecords } from '@/db/repos/records';
import { listRoutineExercises, listRoutines } from '@/db/repos/routines';
import { listSchedule } from '@/db/repos/schedule';
import { addDays, todayStr, WEEKDAYS_LONG } from '@/lib/dates';

// Plain-text summary of the user's training, nutrition and body data for the coach.
// Mind data (check-ins, journal, therapy, care) is never included.

export async function buildCoachContext(db: SQLiteDatabase): Promise<string> {
  const today = todayStr();
  const lines: string[] = [`Today is ${WEEKDAYS_LONG[new Date().getDay()]} ${today}. Units: lb, kcal, g.`];

  lines.push(`\nGOALS\n${goalsText(await getGoals(db))}`);

  const schedule = await listSchedule(db);
  const weekly = schedule.filter((s) => s.weekday !== null);
  lines.push(
    `\nWEEKLY SCHEDULE\n${weekly.length ? weekly.map((s) => `${WEEKDAYS_LONG[s.weekday!]}: ${s.routine_name}`).join('\n') : 'None'}`,
  );

  const routines = await listRoutines(db);
  const routineLines: string[] = [];
  for (const r of routines) {
    const ex = await listRoutineExercises(db, r.id);
    routineLines.push(`${r.name}: ${ex.map((e) => `${e.name} ${e.target_sets}x${e.target_reps}`).join(', ') || '(empty)'}`);
  }
  lines.push(`\nROUTINES\n${routineLines.join('\n') || 'None'}`);

  // Training: last 6 weeks, per exercise best set early vs recent.
  const since = addDays(today, -42);
  const sessions = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workout_session WHERE end_time IS NOT NULL AND date >= ?',
    since,
  );
  const lifts = await db.getAllAsync<{ name: string; date: string; weight: number; reps: number }>(
    `SELECT e.name, s.date, l.weight_lb AS weight, l.reps
     FROM set_log l JOIN workout_session s ON s.id = l.session_id JOIN exercise e ON e.id = l.exercise_id
     WHERE l.done = 1 AND l.weight_lb IS NOT NULL AND s.date >= ? ORDER BY s.date`,
    since,
  );
  const byEx = new Map<string, { date: string; weight: number; reps: number }[]>();
  for (const l of lifts) {
    if (!byEx.has(l.name)) byEx.set(l.name, []);
    byEx.get(l.name)!.push(l);
  }
  const liftLines = [...byEx.entries()].slice(0, 40).map(([name, sets]) => {
    const best = (xs: typeof sets) => xs.reduce((a, b) => (b.weight * (1 + b.reps / 30) > a.weight * (1 + a.reps / 30) ? b : a));
    const first = best(sets.filter((s) => s.date === sets[0].date));
    const last = best(sets.filter((s) => s.date === sets[sets.length - 1].date));
    return `${name}: ${first.date} best ${first.weight}x${first.reps} -> ${last.date} best ${last.weight}x${last.reps} (${new Set(sets.map((s) => s.date)).size} sessions)`;
  });
  lines.push(`\nTRAINING (last 6 weeks): ${sessions?.n ?? 0} workouts finished\n${liftLines.join('\n') || 'No logged sets yet.'}`);

  // Records set in the last 7 days, and habits.
  const recent = (await listRecords(db, 100)).filter((r) => r.date >= addDays(today, -7));
  lines.push(`\nRECENT BEST SETS (last 7 days)\n${recent.map((r) => `${r.name} ${r.weight_lb}x${r.reps} on ${r.date}`).join('\n') || 'None'}`);
  const habits = await db.getAllAsync<{ habit: string; days: number; total: number }>(
    'SELECT habit, COUNT(DISTINCT date) AS days, SUM(amount) AS total FROM habit_log WHERE date >= ? GROUP BY habit',
    addDays(today, -6),
  );
  const water = habits.find((h) => h.habit === 'water');
  const creatine = habits.find((h) => h.habit === 'creatine');
  lines.push(
    `\nHABITS (last 7 days)\nwater: ${water ? Math.round(water.total / 7) : 0} fl oz/day average; creatine: taken ${creatine?.days ?? 0} of 7 days`,
  );

  // Nutrition: last 14 days with food logged.
  const targets = await getTargets(db);
  const days = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM food_log WHERE date BETWEEN ? AND ? ORDER BY date',
    addDays(today, -13),
    today,
  );
  if (days.length) {
    const totals = await Promise.all(days.map((d) => dayTotals(db, d.date)));
    const avg = (k: keyof (typeof totals)[number]) => Math.round(totals.reduce((a, t) => a + t[k], 0) / totals.length);
    lines.push(
      `\nNUTRITION (daily average over ${days.length} logged days of the last 14)\n` +
        `kcal ${avg('kcal')} (target ${targets.kcal ?? 'none'}), protein ${avg('protein')} g (target ${targets.protein_g ?? 'none'}), ` +
        `carbs ${avg('carbs')} g, fat ${avg('fat')} g, fiber ${avg('fiber')} g, sodium ${avg('sodium')} mg`,
    );
  } else lines.push('\nNUTRITION\nNo food logged in the last 2 weeks.');

  // Body.
  const latest = await latestMetrics(db);
  const history = (await listMetrics(db, 365)).filter((m) => m.weight_lb !== null && m.date >= addDays(today, -30));
  const bodyBits = [
    latest.weight_lb && `weight ${latest.weight_lb.value} lb (${latest.weight_lb.date})`,
    history.length > 1 && `30-day change ${(history[history.length - 1].weight_lb! - history[0].weight_lb!).toFixed(1)} lb`,
    latest.body_fat_pct && `body fat ${latest.body_fat_pct.value}%`,
    latest.skeletal_muscle_pct && `skeletal muscle ${latest.skeletal_muscle_pct.value}%`,
  ].filter(Boolean);
  lines.push(`\nBODY\n${bodyBits.join(', ') || 'No body data.'}`);

  return lines.join('\n');
}
