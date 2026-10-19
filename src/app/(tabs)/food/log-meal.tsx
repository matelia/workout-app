import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Stepper } from '@/components/Stepper';
import { Button, Card, Chip, ChipRow, Screen, T } from '@/components/ui';
import {
  batchMacros,
  deleteLogEntry,
  getLogEntry,
  getSavedMeal,
  getSavedMealItems,
  logSavedMeal,
  MEAL_LABELS,
  MEALS,
  mealForNow,
  scaleMacros,
  updateLogEntry,
  type Meal,
  type SavedMeal,
  type SavedMealItem,
} from '@/db/repos/food';
import { todayStr } from '@/lib/dates';
import { space } from '@/theme';

export default function LogSavedMeal() {
  const p = useLocalSearchParams<{ mealId: string; logId?: string; date?: string; meal?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const logId = p.logId ? Number(p.logId) : null;

  const [saved, setSaved] = useState<SavedMeal | null>(null);
  const [items, setItems] = useState<SavedMealItem[]>([]);
  const [halfServings, setHalfServings] = useState(2); // stepper works in 0.5-serving steps
  const [meal, setMeal] = useState<Meal>((p.meal as Meal) ?? mealForNow());
  const [date, setDate] = useState(p.date ?? todayStr());

  useEffect(() => {
    getSavedMeal(db, Number(p.mealId)).then(setSaved);
    getSavedMealItems(db, Number(p.mealId)).then(setItems);
    if (logId)
      getLogEntry(db, logId).then((e) => {
        if (!e) return;
        setHalfServings(Math.round((e.servings ?? 1) * 2));
        setMeal(e.meal);
        setDate(e.date);
      });
  }, [db, p.mealId, logId]);

  if (!saved) return null;
  const servings = halfServings / 2;
  const per = scaleMacros(batchMacros(items), 1 / (saved.servings_per_batch || 1));
  const m = scaleMacros(per, servings);

  async function save() {
    if (logId) await updateLogEntry(db, logId, meal, { servings });
    else await logSavedMeal(db, date, meal, saved!.id, servings);
    router.dismissTo('/food');
  }

  return (
    <Screen>
      <T variant="title">{saved.name}</T>
      {saved.servings_per_batch > 1 ? <T variant="muted">Batch of {saved.servings_per_batch} servings</T> : null}

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <T variant="label">Servings</T>
        <Stepper value={halfServings} min={1} max={40} onChange={setHalfServings} format={(v) => String(v / 2)} suffix="servings" />
      </View>

      <T variant="label">Meal</T>
      <ChipRow>
        {MEALS.map((x) => (
          <Chip key={x} label={MEAL_LABELS[x]} selected={meal === x} onPress={() => setMeal(x)} />
        ))}
      </ChipRow>

      <Card>
        <T variant="heading">{Math.round(m.kcal)} kcal</T>
        <T variant="muted">
          Protein {m.protein.toFixed(1)} g · Carbs {m.carbs.toFixed(1)} g · Fat {m.fat.toFixed(1)} g
        </T>
      </Card>

      <Button title={logId ? 'Update' : 'Log it'} onPress={save} />
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
    </Screen>
  );
}
