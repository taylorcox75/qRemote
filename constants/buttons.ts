/**
 * Shared button styles for consistent UI across the app
 * Based on Material Design principles
 */

import { spacing, borderRadius } from './spacing';
import { shadows } from './shadows';

export const buttonStyles = {
  // Primary action button (blue background, white text)
  primary: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.medium,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...shadows.small,
  },

  // Secondary button (outlined)
  secondary: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // Small button (compact)
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.small,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // Icon button (square/circular)
  icon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...shadows.small,
  },

  // FAB (Floating Action Button)
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...shadows.medium,
  },

  // Chip/Tag button
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.medium,
    gap: spacing.xs,
    minHeight: 32,
  },
};

export const buttonText = {
  primary: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },

  secondary: {
    fontSize: 16,
    fontWeight: '600' as const,
  },

  small: {
    fontSize: 14,
    fontWeight: '600' as const,
  },

  chip: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
};

