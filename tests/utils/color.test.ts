import { contrastRatio, withAlpha } from '@/utils/color';

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

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#0A84FF', '#1C1C1E')).toBeCloseTo(
      contrastRatio('#1C1C1E', '#0A84FF'),
      10,
    );
  });

  it('matches a known WCAG value (#767676 on white is ~4.54)', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('parses 3-digit hex, rgb() and rgba() the same as 6-digit hex', () => {
    const expected = contrastRatio('#FF3B30', '#FFFFFF');
    expect(contrastRatio('rgb(255, 59, 48)', '#FFF')).toBeCloseTo(expected, 5);
    expect(contrastRatio('rgba(255, 59, 48, 1)', 'rgb(255,255,255)')).toBeCloseTo(expected, 5);
    expect(contrastRatio('#F00', '#fff')).toBeCloseTo(contrastRatio('#FF0000', '#FFFFFF'), 10);
  });

  it('ignores alpha (treats colors as opaque)', () => {
    expect(contrastRatio('rgba(0, 0, 0, 0.1)', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('returns 1 (no contrast) when a color cannot be parsed', () => {
    expect(contrastRatio('not-a-color', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#000000', 'hsl(0, 100%, 50%)')).toBe(1);
  });
});
