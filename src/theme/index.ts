import { DarkTheme, type Theme } from 'expo-router';

// "Steady" design (the app is now called Tend): always dark, near-black surfaces, lime as the one action color,
// coral as the second data color, condensed display type for titles and big numbers.

const colors = {
  bg: '#0E0E0E',
  card: '#1B1B1B',
  cardPressed: '#262626',
  /** Raised surface inside a card (tracks, chips, secondary buttons). */
  card2: '#262626',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textMuted: '#9A9A9A',
  accent: '#C6F432',
  accentText: '#111111',
  /** Second data color (protein, secondary rings). */
  accent2: '#FF5A36',
  /** Third data color (steps). */
  accent3: '#3DA5FF',
  success: '#C6F432',
  warning: '#FFB020',
  danger: '#FF453A',
};

export type Colors = typeof colors;

/** The app is dark-only; kept as a hook so screens don't care. */
export function useColors(): Colors {
  return colors;
}

export const fonts = {
  /** Big numbers and screen titles. */
  display: 'BarlowCondensed_800ExtraBold',
  /** Section headings, labels. */
  displayBold: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
};

export function useNavTheme(): Theme {
  return {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.border,
    },
  };
}

/** Shared header styling for every Stack. */
export const stackScreenOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.accent,
  headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  headerLargeTitleStyle: { fontFamily: fonts.display, fontSize: 40, color: colors.text },
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: colors.bg },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 10, md: 14, lg: 18 } as const;
