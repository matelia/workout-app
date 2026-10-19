import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F4F7',
  card: '#FFFFFF',
  cardPressed: '#ECECF1',
  border: '#E1E1E7',
  text: '#111114',
  textMuted: '#6B6B76',
  accent: '#3A6FF7',
  accentText: '#FFFFFF',
  success: '#1FA35C',
  danger: '#E5484D',
};

const dark: typeof light = {
  bg: '#0B0B0F',
  card: '#17171C',
  cardPressed: '#222229',
  border: '#2A2A32',
  text: '#F2F2F5',
  textMuted: '#9A9AA5',
  accent: '#5B8CFF',
  accentText: '#FFFFFF',
  success: '#3CCB7F',
  danger: '#FF6369',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useNavTheme(): Theme {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? dark : light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.bg,
      card: c.card,
      text: c.text,
      border: c.border,
    },
  };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
