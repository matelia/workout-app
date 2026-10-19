import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Empty, Row, Screen, T } from '@/components/ui';
import { listJournal } from '@/db/repos/mind';
import { Fab } from '@/components/Fab';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, formatTime } from '@/lib/dates';
import { useColors } from '@/theme';

export default function JournalList() {
  const router = useRouter();
  const c = useColors();
  const { data: entries } = useDbQuery(listJournal);

  return (
    <Screen overlay={<Fab label="New journal entry" onPress={() => router.push('/mind/journal/new')} />}>
      {entries?.length === 0 ? <Empty title="No entries yet" hint="Tap the pencil to write one." /> : null}
      {entries?.map((e) => (
        <Row key={e.id} onPress={() => router.push(`/mind/journal/${e.id}`)}>
          <View style={{ flex: 1 }}>
            <T variant="muted">
              {formatDate(e.datetime.slice(0, 10))} · {formatTime(e.datetime.slice(11, 16))}
            </T>
            <T numberOfLines={2}>{e.text}</T>
          </View>
          {e.bring_to_therapy ? <SymbolView name="flag.fill" tintColor={c.accent} size={16} /> : null}
        </Row>
      ))}
    </Screen>
  );
}
