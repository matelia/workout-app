import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { DateField } from '@/components/pickers';
import { Button, Chip, ChipRow, Field, Screen, T } from '@/components/ui';
import { deleteBodyPhoto, getBodyPhoto, POSE_LABELS, POSES, updateBodyPhoto, type BodyPhoto, type Pose } from '@/db/repos/bodyPhotos';
import { deleteMedia, mediaUri } from '@/lib/media';
import { useMindLock } from '@/lib/mindLock';
import { radius } from '@/theme';

export default function BodyPhotoDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { unlocked } = useMindLock();
  const [photo, setPhoto] = useState<BodyPhoto | null>(null);
  const [date, setDate] = useState('');
  const [pose, setPose] = useState<Pose>('front');
  const [note, setNote] = useState('');

  useEffect(() => {
    getBodyPhoto(db, Number(id)).then((p) => {
      if (!p) return;
      setPhoto(p);
      setDate(p.date);
      setPose(p.pose);
      setNote(p.note ?? '');
    });
  }, [db, id]);

  if (!unlocked) {
    return (
      <Screen>
        <T variant="muted">Locked. Go back and unlock with Face ID.</T>
      </Screen>
    );
  }
  if (!photo) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: POSE_LABELS[pose] }} />
      <Image source={{ uri: mediaUri(photo.photo_path) }} style={styles.img} contentFit="contain" />
      <DateField label="Date" value={date} onChange={setDate} />
      <ChipRow>
        {POSES.map((p) => (
          <Chip key={p} label={POSE_LABELS[p]} selected={pose === p} onPress={() => setPose(p)} />
        ))}
      </ChipRow>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
      <Button
        title="Save"
        onPress={async () => {
          await updateBodyPhoto(db, photo.id, date, pose, note.trim() || null);
          router.back();
        }}
      />
      <Button
        title="Delete photo"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete this photo?', 'It is removed from the app for good.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteBodyPhoto(db, photo.id);
                deleteMedia(photo.photo_path);
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: '#000' },
});
