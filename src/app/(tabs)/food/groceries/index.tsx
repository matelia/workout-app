import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActionSheetIOS, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { SwipeRow } from '@/components/SwipeRow';
import { Chip, ChipRow, Empty, Row, Screen, T } from '@/components/ui';
import { deletePantryItem, listPantry, type PantryProduct } from '@/db/repos/pantry';
import { useDbQuery } from '@/hooks/useDbQuery';
import { href } from '@/lib/href';
import { useColors } from '@/theme';

export default function Groceries() {
  const router = useRouter();
  const c = useColors();
  const [all, setAll] = useState(false);
  const db = useSQLiteContext();
  const { data: items, reload } = useDbQuery((d) => listPantry(d, !all, 'grocery'), String(all));

  function add() {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Add a grocery product', options: ['Scan barcode', 'Search foods', 'Enter manually', 'Cancel'], cancelButtonIndex: 3 },
      (i) => {
        if (i === 0) router.push(href('/food/scan', { target: 'pantry' }));
        if (i === 1) router.push(href('/food/add', { target: 'pantry' }));
        if (i === 2) router.push(href('/food/manual', { target: 'pantry' }));
      },
    );
  }

  const byStore = new Map<string, PantryProduct[]>();
  for (const it of items ?? []) {
    const k = it.store ?? 'No store';
    if (!byStore.has(k)) byStore.set(k, []);
    byStore.get(k)!.push(it);
  }

  return (
    <Screen overlay={<Fab label="Add grocery product" onPress={add} />}>
      <T variant="muted">
        The products you actually buy. Snapshots and searches pick these first, e.g. “peanut butter” becomes your Whole Foods
        one.
      </T>
      <ChipRow>
        <Chip label="In rotation" selected={!all} onPress={() => setAll(false)} />
        <Chip label="All" selected={all} onPress={() => setAll(true)} />
      </ChipRow>
      {items?.length === 0 ? <Empty title="No groceries yet" hint="Tap + and scan the barcode of something you buy." /> : null}
      {[...byStore.entries()].map(([store, list]) => (
        <View key={store} style={{ gap: 8 }}>
          <T variant="label">{store}</T>
          {list.map((p) => (
            <SwipeRow
              key={p.id}
              rounded
              deleteLabel="Remove"
              onEdit={() => router.push(`/food/groceries/${p.id}`)}
              onDelete={async () => {
                await deletePantryItem(db, p.id);
                reload();
              }}>
            <Row onPress={() => router.push(`/food/groceries/${p.id}`)}>
              <View style={{ flex: 1 }}>
                <T numberOfLines={1}>{p.name}</T>
                <T variant="muted">
                  {p.kind}
                  {p.serving_g ? ` · 1 ${p.serving_label ?? 'serving'} = ${p.serving_g} g` : ''}
                  {p.kcal_100g !== null ? ` · ${Math.round(p.kcal_100g)} kcal/100 g` : ''}
                </T>
              </View>
              {!p.in_rotation ? <T variant="muted">paused</T> : null}
              <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
            </Row>
            </SwipeRow>
          ))}
        </View>
      ))}
    </Screen>
  );
}
