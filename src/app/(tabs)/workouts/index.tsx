import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, View } from 'react-native';

import { Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import { createRoutine, listRoutines } from '@/db/repos/routines';
import { listSchedule } from '@/db/repos/schedule';
import { getActiveSession, listRecentSessions, startSession } from '@/db/repos/sessions';
import { Fab } from '@/components/Fab';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, formatTime, WEEKDAYS } from '@/lib/dates';
import { space, useColors } from '@/theme';

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

  const weekly = schedule?.filter((s) => s.weekday !== null) ?? [];

  return (
    <Screen overlay={<Fab label="New routine" onPress={newRoutine} />}>

      {active ? (
        <Card style={{ borderColor: c.accent }}>
          <T variant="label">In progress</T>
          <T variant="heading">{active.routine_name ?? 'Workout'}</T>
          <Button title="Resume" onPress={() => router.push(`/session/${active.id}`)} />
        </Card>
      ) : null}

      <Row onPress={() => router.push('/workouts/schedule')}>
        <SymbolView name="calendar" tintColor={c.accent} size={20} />
        <View style={{ flex: 1 }}>
          <T>Weekly schedule</T>
          <T variant="muted" numberOfLines={2}>
            {weekly.length
              ? weekly
                  .map((s) => `${WEEKDAYS[s.weekday!]} ${s.routine_name}${s.reminder_time ? ` ${formatTime(s.reminder_time)}` : ''}`)
                  .join(' · ')
              : 'Nothing scheduled'}
          </T>
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
