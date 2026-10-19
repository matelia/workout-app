import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Screen, T } from '@/components/ui';
import { upsertFood } from '@/db/repos/food';
import { href } from '@/lib/href';
import { space, useColors } from '@/theme';

type Params = { barcode?: string; name?: string; target?: string; date?: string; meal?: string; mealId?: string };

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

/** Manual food entry. Values can be per 100 g or per serving (converted to per 100 g). */
export default function ManualFood() {
  const p = useLocalSearchParams<Params>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [name, setName] = useState(p.name ?? '');
  const [basis, setBasis] = useState('100');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [satFat, setSatFat] = useState('');
  const [sodium, setSodium] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const b = num(basis);
    if (!name.trim()) return setError('Name it.');
    if (!b || b <= 0) return setError('The "per … g" amount must be above 0.');
    if (num(kcal) === null) return setError('Enter calories.');
    const per100 = (s: string) => {
      const v = num(s);
      return v === null ? null : Math.round((v / b) * 1000) / 10;
    };
    const id = await upsertFood(db, {
      name: name.trim(),
      source: 'manual',
      barcode: p.barcode ?? null,
      kcal_100g: per100(kcal),
      protein_100g: per100(protein),
      carbs_100g: per100(carbs),
      fat_100g: per100(fat),
      fiber_100g: per100(fiber),
      sugar_100g: per100(sugar),
      sat_fat_100g: per100(satFat),
      sodium_mg_100g: per100(sodium),
    });
    if (p.target === 'pantry')
      router.replace(href('/food/groceries/new', { foodId: id, serving_g: b === 100 ? undefined : b }));
    else router.replace(href('/food/amount', { foodId: id, target: p.target, date: p.date, meal: p.meal, mealId: p.mealId, grams: b }));
  }

  return (
    <Screen>
      {p.barcode ? <T variant="muted">Barcode {p.barcode} wasn’t found in Open Food Facts. Enter it from the label once; scanning it again will find it.</T> : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Greek yogurt 2%" />
      <Field label="Values are per … grams (serving size or 100)" value={basis} onChangeText={setBasis} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="kcal" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Protein g" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Carbs g" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Fat g" value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
        </View>
      </View>
      <T variant="muted">Optional, from the label:</T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Fiber g" value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Sugar g" value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Sat. fat g" value={satFat} onChangeText={setSatFat} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Sodium mg" value={sodium} onChangeText={setSodium} keyboardType="decimal-pad" />
        </View>
      </View>
      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
      <Button title="Save food" onPress={save} />
    </Screen>
  );
}
