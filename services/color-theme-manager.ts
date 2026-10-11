import { storageService } from './storage';
import { DEFAULT_THEME_PRESET_ID, type ThemePreset } from '@/constants/themePresets';
import type { AppPreferences } from '@/types/preferences';

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
  /** Torrent state: downloading only */
  stateDownloading?: string;
  /** Torrent state: idle seeding (100% complete) */
  stateSeeding?: string;
  /** Torrent state: uploading and downloading at once */
  stateUploadAndDownload?: string;
  /** Torrent state: uploading only */
  stateUploadOnly?: string;
  /** Torrent state: error / missing files / stalled download */
  stateError?: string;
  /** Torrent state: stalled upload (not yet complete) */
  stateStalled?: string;
  /** Torrent state: paused or stopped */
  statePaused?: string;
  /** Torrent state: checking (hashing) */
  stateChecking?: string;
  /** Torrent state: metadata download */
  stateMetadata?: string;
  /** Torrent state: queued */
  stateQueued?: string;
  /** Torrent state: other (allocating, moving, unknown) */
  stateOther?: string;
  /**
   * Translucent tint of `primary` (selected rows, cart highlights). Not user
   * editable — only theme presets set it, so a preset that changes `primary`
   * doesn't leave the default blue-tinted highlight behind.
   */
  primaryOpac?: string;
  /**
   * Foreground for text/icons on a filled accent. Not user editable — only
   * theme presets set it.
   */
  onAccent?: string;
}

/**
 * The `ColorTheme` keys a user can edit one by one in Settings → Theme.
 * `primaryOpac` and `onAccent` are preset-only and have no row or picker.
 */
export type EditableColorKey = Exclude<keyof ColorTheme, 'primaryOpac' | 'onAccent'>;

const CUSTOM_COLORS_KEY = 'customColors';
const THEME_PRESET_ID_KEY = 'themePresetId';

function hasAnyColor(theme: ColorTheme | undefined): boolean {
  return !!theme && Object.values(theme).some((value) => value !== undefined);
}

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
    } catch {
      return null;
    }
  },

  /**
   * Save custom colors for a specific theme
   */
  async saveCustomColors(isDark: boolean, colors: ColorTheme): Promise<void> {
    const preferences = await storageService.getPreferences();
    const themeKey = isDark ? 'dark' : 'light';
    const customColors = (preferences[CUSTOM_COLORS_KEY] as Record<string, ColorTheme>) || {};
    customColors[themeKey] = colors;
    await storageService.savePreferences({
      ...preferences,
      [CUSTOM_COLORS_KEY]: customColors,
    });
  },

  /**
   * Reset custom colors for a specific theme
   */
  async resetCustomColors(isDark: boolean): Promise<void> {
    const preferences = await storageService.getPreferences();
    const customColors = (preferences[CUSTOM_COLORS_KEY] as Record<string, ColorTheme>) || {};
    const themeKey = isDark ? 'dark' : 'light';
    delete customColors[themeKey];
    const next: Partial<AppPreferences> = {
      ...preferences,
      [CUSTOM_COLORS_KEY]: customColors,
    };
    // Once neither mode has overrides left, the remembered preset is moot —
    // drop it so a later hand edit isn't labelled "based on" a preset the
    // user already reset away from.
    if (!hasAnyColor(customColors.dark) && !hasAnyColor(customColors.light)) {
      delete next[THEME_PRESET_ID_KEY];
    }
    await storageService.savePreferences(next);
  },

  /**
   * Apply a theme preset: writes BOTH modes' overrides plus `themePresetId`
   * in a single read-modify-write, so a failure can't leave dark from one
   * theme and light from another. Each mode is replaced wholesale (not merged
   * into what was there) so the stored colors deep-equal the preset.
   *
   * The `default` preset is the existing reset: it clears both modes'
   * overrides and the remembered preset id, handing control back to the
   * built-in palettes in ThemeContext.
   */
  async applyThemePreset(preset: ThemePreset): Promise<void> {
    const preferences = await storageService.getPreferences();
    const customColors = {
      ...((preferences[CUSTOM_COLORS_KEY] as Record<string, ColorTheme>) || {}),
    };
    const next: Partial<AppPreferences> = { ...preferences };
    if (preset.id === DEFAULT_THEME_PRESET_ID) {
      delete customColors.dark;
      delete customColors.light;
      delete next[THEME_PRESET_ID_KEY];
    } else {
      customColors.dark = { ...preset.dark };
      customColors.light = { ...preset.light };
      next[THEME_PRESET_ID_KEY] = preset.id;
    }
    next[CUSTOM_COLORS_KEY] = customColors;
    await storageService.savePreferences(next);
  },

  /** Keys used only for torrent state colors (can be reset independently) */
  torrentStateColorKeys: [
    'stateDownloading',
    'stateSeeding',
    'stateUploadAndDownload',
    'stateUploadOnly',
    'stateError',
    'stateStalled',
    'statePaused',
    'stateChecking',
    'stateMetadata',
    'stateQueued',
    'stateOther',
  ] as const,

  /**
   * Reset only torrent state colors to defaults for a specific theme (keeps advanced colors)
   */
  async resetTorrentStateColors(isDark: boolean): Promise<void> {
    const custom = await this.getCustomColors(isDark);
    if (!custom) return;
    const updated = { ...custom };
    this.torrentStateColorKeys.forEach((key) => delete updated[key]);
    await this.saveCustomColors(isDark, updated);
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
    if (rgba.startsWith('#') && (rgba.length === 7 || rgba.length === 4)) return rgba;
    const match = rgba.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!match) return '#000000';

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);

    return `#${[r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')}`;
  },
};
