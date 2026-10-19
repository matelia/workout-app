import type { SQLiteDatabase } from 'expo-sqlite';

// A starter library so the app isn't empty on first launch. Edit or archive freely.
const SEED: [name: string, muscle: string][] = [
  ['Bench Press', 'Chest'],
  ['Incline Dumbbell Press', 'Chest'],
  ['Overhead Press', 'Shoulders'],
  ['Lateral Raise', 'Shoulders'],
  ['Triceps Pushdown', 'Triceps'],
  ['Pull-up', 'Back'],
  ['Barbell Row', 'Back'],
  ['Lat Pulldown', 'Back'],
  ['Dumbbell Curl', 'Biceps'],
  ['Back Squat', 'Legs'],
  ['Romanian Deadlift', 'Legs'],
  ['Leg Press', 'Legs'],
  ['Hip Thrust', 'Glutes'],
  ['Plank', 'Core'],
];

export async function up(db: SQLiteDatabase) {
  for (const [name, muscle] of SEED) {
    await db.runAsync('INSERT INTO exercise (name, muscle_group) VALUES (?, ?)', name, muscle);
  }
}
