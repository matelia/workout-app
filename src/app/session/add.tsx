import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { ExercisePicker } from '@/components/ExercisePicker';
import { addExerciseToSession, listSessionExercises } from '@/db/repos/sessions';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function AddToSession() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const db = useSQLiteContext();
  const { data: current } = useDbQuery((d) => listSessionExercises(d, Number(sessionId)), sessionId);
  const marked = useMemo(() => new Set(current?.map((x) => x.exercise_id)), [current]);

  return (
    <>
      <Stack.Screen options={{ title: 'Add exercises', presentation: 'modal' }} />
      <ExercisePicker
        marked={marked}
        markedLabel="in this workout"
        onConfirm={async (ids) => {
          for (const id of ids) await addExerciseToSession(db, Number(sessionId), id);
        }}
      />
    </>
  );
}
