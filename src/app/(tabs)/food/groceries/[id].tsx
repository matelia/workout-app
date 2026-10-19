import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Field, Screen, T } from '@/components/ui';
import { getFood, type Food } from '@/db/repos/food';
import { deletePantryItem, getPantryByFood, getPantryItem, markBought, savePantryItem, STORES } from '@/db/repos/pantry';
import { getSetting, setSetting } from '@/db/repos/settings';
import { space, useColors } from '@/theme';

type Params = { id: string; foodId?: string; kind?: string; serving_g?: string; serving_label?: string; store?: string };

/** Create (id = "new", with foodId) or edit a grocery product. */
export default function GroceryEdit() {
  const p = useLocalSearchParams<Params>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();

  const [itemId, setItemId] = useState<number | null>(p.id === 'new' ? null : Number(p.id));
  const [food, setFood] = useState<Food | null>(null);
  const [store, setStore] = useState<string | null>(p.store ?? null);
  const [kind, setKind] = useState(p.kind ?? '');
  const [aliases, setAliases] = useState('');
  const [servingG, setServingG] = useState(p.serving_g ?? '');
  const [servingLabel, setServingLabel] = useState(p.serving_label ?? '');
  const [rotation, setRotation] = useState(true);
  const [customStores, setCustomStores] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSetting(db, 'custom_stores').then((v) => v && setCustomStores(JSON.parse(v)));
    (async () => {
      // Opened from a scan/search: if that product is already a grocery, edit the existing one.
      const existing = p.id === 'new' && p.foodId ? await getPantryByFood(db, Number(p.foodId)) : null;
      const item = existing ?? (p.id !== 'new' ? await getPantryItem(db, Number(p.id)) : null);
      if (item) {
        if (existing) setNotice('Already in your groceries. Marked as bought again.');
        if (existing) await markBought(db, existing.id);
        setItemId(item.id);
        setStore(item.store);
        setKind(item.kind);
        setAliases(item.aliases ? (JSON.parse(item.aliases) as string[]).join(', ') : '');
        setServingG(item.serving_g?.toString() ?? '');
        setServingLabel(item.serving_label ?? '');
        setRotation(!!item.in_rotation);
        setFood(await getFood(db, item.food_id));
      } else if (p.foodId) {
        const f = await getFood(db, Number(p.foodId));
        setFood(f);
        // Without a suggested kind, start from the last two words of the name (minus the brand),
        // e.g. "Tim Hortons Original Blend Coffee" -> "blend coffee". Short and generic matches best.
        if (!p.kind && f)
          setKind(
            f.name
              .replace(/\(.*?\)/g, '')
              .trim()
              .toLowerCase()
              .split(/\s+/)
              .slice(-2)
              .join(' '),
          );
      }
    })();
  }, [db, p.id, p.foodId, p.kind]);

  function addStore() {
    Alert.prompt('Store name', undefined, async (s) => {
      const name = s?.trim();
      if (!name) return;
      if (![...STORES, ...customStores].includes(name)) {
        const next = [...customStores, name];
        setCustomStores(next);
        await setSetting(db, 'custom_stores', JSON.stringify(next));
      }
      setStore(name);
    });
  }

  async function save() {
    if (!food) return;
    if (!kind.trim()) return setError('Say what it is (e.g. "peanut butter"); that’s what snapshots match on.');
    const g = parseFloat(servingG.replace(',', '.'));
    await savePantryItem(db, food.id, {
      store,
      kind,
      aliases: aliases.split(','),
      serving_g: g > 0 ? g : null,
      serving_label: servingLabel.trim() || null,
      in_rotation: rotation,
    });
    router.dismissTo('/food/groceries');
  }

  if (!food) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: itemId ? 'Grocery product' : 'Add to groceries' }} />
      {notice ? <T style={{ color: c.success }}>{notice}</T> : null}
      <Card>
        <T variant="heading">{food.name}</T>
        <T variant="muted">
          Per 100 g: {food.kcal_100g ?? '?'} kcal · P {food.protein_100g ?? '?'} · C {food.carbs_100g ?? '?'} · F {food.fat_100g ?? '?'}
          {food.barcode ? ` · barcode ${food.barcode}` : ''}
        </T>
      </Card>

      <T variant="label">Where you buy it</T>
      <ChipRow>
        {[...STORES, ...customStores].map((s) => (
          <Chip key={s} label={s} selected={store === s} onPress={() => setStore(store === s ? null : s)} />
        ))}
        <Chip label="+ store" onPress={addStore} />
      </ChipRow>

      <Field
        label="What is it? (used for matching)"
        value={kind}
        onChangeText={setKind}
        placeholder="e.g. peanut butter, white bread, black beans"
        autoCapitalize="none"
      />
      <T variant="muted">Keep it short and generic (“coffee”, “peanut butter”). That’s what a snapshot will call it.</T>
      <Field
        label="Other words for it (optional, comma-separated)"
        value={aliases}
        onChangeText={setAliases}
        placeholder="e.g. pb, toast"
        autoCapitalize="none"
      />

      <T variant="label">Serving (optional)</T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field value={servingLabel} onChangeText={setServingLabel} placeholder="slice, tbsp, can…" autoCapitalize="none" />
        </View>
        <View style={{ flex: 1 }}>
          <Field value={servingG} onChangeText={setServingG} placeholder="grams" keyboardType="decimal-pad" />
        </View>
      </View>
      <T variant="muted">With a serving set, you can log it as “2 slices” instead of grams.</T>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T style={{ flex: 1 }}>In rotation (I buy this regularly)</T>
        <Switch value={rotation} onValueChange={setRotation} />
      </View>

      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
      <Button title="Save" onPress={save} />
      {itemId ? (
        <Button
          title="Remove from groceries"
          variant="danger"
          onPress={() =>
            Alert.alert('Remove from groceries?', 'The food stays in your log history.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  await deletePantryItem(db, itemId);
                  router.back();
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}
