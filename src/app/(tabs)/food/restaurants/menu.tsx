import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionSheetIOS, Linking, Pressable, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { SwipeRow } from '@/components/SwipeRow';
import { Button, Empty, Screen, T } from '@/components/ui';
import { macrosFor } from '@/db/repos/food';
import { deletePantryItem, listRestaurantItems, listRestaurants } from '@/db/repos/pantry';
import { useDbQuery } from '@/hooks/useDbQuery';
import { href } from '@/lib/href';
import { space } from '@/theme';

/** One restaurant's saved items. Tap to log one; swipe to edit/delete; + to add. */
export default function RestaurantMenu() {
  const p = useLocalSearchParams<{ restaurant: string; date?: string; meal?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { data: items, reload } = useDbQuery((d) => listRestaurantItems(d, p.restaurant), p.restaurant);
  const { data: restaurants } = useDbQuery(listRestaurants);
  const url = restaurants?.find((r) => r.name === p.restaurant)?.url;

  function add() {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Add a ${p.restaurant} item`,
        options: [`Search ${p.restaurant} in USDA`, 'Enter from their nutrition info', 'Cancel'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) router.push(href('/food/restaurants/search', { restaurant: p.restaurant }));
        if (i === 1) router.push(href('/food/restaurants/item', { restaurant: p.restaurant }));
      },
    );
  }

  return (
    <Screen overlay={<Fab label={`Add ${p.restaurant} item`} onPress={add} />}>
      <Stack.Screen options={{ title: p.restaurant }} />
      {url ? (
        <Button title={`${p.restaurant} nutrition info ↗`} variant="secondary" onPress={() => Linking.openURL(url)} />
      ) : null}
      {items?.length === 0 ? (
        <Empty title="No saved items" hint={`Tap + to add what you usually get at ${p.restaurant}.`} />
      ) : null}
      {items?.map((it) => {
        const per = macrosFor(it, it.serving_g ?? 100);
        return (
          <SwipeRow
            key={it.id}
            rounded
            onEdit={() => router.push(href('/food/restaurants/item', { restaurant: p.restaurant, id: it.id }))}
            onDelete={async () => {
              await deletePantryItem(db, it.id);
              reload();
            }}>
            <Pressable
              onPress={() =>
                router.push(href('/food/amount', { foodId: it.food_id, grams: it.serving_g ?? 100, date: p.date, meal: p.meal }))
              }
              style={{ padding: space.lg, gap: 2 }}>
              <T>{it.name.replace(` (${p.restaurant})`, '')}</T>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T variant="muted">
                  1 {it.serving_label ?? 'item'} · {Math.round(per.protein)} g protein
                  {it.sodium_mg_100g !== null ? ` · ${Math.round(per.sodium)} mg sodium` : ''}
                </T>
                <T variant="muted">{Math.round(per.kcal)} kcal</T>
              </View>
            </Pressable>
          </SwipeRow>
        );
      })}
    </Screen>
  );
}
