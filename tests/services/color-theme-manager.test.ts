jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn().mockResolvedValue({}),
    savePreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

import { colorThemeManager, ColorTheme } from '@/services/color-theme-manager';
import { storageService } from '@/services/storage';

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
