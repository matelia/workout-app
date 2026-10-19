import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { Slug } from 'react-native-body-highlighter';

import { MuscleMap, MUSCLES } from '@/components/MuscleMap';
import { Button, Chip, ChipRow, Field, Screen, T } from '@/components/ui';
import { EQUIPMENT } from '@/data/exerciseInfo';
import {
  archiveExercise,
  createExercise,
  getExercise,
  MUSCLE_GROUPS,
  updateExercise,
  type VideoType,
} from '@/db/repos/exercises';
import { copyVideoIntoApp, deleteLocalVideo, validateVideo } from '@/lib/video';
import { formatClock, parseClock, withYoutubeStart, youtubeStart } from '@/lib/youtube';
import { space, useColors } from '@/theme';

const VIDEO_OPTIONS: { value: VideoType | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'file', label: 'File' },
];

export default function EditExercise() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const exerciseId = id ? Number(id) : null;
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [videoType, setVideoType] = useState<VideoType | null>(null);
  const [videoValue, setVideoValue] = useState('');
  const [startText, setStartText] = useState('');
  const [originalFile, setOriginalFile] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exerciseId) return;
    getExercise(db, exerciseId).then((e) => {
      if (!e) return;
      setName(e.name);
      setMuscle(e.muscle_group);
      setNotes(e.notes ?? '');
      setVideoType(e.video_type);
      setVideoValue(e.video_url_or_path ?? '');
      const start = e.video_type === 'youtube' ? youtubeStart(e.video_url_or_path ?? '') : 0;
      setStartText(start ? formatClock(start) : '');
      if (e.video_type === 'file') setOriginalFile(e.video_url_or_path);
      setEquipment(e.equipment);
      setPrimary(e.muscles_primary ? JSON.parse(e.muscles_primary) : []);
      setSecondary(e.muscles_secondary ? JSON.parse(e.muscles_secondary) : []);
    });
  }, [db, exerciseId]);

  // Tap cycles a muscle: off → primary → secondary → off.
  function cycleMuscle(slug: string) {
    if (primary.includes(slug)) {
      setPrimary((p) => p.filter((x) => x !== slug));
      setSecondary((s) => [...s, slug]);
    } else if (secondary.includes(slug)) {
      setSecondary((s) => s.filter((x) => x !== slug));
    } else {
      setPrimary((p) => [...p, slug]);
    }
  }

  function chooseVideoType(t: VideoType | null) {
    if (t === videoType) return;
    setVideoType(t);
    setVideoValue(t === 'file' && originalFile ? originalFile : '');
    setError(null);
  }

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    const asset = res.assets[0];
    try {
      const rel = copyVideoIntoApp(asset.uri, asset.name);
      // A file picked earlier in this edit (not yet saved) is no longer needed.
      if (videoValue && videoValue !== originalFile) deleteLocalVideo(videoValue);
      setVideoValue(rel);
      setError(null);
    } catch (e) {
      setError(`Couldn't copy that video: ${String(e)}`);
    }
  }

  async function save() {
    if (!name.trim()) return setError('Give the exercise a name.');
    if (videoType) {
      const err = validateVideo(videoType, videoValue);
      if (err) return setError(err);
    }
    if (videoType === 'youtube' && parseClock(startText) === null) return setError('Start time should look like 1:22 or 45.');
    const input = {
      name: name.trim(),
      muscle_group: muscle,
      notes: notes.trim() || null,
      video_type: videoType,
      video_url_or_path: !videoType
        ? null
        : videoType === 'youtube'
          ? withYoutubeStart(videoValue.trim(), parseClock(startText) ?? 0)
          : videoValue.trim(),
      equipment,
      muscles_primary: primary.length ? JSON.stringify(primary) : null,
      muscles_secondary: secondary.length ? JSON.stringify(secondary) : null,
    };
    if (exerciseId) await updateExercise(db, exerciseId, input);
    else await createExercise(db, input);
    if (originalFile && input.video_url_or_path !== originalFile) deleteLocalVideo(originalFile);
    router.back();
  }

  function remove() {
    if (!exerciseId) return;
    Alert.alert('Remove exercise?', 'It disappears from the library. Logged sets are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await archiveExercise(db, exerciseId);
          router.dismissTo('/library');
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: exerciseId ? 'Edit exercise' : 'New exercise',
        }}
      />

      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Bench Press" autoFocus={!exerciseId} />

      <View style={{ gap: space.sm }}>
        <T variant="label">Muscle group</T>
        <ChipRow>
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m} label={m} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ChipRow>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Equipment</T>
        <ChipRow>
          {EQUIPMENT.map((e) => (
            <Chip key={e} label={e} selected={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
          ))}
        </ChipRow>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Muscles worked (tap: primary → secondary → off)</T>
        <ChipRow>
          {MUSCLES.map((m) => {
            const isPrimary = primary.includes(m.slug);
            const isSecondary = secondary.includes(m.slug);
            return (
              <Pressable
                key={m.slug}
                onPress={() => cycleMuscle(m.slug)}
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isPrimary ? '#FF5A36' : isSecondary ? '#FFB199' : c.border,
                  backgroundColor: isPrimary ? '#FF5A36' : isSecondary ? '#FFB19933' : c.card,
                }}>
                <Text style={{ color: isPrimary ? '#fff' : c.text, fontSize: 14 }}>
                  {m.label}
                  {isSecondary ? ' (2nd)' : ''}
                </Text>
              </Pressable>
            );
          })}
        </ChipRow>
        {primary.length || secondary.length ? (
          <MuscleMap primary={primary as Slug[]} secondary={secondary as Slug[]} />
        ) : null}
      </View>

      <Field
        label="How to do it / notes"
        value={notes}
        onChangeText={setNotes}
        placeholder={'Setup, form cues, seat height…\n1. …\n2. …'}
        multiline
      />

      <View style={{ gap: space.sm }}>
        <T variant="label">Video</T>
        <ChipRow>
          {VIDEO_OPTIONS.map((o) => (
            <Chip key={o.label} label={o.label} selected={videoType === o.value} onPress={() => chooseVideoType(o.value)} />
          ))}
        </ChipRow>
        {videoType === 'youtube' || videoType === 'instagram' ? (
          <Field
            value={videoValue}
            onChangeText={setVideoValue}
            placeholder={videoType === 'youtube' ? 'https://youtu.be/…' : 'https://www.instagram.com/reel/…'}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        ) : null}
        {videoType === 'youtube' ? (
          <Field
            label="Start at (skip the intro)"
            value={startText}
            onChangeText={setStartText}
            placeholder="e.g. 0:54. Empty plays from the start"
            keyboardType="numbers-and-punctuation"
          />
        ) : null}
        {videoType === 'file' ? (
          <>
            <Button title={videoValue ? 'Choose a different video' : 'Choose video file'} variant="secondary" onPress={pickFile} />
            {videoValue ? <T variant="muted">{videoValue.split('/').pop()}</T> : null}
          </>
        ) : null}
      </View>

      {error ? <T style={{ color: c.danger }}>{error}</T> : null}

      <Button title="Save" onPress={save} />
      {exerciseId ? <Button title="Remove from library" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
