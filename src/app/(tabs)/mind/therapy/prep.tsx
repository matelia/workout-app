import { useRouter } from 'expo-router';
import { type SQLiteDatabase } from 'expo-sqlite';

import { LineChart } from '@/components/charts';
import { Card, Row, Screen, T } from '@/components/ui';
import { lastTherapyBefore, listCheckIns, listFlaggedSince } from '@/db/repos/mind';
import { useDbQuery } from '@/hooks/useDbQuery';
import { addDays, formatDate, formatTime, todayStr } from '@/lib/dates';

async function loadPrep(db: SQLiteDatabase) {
  const today = todayStr();
  const last = await lastTherapyBefore(db, today);
  // Since the day after the last session; if there is none, the last 30 days.
  const since = last ? addDays(last.date, 1) : addDays(today, -30);
  const [flagged, checkIns] = await Promise.all([
    listFlaggedSince(db, since),
    listCheckIns(db, since, today),
  ]);
  return { last, since, flagged, checkIns };
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–';
};

export default function TherapyPrep() {
  const router = useRouter();
  const { data } = useDbQuery(loadPrep);
  if (!data) return null;
  const { last, since, flagged, checkIns } = data;

  const moodPoints = checkIns
    .filter((x) => x.mood !== null)
    .map((x) => ({ label: formatDate(x.date, { month: 'short', day: 'numeric' }), value: x.mood! }));

  return (
    <Screen>
      <T variant="muted">
        {last
          ? `Since your last session on ${formatDate(last.date, { month: 'long', day: 'numeric' })}`
          : `No sessions logged yet. Showing everything since ${formatDate(since, { month: 'long', day: 'numeric' })}.`}
      </T>

      {last?.homework ? (
        <Card>
          <T variant="label">Homework from last time</T>
          <T>{last.homework}</T>
        </Card>
      ) : null}

      <Card>
        <T variant="label">Mood trend</T>
        <LineChart data={moodPoints} yDomain={[1, 5]} height={150} />
        <T variant="muted">
          {checkIns.length} check-ins · avg mood {avg(checkIns.map((c) => c.mood))} · avg energy{' '}
          {avg(checkIns.map((c) => c.energy))} · avg sleep {avg(checkIns.map((c) => c.sleep_hours))} h
        </T>
      </Card>

      <T variant="label">Flagged journal entries ({flagged.length})</T>
      {flagged.length === 0 ? <T variant="muted">Nothing flagged. Use “Bring to therapy” on a journal entry.</T> : null}
      {flagged.map((e) => (
        <Row key={e.id} onPress={() => router.push(`/mind/journal/${e.id}`)}>
          <T variant="muted">
            {formatDate(e.datetime.slice(0, 10))} {formatTime(e.datetime.slice(11, 16))}
          </T>
          <T style={{ flex: 1 }} numberOfLines={4}>
            {e.text}
          </T>
        </Row>
      ))}
    </Screen>
  );
}
