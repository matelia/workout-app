import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { radius, useColors } from '@/theme';

/** iOS-style row: swipe left to reveal Edit / Delete. */
export function SwipeRow({
  children,
  onEdit,
  onDelete,
  deleteLabel = 'Delete',
  rounded = false,
}: {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  /** For rows that are their own rounded card (e.g. <Row>). */
  rounded?: boolean;
}) {
  const c = useColors();

  function actions(_p: unknown, _t: unknown, methods: SwipeableMethods) {
    const run = (fn: () => void) => () => {
      methods.close();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      fn();
    };
    return (
      <View style={styles.actions}>
        {onEdit ? (
          <Pressable onPress={run(onEdit)} style={[styles.action, { backgroundColor: c.textMuted }]} accessibilityLabel="Edit">
            <SymbolView name="pencil" tintColor="#fff" size={18} />
            <Text style={styles.label}>Edit</Text>
          </Pressable>
        ) : null}
        {onDelete ? (
          <Pressable onPress={run(onDelete)} style={[styles.action, { backgroundColor: c.danger }]} accessibilityLabel={deleteLabel}>
            <SymbolView name="trash" tintColor="#fff" size={18} />
            <Text style={styles.label}>{deleteLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Swipeable
      friction={1.5}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={actions}
      containerStyle={rounded ? { borderRadius: radius.md, overflow: 'hidden' } : undefined}>
      <View style={{ backgroundColor: c.card }}>{children}</View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  action: { width: 76, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
