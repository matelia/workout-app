import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, T } from '@/components/ui';
import { setSetting } from '@/db/repos/settings';
import { FEATURES, useFeatures } from '@/lib/features';
import { syncAllReminders } from '@/lib/notifications';
import { fonts, radius, space, useColors } from '@/theme';

type Page = { icon: SFSymbol; kicker: string; title: string; points: string[] };

const PAGES: Page[] = [
  {
    icon: 'figure.strengthtraining.traditional',
    kicker: 'Welcome',
    title: 'Steady',
    points: [
      'Workouts, food and self-care in one app.',
      'Everything is saved on this iPhone. Nothing needs an account.',
      'This quick tour takes a minute. You can skip it and open it again any time from Settings.',
    ],
  },
  {
    icon: 'dumbbell.fill',
    kicker: 'Workouts',
    title: 'Plan it, then just tap',
    points: [
      'Library: every exercise with how-to steps, a video and the muscles it works. Import workouts from Instagram links.',
      'Workouts: build routines and put them on a weekly schedule with reminders.',
      'During a workout each set is pre-filled from last time. Tap to check it off; the rest timer starts on its own.',
    ],
  },
  {
    icon: 'fork.knife',
    kicker: 'Food',
    title: 'Log without the typing',
    points: [
      'Scan a barcode, snap a label or a meal, or pick from your groceries, restaurants and cookbook.',
      'Snapshots are read by your laptop at home and wait in a queue when it’s off.',
      'Set calorie, protein and healthy-eating targets in Settings.',
    ],
  },
  {
    icon: 'brain.head.profile',
    kicker: 'Mind',
    title: 'Private by design',
    points: [
      'Daily check-ins, a journal, therapy notes and care items like meds or skincare.',
      'Behind Face ID. Mind data never leaves the phone and isn’t in the normal CSV export.',
      'Reminders on the lock screen only show the neutral labels you choose.',
    ],
  },
  {
    icon: 'chart.line.uptrend.xyaxis',
    kicker: 'Progress & coach',
    title: 'See it add up',
    points: [
      'Lift charts, personal records, weekly streaks, body metrics and private progress photos.',
      'The coach runs on your own laptop (Ollama): ask questions, build a plan, get a Sunday review.',
      'Add your laptop’s address in Settings → Home laptop when you’re ready.',
    ],
  },
];

/** First-run walkthrough. Skip ends it for good; Later shows it again next launch. Both reopenable from Settings. */
export default function Welcome() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { flags, setFeature } = useFeatures();
  const [i, setI] = useState(0);
  const last = PAGES.length; // the extra last page picks features
  const onFeatures = i === last;

  async function close(state: 'done' | 'later') {
    await setSetting(db, 'onboarding', state);
    syncAllReminders(db).catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const page = PAGES[i];
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.top}>
        <View style={styles.dots}>
          {[...PAGES, null].map((_, k) => (
            <View key={k} style={[styles.dot, { backgroundColor: k === i ? c.accent : c.border, width: k === i ? 22 : 8 }]} />
          ))}
        </View>
        <Pressable hitSlop={12} onPress={() => close('done')} accessibilityLabel="Skip the walkthrough">
          <Text style={[styles.skip, { color: c.textMuted }]}>SKIP</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {onFeatures ? (
          <Animated.View key="features" entering={FadeInRight.duration(250)} exiting={FadeOutLeft.duration(150)} style={{ gap: space.md }}>
            <Text style={[styles.kicker, { color: c.accent }]}>MAKE IT YOURS</Text>
            <Text style={[styles.title, { color: c.text }]}>Pick your features</Text>
            <T variant="muted">Turn off anything you don’t need. Nothing is deleted, and you can change this later in Settings.</T>
            {FEATURES.map((f) => (
              <View key={f.key} style={[styles.feature, { backgroundColor: c.card }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ fontWeight: '700' }}>{f.title}</T>
                  <T variant="muted">{f.detail}</T>
                </View>
                <Switch value={flags[f.key]} onValueChange={(v) => setFeature(f.key, v)} trackColor={{ true: c.accent }} />
              </View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View key={i} entering={FadeInRight.duration(250)} exiting={FadeOutLeft.duration(150)} style={{ gap: space.lg }}>
            <View style={[styles.icon, { backgroundColor: c.card }]}>
              <SymbolView name={page.icon} tintColor={c.accent} size={56} />
            </View>
            <Text style={[styles.kicker, { color: c.accent }]}>{page.kicker.toUpperCase()}</Text>
            <Text style={[styles.title, { color: c.text }]}>{page.title}</Text>
            {page.points.map((p) => (
              <View key={p} style={styles.point}>
                <View style={[styles.bullet, { backgroundColor: c.accent }]} />
                <T style={{ flex: 1 }}>{p}</T>
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <View style={{ gap: space.sm }}>
        <Button title={onFeatures ? 'Start using Steady' : i === 0 ? 'Take the tour' : 'Next'} onPress={() => (onFeatures ? close('done') : setI(i + 1))} />
        <View style={styles.bottomRow}>
          {i > 0 ? <Button title="Back" variant="secondary" style={{ flex: 1 }} onPress={() => setI(i - 1)} /> : null}
          {!onFeatures ? <Button title="Later" variant="secondary" style={{ flex: 1 }} onPress={() => close('later')} /> : null}
        </View>
        {!onFeatures ? (
          <T variant="muted" style={{ textAlign: 'center' }}>
            Later shows this again next time you open the app.
          </T>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  skip: { fontFamily: fonts.displayBold, fontSize: 18, letterSpacing: 1 },
  body: { flexGrow: 1, justifyContent: 'center', paddingVertical: space.lg },
  icon: { width: 104, height: 104, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.displayBold, fontSize: 18, letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, marginTop: -space.sm },
  point: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  bottomRow: { flexDirection: 'row', gap: space.sm },
});
