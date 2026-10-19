import { useRouter } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { BarChart, LineChart } from '@/components/charts';
import { Button, Card, Chip, ChipRow, Screen, T } from '@/components/ui';
import { getTargets } from '@/db/repos/food';
import { listCheckIns } from '@/db/repos/mind';
import { latestMetrics, listMetrics } from '@/db/repos/bodyMetrics';
import { liftHistory, loggedExercises, weeklyNutrition } from '@/db/repos/progress';
import { getSetting } from '@/db/repos/settings';
import { useDbQuery } from '@/hooks/useDbQuery';
import { DATASET_LABELS, shareCsv, type Dataset } from '@/lib/csvExport';
import { addDays, formatDate, todayStr } from '@/lib/dates';
import { useMindLock } from '@/lib/mindLock';
import { useColors } from '@/theme';

type LiftMetric = 'top' | 'e1rm' | 'volume';
const METRIC_LABELS: Record<LiftMetric, string> = { top: 'Top set', e1rm: 'Est. 1RM', volume: 'Volume' };

async function loadLift(db: SQLiteDatabase) {
  const exercises = await loggedExercises(db);
  const chosen = Number(await getSetting(db, 'progress_exercise'));
  const ex = exercises.find((e) => e.id === chosen) ?? exercises[0];
  return ex ? { exercise: ex, history: await liftHistory(db, ex.id) } : null;
}

const short = (date: string) => formatDate(date, { month: 'short', day: 'numeric' });

export default function ProgressHome() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const { unlocked, unlock } = useMindLock();
  const [metric, setMetric] = useState<LiftMetric>('top');
  const [exporting, setExporting] = useState<Dataset | null>(null);

  const { data: lift } = useDbQuery(loadLift);
  const { data: nutrition } = useDbQuery((d) => weeklyNutrition(d, 8));
  const { data: targets } = useDbQuery(getTargets);
  const { data: metrics } = useDbQuery((d) => listMetrics(d, 120));
  const { data: latest } = useDbQuery(latestMetrics);
  // Mood is Mind data: only read while Mind is unlocked.
  const { data: mood } = useDbQuery(
    (d) => (unlocked ? listCheckIns(d, addDays(todayStr(), -29), todayStr()) : Promise.resolve(null)),
    String(unlocked),
  );

  async function exportCsv(ds: Dataset) {
    setExporting(ds);
    try {
      await shareCsv(db, ds);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  }

  const weeks = nutrition ?? [];

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T variant="label" style={{ flex: 1 }}>
            Lifts
          </T>
          <Pressable hitSlop={8} onPress={() => router.push('/progress/pick-exercise')}>
            <T style={{ color: c.accent }}>Change</T>
          </Pressable>
        </View>
        {lift ? (
          <>
            <T variant="heading">{lift.exercise.name}</T>
            <ChipRow>
              {(Object.keys(METRIC_LABELS) as LiftMetric[]).map((m) => (
                <Chip key={m} label={METRIC_LABELS[m]} selected={metric === m} onPress={() => setMetric(m)} />
              ))}
            </ChipRow>
            <LineChart data={lift.history.map((p) => ({ label: short(p.date), value: Math.round(p[metric]) }))} />
            {lift.history.length ? (
              <T variant="muted">
                Best top set {Math.max(...lift.history.map((p) => p.top))} lb · best est. 1RM{' '}
                {Math.round(Math.max(...lift.history.map((p) => p.e1rm)))} lb
              </T>
            ) : null}
          </>
        ) : (
          <T variant="muted">Finish a workout with weights to see your lifts here.</T>
        )}
      </Card>

      <Card>
        <T variant="label">Calories · weekly daily average</T>
        <BarChart data={weeks.map((w) => ({ label: short(w.week), value: Math.round(w.kcal) }))} target={targets?.kcal} />
        <T variant="label">Protein (g) · weekly daily average</T>
        <BarChart data={weeks.map((w) => ({ label: short(w.week), value: Math.round(w.protein) }))} target={targets?.protein_g} />
        <T variant="muted">Weeks start Monday. Only days with food logged count. The dashed line is your target.</T>
      </Card>

      <Card>
        <T variant="label">Mood · last 30 days</T>
        {unlocked && mood ? (
          <LineChart
            data={mood.filter((m) => m.mood !== null).map((m) => ({ label: short(m.date), value: m.mood! }))}
            yDomain={[1, 5]}
            height={150}
          />
        ) : (
          <Button title="Show mood (Face ID)" variant="secondary" onPress={unlock} />
        )}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T variant="label" style={{ flex: 1 }}>
            Body
          </T>
          <Pressable hitSlop={8} onPress={() => router.push('/progress/body')}>
            <T style={{ color: c.accent }}>All metrics</T>
          </Pressable>
        </View>
        {latest?.weight_lb || latest?.body_fat_pct ? (
          <T variant="heading">
            {[latest.weight_lb && `${latest.weight_lb.value} lb`, latest.body_fat_pct && `${latest.body_fat_pct.value}% body fat`, latest.skeletal_muscle_pct && `${latest.skeletal_muscle_pct.value}% skeletal muscle`]
              .filter(Boolean)
              .join(' · ')}
          </T>
        ) : (
          <T variant="muted">Sync Apple Health, import Renpho, or log a weigh-in.</T>
        )}
        <LineChart
          data={(metrics ?? []).filter((m) => m.weight_lb !== null).map((m) => ({ label: short(m.date), value: m.weight_lb! }))}
          height={140}
        />
        <Button title="Body metrics" variant="secondary" onPress={() => router.push('/progress/body')} />
      </Card>

      <Card>
        <T variant="label">Body photos</T>
        <T variant="muted">Private, behind Face ID, never exported. Monthly reminder included.</T>
        <Button title="Open body photos" variant="secondary" onPress={() => router.push('/progress/photos')} />
      </Card>

      <Card>
        <T variant="label">Export CSV</T>
        <T variant="muted">Mind data (check-ins, journal, therapy, care) is never included. Use Mind → Export for therapist for that.</T>
        {(Object.keys(DATASET_LABELS) as Dataset[]).map((ds) => (
          <Button
            key={ds}
            title={exporting === ds ? 'Preparing…' : DATASET_LABELS[ds]}
            variant="secondary"
            disabled={!!exporting}
            onPress={() => exportCsv(ds)}
          />
        ))}
      </Card>
    </Screen>
  );
}
