import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { createRecipe } from '@/db/repos/recipes';
import { getJob, setJobStatus, type SnapshotJob } from '@/db/repos/snapshots';
import type { NutritionPerServing } from '@/lib/recipeImport';
import { space } from '@/theme';

type RecipeOut = {
  name: string;
  servings: number;
  ingredients: string[];
  steps: string[];
  nutrition_per_serving: Partial<NutritionPerServing> | null;
  estimated: boolean;
  missing?: string[];
};

const FIELDS: [keyof NutritionPerServing, string][] = [
  ['kcal', 'kcal'],
  ['protein_g', 'Protein g'],
  ['carbs_g', 'Carbs g'],
  ['fat_g', 'Fat g'],
  ['fiber_g', 'Fiber g'],
  ['sugar_g', 'Sugar g'],
  ['sat_fat_g', 'Sat fat g'],
  ['sodium_mg', 'Sodium mg'],
];

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

/** Review a recipe read from screenshots before it goes into the cookbook. */
export default function RecipeReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [job, setJob] = useState<SnapshotJob | null>(null);
  const [out, setOut] = useState<RecipeOut | null>(null);
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    getJob(db, Number(id)).then((j) => {
      if (!j?.model_output_json) return;
      const r = (JSON.parse(j.model_output_json) as { recipe: RecipeOut }).recipe;
      setJob(j);
      setOut(r);
      setName(r.name);
      setServings(String(r.servings));
      setIngredients(r.ingredients.join('\n'));
      setSteps(r.steps.join('\n'));
      setVals(Object.fromEntries(FIELDS.map(([k]) => [k, r.nutrition_per_serving?.[k]?.toString() ?? ''])));
    });
  }, [db, id]);

  async function save() {
    if (!job || !out) return;
    const nutrition = Object.fromEntries(FIELDS.map(([k]) => [k, num(vals[k] ?? '')])) as NutritionPerServing;
    const recipeId = await createRecipe(
      db,
      {
        name: name.trim() || 'Recipe',
        source_url: null,
        image_url: null,
        servings: num(servings) || 1,
        ingredients: ingredients.split('\n').map((s) => s.trim()).filter(Boolean),
        steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
      },
      nutrition.kcal !== null ? nutrition : null,
      out.estimated ? 'Estimated from ingredients (USDA)' : 'From the screenshots',
    );
    await setJobStatus(db, job.id, 'done');
    router.replace(`/food/cookbook/${recipeId}`);
  }

  if (!out) return null;

  return (
    <Screen>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="decimal-pad" />
      <Card>
        <T variant="label">Nutrition per serving</T>
        <T variant="muted">
          {out.estimated
            ? `Estimated from the ingredients with USDA data${out.missing?.length ? `; not counted: ${out.missing.join(', ')}` : ''}. Adjust if you know better.`
            : 'Read from your screenshots.'}
        </T>
        {[0, 2, 4, 6].map((i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
            {FIELDS.slice(i, i + 2).map(([k, label]) => (
              <View key={k} style={{ flex: 1 }}>
                <Field label={label} value={vals[k] ?? ''} onChangeText={(v) => setVals((p) => ({ ...p, [k]: v }))} keyboardType="decimal-pad" />
              </View>
            ))}
          </View>
        ))}
      </Card>
      <Field label="Ingredients (one per line)" value={ingredients} onChangeText={setIngredients} multiline />
      <Field label="Steps (one per line)" value={steps} onChangeText={setSteps} multiline />
      <Button title="Save to cookbook" onPress={save} />
    </Screen>
  );
}
