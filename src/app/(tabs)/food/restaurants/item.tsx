import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Screen, T } from '@/components/ui';
import { getFood, updateFood, upsertFood, type FoodInput } from '@/db/repos/food';
import { getPantryItem, savePantryItem } from '@/db/repos/pantry';
import { space, useColors } from '@/theme';

// Values are entered PER ITEM, exactly as the restaurant lists them, and stored per 100 g
// using the item weight (or a nominal 100 g "item" when the weight isn't published).
const FIELDS = [
  ['kcal', 'Calories', 'kcal_100g'],
  ['protein', 'Protein g', 'protein_100g'],
  ['carbs', 'Carbs g', 'carbs_100g'],
  ['fat', 'Fat g', 'fat_100g'],
  ['fiber', 'Fiber g', 'fiber_100g'],
  ['sugar', 'Sugar g', 'sugar_100g'],
  ['satFat', 'Sat. fat g', 'sat_fat_100g'],
  ['sodium', 'Sodium mg', 'sodium_mg_100g'],
] as const;
type Key = (typeof FIELDS)[number][0];

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export default function RestaurantItem() {
  const p = useLocalSearchParams<{ restaurant: string; id?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const itemId = p.id ? Number(p.id) : null;

  const [foodId, setFoodId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [weight, setWeight] = useState('');
  const [vals, setVals] = useState<Record<Key, string>>({ kcal: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '', satFat: '', sodium: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      const it = await getPantryItem(db, itemId);
      const f = it && (await getFood(db, it.food_id));
      if (!it || !f) return;
      const w = it.serving_g ?? 100;
      setFoodId(f.id);
      setName(f.name.replace(` (${p.restaurant})`, ''));
      setKind(it.kind);
      setWeight(it.serving_g && it.serving_g !== 100 ? String(it.serving_g) : '');
      setVals(
        Object.fromEntries(FIELDS.map(([k, , col]) => [k, f[col] === null ? '' : String(r1((f[col]! * w) / 100))])) as Record<Key, string>,
      );
    })();
  }, [db, itemId, p.restaurant]);

  async function save() {
    if (!name.trim()) return setError('Name the item.');
    if (num(vals.kcal) === null) return setError('Enter calories.');
    const w = num(weight) && num(weight)! > 0 ? num(weight)! : 100;
    const food: FoodInput = {
      name: `${name.trim()} (${p.restaurant})`,
      source: 'manual',
      barcode: null,
      kcal_100g: null,
      protein_100g: null,
      carbs_100g: null,
      fat_100g: null,
    };
    for (const [k, , col] of FIELDS) {
      const v = num(vals[k]);
      food[col] = v === null ? null : r1((v * 100) / w);
    }
    const id = foodId ?? (await upsertFood(db, food));
    if (foodId) await updateFood(db, foodId, food);
    await savePantryItem(db, id, {
      store: p.restaurant,
      kind: kind.trim() || name.trim(),
      aliases: [],
      serving_g: w,
      serving_label: 'item',
      in_rotation: true,
      place_type: 'restaurant',
    });
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: itemId ? 'Edit item' : `New ${p.restaurant} item` }} />
      <Field label="Item" value={name} onChangeText={setName} placeholder="e.g. Spicy Chicken Sandwich" />
      <Field
        label="What is it? (for snapshot matching)"
        value={kind}
        onChangeText={setKind}
        placeholder="e.g. chicken sandwich"
        autoCapitalize="none"
      />
      <Field
        label="Item weight in grams (optional)"
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder="If their nutrition page lists it"
      />
      <T variant="muted">Enter the values for ONE item, as listed by {p.restaurant}.</T>
      {[0, 2, 4, 6].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
          {FIELDS.slice(i, i + 2).map(([k, label]) => (
            <View key={k} style={{ flex: 1 }}>
              <Field label={label} value={vals[k]} onChangeText={(v) => setVals((prev) => ({ ...prev, [k]: v }))} keyboardType="decimal-pad" />
            </View>
          ))}
        </View>
      ))}
      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
      <Button title="Save item" onPress={save} />
    </Screen>
  );
}
