// ThemeContext.test.tsx — theme presets (#286) are layered ON TOP of the
// built-in palettes. These tests pin the safety guarantees for existing users:
// the defaults never change, nothing writes colors at launch, a user's own
// colors flow through untouched, and "Default" returns exactly to the built-in
// palette.
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import {
  ThemeProvider,
  useTheme,
  darkColors,
  lightColors,
  trueBlackColors,
} from '@/context/ThemeContext';
import { colorThemeManager } from '@/services/color-theme-manager';
import { THEME_PRESETS, type ThemePreset } from '@/constants/themePresets';

let mockStored: Record<string, unknown> = {};
const mockSavePreferences = jest.fn();

jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn(async () => JSON.parse(JSON.stringify(mockStored))),
    savePreferences: (next: Record<string, unknown>) => mockSavePreferences(next),
  },
}));

type ThemeValue = ReturnType<typeof useTheme>;
let latest: ThemeValue;

function Probe({ onRender }: { onRender: (ctx: ThemeValue) => void }) {
  onRender(useTheme());
  return null;
}

async function mountProvider(prefs: Record<string, unknown>) {
  mockStored = prefs;
  await render(
    <ThemeProvider>
      <Probe onRender={(ctx) => (latest = ctx)} />
    </ThemeProvider>,
  );
  // ThemeProvider reads the theme mode, then the custom colors for that mode.
  await waitFor(() => expect(latest.themeMode).toBe(prefs.themeMode));
}

const preset = (id: string) => THEME_PRESETS.find((p) => p.id === id) as ThemePreset;

beforeEach(() => {
  mockStored = {};
  mockSavePreferences.mockReset();
  mockSavePreferences.mockImplementation(async (next: Record<string, unknown>) => {
    mockStored = JSON.parse(JSON.stringify(next));
  });
});

describe('built-in palettes are untouched by theme presets', () => {
  it('lightColors is exactly the pre-presets palette', () => {
    expect(lightColors).toEqual({
      background: '#F2F2F7',
      surface: '#FFFFFF',
      surfaceOutline: '#E5E5EA',
      text: 'rgb(26, 26, 26)',
      textSecondary: 'rgba(142, 142, 147, 1)',
      primary: 'rgba(0, 122, 255, 1)',
      primaryOpac: 'rgba(0, 122, 255, 0.15)',
      onAccent: '#FFFFFF',
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
    });
  });

  it('darkColors is exactly the pre-presets palette (and already true black)', () => {
    expect(darkColors).toEqual({
      background: '#000000',
      surface: '#1C1C1E',
      surfaceOutline: '#38383A',
      text: 'rgba(255, 255, 255, 1)',
      textSecondary: 'rgba(190, 190, 190, 1)',
      primary: 'rgba(10, 132, 255, 1)',
      primaryOpac: 'rgba(10, 132, 255, 0.2)',
      onAccent: '#FFFFFF',
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
    });
  });

  it('trueBlackColors is still the dark palette duplicate', () => {
    expect(trueBlackColors).toEqual(darkColors);
  });
});

describe('ThemeProvider with theme presets', () => {
  it('never writes preferences on launch — not for a fresh install', async () => {
    await mountProvider({ themeMode: 'dark' });
    expect(mockSavePreferences).not.toHaveBeenCalled();
    expect(latest.colors).toEqual(darkColors);
  });

  it('never writes preferences on launch — not for a user with custom colors and no preset id', async () => {
    const stored = {
      themeMode: 'dark',
      customColors: {
        dark: { primary: '#123456', stateDownloading: '#00FF00' },
        light: { background: '#FAFAFA' },
      },
    };
    await mountProvider(stored);

    await waitFor(() => expect(latest.colors.primary).toBe('#123456'));
    expect(mockSavePreferences).not.toHaveBeenCalled();
    // The stored blob is byte-for-byte what it was: nothing was added, not even a preset id.
    expect(mockStored).toEqual(stored);
    expect('themePresetId' in mockStored).toBe(false);
  });

  it("layers an existing user's custom colors over the built-in palette key by key", async () => {
    await mountProvider({
      themeMode: 'dark',
      customColors: { dark: { primary: '#123456', stateDownloading: '#00FF00' } },
    });

    await waitFor(() => expect(latest.colors.primary).toBe('#123456'));
    expect(latest.colors).toEqual({
      ...darkColors,
      primary: '#123456',
      stateDownloading: '#00FF00',
    });
  });

  it('applies a preset (including primaryOpac and onAccent) only when asked, then Default restores the built-in palette exactly', async () => {
    await mountProvider({ themeMode: 'dark' });
    expect(latest.colors).toEqual(darkColors);

    const nord = preset('nord');
    await colorThemeManager.applyThemePreset(nord);
    // Nothing changes until the context is told to reload...
    expect(latest.colors).toEqual(darkColors);
    await act(async () => {
      await latest.reloadCustomColors();
    });
    await waitFor(() => expect(latest.colors.primary).toBe(nord.dark.primary));
    expect(latest.colors).toEqual({ ...darkColors, ...nord.dark });
    expect(latest.colors.primaryOpac).toBe(nord.dark.primaryOpac);
    expect(latest.colors.onAccent).toBe(nord.dark.onAccent);

    await colorThemeManager.applyThemePreset(preset('default'));
    await act(async () => {
      await latest.reloadCustomColors();
    });
    await waitFor(() => expect(latest.colors.primary).toBe(darkColors.primary));
    expect(latest.colors).toEqual(darkColors);
  });

  it('a preset swaps with the effective light/dark mode', async () => {
    await mountProvider({ themeMode: 'light' });
    const nord = preset('nord');
    await colorThemeManager.applyThemePreset(nord);
    await act(async () => {
      await latest.reloadCustomColors();
    });

    await waitFor(() => expect(latest.colors.primary).toBe(nord.light.primary));
    expect(latest.colors).toEqual({ ...lightColors, ...nord.light });

    await act(async () => {
      await latest.setThemeMode('dark');
    });
    await waitFor(() => expect(latest.colors.primary).toBe(nord.dark.primary));
  });
});
