import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CUSTOM_EMOTION_ICON, EMOTIONS, MoodFace, MOODS } from '@/components/MoodFace';
import { PickerSheet } from '@/components/pickers';
import { getCheckIn, saveCheckIn } from '@/db/repos/mind';
import { getSetting, setSetting } from '@/db/repos/settings';
import { formatDate, formatDuration, nowLocalIso, parseDate, toDateStr, todayStr } from '@/lib/dates';
import { deleteMedia, extOf, mediaUri, storeMedia } from '@/lib/media';
import { radius, space, useColors } from '@/theme';

const ACCENT = '#19B890';
const ENERGY = ['Drained', 'Low', 'Okay', 'Good', 'High'];

export default function CheckInScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const [date, setDate] = useState(params.date ?? todayStr());
  const [step, setStep] = useState<1 | 2>(1);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState(7);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [customEmotions, setCustomEmotions] = useState<string[]>([]);
  const [emotionsOpen, setEmotionsOpen] = useState(true);
  const [pickingDate, setPickingDate] = useState(false);
  // Media added in this visit; deleted again if the check-in isn't saved.
  const added = useRef<string[]>([]);
  const replaced = useRef<string[]>([]);

  useEffect(() => {
    getCheckIn(db, date).then((x) => {
      setMood(x?.mood ?? null);
      setEnergy(x?.energy ?? null);
      setSleep(x?.sleep_hours ?? 7);
      setTags(x?.tags ? JSON.parse(x.tags) : []);
      setNote(x?.note ?? '');
      setPhoto(x?.photo_path ?? null);
      setAudio(x?.audio_path ?? null);
      setStep(x?.mood ? 2 : 1);
    });
  }, [db, date]);

  useEffect(() => {
    getSetting(db, 'custom_emotions').then((v) => v && setCustomEmotions(JSON.parse(v)));
  }, [db]);

  function close() {
    added.current.forEach(deleteMedia);
    router.back();
  }

  async function save() {
    await saveCheckIn(db, {
      date,
      mood,
      energy,
      sleep_hours: sleep,
      tags: tags.length ? JSON.stringify(tags) : null,
      note: note.trim() || null,
      photo_path: photo,
      audio_path: audio,
      logged_at: nowLocalIso(),
    });
    replaced.current.forEach(deleteMedia);
    router.back();
  }

  function swapMedia(current: string | null, next: string | null, set: (v: string | null) => void) {
    if (current) {
      if (added.current.includes(current)) deleteMedia(current);
      else replaced.current.push(current);
    }
    if (next) added.current.push(next);
    set(next);
  }

  async function addPhoto(from: 'camera' | 'library') {
    if (from === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    swapMedia(photo, storeMedia(res.assets[0].uri, 'checkins', 'jpg'), setPhoto);
  }

  function addEmotion() {
    Alert.prompt('New emotion', undefined, async (t) => {
      const e = t?.trim().toLowerCase();
      if (!e || customEmotions.includes(e) || EMOTIONS.some((x) => x.key === e)) return;
      const next = [...customEmotions, e];
      setCustomEmotions(next);
      setTags((prev) => [...prev, e]);
      await setSetting(db, 'custom_emotions', JSON.stringify(next));
    });
  }

  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const isToday = date === todayStr();
  const dateLabel = `${isToday ? 'Today, ' : ''}${formatDate(date, { month: 'short', day: 'numeric' })}`;

  // ── Step 1: how are you? ──
  if (step === 1) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + space.md }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable onPress={close} style={[styles.roundBtn, { backgroundColor: c.card, marginLeft: space.lg }]} accessibilityLabel="Close">
          <SymbolView name="xmark" tintColor={c.text} size={20} />
        </Pressable>
        <View style={styles.center}>
          <Text style={[styles.h1, { color: c.text }]}>How are you?</Text>
          <Pressable onPress={() => setPickingDate(true)} style={styles.dateLink}>
            <SymbolView name="calendar" tintColor={ACCENT} size={18} />
            <Text style={{ color: ACCENT, fontSize: 17, textDecorationLine: 'underline' }}>{dateLabel}</Text>
          </Pressable>
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <Pressable
                key={m.value}
                onPress={() => {
                  setMood(m.value);
                  setStep(2);
                }}
                style={styles.moodItem}
                accessibilityLabel={m.label}>
                <MoodFace mood={m.value} size={60} dim={mood !== null && mood !== m.value} />
                <Text style={{ color: m.color, fontSize: 16, fontWeight: '500' }}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <PickerSheet
          visible={pickingDate}
          mode="date"
          initial={parseDate(date)}
          onCancel={() => setPickingDate(false)}
          onDone={(d) => {
            setPickingDate(false);
            if (toDateStr(d) <= todayStr()) setDate(toDateStr(d));
          }}
        />
      </View>
    );
  }

  // ── Step 2: what have you been up to? ──
  const allEmotions = [...EMOTIONS, ...customEmotions.map((key) => ({ key, icon: CUSTOM_EMOTION_ICON }))];

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => setStep(1)} style={[styles.pill, { backgroundColor: c.card }]} accessibilityLabel="Change mood">
          <SymbolView name="chevron.left" tintColor={ACCENT} size={18} />
          {mood ? <MoodFace mood={mood} size={34} /> : null}
        </Pressable>
        <Pressable onPress={save} style={[styles.pill, { backgroundColor: c.card }]}>
          <View style={styles.saveDot}>
            <SymbolView name="checkmark" tintColor="#111" size={16} weight="bold" />
          </View>
          <Text style={{ color: ACCENT, fontSize: 17, fontWeight: '600', paddingRight: space.sm }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h2, { color: c.text }]}>What have you been up to?</Text>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Emotions</Text>
            <Pressable onPress={addEmotion} style={[styles.smallRound, { backgroundColor: c.bg }]} accessibilityLabel="Add emotion">
              <SymbolView name="plus" tintColor={ACCENT} size={18} />
            </Pressable>
            <Pressable onPress={() => setEmotionsOpen((o) => !o)} style={[styles.smallRound, { backgroundColor: c.bg }]}>
              <SymbolView name={emotionsOpen ? 'chevron.up' : 'chevron.down'} tintColor={ACCENT} size={16} />
            </Pressable>
          </View>
          {emotionsOpen ? (
            <View style={styles.grid}>
              {allEmotions.map((e) => {
                const on = tags.includes(e.key);
                return (
                  <Pressable key={e.key} onPress={() => toggleTag(e.key)} style={styles.gridItem}>
                    <View style={[styles.iconCircle, { borderColor: on ? ACCENT : c.border, backgroundColor: on ? ACCENT : 'transparent' }]}>
                      <SymbolView name={e.icon} tintColor={on ? '#111' : ACCENT} size={26} />
                    </View>
                    <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={1}>
                      {e.key}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : tags.length ? (
            <Text style={{ color: c.textMuted }}>{tags.join(', ')}</Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Energy</Text>
          <View style={styles.segment}>
            {ENERGY.map((label, i) => {
              const on = energy === i + 1;
              return (
                <Pressable
                  key={label}
                  onPress={() => setEnergy(on ? null : i + 1)}
                  style={[styles.segmentBtn, { backgroundColor: on ? ACCENT : c.bg }]}>
                  <Text style={{ color: on ? '#111' : c.text, fontWeight: '600' }}>{i + 1}</Text>
                  <Text style={{ color: on ? '#111' : c.textMuted, fontSize: 11 }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sleepRow}>
            <Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>Sleep</Text>
            <Pressable onPress={() => setSleep((s) => Math.max(0, s - 0.5))} style={[styles.smallRound, { backgroundColor: c.bg }]}>
              <SymbolView name="minus" tintColor={ACCENT} size={16} />
            </Pressable>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', minWidth: 64, textAlign: 'center' }}>{sleep} h</Text>
            <Pressable onPress={() => setSleep((s) => Math.min(16, s + 0.5))} style={[styles.smallRound, { backgroundColor: c.bg }]}>
              <SymbolView name="plus" tintColor={ACCENT} size={16} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <SymbolView name="note.text" tintColor={c.text} size={20} />
          <Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>Quick Note</Text>
          <Pressable onPress={() => router.push('/mind/journal/new')}>
            <Text style={{ color: ACCENT, fontSize: 16 }}>Open Full Note</Text>
          </Pressable>
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add Note..."
          placeholderTextColor={c.textMuted}
          maxLength={200}
          style={[styles.noteInput, { backgroundColor: c.card, color: c.text }]}
        />

        <View style={styles.sectionHeader}>
          <SymbolView name="camera.fill" tintColor={c.text} size={20} />
          <Text style={[styles.cardTitle, { color: c.text }]}>Photo</Text>
        </View>
        {photo ? (
          <View>
            <Image source={{ uri: mediaUri(photo) }} style={styles.photo} contentFit="cover" />
            <Pressable onPress={() => swapMedia(photo, null, setPhoto)} style={[styles.removeBadge, { backgroundColor: c.card }]}>
              <SymbolView name="trash" tintColor={c.danger} size={16} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.twoBtns}>
            <Pressable onPress={() => addPhoto('camera')} style={[styles.bigBtn, { backgroundColor: c.card }]}>
              <SymbolView name="camera" tintColor={c.text} size={22} />
              <Text style={{ color: c.text, fontSize: 16 }}>Take Photo</Text>
            </Pressable>
            <Pressable onPress={() => addPhoto('library')} style={[styles.bigBtn, { backgroundColor: c.card }]}>
              <SymbolView name="photo.on.rectangle" tintColor={c.text} size={22} />
              <Text style={{ color: c.text, fontSize: 16 }}>From Gallery</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <SymbolView name="mic.fill" tintColor={c.text} size={20} />
          <Text style={[styles.cardTitle, { color: c.text }]}>Voice Memo</Text>
        </View>
        <VoiceMemo
          path={audio}
          onRecorded={(uri) => swapMedia(audio, storeMedia(uri, 'checkins', extOf(uri, 'm4a')), setAudio)}
          onDelete={() => swapMedia(audio, null, setAudio)}
        />
      </ScrollView>
    </View>
  );
}

function VoiceMemo({ path, onRecorded, onDelete }: { path: string | null; onRecorded: (uri: string) => void; onDelete: () => void }) {
  const c = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  async function start() {
    if (!(await requestRecordingPermissionsAsync()).granted) {
      Alert.alert('Microphone access is needed to record a voice memo.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setSeconds(0);
    setRecording(true);
  }

  async function stop() {
    await recorder.stop();
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (recorder.uri) onRecorded(recorder.uri);
  }

  if (path && !recording) return <Playback path={path} onDelete={onDelete} />;

  return (
    <Pressable onPress={recording ? stop : start} style={[styles.bigBtn, { backgroundColor: c.card, flex: 0 }]}>
      <View style={[styles.recDot, { backgroundColor: recording ? '#E81E3A' : ACCENT }]}>
        <SymbolView name={recording ? 'stop.fill' : 'mic.fill'} tintColor="#111" size={18} />
      </View>
      <Text style={{ color: c.text, fontSize: 16 }}>{recording ? `Recording ${formatDuration(seconds)} · tap to stop` : 'Tap to Record'}</Text>
    </Pressable>
  );
}

function Playback({ path, onDelete }: { path: string; onDelete: () => void }) {
  const c = useColors();
  const player = useAudioPlayer(mediaUri(path));
  const status = useAudioPlayerStatus(player);
  return (
    <View style={[styles.bigBtn, { backgroundColor: c.card, flex: 0 }]}>
      <Pressable
        onPress={() => {
          if (status.playing) player.pause();
          else {
            if (status.didJustFinish || status.currentTime >= status.duration) player.seekTo(0);
            player.play();
          }
        }}
        style={[styles.recDot, { backgroundColor: ACCENT }]}>
        <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} tintColor="#111" size={18} />
      </Pressable>
      <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>
        Voice memo · {formatDuration(status.playing ? status.currentTime : status.duration)}
      </Text>
      <Pressable onPress={onDelete} hitSlop={8}>
        <SymbolView name="trash" tintColor={c.danger} size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: 80 },
  h1: { fontSize: 32, fontWeight: '700' },
  h2: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginVertical: space.md },
  dateLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  moodRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignSelf: 'stretch', marginTop: space.xl, paddingHorizontal: space.sm },
  moodItem: { alignItems: 'center', gap: space.sm },
  roundBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999 },
  saveDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  card: { borderRadius: radius.lg + 4, padding: space.lg, gap: space.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { fontSize: 18, fontWeight: '500' },
  smallRound: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  gridItem: { width: '20%', alignItems: 'center', gap: 6 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', gap: space.sm },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md },
  sleepRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  noteInput: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.lg, fontSize: 17 },
  twoBtns: { flexDirection: 'row', gap: space.md },
  bigBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.lg, paddingHorizontal: space.lg, borderRadius: radius.md },
  photo: { width: '100%', height: 220, borderRadius: radius.md },
  removeBadge: { position: 'absolute', top: space.sm, right: space.sm, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  recDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
