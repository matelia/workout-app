import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, View } from 'react-native';

import { Empty, Row, Screen, T } from '@/components/ui';
import { deleteSavedMeal, listSavedMeals } from '@/db/repos/food';
import { Fab } from '@/components/Fab';
import { SwipeRow } from '@/components/SwipeRow';
import { useDbQuery } from '@/hooks/useDbQuery';
import { href } from '@/lib/href';
import { useColors } from '@/theme';

export default function SavedMeals() {
  const p = useLocalSearchParams<{ date?: string; meal?: string }>();
  const router = useRouter();
  const c = useColors();
  const db = useSQLiteContext();
  const { data: meals, reload } = useDbQuery(listSavedMeals);

  return (
    <Screen overlay={<Fab label="New saved meal" onPress={() => router.push('/food/meals/new')} />}>
      <T variant="muted">Tap a meal to log it. Use the pencil to edit. A meal-prep batch is a saved meal with several servings.</T>
      {meals?.length === 0 ? <Empty title="No saved meals" hint="Tap + to build one from foods." /> : null}
      {meals?.map((m) => (
        <SwipeRow
          key={m.id}
          rounded
          onEdit={() => router.push(`/food/meals/${m.id}`)}
          onDelete={async () => {
            try {
              await deleteSavedMeal(db, m.id);
              reload();
            } catch (e) {
              Alert.alert('Can’t delete', e instanceof Error ? e.message : String(e));
            }
          }}>
        <Row onPress={() => router.push(href('/food/log-meal', { mealId: m.id, date: p.date, meal: p.meal }))}>
          <View style={{ flex: 1 }}>
            <T>{m.name}</T>
            <T variant="muted">
              {m.servings_per_batch > 1 ? `Batch of ${m.servings_per_batch} · ` : ''}
              {Math.round(m.perServing.kcal)} kcal · {Math.round(m.perServing.protein)} g protein per serving
            </T>
          </View>
          <Pressable hitSlop={10} accessibilityLabel={`Edit ${m.name}`} onPress={() => router.push(`/food/meals/${m.id}`)}>
            <SymbolView name="pencil" tintColor={c.accent} size={18} />
          </Pressable>
        </Row>
        </SwipeRow>
      ))}
    </Screen>
  );
}
