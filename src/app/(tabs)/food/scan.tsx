import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { findFoodByBarcode, upsertFood } from '@/db/repos/food';
import { lookupBarcode, lookupBarcodeProduct } from '@/lib/foodApis';
import { href } from '@/lib/href';
import { space, useColors } from '@/theme';

type Params = { target?: string; date?: string; meal?: string; mealId?: string };

export default function ScanBarcode() {
  const p = useLocalSearchParams<Params>();
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const busy = useRef(false);
  const shared = { target: p.target ?? 'log', date: p.date, meal: p.meal, mealId: p.mealId };

  async function onScan(code: string) {
    if (busy.current) return;
    busy.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLooking(true);
    setStatus(`Looking up ${code}…`);
    try {
      // Known barcodes never need the network.
      const local = await findFoodByBarcode(db, code);
      if (p.target === 'pantry') {
        const product = local ? null : await lookupBarcodeProduct(code);
        const foodId = local?.id ?? (product ? await upsertFood(db, product.food) : null);
        if (!foodId) router.replace(href('/food/manual', { target: 'pantry', barcode: code }));
        else
          router.replace(
            href('/food/groceries/new', { foodId, kind: product?.kind, serving_g: product?.serving_g, serving_label: product?.serving_label }),
          );
        return;
      }
      const foodId = local?.id ?? (await lookupBarcode(code).then((f) => (f ? upsertFood(db, f) : null)));
      if (foodId) router.replace(href('/food/amount', { ...shared, foodId }));
      else router.replace(href('/food/manual', { ...shared, barcode: code }));
    } catch (e) {
      setStatus(`Lookup failed: ${e instanceof Error ? e.message : String(e)}. Check your connection and try again.`);
      busy.current = false;
      setLooking(false);
    }
  }

  const close = (
    <Pressable hitSlop={12} onPress={() => router.back()}>
      <Text style={{ color: c.accent, fontSize: 17 }}>Close</Text>
    </Pressable>
  );

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.closeBtn, { backgroundColor: c.card }]}>{close}</View>
        <T style={{ textAlign: 'center' }}>Camera access is needed to scan barcodes.</T>
        <Button title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={(r) => onScan(r.data)}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={[styles.closeBtn, { backgroundColor: c.card }]}>{close}</View>
      <View style={[styles.status, { backgroundColor: c.card }]}>
        {status ? (
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            {looking ? <ActivityIndicator /> : null}
            <T style={{ flex: 1 }}>{status}</T>
          </View>
        ) : (
          <T>Point the camera at a barcode.</T>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  closeBtn: { position: 'absolute', top: 60, left: space.lg, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 999 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  frame: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '35%',
    height: 160,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
  },
  status: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.xl * 2, padding: space.lg, borderRadius: 16 },
});
