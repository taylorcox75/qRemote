import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ThemePresetsSection } from '@/components/ThemePresetsSection';
import { THEME_PRESETS, type ThemePreset } from '@/constants/themePresets';
import type { ThemePresetSelection } from '@/utils/themePresets';

let mockIsDark = true;

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ isDark: mockIsDark, colors: require('./theme-mock').mockColors }),
  // Stand-ins for the built-in palettes: only the keys the preview reads matter.
  darkColors: {
    background: '#000001',
    surface: '#000002',
    surfaceOutline: '#000003',
    text: '#000004',
    primary: '#000005',
    stateDownloading: '#000006',
    stateSeeding: '#000007',
    stateError: '#000008',
    statePaused: '#000009',
  },
  lightColors: {
    background: '#FFFFF1',
    surface: '#FFFFF2',
    surfaceOutline: '#FFFFF3',
    text: '#FFFFF4',
    primary: '#FFFFF5',
    stateDownloading: '#FFFFF6',
    stateSeeding: '#FFFFF7',
    stateError: '#FFFFF8',
    statePaused: '#FFFFF9',
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));

const isSelected = (id: string) =>
  screen.getByTestId(`theme-preset-${id}`).props.accessibilityState?.selected === true;

const previewBackground = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(`theme-preset-preview-${id}`).props.style).backgroundColor;

async function renderSection(selection: ThemePresetSelection | null, onSelect = jest.fn()) {
  await render(<ThemePresetsSection selection={selection} onSelect={onSelect} />);
  return onSelect;
}

describe('ThemePresetsSection', () => {
  beforeEach(() => {
    mockIsDark = true;
  });

  it('renders the section title and one card per preset', async () => {
    await renderSection({ kind: 'default' });
    expect(screen.getByText('SCREENS.SETTINGS.THEMEPRESETS')).toBeTruthy();
    for (const preset of THEME_PRESETS) {
      expect(screen.getByText(preset.nameKey)).toBeTruthy();
    }
  });

  it('highlights Default when nothing is customised', async () => {
    await renderSection({ kind: 'default' });
    expect(isSelected('default')).toBe(true);
    expect(isSelected('nord')).toBe(false);
    expect(screen.queryByTestId('theme-preset-custom-caption')).toBeNull();
  });

  it('highlights only the applied preset', async () => {
    await renderSection({ kind: 'preset', id: 'dracula' });
    expect(isSelected('dracula')).toBe(true);
    expect(THEME_PRESETS.filter((p) => isSelected(p.id)).map((p) => p.id)).toEqual(['dracula']);
  });

  it('highlights nothing and shows a plain "Custom" caption for custom colors with no preset', async () => {
    await renderSection({ kind: 'custom' });
    expect(THEME_PRESETS.some((p) => isSelected(p.id))).toBe(false);
    expect(screen.getByText('screens.settings.themePresetCustom')).toBeTruthy();
  });

  it('names the preset a custom theme is based on', async () => {
    await renderSection({ kind: 'custom', basedOn: 'nord' });
    expect(THEME_PRESETS.some((p) => isSelected(p.id))).toBe(false);
    expect(
      screen.getByText(
        'screens.settings.themePresetCustomBasedOn:screens.settings.presetName.nord',
      ),
    ).toBeTruthy();
  });

  it('highlights nothing and shows no caption while the selection is still loading', async () => {
    await renderSection(null);
    expect(THEME_PRESETS.some((p) => isSelected(p.id))).toBe(false);
    expect(screen.queryByTestId('theme-preset-custom-caption')).toBeNull();
  });

  it('reports the tapped preset', async () => {
    const onSelect = await renderSection({ kind: 'default' });
    await fireEvent.press(screen.getByTestId('theme-preset-nord'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect((onSelect.mock.calls[0][0] as ThemePreset).id).toBe('nord');
  });

  it('does nothing when the already-selected preset is tapped', async () => {
    const onSelect = await renderSection({ kind: 'preset', id: 'nord' });
    await fireEvent.press(screen.getByTestId('theme-preset-nord'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('lets a custom theme tap any preset, including Default', async () => {
    const onSelect = await renderSection({ kind: 'custom' });
    await fireEvent.press(screen.getByTestId('theme-preset-default'));
    expect((onSelect.mock.calls[0][0] as ThemePreset).id).toBe('default');
  });

  describe('previews the current mode', () => {
    it('shows the dark variant in dark mode', async () => {
      mockIsDark = true;
      await renderSection({ kind: 'default' });
      const nord = THEME_PRESETS.find((p) => p.id === 'nord') as ThemePreset;
      expect(previewBackground('nord')).toBe(nord.dark.background);
      // Default has no colors of its own → the live built-in palette
      expect(previewBackground('default')).toBe('#000001');
    });

    it('shows the light variant in light mode', async () => {
      mockIsDark = false;
      await renderSection({ kind: 'default' });
      const nord = THEME_PRESETS.find((p) => p.id === 'nord') as ThemePreset;
      expect(previewBackground('nord')).toBe(nord.light.background);
      expect(previewBackground('default')).toBe('#FFFFF1');
    });
  });
});
