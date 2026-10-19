import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Button, T } from '@/components/ui';
import { useMindLock } from '@/lib/mindLock';
import { space, useColors } from '@/theme';

export default function MindLayout() {
  const { unlocked, unlock } = useMindLock();
  const c = useColors();

  // Prompt for Face ID as soon as the tab is opened.
  useFocusEffect(
    useCallback(() => {
      if (!unlocked) unlock();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unlocked]),
  );

  if (!unlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg }}>
        <T variant="title">Mind is locked</T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          Check-ins, journal, therapy notes and care items stay on this phone and are never sent anywhere.
        </T>
        <Button title="Unlock with Face ID" onPress={unlock} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: 'Mind', headerLargeTitle: true }} />
      <Stack.Screen name="checkin" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="journal/index" options={{ title: 'Journal' }} />
      <Stack.Screen name="journal/[id]" options={{ title: 'Entry' }} />
      <Stack.Screen name="therapy/index" options={{ title: 'Therapy' }} />
      <Stack.Screen name="therapy/[id]" options={{ title: 'Session' }} />
      <Stack.Screen name="therapy/prep" options={{ title: 'Before next session' }} />
      <Stack.Screen name="care/index" options={{ title: 'Care items' }} />
      <Stack.Screen name="care/[id]" options={{ presentation: 'modal', title: 'Care item' }} />
      <Stack.Screen name="export" options={{ title: 'Export for therapist' }} />
    </Stack>
  );
}
