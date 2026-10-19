import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { getTargets, saveTargets } from '@/db/repos/food';
import { getSetting, setSetting } from '@/db/repos/settings';
import { createBackup, restoreBackup } from '@/lib/backup';
import { syncCareReminders, syncPhotoReminder, syncWorkoutReminders } from '@/lib/notifications';
import { checkServer } from '@/lib/snapshotClient';
import { space, useColors } from '@/theme';

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
};

export default function FoodSettings() {
  const db = useSQLiteContext();
  const c = useColors();
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [satFat, setSatFat] = useState('');
  const [sodium, setSodium] = useState('');
  const [usdaKey, setUsdaKey] = useState('');
  // The saved key is never shown in full; editing starts empty.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const [rest, setRest] = useState('90');
  const [stepsGoal, setStepsGoal] = useState('10000');
  const [moveGoal, setMoveGoal] = useState('500');
  const [step, setStep] = useState('5');
  const [water, setWater] = useState('100');
  const [serverUrl, setServerUrl] = useState('');
  const [serverToken, setServerToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [backupBusy, setBackupBusy] = useState<'backup' | 'restore' | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [check, setCheck] = useState<{ busy: boolean; msg: string | null; ok?: boolean }>({ busy: false, msg: null });

  useEffect(() => {
    getTargets(db).then((t) => {
      setKcal(t.kcal?.toString() ?? '');
      setProtein(t.protein_g?.toString() ?? '');
      setCarbs(t.carbs_g?.toString() ?? '');
      setFat(t.fat_g?.toString() ?? '');
      setFiber(t.fiber_g?.toString() ?? '');
      setSugar(t.sugar_g?.toString() ?? '');
      setSatFat(t.sat_fat_g?.toString() ?? '');
      setSodium(t.sodium_mg?.toString() ?? '');
    });
    getSetting(db, 'usda_api_key').then(setSavedKey);
    getSetting(db, 'rest_seconds').then((v) => v && setRest(v));
    getSetting(db, 'steps_goal').then((v) => v && setStepsGoal(v));
    getSetting(db, 'move_goal').then((v) => v && setMoveGoal(v));
    getSetting(db, 'overload_step').then((v) => v && setStep(v));
    getSetting(db, 'water_goal').then((v) => v && setWater(v));
    getSetting(db, 'snapshot_server_url').then((v) => setServerUrl(v ?? ''));
    getSetting(db, 'snapshot_server_token').then((v) => setServerToken(v ?? ''));
  }, [db]);

  async function save() {
    await saveTargets(db, {
      kcal: num(kcal),
      protein_g: num(protein),
      carbs_g: num(carbs),
      fat_g: num(fat),
      fiber_g: num(fiber),
      sugar_g: num(sugar),
      sat_fat_g: num(satFat),
      sodium_mg: num(sodium),
    });
    if (usdaKey.trim()) {
      await setSetting(db, 'usda_api_key', usdaKey.trim());
      setSavedKey(usdaKey.trim());
      setUsdaKey('');
      setEditingKey(false);
    }
    await setSetting(db, 'rest_seconds', String(num(rest) ?? 90));
    await setSetting(db, 'steps_goal', String(num(stepsGoal) ?? 10000));
    await setSetting(db, 'move_goal', String(num(moveGoal) ?? 500));
    await setSetting(db, 'overload_step', String(num(step) ?? 5));
    await setSetting(db, 'water_goal', String(num(water) ?? 100));
    await setSetting(db, 'snapshot_server_url', serverUrl.trim().replace(/\/+$/, '') || null);
    await setSetting(db, 'snapshot_server_token', serverToken.trim() || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function backup() {
    setBackupBusy('backup');
    setBackupMsg(null);
    try {
      const name = await createBackup(db);
      setBackupMsg({ ok: true, text: `Saved “${name}”.` });
    } catch (e) {
      setBackupMsg({ ok: false, text: `Backup failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBackupBusy(null);
    }
  }

  function restore() {
    Alert.alert('Restore from a backup?', 'This replaces everything currently in the app with the backup. Pick the “Steady backup …” folder.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        style: 'destructive',
        onPress: async () => {
          setBackupBusy('restore');
          setBackupMsg(null);
          try {
            const counts = await restoreBackup(db);
            await syncWorkoutReminders(db);
            await syncCareReminders(db);
            await syncPhotoReminder(db);
            const n = Object.values(counts).reduce((a, b) => a + b, 0);
            setBackupMsg({ ok: true, text: `Restored ${n.toLocaleString()} records. Close and reopen the app to refresh every screen.` });
          } catch (e) {
            setBackupMsg({ ok: false, text: `Restore failed: ${e instanceof Error ? e.message : String(e)}` });
          } finally {
            setBackupBusy(null);
          }
        },
      },
    ]);
  }

  async function test() {
    setCheck({ busy: true, msg: null });
    await save();
    const r = await checkServer(db);
    setCheck({ busy: false, msg: r.message, ok: r.ok });
  }

  const pair = (a: [string, string, (s: string) => void], b: [string, string, (s: string) => void]) => (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {[a, b].map(([label, value, set]) => (
        <View key={label} style={{ flex: 1 }}>
          <Field label={label} value={value} onChangeText={set} keyboardType="decimal-pad" />
        </View>
      ))}
    </View>
  );

  return (
    <Screen>
      <Card>
        <T variant="heading">Daily targets</T>
        {pair(['Calories (kcal)', kcal, setKcal], ['Protein (g)', protein, setProtein])}
        {pair(['Carbs (g)', carbs, setCarbs], ['Fat (g)', fat, setFat])}
      </Card>

      <Card>
        <T variant="heading">Healthy-eating goal & limits</T>
        <T variant="muted">
          Fiber is a minimum to reach; sugar, saturated fat and sodium are daily maximums. Defaults follow the US Dietary
          Guidelines for a ~2,000 kcal day. Leave a field empty to stop tracking it.
        </T>
        {pair(['Fiber, at least (g)', fiber, setFiber], ['Sugar, at most (g)', sugar, setSugar])}
        {pair(['Sat. fat, at most (g)', satFat, setSatFat], ['Sodium, at most (mg)', sodium, setSodium])}
      </Card>

      <Card>
        <T variant="heading">USDA FoodData Central</T>
        {savedKey && !editingKey ? (
          <>
            <T style={{ color: c.success }}>Key saved ✓ (ends in {savedKey.slice(-4)})</T>
            <Button title="Change key" variant="secondary" onPress={() => setEditingKey(true)} />
          </>
        ) : (
          <>
            <T variant="muted">
              Without a key, search uses a shared demo key that allows only about 10 searches an hour. A personal key is free
              (1,000 an hour) and takes a minute to get by email.
            </T>
            <Field value={usdaKey} onChangeText={setUsdaKey} placeholder="Paste your API key" autoCapitalize="none" autoCorrect={false} />
            {!savedKey ? (
              <Button title="Get a free key" variant="secondary" onPress={() => Linking.openURL('https://fdc.nal.usda.gov/api-key-signup')} />
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <T variant="heading">Home laptop (snapshots and coach)</T>
        <T variant="muted">
          Your laptop’s Tailscale address and port, e.g. http://laptop:8000 or http://100.x.y.z:8000. Snapshot photos and coach
          questions go there. Mind data never does.
        </T>
        <Field value={serverUrl} onChangeText={setServerUrl} placeholder="http://laptop:8000" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Field value={serverToken} onChangeText={setServerToken} placeholder="Shared token (from server .env)" autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <Button title="Test connection" variant="secondary" onPress={test} />
        {check.busy ? <ActivityIndicator /> : null}
        {check.msg ? <T style={{ color: check.ok ? c.success : c.danger }}>{check.msg}</T> : null}
      </Card>

      <Card>
        <T variant="heading">Workouts and activity</T>
        {pair(['Rest timer (seconds)', rest, setRest], ['Steps goal', stepsGoal, setStepsGoal])}
        {pair(['Move goal (active kcal)', moveGoal, setMoveGoal], ['Progression step (lb)', step, setStep])}
        <Field label="Water goal (fl oz)" value={water} onChangeText={setWater} keyboardType="number-pad" />
        <T variant="muted">
          Progression: when you hit every target set and rep, the next workout pre-fills this much more weight.
        </T>
        <T variant="muted">Steps and active calories come from Apple Health in the installed app.</T>
      </Card>

      <Button title={saved ? 'Saved ✓' : 'Save'} onPress={save} />

      <Card>
        <T variant="heading">Backup</T>
        <T variant="muted">
          Saves everything (workouts, food, Mind, photos, voice memos) to a folder you pick, like iCloud Drive. Do this before
          reinstalling, and now and then. Deleting the app deletes its data.
        </T>
        <Button title={backupBusy === 'backup' ? 'Backing up…' : 'Back up now'} variant="secondary" disabled={!!backupBusy} onPress={backup} />
        <Button title={backupBusy === 'restore' ? 'Restoring…' : 'Restore from a backup'} variant="secondary" disabled={!!backupBusy} onPress={restore} />
        {backupMsg ? <T style={{ color: backupMsg.ok ? c.success : c.danger }}>{backupMsg.text}</T> : null}
      </Card>
    </Screen>
  );
}
