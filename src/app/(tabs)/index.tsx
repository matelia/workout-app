import { useRouter } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/ActivityCard';
import { BigAction } from '@/components/BigAction';
import { CareSlotRow } from '@/components/CareSlotRow';
import { HabitsCard } from '@/components/HabitsCard';
import { NutritionCheck } from '@/components/NutritionCheck';
import { Rings } from '@/components/Rings';
import { Button, Card, Screen, T } from '@/components/ui';
import { careSlotsFor } from '@/db/repos/care';
import { dayTotals, getTargets, mealForNow } from '@/db/repos/food';
import { getGoals } from '@/db/repos/coach';
import { weeklyStreak } from '@/db/repos/records';
import { listSchedule, scheduleForDate } from '@/db/repos/schedule';
import { getActiveSession, sessionsOnDate, startSession } from '@/db/repos/sessions';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, formatTime, todayStr } from '@/lib/dates';
import { href } from '@/lib/href';
import { fonts, radius, space, useColors } from '@/theme';

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
  const goals = await getGoals(db);
  const weeklyTarget = goals?.daysPerWeek ?? (await listSchedule(db)).filter((s) => s.weekday !== null).length;
  const streak = await weeklyStreak(db, weeklyTarget || 1);
  return { scheduled, sessions, active, totals, targets, care, streak };
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

  function openWorkout(routineId: number) {
    if (data?.active && data.active.routine_id !== routineId) {
      const activeId = data.active.id;
      Alert.alert('Another workout is in progress', 'Finish it first.', [
        { text: 'OK', style: 'cancel' },
        { text: 'Open it', onPress: () => router.push(`/session/${activeId}`) },
      ]);
    } else start(routineId);
  }

  const quick = (icon: SFSymbol, label: string, to: never) => (
    <Pressable
      onPress={() => router.push(to)}
      style={({ pressed }) => [styles.quick, { backgroundColor: pressed ? c.cardPressed : c.card }]}>
      <SymbolView name={icon} tintColor={c.accent} size={24} />
      <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  if (!data) return <Screen>{null}</Screen>;
  const { totals, targets, active } = data;
  const dueCare = data.care.filter((s) => s.status === 'due');
  const meal = mealForNow();
  const kcalLeft = targets.kcal ? Math.round(targets.kcal - totals.kcal) : null;
  const activeIsScheduled = !!active && data.scheduled.some((s) => s.routine_id === active.routine_id);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.today, { color: c.text }]}>TODAY</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.date, { color: c.textMuted }]}>
            {formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
          </Text>
          <Pressable
            accessibilityLabel="Coach"
            onPress={() => router.push('/coach')}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? c.cardPressed : c.card }]}>
            <SymbolView name="bubble.left.and.text.bubble.right.fill" tintColor={c.accent} size={18} />
          </Pressable>
          <Pressable
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? c.cardPressed : c.card }]}>
            <SymbolView name="gearshape.fill" tintColor={c.accent} size={20} />
          </Pressable>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: c.card }]}>
          <Text style={[styles.statNum, { color: data.streak.weeks ? c.accent : c.textMuted }]}>🔥 {data.streak.weeks}</Text>
          <T variant="muted">week streak</T>
        </View>
        <View style={[styles.stat, { backgroundColor: c.card }]}>
          <Text style={[styles.statNum, { color: c.text }]}>
            {data.streak.thisWeek}/{data.streak.target}
          </Text>
          <T variant="muted">workouts this week</T>
        </View>
      </View>

      {active && !activeIsScheduled ? (
        <BigAction
          kicker="In progress"
          title={`Resume ${active.routine_name ?? 'workout'}`}
          onPress={() => router.push(`/session/${active.id}`)}
        />
      ) : null}

      {data.scheduled.length === 0 && !active ? (
        <Card>
          <T variant="label">Rest day</T>
          <T variant="muted">Nothing scheduled. Recovery counts too.</T>
          <Button title="Start a workout anyway" variant="secondary" onPress={() => router.push('/workouts')} />
        </Card>
      ) : null}

      {data.scheduled.map((s) => {
        const done = data.sessions.some((x) => x.routine_id === s.routine_id && x.end_time);
        const when = s.reminder_time ? `${formatTime(s.reminder_time)} · ` : '';
        if (done)
          return (
            <Card key={s.id} style={styles.doneCard}>
              <SymbolView name="checkmark.circle.fill" tintColor={c.accent} size={30} />
              <View style={{ flex: 1 }}>
                <T variant="label">{when}Done</T>
                <T variant="heading">{s.routine_name}</T>
              </View>
            </Card>
          );
        return (
          <BigAction
            key={s.id}
            kicker={`${when}${s.routine_name}`}
            title={active?.routine_id === s.routine_id ? 'Resume workout' : 'Start workout'}
            onPress={() => openWorkout(s.routine_id)}
          />
        );
      })}

      <Pressable onPress={() => router.push('/food')}>
        <Card style={styles.nutrition}>
          <Rings
            rings={[
              { value: targets.kcal ? totals.kcal / targets.kcal : 0, color: c.accent },
              { value: targets.protein_g ? totals.protein / targets.protein_g : 0, color: c.accent2 },
            ]}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="number">{Math.round(totals.kcal).toLocaleString()}</T>
            <T variant="muted">{targets.kcal ? `of ${targets.kcal.toLocaleString()} kcal` : 'kcal today'}</T>
            <Text style={[styles.protein, { color: c.accent2 }]}>{Math.round(totals.protein)} G</Text>
            <T variant="muted">{targets.protein_g ? `of ${targets.protein_g} g protein` : 'protein'}</T>
          </View>
        </Card>
      </Pressable>

      <View style={{ gap: space.xs, marginTop: -space.sm }}>
        {kcalLeft === null ? (
          <Pressable onPress={() => router.push('/settings')}>
            <T style={{ color: c.accent }}>Set your daily targets →</T>
          </Pressable>
        ) : (
          <T variant="muted">
            {kcalLeft >= 0 ? `${kcalLeft.toLocaleString()} kcal left today` : `${(-kcalLeft).toLocaleString()} kcal over`}
          </T>
        )}
        <NutritionCheck totals={totals} targets={targets} compact />
      </View>

      <ActivityCard />
      <HabitsCard />

      <View style={styles.quickRow}>
        {quick('camera', 'Snapshot', href('/food/snapshot', { date, meal }))}
        {quick('barcode.viewfinder', 'Barcode', href('/food/scan', { target: 'log', date, meal }))}
        {quick('fork.knife', 'Saved', href('/food/meals', { date, meal }))}
        {quick('face.smiling', 'Check-in', '/mind/checkin' as never)}
      </View>

      {data.care.length ? (
        <Card>
          <T variant="label">Care</T>
          {dueCare.length === 0 ? <T variant="muted">All done for today.</T> : null}
          {dueCare.map((s) => (
            // Neutral labels only: Today is not behind Face ID.
            <CareSlotRow key={`${s.item.id}-${s.time}`} slot={s} showName={false} onChange={reload} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm },
  today: { fontFamily: fonts.display, fontSize: 52, lineHeight: 54 },
  date: { fontFamily: fonts.displayBold, fontSize: 18, letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: 4 },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  statNum: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nutrition: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  protein: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, marginTop: space.sm },
  quickRow: { flexDirection: 'row', gap: space.sm },
  quick: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: space.md, borderRadius: radius.md },
});
