import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/theme';

export default function WorkoutsLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Workouts', headerLargeTitle: true }} />
      <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
      <Stack.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Stack.Screen name="add-exercises" options={{ presentation: 'modal', title: 'Add exercises' }} />
    </Stack>
  );
}
