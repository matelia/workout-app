import type { SQLiteDatabase } from 'expo-sqlite';

export type RoutineSummary = { id: number; name: string; exercise_count: number };

export type RoutineExercise = {
  id: number;
  exercise_id: number;
  name: string;
  muscle_group: string | null;
  sort_order: number;
  target_sets: number;
  target_reps: number;
};

export function listRoutines(db: SQLiteDatabase) {
  return db.getAllAsync<RoutineSummary>(
    `SELECT r.id, r.name, COUNT(re.id) AS exercise_count
     FROM routine r LEFT JOIN routine_exercise re ON re.routine_id = r.id
     WHERE r.archived = 0
     GROUP BY r.id ORDER BY r.created_at, r.id`,
  );
}

export function getRoutine(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<{ id: number; name: string }>(
    'SELECT id, name FROM routine WHERE id = ? AND archived = 0',
    id,
  );
}

export function listRoutineExercises(db: SQLiteDatabase, routineId: number) {
  return db.getAllAsync<RoutineExercise>(
    `SELECT re.id, re.exercise_id, e.name, e.muscle_group, re.sort_order, re.target_sets, re.target_reps
     FROM routine_exercise re JOIN exercise e ON e.id = re.exercise_id
     WHERE re.routine_id = ? ORDER BY re.sort_order, re.id`,
    routineId,
  );
}

export async function createRoutine(db: SQLiteDatabase, name: string) {
  return (await db.runAsync('INSERT INTO routine (name) VALUES (?)', name)).lastInsertRowId;
}

export async function renameRoutine(db: SQLiteDatabase, id: number, name: string) {
  await db.runAsync('UPDATE routine SET name = ? WHERE id = ?', name, id);
}

// Archived, not deleted, so past workout sessions keep their routine.
export async function archiveRoutine(db: SQLiteDatabase, id: number) {
  await db.runAsync('UPDATE routine SET archived = 1 WHERE id = ?', id);
}

export async function addExercisesToRoutine(db: SQLiteDatabase, routineId: number, exerciseIds: number[]) {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM routine_exercise WHERE routine_id = ?',
      routineId,
    );
    let order = row?.next ?? 0;
    for (const exerciseId of exerciseIds) {
      await db.runAsync(
        'INSERT INTO routine_exercise (routine_id, exercise_id, sort_order) VALUES (?, ?, ?)',
        routineId,
        exerciseId,
        order++,
      );
    }
  });
}

export async function updateTargets(db: SQLiteDatabase, id: number, sets: number, reps: number) {
  await db.runAsync(
    'UPDATE routine_exercise SET target_sets = ?, target_reps = ? WHERE id = ?',
    sets,
    reps,
    id,
  );
}

export async function removeRoutineExercise(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM routine_exercise WHERE id = ?', id);
}

/** Rewrites sort_order to match the given list of routine_exercise ids. */
export async function reorderRoutine(db: SQLiteDatabase, orderedIds: number[]) {
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync('UPDATE routine_exercise SET sort_order = ? WHERE id = ?', i, orderedIds[i]);
    }
  });
}
