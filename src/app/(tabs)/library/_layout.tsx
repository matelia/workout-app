import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/theme';

export default function LibraryLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Library', headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal', title: 'Exercise' }} />
    </Stack>
  );
}
