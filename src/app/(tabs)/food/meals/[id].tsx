import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import {
  batchMacros,
  createSavedMeal,
  deleteSavedMeal,
  getSavedMeal,
  getSavedMealItems,
  macrosFor,
  removeSavedMealItem,
  scaleMacros,
  updateSavedMeal,
  updateSavedMealItem,
} from '@/db/repos/food';
import { useDbQuery } from '@/hooks/useDbQuery';
import { href } from '@/lib/href';
import { radius, space, useColors } from '@/theme';

export default function SavedMealEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealId = id === 'new' ? null : Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();

  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const { data: items, reload } = useDbQuery((d) => (mealId ? getSavedMealItems(d, mealId) : Promise.resolve([])), id);

  useEffect(() => {
    if (!mealId) return;
    getSavedMeal(db, mealId).then((m) => {
      if (!m) return;
      setName(m.name);
      setServings(String(m.servings_per_batch));
    });
  }, [db, mealId]);

  const servingsNum = Math.max(0.5, parseFloat(servings.replace(',', '.')) || 1);
  const total = batchMacros(items ?? []);
  const per = scaleMacros(total, 1 / servingsNum);

  /** Creates the meal on first save; returns its id. */
  async function persist() {
    const n = name.trim() || 'Untitled meal';
    if (mealId) {
      await updateSavedMeal(db, mealId, n, servingsNum);
      return mealId;
    }
    const newId = await createSavedMeal(db, n, servingsNum);
    router.setParams({ id: String(newId) });
    return newId;
  }

  async function addIngredient() {
    const target = await persist();
    router.push(href('/food/add', { target: 'mealItem', mealId: target }));
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: mealId ? 'Saved meal' : 'New saved meal' }} />
      <Field label="Name" value={name} onChangeText={setName} onEndEditing={() => mealId && persist()} placeholder="e.g. Chicken rice prep" />
      <Field
        label="Servings in this batch"
        value={servings}
        onChangeText={setServings}
        onEndEditing={() => mealId && persist()}
        keyboardType="decimal-pad"
      />

      <T variant="label">Ingredients (whole batch)</T>
      {items?.length === 0 ? <T variant="muted">No ingredients yet.</T> : null}
      {items?.map((it) => (
        <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <T numberOfLines={1}>{it.name}</T>
            <T variant="muted">{Math.round(macrosFor(it, it.grams).kcal)} kcal</T>
          </View>
          <TextInput
            defaultValue={String(it.grams)}
            keyboardType="decimal-pad"
            selectTextOnFocus
            onEndEditing={async (e) => {
              const g = parseFloat(e.nativeEvent.text.replace(',', '.'));
              if (g > 0) {
                await updateSavedMealItem(db, it.id, g);
                reload();
              }
            }}
            style={{
              width: 80,
              textAlign: 'right',
              color: c.text,
              backgroundColor: c.card,
              borderColor: c.border,
              borderWidth: 1,
              borderRadius: radius.sm,
              padding: space.sm,
              fontSize: 16,
            }}
          />
          <T variant="muted">g</T>
          <Pressable
            hitSlop={8}
            onPress={async () => {
              await removeSavedMealItem(db, it.id);
              reload();
            }}>
            <SymbolView name="minus.circle" tintColor={c.danger} size={20} />
          </Pressable>
        </View>
      ))}
      <Button title="Add ingredient" variant="secondary" onPress={addIngredient} />

      <Card>
        <T variant="label">Per serving</T>
        <T variant="heading">{Math.round(per.kcal)} kcal</T>
        <T variant="muted">
          Protein {per.protein.toFixed(1)} g · Carbs {per.carbs.toFixed(1)} g · Fat {per.fat.toFixed(1)} g
        </T>
        <T variant="muted">Whole batch: {Math.round(total.kcal)} kcal</T>
      </Card>

      <Button
        title="Save"
        onPress={async () => {
          await persist();
          router.back();
        }}
      />
      {mealId ? (
        <Button
          title="Delete saved meal"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete saved meal?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteSavedMeal(db, mealId);
                    router.back();
                  } catch (e) {
                    Alert.alert('Can’t delete', e instanceof Error ? e.message : String(e));
                  }
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}
