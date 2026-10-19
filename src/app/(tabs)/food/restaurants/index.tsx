import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { Alert, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { SwipeRow } from '@/components/SwipeRow';
import { Row, Screen, T } from '@/components/ui';
import { listRestaurants, saveRestaurants } from '@/db/repos/pantry';
import { useDbQuery } from '@/hooks/useDbQuery';
import { href } from '@/lib/href';
import { useColors } from '@/theme';

export default function Restaurants() {
  const p = useLocalSearchParams<{ date?: string; meal?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const { data: list, reload } = useDbQuery(listRestaurants);

  function add() {
    Alert.prompt('Add a restaurant', 'e.g. Chipotle, Panera', async (name) => {
      const n = name?.trim();
      if (!n || !list || list.some((r) => r.name.toLowerCase() === n.toLowerCase())) return;
      await saveRestaurants(db, [...list.map(({ name: rn, url }) => ({ name: rn, url })), { name: n, url: null }]);
      reload();
    });
  }

  async function remove(name: string, items: number) {
    const go = async () => {
      await saveRestaurants(db, list!.filter((r) => r.name !== name).map(({ name: rn, url }) => ({ name: rn, url })));
      reload();
    };
    if (!items) return go();
    Alert.alert(`Remove ${name}?`, `Its ${items} saved item${items === 1 ? '' : 's'} stay in your food history.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  }

  return (
    <Screen overlay={<Fab label="Add restaurant" onPress={add} />}>
      <T variant="muted">
        Save what you usually order once, then log it as “1 item” in a tap. Snapshots of the same food will suggest it too.
      </T>
      {list?.map((r) => (
        <SwipeRow key={r.name} rounded deleteLabel="Remove" onDelete={() => remove(r.name, r.items)}>
          <Row onPress={() => router.push(href('/food/restaurants/menu', { restaurant: r.name, date: p.date, meal: p.meal }))}>
            <SymbolView name="fork.knife.circle" tintColor={c.accent} size={22} />
            <View style={{ flex: 1 }}>
              <T>{r.name}</T>
              <T variant="muted">{r.items ? `${r.items} saved item${r.items === 1 ? '' : 's'}` : 'No items yet'}</T>
            </View>
            <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
          </Row>
        </SwipeRow>
      ))}
    </Screen>
  );
}
