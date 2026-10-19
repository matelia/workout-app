import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { View } from 'react-native';

import { CareSlotRow } from '@/components/CareSlotRow';
import { LineChart } from '@/components/charts';
import { MoodFace, moodInfo } from '@/components/MoodFace';
import { Button, Card, Row, Screen, T } from '@/components/ui';
import { careSlotsFor } from '@/db/repos/care';
import { getCheckIn, listCheckIns } from '@/db/repos/mind';
import { useDbQuery } from '@/hooks/useDbQuery';
import { addDays, formatDate, todayStr } from '@/lib/dates';
import { useMindLock } from '@/lib/mindLock';
import { useColors } from '@/theme';

export default function MindHome() {
  const router = useRouter();
  const c = useColors();
  const { lock } = useMindLock();
  const today = todayStr();
  const { data: checkIn } = useDbQuery((d) => getCheckIn(d, today), today);
  const { data: slots, reload } = useDbQuery((d) => careSlotsFor(d, today, new Date().getDay()), today);
  const { data: recent } = useDbQuery((d) => listCheckIns(d, addDays(today, -13), today), today);

  const moodPoints = (recent ?? [])
    .filter((x) => x.mood !== null)
    .map((x) => ({ label: formatDate(x.date, { month: 'short', day: 'numeric' }), value: x.mood! }));

  const link = (icon: SFSymbol, title: string, href: string) => (
    <Row onPress={() => router.push(href as never)}>
      <SymbolView name={icon} tintColor={c.accent} size={20} />
      <T style={{ flex: 1 }}>{title}</T>
      <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
    </Row>
  );

  return (
    <Screen>
      <Card>
        <T variant="label">Today&apos;s check-in</T>
        {checkIn ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {checkIn.mood ? <MoodFace mood={checkIn.mood} size={48} /> : null}
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '600', color: moodInfo(checkIn.mood)?.color ?? c.text }}>{moodInfo(checkIn.mood)?.label ?? 'No mood'}</T>
              <T variant="muted">
                Energy {checkIn.energy ?? '–'}/5 · Sleep {checkIn.sleep_hours ?? '–'} h
                {checkIn.tags ? ` · ${(JSON.parse(checkIn.tags) as string[]).join(', ')}` : ''}
              </T>
            </View>
          </View>
        ) : (
          <T variant="muted">Not done yet. It takes about 30 seconds.</T>
        )}
        <Button title={checkIn ? 'Edit check-in' : 'Check in'} onPress={() => router.push('/mind/checkin')} />
      </Card>

      <Card>
        <T variant="label">Care today</T>
        {slots?.length === 0 ? <T variant="muted">Nothing scheduled today.</T> : null}
        {slots?.map((s) => (
          <CareSlotRow key={`${s.item.id}-${s.time}`} slot={s} showName onChange={reload} />
        ))}
      </Card>

      <Card>
        <T variant="label">Mood · last 14 days</T>
        <LineChart data={moodPoints} yDomain={[1, 5]} height={140} />
      </Card>

      <View style={{ gap: 8 }}>
        {link('book', 'Journal', '/mind/journal')}
        {link('person.2', 'Therapy sessions', '/mind/therapy')}
        {link('list.bullet.clipboard', 'Before next session', '/mind/therapy/prep')}
        {link('pills', 'Care items & reminders', '/mind/care')}
        {link('square.and.arrow.up', 'Export for therapist', '/mind/export')}
      </View>

      <Button title="Lock now" variant="secondary" onPress={lock} />
    </Screen>
  );
}
