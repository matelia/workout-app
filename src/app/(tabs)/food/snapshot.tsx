import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Screen, T } from '@/components/ui';
import { MEAL_LABELS, MEALS, mealForNow, type Meal } from '@/db/repos/food';
import { createJob, getJob, type SnapshotKind } from '@/db/repos/snapshots';
import { todayStr } from '@/lib/dates';
import { isServerOnline, processJob, storePhoto } from '@/lib/snapshotClient';
import { space, useColors } from '@/theme';

export default function SnapshotScreen() {
  const p = useLocalSearchParams<{ date?: string; meal?: string; next?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [meal, setMeal] = useState<Meal>((p.meal as Meal) ?? mealForNow());
  const [status, setStatus] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });
  const [online, setOnline] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      isServerOnline(db).then(setOnline);
    }, [db]),
  );

  function choose(kind: SnapshotKind) {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) capture(kind, 'camera');
        if (i === 1) capture(kind, 'library');
      },
    );
  }

  async function capture(kind: SnapshotKind, from: 'camera' | 'library') {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    if (from === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setStatus({ busy: false, msg: 'Camera permission is needed.' });
    }
    const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;

    const path = storePhoto(res.assets[0].uri);
    const jobId = await createJob(db, path, kind, p.date ?? todayStr(), meal);
    setStatus({ busy: true, msg: 'Sending to your laptop… vision models can take up to a minute or two.' });
    const job = await getJob(db, jobId);
    const result = job ? await processJob(db, job) : 'failed';
    if (result === 'ok') {
      setStatus({ busy: false, msg: null });
      router.replace(`/food/review/${jobId}`);
    } else if (result === 'unreachable') {
      setStatus({ busy: false, msg: 'Laptop not reachable. The photo is queued and will be processed next time it’s online (Food → Snapshot queue).' });
    } else {
      setStatus({ busy: false, msg: 'The server couldn’t read that photo. It’s in the queue; you can retry or delete it there.' });
    }
  }

  // "Snap next part" from the review screen opens the camera straight away.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (p.next === 'meal' && !autoStarted.current) {
      autoStarted.current = true;
      capture('meal', 'camera');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.next]);

  return (
    <Screen>
      {online === false ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: c.card2, padding: space.md, borderRadius: 14 }}>
          <SymbolView name="wifi.slash" tintColor={c.warning} size={16} />
          <T variant="muted" style={{ flex: 1 }}>
            Laptop offline. Snap anyway: photos are saved and processed when it’s back, and you’ll get a notification.
          </T>
        </View>
      ) : null}
      <T variant="muted">
        Photos go only to your own laptop over Tailscale. You always review the result before anything is logged.
      </T>
      <T variant="label">Meal</T>
      <ChipRow>
        {MEALS.map((x) => (
          <Chip key={x} label={MEAL_LABELS[x]} selected={meal === x} onPress={() => setMeal(x)} />
        ))}
      </ChipRow>
      <Card>
        <T variant="heading">Nutrition label</T>
        <T variant="muted">Reads the label into calories, protein, carbs and fat.</T>
        <Button title="Snap a label" onPress={() => choose('label')} disabled={status.busy} />
      </Card>
      <Card>
        <T variant="heading">Meal photo</T>
        <T variant="muted">Identifies foods and estimates grams; nutrition comes from USDA.</T>
        <Button title="Snap a meal" onPress={() => choose('meal')} disabled={status.busy} />
      </Card>
      {status.busy || status.msg ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          {status.busy ? <ActivityIndicator /> : null}
          <T style={{ flex: 1, color: status.busy ? c.text : c.textMuted }}>{status.msg}</T>
        </View>
      ) : null}
      <Button title="Open snapshot queue" variant="secondary" onPress={() => router.push('/food/queue')} />
    </Screen>
  );
}
