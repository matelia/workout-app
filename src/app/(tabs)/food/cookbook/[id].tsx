import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Empty, Screen, T } from '@/components/ui';
import { getFood, mealForNow } from '@/db/repos/food';
import { deleteRecipe, getRecipe } from '@/db/repos/recipes';
import { useDbQuery } from '@/hooks/useDbQuery';
import { todayStr } from '@/lib/dates';
import { href } from '@/lib/href';
import { processQueue } from '@/lib/snapshotClient';
import { radius, space, useColors } from '@/theme';

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const { data, reload } = useDbQuery(async (d) => {
    const recipe = await getRecipe(d, Number(id));
    return { recipe, food: recipe?.food_id ? await getFood(d, recipe.food_id) : null };
  }, id);

  if (!data) return null;
  const { recipe, food } = data;
  if (!recipe) return <Screen><Empty title="Recipe not found" /></Screen>;
  const ingredients: string[] = JSON.parse(recipe.ingredients);
  const steps: string[] = JSON.parse(recipe.steps);
  const n = (v: number | null | undefined, unit = '') => (v === null || v === undefined ? '–' : `${Math.round(v)}${unit}`);

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      {recipe.image_url ? <Image source={{ uri: recipe.image_url }} style={styles.hero} contentFit="cover" /> : null}
      <T variant="title">{recipe.name}</T>
      <T variant="muted">
        Makes {recipe.servings} serving{recipe.servings === 1 ? '' : 's'}
        {recipe.source_url ? ` · ${recipe.source_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}` : ''}
      </T>

      <Card>
        <T variant="label">Per serving</T>
        {food ? (
          <>
            <T variant="number">{n(food.kcal_100g)}</T>
            <T variant="muted">
              kcal · protein {n(food.protein_100g, ' g')} · carbs {n(food.carbs_100g, ' g')} · fat {n(food.fat_100g, ' g')}
            </T>
            <T variant="muted">
              fiber {n(food.fiber_100g, ' g')} · sugar {n(food.sugar_100g, ' g')} · sat fat {n(food.sat_fat_100g, ' g')} · sodium{' '}
              {n(food.sodium_mg_100g, ' mg')}
            </T>
            {recipe.nutrition_note ? <T variant="muted">{recipe.nutrition_note}</T> : null}
          </>
        ) : recipe.nutrition_note === 'pending' ? (
          <>
            <T variant="muted">Waiting for the laptop to estimate it from the ingredients. You’ll get a notification.</T>
            <Button
              title={busy ? 'Trying…' : 'Try now'}
              variant="secondary"
              onPress={async () => {
                setBusy(true);
                await processQueue(db);
                setBusy(false);
                reload();
              }}
            />
          </>
        ) : (
          <T variant="muted">No nutrition for this recipe.</T>
        )}
      </Card>

      {food ? (
        <Button
          title="Log a serving"
          onPress={() => router.push(href('/food/amount', { foodId: food.id, grams: 100, date: todayStr(), meal: mealForNow() }))}
        />
      ) : null}

      {ingredients.length ? (
        <Card>
          <T variant="label">Ingredients</T>
          {ingredients.map((i, k) => (
            <T key={k}>• {i}</T>
          ))}
        </Card>
      ) : null}
      {steps.length ? (
        <Card>
          <T variant="label">Steps</T>
          {steps.map((s, k) => (
            <View key={k} style={styles.step}>
              <T style={{ color: c.accent, fontWeight: '700' }}>{k + 1}</T>
              <T style={{ flex: 1 }}>{s}</T>
            </View>
          ))}
        </Card>
      ) : null}

      {recipe.source_url ? <Button title="Open original ↗" variant="secondary" onPress={() => Linking.openURL(recipe.source_url!)} /> : null}
      <Button
        title="Delete recipe"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete this recipe?', 'Servings you already logged stay in your history.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteRecipe(db, recipe.id);
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 220, borderRadius: radius.md },
  step: { flexDirection: 'row', gap: space.md },
});
