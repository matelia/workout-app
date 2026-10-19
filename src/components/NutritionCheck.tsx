import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import type { Macros, Targets } from '@/db/repos/food';
import { checkMessages, fmt, nutritionChecks, type CheckStatus } from '@/lib/nutritionCheck';
import { radius, space, useColors } from '@/theme';

/** Fiber goal + sugar / sat fat / sodium / fat limits for the day. `compact` shows only what needs attention. */
export function NutritionCheck({ totals, targets, compact }: { totals: Macros; targets: Targets; compact?: boolean }) {
  const c = useColors();
  const checks = nutritionChecks(totals, targets);
  if (!checks.length) return null;
  const colorFor = (s: CheckStatus) => (s === 'over' ? c.danger : s === 'near' ? '#E8A33D' : s === 'low' ? c.accent : c.success);

  if (compact) {
    const msgs = checkMessages(checks);
    if (!msgs.length) return null;
    return (
      <View style={{ gap: space.xs }}>
        {msgs.map((m) => (
          <T key={m} variant="muted">
            • {m}
          </T>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {checks.map((ch) => {
        const pct = Math.min(1, ch.value / ch.target);
        return (
          <View key={ch.key} style={{ gap: 4 }}>
            <View style={styles.labels}>
              <T>{ch.label}</T>
              <T variant="muted" style={{ color: ch.status === 'ok' ? c.textMuted : colorFor(ch.status) }}>
                {fmt(ch.value, ch.unit)} {ch.type === 'goal' ? 'of' : '/'} {fmt(ch.target, ch.unit)}
                {ch.type === 'goal' ? ' goal' : ch.key === 'fat' ? ' target' : ' max'}
                {ch.status === 'over' ? ' · over' : ch.status === 'near' ? ' · close' : ch.status === 'ok' && ch.type === 'goal' ? ' ✓' : ''}
              </T>
            </View>
            <View style={[styles.track, { backgroundColor: c.bg }]}>
              <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colorFor(ch.status) }]} />
            </View>
          </View>
        );
      })}
      {checkMessages(checks)
        .filter((m) => !m.startsWith('Fiber'))
        .map((m) => (
          <T key={m} style={{ color: c.danger }}>
            {m}
          </T>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm },
});
