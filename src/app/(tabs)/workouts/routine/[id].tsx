import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Stepper } from '@/components/Stepper';
import { Button, Card, Empty, Screen, T } from '@/components/ui';
import {
  archiveRoutine,
  getRoutine,
  listRoutineExercises,
  removeRoutineExercise,
  renameRoutine,
  reorderRoutine,
  updateTargets,
  type RoutineExercise,
} from '@/db/repos/routines';
import { useDbQuery } from '@/hooks/useDbQuery';
import { space, useColors } from '@/theme';

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routineId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();

  const { data: routine, reload: reloadRoutine } = useDbQuery((d) => getRoutine(d, routineId), id);
  const { data: loaded } = useDbQuery((d) => listRoutineExercises(d, routineId), id);

  // Local copy so steppers and reordering feel instant; every change is written straight to the DB.
  const [items, setItems] = useState<RoutineExercise[]>([]);
  const [source, setSource] = useState(loaded);
  if (loaded !== source) {
    setSource(loaded);
    setItems(loaded ?? []);
  }

  function setTargets(item: RoutineExercise, sets: number, reps: number) {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, target_sets: sets, target_reps: reps } : x)));
    updateTargets(db, item.id, sets, reps);
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    setItems(next);
    reorderRoutine(db, next.map((x) => x.id));
  }

  function remove(item: RoutineExercise) {
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    removeRoutineExercise(db, item.id);
  }

  function rename() {
    Alert.prompt(
      'Rename routine',
      undefined,
      async (name) => {
        if (!name?.trim()) return;
        await renameRoutine(db, routineId, name.trim());
        reloadRoutine();
      },
      'plain-text',
      routine?.name,
    );
  }

  function deleteRoutine() {
    Alert.alert('Delete routine?', 'Past workouts that used it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await archiveRoutine(db, routineId);
          router.back();
        },
      },
    ]);
  }

  if (routine === undefined) return null;
  if (routine === null)
    return (
      <Screen>
        <Empty title="Routine not found" />
      </Screen>
    );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: routine.name,
        }}
      />

      {items.length === 0 && loaded ? (
        <Empty title="No exercises yet" hint="Add some from your library." />
      ) : null}

      {items.map((item, i) => (
        <Card key={item.id} style={{ gap: space.md }}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <T variant="heading">{item.name}</T>
              {item.muscle_group ? <T variant="muted">{item.muscle_group}</T> : null}
            </View>
            <IconButton name="chevron.up" disabled={i === 0} onPress={() => move(i, -1)} />
            <IconButton name="chevron.down" disabled={i === items.length - 1} onPress={() => move(i, 1)} />
            <IconButton name="xmark" onPress={() => remove(item)} label={`Remove ${item.name}`} />
          </View>
          <View style={styles.targets}>
            <Stepper
              value={item.target_sets}
              suffix="sets"
              max={20}
              onChange={(v) => setTargets(item, v, item.target_reps)}
            />
            <Stepper
              value={item.target_reps}
              suffix="reps"
              max={100}
              onChange={(v) => setTargets(item, item.target_sets, v)}
            />
          </View>
        </Card>
      ))}

      <Button
        title="Add exercises"
        variant="secondary"
        onPress={() => router.push(`/workouts/add-exercises?routineId=${routineId}`)}
      />
      <Button title="Rename routine" variant="secondary" onPress={rename} />
      <Button title="Delete routine" variant="danger" onPress={deleteRoutine} />
    </Screen>
  );
}

function IconButton({
  name,
  onPress,
  disabled,
  label,
}: {
  name: SFSymbol;
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={label ?? name}
      style={{ padding: 6, opacity: disabled ? 0.25 : 1 }}>
      <SymbolView name={name} tintColor={c.textMuted} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  targets: { flexDirection: 'row', justifyContent: 'space-between' },
});
