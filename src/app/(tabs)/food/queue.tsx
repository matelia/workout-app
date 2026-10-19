import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Empty, Row, Screen, T } from '@/components/ui';
import { deleteJob, listOpenJobs, reviewRoute } from '@/db/repos/snapshots';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate } from '@/lib/dates';
import { photoUri, processQueue } from '@/lib/snapshotClient';
import { radius, useColors } from '@/theme';

const KIND_LABEL = { label: 'Label', meal: 'Meal', menu: 'Restaurant menu', recipe: 'Recipe' };
const STATUS_LABEL = { queued: 'Waiting for laptop', processing: 'Processing…', needs_review: 'Ready to review', done: 'Done' };

export default function SnapshotQueue() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const { data: jobs, reload } = useDbQuery(listOpenJobs);
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    await processQueue(db);
    await reload();
    setBusy(false);
  }

  return (
    <Screen>
      <Button title={busy ? 'Processing…' : 'Process queued photos now'} onPress={retry} disabled={busy} />
      {busy ? <ActivityIndicator /> : null}
      {jobs?.length === 0 ? <Empty title="Queue is empty" /> : null}
      {jobs?.map((j) => (
        <Row key={j.id} onPress={() => j.status === 'needs_review' && router.push(reviewRoute(j) as never)}>
          <Image source={{ uri: photoUri(j.photo_path) }} style={[styles.thumb, { backgroundColor: c.bg }]} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <T>
              {KIND_LABEL[j.kind]}
              {j.date ? ` · ${formatDate(j.date)}` : ''}
            </T>
            <T variant="muted" style={j.status === 'needs_review' ? { color: c.accent } : undefined}>
              {STATUS_LABEL[j.status]}
            </T>
            {j.error ? (
              <T variant="muted" style={{ color: c.danger }} numberOfLines={2}>
                {j.error}
              </T>
            ) : null}
          </View>
          <Pressable
            hitSlop={8}
            onPress={() =>
              Alert.alert('Delete this snapshot?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteJob(db, j.id);
                    reload();
                  },
                },
              ])
            }>
            <Text style={{ color: c.danger }}>Delete</Text>
          </Pressable>
        </Row>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
});
