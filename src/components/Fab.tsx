import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { useColors } from '@/theme';

/** Floating round action button, bottom-right. Put it last inside a full-height container. */
export function Fab({ onPress, label, icon = 'plus' }: { onPress: () => void; label: string; icon?: SFSymbol }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}>
      <SymbolView name={icon} tintColor={c.accentText} size={26} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
