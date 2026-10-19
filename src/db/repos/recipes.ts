import type { SQLiteDatabase } from 'expo-sqlite';

import { updateFood, upsertFood, type FoodInput } from '@/db/repos/food';
import { deletePantryItem, getPantryByFood, savePantryItem } from '@/db/repos/pantry';
import type { NutritionPerServing } from '@/lib/recipeImport';

// Per-serving nutrition is stored as a food whose "100 g" is one serving (serving_g = 100,
// label "serving"), linked as a 'recipe' pantry item, so it logs, searches and matches
// like groceries and restaurant items.

export type Recipe = {
  id: number;
  name: string;
  source_url: string | null;
  image_url: string | null;
  servings: number;
  ingredients: string; // JSON
  steps: string; // JSON
  food_id: number | null;
  nutrition_note: string | null; // 'pending' while waiting for the laptop to estimate it
  notes: string | null;
};

export type RecipeRow = Recipe & { kcal: number | null; protein: number | null };

export function listRecipes(db: SQLiteDatabase) {
  return db.getAllAsync<RecipeRow>(
    `SELECT r.*, f.kcal_100g AS kcal, f.protein_100g AS protein
     FROM recipe r LEFT JOIN food f ON f.id = r.food_id ORDER BY r.created_at DESC, r.id DESC`,
  );
}

export function getRecipe(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Recipe>('SELECT * FROM recipe WHERE id = ?', id);
}

export type RecipeInput = {
  name: string;
  source_url: string | null;
  image_url: string | null;
  servings: number;
  ingredients: string[];
  steps: string[];
};

export async function createRecipe(db: SQLiteDatabase, r: RecipeInput, nutrition: NutritionPerServing | null, note: string | null) {
  const id = (
    await db.runAsync(
      'INSERT INTO recipe (name, source_url, image_url, servings, ingredients, steps, nutrition_note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      r.name,
      r.source_url,
      r.image_url,
      r.servings,
      JSON.stringify(r.ingredients),
      JSON.stringify(r.steps),
      nutrition ? note : r.ingredients.length ? 'pending' : null,
    )
  ).lastInsertRowId;
  if (nutrition) await setRecipeNutrition(db, id, nutrition, note);
  return id;
}

function host(url: string | null) {
  return url?.match(/^https?:\/\/(?:www\.)?([^/]+)/)?.[1] ?? null;
}

export async function setRecipeNutrition(db: SQLiteDatabase, recipeId: number, n: NutritionPerServing, note: string | null) {
  const recipe = await getRecipe(db, recipeId);
  if (!recipe) return;
  const food: FoodInput = {
    name: `${recipe.name} (recipe)`,
    source: 'manual',
    barcode: null,
    kcal_100g: n.kcal,
    protein_100g: n.protein_g,
    carbs_100g: n.carbs_g,
    fat_100g: n.fat_g,
    fiber_100g: n.fiber_g,
    sugar_100g: n.sugar_g,
    sat_fat_100g: n.sat_fat_g,
    sodium_mg_100g: n.sodium_mg,
  };
  let foodId = recipe.food_id;
  if (foodId) await updateFood(db, foodId, food);
  else foodId = await upsertFood(db, food);
  await savePantryItem(db, foodId, {
    store: host(recipe.source_url) ?? 'My recipes',
    kind: recipe.name.toLowerCase(),
    aliases: [],
    serving_g: 100,
    serving_label: 'serving',
    in_rotation: true,
    place_type: 'recipe',
  });
  await db.runAsync('UPDATE recipe SET food_id = ?, nutrition_note = ? WHERE id = ?', foodId, note, recipeId);
}

export async function updateRecipeText(db: SQLiteDatabase, id: number, name: string, servings: number, notes: string | null) {
  await db.runAsync('UPDATE recipe SET name = ?, servings = ?, notes = ? WHERE id = ?', name, servings, notes, id);
}

export async function deleteRecipe(db: SQLiteDatabase, id: number) {
  const r = await getRecipe(db, id);
  if (r?.food_id) {
    const p = await getPantryByFood(db, r.food_id);
    if (p) await deletePantryItem(db, p.id);
  }
  await db.runAsync('DELETE FROM recipe WHERE id = ?', id);
}

/** Recipes whose nutrition still needs to be estimated by the laptop. */
export function listPendingNutrition(db: SQLiteDatabase) {
  return db.getAllAsync<Recipe>("SELECT * FROM recipe WHERE food_id IS NULL AND nutrition_note = 'pending'");
}
