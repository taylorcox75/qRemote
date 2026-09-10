import { hexToRgba } from '@/utils/color';

describe('hexToRgba', () => {
  it('converts a 6-digit hex color at full alpha', () => {
    expect(hexToRgba('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
  });

  it('converts a 6-digit hex color at partial alpha', () => {
    expect(hexToRgba('#00ff00', 0.14)).toBe('rgba(0, 255, 0, 0.14)');
  });

  it('handles hex without a leading #', () => {
    expect(hexToRgba('0000ff', 0.5)).toBe('rgba(0, 0, 255, 0.5)');
  });

  it('expands 3-digit shorthand hex', () => {
    expect(hexToRgba('#0af', 0.22)).toBe('rgba(0, 170, 255, 0.22)');
  });

  it('expands 4-digit shorthand hex (drops the alpha nibble, uses the given alpha)', () => {
    expect(hexToRgba('#0af8', 0.22)).toBe('rgba(0, 170, 255, 0.22)');
  });

  it('drops an existing 8-digit hex alpha channel in favor of the given alpha', () => {
    expect(hexToRgba('#ff000080', 0.3)).toBe('rgba(255, 0, 0, 0.3)');
  });

  it('reuses channels from an existing rgb() string', () => {
    expect(hexToRgba('rgb(10, 132, 255)', 0.2)).toBe('rgba(10, 132, 255, 0.2)');
  });

  it('replaces the alpha of an existing rgba() string', () => {
    expect(hexToRgba('rgba(10, 132, 255, 1)', 0.2)).toBe('rgba(10, 132, 255, 0.2)');
  });

  it('clamps alpha above 1 down to 1', () => {
    expect(hexToRgba('#ffffff', 2)).toBe('rgba(255, 255, 255, 1)');
  });

  it('clamps alpha below 0 up to 0', () => {
    expect(hexToRgba('#ffffff', -1)).toBe('rgba(255, 255, 255, 0)');
  });

  it('falls back to transparent black for an unparseable color', () => {
    expect(hexToRgba('not-a-color', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('round trips typical theme tint colors', () => {
    expect(hexToRgba('rgba(0, 122, 255, 1)', 0.14)).toBe('rgba(0, 122, 255, 0.14)');
    expect(hexToRgba('#ff3b30', 0.14)).toBe('rgba(255, 59, 48, 0.14)');
  });
});
