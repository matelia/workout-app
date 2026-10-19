import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MacroSummary } from '@/components/MacroSummary';
import { NutritionCheck } from '@/components/NutritionCheck';
import { SwipeRow } from '@/components/SwipeRow';
import { Card, Row, Screen, T } from '@/components/ui';
import { addMacros, amountLabel, deleteLogEntry, getTargets, listLog, MEAL_LABELS, MEALS, mealForNow, ZERO, type LogEntry } from '@/db/repos/food';
import { pendingSnapshotCount } from '@/db/repos/snapshots';
import { useDbQuery } from '@/hooks/useDbQuery';
import { addDays, formatDate, todayStr } from '@/lib/dates';
import { href } from '@/lib/href';
import { photoUri } from '@/lib/snapshotClient';
import { radius, space, useColors } from '@/theme';

async function load(db: SQLiteDatabase, date: string) {
  const [log, targets, pending] = await Promise.all([listLog(db, date), getTargets(db), pendingSnapshotCount(db)]);
  return { log, targets, pending };
}

export default function FoodHome() {
  const router = useRouter();
  const c = useColors();
  const [date, setDate] = useState(todayStr());
  const { data, reload } = useDbQuery((d) => load(d, date), date);
  const totals = (data?.log ?? []).reduce((acc, e) => addMacros(acc, e.macros), ZERO);
  const isToday = date === todayStr();
  const defaultMeal = isToday ? mealForNow() : 'snack';

  const quick = (icon: SFSymbol, label: string, to: never) => (
    <Pressable onPress={() => router.push(to)} style={[styles.quick, { backgroundColor: c.card, borderColor: c.border }]}>
      <SymbolView name={icon} tintColor={c.accent} size={22} />
      <Text style={{ color: c.text, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.dateNav}>
        <Pressable hitSlop={12} onPress={() => setDate(addDays(date, -1))}>
          <SymbolView name="chevron.left" tintColor={c.accent} size={18} />
        </Pressable>
        <Pressable onPress={() => setDate(todayStr())}>
          <T variant="heading">{isToday ? 'Today' : formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</T>
        </Pressable>
        <Pressable hitSlop={12} onPress={() => setDate(addDays(date, 1))} disabled={isToday} style={{ opacity: isToday ? 0.3 : 1 }}>
          <SymbolView name="chevron.right" tintColor={c.accent} size={18} />
        </Pressable>
      </View>

      <Card>
        {data ? <MacroSummary totals={totals} targets={data.targets} /> : null}
        {data && !data.targets.kcal ? (
          <Pressable onPress={() => router.push('/food/settings')}>
            <T style={{ color: c.accent }}>Set your daily targets →</T>
          </Pressable>
        ) : null}
      </Card>

      {data ? (
        <Card>
          <T variant="label">Healthy-eating check</T>
          <NutritionCheck totals={totals} targets={data.targets} />
        </Card>
      ) : null}

      <View style={styles.quickRow}>
        {quick('camera', 'Snapshot', href('/food/snapshot', { date, meal: defaultMeal }))}
        {quick('barcode.viewfinder', 'Barcode', href('/food/scan', { target: 'log', date, meal: defaultMeal }))}
        {quick('magnifyingglass', 'Search', href('/food/add', { target: 'log', date, meal: defaultMeal }))}
        {quick('takeoutbag.and.cup.and.straw', 'Saved', href('/food/meals', { date, meal: defaultMeal }))}
      </View>

      <Row onPress={() => router.push('/food/settings')}>
        <SymbolView name="gearshape" tintColor={c.accent} size={20} />
        <T style={{ flex: 1 }}>Targets & settings</T>
        <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
      </Row>

      <Row onPress={() => router.push(href('/food/restaurants', { date, meal: defaultMeal }))}>
        <SymbolView name="fork.knife.circle" tintColor={c.accent} size={20} />
        <View style={{ flex: 1 }}>
          <T>Restaurants</T>
          <T variant="muted">Your usual orders at Chick-fil-A, Starbucks… one tap to log.</T>
        </View>
        <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
      </Row>

      <Row onPress={() => router.push('/food/groceries')}>
        <SymbolView name="cart" tintColor={c.accent} size={20} />
        <View style={{ flex: 1 }}>
          <T>My groceries</T>
          <T variant="muted">Scan what you buy at Costco, Wegmans… Snapshots and search use them first.</T>
        </View>
        <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
      </Row>

      {data?.pending ? (
        <Row onPress={() => router.push('/food/queue')}>
          <SymbolView name="tray.full" tintColor={c.accent} size={20} />
          <T style={{ flex: 1 }}>
            {data.pending} snapshot{data.pending === 1 ? '' : 's'} waiting
          </T>
          <SymbolView name="chevron.right" tintColor={c.textMuted} size={14} />
        </Row>
      ) : null}

      {MEALS.map((meal) => {
        const entries = data?.log.filter((e) => e.meal === meal) ?? [];
        const kcal = entries.reduce((n, e) => n + e.macros.kcal, 0);
        return (
          <Card key={meal}>
            <View style={styles.mealHeader}>
              <T variant="heading" style={{ flex: 1 }}>
                {MEAL_LABELS[meal]}
              </T>
              {entries.length ? <T variant="muted">{Math.round(kcal)} kcal</T> : null}
              <Pressable
                hitSlop={10}
                accessibilityLabel={`Add to ${MEAL_LABELS[meal]}`}
                onPress={() => router.push(href('/food/add', { target: 'log', date, meal }))}>
                <SymbolView name="plus.circle" tintColor={c.accent} size={22} />
              </Pressable>
            </View>
            {groupParts(entries).map((block, bi) =>
              block.photo ? (
                <View key={block.photo} style={[styles.part, { borderColor: c.border }]}>
                  <View style={styles.partHeader}>
                    <Image source={{ uri: photoUri(block.photo) }} style={styles.partThumb} contentFit="cover" />
                    <T variant="label" style={{ flex: 1 }}>
                      Snapshot part {block.partNo}
                    </T>
                    <T variant="muted">{Math.round(block.items.reduce((n, e) => n + e.macros.kcal, 0))} kcal</T>
                  </View>
                  {block.items.map((e) => (
                    <EntryRow key={e.id} e={e} onChanged={reload} />
                  ))}
                </View>
              ) : (
                <EntryRow key={`e${bi}`} e={block.items[0]} onChanged={reload} />
              ),
            )}
            {entries.some((e) => e.photo_path) ? (
              <Pressable onPress={() => router.push(href('/food/snapshot', { date, meal, next: 'meal' }))}>
                <T style={{ color: c.accent }}>+ Snap next part</T>
              </Pressable>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

/** Consecutive entries from the same snapshot photo form one "part" of the meal. */
function groupParts(entries: LogEntry[]) {
  const blocks: { photo: string | null; partNo: number; items: LogEntry[] }[] = [];
  let part = 0;
  for (const e of entries) {
    const last = blocks.at(-1);
    if (e.photo_path && last?.photo === e.photo_path) last.items.push(e);
    else blocks.push({ photo: e.photo_path, partNo: e.photo_path ? ++part : 0, items: [e] });
  }
  return blocks;
}

function EntryRow({ e, onChanged }: { e: LogEntry; onChanged: () => void }) {
  const router = useRouter();
  const db = useSQLiteContext();
  const edit = () =>
    router.push(
      e.saved_meal_id
        ? href('/food/log-meal', { logId: e.id, mealId: e.saved_meal_id })
        : href('/food/amount', { logId: e.id, foodId: e.food_id }),
    );
  return (
    <SwipeRow
      onEdit={edit}
      onDelete={async () => {
        await deleteLogEntry(db, e.id);
        onChanged();
      }}>
    <Pressable onPress={edit} style={styles.entry}>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{e.name}</T>
        <T variant="muted">
          {amountLabel(e)} ·{' '}
          {Math.round(e.macros.protein)} g protein
        </T>
      </View>
      <T variant="muted">{Math.round(e.macros.kcal)}</T>
    </Pressable>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  part: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, padding: space.sm, gap: 2 },
  partHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  partThumb: { width: 32, height: 32, borderRadius: 6 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickRow: { flexDirection: 'row', gap: space.sm },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
});
