import type { SQLiteDatabase } from 'expo-sqlite';

// Optional features you can switch off in Settings. Everything is on by default; turning a
// feature off hides it and stops its reminders, but never deletes its data.

export const FEATURES = [
  { key: 'food', title: 'Food tab', detail: 'Food log, groceries, restaurants, cookbook and the calorie rings on Today.', group: 'Tabs' },
  { key: 'mind', title: 'Mind tab', detail: 'Check-ins, journal, therapy notes and care items, with their reminders.', group: 'Tabs' },
  { key: 'progress', title: 'Progress tab', detail: 'Charts, body metrics and body photos, with the monthly photo reminder.', group: 'Tabs' },
  { key: 'coach', title: 'Coach', detail: 'Chat and plan builder on your laptop (Ollama).', group: 'Coach' },
  { key: 'weeklyReview', title: 'Weekly review', detail: 'A Sunday summary of your week from the coach, with a notification.', group: 'Coach' },
  { key: 'overload', title: 'Progressive overload', detail: 'Add weight automatically when you hit every target last time.', group: 'Workouts' },
  { key: 'prs', title: 'PRs and streaks', detail: 'PR banners while you lift and the weekly streak on Today.', group: 'Workouts' },
  { key: 'habits', title: 'Water and creatine', detail: 'The water and creatine card on Today.', group: 'Today' },
  { key: 'activity', title: 'Activity and sleep', detail: 'Steps, move and sleep from Apple Health on Today and in check-ins.', group: 'Today' },
] as const;

export type FeatureKey = (typeof FEATURES)[number]['key'];
export type Flags = Record<FeatureKey, boolean>;

export const ALL_ON = Object.fromEntries(FEATURES.map((f) => [f.key, true])) as Flags;

export async function loadFeatures(db: SQLiteDatabase): Promise<Flags> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM setting WHERE key LIKE 'feature_%'");
  const flags = { ...ALL_ON };
  for (const r of rows) {
    const k = r.key.slice('feature_'.length) as FeatureKey;
    if (k in flags) flags[k] = r.value !== '0';
  }
  return flags;
}

/** For code outside React (reminders, background queues, session setup). */
export async function isFeatureOn(db: SQLiteDatabase, key: FeatureKey) {
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM setting WHERE key = ?', `feature_${key}`))?.value !== '0';
}

export async function saveFeature(db: SQLiteDatabase, key: FeatureKey, on: boolean) {
  await db.runAsync(
    'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    `feature_${key}`,
    on ? '1' : '0',
  );
}
