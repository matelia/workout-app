import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { Button, Field, Screen, T } from '@/components/ui';
import { deleteJournal, getJournal, saveJournal } from '@/db/repos/mind';
import { formatDate, formatTime, nowLocalIso } from '@/lib/dates';
import { space } from '@/theme';

export default function JournalEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = id === 'new' ? null : Number(id);
  const db = useSQLiteContext();
  const router = useRouter();

  const [text, setText] = useState('');
  const [flag, setFlag] = useState(false);
  const [datetime, setDatetime] = useState(nowLocalIso());

  useEffect(() => {
    if (!entryId) return;
    getJournal(db, entryId).then((e) => {
      if (!e) return;
      setText(e.text);
      setFlag(!!e.bring_to_therapy);
      setDatetime(e.datetime);
    });
  }, [db, entryId]);

  async function save() {
    if (!text.trim()) return router.back();
    await saveJournal(db, entryId, { datetime, text: text.trim(), bring_to_therapy: flag ? 1 : 0 });
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: entryId ? 'Entry' : 'New entry',
        }}
      />
      <T variant="muted">
        {formatDate(datetime.slice(0, 10), { weekday: 'long', month: 'long', day: 'numeric' })} ·{' '}
        {formatTime(datetime.slice(11, 16))}
      </T>
      <Field value={text} onChangeText={setText} placeholder="Write freely…" multiline autoFocus={!entryId} style={{ minHeight: 260 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <T style={{ flex: 1 }}>Bring to therapy</T>
        <Switch value={flag} onValueChange={setFlag} />
      </View>
      <Button title="Save" onPress={save} />
      {entryId ? (
        <Button
          title="Delete entry"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete entry?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteJournal(db, entryId);
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
