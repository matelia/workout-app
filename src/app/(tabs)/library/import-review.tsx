import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Stepper } from '@/components/Stepper';
import { Button, Card, Field, Screen, T } from '@/components/ui';
import { createExercise, listExercises, MUSCLE_GROUPS, type Exercise } from '@/db/repos/exercises';
import { addExercisesToRoutine, createRoutine, listRoutineExercises, updateTargets } from '@/db/repos/routines';
import { getJob, jobPhotos, setJobStatus, type SnapshotJob } from '@/db/repos/snapshots';
import { mediaUri } from '@/lib/media';
import { radius, space, useColors } from '@/theme';

type Item = {
  name: string;
  library_match: string | null;
  sets: number | null;
  reps: number | null;
  muscle_group: string | null;
  equipment: string | null;
  notes: string | null;
};
type Out = { title: string; summary: string; exercises: Item[] };
type Row = Item & { keep: boolean; useId: number | null };

/** Review a workout read from an Instagram post: map to your library or add new exercises, optionally as a routine. */
export default function InstagramImportReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [job, setJob] = useState<SnapshotJob | null>(null);
  const [ctx, setCtx] = useState<{ url?: string; caption?: string; author?: string | null }>({});
  const [summary, setSummary] = useState('');
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [asRoutine, setAsRoutine] = useState(true);

  useEffect(() => {
    (async () => {
      const j = await getJob(db, Number(id));
      if (!j?.model_output_json) return;
      const lib = await listExercises(db);
      const out = JSON.parse(j.model_output_json) as Out;
      setJob(j);
      setLibrary(lib);
      setCtx(j.context ? JSON.parse(j.context) : {});
      setTitle(out.title);
      setSummary(out.summary);
      setRows(
        out.exercises.map((e) => ({
          ...e,
          keep: true,
          useId: e.library_match ? (lib.find((x) => x.name === e.library_match)?.id ?? null) : null,
        })),
      );
    })();
  }, [db, id]);

  const patch = (i: number, p: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...p } : r)));

  function chooseMatch(i: number) {
    const r = rows[i];
    const q = r.name.toLowerCase().split(/\s+/)[0] ?? '';
    // Similar names first, then the rest of the library.
    const options = [...library].sort((a, b) => Number(b.name.toLowerCase().includes(q)) - Number(a.name.toLowerCase().includes(q))).slice(0, 12);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: `“${r.name}”`, options: [`Add as new exercise`, ...options.map((o) => `Use: ${o.name}`), 'Cancel'], cancelButtonIndex: options.length + 1 },
      (k) => {
        if (k === 0) patch(i, { useId: null });
        else if (k <= options.length) patch(i, { useId: options[k - 1].id });
      },
    );
  }

  async function save() {
    if (!job) return;
    const ids: { id: number; sets: number; reps: number }[] = [];
    for (const r of rows.filter((x) => x.keep && x.name.trim())) {
      let exId = r.useId;
      if (!exId) {
        exId = await createExercise(db, {
          name: r.name.trim(),
          muscle_group: MUSCLE_GROUPS.includes(r.muscle_group as never) ? r.muscle_group : null,
          notes: r.notes ?? null,
          video_type: ctx.url ? 'instagram' : null,
          video_url_or_path: ctx.url ?? null,
          equipment: r.equipment,
          muscles_primary: null,
          muscles_secondary: null,
        });
      }
      ids.push({ id: exId, sets: r.sets ?? 3, reps: r.reps ?? 10 });
    }
    let routineId: number | null = null;
    if (asRoutine && ids.length) {
      routineId = await createRoutine(db, title.trim() || 'Instagram workout');
      await addExercisesToRoutine(db, routineId, ids.map((x) => x.id));
      const saved = await listRoutineExercises(db, routineId);
      for (let k = 0; k < saved.length; k++) await updateTargets(db, saved[k].id, ids[k].sets, ids[k].reps);
    }
    await setJobStatus(db, job.id, 'done');
    if (routineId) router.replace(`/workouts/routine/${routineId}`);
    else router.back();
  }

  if (!job) return null;
  const thumb = jobPhotos(job).find(Boolean);
  const kept = rows.filter((r) => r.keep).length;

  return (
    <Screen>
      {thumb ? <Image source={{ uri: mediaUri(thumb) }} style={styles.thumb} contentFit="cover" /> : null}
      {ctx.author ? <T variant="muted">@{ctx.author}</T> : null}
      {summary ? <T>{summary}</T> : null}
      {rows.length === 0 ? (
        <T style={{ color: c.danger }}>
          No exercises found in this post’s caption. Try again with “Add screenshots too” and a few frames from the video.
        </T>
      ) : null}

      {rows.map((r, i) => {
        const match = r.useId ? library.find((x) => x.id === r.useId) : null;
        return (
          <Card key={i} style={{ opacity: r.keep ? 1 : 0.5, gap: space.sm }}>
            <View style={styles.rowHead}>
              <Pressable hitSlop={8} onPress={() => patch(i, { keep: !r.keep })}>
                <SymbolView name={r.keep ? 'checkmark.circle.fill' : 'circle'} tintColor={r.keep ? c.accent : c.textMuted} size={24} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Field value={r.name} onChangeText={(v) => patch(i, { name: v })} />
              </View>
            </View>
            <Pressable onPress={() => chooseMatch(i)}>
              <T style={{ color: match ? c.success : c.accent }}>
                {match ? `Uses your “${match.name}” ✓ (change)` : `New exercise${r.equipment ? ` · ${r.equipment}` : ''} (tap to use one of yours)`}
              </T>
            </Pressable>
            <View style={styles.targets}>
              <Stepper value={r.sets ?? 3} max={10} suffix="sets" onChange={(v) => patch(i, { sets: v })} />
              <Stepper value={r.reps ?? 10} max={50} suffix="reps" onChange={(v) => patch(i, { reps: v })} />
            </View>
            {r.notes ? <T variant="muted">{r.notes}</T> : null}
          </Card>
        );
      })}

      {rows.length ? (
        <Card>
          <View style={styles.rowHead}>
            <T style={{ flex: 1 }}>Save as a routine</T>
            <Switch value={asRoutine} onValueChange={setAsRoutine} />
          </View>
          {asRoutine ? <Field value={title} onChangeText={setTitle} placeholder="Routine name" /> : null}
        </Card>
      ) : null}
      <Button title={`Save ${kept} exercise${kept === 1 ? '' : 's'}`} onPress={save} disabled={!kept} />
      {ctx.caption ? (
        <Card>
          <T variant="label">Caption</T>
          <T variant="muted">{ctx.caption}</T>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: { width: '100%', height: 260, borderRadius: radius.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  targets: { flexDirection: 'row', justifyContent: 'space-between' },
});
