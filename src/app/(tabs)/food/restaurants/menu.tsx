import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Linking, Pressable, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { SwipeRow } from '@/components/SwipeRow';
import { Button, Empty, Screen, T } from '@/components/ui';
import { macrosFor } from '@/db/repos/food';
import { deletePantryItem, listRestaurantItems, listRestaurants } from '@/db/repos/pantry';
import { createScreenshotJob, getJob } from '@/db/repos/snapshots';
import { useDbQuery } from '@/hooks/useDbQuery';
import { href } from '@/lib/href';
import { pickScreenshots } from '@/lib/media';
import { processJob } from '@/lib/snapshotClient';
import { space } from '@/theme';

/** One restaurant's saved items. Tap to log one; swipe to edit/delete; + to add. */
export default function RestaurantMenu() {
  const p = useLocalSearchParams<{ restaurant: string; date?: string; meal?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { data: items, reload } = useDbQuery((d) => listRestaurantItems(d, p.restaurant), p.restaurant);
  const { data: restaurants } = useDbQuery(listRestaurants);
  const url = restaurants?.find((r) => r.name === p.restaurant)?.url;
  const [busy, setBusy] = useState(false);

  async function importScreenshots() {
    const paths = await pickScreenshots('screenshots');
    if (!paths.length) return;
    const jobId = await createScreenshotJob(db, paths, 'menu', { restaurant: p.restaurant });
    setBusy(true);
    const job = await getJob(db, jobId);
    const result = job ? await processJob(db, job) : 'failed';
    setBusy(false);
    if (result === 'ok') router.push(href('/food/restaurants/review', { id: jobId }));
    else
      Alert.alert(
        result === 'unreachable' ? 'Laptop is offline' : 'Couldn’t read those screenshots',
        result === 'unreachable'
          ? 'Your screenshots are saved. They’ll be read as soon as the laptop is back, and you’ll get a notification.'
          : 'They’re in Food → Snapshot queue, where you can retry or delete them.',
      );
  }

  function add() {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Add a ${p.restaurant} item`,
        options: [`Search ${p.restaurant} in USDA`, 'Import from screenshots', 'Enter from their nutrition info', 'Cancel'],
        cancelButtonIndex: 3,
      },
      (i) => {
        if (i === 0) router.push(href('/food/restaurants/search', { restaurant: p.restaurant }));
        if (i === 1) importScreenshots();
        if (i === 2) router.push(href('/food/restaurants/item', { restaurant: p.restaurant }));
      },
    );
  }

  return (
    <Screen overlay={<Fab label={`Add ${p.restaurant} item`} onPress={add} />}>
      <Stack.Screen options={{ title: p.restaurant }} />
      {url ? (
        <Button title={`${p.restaurant} nutrition info ↗`} variant="secondary" onPress={() => Linking.openURL(url)} />
      ) : null}
      {busy ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <ActivityIndicator />
          <T variant="muted">Reading your screenshots on the laptop… this can take a minute or two.</T>
        </View>
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
