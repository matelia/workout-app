import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import type { Slug } from 'react-native-body-highlighter';

import { MuscleMap } from '@/components/MuscleMap';
import { Button, Card, Empty, Screen, T } from '@/components/ui';
import { VideoPlayer } from '@/components/VideoPlayer';
import { getExercise } from '@/db/repos/exercises';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: exercise } = useDbQuery((db) => getExercise(db, Number(id)), id);

  if (exercise === undefined) return null;
  if (exercise === null)
    return (
      <Screen>
        <Empty title="Exercise not found" />
      </Screen>
    );

  const edit = () => router.push(`/library/edit?id=${exercise.id}`);
  const hasVideo = !!(exercise.video_type && exercise.video_url_or_path);
  const primary: Slug[] = exercise.muscles_primary ? JSON.parse(exercise.muscles_primary) : [];
  const secondary: Slug[] = exercise.muscles_secondary ? JSON.parse(exercise.muscles_secondary) : [];

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: exercise.name,
        }}
      />
      <T variant="title">{exercise.name}</T>
      <T variant="muted">{[exercise.muscle_group, exercise.equipment].filter(Boolean).join(' · ')}</T>

      {hasVideo ? <VideoPlayer type={exercise.video_type!} value={exercise.video_url_or_path!} /> : null}

      {primary.length || secondary.length ? (
        <Card>
          <T variant="label">Muscles worked</T>
          <MuscleMap primary={primary} secondary={secondary} />
        </Card>
      ) : null}

      <Card>
        <T variant="label">How to do it</T>
        {exercise.notes ? <T>{exercise.notes}</T> : <T variant="muted">No instructions yet.</T>}
      </Card>

      {!hasVideo || !exercise.notes ? (
        <T variant="muted">
          Add {[!hasVideo && 'a video (YouTube, Instagram or a file)', !exercise.notes && 'how-to steps'].filter(Boolean).join(' and ')} with
          Edit below.
        </T>
      ) : null}

      <Button title="Edit exercise" onPress={edit} />
    </Screen>
  );
}
