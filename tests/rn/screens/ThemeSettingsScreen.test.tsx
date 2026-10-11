// ThemeSettingsScreen.test.tsx — the Presets section on Settings → Theme (#286).
// Covers the safety flow: a user with custom colors is asked before a preset
// replaces them (and nothing is written until they confirm), while applying
// over Default or another preset is immediate. Uses the real colorThemeManager
// against an in-memory preferences store, so the assertions are on what would
// actually be persisted.
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import ThemeSettingsScreen from '@/app/(tabs)/settings/theme';
import { THEME_PRESETS, type ThemePreset } from '@/constants/themePresets';

let mockStored: Record<string, unknown> = {};
const mockSavePreferences = jest.fn();
const mockReloadCustomColors = jest.fn(async () => {});
const mockShowToast = jest.fn();

jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn(async () => JSON.parse(JSON.stringify(mockStored))),
    savePreferences: (next: Record<string, unknown>) => mockSavePreferences(next),
  },
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    themeMode: 'dark',
    setThemeMode: jest.fn(),
    reloadCustomColors: mockReloadCustomColors,
    colors: require('../components/theme-mock').mockColors,
  }),
  darkColors: require('../components/theme-mock').mockColors,
  lightColors: require('../components/theme-mock').mockColors,
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/components/FocusAwareStatusBar', () => ({ FocusAwareStatusBar: () => null }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));

const preset = (id: string) => THEME_PRESETS.find((p) => p.id === id) as ThemePreset;

const REPLACE_TITLE = 'screens.settings.themePresetReplaceTitle';
const REPLACE_CONFIRM = 'screens.settings.themePresetReplaceConfirm';

const USER_CUSTOMS = {
  dark: { primary: '#123456', stateDownloading: '#00FF00' },
  light: { background: '#FAFAFA' },
};

async function renderScreen(prefs: Record<string, unknown>) {
  mockStored = prefs;
  await render(<ThemeSettingsScreen />);
}

const tapPreset = (id: string) => fireEvent.press(screen.getByTestId(`theme-preset-${id}`));

beforeEach(() => {
  mockStored = {};
  mockSavePreferences.mockReset();
  mockSavePreferences.mockImplementation(async (next: Record<string, unknown>) => {
    mockStored = JSON.parse(JSON.stringify(next));
  });
  mockReloadCustomColors.mockClear();
  mockShowToast.mockClear();
});

describe('ThemeSettingsScreen presets', () => {
  it('shows Default as selected and writes nothing just by opening the screen', async () => {
    await renderScreen({});
    await waitFor(() =>
      expect(screen.getByTestId('theme-preset-default').props.accessibilityState.selected).toBe(
        true,
      ),
    );
    expect(mockSavePreferences).not.toHaveBeenCalled();
  });

  it('shows existing custom colors (no preset id) as "Custom" and writes nothing', async () => {
    await renderScreen({ customColors: USER_CUSTOMS });
    expect(await screen.findByText('screens.settings.themePresetCustom')).toBeTruthy();
    expect(
      THEME_PRESETS.some(
        (p) => screen.getByTestId(`theme-preset-${p.id}`).props.accessibilityState.selected,
      ),
    ).toBe(false);
    expect(mockSavePreferences).not.toHaveBeenCalled();
    expect(mockStored.customColors).toEqual(USER_CUSTOMS);
  });

  it('applies a preset immediately for a Default user: both modes, id, reload and toast', async () => {
    await renderScreen({});
    await tapPreset('nord');

    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1));
    expect(mockStored.themePresetId).toBe('nord');
    expect(mockStored.customColors).toEqual({
      dark: preset('nord').dark,
      light: preset('nord').light,
    });
    expect(screen.queryByText(REPLACE_TITLE)).toBeNull();
    await waitFor(() => expect(mockReloadCustomColors).toHaveBeenCalled());
    expect(mockShowToast).toHaveBeenCalledWith(
      'screens.settings.themePresetApplied:screens.settings.presetName.nord',
      'success',
    );
    // ...and the card is now the selected one.
    await waitFor(() =>
      expect(screen.getByTestId('theme-preset-nord').props.accessibilityState.selected).toBe(true),
    );
  });

  it('applies over another preset immediately — nothing user-authored is lost', async () => {
    await renderScreen({
      themePresetId: 'nord',
      customColors: { dark: preset('nord').dark, light: preset('nord').light },
    });
    await waitFor(() =>
      expect(screen.getByTestId('theme-preset-nord').props.accessibilityState.selected).toBe(true),
    );
    await tapPreset('dracula');

    await waitFor(() => expect(mockStored.themePresetId).toBe('dracula'));
    expect(screen.queryByText(REPLACE_TITLE)).toBeNull();
  });

  it('asks before replacing custom colors and writes NOTHING until confirmed', async () => {
    await renderScreen({ customColors: USER_CUSTOMS });
    await screen.findByText('screens.settings.themePresetCustom');

    await tapPreset('nord');

    expect(await screen.findByText(REPLACE_TITLE)).toBeTruthy();
    expect(
      screen.getByText(
        'screens.settings.themePresetReplaceMessage:screens.settings.presetName.nord',
      ),
    ).toBeTruthy();
    expect(mockSavePreferences).not.toHaveBeenCalled();
    expect(mockStored.customColors).toEqual(USER_CUSTOMS);
  });

  it('keeps the custom colors when the user cancels', async () => {
    await renderScreen({ customColors: USER_CUSTOMS });
    await screen.findByText('screens.settings.themePresetCustom');
    await tapPreset('nord');
    await screen.findByText(REPLACE_TITLE);

    await fireEvent.press(screen.getByText('common.cancel'));

    await waitFor(() => expect(screen.queryByText(REPLACE_TITLE)).toBeNull());
    expect(mockSavePreferences).not.toHaveBeenCalled();
    expect(mockStored.customColors).toEqual(USER_CUSTOMS);
    expect('themePresetId' in mockStored).toBe(false);
  });

  it('replaces both modes only after the user confirms', async () => {
    await renderScreen({ customColors: USER_CUSTOMS, categoryColors: { Movies: '#ff0000' } });
    await screen.findByText('screens.settings.themePresetCustom');
    await tapPreset('oled');
    await screen.findByText(REPLACE_TITLE);

    await fireEvent.press(screen.getByText(REPLACE_CONFIRM));

    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1));
    expect(mockStored.themePresetId).toBe('oled');
    expect(mockStored.customColors).toEqual({
      dark: preset('oled').dark,
      light: preset('oled').light,
    });
    expect(mockStored.categoryColors).toEqual({ Movies: '#ff0000' });
    await waitFor(() => expect(screen.queryByText(REPLACE_TITLE)).toBeNull());
  });

  it('choosing Default over custom colors also asks first, then clears both modes and the id', async () => {
    await renderScreen({ themePresetId: 'nord', customColors: USER_CUSTOMS });
    // nord id + edited colors => custom based on Nord
    expect(
      await screen.findByText(
        'screens.settings.themePresetCustomBasedOn:screens.settings.presetName.nord',
      ),
    ).toBeTruthy();

    await tapPreset('default');
    await screen.findByText(REPLACE_TITLE);
    expect(mockSavePreferences).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText(REPLACE_CONFIRM));

    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1));
    expect(mockStored.customColors).toEqual({});
    expect('themePresetId' in mockStored).toBe(false);
    await waitFor(() =>
      expect(screen.getByTestId('theme-preset-default').props.accessibilityState.selected).toBe(
        true,
      ),
    );
  });

  it('shows an error toast and keeps the confirm flow honest when saving fails', async () => {
    await renderScreen({});
    mockSavePreferences.mockRejectedValue(new Error('disk full'));

    await tapPreset('nord');

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        'screens.settings.themePresetApplyFailed',
        'error',
      ),
    );
    expect(mockStored).toEqual({});
  });
});
