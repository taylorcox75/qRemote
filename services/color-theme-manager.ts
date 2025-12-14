import { storageService } from './storage';

export interface ColorTheme {
  primary?: string;
  error?: string;
  success?: string;
  warning?: string;
  background?: string;
  surface?: string;
  surfaceOutline?: string;
  text?: string;
  textSecondary?: string;
}

const CUSTOM_COLORS_KEY = 'customColors';

export const colorThemeManager = {
  /**
   * Get custom colors for current theme (dark/light)
   */
  async getCustomColors(isDark: boolean): Promise<ColorTheme | null> {
    try {
      const preferences = await storageService.getPreferences();
      const customColors = preferences[CUSTOM_COLORS_KEY] as Record<string, ColorTheme> | undefined;
      const themeKey = isDark ? 'dark' : 'light';
      return customColors?.[themeKey] || null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Save custom colors for a specific theme
   */
  async saveCustomColors(isDark: boolean, colors: ColorTheme): Promise<void> {
    try {
      const preferences = await storageService.getPreferences();
      const themeKey = isDark ? 'dark' : 'light';
      const customColors = (preferences[CUSTOM_COLORS_KEY] as Record<string, ColorTheme>) || {};
      customColors[themeKey] = colors;
      await storageService.savePreferences({
        ...preferences,
        [CUSTOM_COLORS_KEY]: customColors,
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * Reset custom colors for a specific theme
   */
  async resetCustomColors(isDark: boolean): Promise<void> {
    try {
      const preferences = await storageService.getPreferences();
      const customColors = (preferences[CUSTOM_COLORS_KEY] as Record<string, ColorTheme>) || {};
      const themeKey = isDark ? 'dark' : 'light';
      delete customColors[themeKey];
      await storageService.savePreferences({
        ...preferences,
        [CUSTOM_COLORS_KEY]: customColors,
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * Merge custom colors with default colors
   */
  mergeColors(defaultColors: ColorTheme, customColors: ColorTheme | null): ColorTheme {
    if (!customColors) return defaultColors;
    return {
      ...defaultColors,
      ...customColors,
    };
  },

  /**
   * Convert hex to rgba string
   */
  hexToRgba(hex: string, alpha: number = 1): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  /**
   * Convert rgba/rgb string to hex
   */
  rgbaToHex(rgba: string): string {
    // Extract numbers from rgba/rgb string
    const match = rgba.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!match) return '#000000';
    
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    
    return `#${[r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  },
};

