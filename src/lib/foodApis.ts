import type { FoodInput } from '@/db/repos/food';

// Free public food databases. Only food names/barcodes are sent, never personal data.

const round1 = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

export type BarcodeProduct = {
  food: FoodInput;
  /** Serving size in grams, when the label lists one. */
  serving_g: number | null;
  serving_label: string | null;
  /** Generic kind suggested from OFF categories, e.g. "peanut butter". */
  kind: string | null;
};

/** Open Food Facts product lookup by barcode. Returns null if not found. */
export async function lookupBarcodeProduct(barcode: string): Promise<BarcodeProduct | null> {
  const fields = 'product_name,brands,nutriments,serving_size,serving_quantity,generic_name_en,generic_name,categories_tags';
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`, {
    headers: { 'User-Agent': 'PersonalWorkoutApp/1.0 (personal use)' },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Open Food Facts error ${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 1 || !json.product) return null;
  const p = json.product;
  const n = p.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (typeof n.energy_100g === 'number' ? n.energy_100g / 4.184 : null);
  const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : '';
  const name = [p.product_name?.trim() || 'Unnamed product', brand ? `(${brand})` : ''].filter(Boolean).join(' ');
  // "2 slices (57 g)" -> one "slice" = 28.5 g; "2 tbsp (32g)" -> one "tbsp" = 16 g
  const m = typeof p.serving_size === 'string' ? p.serving_size.match(/^\s*([\d.]+(?:\/\d+)?)\s*([a-z]+)/i) : null;
  const rawUnit = m?.[2]?.toLowerCase();
  const isRealUnit = !!rawUnit && !['g', 'gr', 'grams', 'gram', 'ml', 'oz', 'serving', 'servings'].includes(rawUnit);
  const count = m && isRealUnit ? (m[1].includes('/') ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1]) : Number(m[1])) : 1;
  const servingG = Number(p.serving_quantity) / (count > 0 ? count : 1);
  const unit = isRealUnit ? rawUnit : undefined;
  return {
    food: {
      name,
      source: 'off',
      barcode,
      kcal_100g: round1(kcal),
      protein_100g: round1(n.proteins_100g),
      carbs_100g: round1(n.carbohydrates_100g),
      fat_100g: round1(n.fat_100g),
      fiber_100g: round1(n.fiber_100g),
      sugar_100g: round1(n.sugars_100g),
      sat_fat_100g: round1(n['saturated-fat_100g']),
      // OFF stores sodium in g/100 g
      sodium_mg_100g: typeof n.sodium_100g === 'number' ? Math.round(n.sodium_100g * 1000) : null,
    },
    serving_g: Number.isFinite(servingG) && servingG > 0 ? round1(servingG) : null,
    serving_label: unit ? singularLast(unit) : null,
    kind: kindFromProduct(p.generic_name_en || p.generic_name, p.categories_tags),
  };
}

export async function lookupBarcode(barcode: string): Promise<FoodInput | null> {
  return (await lookupBarcodeProduct(barcode))?.food ?? null;
}

function kindFromProduct(generic: unknown, tags: unknown): string | null {
  if (typeof generic === 'string' && generic.trim() && generic.length < 40) return generic.trim().toLowerCase();
  if (!Array.isArray(tags)) return null;
  const en = tags.filter((t): t is string => typeof t === 'string' && t.startsWith('en:'));
  const last = en.at(-1);
  if (!last) return null;
  // "en:creamy-peanut-butters" -> "creamy peanut butter"
  return singularLast(last.slice(3).replace(/-/g, ' '));
}

/** Singularizes the last word: "white breads" -> "white bread", "berries" -> "berry". */
export function singularLast(phrase: string): string {
  return phrase.replace(/(\w+)$/, (w) => {
    if (w.length <= 3) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/(ches|shes|xes|sses|oes)$/.test(w)) return w.slice(0, -2);
    if (/[^s]s$/.test(w)) return w.slice(0, -1);
    return w;
  });
}

export type UsdaHit = FoodInput & {
  fdcId: number;
  dataType: string;
  /** One serving/item, when USDA lists it (e.g. "1 sandwich" = 187 g). */
  serving_g: number | null;
  serving_label: string | null;
};

// USDA nutrient numbers: 208 energy (kcal), 203 protein, 205 carbs, 204 fat.
function nutrient(list: { nutrientNumber?: string; nutrientName?: string; unitName?: string; value?: number }[], num: string) {
  const hit = list.find((x) => x.nutrientNumber === num && (num !== '208' || x.unitName?.toUpperCase() === 'KCAL'));
  if (hit) return hit.value ?? null;
  if (num === '208') {
    // Some Foundation foods only report Atwater energy.
    const alt = list.find((x) => x.nutrientName?.startsWith('Energy') && x.unitName?.toUpperCase() === 'KCAL');
    return alt?.value ?? null;
  }
  return null;
}

/** USDA FoodData Central search. Values are per 100 g. */
export async function searchUsda(
  query: string,
  apiKey: string | null,
  dataType = 'Foundation,SR Legacy,Survey (FNDDS),Branded',
): Promise<UsdaHit[]> {
  const params = new URLSearchParams({
    api_key: apiKey || 'DEMO_KEY',
    query,
    pageSize: '25',
    dataType,
  });
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`);
  if (res.status === 429 || res.status === 403)
    throw new Error('USDA rate limit hit. Add your own free API key in Food → Settings.');
  if (!res.ok) throw new Error(`USDA error ${res.status}`);
  const json = await res.json();
  const hits: UsdaHit[] = (json.foods ?? []).map((f: any) => {
    const brand = f.brandName || f.brandOwner;
    return {
      fdcId: f.fdcId,
      dataType: f.dataType,
      ...usdaServing(f),
      name: brand ? `${titleCase(f.description)} (${brand})` : titleCase(f.description),
      source: 'usda' as const,
      barcode: f.gtinUpc || null,
      kcal_100g: round1(nutrient(f.foodNutrients ?? [], '208')),
      protein_100g: round1(nutrient(f.foodNutrients ?? [], '203')),
      carbs_100g: round1(nutrient(f.foodNutrients ?? [], '205')),
      fat_100g: round1(nutrient(f.foodNutrients ?? [], '204')),
      // 291 fiber, 269 total sugars, 606 saturated fat (g), 307 sodium (mg)
      fiber_100g: round1(nutrient(f.foodNutrients ?? [], '291')),
      sugar_100g: round1(nutrient(f.foodNutrients ?? [], '269')),
      sat_fat_100g: round1(nutrient(f.foodNutrients ?? [], '606')),
      sodium_mg_100g: round1(nutrient(f.foodNutrients ?? [], '307')),
    };
  });
  // Some Foundation entries carry no macros in search results; they're useless here.
  return hits.filter((h) => h.kcal_100g !== null || h.protein_100g !== null);
}

function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Serving info from a USDA search hit: SR Legacy/FNDDS list "foodMeasures"
 * (e.g. "1 sandwich" = 187 g); Branded foods list servingSize + servingSizeUnit.
 */
function usdaServing(f: any): { serving_g: number | null; serving_label: string | null } {
  const measure = (f.foodMeasures ?? []).find((m: any) => typeof m?.gramWeight === 'number' && m.gramWeight > 0);
  if (measure) {
    const text = String(measure.disseminationText ?? '').trim();
    const m = text.match(/^([\d.]+)\s+(.+)$/);
    const count = m ? Number(m[1]) || 1 : 1;
    const label = (m ? m[2] : text).replace(/\(.*?\)/g, '').trim().toLowerCase() || null;
    return { serving_g: round1(measure.gramWeight / count), serving_label: label ? singularLast(label) : null };
  }
  const unit = String(f.servingSizeUnit ?? '').toLowerCase();
  if (typeof f.servingSize === 'number' && f.servingSize > 0 && (unit === 'g' || unit === 'grm')) {
    const household = String(f.householdServingFullText ?? '').match(/^[\d./]+\s*([a-z]+)/i)?.[1]?.toLowerCase();
    return { serving_g: round1(f.servingSize), serving_label: household ? singularLast(household) : null };
  }
  return { serving_g: null, serving_label: null };
}
