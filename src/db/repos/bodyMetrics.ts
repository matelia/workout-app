import type { SQLiteDatabase } from 'expo-sqlite';

export type MetricSource = 'health' | 'renpho' | 'manual';

export const METRIC_FIELDS = [
  'weight_lb',
  'body_fat_pct',
  'lean_mass_lb',
  'muscle_mass_lb',
  'skeletal_muscle_pct',
  'bmi',
  'visceral_fat',
  'body_water_pct',
  'bone_mass_lb',
  'bmr_kcal',
  'metabolic_age',
] as const;
export type MetricField = (typeof METRIC_FIELDS)[number];

export const METRIC_LABELS: Record<MetricField, { label: string; unit: string }> = {
  weight_lb: { label: 'Weight', unit: 'lb' },
  body_fat_pct: { label: 'Body fat', unit: '%' },
  lean_mass_lb: { label: 'Lean mass', unit: 'lb' },
  muscle_mass_lb: { label: 'Muscle mass', unit: 'lb' },
  skeletal_muscle_pct: { label: 'Skeletal muscle', unit: '%' },
  bmi: { label: 'BMI', unit: '' },
  visceral_fat: { label: 'Visceral fat', unit: '' },
  body_water_pct: { label: 'Body water', unit: '%' },
  bone_mass_lb: { label: 'Bone mass', unit: 'lb' },
  bmr_kcal: { label: 'BMR', unit: 'kcal' },
  metabolic_age: { label: 'Metabolic age', unit: 'yrs' },
};

export type BodyMetric = { id: number; measured_at: string; date: string; source: MetricSource } & Record<MetricField, number | null>;
export type MetricInput = { measured_at: string; source: MetricSource } & Partial<Record<MetricField, number | null>>;

/**
 * One row per measurement minute. Apple Health and a Renpho CSV usually describe the same
 * weigh-in, so a second import fills in missing fields instead of creating a duplicate.
 */
export async function upsertMetric(db: SQLiteDatabase, m: MetricInput) {
  const measuredAt = m.measured_at.slice(0, 16);
  const values = METRIC_FIELDS.map((f) => m[f] ?? null);
  if (values.every((v) => v === null)) return;
  await db.runAsync(
    `INSERT INTO body_metric (measured_at, date, source, ${METRIC_FIELDS.join(', ')})
     VALUES (?, ?, ?, ${METRIC_FIELDS.map(() => '?').join(', ')})
     ON CONFLICT(measured_at) DO UPDATE SET
       ${METRIC_FIELDS.map((f) => `${f} = COALESCE(excluded.${f}, ${f})`).join(', ')}`,
    measuredAt,
    measuredAt.slice(0, 10),
    m.source,
    ...values,
  );
}

export function listMetrics(db: SQLiteDatabase, limit = 365) {
  return db.getAllAsync<BodyMetric>(
    'SELECT * FROM (SELECT * FROM body_metric ORDER BY measured_at DESC LIMIT ?) ORDER BY measured_at',
    limit,
  );
}

/** Most recent non-null value for each metric. */
export async function latestMetrics(db: SQLiteDatabase) {
  const out: Partial<Record<MetricField, { value: number; date: string }>> = {};
  for (const f of METRIC_FIELDS) {
    const r = await db.getFirstAsync<{ v: number; date: string }>(
      `SELECT ${f} AS v, date FROM body_metric WHERE ${f} IS NOT NULL ORDER BY measured_at DESC LIMIT 1`,
    );
    if (r) out[f] = { value: r.v, date: r.date };
  }
  return out;
}

export async function deleteMetric(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM body_metric WHERE id = ?', id);
}
