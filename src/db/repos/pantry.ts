import type { SQLiteDatabase } from 'expo-sqlite';

import { NUTRIENT_COLS, type Food, type Per100 } from '@/db/repos/food';

export const STORES = ['Costco', 'Wegmans', 'Whole Foods', "Trader Joe's", 'Aldi', 'Walmart', 'Target'] as const;

export type PantryItem = {
  id: number;
  food_id: number;
  store: string | null;
  kind: string;
  aliases: string | null; // JSON array
  serving_g: number | null;
  serving_label: string | null;
  in_rotation: number;
  last_bought: string | null;
  place_type: PlaceType;
};

export type PlaceType = 'grocery' | 'restaurant';

/** Pantry item joined with its food (name + nutrition) and how often it's been logged. */
export type PantryProduct = PantryItem & Pick<Food, 'name' | 'barcode'> & Per100 & { times_logged: number };

const SELECT = `SELECT p.*, f.name, f.barcode, ${Object.values(NUTRIENT_COLS).map((c) => `f.${c}`).join(', ')},
    (SELECT COUNT(*) FROM food_log l WHERE l.food_id = p.food_id) AS times_logged
  FROM pantry_item p JOIN food f ON f.id = p.food_id`;

/** Groceries and restaurant items together (for search + snapshot matching), or one place type. */
export function listPantry(db: SQLiteDatabase, onlyRotation = false, place?: PlaceType) {
  const where = [onlyRotation ? 'p.in_rotation = 1' : null, place ? 'p.place_type = ?' : null].filter(Boolean);
  return db.getAllAsync<PantryProduct>(
    `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.in_rotation DESC, p.store, p.kind`,
    ...(place ? [place] : []),
  );
}

export function listRestaurantItems(db: SQLiteDatabase, restaurant: string) {
  return db.getAllAsync<PantryProduct>(
    `${SELECT} WHERE p.place_type = 'restaurant' AND p.store = ? ORDER BY times_logged DESC, f.name`,
    restaurant,
  );
}

export function getPantryByFood(db: SQLiteDatabase, foodId: number) {
  return db.getFirstAsync<PantryProduct>(`${SELECT} WHERE p.food_id = ?`, foodId);
}

export function getPantryItem(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<PantryProduct>(`${SELECT} WHERE p.id = ?`, id);
}

export type PantryInput = {
  store: string | null;
  kind: string;
  aliases: string[];
  serving_g: number | null;
  serving_label: string | null;
  in_rotation: boolean;
  place_type?: PlaceType;
};

/** One pantry entry per food: saving again updates it. */
export async function savePantryItem(db: SQLiteDatabase, foodId: number, p: PantryInput) {
  await db.runAsync(
    `INSERT INTO pantry_item (food_id, store, kind, aliases, serving_g, serving_label, in_rotation, place_type, last_bought)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', 'localtime'))
     ON CONFLICT(food_id) DO UPDATE SET store = excluded.store, kind = excluded.kind, aliases = excluded.aliases,
       serving_g = excluded.serving_g, serving_label = excluded.serving_label, in_rotation = excluded.in_rotation`,
    foodId,
    p.store,
    p.kind.trim().toLowerCase(),
    p.aliases.length ? JSON.stringify(p.aliases.map((a) => a.trim().toLowerCase()).filter(Boolean)) : null,
    p.serving_g,
    p.serving_label,
    p.in_rotation ? 1 : 0,
    p.place_type ?? 'grocery',
  );
}

export async function markBought(db: SQLiteDatabase, id: number) {
  await db.runAsync("UPDATE pantry_item SET last_bought = date('now', 'localtime'), in_rotation = 1 WHERE id = ?", id);
}

export async function deletePantryItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM pantry_item WHERE id = ?', id);
}

/** Generic product kinds, sent to the snapshot server so the model names foods the way you buy them. */
export async function pantryKinds(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ kind: string }>('SELECT DISTINCT kind FROM pantry_item WHERE in_rotation = 1 ORDER BY kind');
  return rows.map((r) => r.kind);
}

// ── Restaurants ──
export type Restaurant = { name: string; url: string | null };

/** Starter list; you can add your own. URLs are the chains' official nutrition pages. */
const DEFAULT_RESTAURANTS: Restaurant[] = [
  { name: 'Chick-fil-A', url: 'https://www.chick-fil-a.com/nutrition-allergens' },
  { name: 'Starbucks', url: 'https://www.starbucks.com/menu' },
];

export async function listRestaurants(db: SQLiteDatabase): Promise<(Restaurant & { items: number })[]> {
  const raw = (await db.getFirstAsync<{ value: string }>("SELECT value FROM setting WHERE key = 'restaurants'"))?.value;
  const saved: Restaurant[] = raw ? JSON.parse(raw) : DEFAULT_RESTAURANTS;
  const counts = await db.getAllAsync<{ store: string; n: number }>(
    "SELECT store, COUNT(*) AS n FROM pantry_item WHERE place_type = 'restaurant' GROUP BY store",
  );
  // Any restaurant that has items shows up even if it was removed from the list.
  const names = new Set(saved.map((r) => r.name));
  const all = [...saved, ...counts.filter((c) => !names.has(c.store)).map((c) => ({ name: c.store, url: null }))];
  return all.map((r) => ({ ...r, items: counts.find((c) => c.store === r.name)?.n ?? 0 }));
}

export async function saveRestaurants(db: SQLiteDatabase, list: Restaurant[]) {
  await db.runAsync(
    "INSERT INTO setting (key, value) VALUES ('restaurants', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    JSON.stringify(list),
  );
}
