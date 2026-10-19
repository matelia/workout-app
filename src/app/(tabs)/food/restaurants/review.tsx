import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { upsertFood, type FoodInput } from '@/db/repos/food';
import { savePantryItem } from '@/db/repos/pantry';
import { getJob, setJobStatus, type SnapshotJob } from '@/db/repos/snapshots';
import { space, useColors } from '@/theme';

type MenuItem = {
  name: string;
  serving_g: number | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Review menu items read from restaurant nutrition screenshots; save the ones you order. */
export default function MenuReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [job, setJob] = useState<SnapshotJob | null>(null);
  const [restaurant, setRestaurant] = useState('');
  const [items, setItems] = useState<(MenuItem & { keep: boolean })[]>([]);

  useEffect(() => {
    getJob(db, Number(id)).then((j) => {
      if (!j?.model_output_json) return;
      setJob(j);
      setRestaurant(j.context ? (JSON.parse(j.context).restaurant ?? '') : '');
      const out = JSON.parse(j.model_output_json) as { items: MenuItem[] };
      setItems(out.items.map((it) => ({ ...it, keep: true })));
    });
  }, [db, id]);

  async function save() {
    if (!job || !restaurant.trim()) return;
    for (const it of items.filter((x) => x.keep && x.name.trim())) {
      const w = it.serving_g && it.serving_g > 0 ? it.serving_g : 100; // nominal 100 g "item" when weight unknown
      const per100 = (v: number | null) => (v === null || v === undefined ? null : r1((v * 100) / w));
      const food: FoodInput = {
        name: `${it.name.trim()} (${restaurant.trim()})`,
        source: 'manual',
        barcode: null,
        kcal_100g: per100(it.kcal),
        protein_100g: per100(it.protein_g),
        carbs_100g: per100(it.carbs_g),
        fat_100g: per100(it.fat_g),
        fiber_100g: per100(it.fiber_g),
        sugar_100g: per100(it.sugar_g),
        sat_fat_100g: per100(it.sat_fat_g),
        sodium_mg_100g: per100(it.sodium_mg),
      };
      const foodId = await upsertFood(db, food);
      await savePantryItem(db, foodId, {
        store: restaurant.trim(),
        kind: it.name.trim().toLowerCase(),
        aliases: [],
        serving_g: w,
        serving_label: 'item',
        in_rotation: true,
        place_type: 'restaurant',
      });
    }
    await setJobStatus(db, job.id, 'done');
    router.back();
  }

  if (!job) return null;
  const kept = items.filter((x) => x.keep).length;

  return (
    <Screen>
      <Field label="Restaurant" value={restaurant} onChangeText={setRestaurant} />
      <T variant="muted">
        {items.length} items read from your screenshots. Untick the ones you never order; check the numbers against the menu.
      </T>
      {items.map((it, i) => (
        <Card key={i} style={{ opacity: it.keep ? 1 : 0.5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Pressable
              hitSlop={8}
              onPress={() => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}>
              <SymbolView name={it.keep ? 'checkmark.circle.fill' : 'circle'} tintColor={it.keep ? c.accent : c.textMuted} size={24} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Field value={it.name} onChangeText={(v) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, name: v } : x)))} />
            </View>
          </View>
          <T variant="muted">
            {[
              `${it.kcal ?? '?'} kcal`,
              `P ${it.protein_g ?? '?'}`,
              `C ${it.carbs_g ?? '?'}`,
              `F ${it.fat_g ?? '?'}`,
              it.sodium_mg !== null ? `${it.sodium_mg} mg sodium` : null,
              it.serving_g ? `${it.serving_g} g` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </Card>
      ))}
      <Button title={`Save ${kept} item${kept === 1 ? '' : 's'}`} onPress={save} disabled={!kept || !restaurant.trim()} />
    </Screen>
  );
}
