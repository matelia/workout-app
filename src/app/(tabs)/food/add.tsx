import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Field, Row, Screen, T } from '@/components/ui';
import { recentFoods, searchLocalFoods, upsertFood, type Food } from '@/db/repos/food';
import { getSetting } from '@/db/repos/settings';
import { listPantry } from '@/db/repos/pantry';
import { useDbQuery } from '@/hooks/useDbQuery';
import { matchPantry } from '@/lib/pantryMatch';
import { searchUsda, type UsdaHit } from '@/lib/foodApis';
import { href } from '@/lib/href';
import { space, useColors } from '@/theme';

type Params = { target: 'log' | 'mealItem' | 'pantry'; date?: string; meal?: string; mealId?: string };

export default function AddFood() {
  const params = useLocalSearchParams<Params>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [query, setQuery] = useState('');
  const [usda, setUsda] = useState<UsdaHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = query.trim();

  const { data: recent } = useDbQuery((d) => recentFoods(d));
  const { data: localAll } = useDbQuery((d) => (q.length >= 2 ? searchLocalFoods(d, q) : Promise.resolve([])), q);
  const { data: pantry } = useDbQuery((d) => listPantry(d, false));

  // Your groceries come first: by match score, or plain text match on name/kind.
  const groceries = (pantry ?? []).filter((g) => {
    if (q.length < 2) return !!g.in_rotation && params.target !== 'pantry';
    const text = `${g.name} ${g.kind} ${g.aliases ?? ''}`.toLowerCase();
    return text.includes(q.toLowerCase()) || matchPantry(q, [g]).length > 0;
  });
  const local = localAll?.filter((f) => !groceries.some((g) => g.food_id === f.id));

  // Debounced USDA search.
  useEffect(() => {
    if (q.length < 3) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const key = await getSetting(db, 'usda_api_key');
        const hits = await searchUsda(q, key);
        if (!cancelled) setUsda(hits);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, db]);

  const shared = { target: params.target, date: params.date, meal: params.meal, mealId: params.mealId };

  function pick(foodId: number, grams?: number) {
    if (params.target === 'pantry') router.push(href('/food/groceries/new', { foodId }));
    else router.push(href('/food/amount', { ...shared, foodId, grams }));
  }

  async function pickUsda(hit: UsdaHit) {
    const { fdcId: _id, dataType: _t, ...food } = hit;
    pick(await upsertFood(db, food));
  }

  const per100 = (f: Pick<Food, 'kcal_100g' | 'protein_100g'>) =>
    `${f.kcal_100g ?? '?'} kcal · ${f.protein_100g ?? '?'} g protein / 100 g`;

  return (
    <Screen>
      <Field value={query} onChangeText={setQuery} placeholder="Search foods (USDA + yours)" autoFocus autoCorrect={false} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Scan barcode" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(href('/food/scan', shared))} />
        <Button title="Enter manually" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(href('/food/manual', { ...shared, name: q }))} />
      </View>

      {groceries.length ? (
        <>
          <T variant="label">My groceries & restaurants</T>
          {groceries.map((g) => (
            <Row key={g.id} onPress={() => pick(g.food_id, g.serving_g ?? undefined)}>
              <SymbolView name="cart" tintColor={c.accent} size={18} />
              <View style={{ flex: 1 }}>
                <T numberOfLines={1}>{g.name}</T>
                <T variant="muted">
                  {[g.store, g.kind, g.serving_g ? `1 ${g.serving_label ?? 'serving'} = ${g.serving_g} g` : null].filter(Boolean).join(' · ')}
                </T>
              </View>
            </Row>
          ))}
        </>
      ) : null}

      {q.length < 2 && recent?.length ? (
        <>
          <T variant="label">Recent</T>
          {recent.map((f) => (
            <Row key={f.id} onPress={() => pick(f.id, f.last_grams)}>
              <View style={{ flex: 1 }}>
                <T numberOfLines={1}>{f.name}</T>
                <T variant="muted">Last time {Math.round(f.last_grams)} g</T>
              </View>
            </Row>
          ))}
        </>
      ) : null}

      {local?.length ? <T variant="label">My foods</T> : null}
      {local?.map((f) => (
        <Row key={f.id} onPress={() => pick(f.id)}>
          <View style={{ flex: 1 }}>
            <T numberOfLines={1}>{f.name}</T>
            <T variant="muted">{per100(f)}</T>
          </View>
        </Row>
      ))}

      {q.length >= 3 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="label">USDA FoodData Central</T>
          {loading ? <ActivityIndicator /> : null}
        </View>
      ) : null}
      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
      {q.length >= 3 &&
        usda.map((h) => (
          <Row key={h.fdcId} onPress={() => pickUsda(h)}>
            <View style={{ flex: 1 }}>
              <T numberOfLines={2}>{h.name}</T>
              <T variant="muted">{per100(h)}</T>
            </View>
            <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
          </Row>
        ))}
    </Screen>
  );
}
