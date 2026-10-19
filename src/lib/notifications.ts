import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getPhotoReminder } from '@/db/repos/bodyPhotos';

// All reminders are local notifications. They are rebuilt from the database by the sync
// functions below, so the DB is the single source of truth (no drift after edits).

const REST_ID = 'rest-timer';

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    // While the app is open the rest timer already buzzes in-app; don't also show a banner.
    const inAppTimer = n.request.identifier === REST_ID;
    return {
      shouldShowBanner: !inAppTimer,
      shouldShowList: !inAppTimer,
      shouldPlaySound: !inAppTimer,
      shouldSetBadge: false,
    };
  },
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function cancelByPrefix(prefix: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

const hm = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
};

// ── Workouts ──
export async function syncWorkoutReminders(db: SQLiteDatabase) {
  await cancelByPrefix('workout-');
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    weekday: number | null;
    date: string | null;
    reminder_time: string | null;
  }>(
    `SELECT s.id, r.name, s.weekday, s.date, s.reminder_time
     FROM scheduled_workout s JOIN routine r ON r.id = s.routine_id AND r.archived = 0
     WHERE s.reminder_time IS NOT NULL`,
  );
  if (!rows.length || !(await ensureNotificationPermission())) return;

  for (const row of rows) {
    const identifier = `workout-${row.id}`;
    const content = { title: `Workout: ${row.name}`, body: 'Tap to start.', data: { url: '/' } };
    const { hour, minute } = hm(row.reminder_time!);
    if (row.weekday !== null) {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content,
        // expo weekday: 1 = Sunday … 7 = Saturday; ours: 0 = Sunday.
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: row.weekday + 1, hour, minute },
      });
    } else if (row.date) {
      const [y, m, d] = row.date.split('-').map(Number);
      const at = new Date(y, m - 1, d, hour, minute);
      if (at.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
    await db.runAsync('UPDATE scheduled_workout SET notification_id = ? WHERE id = ?', identifier, row.id);
  }
}

// ── Care reminders (Mind) ──
// Only the user's neutral notification_label ever reaches the lock screen.
export async function syncCareReminders(db: SQLiteDatabase) {
  await cancelByPrefix('care-');
  const items = await db.getAllAsync<{
    id: number;
    schedule_times: string;
    weekdays: string | null;
    notification_label: string;
  }>('SELECT id, schedule_times, weekdays, notification_label FROM care_item WHERE active = 1');
  if (!items.length || !(await ensureNotificationPermission())) return;

  for (const item of items) {
    const times: string[] = JSON.parse(item.schedule_times);
    const weekdays: number[] | null = item.weekdays ? JSON.parse(item.weekdays) : null;
    const ids: string[] = [];
    const content = { title: item.notification_label, body: 'Tap to check off.', data: { url: '/mind' } };
    for (const time of times) {
      const { hour, minute } = hm(time);
      if (!weekdays || weekdays.length === 7) {
        const identifier = `care-${item.id}-${time}`;
        await Notifications.scheduleNotificationAsync({
          identifier,
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
        });
        ids.push(identifier);
      } else {
        for (const wd of weekdays) {
          const identifier = `care-${item.id}-${time}-${wd}`;
          await Notifications.scheduleNotificationAsync({
            identifier,
            content,
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: wd + 1, hour, minute },
          });
          ids.push(identifier);
        }
      }
    }
    await db.runAsync('UPDATE care_item SET notification_ids = ? WHERE id = ?', JSON.stringify(ids), item.id);
  }
}

// ── Monthly body-photo reminder ──
export async function syncPhotoReminder(db: SQLiteDatabase) {
  await cancelByPrefix('photo-');
  const r = await getPhotoReminder(db);
  if (!r.enabled || !(await ensureNotificationPermission())) return;
  const { hour, minute } = hm(r.time);
  await Notifications.scheduleNotificationAsync({
    identifier: 'photo-monthly',
    content: {
      title: 'Progress photo',
      body: 'Same spot, same lighting, relaxed. Front + side.',
      data: { url: '/progress/photos' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: r.day, hour, minute },
  });
}

// ── Rest timer ──

export async function scheduleRestDone(seconds: number) {
  await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => {});
  if (seconds < 1 || !(await ensureNotificationPermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: REST_ID,
    content: { title: 'Rest over', body: 'Next set.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds) },
  });
}

export async function cancelRestDone() {
  await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => {});
}
