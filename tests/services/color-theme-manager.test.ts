jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn().mockResolvedValue({}),
    savePreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

import { colorThemeManager, ColorTheme } from '@/services/color-theme-manager';

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
