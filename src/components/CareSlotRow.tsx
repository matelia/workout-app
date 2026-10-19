import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { T } from '@/components/ui';
import { logCare, undoCare, type CareSlot } from '@/db/repos/care';
import { formatTime } from '@/lib/dates';
import { radius, space, useColors } from '@/theme';

/**
 * One care slot with Done / Skip. `showName` is false outside the locked Mind tab,
 * so only the neutral notification label is shown there.
 */
export function CareSlotRow({ slot, showName, onChange }: { slot: CareSlot; showName: boolean; onChange: () => void }) {
  const db = useSQLiteContext();
  const c = useColors();
  const title = showName ? slot.item.name : slot.item.notification_label;

  async function act(fn: () => Promise<void>) {
    await fn();
    onChange();
  }

  return (
    <View style={[styles.row, { borderColor: c.border }]}>
      <View style={{ flex: 1 }}>
        <T style={slot.status !== 'due' ? { color: c.textMuted, textDecorationLine: 'line-through' } : undefined}>{title}</T>
        <T variant="muted">
          {formatTime(slot.time)}
          {slot.status === 'done' ? ' · done' : slot.status === 'skipped' ? ' · skipped' : ''}
        </T>
      </View>
      {slot.status === 'due' ? (
        <>
          <Pressable
            onPress={() => act(() => logCare(db, slot.item.id, slot.scheduled, true))}
            style={[styles.btn, { backgroundColor: c.bg }]}>
            <Text style={{ color: c.textMuted, fontWeight: '600' }}>Skip</Text>
          </Pressable>
          <Pressable
            onPress={() => act(() => logCare(db, slot.item.id, slot.scheduled, false))}
            style={[styles.btn, { backgroundColor: c.success }]}>
            <Text style={{ color: c.accentText, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => act(() => undoCare(db, slot.item.id, slot.scheduled))} style={styles.btn}>
          <Text style={{ color: c.accent }}>Undo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  btn: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm },
});
