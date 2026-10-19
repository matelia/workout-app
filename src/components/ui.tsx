import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { radius, space, useColors } from '@/theme';

/** `overlay` (e.g. a <Fab />) floats above the scrolling content. */
export function Screen({ children, scroll = true, overlay }: { children: ReactNode; scroll?: boolean; overlay?: ReactNode }) {
  const c = useColors();
  if (!scroll) return <View style={[styles.screen, { backgroundColor: c.bg }]}>{children}</View>;
  const list = (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.screen, overlay ? { paddingBottom: 110 } : null]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      {children}
    </ScrollView>
  );
  if (!overlay) return list;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {list}
      {overlay}
    </View>
  );
}

export function T({
  variant = 'body',
  style,
  ...rest
}: TextProps & { variant?: 'title' | 'heading' | 'body' | 'muted' | 'label' }) {
  const c = useColors();
  const v = {
    title: { fontSize: 28, fontWeight: '700' as const, color: c.text },
    heading: { fontSize: 18, fontWeight: '600' as const, color: c.text },
    body: { fontSize: 16, color: c.text },
    muted: { fontSize: 14, color: c.textMuted },
    label: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: c.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
  }[variant];
  return <Text style={[v, style]} {...rest} />;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function Row({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && onPress ? c.cardPressed : c.card, borderColor: c.border },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  variant = 'primary',
  style,
  ...rest
}: PressableProps & { title: string; variant?: 'primary' | 'secondary' | 'danger'; style?: ViewStyle }) {
  const c = useColors();
  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? 'transparent' : c.card;
  const fg = variant === 'primary' ? c.accentText : variant === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'secondary' ? c.border : 'transparent',
          opacity: pressed || rest.disabled ? 0.6 : 1,
        },
        style,
      ]}
      {...rest}>
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space.xs }}>
      {label ? <T variant="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          { backgroundColor: c.card, borderColor: c.border, color: c.text },
          rest.multiline && { minHeight: 90, textAlignVertical: 'top' },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.accent : c.card,
          borderColor: selected ? c.accent : c.border,
        },
      ]}>
      <Text style={{ color: selected ? c.accentText : c.text, fontSize: 14, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <T variant="heading">{title}</T>
      {hint ? <T variant="muted" style={{ textAlign: 'center' }}>{hint}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.lg, flexGrow: 1 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.sm,
  },
  row: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 16,
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl * 2 },
});
