import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, View } from 'react-native';

import { DateField, TimeField } from '@/components/pickers';
import { Button, Card, Screen, T } from '@/components/ui';
import { listRoutines } from '@/db/repos/routines';
import {
  addScheduled,
  listSchedule,
  removeScheduled,
  updateReminder,
  type ScheduledWorkout,
} from '@/db/repos/schedule';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, todayStr, WEEKDAYS_LONG } from '@/lib/dates';
import { syncWorkoutReminders } from '@/lib/notifications';
import { space, useColors } from '@/theme';

// Monday-first display order.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ScheduleScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const { data: schedule, reload } = useDbQuery(listSchedule);
  const { data: routines } = useDbQuery(listRoutines);
  const [oneOffDate, setOneOffDate] = useState(todayStr());

  async function changed() {
    await reload();
    await syncWorkoutReminders(db);
  }

  function pickRoutine(onPick: (routineId: number) => void) {
    if (!routines?.length) return;
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Choose a routine', options: [...routines.map((r) => r.name), 'Cancel'], cancelButtonIndex: routines.length },
      (i) => {
        if (i < routines.length) onPick(routines[i].id);
      },
    );
  }

  const byWeekday = (wd: number) => schedule?.filter((s) => s.weekday === wd) ?? [];
  const oneOffs = schedule?.filter((s) => s.date !== null && s.date >= todayStr()) ?? [];

  return (
    <Screen>
      <T variant="muted">Reminders are local notifications at the time you set. Leave the time empty for no reminder.</T>

      {ORDER.map((wd) => (
        <Card key={wd}>
          <View style={styles.dayHeader}>
            <T variant="heading" style={{ flex: 1 }}>
              {WEEKDAYS_LONG[wd]}
            </T>
            <Pressable
              hitSlop={10}
              accessibilityLabel={`Add routine on ${WEEKDAYS_LONG[wd]}`}
              onPress={() =>
                pickRoutine(async (id) => {
                  await addScheduled(db, id, { weekday: wd }, null);
                  changed();
                })
              }>
              <SymbolView name="plus.circle" tintColor={c.accent} size={22} />
            </Pressable>
          </View>
          {byWeekday(wd).length === 0 ? <T variant="muted">Rest day</T> : null}
          {byWeekday(wd).map((s) => (
            <Entry key={s.id} s={s} onChanged={changed} />
          ))}
        </Card>
      ))}

      <Card>
        <T variant="heading">One-off date</T>
        <DateField value={oneOffDate} onChange={setOneOffDate} />
        <Button
          title="Add routine on this date"
          variant="secondary"
          onPress={() =>
            pickRoutine(async (id) => {
              await addScheduled(db, id, { date: oneOffDate }, null);
              changed();
            })
          }
        />
        {oneOffs.map((s) => (
          <View key={s.id} style={{ gap: space.xs }}>
            <T variant="label">{formatDate(s.date!)}</T>
            <Entry s={s} onChanged={changed} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Entry({ s, onChanged }: { s: ScheduledWorkout; onChanged: () => void }) {
  const db = useSQLiteContext();
  const c = useColors();
  return (
    <View style={styles.entry}>
      <View style={{ flex: 1, gap: space.xs }}>
        <T>{s.routine_name}</T>
        <TimeField
          value={s.reminder_time}
          placeholder="No reminder"
          onChange={async (t) => {
            await updateReminder(db, s.id, t);
            onChanged();
          }}
        />
      </View>
      <View style={{ gap: space.sm, alignItems: 'center' }}>
        {s.reminder_time ? (
          <Pressable
            hitSlop={8}
            accessibilityLabel="Turn off reminder"
            onPress={async () => {
              await updateReminder(db, s.id, null);
              onChanged();
            }}>
            <SymbolView name="bell.slash" tintColor={c.textMuted} size={18} />
          </Pressable>
        ) : null}
        <Pressable
          hitSlop={8}
          accessibilityLabel={`Remove ${s.routine_name}`}
          onPress={async () => {
            await removeScheduled(db, s.id);
            onChanged();
          }}>
          <SymbolView name="trash" tintColor={c.danger} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayHeader: { flexDirection: 'row', alignItems: 'center' },
  entry: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
});
