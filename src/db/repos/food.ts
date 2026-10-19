import type { SQLiteDatabase } from 'expo-sqlite';

/** Nutrient key -> per-100 g column on the food table (sodium is in mg, the rest kcal / g). */
export const NUTRIENT_COLS = {
  kcal: 'kcal_100g',
  protein: 'protein_100g',
  carbs: 'carbs_100g',
  fat: 'fat_100g',
  fiber: 'fiber_100g',
  sugar: 'sugar_100g',
  satFat: 'sat_fat_100g',
  sodium: 'sodium_mg_100g',
} as const;
export type NutrientKey = keyof typeof NUTRIENT_COLS;
type Col = (typeof NUTRIENT_COLS)[NutrientKey];
const KEYS = Object.keys(NUTRIENT_COLS) as NutrientKey[];
const COLS = Object.values(NUTRIENT_COLS) as Col[];
const COL_LIST = (alias = '') => COLS.map((c) => alias + c).join(', ');

export type Macros = Record<NutrientKey, number>;
export const ZERO: Macros = Object.fromEntries(KEYS.map((k) => [k, 0])) as Macros;
export type Per100 = Record<Col, number | null>;

export type Food = {
  id: number;
  name: string;
  source: 'usda' | 'off' | 'manual';
  barcode: string | null;
} & Per100;
/** Extra nutrients are optional when creating a food (many sources only give the big four). */
export type FoodInput = Omit<Food, 'id' | Col> & Pick<Per100, 'kcal_100g' | 'protein_100g' | 'carbs_100g' | 'fat_100g'> & Partial<Per100>;

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export function mealForNow(): Meal {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

export function macrosFor(food: Partial<Per100>, grams: number): Macros {
  const f = grams / 100;
  return Object.fromEntries(KEYS.map((k) => [k, (food[NUTRIENT_COLS[k]] ?? 0) * f])) as Macros;
}

export function addMacros(a: Macros, b: Macros): Macros {
  return Object.fromEntries(KEYS.map((k) => [k, a[k] + b[k]])) as Macros;
}

export function scaleMacros(m: Macros, k: number): Macros {
  return Object.fromEntries(KEYS.map((key) => [key, m[key] * k])) as Macros;
}

// ── Foods ──
export function getFood(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Food>('SELECT * FROM food WHERE id = ?', id);
}

export function findFoodByBarcode(db: SQLiteDatabase, barcode: string) {
  return db.getFirstAsync<Food>('SELECT * FROM food WHERE barcode = ? ORDER BY id DESC LIMIT 1', barcode);
}

export function searchLocalFoods(db: SQLiteDatabase, q: string) {
  return db.getAllAsync<Food>('SELECT * FROM food WHERE name LIKE ? ORDER BY name COLLATE NOCASE LIMIT 30', `%${q}%`);
}

/** Foods logged most recently, for one-tap re-logging. */
export function recentFoods(db: SQLiteDatabase, limit = 15) {
  return db.getAllAsync<Food & { last_grams: number }>(
    `SELECT f.*, l.grams AS last_grams FROM food_log l JOIN food f ON f.id = l.food_id
     WHERE l.id IN (SELECT MAX(id) FROM food_log WHERE food_id IS NOT NULL GROUP BY food_id)
     ORDER BY l.id DESC LIMIT ?`,
    limit,
  );
}

/** Inserts a food, or reuses an identical one (same source + name, or same barcode). */
export async function upsertFood(db: SQLiteDatabase, f: FoodInput) {
  const existing = f.barcode
    ? await findFoodByBarcode(db, f.barcode)
    : await db.getFirstAsync<Food>('SELECT * FROM food WHERE source = ? AND name = ?', f.source, f.name);
  if (existing) {
    await db.runAsync(
      // Extra nutrients only overwrite when the new source has them.
      `UPDATE food SET name = ?, ${COLS.map((c, i) => (i < 4 ? `${c} = ?` : `${c} = COALESCE(?, ${c})`)).join(', ')} WHERE id = ?`,
      f.name, ...COLS.map((c) => f[c] ?? null), existing.id,
    );
    return existing.id;
  }
  return (
    await db.runAsync(
      `INSERT INTO food (name, source, barcode, ${COL_LIST()}) VALUES (?, ?, ?, ${COLS.map(() => '?').join(', ')})`,
      f.name, f.source, f.barcode, ...COLS.map((c) => f[c] ?? null),
    )
  ).lastInsertRowId;
}

// ── Saved meals / prep batches ──
export type SavedMeal = { id: number; name: string; servings_per_batch: number };
export type SavedMealItem = { id: number; food_id: number; name: string; grams: number } & Per100;

export function getSavedMealItems(db: SQLiteDatabase, mealId: number) {
  return db.getAllAsync<SavedMealItem>(
    `SELECT i.id, i.food_id, f.name, i.grams, ${COL_LIST('f.')}
     FROM saved_meal_item i JOIN food f ON f.id = i.food_id WHERE i.saved_meal_id = ? ORDER BY i.id`,
    mealId,
  );
}

export function batchMacros(items: SavedMealItem[]): Macros {
  return items.reduce((acc, it) => addMacros(acc, macrosFor(it, it.grams)), ZERO);
}

export async function listSavedMeals(db: SQLiteDatabase) {
  const meals = await db.getAllAsync<SavedMeal>('SELECT * FROM saved_meal ORDER BY name COLLATE NOCASE');
  return Promise.all(
    meals.map(async (m) => {
      const total = batchMacros(await getSavedMealItems(db, m.id));
      return { ...m, perServing: scaleMacros(total, 1 / (m.servings_per_batch || 1)) };
    }),
  );
}

export function getSavedMeal(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<SavedMeal>('SELECT * FROM saved_meal WHERE id = ?', id);
}

export async function createSavedMeal(db: SQLiteDatabase, name: string, servings: number) {
  return (await db.runAsync('INSERT INTO saved_meal (name, servings_per_batch) VALUES (?, ?)', name, servings)).lastInsertRowId;
}

export async function updateSavedMeal(db: SQLiteDatabase, id: number, name: string, servings: number) {
  await db.runAsync('UPDATE saved_meal SET name = ?, servings_per_batch = ? WHERE id = ?', name, servings, id);
}

export async function deleteSavedMeal(db: SQLiteDatabase, id: number) {
  const used = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM food_log WHERE saved_meal_id = ?', id);
  if (used?.n) throw new Error('This meal is in your food log, so it can’t be deleted. Rename it instead.');
  await db.runAsync('DELETE FROM saved_meal WHERE id = ?', id);
}

export async function addSavedMealItem(db: SQLiteDatabase, mealId: number, foodId: number, grams: number) {
  await db.runAsync('INSERT INTO saved_meal_item (saved_meal_id, food_id, grams) VALUES (?, ?, ?)', mealId, foodId, grams);
}

export async function updateSavedMealItem(db: SQLiteDatabase, id: number, grams: number) {
  await db.runAsync('UPDATE saved_meal_item SET grams = ? WHERE id = ?', grams, id);
}

export async function removeSavedMealItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM saved_meal_item WHERE id = ?', id);
}

// ── Food log ──
export type LogEntry = {
  id: number;
  date: string;
  meal: Meal;
  food_id: number | null;
  saved_meal_id: number | null;
  grams: number | null;
  servings: number | null;
  photo_path: string | null;
  name: string;
  macros: Macros;
  /** From your groceries/restaurant item, if this food is one. */
  serving_g: number | null;
  serving_label: string | null;
};

export async function listLog(db: SQLiteDatabase, date: string): Promise<LogEntry[]> {
  const rows = await db.getAllAsync<
    Omit<LogEntry, 'name' | 'macros'> & { food_name: string | null; meal_name: string | null } & Per100
  >(
    `SELECT l.*, f.name AS food_name, m.name AS meal_name, ${COL_LIST('f.')}
     , p.serving_g, p.serving_label
     FROM food_log l LEFT JOIN food f ON f.id = l.food_id LEFT JOIN saved_meal m ON m.id = l.saved_meal_id
     LEFT JOIN pantry_item p ON p.food_id = l.food_id
     WHERE l.date = ? ORDER BY l.id`,
    date,
  );
  const mealCache = new Map<number, Macros>();
  const out: LogEntry[] = [];
  for (const r of rows) {
    let macros = ZERO;
    if (r.food_id) macros = macrosFor(r, r.grams ?? 0);
    else if (r.saved_meal_id) {
      if (!mealCache.has(r.saved_meal_id)) {
        const meal = await getSavedMeal(db, r.saved_meal_id);
        const total = batchMacros(await getSavedMealItems(db, r.saved_meal_id));
        mealCache.set(r.saved_meal_id, scaleMacros(total, 1 / (meal?.servings_per_batch || 1)));
      }
      macros = scaleMacros(mealCache.get(r.saved_meal_id)!, r.servings ?? 1);
    }
    out.push({
      id: r.id,
      date: r.date,
      meal: r.meal,
      food_id: r.food_id,
      saved_meal_id: r.saved_meal_id,
      grams: r.grams,
      servings: r.servings,
      photo_path: r.photo_path,
      name: r.food_name ?? r.meal_name ?? 'Unknown',
      macros,
      serving_g: r.serving_g,
      serving_label: r.serving_label,
    });
  }
  return out;
}

export async function dayTotals(db: SQLiteDatabase, date: string) {
  return (await listLog(db, date)).reduce((acc, e) => addMacros(acc, e.macros), ZERO);
}

export function getLogEntry(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<{ id: number; date: string; meal: Meal; food_id: number | null; saved_meal_id: number | null; grams: number | null; servings: number | null }>(
    'SELECT id, date, meal, food_id, saved_meal_id, grams, servings FROM food_log WHERE id = ?',
    id,
  );
}

export async function logFood(db: SQLiteDatabase, date: string, meal: Meal, foodId: number, grams: number, photoPath: string | null = null) {
  await db.runAsync(
    'INSERT INTO food_log (date, meal, food_id, grams, photo_path) VALUES (?, ?, ?, ?, ?)',
    date, meal, foodId, grams, photoPath,
  );
}

export async function logSavedMeal(db: SQLiteDatabase, date: string, meal: Meal, savedMealId: number, servings: number) {
  await db.runAsync(
    'INSERT INTO food_log (date, meal, saved_meal_id, servings) VALUES (?, ?, ?, ?)',
    date, meal, savedMealId, servings,
  );
}

export async function updateLogEntry(db: SQLiteDatabase, id: number, meal: Meal, amount: { grams: number } | { servings: number }) {
  if ('grams' in amount) await db.runAsync('UPDATE food_log SET meal = ?, grams = ? WHERE id = ?', meal, amount.grams, id);
  else await db.runAsync('UPDATE food_log SET meal = ?, servings = ? WHERE id = ?', meal, amount.servings, id);
}

export async function deleteLogEntry(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM food_log WHERE id = ?', id);
}

// ── Targets ──
// kcal/protein/carbs/fat are your targets; fiber is a minimum goal; sugar, sat fat and sodium are upper limits.
export type Targets = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
};
const TARGET_COLS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sat_fat_g', 'sodium_mg'] as const;

export async function getTargets(db: SQLiteDatabase): Promise<Targets> {
  const row = await db.getFirstAsync<Targets>(`SELECT ${TARGET_COLS.join(', ')} FROM targets WHERE id = 1`);
  return row ?? (Object.fromEntries(TARGET_COLS.map((c) => [c, null])) as Targets);
}

export async function saveTargets(db: SQLiteDatabase, t: Targets) {
  await db.runAsync(
    `INSERT INTO targets (id, ${TARGET_COLS.join(', ')}) VALUES (1, ${TARGET_COLS.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${TARGET_COLS.map((c) => `${c} = excluded.${c}`).join(', ')}`,
    ...TARGET_COLS.map((c) => t[c]),
  );
}

/** Updates a food in place (name, source and all nutrients). */
export async function updateFood(db: SQLiteDatabase, id: number, f: FoodInput) {
  await db.runAsync(
    `UPDATE food SET name = ?, source = ?, ${COLS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    f.name,
    f.source,
    ...COLS.map((c) => f[c] ?? null),
    id,
  );
}

/** "2 slices (57 g)", "1 item", "1.5 servings" or "150 g" for a log entry. */
export function amountLabel(e: Pick<LogEntry, 'grams' | 'servings' | 'serving_g' | 'serving_label'>): string {
  if (e.grams === null) return `${e.servings} serving${e.servings === 1 ? '' : 's'}`;
  if (e.serving_g && e.serving_label) {
    const n = e.grams / e.serving_g;
    if (Math.abs(n * 2 - Math.round(n * 2)) < 0.05) {
      const count = Math.round(n * 2) / 2;
      const unit = `${e.serving_label}${count === 1 ? '' : 's'}`;
      // Restaurant items and recipe servings often have a nominal weight; grams would mislead.
      return e.serving_label === 'item' || e.serving_label === 'serving' ? `${count} ${unit}` : `${count} ${unit} (${Math.round(e.grams)} g)`;
    }
  }
  return `${Math.round(e.grams)} g`;
}
