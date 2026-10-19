import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/barlow-condensed';
import * as Notifications from 'expo-notifications';
import { Stack, ThemeProvider, useRootNavigationState, useRouter } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrate } from '@/db/migrate';
import { isHealthSyncEnabled, syncHealth } from '@/lib/health';
import { MindLockProvider } from '@/lib/mindLock';
import { FeaturesProvider } from '@/lib/features';
import { syncAllReminders } from '@/lib/notifications';
import { getSetting } from '@/db/repos/settings';
import { processCoachQueue } from '@/lib/coach';
import { processQueue, startQueueRetries } from '@/lib/snapshotClient';
import { useNavTheme, stackScreenOptions } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const navTheme = useNavTheme();
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SQLiteProvider databaseName="app.db" onInit={migrate}>
      <FeaturesProvider>
      <MindLockProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <Startup />
          <Stack screenOptions={stackScreenOptions}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="session/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="coach" options={{ title: 'Coach' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
            <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="session/add" options={{ presentation: 'modal', title: 'Add exercises' }} />
          </Stack>
        </ThemeProvider>
      </MindLockProvider>
      </FeaturesProvider>
    </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

/** Rebuilds reminders from the DB on launch and routes notification taps. */
function Startup() {
  const db = useSQLiteContext();
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const navReady = !!useRootNavigationState()?.key;

  // First launch (or "Later" last time): show the walkthrough once the navigator is ready.
  useEffect(() => {
    if (!navReady) return;
    getSetting(db, 'onboarding')
      .then((v) => {
        if (v !== 'done') router.push('/welcome');
      })
      .catch(() => {});
  }, [db, navReady, router]);

  useEffect(() => {
    syncAllReminders(db).catch((e) => console.warn('Reminder sync failed', e));
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
    processCoachQueue(db).catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        processQueue(db).catch(() => {});
        processCoachQueue(db).catch(() => {});
      }
    });
    const stopRetries = startQueueRetries(db, 120_000, () => processCoachQueue(db));
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
