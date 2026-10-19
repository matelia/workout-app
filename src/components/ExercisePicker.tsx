import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Row, T } from '@/components/ui';
import { listExercises } from '@/db/repos/exercises';
import { useDbQuery } from '@/hooks/useDbQuery';
import { space, useColors } from '@/theme';

/** Searchable multi-select over the library. Selection order is preserved. */
export function ExercisePicker({
  marked,
  markedLabel,
  onConfirm,
}: {
  marked?: Set<number>;
  markedLabel?: string;
  onConfirm: (ids: number[]) => Promise<void>;
}) {
  const router = useRouter();
  const c = useColors();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const { data: exercises } = useDbQuery(listExercises);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exercises ?? []).filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.muscle_group?.toLowerCase().includes(q),
    );
  }, [exercises, query]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function confirm() {
    if (selected.length) await onConfirm(selected);
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(e) => String(e.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Field value={query} onChangeText={setQuery} placeholder="Search name or muscle" autoCorrect={false} />
        }
        renderItem={({ item }) => {
          const position = selected.indexOf(item.id) + 1;
          return (
            <Row onPress={() => toggle(item.id)}>
              <View style={{ flex: 1 }}>
                <T>{item.name}</T>
                <T variant="muted">
                  {[item.muscle_group, marked?.has(item.id) ? markedLabel : null].filter(Boolean).join(' · ')}
                </T>
              </View>
              {position ? (
                <View style={[styles.badge, { backgroundColor: c.accent }]}>
                  <Text style={{ color: c.accentText, fontWeight: '700' }}>{position}</Text>
                </View>
              ) : (
                <SymbolView name="circle" tintColor={c.border} size={24} />
              )}
            </Row>
          );
        }}
      />
      <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.border }]}>
        <Button
          title={selected.length ? `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}` : 'Tap exercises to select'}
          onPress={confirm}
          disabled={!selected.length}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { padding: space.lg, paddingBottom: space.xl, borderTopWidth: StyleSheet.hairlineWidth },
  list: { padding: space.lg, gap: space.sm },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
