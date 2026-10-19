import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';

import { DateField } from '@/components/pickers';
import { Button, Field, Screen } from '@/components/ui';
import { deleteTherapy, getTherapy, saveTherapy } from '@/db/repos/mind';
import { todayStr } from '@/lib/dates';
import { useColors } from '@/theme';

export default function TherapyEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id === 'new' ? null : Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();

  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [takeaways, setTakeaways] = useState('');
  const [homework, setHomework] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    getTherapy(db, sessionId).then((s) => {
      if (!s) return;
      setDate(s.date);
      setNotes(s.notes ?? '');
      setTakeaways(s.takeaways ?? '');
      setHomework(s.homework ?? '');
    });
  }, [db, sessionId]);

  async function save() {
    await saveTherapy(db, sessionId, {
      date,
      notes: notes.trim() || null,
      takeaways: takeaways.trim() || null,
      homework: homework.trim() || null,
    });
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: sessionId ? 'Session' : 'New session',
          headerRight: () => (
            <Pressable hitSlop={12} onPress={save}>
              <Text style={{ color: c.accent, fontSize: 17, fontWeight: '600' }}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <DateField label="Date" value={date} onChange={setDate} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="What did you talk about?" />
      <Field label="Takeaways" value={takeaways} onChangeText={setTakeaways} multiline placeholder="What stuck with you?" />
      <Field label="Homework" value={homework} onChangeText={setHomework} multiline placeholder="Anything to try before next time?" />
      <Button title="Save" onPress={save} />
      {sessionId ? (
        <Button
          title="Delete session"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete session notes?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteTherapy(db, sessionId);
                  router.back();
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}
