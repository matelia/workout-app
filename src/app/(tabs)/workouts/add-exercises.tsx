import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { ExercisePicker } from '@/components/ExercisePicker';
import { addExercisesToRoutine, listRoutineExercises } from '@/db/repos/routines';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function AddExercises() {
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const db = useSQLiteContext();
  const { data: inRoutine } = useDbQuery((d) => listRoutineExercises(d, Number(routineId)), routineId);
  const marked = useMemo(() => new Set(inRoutine?.map((x) => x.exercise_id)), [inRoutine]);

  return (
    <ExercisePicker
      marked={marked}
      markedLabel="already in routine"
      onConfirm={(ids) => addExercisesToRoutine(db, Number(routineId), ids)}
    />
  );
}
