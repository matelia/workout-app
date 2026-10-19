import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/theme';

export default function FoodLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Food', headerLargeTitle: true }} />
      <Stack.Screen name="add" options={{ title: 'Add food' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan barcode', presentation: 'fullScreenModal' }} />
      <Stack.Screen name="amount" options={{ title: 'Amount' }} />
      <Stack.Screen name="manual" options={{ title: 'New food' }} />
      <Stack.Screen name="meals/index" options={{ title: 'Saved meals' }} />
      <Stack.Screen name="meals/[id]" options={{ title: 'Saved meal' }} />
      <Stack.Screen name="log-meal" options={{ title: 'Log saved meal' }} />
      <Stack.Screen name="groceries/index" options={{ title: 'My groceries' }} />
      <Stack.Screen name="groceries/[id]" options={{ title: 'Grocery product' }} />
      <Stack.Screen name="restaurants/index" options={{ title: 'Restaurants' }} />
      <Stack.Screen name="restaurants/menu" options={{ title: 'Menu' }} />
      <Stack.Screen name="restaurants/search" options={{ title: 'Search USDA' }} />
      <Stack.Screen name="restaurants/item" options={{ title: 'Item' }} />
      <Stack.Screen name="settings" options={{ title: 'Food settings' }} />
      <Stack.Screen name="snapshot" options={{ title: 'Snapshot' }} />
      <Stack.Screen name="queue" options={{ title: 'Snapshot queue' }} />
      <Stack.Screen name="review/[id]" options={{ title: 'Review' }} />
    </Stack>
  );
}
