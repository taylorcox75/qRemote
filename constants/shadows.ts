/**
 * iOS-style shadow constants.
 *
 * Note: shadows are invisible on dark backgrounds (#000000, #1C1C1E).
 * Do not rely on shadows for visual hierarchy in dark mode — use
 * surfaceOutline borders or subtle background tints instead.
 *
 * Only `card` and `medium` are active presets. Others are zeroed out for
 * backward compatibility but should not be used in new code.
 */

const none = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

export const shadows = {
  // Zeroed out — kept for backward compatibility
  small: { ...none },

  // Card shadow for standard elevation (light mode only)
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Zeroed out — kept for backward compatibility
  cardPressed: { ...none },

  // Medium shadow for elevated elements (modals, popovers)
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  // Zeroed out — kept for backward compatibility
  large: { ...none },

  // Active filter chip glow — color should come from theme primary
  filterActive: {
    shadowColor: '#007AFF', // TODO: replace with colors.primary from theme
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
};
