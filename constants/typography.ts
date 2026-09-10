import { Platform } from 'react-native';

/**
 * Typography system for consistent text styles
 * Based on iOS Human Interface Guidelines and Material Design
 */

const baseTypography = {
  // iOS large title (navigation bars, hero sections)
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
  },

  // Headline (torrent names, list item titles — 17pt Semibold)
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },

  // Headers
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
  },

  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 30,
  },

  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },

  h4: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },

  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
  },

  bodyMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },

  bodySemibold: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },

  // Secondary text
  secondary: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
  },

  secondaryMedium: {
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 20,
  },

  // Small text
  small: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 18,
  },

  smallMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 18,
  },

  smallSemibold: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 18,
  },

  // Captions
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },

  captionMedium: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },

  captionSemibold: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    includeFontPadding: false,
    textAlignVertical: 'center' as const,
  },

  // Labels (uppercase, small)
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

/**
 * Mac Catalyst renders with macOS type metrics (HIG: 13pt body, 11pt
 * captions) instead of the iOS ramp above. The scale is decided once at
 * module load from Platform.isMacCatalyst, so every screen that spreads
 * typography.* gets the desktop ramp without per-screen changes, and
 * iPhone/iPad keep the exact values above (Platform.isMacCatalyst is false
 * there). Point sizes map to the closest macOS text style; line heights
 * are recomputed at 1.3x and rounded.
 */
const MAC_FONT_SIZE: Record<number, number> = {
  34: 26,
  28: 22,
  24: 20,
  22: 17,
  20: 15,
  18: 14,
  17: 13,
  16: 13,
  15: 12,
  14: 12,
  13: 11,
  12: 11,
  11: 10,
  10: 10,
};

type TextStyleToken = { fontSize: number; lineHeight?: number; [key: string]: unknown };

function scaleForMac<T extends Record<string, TextStyleToken>>(ramp: T): T {
  const out: Record<string, TextStyleToken> = {};
  for (const key of Object.keys(ramp)) {
    const token = ramp[key];
    const fontSize = MAC_FONT_SIZE[token.fontSize] ?? Math.round(token.fontSize * 0.8);
    out[key] = {
      ...token,
      fontSize,
      ...(token.lineHeight !== undefined ? { lineHeight: Math.round(fontSize * 1.3) } : {}),
    };
  }
  return out as T;
}

const isMacCatalyst = Platform.OS === 'ios' && (Platform.isMacCatalyst ?? false);

export const typography = isMacCatalyst ? scaleForMac(baseTypography) : baseTypography;
