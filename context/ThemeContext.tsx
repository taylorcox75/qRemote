import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { storageService } from '@/services/storage';
import { colorThemeManager, ColorTheme } from '@/services/color-theme-manager';
import type { ThemeMode } from '@/types/preferences';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceOutline: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryOpac?: string;
  error: string;
  success: string;
  warning: string;
  stateDownloading: string;
  stateSeeding: string;
  stateUploadAndDownload: string;
  stateUploadOnly: string;
  stateError: string;
  stateStalled: string;
  statePaused: string;
  stateChecking: string;
  stateMetadata: string;
  stateQueued: string;
  stateOther: string;
}

interface ThemeContextType {
  isDark: boolean;
  /** User-selected theme mode. 'system' follows the OS appearance. */
  themeMode: ThemeMode;
  /** Toggle between light and dark. Switches to an explicit mode (away from 'system'). */
  toggleTheme: () => void;
  /** Set the theme mode directly. Use 'system' to follow the OS. */
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  reloadCustomColors: () => Promise<void>;
  colors: ThemeColors;
}

function resolveIsDark(
  mode: ThemeMode,
  system: 'light' | 'dark' | 'unspecified' | null | undefined
): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  // 'system' — follow OS; default to dark if the platform can't report it yet.
  return system !== 'light';
}

/**
 * Normalize a stored preference value into a ThemeMode.
 * Accepts:
 *   - new key `themeMode`: 'system' | 'light' | 'dark'
 *   - legacy key `theme`: 'dark' | 'light' | true | false
 */
function normalizeThemeMode(
  themeMode: unknown,
  legacyTheme: unknown
): ThemeMode {
  if (themeMode === 'system' || themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }
  if (legacyTheme === 'light' || legacyTheme === false) return 'light';
  if (legacyTheme === 'dark' || legacyTheme === true) return 'dark';
  return 'system';
}

const lightColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceOutline: '#E5E5EA',
  text: 'rgb(26, 26, 26)',
  textSecondary: 'rgba(142, 142, 147, 1)',
  primary: 'rgba(0, 122, 255, 1)',
  primaryOpac: 'rgba(0, 122, 255, 0.15)',
  error: 'rgba(255, 59, 48, 1)',
  success: 'rgba(52, 199, 89, 1)',
  warning: 'rgba(255, 149, 0, 1)',
  stateDownloading: 'rgba(0, 122, 255, 1)',
  stateSeeding: 'rgb(23, 111, 57)',
  stateUploadOnly: 'rgb(52, 199, 89)',
  stateUploadAndDownload: 'rgba(0, 122, 255, 1)',
  stateError: 'rgba(255, 59, 48, 1)',
  stateStalled: 'rgba(255, 149, 0, 1)',
  statePaused: 'rgba(142, 142, 147, 1)',
  stateChecking: 'rgba(255, 149, 0, 1)',
  stateMetadata: 'rgba(255, 149, 0, 1)',
  stateQueued: 'rgba(142, 142, 147, 1)',
  stateOther: 'rgba(142, 142, 147, 1)',
};

const darkColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceOutline: '#38383A',
  text: 'rgba(255, 255, 255, 1)',
  textSecondary: 'rgba(190, 190, 190, 1)',
  primary: 'rgba(10, 132, 255, 1)',
  primaryOpac: 'rgba(10, 132, 255, 0.2)',
  error: 'rgba(255, 69, 58, 1)',
  success: 'rgba(52, 199, 89, 1)',
  warning: 'rgba(255, 149, 0, 1)',
  stateDownloading: 'rgba(10, 132, 255, 1)',
  stateSeeding: 'rgb(38, 132, 71)',
  stateUploadOnly: 'rgb(48, 209, 88)',
  stateUploadAndDownload: 'rgba(10, 132, 255, 1)',
  stateError: 'rgba(255, 69, 58, 1)',
  stateStalled: 'rgba(255, 159, 10, 1)',
  statePaused: '#48484A',
  stateChecking: 'rgba(255, 149, 0, 1)',
  stateMetadata: 'rgba(255, 149, 0, 1)',
  stateQueued: 'rgba(255, 149, 0, 1)',
  stateOther: '#48484A',
};

// True black theme — now matches dark palette (dark IS true black)
const trueBlackColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceOutline: '#38383A',
  text: 'rgba(255, 255, 255, 1)',
  textSecondary: 'rgba(190, 190, 190, 1)',
  primary: 'rgba(10, 132, 255, 1)',
  primaryOpac: 'rgba(10, 132, 255, 0.2)',
  error: 'rgba(255, 69, 58, 1)',
  success: 'rgba(52, 199, 89, 1)',
  warning: 'rgba(255, 149, 0, 1)',
  stateDownloading: 'rgba(10, 132, 255, 1)',
  stateSeeding: 'rgb(38, 132, 71)',
  stateUploadOnly: 'rgb(48, 209, 88)',
  stateUploadAndDownload: 'rgba(10, 132, 255, 1)',
  stateError: 'rgba(255, 69, 58, 1)',
  stateStalled: 'rgba(255, 159, 10, 1)',
  statePaused: '#48484A',
  stateChecking: 'rgba(255, 149, 0, 1)',
  stateMetadata: 'rgba(255, 149, 0, 1)',
  stateQueued: 'rgba(255, 149, 0, 1)',
  stateOther: '#48484A',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Seed the system color scheme from Appearance so the first paint already
  // matches the OS appearance when themeMode is 'system'.
  const initialSystemScheme = Appearance.getColorScheme();
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [customColors, setCustomColors] = useState<ColorTheme | null>(null);

  const effectiveSystem = systemColorScheme ?? initialSystemScheme ?? null;
  const isDark = resolveIsDark(themeMode, effectiveSystem);

  useEffect(() => {
    loadThemePreference();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      loadCustomColors();
    }
    // Re-load custom color overrides when the effective palette flips
    // (either user changed mode, or the OS toggled while in 'system').
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, isLoading]);

  const loadThemePreference = async () => {
    try {
      const preferences = await storageService.getPreferences();
      const mode = normalizeThemeMode(
        (preferences as { themeMode?: unknown }).themeMode,
        preferences.theme
      );
      setThemeModeState(mode);
    } catch (error) {
      // Ignore theme loading errors — fall back to default 'system'
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomColors = async () => {
    try {
      const custom = await colorThemeManager.getCustomColors(isDark);
      setCustomColors(custom);
    } catch (error) {
      // Ignore color loading errors
    }
  };

  const persistThemeMode = async (mode: ThemeMode, effectiveDark: boolean) => {
    try {
      const preferences = await storageService.getPreferences();
      await storageService.savePreferences({
        ...preferences,
        themeMode: mode,
        // Keep the legacy `theme` key in sync so older code paths and
        // exported settings still reflect the current appearance.
        theme: effectiveDark ? 'dark' : 'light',
      });
    } catch (error) {
      // Ignore theme saving errors
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    const nextIsDark = resolveIsDark(mode, effectiveSystem);
    await persistThemeMode(mode, nextIsDark);
    try {
      const custom = await colorThemeManager.getCustomColors(nextIsDark);
      setCustomColors(custom);
    } catch (error) {
      // Ignore color loading errors
    }
  };

  const toggleTheme = async () => {
    // Toggling explicitly opts out of 'system' and flips to the opposite
    // of the currently-effective appearance.
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
  };

  const baseColors = isDark ? darkColors : lightColors;
  const colors = colorThemeManager.mergeColors(baseColors, customColors) as typeof baseColors;

  if (isLoading) {
    // While loading, use the system appearance (or dark as a fallback) so the
    // first paint avoids a flash of the wrong theme.
    const initialIsDark = effectiveSystem !== 'light';
    const initialColors = initialIsDark ? darkColors : lightColors;
    return (
      <ThemeContext.Provider
        value={{
          isDark: initialIsDark,
          themeMode: 'system',
          toggleTheme,
          setThemeMode,
          reloadCustomColors: loadCustomColors,
          colors: initialColors,
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        themeMode,
        toggleTheme,
        setThemeMode,
        reloadCustomColors: loadCustomColors,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Export for testing/debugging
export { darkColors, lightColors, trueBlackColors };

