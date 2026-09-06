import { withAlpha } from '@/utils/color';

describe('withAlpha', () => {
  it('converts a 6-digit hex color to rgba', () => {
    expect(withAlpha('#FF3B30', 0.5)).toBe('rgba(255, 59, 48, 0.5)');
  });

  it('converts a 3-digit hex color to rgba', () => {
    expect(withAlpha('#F30', 0.5)).toBe('rgba(255, 51, 0, 0.5)');
  });

  it('drops an existing alpha channel from an 8-digit hex color', () => {
    expect(withAlpha('#FF3B30CC', 0.5)).toBe('rgba(255, 59, 48, 0.5)');
  });

  it('converts an rgb() color to rgba', () => {
    expect(withAlpha('rgb(255, 149, 0)', 0.25)).toBe('rgba(255, 149, 0, 0.25)');
  });

  it('replaces the alpha of an existing rgba() color', () => {
    expect(withAlpha('rgba(255, 69, 58, 1)', 0.09)).toBe('rgba(255, 69, 58, 0.09)');
  });

  it('clamps alpha above 1', () => {
    expect(withAlpha('#FFFFFF', 2)).toBe('rgba(255, 255, 255, 1)');
  });

  it('clamps alpha below 0', () => {
    expect(withAlpha('#FFFFFF', -1)).toBe('rgba(255, 255, 255, 0)');
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(withAlpha('not-a-color', 0.5)).toBe('not-a-color');
    expect(withAlpha('hsl(0, 100%, 50%)', 0.5)).toBe('hsl(0, 100%, 50%)');
  });
});
