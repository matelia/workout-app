import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { METRIC_FIELDS } from '@/db/repos/bodyMetrics';
import { listLog } from '@/db/repos/food';
import { todayStr } from '@/lib/dates';

// CSV export of everything EXCEPT Mind data (check-ins, journal, therapy, care) and body photos.
// Mind has its own "Export for therapist".

export type Dataset = 'workouts' | 'food' | 'body' | 'exercises';

export const DATASET_LABELS: Record<Dataset, string> = {
  workouts: 'Workout sets',
  food: 'Food log',
  body: 'Body metrics (weight, body fat, …)',
  exercises: 'Exercise library & routines',
};

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

async function build(db: SQLiteDatabase, ds: Dataset): Promise<string> {
  if (ds === 'workouts') {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT s.date, s.start_time, s.end_time, r.name AS routine, e.name AS exercise, e.muscle_group,
              l.set_number, l.reps, l.weight_lb
       FROM set_log l JOIN workout_session s ON s.id = l.session_id JOIN exercise e ON e.id = l.exercise_id
       LEFT JOIN routine r ON r.id = s.routine_id
       WHERE l.done = 1 ORDER BY s.date, s.id, l.id`,
    );
    const h = ['date', 'start_time', 'end_time', 'routine', 'exercise', 'muscle_group', 'set_number', 'reps', 'weight_lb'];
    return toCsv(h, rows.map((r) => h.map((k) => r[k])));
  }
  if (ds === 'food') {
    const dates = await db.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM food_log ORDER BY date');
    const out: unknown[][] = [];
    for (const { date } of dates) {
      for (const e of await listLog(db, date)) {
        out.push([
          e.date, e.meal, e.name, e.grams ?? '', e.servings ?? '',
          e.macros.kcal.toFixed(0), e.macros.protein.toFixed(1), e.macros.carbs.toFixed(1), e.macros.fat.toFixed(1),
          e.macros.fiber.toFixed(1), e.macros.sugar.toFixed(1), e.macros.satFat.toFixed(1), e.macros.sodium.toFixed(0),
        ]);
      }
    }
    return toCsv(['date', 'meal', 'food', 'grams', 'servings', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sat_fat_g', 'sodium_mg'], out);
  }
  if (ds === 'body') {
    const h = ['measured_at', 'source', ...METRIC_FIELDS];
    const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT ${h.join(', ')} FROM body_metric ORDER BY measured_at`);
    return toCsv(h, rows.map((r) => h.map((k) => r[k])));
  }
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT e.name AS exercise, e.muscle_group, e.notes, e.video_type, e.video_url_or_path,
            r.name AS routine, re.sort_order, re.target_sets, re.target_reps
     FROM exercise e LEFT JOIN routine_exercise re ON re.exercise_id = e.id
     LEFT JOIN routine r ON r.id = re.routine_id AND r.archived = 0
     WHERE e.archived = 0 ORDER BY e.name, r.name`,
  );
  const h = ['exercise', 'muscle_group', 'notes', 'video_type', 'video_url_or_path', 'routine', 'sort_order', 'target_sets', 'target_reps'];
  return toCsv(h, rows.map((r) => h.map((k) => r[k])));
}

export async function shareCsv(db: SQLiteDatabase, ds: Dataset) {
  const file = new File(Paths.cache, `${ds}-${todayStr()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(await build(db, ds));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: DATASET_LABELS[ds] });
}
