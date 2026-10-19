import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BigAction } from '@/components/BigAction';
import { Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import { createRoutine, listRoutines } from '@/db/repos/routines';
import { listSchedule, scheduleForDate } from '@/db/repos/schedule';
import { getActiveSession, listRecentSessions, sessionsOnDate, startSession } from '@/db/repos/sessions';
import { Fab } from '@/components/Fab';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, formatTime, todayStr, WEEKDAYS } from '@/lib/dates';
import { fonts, radius, space, useColors } from '@/theme';

// Monday-first week strip.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function WorkoutsIndex() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const { data: routines } = useDbQuery(listRoutines);
  const { data: schedule } = useDbQuery(listSchedule);
  const { data: active } = useDbQuery(getActiveSession);
  const { data: recent } = useDbQuery((d) => listRecentSessions(d, 10));

  function newRoutine() {
    Alert.prompt('New routine', 'e.g. Push, Pull, Legs', async (name) => {
      if (!name?.trim()) return;
      const id = await createRoutine(db, name.trim());
      router.push(`/workouts/routine/${id}`);
    });
  }

  async function start(routineId: number | null) {
    if (active) {
      Alert.alert('A workout is already in progress', 'Finish or discard it first.', [
        { text: 'OK', style: 'cancel' },
        { text: 'Open it', onPress: () => router.push(`/session/${active.id}`) },
      ]);
      return;
    }
    const id = await startSession(db, routineId);
    router.push(`/session/${id}`);
  }

  const weekday = new Date().getDay();
  const todayDate = todayStr();
  const { data: todayScheduled } = useDbQuery((d) => scheduleForDate(d, todayDate, weekday), todayDate);
  const { data: todaySessions } = useDbQuery((d) => sessionsOnDate(d, todayDate), todayDate);
  const todays = todayScheduled ?? [];
  const doneToday = new Set((todaySessions ?? []).filter((x) => x.end_time).map((x) => x.routine_id));

  return (
    <Screen overlay={<Fab label="New routine" onPress={newRoutine} />}>

      {active ? (
        <BigAction kicker="In progress" title={`Resume ${active.routine_name ?? 'workout'}`} onPress={() => router.push(`/session/${active.id}`)} />
      ) : null}

      {!active && todays.length === 0 ? (
        <Card>
          <T variant="label">Today</T>
          <T variant="heading">Rest day</T>
          <T variant="muted">Nothing scheduled. Pick a routine below if you feel like training.</T>
        </Card>
      ) : null}
      {!active
        ? todays.map((s) =>
            doneToday.has(s.routine_id) ? (
              <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <SymbolView name="checkmark.circle.fill" tintColor={c.accent} size={30} />
                <View>
                  <T variant="label">Today · done</T>
                  <T variant="heading">{s.routine_name}</T>
                </View>
              </Card>
            ) : (
              <BigAction
                key={s.id}
                kicker={`Today${s.reminder_time ? ` · ${formatTime(s.reminder_time)}` : ''}`}
                title={s.routine_name}
                onPress={() => start(s.routine_id)}
              />
            ),
          )
        : null}

      <Pressable onPress={() => router.push('/workouts/schedule')} style={[styles.week, { backgroundColor: c.card }]}>
        {ORDER.map((wd) => {
          const day = (schedule ?? []).filter((x) => x.weekday === wd);
          const isToday = wd === weekday;
          return (
            <View key={wd} style={[styles.day, isToday && { backgroundColor: c.accent }]}>
              <Text style={[styles.dayName, { color: isToday ? c.accentText : c.textMuted }]}>{WEEKDAYS[wd].toUpperCase()}</Text>
              <Text style={[styles.dayRoutine, { color: isToday ? c.accentText : day.length ? c.text : c.textMuted }]} numberOfLines={2}>
                {day.length ? day.map((x) => x.routine_name.split(/[s&]+/)[0]).join('/') : 'Rest'}
              </Text>
            </View>
          );
        })}
      </Pressable>
      <T variant="muted" style={{ marginTop: -space.sm }}>
        Tap the week to change your schedule and reminders.
      </T>

      <Row onPress={() => router.push('/coach')}>
        <SymbolView name="bubble.left.and.text.bubble.right.fill" tintColor={c.accent} size={20} />
        <View style={{ flex: 1 }}>
          <T>Coach</T>
          <T variant="muted">Build a plan, ask why, check your progress.</T>
        </View>
        <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
      </Row>

      <T variant="label">Routines</T>
      {routines?.length === 0 ? <Empty title="No routines yet" hint="Tap + to create one." /> : null}
      {routines?.map((r) => (
        <Row key={r.id} onPress={() => router.push(`/workouts/routine/${r.id}`)}>
          <View style={{ flex: 1 }}>
            <T>{r.name}</T>
            <T variant="muted">
              {r.exercise_count} {r.exercise_count === 1 ? 'exercise' : 'exercises'} · tap to edit
            </T>
          </View>
          <Pressable
            hitSlop={8}
            accessibilityLabel={`Start ${r.name}`}
            onPress={() => start(r.id)}
            style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 999, backgroundColor: c.accent }}>
            <T style={{ color: c.accentText, fontWeight: '600' }}>Start</T>
          </Pressable>
        </Row>
      ))}
      <Button title="Start empty workout" variant="secondary" onPress={() => start(null)} />

      {recent?.length ? <T variant="label">History</T> : null}
      {recent?.map((s) => (
        <Row key={s.id} onPress={() => router.push(`/session/${s.id}`)}>
          <View style={{ flex: 1 }}>
            <T>{s.routine_name ?? 'Workout'}</T>
            <T variant="muted">
              {formatDate(s.date)} · {s.sets_done} sets
            </T>
          </View>
          <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
        </Row>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', borderRadius: radius.md, padding: 6, gap: 4 },
  day: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm, gap: 2, minHeight: 58 },
  dayName: { fontFamily: fonts.displayBold, fontSize: 14, letterSpacing: 0.5 },
  dayRoutine: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
