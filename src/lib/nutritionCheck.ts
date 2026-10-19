import type { Macros, NutrientKey, Targets } from '@/db/repos/food';

// Daily "are you eating well?" check against your goal (fiber), limits (sugar, saturated fat,
// sodium) and your fat target. Pure functions so they're easy to test.

export type CheckStatus = 'ok' | 'low' | 'near' | 'over';
export type Check = {
  key: NutrientKey;
  label: string;
  unit: string;
  value: number;
  target: number;
  type: 'goal' | 'limit';
  status: CheckStatus;
};

const SPEC: { key: NutrientKey; label: string; unit: string; type: 'goal' | 'limit'; target: (t: Targets) => number | null }[] = [
  { key: 'fiber', label: 'Fiber', unit: 'g', type: 'goal', target: (t) => t.fiber_g },
  { key: 'fat', label: 'Fat', unit: 'g', type: 'limit', target: (t) => t.fat_g },
  { key: 'satFat', label: 'Saturated fat', unit: 'g', type: 'limit', target: (t) => t.sat_fat_g },
  { key: 'sugar', label: 'Sugar', unit: 'g', type: 'limit', target: (t) => t.sugar_g },
  { key: 'sodium', label: 'Sodium', unit: 'mg', type: 'limit', target: (t) => t.sodium_mg },
];

const NEAR = 0.85;
// Fat is a target rather than a hard limit, so allow a little over before flagging.
const OVER: Partial<Record<NutrientKey, number>> = { fat: 1.1 };

export function nutritionChecks(day: Macros, targets: Targets): Check[] {
  const out: Check[] = [];
  for (const s of SPEC) {
    const target = s.target(targets);
    if (!target) continue;
    const value = day[s.key];
    let status: CheckStatus = 'ok';
    if (s.type === 'goal') status = value >= target ? 'ok' : 'low';
    else if (value > target * (OVER[s.key] ?? 1)) status = 'over';
    else if (value >= target * NEAR) status = 'near';
    out.push({ key: s.key, label: s.label, unit: s.unit, value, target, type: s.type, status });
  }
  return out;
}

export function fmt(n: number, unit: string) {
  return `${unit === 'mg' ? Math.round(n).toLocaleString() : Math.round(n)} ${unit}`;
}

/** Plain-language notes for the things worth acting on. */
export function checkMessages(checks: Check[]): string[] {
  const msgs: string[] = [];
  for (const c of checks) {
    if (c.status === 'over')
      msgs.push(`${c.label} is over ${c.type === 'limit' && c.key !== 'fat' ? 'the daily limit' : 'your target'}: ${fmt(c.value, c.unit)} of ${fmt(c.target, c.unit)}. Go lighter on it for the rest of the day.`);
    else if (c.status === 'near') msgs.push(`${c.label} is close to the limit: ${fmt(c.value, c.unit)} of ${fmt(c.target, c.unit)}.`);
  }
  const fiber = checks.find((c) => c.key === 'fiber' && c.status === 'low');
  if (fiber) msgs.push(`Fiber ${fmt(fiber.value, 'g')} of ${fmt(fiber.target, 'g')}. Beans, oats, berries, veggies or whole grains help.`);
  return msgs;
}

/** Limits a single meal part would push over (compared with the day before it). */
export function partWarnings(before: Macros, part: Macros, targets: Targets): string[] {
  const after = Object.fromEntries(Object.keys(before).map((k) => [k, before[k as NutrientKey] + part[k as NutrientKey]])) as Macros;
  const was = nutritionChecks(before, targets);
  return nutritionChecks(after, targets)
    .filter((c) => c.status === 'over' && was.find((w) => w.key === c.key)?.status !== 'over')
    .map((c) => `With this, ${c.label.toLowerCase()} today would be ${fmt(c.value, c.unit)} (${c.key === 'fat' ? 'target' : 'limit'} ${fmt(c.target, c.unit)}).`);
}
