import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { TimeField } from '@/components/pickers';
import { Button, Card, Chip, ChipRow, Field, Screen, T } from '@/components/ui';
import {
  CATEGORY_LABELS,
  careHistory,
  deactivateCareItem,
  getCareItem,
  saveCareItem,
  type CareCategory,
} from '@/db/repos/care';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, formatTime, WEEKDAYS } from '@/lib/dates';
import { syncCareReminders } from '@/lib/notifications';
import { space, useColors } from '@/theme';

const LABEL_SUGGESTIONS = ['Morning routine', 'Evening routine', 'Midday check', 'Self-care', 'Reminder'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function CareItemEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id === 'new' ? null : Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<CareCategory>('meds');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: history } = useDbQuery((d) => (itemId ? careHistory(d, itemId) : Promise.resolve([])), id);

  useEffect(() => {
    if (!itemId) return;
    getCareItem(db, itemId).then((it) => {
      if (!it) return;
      setName(it.name);
      setCategory(it.category);
      setTimes(JSON.parse(it.schedule_times));
      setDays(it.weekdays ? JSON.parse(it.weekdays) : ALL_DAYS);
      setLabel(it.notification_label);
    });
  }, [db, itemId]);

  async function persist() {
    await saveCareItem(db, itemId, { name: name.trim(), category, times, weekdays: days, notification_label: label.trim() });
    await syncCareReminders(db);
    router.back();
  }

  function save() {
    if (!name.trim()) return setError('Give it a name.');
    if (!times.length) return setError('Add at least one time.');
    if (!days.length) return setError('Pick at least one day.');
    if (!label.trim()) return setError('Choose a neutral notification label.');
    const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.some((w) => label.toLowerCase().includes(w))) {
      Alert.alert(
        'Label contains the name',
        `“${label.trim()}” will show on your lock screen. Use it anyway?`,
        [
          { text: 'Change it', style: 'cancel' },
          { text: 'Use anyway', onPress: persist },
        ],
      );
      return;
    }
    persist();
  }

  function remove() {
    if (!itemId) return;
    Alert.alert('Remove care item?', 'Reminders stop. Its history is kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deactivateCareItem(db, itemId);
          await syncCareReminders(db);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: itemId ? 'Edit care item' : 'New care item',
        }}
      />

      <Field label="Name (private)" value={name} onChangeText={setName} placeholder="e.g. Sertraline 50 mg, Retinol" />

      <T variant="label">Category</T>
      <ChipRow>
        {(Object.keys(CATEGORY_LABELS) as CareCategory[]).map((k) => (
          <Chip key={k} label={CATEGORY_LABELS[k]} selected={category === k} onPress={() => setCategory(k)} />
        ))}
      </ChipRow>

      <T variant="label">Times</T>
      {times.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <TimeField value={t} onChange={(v) => setTimes((prev) => prev.map((x, j) => (j === i ? v : x)))} />
          </View>
          <Pressable hitSlop={8} onPress={() => setTimes((prev) => prev.filter((_, j) => j !== i))}>
            <SymbolView name="minus.circle" tintColor={c.danger} size={22} />
          </Pressable>
        </View>
      ))}
      <Button title="Add time" variant="secondary" onPress={() => setTimes((prev) => [...prev, '21:00'])} />

      <T variant="label">Days</T>
      <ChipRow>
        {ALL_DAYS.map((d) => (
          <Chip
            key={d}
            label={WEEKDAYS[d]}
            selected={days.includes(d)}
            onPress={() => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
          />
        ))}
      </ChipRow>

      <Field
        label="Lock-screen label (shown in notifications)"
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Evening routine"
      />
      <ChipRow>
        {LABEL_SUGGESTIONS.map((s) => (
          <Chip key={s} label={s} selected={label === s} onPress={() => setLabel(s)} />
        ))}
      </ChipRow>

      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
      <Button title="Save" onPress={save} />
      {itemId ? <Button title="Remove care item" variant="danger" onPress={remove} /> : null}

      {itemId && history?.length ? (
        <Card>
          <T variant="label">History</T>
          {history.map((h) => (
            <T key={h.scheduled_time} variant="muted">
              {formatDate(h.scheduled_time.slice(0, 10))} {formatTime(h.scheduled_time.slice(11, 16))} ·{' '}
              {h.skipped ? 'skipped' : `done ${h.done_time ? formatTime(h.done_time.slice(11, 16)) : ''}`}
            </T>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
