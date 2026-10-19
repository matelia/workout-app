import * as Notifications from 'expo-notifications';
import { Stack, ThemeProvider, useRouter } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrate } from '@/db/migrate';
import { isHealthSyncEnabled, syncHealth } from '@/lib/health';
import { MindLockProvider } from '@/lib/mindLock';
import { syncCareReminders, syncPhotoReminder, syncWorkoutReminders } from '@/lib/notifications';
import { processQueue, startQueueRetries } from '@/lib/snapshotClient';
import { useNavTheme } from '@/theme';

export default function RootLayout() {
  const navTheme = useNavTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SQLiteProvider databaseName="app.db" onInit={migrate}>
      <MindLockProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="auto" />
          <Startup />
          <Stack screenOptions={{ headerShadowVisible: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="session/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="session/add" options={{ presentation: 'modal', title: 'Add exercises' }} />
          </Stack>
        </ThemeProvider>
      </MindLockProvider>
    </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

/** Rebuilds reminders from the DB on launch and routes notification taps. */
function Startup() {
  const db = useSQLiteContext();
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    syncWorkoutReminders(db)
      .then(() => syncCareReminders(db))
      .then(() => syncPhotoReminder(db))
      .catch((e) => console.warn('Reminder sync failed', e));
  }, [db]);

  // Pull new Apple Health weigh-ins at launch (installed app only, once connected).
  useEffect(() => {
    isHealthSyncEnabled(db)
      .then(async (on) => {
        if (on) await syncHealth(db);
      })
      .catch(() => {});
  }, [db]);

  // Retry queued snapshots at launch and whenever the app comes back to the foreground.
  useEffect(() => {
    processQueue(db).catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') processQueue(db).catch(() => {});
    });
    const stopRetries = startQueueRetries(db);
    return () => {
      sub.remove();
      stopRetries();
    };
  }, [db]);

  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string') router.navigate(url as never);
  }, [response, router]);

  return null;
}
