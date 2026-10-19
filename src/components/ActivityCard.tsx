import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Rings } from '@/components/Rings';
import { Card, T } from '@/components/ui';
import { getSetting } from '@/db/repos/settings';
import { healthAvailable, lastNightSleepHours, todayActivity, type Activity } from '@/lib/health';
import { fonts, space, useColors } from '@/theme';

/** Steps + active calories rings from Apple Health. Hidden where Health isn't available (Expo Go). */
export function ActivityCard() {
  const db = useSQLiteContext();
  const c = useColors();
  const [data, setData] = useState<{ a: Activity; steps: number; move: number; sleep: number | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!healthAvailable) return;
      (async () => {
        const a = await todayActivity();
        if (!a) return;
        const steps = Number(await getSetting(db, 'steps_goal')) || 10000;
        const move = Number(await getSetting(db, 'move_goal')) || 500;
        setData({ a, steps, move, sleep: await lastNightSleepHours() });
      })();
    }, [db]),
  );

  if (!healthAvailable || !data) return null;
  const { a, steps, move, sleep } = data;
  return (
    <Card style={styles.row}>
      <Rings
        size={104}
        rings={[
          { value: a.activeKcal / move, color: c.accent2 },
          { value: a.steps / steps, color: c.accent3 },
        ]}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="label">Activity</T>
        <Text style={[styles.big, { color: c.accent2 }]}>
          {a.activeKcal} <Text style={[styles.unit, { color: c.textMuted }]}>/ {move} KCAL</Text>
        </Text>
        <Text style={[styles.big, { color: c.accent3 }]}>
          {a.steps.toLocaleString()} <Text style={[styles.unit, { color: c.textMuted }]}>/ {steps.toLocaleString()} STEPS</Text>
        </Text>
        <T variant="muted">
          {a.exerciseMin} min exercise{sleep !== null ? ` · ${sleep} h sleep` : ''}
        </T>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  big: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  unit: { fontFamily: fonts.displayBold, fontSize: 14 },
});
