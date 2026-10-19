import type { SQLiteDatabase } from 'expo-sqlite';

// Exercises and routines imported from the "Gym (…)" events in Google Calendar (2026-10-19).
// Variants like "(machine / barbell)" become separate exercises so their weights are tracked separately.

type Routine = { name: string; exercises: [name: string, muscle: string][] };

const ROUTINES: Routine[] = [
  {
    name: 'Back & Shoulder',
    exercises: [
      ['Dumbbell Lateral Raise', 'Shoulders'],
      ['Dumbbell Shoulder Raise', 'Shoulders'],
      ['Barbell Deadlift', 'Back'],
      ['Dumbbell Bent-Over Row', 'Back'],
      ['Rowing', 'Back'],
      ['Cable Lat Pulldown', 'Back'],
      ['Cable Lat Pulldown (Underhand)', 'Back'],
      ['Face Pull', 'Shoulders'],
      ['Barbell Rear Delt Raise', 'Shoulders'],
      ['Barbell Seal Row', 'Back'],
      ['Hyperextension', 'Back'],
      ['Landmine Row', 'Back'],
      ['Shrug (Dumbbell)', 'Traps'],
      ['Shrug (Barbell)', 'Traps'],
      ['Shrug (Cable)', 'Traps'],
    ],
  },
  {
    name: 'Upper Body',
    exercises: [
      ['Bench Press (Machine)', 'Chest'],
      ['Bench Press (Barbell)', 'Chest'],
      ['Incline Bench Press (Machine)', 'Chest'],
      ['Incline Bench Press (Barbell)', 'Chest'],
      ['Fly (Machine)', 'Chest'],
      ['Fly (Dumbbell)', 'Chest'],
      ['Cable Standing Fly', 'Chest'],
      ['Incline Push-up', 'Chest'],
      ['Dumbbell Curl', 'Biceps'],
      ['Preacher Curl (Standing)', 'Biceps'],
      ['Preacher Curl (Sitting)', 'Biceps'],
      ['Cable Curl', 'Biceps'],
      ['Machine Curl', 'Biceps'],
      ['Lying Triceps Extension', 'Triceps'],
      ['Triceps Dip', 'Triceps'],
      ['Wrist Curl (Cable)', 'Forearms'],
      ['Wrist Curl (Barbell)', 'Forearms'],
    ],
  },
  {
    name: 'Legs & Abs',
    exercises: [
      ['Calf Raise (Machine)', 'Calves'],
      ['Calf Raise (Barbell)', 'Calves'],
      ['Barbell Rear Lunge', 'Glutes'],
      ['RDL (Dumbbell)', 'Hamstrings'],
      ['RDL (Resistance Band)', 'Hamstrings'],
      ['Machine Seated Leg Curl', 'Hamstrings'],
      ['Leg Press', 'Legs'],
    ],
  },
];

// The generic starters from 002 are replaced by the real list. Only untouched ones
// (no notes, no video, never logged) are archived.
const STARTERS = [
  'Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raise', 'Triceps Pushdown',
  'Pull-up', 'Barbell Row', 'Lat Pulldown', 'Dumbbell Curl', 'Back Squat', 'Romanian Deadlift',
  'Leg Press', 'Hip Thrust', 'Plank',
];

export async function up(db: SQLiteDatabase) {
  const keep = new Set(ROUTINES.flatMap((r) => r.exercises.map(([n]) => n)));
  for (const name of STARTERS.filter((n) => !keep.has(n))) {
    await db.runAsync(
      `UPDATE exercise SET archived = 1
       WHERE name = ? AND notes IS NULL AND video_type IS NULL
         AND id NOT IN (SELECT exercise_id FROM set_log)
         AND id NOT IN (SELECT exercise_id FROM routine_exercise)`,
      name,
    );
  }

  for (const routine of ROUTINES) {
    const r = await db.runAsync('INSERT INTO routine (name) VALUES (?)', routine.name);
    let order = 0;
    for (const [name, muscle] of routine.exercises) {
      // Reuse an existing active exercise with the same name if there is one.
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM exercise WHERE name = ? AND archived = 0',
        name,
      );
      const exerciseId =
        existing?.id ??
        (await db.runAsync('INSERT INTO exercise (name, muscle_group) VALUES (?, ?)', name, muscle))
          .lastInsertRowId;
      await db.runAsync(
        'INSERT INTO routine_exercise (routine_id, exercise_id, sort_order) VALUES (?, ?, ?)',
        r.lastInsertRowId,
        exerciseId,
        order++,
      );
    }
  }
}
