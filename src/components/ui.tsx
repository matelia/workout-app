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

import { fonts, radius, space, useColors } from '@/theme';

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
}: TextProps & { variant?: 'title' | 'heading' | 'body' | 'muted' | 'label' | 'number' }) {
  const c = useColors();
  const v = {
    title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: c.text },
    heading: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 26, color: c.text },
    body: { fontSize: 16, color: c.text },
    muted: { fontSize: 14, color: c.textMuted },
    label: {
      fontFamily: fonts.displayBold,
      fontSize: 15,
      color: c.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
    },
    /** Big stat numbers. */
    number: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: c.text },
  }[variant];
  return <Text style={[v, style]} {...rest} />;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card }, style]}>
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
        { backgroundColor: pressed && onPress ? c.cardPressed : c.card },
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
  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? 'transparent' : c.card2;
  const fg = variant === 'primary' ? c.accentText : variant === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          opacity: pressed || rest.disabled ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
      {...rest}>
      <Text style={{ color: fg, fontFamily: fonts.displayBold, fontSize: 19, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {title}
      </Text>
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
          { backgroundColor: c.card, color: c.text },
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
          backgroundColor: selected ? c.accent : c.card2,
        },
      ]}>
      <Text style={{ color: selected ? c.accentText : c.text, fontSize: 14, fontWeight: selected ? '700' : '500' }}>
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
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  row: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  input: {
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 16,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl * 2 },
});
