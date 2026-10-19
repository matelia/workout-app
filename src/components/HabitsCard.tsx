import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, T } from '@/components/ui';
import { habitStreak, habitTotal, logHabit, undoHabit } from '@/db/repos/habits';
import { getSetting } from '@/db/repos/settings';
import { todayStr } from '@/lib/dates';
import { fonts, radius, space, useColors } from '@/theme';

/** Water (fl oz toward a goal) and a daily creatine check-off, on Today. */
export function HabitsCard() {
  const db = useSQLiteContext();
  const c = useColors();
  const date = todayStr();
  const [water, setWater] = useState(0);
  const [goal, setGoal] = useState(100);
  const [creatine, setCreatine] = useState(false);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    setWater(await habitTotal(db, date, 'water'));
    setGoal(Number(await getSetting(db, 'water_goal')) || 100);
    setCreatine((await habitTotal(db, date, 'creatine')) > 0);
    setStreak(await habitStreak(db, 'creatine'));
  }, [db, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function addWater(oz: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logHabit(db, date, 'water', oz);
    load();
  }

  async function toggleCreatine() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (creatine) await undoHabit(db, date, 'creatine');
    else await logHabit(db, date, 'creatine', 1);
    load();
  }

  const pct = Math.min(1, water / goal);
  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.head}>
        <SymbolView name="drop.fill" tintColor={c.accent3} size={20} />
        <Text style={[styles.big, { color: c.text }]}>
          {Math.round(water)} <Text style={[styles.unit, { color: c.textMuted }]}>/ {goal} OZ WATER</Text>
        </Text>
        {water > 0 ? (
          <Pressable hitSlop={8} onPress={() => undoHabit(db, date, 'water').then(load)} accessibilityLabel="Undo last water">
            <SymbolView name="arrow.uturn.backward" tintColor={c.textMuted} size={16} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: c.card2 }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: c.accent3 }]} />
      </View>
      <View style={styles.row}>
        {[8, 16, 24].map((oz) => (
          <Pressable key={oz} onPress={() => addWater(oz)} style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? c.cardPressed : c.card2 }]}>
            <Text style={{ color: c.text, fontWeight: '700' }}>+{oz} oz</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={toggleCreatine} style={[styles.creatine, { backgroundColor: creatine ? c.accent : c.card2 }]}>
        <SymbolView name={creatine ? 'checkmark.circle.fill' : 'circle'} tintColor={creatine ? c.accentText : c.textMuted} size={22} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: creatine ? c.accentText : c.text, fontWeight: '700' }}>Creatine</Text>
          <T style={{ color: creatine ? c.accentText : c.textMuted, fontSize: 13 }}>
            {creatine ? 'Taken today' : 'Tap when you take it'}
            {streak > 1 ? ` · ${streak}-day streak` : ''}
          </T>
        </View>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  big: { flex: 1, fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  unit: { fontFamily: fonts.displayBold, fontSize: 14 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: -space.xs },
  fill: { height: '100%', borderRadius: 4 },
  row: { flexDirection: 'row', gap: space.sm },
  btn: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
  creatine: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.sm },
});
