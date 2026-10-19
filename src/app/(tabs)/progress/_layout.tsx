import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/theme';

export default function ProgressLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Progress', headerLargeTitle: true }} />
      <Stack.Screen name="photos" options={{ title: 'Body photos' }} />
      <Stack.Screen name="photo/[id]" options={{ title: 'Photo' }} />
      <Stack.Screen name="body" options={{ title: 'Body metrics' }} />
      <Stack.Screen name="pick-exercise" options={{ title: 'Choose exercise', presentation: 'modal' }} />
    </Stack>
  );
}
