import type { SQLiteDatabase } from 'expo-sqlite';

import { nowLocalIso } from '@/lib/dates';

export type CareCategory = 'meds' | 'skin' | 'hair' | 'other';

export type CareItem = {
  id: number;
  name: string;
  category: CareCategory;
  schedule_times: string; // JSON ["08:00", …]
  weekdays: string | null; // JSON [0..6] or null = every day
  notification_label: string;
  active: number;
};

export type CareItemInput = {
  name: string;
  category: CareCategory;
  times: string[];
  weekdays: number[] | null;
  notification_label: string;
};

export const CATEGORY_LABELS: Record<CareCategory, string> = {
  meds: 'Meds',
  skin: 'Skincare',
  hair: 'Hair care',
  other: 'Other',
};

export function listCareItems(db: SQLiteDatabase) {
  return db.getAllAsync<CareItem>('SELECT * FROM care_item WHERE active = 1 ORDER BY category, name');
}

export function getCareItem(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<CareItem>('SELECT * FROM care_item WHERE id = ?', id);
}

export async function saveCareItem(db: SQLiteDatabase, id: number | null, i: CareItemInput) {
  const times = JSON.stringify([...i.times].sort());
  const weekdays = i.weekdays && i.weekdays.length < 7 ? JSON.stringify([...i.weekdays].sort()) : null;
  if (id) {
    await db.runAsync(
      'UPDATE care_item SET name = ?, category = ?, schedule_times = ?, weekdays = ?, notification_label = ? WHERE id = ?',
      i.name, i.category, times, weekdays, i.notification_label, id,
    );
    return id;
  }
  return (
    await db.runAsync(
      'INSERT INTO care_item (name, category, schedule_times, weekdays, notification_label) VALUES (?, ?, ?, ?, ?)',
      i.name, i.category, times, weekdays, i.notification_label,
    )
  ).lastInsertRowId;
}

/** Deactivated rather than deleted so history stays readable. */
export async function deactivateCareItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('UPDATE care_item SET active = 0 WHERE id = ?', id);
}

export type CareSlot = {
  item: CareItem;
  time: string;
  scheduled: string; // 'YYYY-MM-DDTHH:MM:00'
  status: 'due' | 'done' | 'skipped';
};

/** Every scheduled slot for a date, with whether it was done/skipped. */
export async function careSlotsFor(db: SQLiteDatabase, date: string, weekday: number): Promise<CareSlot[]> {
  const items = await listCareItems(db);
  const logs = await db.getAllAsync<{ care_item_id: number; scheduled_time: string; skipped: number }>(
    'SELECT care_item_id, scheduled_time, skipped FROM care_log WHERE substr(scheduled_time, 1, 10) = ?',
    date,
  );
  const slots: CareSlot[] = [];
  for (const item of items) {
    const days: number[] | null = item.weekdays ? JSON.parse(item.weekdays) : null;
    if (days && !days.includes(weekday)) continue;
    for (const time of JSON.parse(item.schedule_times) as string[]) {
      const scheduled = `${date}T${time}:00`;
      const log = logs.find((l) => l.care_item_id === item.id && l.scheduled_time === scheduled);
      slots.push({ item, time, scheduled, status: !log ? 'due' : log.skipped ? 'skipped' : 'done' });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time));
}

export async function logCare(db: SQLiteDatabase, itemId: number, scheduled: string, skipped: boolean) {
  await db.runAsync('DELETE FROM care_log WHERE care_item_id = ? AND scheduled_time = ?', itemId, scheduled);
  await db.runAsync(
    'INSERT INTO care_log (care_item_id, scheduled_time, done_time, skipped) VALUES (?, ?, ?, ?)',
    itemId,
    scheduled,
    skipped ? null : nowLocalIso(),
    skipped ? 1 : 0,
  );
}

export async function undoCare(db: SQLiteDatabase, itemId: number, scheduled: string) {
  await db.runAsync('DELETE FROM care_log WHERE care_item_id = ? AND scheduled_time = ?', itemId, scheduled);
}

export function careHistory(db: SQLiteDatabase, itemId: number, limit = 60) {
  return db.getAllAsync<{ scheduled_time: string; done_time: string | null; skipped: number }>(
    'SELECT scheduled_time, done_time, skipped FROM care_log WHERE care_item_id = ? ORDER BY scheduled_time DESC LIMIT ?',
    itemId,
    limit,
  );
}
