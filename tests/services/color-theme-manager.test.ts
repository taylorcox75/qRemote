jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn().mockResolvedValue({}),
    savePreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

import { colorThemeManager, ColorTheme } from '@/services/color-theme-manager';
import { storageService } from '@/services/storage';
import type { ThemePreset } from '@/constants/themePresets';
import { findThemePreset, getThemePresetSelection } from '@/utils/themePresets';

const getPreferences = storageService.getPreferences as jest.Mock;
const savePreferences = storageService.savePreferences as jest.Mock;

describe('getCustomColors', () => {
  beforeEach(() => {
    getPreferences.mockReset();
    savePreferences.mockReset();
  });

  it('returns dark colors when isDark is true', async () => {
    getPreferences.mockResolvedValue({
      customColors: { dark: { primary: '#111111' }, light: { primary: '#eeeeee' } },
    });
    const result = await colorThemeManager.getCustomColors(true);
    expect(result).toEqual({ primary: '#111111' });
  });

  it('returns light colors when isDark is false', async () => {
    getPreferences.mockResolvedValue({
      customColors: { dark: { primary: '#111111' }, light: { primary: '#eeeeee' } },
    });
    const result = await colorThemeManager.getCustomColors(false);
    expect(result).toEqual({ primary: '#eeeeee' });
  });

  it('returns null when no custom colors are stored', async () => {
    getPreferences.mockResolvedValue({});
    const result = await colorThemeManager.getCustomColors(true);
    expect(result).toBeNull();
  });

  it('returns null when getPreferences throws', async () => {
    getPreferences.mockRejectedValue(new Error('storage failure'));
    const result = await colorThemeManager.getCustomColors(true);
    expect(result).toBeNull();
  });
});

describe('saveCustomColors', () => {
  beforeEach(() => {
    getPreferences.mockReset();
    savePreferences.mockReset();
  });

  it('saves colors under the correct theme key, preserving other theme', async () => {
    getPreferences.mockResolvedValue({
      customColors: { light: { primary: '#eeeeee' } },
      otherPref: 'x',
    });
    savePreferences.mockResolvedValue(undefined);

    await colorThemeManager.saveCustomColors(true, { primary: '#123456' });

    expect(savePreferences).toHaveBeenCalledWith({
      otherPref: 'x',
      customColors: {
        light: { primary: '#eeeeee' },
        dark: { primary: '#123456' },
      },
    });
  });

  it('creates customColors object when none exists', async () => {
    getPreferences.mockResolvedValue({});
    savePreferences.mockResolvedValue(undefined);

    await colorThemeManager.saveCustomColors(false, { primary: '#abcdef' });

    expect(savePreferences).toHaveBeenCalledWith({
      customColors: { light: { primary: '#abcdef' } },
    });
  });

  it('rethrows when savePreferences fails', async () => {
    getPreferences.mockResolvedValue({});
    savePreferences.mockRejectedValue(new Error('save failed'));

    await expect(colorThemeManager.saveCustomColors(true, {})).rejects.toThrow('save failed');
  });
});

describe('resetCustomColors', () => {
  beforeEach(() => {
    getPreferences.mockReset();
    savePreferences.mockReset();
  });

  it('deletes only the specified theme key', async () => {
    getPreferences.mockResolvedValue({
      customColors: { dark: { primary: '#111' }, light: { primary: '#eee' } },
    });
    savePreferences.mockResolvedValue(undefined);

    await colorThemeManager.resetCustomColors(true);

    expect(savePreferences).toHaveBeenCalledWith({
      customColors: { light: { primary: '#eee' } },
    });
  });

  it('rethrows when savePreferences fails', async () => {
    getPreferences.mockResolvedValue({ customColors: {} });
    savePreferences.mockRejectedValue(new Error('save failed'));

    await expect(colorThemeManager.resetCustomColors(false)).rejects.toThrow('save failed');
  });
});

describe('resetTorrentStateColors', () => {
  beforeEach(() => {
    getPreferences.mockReset();
    savePreferences.mockReset();
  });

  it('does nothing when no custom colors exist for the theme', async () => {
    getPreferences.mockResolvedValue({});
    await colorThemeManager.resetTorrentStateColors(true);
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it('removes only torrent state color keys, keeps advanced colors', async () => {
    getPreferences.mockResolvedValue({
      customColors: {
        dark: {
          primary: '#123456',
          stateDownloading: '#00ff00',
          stateSeeding: '#0000ff',
        },
      },
    });
    savePreferences.mockResolvedValue(undefined);

    await colorThemeManager.resetTorrentStateColors(true);

    expect(savePreferences).toHaveBeenCalledWith({
      customColors: {
        dark: { primary: '#123456' },
      },
    });
  });

  it('rethrows when an error occurs during save', async () => {
    getPreferences.mockResolvedValueOnce({
      customColors: { dark: { stateDownloading: '#fff' } },
    });
    // second getPreferences call happens inside saveCustomColors via getCustomColors->resetTorrentStateColors flow
    getPreferences.mockResolvedValueOnce({
      customColors: { dark: { stateDownloading: '#fff' } },
    });
    savePreferences.mockRejectedValue(new Error('boom'));

    await expect(colorThemeManager.resetTorrentStateColors(true)).rejects.toThrow('boom');
  });
});

describe('mergeColors', () => {
  const defaults: ColorTheme = {
    primary: '#0000ff',
    error: '#ff0000',
    success: '#00ff00',
    background: '#000000',
    text: '#ffffff',
  };

  it('returns defaults when custom is null', () => {
    expect(colorThemeManager.mergeColors(defaults, null)).toEqual(defaults);
  });

  it('overrides only specified keys with partial custom', () => {
    const custom: ColorTheme = { primary: '#111111' };
    const result = colorThemeManager.mergeColors(defaults, custom);
    expect(result.primary).toBe('#111111');
    expect(result.error).toBe('#ff0000');
    expect(result.background).toBe('#000000');
  });

  it('overrides all keys with full custom', () => {
    const custom: ColorTheme = {
      primary: '#aaa',
      error: '#bbb',
      success: '#ccc',
      background: '#ddd',
      text: '#eee',
    };
    const result = colorThemeManager.mergeColors(defaults, custom);
    expect(result).toEqual(custom);
  });

  it('adds extra keys from custom that are not in defaults', () => {
    const custom: ColorTheme = { stateDownloading: '#00ff00' };
    const result = colorThemeManager.mergeColors(defaults, custom);
    expect(result.stateDownloading).toBe('#00ff00');
    expect(result.primary).toBe('#0000ff');
  });
});

describe('hexToRgba', () => {
  it('converts 6-digit hex to rgba with default alpha', () => {
    expect(colorThemeManager.hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 1)');
  });

  it('converts hex to rgba with custom alpha', () => {
    expect(colorThemeManager.hexToRgba('#00ff00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
  });

  it('converts black hex correctly', () => {
    expect(colorThemeManager.hexToRgba('#000000')).toBe('rgba(0, 0, 0, 1)');
  });

  it('converts white hex correctly', () => {
    expect(colorThemeManager.hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 1)');
  });

  it('converts mixed hex correctly', () => {
    expect(colorThemeManager.hexToRgba('#1c1c1e', 0.8)).toBe('rgba(28, 28, 30, 0.8)');
  });

  it('handles alpha of 0', () => {
    expect(colorThemeManager.hexToRgba('#ff0000', 0)).toBe('rgba(255, 0, 0, 0)');
  });
});

describe('rgbaToHex', () => {
  it('converts rgba string to hex', () => {
    expect(colorThemeManager.rgbaToHex('rgba(255, 0, 0, 1)')).toBe('#ff0000');
  });

  it('converts rgb string to hex', () => {
    expect(colorThemeManager.rgbaToHex('rgb(0, 255, 0)')).toBe('#00ff00');
  });

  it('converts rgba with decimals in alpha', () => {
    expect(colorThemeManager.rgbaToHex('rgba(0, 0, 255, 0.5)')).toBe('#0000ff');
  });

  it('pads single-digit hex values with leading zero', () => {
    expect(colorThemeManager.rgbaToHex('rgb(0, 0, 0)')).toBe('#000000');
    expect(colorThemeManager.rgbaToHex('rgb(1, 2, 3)')).toBe('#010203');
  });

  it('returns #000000 for invalid input', () => {
    expect(colorThemeManager.rgbaToHex('not-a-color')).toBe('#000000');
    expect(colorThemeManager.rgbaToHex('')).toBe('#000000');
  });

  it('handles rgba with spaces variations', () => {
    expect(colorThemeManager.rgbaToHex('rgba( 128 , 128 , 128 , 1)')).toBe('#808080');
  });

  it('converts white correctly', () => {
    expect(colorThemeManager.rgbaToHex('rgb(255, 255, 255)')).toBe('#ffffff');
  });
});

describe('applyThemePreset (#286)', () => {
  const nord = findThemePreset('nord') as ThemePreset;
  const oled = findThemePreset('oled') as ThemePreset;
  const defaultPreset = findThemePreset('default') as ThemePreset;

  /** In-memory stand-in for the AsyncStorage-backed preferences blob. */
  let stored: Record<string, unknown>;

  beforeEach(() => {
    getPreferences.mockReset();
    savePreferences.mockReset();
    stored = {};
    getPreferences.mockImplementation(async () => JSON.parse(JSON.stringify(stored)));
    savePreferences.mockImplementation(async (next: Record<string, unknown>) => {
      stored = JSON.parse(JSON.stringify(next));
    });
  });

  it('writes both modes and themePresetId in ONE savePreferences call', async () => {
    stored = { otherPref: 'x' };
    await colorThemeManager.applyThemePreset(nord);

    expect(getPreferences).toHaveBeenCalledTimes(1);
    expect(savePreferences).toHaveBeenCalledTimes(1);
    expect(savePreferences).toHaveBeenCalledWith({
      otherPref: 'x',
      customColors: { dark: nord.dark, light: nord.light },
      themePresetId: 'nord',
    });
  });

  it('replaces each mode wholesale instead of merging into earlier custom colors', async () => {
    stored = {
      customColors: {
        dark: { primary: '#123456', stateOther: '#ABCDEF' },
        light: { text: '#010101' },
      },
    };
    await colorThemeManager.applyThemePreset(oled);

    expect(stored.customColors).toEqual({ dark: oled.dark, light: oled.light });
    expect(stored.themePresetId).toBe('oled');
  });

  it('keeps every other preference untouched', async () => {
    stored = {
      themeMode: 'light',
      theme: 'light',
      categoryColors: { Movies: '#ff0000' },
      customColors: { dark: { primary: '#123456' } },
    };
    await colorThemeManager.applyThemePreset(nord);

    expect(stored).toMatchObject({
      themeMode: 'light',
      theme: 'light',
      categoryColors: { Movies: '#ff0000' },
    });
  });

  it('stores copies, so editing a saved color can never mutate the preset constant', async () => {
    const before = JSON.stringify(nord);
    await colorThemeManager.applyThemePreset(nord);
    const dark = (await colorThemeManager.getCustomColors(true)) as ColorTheme;
    dark.primary = '#FF00FF';
    await colorThemeManager.saveCustomColors(true, dark);
    expect(JSON.stringify(nord)).toBe(before);
  });

  it('makes getCustomColors return the preset for the requested mode', async () => {
    await colorThemeManager.applyThemePreset(nord);
    expect(await colorThemeManager.getCustomColors(true)).toEqual(nord.dark);
    expect(await colorThemeManager.getCustomColors(false)).toEqual(nord.light);
  });

  it('default clears both modes and removes themePresetId (the same end state as a full reset)', async () => {
    stored = {
      otherPref: 'x',
      themePresetId: 'nord',
      customColors: { dark: { primary: '#123456' }, light: { primary: '#654321' } },
    };
    await colorThemeManager.applyThemePreset(defaultPreset);

    expect(savePreferences).toHaveBeenCalledTimes(1);
    expect(stored).toEqual({ otherPref: 'x', customColors: {} });
    expect('themePresetId' in stored).toBe(false);
    expect(await colorThemeManager.getCustomColors(true)).toBeNull();
    expect(await colorThemeManager.getCustomColors(false)).toBeNull();
  });

  it('default on a fresh install writes no colors and no preset id', async () => {
    await colorThemeManager.applyThemePreset(defaultPreset);
    expect(stored).toEqual({ customColors: {} });
  });

  it('rethrows when savePreferences fails (nothing half-applied)', async () => {
    savePreferences.mockRejectedValue(new Error('save failed'));
    await expect(colorThemeManager.applyThemePreset(nord)).rejects.toThrow('save failed');
  });

  it('a later hand edit keeps the preset id so the screen can say "based on"', async () => {
    await colorThemeManager.applyThemePreset(nord);
    const dark = (await colorThemeManager.getCustomColors(true)) as ColorTheme;
    await colorThemeManager.saveCustomColors(true, { ...dark, primary: '#FF00FF' });

    expect(stored.themePresetId).toBe('nord');
    expect(
      getThemePresetSelection(
        stored.customColors as Record<string, ColorTheme>,
        stored.themePresetId as string,
      ),
    ).toEqual({ kind: 'custom', basedOn: 'nord' });
  });

  it('applying any preset over a previous one replaces the id', async () => {
    await colorThemeManager.applyThemePreset(nord);
    await colorThemeManager.applyThemePreset(oled);
    expect(stored.themePresetId).toBe('oled');
    expect(
      getThemePresetSelection(
        stored.customColors as Record<string, ColorTheme>,
        stored.themePresetId as string,
      ),
    ).toEqual({ kind: 'preset', id: 'oled' });
  });
});

describe('resetCustomColors and themePresetId (#286)', () => {
  beforeEach(() => {
    getPreferences.mockReset();
    savePreferences.mockReset();
  });

  it('keeps themePresetId while the other mode still has custom colors', async () => {
    getPreferences.mockResolvedValue({
      themePresetId: 'nord',
      customColors: { dark: { primary: '#111' }, light: { primary: '#eee' } },
    });
    await colorThemeManager.resetCustomColors(true);

    expect(savePreferences).toHaveBeenCalledWith({
      themePresetId: 'nord',
      customColors: { light: { primary: '#eee' } },
    });
  });

  it('drops themePresetId once neither mode has custom colors left', async () => {
    getPreferences.mockResolvedValue({
      themePresetId: 'nord',
      otherPref: 'x',
      customColors: { dark: { primary: '#111' } },
    });
    await colorThemeManager.resetCustomColors(true);

    const saved = savePreferences.mock.calls[0][0];
    expect(saved).toEqual({ otherPref: 'x', customColors: {} });
    expect('themePresetId' in saved).toBe(false);
  });

  it('is unchanged for users who never picked a preset', async () => {
    getPreferences.mockResolvedValue({
      customColors: { dark: { primary: '#111' }, light: { primary: '#eee' } },
    });
    await colorThemeManager.resetCustomColors(false);

    const saved = savePreferences.mock.calls[0][0];
    expect(saved).toEqual({ customColors: { dark: { primary: '#111' } } });
    expect('themePresetId' in saved).toBe(false);
  });
});

describe('existing custom colors are never touched by anything but an explicit preset apply (#286)', () => {
  beforeEach(() => {
    getPreferences.mockReset();
    savePreferences.mockReset();
  });

  it('reading colors (what app launch does) never writes', async () => {
    getPreferences.mockResolvedValue({
      customColors: { dark: { primary: '#123456' }, light: { text: '#111111' } },
    });
    await colorThemeManager.getCustomColors(true);
    await colorThemeManager.getCustomColors(false);
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it('saveCustomColors leaves a user with no preset id without one', async () => {
    getPreferences.mockResolvedValue({ customColors: { dark: { primary: '#123456' } } });
    await colorThemeManager.saveCustomColors(false, { text: '#111111' });
    const saved = savePreferences.mock.calls[0][0];
    expect('themePresetId' in saved).toBe(false);
    expect(saved.customColors).toEqual({
      dark: { primary: '#123456' },
      light: { text: '#111111' },
    });
  });

  it('mergeColors layers a preset (incl. primaryOpac/onAccent) over the defaults key by key', () => {
    const defaults: ColorTheme = {
      primary: 'rgba(10, 132, 255, 1)',
      primaryOpac: 'rgba(10, 132, 255, 0.2)',
      onAccent: '#FFFFFF',
      text: 'rgba(255, 255, 255, 1)',
    };
    const nord = findThemePreset('nord') as ThemePreset;
    const merged = colorThemeManager.mergeColors(defaults, nord.dark);
    expect(merged.primary).toBe(nord.dark.primary);
    expect(merged.primaryOpac).toBe(nord.dark.primaryOpac);
    expect(merged.onAccent).toBe(nord.dark.onAccent);
    // the defaults object itself is never mutated
    expect(defaults.primary).toBe('rgba(10, 132, 255, 1)');
  });
});
