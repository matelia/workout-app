import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Button, Empty, Row, Screen, T } from '@/components/ui';
import { listTherapy } from '@/db/repos/mind';
import { Fab } from '@/components/Fab';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate } from '@/lib/dates';
import { useColors } from '@/theme';

export default function TherapyList() {
  const router = useRouter();
  const c = useColors();
  const { data: sessions } = useDbQuery(listTherapy);

  return (
    <Screen overlay={<Fab label="New therapy session" onPress={() => router.push('/mind/therapy/new')} />}>
      <Button title="Before next session" variant="secondary" onPress={() => router.push('/mind/therapy/prep')} />
      {sessions?.length === 0 ? <Empty title="No sessions yet" hint="Tap + after a session to add notes." /> : null}
      {sessions?.map((s) => (
        <Row key={s.id} onPress={() => router.push(`/mind/therapy/${s.id}`)}>
          <View style={{ flex: 1 }}>
            <T>{formatDate(s.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</T>
            <T variant="muted" numberOfLines={1}>
              {s.takeaways || s.notes || 'No notes'}
            </T>
          </View>
          <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
        </Row>
      ))}
    </Screen>
  );
}
