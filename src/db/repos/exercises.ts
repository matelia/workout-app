import type { SQLiteDatabase } from 'expo-sqlite';

export type VideoType = 'youtube' | 'instagram' | 'file';

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string | null;
  notes: string | null;
  video_type: VideoType | null;
  video_url_or_path: string | null;
  equipment: string | null;
  muscles_primary: string | null; // JSON array of body-diagram slugs
  muscles_secondary: string | null; // JSON array of body-diagram slugs
};

export type ExerciseInput = Omit<Exercise, 'id'>;

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Traps',
  'Biceps',
  'Triceps',
  'Forearms',
  'Legs',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Full body',
  'Cardio',
  'Other',
] as const;

const COLUMNS =
  'id, name, muscle_group, notes, video_type, video_url_or_path, equipment, muscles_primary, muscles_secondary';

export function listExercises(db: SQLiteDatabase) {
  return db.getAllAsync<Exercise>(
    `SELECT ${COLUMNS} FROM exercise WHERE archived = 0 ORDER BY name COLLATE NOCASE`,
  );
}

export function getExercise(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Exercise>(`SELECT ${COLUMNS} FROM exercise WHERE id = ?`, id);
}

export async function createExercise(db: SQLiteDatabase, e: ExerciseInput) {
  const r = await db.runAsync(
    'INSERT INTO exercise (name, muscle_group, notes, video_type, video_url_or_path, equipment, muscles_primary, muscles_secondary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    e.name,
    e.muscle_group,
    e.notes,
    e.video_type,
    e.video_url_or_path,
    e.equipment,
    e.muscles_primary,
    e.muscles_secondary,
  );
  return r.lastInsertRowId;
}

export async function updateExercise(db: SQLiteDatabase, id: number, e: ExerciseInput) {
  await db.runAsync(
    'UPDATE exercise SET name = ?, muscle_group = ?, notes = ?, video_type = ?, video_url_or_path = ?, equipment = ?, muscles_primary = ?, muscles_secondary = ? WHERE id = ?',
    e.name,
    e.muscle_group,
    e.notes,
    e.video_type,
    e.video_url_or_path,
    e.equipment,
    e.muscles_primary,
    e.muscles_secondary,
    id,
  );
}

// Archive instead of delete so logged sets keep pointing at a real exercise.
export async function archiveExercise(db: SQLiteDatabase, id: number) {
  await db.runAsync('UPDATE exercise SET archived = 1 WHERE id = ?', id);
}
