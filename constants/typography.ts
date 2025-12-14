/**
 * Typography system for consistent text styles
 * Based on iOS Human Interface Guidelines and Material Design
 */

export const typography = {
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
    textAlignVertical: 'center' as any,
  },

  // Labels (uppercase, small)
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

