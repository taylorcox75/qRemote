/**
 * Consistent spacing constants based on 4px grid
 * Use these instead of hardcoded values for visual consistency
 */

export const spacing = {
  xs: 4, // Extra small - tight spacing
  sm: 8, // Small - minimal gaps
  md: 12, // Medium - default gaps
  lg: 16, // Large - section padding
  xl: 20, // Extra large - card padding
  xxl: 24, // Double XL - large padding
  xxxl: 32, // Triple XL - section spacing
};

/**
 * Border radius constants for consistent rounded corners
 */
export const borderRadius = {
  xsmall: 6, // Chips, badges, small buttons
  small: 8, // Chips, badges, small buttons
  medium: 12, // Cards, inputs, buttons (most common)
  large: 16, // Modals, sheets
  xlarge: 24, // Liquid Glass header bottom corners
  full: 9999, // Pills, circular elements
};

/**
 * Widest a screen's list / settings content column grows on a wide window
 * (iPhone Duo inner screen, iPad). Narrower windows — every regular iPhone —
 * never reach it, so their layout is unchanged. See utils/glass-layout.ts
 * `getReadableGutter` and hooks/useReadableLayout.ts.
 */
export const READABLE_MAX_WIDTH = 800;

/**
 * Torrents split view (iPhone Duo inner screen, iPad): at or above this width
 * (after side insets) the list and the selected torrent's detail sit side by
 * side, the list in a column of SPLIT_LIST_WIDTH.
 */
export const SPLIT_VIEW_MIN_WIDTH = 760;
export const SPLIT_LIST_WIDTH = 400;
