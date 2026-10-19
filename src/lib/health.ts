import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { upsertMetric, type MetricField, type MetricInput } from '@/db/repos/bodyMetrics';
import { getSetting, setSetting } from '@/db/repos/settings';

// Apple Health (HealthKit) read-only sync for body metrics. Renpho Health writes weight,
// body fat, lean body mass and BMI to Apple Health when its Health sync is turned on.
//
// HealthKit is native code that Expo Go doesn't include, so this only works in the
// installed app (see INSTALL.md). In Expo Go the module is never loaded.

export const healthAvailable =
  Platform.OS === 'ios' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type HK = typeof import('@kingstinct/react-native-healthkit');
let hk: HK | null | undefined;

function loadHealthKit(): HK | null {
  if (hk !== undefined) return hk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hk = healthAvailable ? (require('@kingstinct/react-native-healthkit') as HK) : null;
  } catch {
    hk = null;
  }
  return hk;
}

const TYPES = [
  { id: 'HKQuantityTypeIdentifierBodyMass', unit: 'lb', field: 'weight_lb', scale: 1 },
  { id: 'HKQuantityTypeIdentifierBodyFatPercentage', unit: '%', field: 'body_fat_pct', scale: 100 }, // HealthKit stores 0–1
  { id: 'HKQuantityTypeIdentifierLeanBodyMass', unit: 'lb', field: 'lean_mass_lb', scale: 1 },
  { id: 'HKQuantityTypeIdentifierBodyMassIndex', unit: 'count', field: 'bmi', scale: 1 },
] as const satisfies readonly { id: string; unit: string; field: MetricField; scale: number }[];

const pad = (n: number) => String(n).padStart(2, '0');
const localMinute = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export async function isHealthSyncEnabled(db: SQLiteDatabase) {
  return (await getSetting(db, 'health_sync')) === 'on';
}

/** Asks for read access, then imports samples since the last sync (first time: 2 years). */
export async function syncHealth(db: SQLiteDatabase): Promise<{ ok: boolean; message: string; imported: number }> {
  const HealthKit = loadHealthKit();
  if (!HealthKit) return { ok: false, imported: 0, message: 'Apple Health works in the installed app, not in Expo Go.' };
  try {
    if (!HealthKit.isHealthDataAvailable()) return { ok: false, imported: 0, message: 'Apple Health is not available on this device.' };
    await HealthKit.requestAuthorization({ toRead: TYPES.map((t) => t.id) });

    const last = await getSetting(db, 'health_last_sync');
    // Re-read a day of overlap so late-arriving samples aren't missed; upsert makes it idempotent.
    const since = last ? new Date(new Date(last).getTime() - 86_400_000) : new Date(Date.now() - 2 * 365 * 86_400_000);
    const byMinute = new Map<string, MetricInput>();

    for (const t of TYPES) {
      const samples = await HealthKit.queryQuantitySamples(t.id, {
        limit: -1,
        unit: t.unit,
        ascending: true,
        filter: { date: { startDate: since } },
      });
      for (const s of samples as readonly { quantity: number; startDate: Date | string }[]) {
        const key = localMinute(new Date(s.startDate));
        const row = byMinute.get(key) ?? { measured_at: key, source: 'health' };
        row[t.field] = Math.round(s.quantity * t.scale * 10) / 10;
        byMinute.set(key, row);
      }
    }
    for (const row of byMinute.values()) await upsertMetric(db, row);
    await setSetting(db, 'health_last_sync', new Date().toISOString());
    await setSetting(db, 'health_sync', 'on');
    return { ok: true, imported: byMinute.size, message: `Synced ${byMinute.size} measurement${byMinute.size === 1 ? '' : 's'} from Apple Health.` };
  } catch (e) {
    return { ok: false, imported: 0, message: `Apple Health sync failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export type Activity = { steps: number; activeKcal: number; exerciseMin: number };

/** Today's steps, active calories and exercise minutes (iPhone + Watch), or null when unavailable. */
export async function todayActivity(): Promise<Activity | null> {
  const HealthKit = loadHealthKit();
  if (!HealthKit) return null;
  try {
    const ACTIVITY = [
      'HKQuantityTypeIdentifierStepCount',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      'HKQuantityTypeIdentifierAppleExerciseTime',
    ] as const;
    await HealthKit.requestAuthorization({ toRead: ACTIVITY });
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const filter = { date: { startDate: start } };
    const [steps, energy, exercise] = await Promise.all([
      HealthKit.queryStatisticsForQuantity(ACTIVITY[0], ['cumulativeSum'], { filter, unit: 'count' }),
      HealthKit.queryStatisticsForQuantity(ACTIVITY[1], ['cumulativeSum'], { filter, unit: 'kcal' }),
      HealthKit.queryStatisticsForQuantity(ACTIVITY[2], ['cumulativeSum'], { filter, unit: 'min' }),
    ]);
    const total = (r: { sumQuantity?: { quantity: number } }) => Math.round(r.sumQuantity?.quantity ?? 0);
    return { steps: total(steps), activeKcal: total(energy), exerciseMin: total(exercise) };
  } catch {
    return null;
  }
}

/**
 * Hours asleep last night (6 pm yesterday → now), from Apple Watch / iPhone sleep data.
 * Overlapping samples from several sources are merged so time isn't double-counted.
 */
export async function lastNightSleepHours(): Promise<number | null> {
  const HealthKit = loadHealthKit();
  if (!HealthKit) return null;
  try {
    const id = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
    await HealthKit.requestAuthorization({ toRead: [id] });
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
    const samples = await HealthKit.queryCategorySamples(id, { limit: -1, filter: { date: { startDate: start } } });
    // 1 asleep (unspecified), 3 core, 4 deep, 5 REM; 0 in bed and 2 awake don't count.
    const spans = samples
      .filter((s) => [1, 3, 4, 5].includes(Number(s.value)))
      .map((s) => [new Date(s.startDate).getTime(), new Date(s.endDate).getTime()] as const)
      .sort((a, b) => a[0] - b[0]);
    let total = 0;
    let cur: [number, number] | null = null;
    for (const [a, b] of spans) {
      if (cur && a <= cur[1]) cur[1] = Math.max(cur[1], b);
      else {
        if (cur) total += cur[1] - cur[0];
        cur = [a, b];
      }
    }
    if (cur) total += cur[1] - cur[0];
    return total ? Math.round((total / 3_600_000) * 4) / 4 : null;
  } catch {
    return null;
  }
}
