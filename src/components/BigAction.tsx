import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius, space, useColors } from '@/theme';

/** The big lime call-to-action card ("START WORKOUT  →"). */
export function BigAction({ kicker, title, onPress }: { kicker: string; title: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.bigAction, { backgroundColor: c.accent, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.kicker, { color: c.accentText }]} numberOfLines={1}>
          {kicker.toUpperCase()}
        </Text>
        <Text style={[styles.bigTitle, { color: c.accentText }]} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
      </View>
      <SymbolView name="arrow.right" tintColor={c.accentText} size={28} weight="bold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bigAction: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.lg },
  kicker: { fontFamily: fonts.displayBold, fontSize: 15, letterSpacing: 0.6, opacity: 0.75 },
  bigTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38 },
});
