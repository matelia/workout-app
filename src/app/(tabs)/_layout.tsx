import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useColors } from '@/theme';

// JS tabs rather than native tabs: the native iOS tab bar collapses a 6th tab into "More".
function icon(name: SFSymbol) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={name} tintColor={color} size={size} />;
  };
}

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
        headerShown: false,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sun.max') }} />
      <Tabs.Screen name="food" options={{ title: 'Food', headerShown: false, tabBarIcon: icon('fork.knife') }} />
      <Tabs.Screen
        name="workouts"
        options={{ title: 'Workouts', headerShown: false, tabBarIcon: icon('dumbbell') }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: 'Library', headerShown: false, tabBarIcon: icon('books.vertical') }}
      />
      <Tabs.Screen
        name="mind"
        options={{ title: 'Mind', headerShown: false, tabBarIcon: icon('brain.head.profile') }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', headerShown: false, tabBarIcon: icon('chart.line.uptrend.xyaxis') }}
      />
    </Tabs>
  );
}
