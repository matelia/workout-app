import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Empty, Row, Screen, T } from '@/components/ui';
import { CATEGORY_LABELS, listCareItems } from '@/db/repos/care';
import { Fab } from '@/components/Fab';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatTime, WEEKDAYS } from '@/lib/dates';
import { useColors } from '@/theme';

export default function CareItems() {
  const router = useRouter();
  const c = useColors();
  const { data: items } = useDbQuery(listCareItems);

  return (
    <Screen overlay={<Fab label="New care item" onPress={() => router.push('/mind/care/new')} />}>
      <T variant="muted">
        Lock-screen notifications only show each item&apos;s neutral label, never its name.
      </T>
      {items?.length === 0 ? <Empty title="No care items" hint="Add meds, skincare, hair care or any routine." /> : null}
      {items?.map((it) => {
        const times = (JSON.parse(it.schedule_times) as string[]).map(formatTime).join(', ');
        const days: number[] | null = it.weekdays ? JSON.parse(it.weekdays) : null;
        return (
          <Row key={it.id} onPress={() => router.push(`/mind/care/${it.id}`)}>
            <View style={{ flex: 1 }}>
              <T>{it.name}</T>
              <T variant="muted">
                {CATEGORY_LABELS[it.category]} · {times} · {days ? days.map((d) => WEEKDAYS[d]).join(' ') : 'every day'}
              </T>
              <T variant="muted">Notification: “{it.notification_label}”</T>
            </View>
            <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
          </Row>
        );
      })}
    </Screen>
  );
}
