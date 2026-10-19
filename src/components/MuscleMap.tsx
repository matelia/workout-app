import { StyleSheet, View } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

import { T } from '@/components/ui';
import { space, useColors } from '@/theme';

/** Muscles you can tag on an exercise (body-diagram slugs). */
export const MUSCLES: { slug: Slug; label: string }[] = [
  { slug: 'chest', label: 'Chest' },
  { slug: 'deltoids', label: 'Shoulders' },
  { slug: 'trapezius', label: 'Traps' },
  { slug: 'upper-back', label: 'Lats / upper back' },
  { slug: 'lower-back', label: 'Lower back' },
  { slug: 'biceps', label: 'Biceps' },
  { slug: 'triceps', label: 'Triceps' },
  { slug: 'forearm', label: 'Forearms' },
  { slug: 'abs', label: 'Abs' },
  { slug: 'obliques', label: 'Obliques' },
  { slug: 'quadriceps', label: 'Quads' },
  { slug: 'hamstring', label: 'Hamstrings' },
  { slug: 'gluteal', label: 'Glutes' },
  { slug: 'adductors', label: 'Adductors' },
  { slug: 'calves', label: 'Calves' },
  { slug: 'tibialis', label: 'Shins' },
  { slug: 'neck', label: 'Neck' },
];

export const muscleLabel = (s: string) => MUSCLES.find((m) => m.slug === s)?.label ?? s;

const PRIMARY = '#FF5A36';
const SECONDARY = '#FFB199';

/** Front + back body diagram with primary (strong) and secondary (light) muscles highlighted. */
export function MuscleMap({ primary, secondary }: { primary: Slug[]; secondary: Slug[] }) {
  const c = useColors();
  const data: ExtendedBodyPart[] = [
    ...secondary.filter((s) => !primary.includes(s)).map((slug) => ({ slug, intensity: 1 })),
    ...primary.map((slug) => ({ slug, intensity: 2 })),
  ];
  const common = {
    data,
    colors: [SECONDARY, PRIMARY],
    scale: 0.75,
    border: c.border,
    defaultFill: c.cardPressed,
  };
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Body {...common} side="front" />
          <T variant="muted">Front</T>
        </View>
        <View style={styles.col}>
          <Body {...common} side="back" />
          <T variant="muted">Back</T>
        </View>
      </View>
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: PRIMARY }]} />
        <T style={{ flexShrink: 1 }}>{primary.map(muscleLabel).join(', ') || '—'}</T>
      </View>
      {secondary.length ? (
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: SECONDARY }]} />
          <T variant="muted" style={{ flexShrink: 1 }}>
            {secondary.map(muscleLabel).join(', ')}
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', overflow: 'hidden' },
  col: { alignItems: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
