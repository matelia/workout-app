import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { parseDate, timeToDate, toDateStr, toTimeStr } from '@/lib/dates';
import { radius, space, useColors } from '@/theme';

/** A tappable value that opens a bottom sheet with the iOS spinner picker. */
export function PickerSheet({
  visible,
  mode,
  initial,
  onDone,
  onCancel,
}: {
  visible: boolean;
  mode: 'time' | 'date';
  initial: Date;
  onDone: (d: Date) => void;
  onCancel: () => void;
}) {
  const c = useColors();
  const [value, setValue] = useState(initial);
  return (
    <Modal visible={visible} transparent animationType="slide" onShow={() => setValue(initial)}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={[styles.sheet, { backgroundColor: c.card }]}>
        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          minuteInterval={mode === 'time' ? 5 : undefined}
          onChange={(_, d) => d && setValue(d)}
          textColor={c.text}
        />
        <Button title="Done" onPress={() => onDone(value)} />
      </View>
    </Modal>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Set time',
}: {
  label?: string;
  value: string | null;
  onChange: (time: string) => void;
  placeholder?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      {label ? <T variant="label">{label}</T> : null}
      <Pressable onPress={() => setOpen(true)} style={[styles.field, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={{ color: value ? c.text : c.textMuted, fontSize: 16 }}>
          {value ? timeToDate(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : placeholder}
        </Text>
      </Pressable>
      <PickerSheet
        visible={open}
        mode="time"
        initial={value ? timeToDate(value) : timeToDate('08:00')}
        onCancel={() => setOpen(false)}
        onDone={(d) => {
          setOpen(false);
          onChange(toTimeStr(d));
        }}
      />
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      {label ? <T variant="label">{label}</T> : null}
      <Pressable onPress={() => setOpen(true)} style={[styles.field, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={{ color: c.text, fontSize: 16 }}>
          {parseDate(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </Pressable>
      <PickerSheet
        visible={open}
        mode="date"
        initial={parseDate(value)}
        onCancel={() => setOpen(false)}
        onDone={(d) => {
          setOpen(false);
          onChange(toDateStr(d));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { padding: space.lg, paddingBottom: space.xl * 1.5, gap: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  field: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, paddingVertical: space.md },
});
