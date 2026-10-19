import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import type { Macros, Targets } from '@/db/repos/food';
import { radius, space, useColors } from '@/theme';

function Bar({ label, value, target, unit, color }: { label: string; value: number; target: number | null; unit: string; color?: string }) {
  const c = useColors();
  const pct = target ? Math.min(1, value / target) : 0;
  const over = !!target && value > target * 1.05;
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.labels}>
        <T style={{ fontWeight: '600' }}>{label}</T>
        <T variant="muted">
          {Math.round(value)}
          {target ? ` / ${Math.round(target)}` : ''} {unit}
        </T>
      </View>
      {target ? (
        <View style={[styles.track, { backgroundColor: c.bg }]}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? c.danger : (color ?? c.accent) }]} />
        </View>
      ) : null}
    </View>
  );
}

/** Calories + protein bars (carbs/fat as a line), against daily targets. */
export function MacroSummary({ totals, targets, compact }: { totals: Macros; targets: Targets; compact?: boolean }) {
  return (
    <View style={{ gap: space.sm }}>
      <Bar label="Calories" value={totals.kcal} target={targets.kcal} unit="kcal" />
      <Bar label="Protein" value={totals.protein} target={targets.protein_g} unit="g" color={useColors().accent2} />
      {!compact ? (
        <T variant="muted">
          Carbs {Math.round(totals.carbs)}
          {targets.carbs_g ? `/${Math.round(targets.carbs_g)}` : ''} g · Fat {Math.round(totals.fat)}
          {targets.fat_g ? `/${Math.round(targets.fat_g)}` : ''} g
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm },
});
