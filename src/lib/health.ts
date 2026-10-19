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
