import type { SQLiteDatabase } from 'expo-sqlite';

import { nowLocalIso, todayStr } from '@/lib/dates';

export type Session = {
  id: number;
  routine_id: number | null;
  routine_name: string | null;
  date: string;
  start_time: string;
  end_time: string | null;
};

export type SetRow = {
  id: number;
  exercise_id: number;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_lb: number | null;
  done: number;
};

export type SessionExercise = { exercise_id: number; name: string; sets: SetRow[] };

const SESSION_SELECT = `SELECT s.id, s.routine_id, r.name AS routine_name, s.date, s.start_time, s.end_time
  FROM workout_session s LEFT JOIN routine r ON r.id = s.routine_id`;

export function getSession(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Session>(`${SESSION_SELECT} WHERE s.id = ?`, id);
}

export function getActiveSession(db: SQLiteDatabase) {
  return db.getFirstAsync<Session>(`${SESSION_SELECT} WHERE s.end_time IS NULL ORDER BY s.id DESC LIMIT 1`);
}

export function listRecentSessions(db: SQLiteDatabase, limit = 10) {
  return db.getAllAsync<Session & { sets_done: number }>(
    `SELECT s.id, s.routine_id, r.name AS routine_name, s.date, s.start_time, s.end_time,
       (SELECT COUNT(*) FROM set_log l WHERE l.session_id = s.id AND l.done = 1) AS sets_done
     FROM workout_session s LEFT JOIN routine r ON r.id = s.routine_id
     WHERE s.end_time IS NOT NULL ORDER BY s.date DESC, s.id DESC LIMIT ?`,
    limit,
  );
}

export function sessionsOnDate(db: SQLiteDatabase, date: string) {
  return db.getAllAsync<Session>(`${SESSION_SELECT} WHERE s.date = ?`, date);
}

/**
 * Values to pre-fill for set N of an exercise: the same set number from the most recent
 * finished session of that exercise, else that session's last set, else the target reps.
 */
async function prefill(db: SQLiteDatabase, exerciseId: number, setNumber: number, excludeSession: number) {
  const last = await db.getFirstAsync<{ session_id: number }>(
    `SELECT l.session_id FROM set_log l JOIN workout_session s ON s.id = l.session_id
     WHERE l.exercise_id = ? AND l.done = 1 AND l.session_id != ?
     ORDER BY s.date DESC, s.id DESC LIMIT 1`,
    exerciseId,
    excludeSession,
  );
  if (!last) return null;
  return db.getFirstAsync<{ reps: number | null; weight_lb: number | null }>(
    `SELECT reps, weight_lb FROM set_log
     WHERE session_id = ? AND exercise_id = ? AND done = 1
     ORDER BY (set_number = ?) DESC, set_number DESC LIMIT 1`,
    last.session_id,
    exerciseId,
    setNumber,
  );
}

async function insertSets(
  db: SQLiteDatabase,
  sessionId: number,
  exerciseId: number,
  count: number,
  targetReps: number | null,
  startAt = 1,
) {
  for (let n = startAt; n < startAt + count; n++) {
    const p = await prefill(db, exerciseId, n, sessionId);
    await db.runAsync(
      'INSERT INTO set_log (session_id, exercise_id, set_number, reps, weight_lb, done) VALUES (?, ?, ?, ?, ?, 0)',
      sessionId,
      exerciseId,
      n,
      p?.reps ?? targetReps,
      p?.weight_lb ?? null,
    );
  }
}

export async function startSession(db: SQLiteDatabase, routineId: number | null) {
  let sessionId = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      'INSERT INTO workout_session (routine_id, date, start_time) VALUES (?, ?, ?)',
      routineId,
      todayStr(),
      nowLocalIso(),
    );
    sessionId = r.lastInsertRowId;
    if (routineId === null) return;
    const items = await db.getAllAsync<{ exercise_id: number; target_sets: number; target_reps: number }>(
      'SELECT exercise_id, target_sets, target_reps FROM routine_exercise WHERE routine_id = ? ORDER BY sort_order, id',
      routineId,
    );
    for (const it of items) await insertSets(db, sessionId, it.exercise_id, it.target_sets, it.target_reps);
  });
  return sessionId;
}

export async function listSessionExercises(db: SQLiteDatabase, sessionId: number): Promise<SessionExercise[]> {
  const rows = await db.getAllAsync<SetRow>(
    `SELECT l.id, l.exercise_id, e.name AS exercise_name, l.set_number, l.reps, l.weight_lb, l.done
     FROM set_log l JOIN exercise e ON e.id = l.exercise_id
     WHERE l.session_id = ? ORDER BY l.id`,
    sessionId,
  );
  // Group by exercise, keeping the order each exercise first appeared.
  const groups = new Map<number, SessionExercise>();
  for (const row of rows) {
    if (!groups.has(row.exercise_id))
      groups.set(row.exercise_id, { exercise_id: row.exercise_id, name: row.exercise_name, sets: [] });
    groups.get(row.exercise_id)!.sets.push(row);
  }
  for (const g of groups.values()) g.sets.sort((a, b) => a.set_number - b.set_number);
  return [...groups.values()];
}

/** "Last time" summary for an exercise, e.g. "3 × 8 @ 135 lb". */
export async function lastTimeSummary(db: SQLiteDatabase, exerciseId: number, excludeSession: number) {
  const last = await db.getFirstAsync<{ session_id: number; date: string }>(
    `SELECT l.session_id, s.date FROM set_log l JOIN workout_session s ON s.id = l.session_id
     WHERE l.exercise_id = ? AND l.done = 1 AND l.session_id != ?
     ORDER BY s.date DESC, s.id DESC LIMIT 1`,
    exerciseId,
    excludeSession,
  );
  if (!last) return null;
  const sets = await db.getAllAsync<{ reps: number | null; weight_lb: number | null }>(
    'SELECT reps, weight_lb FROM set_log WHERE session_id = ? AND exercise_id = ? AND done = 1 ORDER BY set_number',
    last.session_id,
    exerciseId,
  );
  return { date: last.date, sets };
}

export async function updateSet(db: SQLiteDatabase, id: number, reps: number | null, weight: number | null) {
  await db.runAsync('UPDATE set_log SET reps = ?, weight_lb = ? WHERE id = ?', reps, weight, id);
}

export async function setDone(db: SQLiteDatabase, id: number, done: boolean) {
  await db.runAsync(
    'UPDATE set_log SET done = ?, completed_at = ? WHERE id = ?',
    done ? 1 : 0,
    done ? nowLocalIso() : null,
    id,
  );
}

/** Adds one more set, copying the previous set's values. */
export async function addSet(db: SQLiteDatabase, sessionId: number, exerciseId: number) {
  const prev = await db.getFirstAsync<{ set_number: number; reps: number | null; weight_lb: number | null }>(
    'SELECT set_number, reps, weight_lb FROM set_log WHERE session_id = ? AND exercise_id = ? ORDER BY set_number DESC LIMIT 1',
    sessionId,
    exerciseId,
  );
  await db.runAsync(
    'INSERT INTO set_log (session_id, exercise_id, set_number, reps, weight_lb, done) VALUES (?, ?, ?, ?, ?, 0)',
    sessionId,
    exerciseId,
    (prev?.set_number ?? 0) + 1,
    prev?.reps ?? null,
    prev?.weight_lb ?? null,
  );
}

export async function deleteSet(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM set_log WHERE id = ?', id);
}

export async function addExerciseToSession(db: SQLiteDatabase, sessionId: number, exerciseId: number) {
  // Use as many sets as last time (default 3).
  const last = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM set_log WHERE exercise_id = ? AND done = 1 AND session_id = (
       SELECT l.session_id FROM set_log l JOIN workout_session s ON s.id = l.session_id
       WHERE l.exercise_id = ? AND l.done = 1 AND l.session_id != ? ORDER BY s.date DESC, s.id DESC LIMIT 1)`,
    exerciseId,
    exerciseId,
    sessionId,
  );
  await insertSets(db, sessionId, exerciseId, last?.n || 3, null);
}

export async function finishSession(db: SQLiteDatabase, id: number) {
  // Unchecked sets were never done; drop them so history only holds real sets.
  await db.runAsync('DELETE FROM set_log WHERE session_id = ? AND done = 0', id);
  await db.runAsync('UPDATE workout_session SET end_time = ? WHERE id = ?', nowLocalIso(), id);
}

export async function discardSession(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM workout_session WHERE id = ?', id);
}
