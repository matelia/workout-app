// Reads a recipe from a web page via its schema.org "Recipe" JSON-LD (the structured data
// recipe sites publish for Google). Works for Wegmans and most recipe sites. Pure TS.

export type NutritionPerServing = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
};

export type ImportedRecipe = {
  name: string;
  image: string | null;
  servings: number;
  ingredients: string[];
  steps: string[];
  nutrition: NutritionPerServing | null;
  sourceUrl: string;
};

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  const type = o['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return o;
  return findRecipe(o['@graph']) ?? findRecipe(o.mainEntity) ?? null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const m = v.replace(',', '.').match(/[\d.]+/);
  return m ? Number(m[0]) : null;
}

function steps(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return v.split(/\n+/).map(decode).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(steps);
  const o = v as Record<string, unknown>;
  if (o.itemListElement) return steps(o.itemListElement); // HowToSection
  if (typeof o.text === 'string') return [decode(o.text)];
  if (typeof o.name === 'string') return [decode(o.name)];
  return [];
}

function image(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return image(v[0]);
  const o = v as Record<string, unknown>;
  return typeof o.url === 'string' ? o.url : null;
}

function servings(v: unknown): number {
  const first = Array.isArray(v) ? v[0] : v;
  const n = num(first);
  return n && n > 0 && n < 100 ? n : 1;
}

function nutrition(v: unknown): NutritionPerServing | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const sodium = num(o.sodiumContent);
  const n: NutritionPerServing = {
    kcal: num(o.calories),
    protein_g: num(o.proteinContent),
    carbs_g: num(o.carbohydrateContent),
    fat_g: num(o.fatContent),
    fiber_g: num(o.fiberContent),
    sugar_g: num(o.sugarContent),
    sat_fat_g: num(o.saturatedFatContent),
    // some sites give sodium in g
    sodium_mg: sodium !== null && typeof o.sodiumContent === 'string' && /\d\s*g\b/i.test(o.sodiumContent) ? sodium * 1000 : sodium,
  };
  return n.kcal === null ? null : n;
}

export function parseRecipeHtml(html: string, sourceUrl: string): ImportedRecipe | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, json] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(json.trim());
    } catch {
      continue;
    }
    const r = findRecipe(data);
    if (!r) continue;
    return {
      name: decode(String(r.name ?? 'Recipe')),
      image: image(r.image),
      servings: servings(r.recipeYield),
      ingredients: (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map((i) => decode(String(i))).filter(Boolean),
      steps: steps(r.recipeInstructions),
      nutrition: nutrition(r.nutrition),
      sourceUrl,
    };
  }
  return null;
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const res = await fetch(url, {
    headers: {
      // Some sites only serve full HTML to browsers.
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`That page returned ${res.status}.`);
  const recipe = parseRecipeHtml(await res.text(), url);
  if (!recipe) throw new Error('No recipe data found on that page. Try screenshots instead.');
  return recipe;
}
