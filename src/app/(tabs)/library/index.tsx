import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { Chip, Empty, Field, Row, T } from '@/components/ui';
import { EQUIPMENT } from '@/data/exerciseInfo';
import { listExercises, MUSCLE_GROUPS } from '@/db/repos/exercises';
import { createScreenshotJob, getJob } from '@/db/repos/snapshots';
import { useDbQuery } from '@/hooks/useDbQuery';
import { readReel } from '@/lib/instagram';
import { pickScreenshots } from '@/lib/media';
import { processJob } from '@/lib/snapshotClient';
import { radius, space, useColors } from '@/theme';

export default function LibraryIndex() {
  const router = useRouter();
  const db = useSQLiteContext();
  const c = useColors();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  // Muscle groups the user has opened. While searching, every matching group is open.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { data: exercises } = useDbQuery(listExercises);
  const [busy, setBusy] = useState<string | null>(null);

  function add() {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['New exercise', 'Import from Instagram', 'Cancel'], cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) router.push('/library/edit');
        if (i === 1) importInstagram();
      },
    );
  }

  function importInstagram() {
    Alert.prompt('Paste an Instagram link', 'A public post or reel with a workout.', async (text) => {
      const url = text?.trim();
      if (!url) return;
      setBusy('Reading the post…');
      let reel;
      try {
        reel = await readReel(url);
      } catch (e) {
        setBusy(null);
        Alert.alert('Couldn’t read that post', e instanceof Error ? e.message : String(e));
        return;
      }
      setBusy(null);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: reel.caption ? `“${reel.caption.slice(0, 120)}${reel.caption.length > 120 ? '…' : ''}”` : 'No caption on this post',
          message: 'If the caption doesn’t list the exercises, add a few screenshots of the video.',
          options: ['Read the caption', 'Add screenshots too', 'Cancel'],
          cancelButtonIndex: 2,
        },
        async (k) => {
          if (k === 2) return;
          const shots = k === 1 ? await pickScreenshots('screenshots') : [];
          const paths = [reel.thumbnail, ...shots].filter((p): p is string => !!p);
          const jobId = await createScreenshotJob(db, paths, 'workout', { url: reel.url, caption: reel.caption, author: reel.author });
          setBusy('Working out the exercises on the laptop… this can take a minute.');
          const job = await getJob(db, jobId);
          const result = job ? await processJob(db, job) : 'failed';
          setBusy(null);
          if (result === 'ok') router.push(`/library/import-review?id=${jobId}`);
          else
            Alert.alert(
              result === 'unreachable' ? 'Laptop is offline' : 'Couldn’t read that workout',
              result === 'unreachable'
                ? 'Saved. It’ll be read when the laptop is back, and you’ll get a notification.'
                : 'It’s in Food → Snapshot queue, where you can retry or delete it.',
            );
        },
      );
    });
  }

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, NonNullable<typeof exercises>>();
    for (const e of exercises ?? []) {
      const group = e.muscle_group ?? 'Other';
      if (muscle && group !== muscle) continue;
      if (equipment.length && !equipment.includes(e.equipment ?? 'Other')) continue;
      if (q && !e.name.toLowerCase().includes(q)) continue;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(e);
    }
    const order = (g: string) => {
      const i = MUSCLE_GROUPS.indexOf(g as (typeof MUSCLE_GROUPS)[number]);
      return i === -1 ? MUSCLE_GROUPS.length : i;
    };
    return [...groups.entries()]
      .sort(([a], [b]) => order(a) - order(b))
      .map(([title, data]) => ({ title, data }));
  }, [exercises, query, muscle, equipment]);

  const toggleEquipment = (e: string) =>
    setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SectionList
        style={{ backgroundColor: c.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        sections={sections.map((sec) => ({ ...sec, count: sec.data.length, data: query.trim() || open.has(sec.title) ? sec.data : [] }))}
        keyExtractor={(e) => String(e.id)}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <Field value={query} onChangeText={setQuery} placeholder="Search exercises" autoCorrect={false} clearButtonMode="while-editing" />
            <T variant="label">Muscle</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All" selected={!muscle} onPress={() => setMuscle(null)} />
              {MUSCLE_GROUPS.map((m) => (
                <Chip key={m} label={m} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
              ))}
            </ScrollView>
            <T variant="label">Equipment</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Any" selected={!equipment.length} onPress={() => setEquipment([])} />
              {EQUIPMENT.map((e) => (
                <Chip key={e} label={e} selected={equipment.includes(e)} onPress={() => toggleEquipment(e)} />
              ))}
            </ScrollView>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const expanded = !!query.trim() || open.has(section.title);
          return (
            <Pressable
              onPress={() =>
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (next.has(section.title)) next.delete(section.title);
                  else next.add(section.title);
                  return next;
                })
              }
              style={[styles.sectionHeader, { backgroundColor: c.card }]}>
              <T variant="heading" style={{ flex: 1 }}>
                {section.title}
              </T>
              <T variant="muted">{section.count}</T>
              <SymbolView name={expanded ? 'chevron.up' : 'chevron.down'} tintColor={c.accent} size={16} />
            </Pressable>
          );
        }}
        renderItem={({ item }) => (
          <Row onPress={() => router.push(`/library/${item.id}`)} style={styles.item}>
            <View style={{ flex: 1 }}>
              <T>{item.name}</T>
              {item.equipment ? <T variant="muted">{item.equipment}</T> : null}
            </View>
            {item.video_type ? <SymbolView name="play.rectangle" tintColor={c.textMuted} size={18} /> : null}
            <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
          </Row>
        )}
        ListEmptyComponent={
          exercises ? (
            <Empty
              title={exercises.length ? 'No matches' : 'No exercises yet'}
              hint={exercises.length ? 'Try another search or filter.' : 'Tap + to add one.'}
            />
          ) : undefined
        }
      />
      {busy ? (
        <View style={[styles.busy, { backgroundColor: c.card }]}>
          <ActivityIndicator />
          <T variant="muted" style={{ flex: 1 }}>
            {busy}
          </T>
        </View>
      ) : null}
      <Fab label="Add exercise" onPress={add} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 120 },
  busy: { position: 'absolute', left: space.lg, right: 96, bottom: 28, flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md, borderRadius: 14 },
  chips: { gap: space.sm, paddingRight: space.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  item: { marginBottom: space.sm, marginLeft: space.md },
});
