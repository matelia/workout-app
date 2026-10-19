import { singularLast } from '@/lib/foodApis';

// Matches a food name from a snapshot/search ("toast", "canned black beans") to the products
// you actually buy (pantry kinds like "bread", "black beans").
//
// Rules:
// - Head nouns (last words) must agree both ways, so "rice" never
//   matches "rice cakes" and "coffee creamer" never matches "coffee".
// - Score ≥ STRONG: use your product by default. MAYBE ≤ score < STRONG: only suggest it.

export const STRONG = 0.8;
export const MAYBE = 0.6;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'of', 'the', 'with', 'on', 'in',
  'cooked', 'raw', 'fresh', 'plain', 'homemade', 'canned', 'organic', 'store', 'bought',
  'grilled', 'fried', 'baked', 'roasted', 'steamed', 'boiled', 'toasted', 'sliced', 'chopped',
  'piece', 'serving', 'portion', 'some',
]);

// Words that mean the same product for matching purposes.
const SYNONYMS: Record<string, string> = {
  toast: 'bread',
  loaf: 'bread',
  pb: 'peanut',
  spud: 'potato',
  frie: 'fry', // "fries" singularizes to "frie"
  joe: 'coffee',
};

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // drop "(Brand)"
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => singularLast(w))
    .map((w) => SYNONYMS[w] ?? w)
    .filter((w) => !STOPWORDS.has(w));
}

/** 0..1 similarity of a food name to one product phrase (kind or alias). */
export function phraseScore(foodName: string, phrase: string): number {
  const item = tokens(foodName);
  const kind = tokens(phrase);
  if (!item.length || !kind.length) return 0;
  // Head nouns must agree both ways: "rice" ≠ "rice cakes", "coffee creamer" ≠ "coffee".
  if (!item.includes(kind[kind.length - 1]) || !kind.includes(item[item.length - 1])) return 0;
  const overlap = kind.filter((t) => item.includes(t)).length;
  const itemCovered = item.filter((t) => kind.includes(t)).length / item.length;
  const kindCovered = overlap / kind.length;
  const score = 0.4 * itemCovered + 0.6 * kindCovered;
  // Everything the snapshot named is in your product ("coffee" vs "tim hortons original blend coffee"):
  // worth at least a suggestion, even when your product name is long.
  return itemCovered === 1 ? Math.max(score, MAYBE + 0.05) : score;
}

export type Matchable = { kind: string; aliases: string | null; in_rotation: number; times_logged: number };

export function productScore(foodName: string, p: Matchable): number {
  const phrases = [p.kind, ...(p.aliases ? (JSON.parse(p.aliases) as string[]) : [])];
  const base = Math.max(...phrases.map((ph) => phraseScore(foodName, ph)));
  if (base === 0) return 0;
  // Prefer what's in rotation and what you log often.
  return base + (p.in_rotation ? 0.03 : 0) + Math.min(0.05, p.times_logged * 0.005);
}

/** Products scoring at least MAYBE, best first. */
export function matchPantry<T extends Matchable>(foodName: string, products: T[]): { product: T; score: number }[] {
  return products
    .map((product) => ({ product, score: productScore(foodName, product) }))
    .filter((m) => m.score >= MAYBE)
    .sort((a, b) => b.score - a.score);
}
