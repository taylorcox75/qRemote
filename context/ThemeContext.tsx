import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storageService } from '../services/storage';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
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
  };
}

const lightColors = {
  background: 'rgb(242, 242, 247)',
  surface: 'rgb(255, 255, 255)',
  surfaceOutline: 'rgb(229, 229, 234)',
  text: 'rgb(0, 0, 0,1)',
  textSecondary: 'rgb(142, 142, 147,1)',
  primary: 'rgb(0, 123, 255,0.8)',
  primaryOpac: 'rgba(0, 85, 177, 0.8)',
  error: 'rgb(255, 13, 0,0.5)',
  success: 'rgb(4, 134, 37,0.5)', // Better contrast than pure gray
  warning: 'rgba(255, 153, 0, 0.5)', // Brighter orange
};

const darkColors = {
  background: 'rgb(15, 15, 15)', // Modern dark gray (Material Design)
  surface: 'rgb(30, 30, 30)', // Slightly lighter for cards/surfaces
  surfaceOutline: 'rgb(60, 60, 60)', // Slightly lighter for cards/surfaces
  text: 'rgb(255, 255, 255,1)',
  textSecondary: 'rgb(190, 190, 190,1)', // Better contrast than pure gray
  primary: 'rgb(0, 123, 255,0.8)',
  primaryOpac: 'rgba(0, 85, 177, 0.8)',
  error: 'rgb(255, 13, 0,0.8)',
  success: 'rgb(4, 134, 37,0.8)', // Better contrast than pure gray
  warning: 'rgba(255, 153, 0, 0.8)', // Brighter orange
};

// True black theme for OLED displays
const trueBlackColors = {
  background: 'rgb(0, 0, 0)', // Pure black for OLED
  surface: 'rgb(18, 18, 18)', // Slightly elevated
  surfaceOutline: 'rgb(45, 45, 45)', // Subtle separator
  text: 'rgb(255, 255, 255)',
  textSecondary: 'rgb(160, 160, 160)',
  primary: 'rgb(10, 132, 255)', // Brighter blue for OLED
  primaryOpac: 'rgba(10, 132, 255, 0.5)',
  error: 'rgb(255, 69, 58)', // Brighter red
  success: 'rgb(52, 199, 89)',
  warning: 'rgb(252, 151, 0)', // Brighter orange
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true); // Default to dark theme
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const preferences = await storageService.getPreferences();
      const savedTheme = preferences.theme;
      if (savedTheme !== undefined) {
        setIsDark(savedTheme === 'dark');
      }
      // If no saved preference, default to dark (already set)
    } catch (error) {
      // Ignore theme loading errors
    } finally {
      setIsLoading(false);
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
    } catch (error) {
      // Ignore theme saving errors
    }
  };

  const colors = isDark ? darkColors : lightColors;

  if (isLoading) {
    // Return with default dark theme while loading
    return (
      <ThemeContext.Provider
        value={{
          isDark: true,
          toggleTheme,
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

