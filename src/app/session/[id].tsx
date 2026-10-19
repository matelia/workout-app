import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, T } from '@/components/ui';
import { getSetting, setSetting } from '@/db/repos/settings';
import {
  addSet,
  deleteSet,
  discardSession,
  finishSession,
  getSession,
  lastTimeSummary,
  listSessionExercises,
  setDone,
  updateSet,
  type SessionExercise,
  type SetRow as SetRowData,
} from '@/db/repos/sessions';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useRestTimer } from '@/hooks/useRestTimer';
import { formatDate, formatDuration } from '@/lib/dates';
import { radius, space, useColors } from '@/theme';

const DEFAULT_REST = 90;

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const rest = useRestTimer();

  const { data: session } = useDbQuery((d) => getSession(d, sessionId), id);
  const { data: loaded, reload } = useDbQuery((d) => listSessionExercises(d, sessionId), id);
  const { data: restSetting } = useDbQuery((d) => getSetting(d, 'rest_seconds'));
  const restSeconds = Number(restSetting) || DEFAULT_REST;

  // Local copy so taps feel instant; every change is also written to the DB.
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [source, setSource] = useState(loaded);
  if (loaded !== source) {
    setSource(loaded);
    setExercises(loaded ?? []);
  }

  const finished = !!session?.end_time;

  function patchSet(setId: number, patch: Partial<SetRowData>) {
    setExercises((prev) =>
      prev.map((ex) => ({ ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) })),
    );
  }

  async function toggleDone(s: SetRowData, reps: number | null, weight: number | null) {
    const done = !s.done;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    patchSet(s.id, { done: done ? 1 : 0, reps, weight_lb: weight });
    await updateSet(db, s.id, reps, weight);
    await setDone(db, s.id, done);
    if (done && !finished) rest.start(restSeconds);
  }

  function adjustRest(delta: number) {
    rest.adjust(delta);
    // Remember the new default so the next rest starts there.
    setSetting(db, 'rest_seconds', String(Math.max(15, restSeconds + delta)));
  }

  function finish() {
    const doneCount = exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
    if (doneCount === 0) {
      Alert.alert('No sets checked off', 'Discard this workout?', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discard },
      ]);
      return;
    }
    Alert.alert('Finish workout?', `${doneCount} sets logged. Unchecked sets are dropped.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          rest.skip();
          await finishSession(db, sessionId);
          router.back();
        },
      },
    ]);
  }

  async function discard() {
    rest.skip();
    await discardSession(db, sessionId);
    router.back();
  }

  if (session === undefined) return null;
  if (session === null) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: space.lg }}>
        <Stack.Screen options={{ title: 'Workout' }} />
        <T>This workout no longer exists.</T>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: session.routine_name ?? 'Workout',
          headerLeft: () => (
            <Pressable hitSlop={12} onPress={() => router.back()}>
              <Text style={{ color: c.accent, fontSize: 17 }}>{finished ? 'Done' : 'Close'}</Text>
            </Pressable>
          ),
          headerRight: finished
            ? undefined
            : () => (
                <Pressable hitSlop={12} onPress={finish}>
                  <Text style={{ color: c.accent, fontSize: 17, fontWeight: '600' }}>Finish</Text>
                </Pressable>
              ),
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {finished ? (
          <T variant="muted">{formatDate(session.date, { weekday: 'long', month: 'long', day: 'numeric' })} · editing a finished workout</T>
        ) : (
          <Elapsed start={session.start_time} />
        )}

        {exercises.map((ex) => (
          <Card key={ex.exercise_id}>
            <T variant="heading">{ex.name}</T>
            <LastTime exerciseId={ex.exercise_id} sessionId={sessionId} />
            <View style={styles.headRow}>
              <T variant="label" style={styles.colSet}>Set</T>
              <T variant="label" style={styles.colNum}>lb</T>
              <T variant="label" style={styles.colNum}>Reps</T>
              <View style={styles.colCheck} />
            </View>
            {ex.sets.map((s, i) => (
              <SetRow
                key={s.id}
                set={s}
                index={i + 1}
                onCommit={(reps, weight) => {
                  patchSet(s.id, { reps, weight_lb: weight });
                  updateSet(db, s.id, reps, weight);
                }}
                onToggle={(reps, weight) => toggleDone(s, reps, weight)}
                onDelete={async () => {
                  await deleteSet(db, s.id);
                  reload();
                }}
              />
            ))}
            <Pressable
              onPress={async () => {
                await addSet(db, sessionId, ex.exercise_id);
                reload();
              }}
              style={styles.addSet}>
              <Text style={{ color: c.accent, fontWeight: '600' }}>+ Add set</Text>
            </Pressable>
          </Card>
        ))}

        <Button
          title="Add exercise"
          variant="secondary"
          onPress={() => router.push(`/session/add?sessionId=${sessionId}`)}
        />
        {!finished ? (
          <Button
            title="Discard workout"
            variant="danger"
            onPress={() =>
              Alert.alert('Discard workout?', 'All sets from this workout are deleted.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: discard },
              ])
            }
          />
        ) : null}
      </ScrollView>

      {rest.active ? (
        <View style={[styles.restBar, { backgroundColor: c.card, borderColor: c.border, paddingBottom: space.md + insets.bottom }]}>
          <Pressable hitSlop={8} onPress={() => adjustRest(-15)} style={[styles.restBtn, { backgroundColor: c.bg }]}>
            <Text style={{ color: c.text, fontWeight: '600' }}>−15</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T variant="label">Rest</T>
            <Text style={[styles.restTime, { color: c.text }]}>{formatDuration(rest.remaining)}</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => adjustRest(15)} style={[styles.restBtn, { backgroundColor: c.bg }]}>
            <Text style={{ color: c.text, fontWeight: '600' }}>+15</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={rest.skip} style={[styles.restBtn, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.accentText, fontWeight: '600' }}>Skip</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Elapsed({ start }: { start: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = (now - new Date(start).getTime()) / 1000;
  return <T variant="muted">Elapsed {formatDuration(seconds)}</T>;
}

function LastTime({ exerciseId, sessionId }: { exerciseId: number; sessionId: number }) {
  const { data } = useDbQuery((d) => lastTimeSummary(d, exerciseId, sessionId), `${exerciseId}-${sessionId}`);
  if (!data) return <T variant="muted">First time — enter your weight.</T>;
  const sets = data.sets.map((s) => `${s.weight_lb ?? 'BW'}×${s.reps ?? '–'}`).join(', ');
  return (
    <T variant="muted">
      Last ({formatDate(data.date, { month: 'short', day: 'numeric' })}): {sets}
    </T>
  );
}

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

function SetRow({
  set,
  index,
  onCommit,
  onToggle,
  onDelete,
}: {
  set: SetRowData;
  index: number;
  onCommit: (reps: number | null, weight: number | null) => void;
  onToggle: (reps: number | null, weight: number | null) => void;
  onDelete: () => void;
}) {
  const c = useColors();
  const [weight, setWeight] = useState(set.weight_lb?.toString() ?? '');
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const done = !!set.done;
  const repsVal = () => {
    const r = num(reps);
    return r === null ? null : Math.round(r);
  };

  const inputStyle = [
    styles.input,
    { color: c.text, backgroundColor: done ? 'transparent' : c.bg, borderColor: c.border },
  ];

  return (
    <View style={[styles.setRow, done && { opacity: 0.75 }]}>
      <Pressable
        style={styles.colSet}
        onLongPress={() =>
          Alert.alert(`Delete set ${index}?`, undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ])
        }>
        <Text style={{ color: c.textMuted, fontWeight: '600', fontSize: 16 }}>{index}</Text>
      </Pressable>
      <TextInput
        style={[inputStyle, styles.colNum]}
        value={weight}
        onChangeText={setWeight}
        onEndEditing={() => onCommit(repsVal(), num(weight))}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={c.textMuted}
        selectTextOnFocus
      />
      <TextInput
        style={[inputStyle, styles.colNum]}
        value={reps}
        onChangeText={setReps}
        onEndEditing={() => onCommit(repsVal(), num(weight))}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={c.textMuted}
        selectTextOnFocus
      />
      <Pressable
        hitSlop={8}
        accessibilityLabel={done ? `Undo set ${index}` : `Complete set ${index}`}
        onPress={() => onToggle(repsVal(), num(weight))}
        style={[styles.check, styles.colCheck, { backgroundColor: done ? c.success : c.bg, borderColor: done ? c.success : c.border }]}>
        <SymbolView name="checkmark" tintColor={done ? '#fff' : c.textMuted} size={18} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  colSet: { width: 32, alignItems: 'center' },
  colNum: { flex: 1, textAlign: 'center' },
  colCheck: { width: 48 },
  input: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  check: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSet: { paddingVertical: space.sm, alignItems: 'center' },
  restBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  restBtn: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm },
  restTime: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
