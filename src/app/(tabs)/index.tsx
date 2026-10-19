import { useRouter } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CareSlotRow } from '@/components/CareSlotRow';
import { MacroSummary } from '@/components/MacroSummary';
import { NutritionCheck } from '@/components/NutritionCheck';
import { Button, Card, Screen, T } from '@/components/ui';
import { careSlotsFor } from '@/db/repos/care';
import { dayTotals, getTargets, mealForNow } from '@/db/repos/food';
import { scheduleForDate } from '@/db/repos/schedule';
import { getActiveSession, sessionsOnDate, startSession } from '@/db/repos/sessions';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, formatTime, todayStr } from '@/lib/dates';
import { href } from '@/lib/href';
import { radius, space, useColors } from '@/theme';

async function loadToday(db: SQLiteDatabase, date: string) {
  const weekday = new Date().getDay();
  const [scheduled, sessions, active, totals, targets, care] = await Promise.all([
    scheduleForDate(db, date, weekday),
    sessionsOnDate(db, date),
    getActiveSession(db),
    dayTotals(db, date),
    getTargets(db),
    careSlotsFor(db, date, weekday),
  ]);
  return { scheduled, sessions, active, totals, targets, care };
}

export default function Today() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const date = todayStr();
  const { data, reload } = useDbQuery((d) => loadToday(d, date), date);

  async function start(routineId: number) {
    if (data?.active) {
      router.push(`/session/${data.active.id}`);
      return;
    }
    const id = await startSession(db, routineId);
    router.push(`/session/${id}`);
  }

  const quick = (icon: SFSymbol, label: string, to: never) => (
    <Pressable onPress={() => router.push(to)} style={[styles.quick, { backgroundColor: c.card, borderColor: c.border }]}>
      <SymbolView name={icon} tintColor={c.accent} size={22} />
      <Text style={{ color: c.text, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  if (!data) return <Screen>{null}</Screen>;
  const dueCare = data.care.filter((s) => s.status === 'due');
  const meal = mealForNow();

  return (
    <Screen>
      <T variant="muted">{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</T>

      {data.active ? (
        <Card style={{ borderColor: c.accent }}>
          <T variant="label">Workout in progress</T>
          <T variant="heading">{data.active.routine_name ?? 'Workout'}</T>
          <Button title="Resume" onPress={() => router.push(`/session/${data.active!.id}`)} />
        </Card>
      ) : null}

      <Card>
        <T variant="label">Today&apos;s workout</T>
        {data.scheduled.length === 0 ? (
          <>
            <T variant="heading">Rest day</T>
            <Button title="Start a workout anyway" variant="secondary" onPress={() => router.push('/workouts')} />
          </>
        ) : null}
        {data.scheduled.map((s) => {
          const done = data.sessions.some((x) => x.routine_id === s.routine_id && x.end_time);
          return (
            <View key={s.id} style={styles.workoutRow}>
              <View style={{ flex: 1 }}>
                <T variant="heading">{s.routine_name}</T>
                {s.reminder_time ? <T variant="muted">{formatTime(s.reminder_time)}</T> : null}
              </View>
              {done ? (
                <T style={{ color: c.success, fontWeight: '600' }}>Done ✓</T>
              ) : (
                <Button
                  title={data.active?.routine_id === s.routine_id ? 'Resume' : 'Start'}
                  onPress={() =>
                    data.active && data.active.routine_id !== s.routine_id
                      ? Alert.alert('Another workout is in progress', 'Finish it first.', [
                          { text: 'OK', style: 'cancel' },
                          { text: 'Open it', onPress: () => router.push(`/session/${data.active!.id}`) },
                        ])
                      : start(s.routine_id)
                  }
                />
              )}
            </View>
          );
        })}
      </Card>

      <Pressable onPress={() => router.push('/food')}>
        <Card>
          <T variant="label">Nutrition</T>
          <MacroSummary totals={data.totals} targets={data.targets} compact />
          {!data.targets.kcal ? <T style={{ color: c.accent }}>Set targets in Food → Targets & settings</T> : null}
          <NutritionCheck totals={data.totals} targets={data.targets} compact />
        </Card>
      </Pressable>

      <View style={styles.quickRow}>
        {quick('camera', 'Snapshot', href('/food/snapshot', { date, meal }))}
        {quick('barcode.viewfinder', 'Barcode', href('/food/scan', { target: 'log', date, meal }))}
        {quick('takeoutbag.and.cup.and.straw', 'Saved meal', href('/food/meals', { date, meal }))}
        {quick('face.smiling', 'Check-in', '/mind/checkin' as never)}
      </View>

      {data.care.length ? (
        <Card>
          <T variant="label">Care still due today</T>
          {dueCare.length === 0 ? <T variant="muted">All done for today.</T> : null}
          {dueCare.map((s) => (
            // Neutral labels only: Today isn't behind Face ID.
            <CareSlotRow key={`${s.item.id}-${s.time}`} slot={s} showName={false} onChange={reload} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  quickRow: { flexDirection: 'row', gap: space.sm },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
