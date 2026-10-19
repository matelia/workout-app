import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { Button, Card, Chip, ChipRow, Field, Screen, T } from '@/components/ui';
import {
  deleteMetric,
  latestMetrics,
  listMetrics,
  METRIC_FIELDS,
  METRIC_LABELS,
  upsertMetric,
  type MetricField,
} from '@/db/repos/bodyMetrics';
import { getSetting } from '@/db/repos/settings';
import { useDbQuery } from '@/hooks/useDbQuery';
import { formatDate, formatTime, nowLocalIso } from '@/lib/dates';
import { healthAvailable, syncHealth } from '@/lib/health';
import { parseRenphoCsv } from '@/lib/renpho';
import { radius, space, useColors } from '@/theme';

const SOURCE_LABEL = { health: 'Apple Health', renpho: 'Renpho CSV', manual: 'Manual' } as const;

export default function BodyMetrics() {
  const db = useSQLiteContext();
  const c = useColors();
  const { data: rows, reload } = useDbQuery((d) => listMetrics(d, 365));
  const { data: latest, reload: reloadLatest } = useDbQuery(latestMetrics);
  const { data: lastSync, reload: reloadSync } = useDbQuery((d) => getSetting(d, 'health_last_sync'));
  const [field, setField] = useState<MetricField>('weight_lb');
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = () => Promise.all([reload(), reloadLatest(), reloadSync()]);
  const available = METRIC_FIELDS.filter((f) => latest?.[f]);
  const points = (rows ?? [])
    .filter((r) => r[field] !== null)
    .map((r) => ({ label: formatDate(r.date, { month: 'short', day: 'numeric' }), value: r[field]! }));

  async function sync() {
    setBusy('health');
    const r = await syncHealth(db);
    setMsg({ ok: r.ok, text: r.message });
    setBusy(null);
    refresh();
  }

  async function importCsv() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    setBusy('csv');
    try {
      const { rows: parsed, columns } = parseRenphoCsv(await new File(res.assets[0].uri).text());
      for (const r of parsed) await upsertMetric(db, r);
      setMsg({
        ok: parsed.length > 0,
        text: parsed.length
          ? `Imported ${parsed.length} measurements (${columns.map((f) => METRIC_LABELS[f].label).join(', ')}).`
          : 'No measurements found in that file.',
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(null);
    refresh();
  }

  async function logWeight() {
    const w = parseFloat(weight.replace(',', '.'));
    if (!(w > 0)) return;
    await upsertMetric(db, { measured_at: nowLocalIso(), source: 'manual', weight_lb: w });
    setWeight('');
    refresh();
  }

  return (
    <Screen>
      {available.length ? (
        <View style={styles.tiles}>
          {available.map((f) => (
            <Pressable
              key={f}
              onPress={() => setField(f)}
              style={[styles.tile, { backgroundColor: c.card, borderColor: field === f ? c.accent : c.border }]}>
              <T variant="muted">{METRIC_LABELS[f].label}</T>
              <T variant="heading">
                {latest![f]!.value}
                <T variant="muted"> {METRIC_LABELS[f].unit}</T>
              </T>
            </Pressable>
          ))}
        </View>
      ) : (
        <T variant="muted">No body data yet. Sync Apple Health, import a Renpho CSV, or log your weight below.</T>
      )}

      {available.length ? (
        <Card>
          <ChipRow>
            {available.map((f) => (
              <Chip key={f} label={METRIC_LABELS[f].label} selected={field === f} onPress={() => setField(f)} />
            ))}
          </ChipRow>
          <LineChart data={points} />
          <T variant="muted">Smart-scale body composition is an estimate. Watch the trend, not single readings.</T>
        </Card>
      ) : null}

      <Card>
        <T variant="heading">Apple Health</T>
        <T variant="muted">
          Reads weight, body fat, lean body mass and BMI. Turn on Apple Health sync in the Renpho app and its weigh-ins will
          show up here.
        </T>
        {healthAvailable ? (
          <>
            <Button title={busy === 'health' ? 'Syncing…' : lastSync ? 'Sync now' : 'Connect Apple Health'} onPress={sync} disabled={!!busy} />
            {lastSync ? <T variant="muted">Last synced {new Date(lastSync).toLocaleString()}</T> : null}
          </>
        ) : (
          <T style={{ color: c.textMuted }}>Not available in Expo Go. It works in the installed app (Phase 6 build).</T>
        )}
      </Card>

      <Card>
        <T variant="heading">Renpho CSV</T>
        <T variant="muted">
          Apple Health doesn&apos;t store skeletal muscle, muscle mass, visceral fat, body water, bone mass, BMR or metabolic age.
          To get those, export your data from the Renpho Health app, save the file to Files, and import it here. Re-importing
          is safe: duplicates are merged.
        </T>
        <Button title={busy === 'csv' ? 'Importing…' : 'Import Renpho CSV'} variant="secondary" onPress={importCsv} disabled={!!busy} />
      </Card>

      {busy ? <ActivityIndicator /> : null}
      {msg ? <T style={{ color: msg.ok ? c.success : c.danger }}>{msg.text}</T> : null}

      <Card>
        <T variant="heading">Log weight</T>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Weight (lb)" />
          </View>
          <Button title="Log" onPress={logWeight} />
        </View>
      </Card>

      {rows?.length ? <T variant="label">Recent measurements (long-press to delete)</T> : null}
      {rows
        ?.slice(-15)
        .reverse()
        .map((r) => (
          <Pressable
            key={r.id}
            onLongPress={() =>
              Alert.alert('Delete this measurement?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteMetric(db, r.id);
                    refresh();
                  },
                },
              ])
            }
            style={[styles.row, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <T>
                {formatDate(r.date)} {formatTime(r.measured_at.slice(11, 16))}
              </T>
              <T variant="muted">{SOURCE_LABEL[r.source] ?? r.source}</T>
            </View>
            <T variant="muted" style={{ textAlign: 'right' }}>
              {[r.weight_lb && `${r.weight_lb} lb`, r.body_fat_pct && `${r.body_fat_pct}% fat`, r.skeletal_muscle_pct && `${r.skeletal_muscle_pct}% SM`]
                .filter(Boolean)
                .join(' · ')}
            </T>
          </Pressable>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '48%', padding: space.md, borderRadius: radius.md, borderWidth: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
