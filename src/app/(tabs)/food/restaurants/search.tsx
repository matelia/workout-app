import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Field, Row, Screen, T } from '@/components/ui';
import { macrosFor, upsertFood } from '@/db/repos/food';
import { savePantryItem } from '@/db/repos/pantry';
import { getSetting } from '@/db/repos/settings';
import { searchUsda, type UsdaHit } from '@/lib/foodApis';
import { href } from '@/lib/href';
import { space, useColors } from '@/theme';

// USDA has many fast-food chain items (older "SR Legacy" data) and some packaged
// restaurant products ("Branded"). Coverage varies a lot by chain.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function RestaurantSearch() {
  const p = useLocalSearchParams<{ restaurant: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<UsdaHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const key = await getSetting(db, 'usda_api_key');
        const res = await searchUsda(`${p.restaurant} ${query}`.trim(), key, 'SR Legacy,Branded,Survey (FNDDS)');
        // Items that actually mention the chain first.
        const chain = norm(p.restaurant);
        res.sort((a, b) => Number(norm(b.name).includes(chain)) - Number(norm(a.name).includes(chain)));
        if (!cancelled) setHits(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [db, query, p.restaurant]);

  async function pick(h: UsdaHit) {
    const { fdcId: _id, dataType: _dt, serving_g, serving_label, ...food } = h;
    const foodId = await upsertFood(db, food);
    await savePantryItem(db, foodId, {
      store: p.restaurant,
      kind: food.name
        .replace(/\(.*?\)/g, '')
        .replace(new RegExp(p.restaurant.replace(/[^\w]/g, '.?'), 'i'), '')
        .replace(/^[\s,]+/, '')
        .trim()
        .toLowerCase(),
      aliases: [],
      serving_g: serving_g ?? 100,
      serving_label: serving_label ?? 'item',
      in_rotation: true,
      place_type: 'restaurant',
    });
    router.back();
  }

  return (
    <Screen>
      <Field value={query} onChangeText={setQuery} placeholder={`Search ${p.restaurant} items (e.g. sandwich)`} autoFocus autoCorrect={false} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <T variant="label" style={{ flex: 1 }}>
          USDA results
        </T>
        {busy ? <ActivityIndicator /> : null}
      </View>
      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
      {hits?.map((h) => {
        const one = macrosFor(h, h.serving_g ?? 100);
        return (
          <Row key={h.fdcId} onPress={() => pick(h)}>
            <View style={{ flex: 1 }}>
              <T numberOfLines={2}>{h.name}</T>
              <T variant="muted">
                {h.serving_g
                  ? `1 ${h.serving_label ?? 'serving'} (${h.serving_g} g): ${Math.round(one.kcal)} kcal · ${Math.round(one.protein)} g protein`
                  : `Per 100 g: ${h.kcal_100g ?? '?'} kcal · ${h.protein_100g ?? '?'} g protein`}
              </T>
            </View>
          </Row>
        );
      })}
      {hits && !busy ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <T variant="muted">
            {hits.length ? 'Not the right item?' : `USDA has nothing matching for ${p.restaurant}.`} Enter it from their nutrition info
            instead; it only takes a minute, once.
          </T>
          <Button
            title="Enter it manually"
            variant="secondary"
            onPress={() => router.replace(href('/food/restaurants/item', { restaurant: p.restaurant }))}
          />
        </View>
      ) : null}
    </Screen>
  );
}
