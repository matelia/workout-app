import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Field, Screen, T } from '@/components/ui';
import {
  addMacros,
  dayTotals,
  getTargets,
  logFood,
  macrosFor,
  MEAL_LABELS,
  MEALS,
  mealForNow,
  upsertFood,
  ZERO,
  type Macros,
  type Meal,
  type Per100,
  type Targets,
} from '@/db/repos/food';
import { partWarnings } from '@/lib/nutritionCheck';
import { listPantry, savePantryItem, STORES, type PantryProduct } from '@/db/repos/pantry';
import { getJob, setJobStatus, type SnapshotJob } from '@/db/repos/snapshots';
import { todayStr } from '@/lib/dates';
import { href } from '@/lib/href';
import { matchPantry, STRONG } from '@/lib/pantryMatch';
import { photoUri, type LabelResult, type MealResult } from '@/lib/snapshotClient';
import { radius, space, useColors } from '@/theme';

// Editable row: numbers are strings while editing.
type Values = {
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  satFat: string;
  sodium: string;
};

/** Per-100 g numbers from any source (label, USDA, your grocery) as editable strings. */
function valuesFrom(name: string, v: Partial<Per100>): Values {
  return {
    name,
    kcal: s(v.kcal_100g),
    protein: s(v.protein_100g),
    carbs: s(v.carbs_100g),
    fat: s(v.fat_100g),
    fiber: s(v.fiber_100g),
    sugar: s(v.sugar_100g),
    satFat: s(v.sat_fat_100g),
    sodium: s(v.sodium_mg_100g),
  };
}

function per100(d: Values): Per100 {
  return {
    kcal_100g: num(d.kcal),
    protein_100g: num(d.protein),
    carbs_100g: num(d.carbs),
    fat_100g: num(d.fat),
    fiber_100g: num(d.fiber),
    sugar_100g: num(d.sugar),
    sat_fat_100g: num(d.satFat),
    sodium_mg_100g: num(d.sodium),
  };
}
type Draft = Values & {
  grams: string;
  /** What the photo was recognized as (model's name). */
  seen: string;
  /** Your grocery product, when one is selected. */
  grocery: PantryProduct | null;
  /** USDA fallback values, so you can switch back from a grocery. */
  usda: (Values & { found: boolean }) | null;
  /** A possible (not auto-applied) grocery match. */
  maybe: PantryProduct | null;
};

const s = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const num = (v: string) => {
  const x = parseFloat(v.replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};

function groceryValues(g: PantryProduct): Values {
  return valuesFrom(g.name, g);
}

const BASE_FIELDS = [
  ['Grams eaten', 'grams'],
  ['kcal/100g', 'kcal'],
  ['Protein/100g', 'protein'],
  ['Carbs/100g', 'carbs'],
  ['Fat/100g', 'fat'],
] as const;
const EXTRA_FIELDS = [
  ['Fiber/100g', 'fiber'],
  ['Sugar/100g', 'sugar'],
  ['Sat fat/100g', 'satFat'],
  ['Sodium mg/100g', 'sodium'],
] as const;

export default function ReviewSnapshot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [job, setJob] = useState<SnapshotJob | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pantry, setPantry] = useState<PantryProduct[]>([]);
  const [meal, setMeal] = useState<Meal>(mealForNow());
  // Label snapshots: optionally add the product to My groceries.
  const [toGroceries, setToGroceries] = useState(true);
  const [store, setStore] = useState<string | null>(null);
  const [kind, setKind] = useState('');
  const [servingG, setServingG] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [day, setDay] = useState<{ totals: Macros; targets: Targets } | null>(null);

  useEffect(() => {
    (async () => {
      const j = await getJob(db, Number(id));
      if (!j?.model_output_json) return;
      const groceries = await listPantry(db, false);
      setPantry(groceries);
      setJob(j);
      const date = j.date ?? todayStr();
      setDay({ totals: await dayTotals(db, date), targets: await getTargets(db) });
      if (j.meal) setMeal(j.meal as Meal);
      const out = JSON.parse(j.model_output_json) as LabelResult | MealResult;

      if (out.kind === 'label') {
        const f = out.food;
        setServingG(f.serving_g);
        setKind(f.name.replace(/\(.*?\)/g, '').trim().toLowerCase());
        setDrafts([
          {
            ...valuesFrom(f.name, f),
            grams: s(f.serving_g ?? 100),
            seen: f.name,
            grocery: null,
            usda: null,
            maybe: null,
          },
        ]);
        return;
      }

      setDrafts(
        out.items.map((it) => {
          const usda = it.usda
            ? { ...valuesFrom(it.usda.description, it.usda), found: true }
            : { ...valuesFrom(it.name, {}), found: false };
          const [best] = matchPantry(it.name, groceries);
          const strong = best && best.score >= STRONG ? best.product : null;
          return {
            ...(strong ? groceryValues(strong) : usda),
            grams: s(Math.round(it.grams)),
            seen: it.name,
            grocery: strong,
            usda,
            maybe: !strong && best ? best.product : null,
          };
        }),
      );
    })();
  }, [db, id]);

  function patch(i: number, p: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...p } : d)));
  }

  const applyGrocery = (i: number, g: PantryProduct) => patch(i, { ...groceryValues(g), grocery: g, maybe: null });
  const applyUsda = (i: number) => {
    const u = drafts[i].usda;
    if (u) {
      const { found: _found, ...values } = u;
      patch(i, { ...values, grocery: null });
    }
  };

  function changeSource(i: number) {
    const d = drafts[i];
    const matches = matchPantry(d.seen, pantry).map((m) => m.product);
    const others = pantry.filter((g) => !matches.includes(g));
    const options = [
      ...matches.map((g) => `🛒 ${g.store ? `${g.store} · ` : ''}${g.name}`),
      ...(d.usda ? [`USDA: ${d.usda.name}`] : []),
      ...(others.length ? ['Another grocery…'] : []),
      'Cancel',
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: `“${d.seen}”`, options, cancelButtonIndex: options.length - 1 },
      (k) => {
        if (k < matches.length) return applyGrocery(i, matches[k]);
        let rest = k - matches.length;
        if (d.usda) {
          if (rest === 0) return applyUsda(i);
          rest--;
        }
        if (others.length && rest === 0) {
          const list = [...others.map((g) => `${g.store ? `${g.store} · ` : ''}${g.kind} (${g.name})`), 'Cancel'];
          ActionSheetIOS.showActionSheetWithOptions({ options: list, cancelButtonIndex: others.length }, (x) => {
            if (x < others.length) applyGrocery(i, others[x]);
          });
        }
      },
    );
  }

  const totals = drafts.reduce((acc, d) => addMacros(acc, macrosFor(per100(d), num(d.grams) ?? 0)), ZERO);

  async function save() {
    if (!job) return;
    const date = job.date ?? todayStr();
    for (const d of drafts) {
      const grams = num(d.grams);
      if (!d.name.trim() || !grams) continue;
      const foodId = d.grocery
        ? d.grocery.food_id
        : await upsertFood(db, {
            name: d.name.trim(),
            source: d.usda?.found && d.name === d.usda.name ? 'usda' : 'manual',
            barcode: null,
            ...per100(d),
          });
      if (job.kind === 'label' && toGroceries && kind.trim()) {
        await savePantryItem(db, foodId, { store, kind, aliases: [], serving_g: servingG, serving_label: null, in_rotation: true });
      }
      await logFood(db, date, meal, foodId, grams, job.photo_path);
    }
    await setJobStatus(db, job.id, 'done');

    Alert.alert(`Saved to ${MEAL_LABELS[meal]}`, 'Eating in parts? Snap the next part and it adds to the same meal.', [
      { text: 'Done', style: 'cancel', onPress: () => router.dismissTo('/food') },
      {
        text: 'Snap next part',
        onPress: () => router.replace(href('/food/snapshot', { date, meal, next: 'meal' })),
      },
    ]);
  }

  if (!job) return null;
  const isLabel = job.kind === 'label';

  return (
    <Screen>
      <Image source={{ uri: photoUri(job.photo_path) }} style={styles.photo} contentFit="cover" />
      <T variant="muted">
        {isLabel
          ? 'Check the values against the label. Nutrition is per 100 g; grams is how much you ate.'
          : 'Each food uses your own grocery product when it clearly matches, otherwise USDA. Check names and grams.'}
      </T>

      {drafts.map((d, i) => {
        const servings = d.grocery?.serving_g ? (num(d.grams) ?? 0) / d.grocery.serving_g : null;
        return (
          <Card key={i}>
            {!isLabel ? (
              <View style={styles.sourceRow}>
                <T variant="muted" style={{ flex: 1 }}>
                  Saw “{d.seen}” →{' '}
                  {d.grocery ? (
                    <Text style={{ color: c.success, fontWeight: '600' }}>
                      🛒 your {d.grocery.store ? `${d.grocery.store} ` : ''}
                      {d.grocery.kind}
                    </Text>
                  ) : d.usda?.found ? (
                    'USDA'
                  ) : (
                    <Text style={{ color: c.danger }}>no match, enter per 100 g</Text>
                  )}
                </T>
                <Pressable hitSlop={8} onPress={() => changeSource(i)}>
                  <Text style={{ color: c.accent }}>{d.grocery ? 'Not this?' : 'Change'}</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}>
                  <SymbolView name="minus.circle" tintColor={c.danger} size={22} />
                </Pressable>
              </View>
            ) : null}

            {d.maybe ? (
              <Pressable onPress={() => applyGrocery(i, d.maybe!)} style={[styles.maybe, { borderColor: c.accent }]}>
                <T style={{ color: c.accent }}>
                  Is this your {d.maybe.store ? `${d.maybe.store} ` : ''}
                  {d.maybe.kind}? Tap to use it
                </T>
              </Pressable>
            ) : null}

            <Field
              value={d.name}
              onChangeText={(v) => patch(i, { name: v, grocery: null })}
              placeholder="Food name"
              editable={!d.grocery}
            />

            {d.grocery?.serving_g ? (
              <ChipRow>
                {[1, 2, 3, 4].map((n) => (
                  <Chip
                    key={n}
                    label={`${n} ${d.grocery!.serving_label ?? 'serving'}${n > 1 && d.grocery!.serving_label ? 's' : ''}`}
                    selected={servings !== null && Math.abs(servings - n) < 0.05}
                    onPress={() => patch(i, { grams: String(Math.round(n * d.grocery!.serving_g! * 10) / 10) })}
                  />
                ))}
              </ChipRow>
            ) : null}

            <View style={styles.grid}>
              {[...BASE_FIELDS, ...(showMore ? EXTRA_FIELDS : [])].map(([label, key]) => (
                <View key={key} style={styles.cell}>
                  <Field
                    label={label}
                    value={d[key]}
                    onChangeText={(v) => patch(i, key === 'grams' ? { grams: v } : { [key]: v, grocery: null })}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>
            <Pressable onPress={() => setShowMore((v) => !v)}>
              <T style={{ color: c.accent }}>{showMore ? 'Fewer nutrients ▴' : 'Fiber, sugar, sat. fat, sodium ▾'}</T>
            </Pressable>
          </Card>
        );
      })}

      {!isLabel ? (
        <Button
          title="Add a food"
          variant="secondary"
          onPress={() =>
            setDrafts((prev) => [
              ...prev,
              { ...valuesFrom('', {}), grams: '100', seen: 'added by you', grocery: null, usda: null, maybe: null },
            ])
          }
        />
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T variant="heading" style={{ flex: 1 }}>
              Add to my groceries
            </T>
            <Switch value={toGroceries} onValueChange={setToGroceries} />
          </View>
          {toGroceries ? (
            <>
              <ChipRow>
                {STORES.map((st) => (
                  <Chip key={st} label={st} selected={store === st} onPress={() => setStore(store === st ? null : st)} />
                ))}
              </ChipRow>
              <Field label="What is it? (for matching)" value={kind} onChangeText={setKind} autoCapitalize="none" />
            </>
          ) : null}
        </Card>
      )}

      <T variant="label">Meal</T>
      <ChipRow>
        {MEALS.map((x) => (
          <Chip key={x} label={MEAL_LABELS[x]} selected={meal === x} onPress={() => setMeal(x)} />
        ))}
      </ChipRow>

      <Card>
        <T variant="heading">
          This part: {Math.round(totals.kcal)} kcal · {Math.round(totals.protein)} g protein
        </T>
      </Card>
      {day
        ? partWarnings(day.totals, totals, day.targets).map((w) => (
            <T key={w} style={{ color: c.danger }}>
              ⚠︎ {w}
            </T>
          ))
        : null}
      <Button title="Save to log" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 220, borderRadius: radius.md },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  maybe: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.sm, padding: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '31%' },
});
