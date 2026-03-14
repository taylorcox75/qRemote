import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storageService } from '@/services/storage';
import { colorThemeManager, ColorTheme } from '@/services/color-theme-manager';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  reloadCustomColors: () => Promise<void>;
  colors: {
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
  };
}

const lightColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceOutline: '#E5E5EA',
  text: 'rgba(0, 0, 0, 1)',
  textSecondary: 'rgba(142, 142, 147, 1)',
  primary: 'rgba(0, 122, 255, 1)',
  primaryOpac: 'rgba(0, 122, 255, 0.15)',
  error: 'rgba(255, 59, 48, 1)',
  success: 'rgba(52, 199, 89, 1)',
  warning: 'rgba(255, 149, 0, 1)',
  stateDownloading: 'rgba(0, 122, 255, 1)',
  stateSeeding: 'rgba(52, 199, 89, 1)',
  stateUploadAndDownload: '#6B7B8C',
  stateUploadOnly: '#34C759',
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
  stateSeeding: 'rgba(52, 199, 89, 1)',
  stateUploadAndDownload: '#6B7B8C',
  stateUploadOnly: '#34C759',
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
  stateSeeding: 'rgba(52, 199, 89, 1)',
  stateUploadAndDownload: '#6B7B8C',
  stateUploadOnly: '#34C759',
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
  const [isDark, setIsDark] = useState(true); // Default to dark theme
  const [isLoading, setIsLoading] = useState(true);
  const [customColors, setCustomColors] = useState<ColorTheme | null>(null);

  useEffect(() => {
    loadThemePreference();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      loadCustomColors();
    }
  }, [isDark, isLoading]);

  const loadThemePreference = async () => {
    try {
      const preferences = await storageService.getPreferences();
      const savedTheme = preferences.theme;
      if (savedTheme !== undefined) {
        setIsDark(savedTheme === true || savedTheme === 'dark');
      }
      // If no saved preference, default to dark (already set)
    } catch (error) {
      // Ignore theme loading errors
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

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    try {
      const preferences = await storageService.getPreferences();
      await storageService.savePreferences({
        ...preferences,
        theme: newTheme ? 'dark' : 'light',
      });
      // Reload custom colors for new theme
      const custom = await colorThemeManager.getCustomColors(newTheme);
      setCustomColors(custom);
    } catch (error) {
      // Ignore theme saving errors
    }
  };

  const baseColors = isDark ? darkColors : lightColors;
  const colors = colorThemeManager.mergeColors(baseColors, customColors) as typeof baseColors;

  if (isLoading) {
    // Return with default dark theme while loading
    return (
      <ThemeContext.Provider
        value={{
          isDark: true,
          toggleTheme,
          reloadCustomColors: loadCustomColors,
          colors: darkColors,
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
          toggleTheme,
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

