import { Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Stepper } from '@/components/Stepper';
import { Button, Card, Chip, ChipRow, Field, T } from '@/components/ui';
import { addMessage, clearChat, getGoals, listMessages, saveGoals, type CoachMessage, type Goals, type PlanProposal } from '@/db/repos/coach';
import { answerMessage, applyPlan } from '@/lib/coach';
import { WEEKDAYS_LONG } from '@/lib/dates';
import { isServerOnline } from '@/lib/snapshotClient';
import { fonts, radius, space, useColors } from '@/theme';

const GOALS = ['Build muscle', 'Lose fat', 'Get stronger', 'General fitness'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const QUICK = [
  { label: 'Build me a plan', text: 'Build me a weekly workout plan for my goals.', kind: 'plan' as const },
  { label: 'How am I progressing?', text: 'How am I progressing? Look at my lifts, body weight and nutrition.', kind: 'chat' as const },
  { label: 'Am I eating right?', text: 'Is my nutrition supporting my goal? What should I change?', kind: 'chat' as const },
  { label: 'Explain my routine', text: 'Explain why my current routines are set up the way they are and what each exercise is for.', kind: 'chat' as const },
];

export default function CoachScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [goals, setGoals] = useState<Goals | null | undefined>(undefined);
  const [editingGoals, setEditingGoals] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);

  const reload = useCallback(async () => {
    setMessages(await listMessages(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
      getGoals(db).then(setGoals);
      isServerOnline(db).then(setOnline);
    }, [db, reload]),
  );

  // Refresh while queued answers might arrive in the background.
  useEffect(() => {
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  async function send(body: string, kind: 'chat' | 'plan' = 'chat') {
    const msg = body.trim();
    if (!msg || thinking) return;
    setText('');
    const id = await addMessage(db, { role: 'user', kind, text: msg, status: 'queued' });
    await reload();
    setThinking(true);
    const all = await listMessages(db);
    const mine = all.find((m) => m.id === id)!;
    const r = await answerMessage(db, mine, false);
    setThinking(false);
    if (r === 'unreachable') setOnline(false);
    else setOnline(true);
    await reload();
  }

  if (goals === undefined) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding" keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: 'Coach' }} />
      {online === false ? (
        <View style={[styles.banner, { backgroundColor: c.card2 }]}>
          <SymbolView name="wifi.slash" tintColor={c.warning} size={16} />
          <T variant="muted" style={{ flex: 1 }}>
            Laptop offline. Your messages wait here and send when it’s back; you’ll get a notification with the answer.
          </T>
        </View>
      ) : null}

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardDismissMode="interactive">
        {!goals || editingGoals ? (
          <GoalsCard
            initial={goals}
            onSave={async (g) => {
              await saveGoals(db, g);
              setGoals(g);
              setEditingGoals(false);
            }}
          />
        ) : (
          <Pressable onPress={() => setEditingGoals(true)}>
            <Card>
              <T variant="label">Your goals · tap to edit</T>
              <T>
                {goals.goal} · {goals.experience} · {goals.daysPerWeek} days/week · {goals.minutes} min
              </T>
              {goals.notes ? <T variant="muted">{goals.notes}</T> : null}
            </Card>
          </Pressable>
        )}

        {messages.length === 0 && goals ? (
          <T variant="muted" style={{ textAlign: 'center' }}>
            Ask about your training, food or progress. The coach sees your workouts, nutrition and body data, never your Mind
            entries.
          </T>
        ) : null}

        {messages.map((m) => (
          <Bubble key={m.id} m={m} onRetry={() => answerMessage(db, m, false).then(reload)} onChanged={reload} />
        ))}
        {thinking ? (
          <View style={[styles.bubble, styles.left, { backgroundColor: c.card }]}>
            <T variant="muted">Thinking… (the laptop can take a minute)</T>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { borderTopColor: c.border, paddingBottom: insets.bottom + space.sm, backgroundColor: c.bg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {QUICK.map((q) => (
            <Chip key={q.label} label={q.label} onPress={() => send(q.text, q.kind)} />
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask your coach…"
            placeholderTextColor={c.textMuted}
            multiline
            style={[styles.input, { backgroundColor: c.card, color: c.text }]}
          />
          <Pressable
            onPress={() => send(text)}
            accessibilityLabel="Send"
            style={[styles.send, { backgroundColor: text.trim() ? c.accent : c.card2 }]}>
            <SymbolView name="arrow.up" tintColor={text.trim() ? c.accentText : c.textMuted} size={20} weight="bold" />
          </Pressable>
        </View>
        {messages.length ? (
          <Pressable
            onPress={() =>
              Alert.alert('Clear the conversation?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: () => clearChat(db).then(reload) },
              ])
            }>
            <T variant="muted" style={{ textAlign: 'center' }}>
              Clear chat
            </T>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ m, onRetry, onChanged }: { m: CoachMessage; onRetry: () => void; onChanged: () => void }) {
  const db = useSQLiteContext();
  const c = useColors();
  const mine = m.role === 'user';
  const plan: (PlanProposal & { applied?: boolean }) | null = m.payload ? JSON.parse(m.payload) : null;

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
      <View style={[styles.bubble, mine ? styles.right : styles.left, { backgroundColor: mine ? c.accent : c.card }]}>
        <Text style={{ color: mine ? c.accentText : c.text, fontSize: 16, lineHeight: 22 }}>{m.text}</Text>
        {plan ? (
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {plan.routines.map((r, i) => (
              <View key={i} style={[styles.planDay, { backgroundColor: c.card2 }]}>
                <Text style={{ color: c.accent, fontFamily: fonts.displayBold, fontSize: 16 }}>
                  {WEEKDAYS_LONG[r.weekday].toUpperCase()} · {r.name}
                </Text>
                {r.exercises.map((e, j) => (
                  <T key={j} variant="muted">
                    {e.name} · {e.sets}×{e.reps}
                  </T>
                ))}
              </View>
            ))}
            {plan.applied ? (
              <T style={{ color: c.success }}>Added to your routines and schedule ✓</T>
            ) : (
              <Button
                title="Create these routines"
                onPress={async () => {
                  await applyPlan(db, plan);
                  await db.runAsync('UPDATE coach_message SET payload = ? WHERE id = ?', JSON.stringify({ ...plan, applied: true }), m.id);
                  onChanged();
                }}
              />
            )}
          </View>
        ) : null}
      </View>
      {mine && m.status !== 'done' ? (
        m.status === 'error' ? (
          <Pressable onPress={onRetry}>
            <T style={{ color: c.danger, fontSize: 12 }}>Failed: {m.error ?? 'error'}. Tap to retry</T>
          </Pressable>
        ) : (
          <T variant="muted" style={{ fontSize: 12 }}>
            {m.status === 'queued' ? 'Waiting for the laptop' : 'Sending…'}
          </T>
        )
      ) : null}
    </View>
  );
}

function GoalsCard({ initial, onSave }: { initial: Goals | null; onSave: (g: Goals) => void }) {
  const [goal, setGoal] = useState(initial?.goal ?? GOALS[0]);
  const [experience, setExperience] = useState(initial?.experience ?? LEVELS[1]);
  const [days, setDays] = useState(initial?.daysPerWeek ?? 3);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 60);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  return (
    <Card style={{ gap: space.md }}>
      <T variant="heading">What are you training for?</T>
      <ChipRow>
        {GOALS.map((g) => (
          <Chip key={g} label={g} selected={goal === g} onPress={() => setGoal(g)} />
        ))}
      </ChipRow>
      <T variant="label">Experience</T>
      <ChipRow>
        {LEVELS.map((l) => (
          <Chip key={l} label={l} selected={experience === l} onPress={() => setExperience(l)} />
        ))}
      </ChipRow>
      <View style={styles.stepRow}>
        <T style={{ flex: 1 }}>Days per week</T>
        <Stepper value={days} min={1} max={7} onChange={setDays} />
      </View>
      <View style={styles.stepRow}>
        <T style={{ flex: 1 }}>Minutes per session</T>
        <Stepper value={minutes / 15} min={1} max={8} onChange={(v) => setMinutes(v * 15)} format={(v) => String(v * 15)} />
      </View>
      <Field
        label="Anything else? (injuries, equipment, likes)"
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. Bad left shoulder; gym has full equipment; want bigger back"
        multiline
      />
      <Button title="Save goals" onPress={() => onSave({ goal, experience, daysPerWeek: days, minutes, notes })} />
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, marginHorizontal: space.lg, marginTop: space.sm, borderRadius: radius.md },
  list: { padding: space.lg, gap: space.md },
  bubble: { maxWidth: '88%', padding: space.md, borderRadius: radius.lg },
  left: { borderBottomLeftRadius: 4 },
  right: { borderBottomRightRadius: 4 },
  planDay: { borderRadius: radius.sm, padding: space.sm, gap: 2 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { flex: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12, fontSize: 16, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
});
