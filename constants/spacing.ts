/**
 * Consistent spacing constants based on 4px grid
 * Use these instead of hardcoded values for visual consistency
 *
 * Mac Catalyst uses a denser ramp (macOS forms sit at ~30pt rows and 8pt
 * gaps, versus 44pt rows and 16pt gaps on iOS). Like constants/typography.ts
 * the ramp is chosen once at module load from Platform.isMacCatalyst, so
 * iPhone and iPad keep the exact iOS values below.
 */
import { Platform } from 'react-native';

const isMacCatalyst = Platform.OS === 'ios' && (Platform.isMacCatalyst ?? false);

const iosSpacing = {
  xs: 4, // Extra small - tight spacing
  sm: 8, // Small - minimal gaps
  md: 12, // Medium - default gaps
  lg: 16, // Large - section padding
  xl: 20, // Extra large - card padding
  xxl: 24, // Double XL - large padding
  xxxl: 32, // Triple XL - section spacing
};

const macSpacing: typeof iosSpacing = {
  xs: 3,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  xxl: 18,
  xxxl: 24,
};

export const spacing = isMacCatalyst ? macSpacing : iosSpacing;

const iosBorderRadius = {
  xsmall: 6, // Chips, badges, small buttons
  small: 8, // Chips, badges, small buttons
  medium: 12, // Cards, inputs, buttons (most common)
  large: 16, // Modals, sheets
  full: 9999, // Pills, circular elements
};

const macBorderRadius: typeof iosBorderRadius = {
  xsmall: 4,
  small: 6,
  medium: 8,
  large: 10,
  full: 9999,
};

/**
 * Border radius constants for consistent rounded corners
 */
export const borderRadius = isMacCatalyst ? macBorderRadius : iosBorderRadius;
