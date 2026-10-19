import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Field, Screen, T } from '@/components/ui';
import {
  addSavedMealItem,
  deleteLogEntry,
  getFood,
  getLogEntry,
  logFood,
  macrosFor,
  MEAL_LABELS,
  MEALS,
  mealForNow,
  updateLogEntry,
  type Food,
  type Meal,
} from '@/db/repos/food';
import { getPantryByFood, type PantryProduct } from '@/db/repos/pantry';
import { todayStr } from '@/lib/dates';
import { space, useColors } from '@/theme';

type Params = {
  foodId: string;
  logId?: string;
  grams?: string;
  target?: 'log' | 'mealItem';
  date?: string;
  meal?: string;
  mealId?: string;
};

export default function AmountScreen() {
  const p = useLocalSearchParams<Params>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const logId = p.logId ? Number(p.logId) : null;
  const target = p.target ?? 'log';

  const [food, setFood] = useState<Food | null>(null);
  const [grocery, setGrocery] = useState<PantryProduct | null>(null);
  const [grams, setGrams] = useState(p.grams ?? '100');
  const [meal, setMeal] = useState<Meal>((p.meal as Meal) ?? mealForNow());
  const [date, setDate] = useState(p.date ?? todayStr());

  useEffect(() => {
    getFood(db, Number(p.foodId)).then(setFood);
    getPantryByFood(db, Number(p.foodId)).then(setGrocery);
    if (logId)
      getLogEntry(db, logId).then((e) => {
        if (!e) return;
        setGrams(String(e.grams ?? 100));
        setMeal(e.meal);
        setDate(e.date);
      });
  }, [db, p.foodId, logId]);

  const g = parseFloat(grams.replace(',', '.')) || 0;
  const m = food ? macrosFor(food, g) : null;

  async function save() {
    if (!food || g <= 0) return;
    if (target === 'mealItem') {
      await addSavedMealItem(db, Number(p.mealId), food.id, g);
      router.dismissTo(`/food/meals/${p.mealId}` as never);
      return;
    }
    if (logId) await updateLogEntry(db, logId, meal, { grams: g });
    else await logFood(db, date, meal, food.id, g);
    router.dismissTo('/food');
  }

  if (!food) return null;

  return (
    <Screen>
      <T variant="title">{food.name}</T>
      {grocery ? <T variant="muted">🛒 {[grocery.store, grocery.kind].filter(Boolean).join(' · ')}</T> : null}
      <T variant="muted">
        Per 100 g: {food.kcal_100g ?? '?'} kcal · P {food.protein_100g ?? '?'} · C {food.carbs_100g ?? '?'} · F{' '}
        {food.fat_100g ?? '?'}
      </T>

      <Field label="Grams" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" selectTextOnFocus autoFocus={!logId} />
      {grocery?.serving_g ? (
        <ChipRow>
          {[0.5, 1, 2, 3, 4].map((n) => (
            <Chip
              key={n}
              label={`${n} ${grocery.serving_label ?? 'serving'}${n > 1 && grocery.serving_label ? 's' : ''}`}
              selected={Math.abs(g - n * grocery.serving_g!) < 0.5}
              onPress={() => setGrams(String(Math.round(n * grocery.serving_g! * 10) / 10))}
            />
          ))}
        </ChipRow>
      ) : null}
      <ChipRow>
        {[-10, +10, 50, 100, 150, 200].map((v) => (
          <Chip
            key={v}
            label={v < 0 ? `${v}` : v === 10 ? '+10' : `${v} g`}
            onPress={() => setGrams(String(Math.abs(v) === 10 ? Math.max(0, g + v) : v))}
          />
        ))}
      </ChipRow>

      {target === 'log' ? (
        <View style={{ gap: space.sm }}>
          <T variant="label">Meal</T>
          <ChipRow>
            {MEALS.map((x) => (
              <Chip key={x} label={MEAL_LABELS[x]} selected={meal === x} onPress={() => setMeal(x)} />
            ))}
          </ChipRow>
        </View>
      ) : null}

      {m ? (
        <Card>
          <T variant="heading">{Math.round(m.kcal)} kcal</T>
          <T variant="muted">
            Protein {m.protein.toFixed(1)} g · Carbs {m.carbs.toFixed(1)} g · Fat {m.fat.toFixed(1)} g
          </T>
        </Card>
      ) : null}

      <Button title={logId ? 'Update' : target === 'mealItem' ? 'Add to meal' : 'Log it'} onPress={save} disabled={g <= 0} />
      {logId ? (
        <Button
          title="Delete from log"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete this entry?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteLogEntry(db, logId);
                  router.back();
                },
              },
            ])
          }
        />
      ) : null}
      {!food.kcal_100g ? <T style={{ color: c.danger }}>This food has no calorie data.</T> : null}
    </Screen>
  );
}
