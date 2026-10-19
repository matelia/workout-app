import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Stepper } from '@/components/Stepper';
import { TimeField } from '@/components/pickers';
import { Button, Card, Chip, ChipRow, Screen, T } from '@/components/ui';
import {
  addBodyPhoto,
  getPhotoReminder,
  groupByDate,
  listBodyPhotos,
  POSE_LABELS,
  POSES,
  savePhotoReminder,
  type PhotoReminder,
  type Pose,
} from '@/db/repos/bodyPhotos';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, formatTime, todayStr } from '@/lib/dates';
import { mediaUri, storeMedia } from '@/lib/media';
import { useMindLock } from '@/lib/mindLock';
import { syncPhotoReminder } from '@/lib/notifications';
import { radius, space, useColors } from '@/theme';

export default function BodyPhotos() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const { unlocked, unlock } = useMindLock();
  const { data: photos, reload } = useDbQuery(listBodyPhotos);
  const [reminder, setReminder] = useState<PhotoReminder | null>(null);
  const [compare, setCompare] = useState<{ a: string | null; b: string | null; pose: Pose }>({ a: null, b: null, pose: 'front' });

  useEffect(() => {
    getPhotoReminder(db).then(setReminder);
  }, [db]);

  const sessions = groupByDate(photos ?? []);
  const dates = sessions.map((s) => s.date);
  const a = compare.a ?? dates.at(-1) ?? null; // oldest
  const b = compare.b ?? dates[0] ?? null; // newest

  async function updateReminder(r: PhotoReminder) {
    setReminder(r);
    await savePhotoReminder(db, r);
    await syncPhotoReminder(db);
  }

  function add(pose: Pose) {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: `${POSE_LABELS[pose]} photo`, options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
      async (i) => {
        if (i === 2) return;
        if (i === 0 && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
        const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
        const res = i === 0 ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
        if (res.canceled) return;
        await addBodyPhoto(db, todayStr(), pose, storeMedia(res.assets[0].uri, 'body-photos', 'jpg'));
        reload();
      },
    );
  }

  if (!unlocked) {
    return (
      <Screen>
        <T variant="heading">Body photos are private</T>
        <T variant="muted">They stay on this phone, behind Face ID, and are never exported.</T>
        <Button title="Unlock with Face ID" onPress={unlock} />
      </Screen>
    );
  }

  const photoFor = (date: string | null) => sessions.find((s) => s.date === date)?.items.find((p) => p.pose === compare.pose);

  return (
    <Screen>
      <Card>
        <T variant="label">Add today&apos;s photos</T>
        <T variant="muted">Same spot, same lighting, relaxed (not flexed). Compare against last month, not the mirror.</T>
        <View style={styles.poseBtns}>
          {(['front', 'side', 'back'] as Pose[]).map((p) => (
            <Button key={p} title={POSE_LABELS[p]} variant="secondary" style={{ flex: 1 }} onPress={() => add(p)} />
          ))}
        </View>
      </Card>

      {dates.length >= 2 ? (
        <Card>
          <T variant="label">Compare</T>
          <ChipRow>
            {POSES.map((p) => (
              <Chip key={p} label={POSE_LABELS[p]} selected={compare.pose === p} onPress={() => setCompare({ ...compare, pose: p })} />
            ))}
          </ChipRow>
          <View style={styles.compareRow}>
            {[
              ['a', a],
              ['b', b],
            ].map(([key, date]) => {
              const p = photoFor(date);
              return (
                <View key={key} style={{ flex: 1, gap: space.xs }}>
                  <Pressable
                    onPress={() =>
                      ActionSheetIOS.showActionSheetWithOptions(
                        { options: [...dates.map((d) => formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' })), 'Cancel'], cancelButtonIndex: dates.length },
                        (i) => i < dates.length && setCompare({ ...compare, [key as 'a' | 'b']: dates[i] }),
                      )
                    }>
                    <T style={{ color: c.accent, textAlign: 'center' }}>{date ? formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} ▾</T>
                  </Pressable>
                  {p ? (
                    <Image source={{ uri: mediaUri(p.photo_path) }} style={styles.compareImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.compareImg, styles.missing, { backgroundColor: c.bg }]}>
                      <T variant="muted">No {POSE_LABELS[compare.pose].toLowerCase()} photo</T>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {sessions.length === 0 ? <T variant="muted">No photos yet.</T> : null}
      {sessions.map((s) => (
        <View key={s.date} style={{ gap: space.sm }}>
          <T variant="label">{formatDate(s.date, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {s.items.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/progress/photo/${p.id}`)}>
                <Image source={{ uri: mediaUri(p.photo_path) }} style={styles.thumb} contentFit="cover" />
                <T variant="muted" style={{ textAlign: 'center' }}>
                  {POSE_LABELS[p.pose]}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ))}

      {reminder ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T variant="heading" style={{ flex: 1 }}>
              Monthly reminder
            </T>
            <Switch value={reminder.enabled} onValueChange={(v) => updateReminder({ ...reminder, enabled: v })} />
          </View>
          {reminder.enabled ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T>Day of month</T>
                <Stepper value={reminder.day} min={1} max={28} onChange={(d) => updateReminder({ ...reminder, day: d })} />
              </View>
              <TimeField value={reminder.time} onChange={(t) => updateReminder({ ...reminder, time: t })} />
              <T variant="muted">
                On the {ordinal(reminder.day)} at {formatTime(reminder.time)}. The notification just says “Progress photo”.
              </T>
            </>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function ordinal(n: number) {
  if (n >= 11 && n <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

const styles = StyleSheet.create({
  poseBtns: { flexDirection: 'row', gap: space.sm },
  compareRow: { flexDirection: 'row', gap: space.sm },
  compareImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md },
  missing: { alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 96, height: 128, borderRadius: radius.sm },
});
