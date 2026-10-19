import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { Chip, Empty, Row, T } from '@/components/ui';
import { EQUIPMENT } from '@/data/exerciseInfo';
import { listExercises, MUSCLE_GROUPS } from '@/db/repos/exercises';
import { useDbQuery } from '@/hooks/useDbQuery';
import { space, useColors } from '@/theme';

export default function LibraryIndex() {
  const router = useRouter();
  const c = useColors();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const { data: exercises } = useDbQuery(listExercises);

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
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: 'Search exercises',
            onChangeText: (e) => setQuery(e.nativeEvent.text),
            hideWhenScrolling: false,
          },
        }}
      />
      <SectionList
        style={{ backgroundColor: c.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        sections={sections}
        keyExtractor={(e) => String(e.id)}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
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
        renderSectionHeader={({ section }) => (
          <T variant="label" style={styles.sectionHeader}>
            {section.title}
          </T>
        )}
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
      <Fab label="Add exercise" onPress={() => router.push('/library/edit')} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 120 },
  chips: { gap: space.sm, paddingRight: space.lg },
  sectionHeader: { marginTop: space.lg, marginBottom: space.sm },
  item: { marginBottom: space.sm },
});
