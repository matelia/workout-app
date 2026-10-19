import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/repos/settings';

export type Pose = 'front' | 'side' | 'back' | 'other';
export const POSES: Pose[] = ['front', 'side', 'back', 'other'];
export const POSE_LABELS: Record<Pose, string> = { front: 'Front', side: 'Side', back: 'Back', other: 'Other' };

export type BodyPhoto = { id: number; date: string; pose: Pose; photo_path: string; note: string | null };

export function listBodyPhotos(db: SQLiteDatabase) {
  return db.getAllAsync<BodyPhoto>('SELECT id, date, pose, photo_path, note FROM progress_photo ORDER BY date DESC, id');
}

export function getBodyPhoto(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<BodyPhoto>('SELECT id, date, pose, photo_path, note FROM progress_photo WHERE id = ?', id);
}

export async function addBodyPhoto(db: SQLiteDatabase, date: string, pose: Pose, path: string) {
  await db.runAsync('INSERT INTO progress_photo (date, pose, photo_path) VALUES (?, ?, ?)', date, pose, path);
}

export async function updateBodyPhoto(db: SQLiteDatabase, id: number, date: string, pose: Pose, note: string | null) {
  await db.runAsync('UPDATE progress_photo SET date = ?, pose = ?, note = ? WHERE id = ?', date, pose, note, id);
}

export async function deleteBodyPhoto(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM progress_photo WHERE id = ?', id);
}

/** Groups photos into "sessions" by date, newest first. */
export function groupByDate(photos: BodyPhoto[]) {
  const map = new Map<string, BodyPhoto[]>();
  for (const p of photos) {
    if (!map.has(p.date)) map.set(p.date, []);
    map.get(p.date)!.push(p);
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }));
}

// Monthly reminder. Default matches the "Progress photo — 4-week check-in" calendar event (18th, 9:00).
export type PhotoReminder = { enabled: boolean; day: number; time: string };
const DEFAULT_REMINDER: PhotoReminder = { enabled: true, day: 18, time: '09:00' };

export async function getPhotoReminder(db: SQLiteDatabase): Promise<PhotoReminder> {
  const v = await getSetting(db, 'photo_reminder');
  return v ? { ...DEFAULT_REMINDER, ...JSON.parse(v) } : DEFAULT_REMINDER;
}

export async function savePhotoReminder(db: SQLiteDatabase, r: PhotoReminder) {
  await setSetting(db, 'photo_reminder', JSON.stringify(r));
}
