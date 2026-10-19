import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { SwipeRow } from '@/components/SwipeRow';
import { Empty, Row, Screen, T } from '@/components/ui';
import { createRecipe, deleteRecipe, listRecipes } from '@/db/repos/recipes';
import { createScreenshotJob, getJob } from '@/db/repos/snapshots';
import { useDbQuery } from '@/hooks/useDbQuery';
import { href } from '@/lib/href';
import { pickScreenshots } from '@/lib/media';
import { importRecipeFromUrl } from '@/lib/recipeImport';
import { processJob, processQueue } from '@/lib/snapshotClient';
import { radius, space, useColors } from '@/theme';

export default function Cookbook() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const { data: recipes, reload } = useDbQuery(listRecipes);
  const [busy, setBusy] = useState<string | null>(null);

  function addFromLink() {
    Alert.prompt('Paste a recipe link', 'Wegmans and most recipe sites work.', async (text) => {
      const url = text?.trim();
      if (!url) return;
      setBusy('Reading the recipe…');
      try {
        const r = await importRecipeFromUrl(url);
        const id = await createRecipe(
          db,
          { name: r.name, source_url: url, image_url: r.image, servings: r.servings, ingredients: r.ingredients, steps: r.steps },
          r.nutrition,
          r.nutrition ? 'From the recipe page' : null,
        );
        if (!r.nutrition) processQueue(db).catch(() => {}); // estimates it now, or when the laptop is back
        router.push(`/food/cookbook/${id}`);
      } catch (e) {
        Alert.alert('Couldn’t import that link', `${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(null);
        reload();
      }
    });
  }

  async function addFromScreenshots() {
    const paths = await pickScreenshots('screenshots');
    if (!paths.length) return;
    const jobId = await createScreenshotJob(db, paths, 'recipe');
    setBusy('Reading your screenshots on the laptop… this can take a minute or two.');
    const job = await getJob(db, jobId);
    const result = job ? await processJob(db, job) : 'failed';
    setBusy(null);
    if (result === 'ok') router.push(href('/food/cookbook/review', { id: jobId }));
    else
      Alert.alert(
        result === 'unreachable' ? 'Laptop is offline' : 'Couldn’t read those screenshots',
        result === 'unreachable'
          ? 'Your screenshots are saved. They’ll be read when the laptop is back, and you’ll get a notification.'
          : 'They’re in Food → Snapshot queue, where you can retry or delete them.',
      );
  }

  function add() {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Add a recipe', options: ['Paste a link', 'From screenshots', 'Cancel'], cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) addFromLink();
        if (i === 1) addFromScreenshots();
      },
    );
  }

  return (
    <Screen overlay={<Fab label="Add recipe" onPress={add} />}>
      <T variant="muted">Save recipes you cook, then log them as “1 serving”. A snapshot of the dish will suggest it too.</T>
      {busy ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <ActivityIndicator />
          <T variant="muted" style={{ flex: 1 }}>
            {busy}
          </T>
        </View>
      ) : null}
      {recipes?.length === 0 ? <Empty title="No recipes yet" hint="Tap + to paste a link or add screenshots." /> : null}
      {recipes?.map((r) => (
        <SwipeRow
          key={r.id}
          rounded
          onDelete={async () => {
            await deleteRecipe(db, r.id);
            reload();
          }}>
          <Row onPress={() => router.push(`/food/cookbook/${r.id}`)}>
            {r.image_url ? (
              <Image source={{ uri: r.image_url }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: c.card2 }]} />
            )}
            <View style={{ flex: 1 }}>
              <T numberOfLines={2}>{r.name}</T>
              <T variant="muted">
                {r.kcal !== null
                  ? `${Math.round(r.kcal)} kcal · ${Math.round(r.protein ?? 0)} g protein per serving`
                  : r.nutrition_note === 'pending'
                    ? 'Nutrition: waiting for the laptop'
                    : 'No nutrition yet'}
              </T>
            </View>
          </Row>
        </SwipeRow>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
});
