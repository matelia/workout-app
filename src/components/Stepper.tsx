import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, useColors } from '@/theme';

/** Compact − value + control. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  suffix,
  format = String,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  format?: (v: number) => string;
}) {
  const c = useColors();
  const btn = (label: string, next: number, disabled: boolean) => (
    <Pressable
      hitSlop={6}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: pressed ? c.cardPressed : c.bg, opacity: disabled ? 0.35 : 1 },
      ]}>
      <Text style={[styles.btnText, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {btn('−', value - 1, value <= min)}
      <Text style={[styles.value, { color: c.text }]}>
        {format(value)}
        {suffix ? <Text style={{ color: c.textMuted, fontSize: 13 }}> {suffix}</Text> : null}
      </Text>
      {btn('+', value + 1, value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 20, fontWeight: '500', marginTop: -2 },
  value: { minWidth: 52, textAlign: 'center', fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
