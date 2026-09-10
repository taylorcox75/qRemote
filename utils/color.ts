/**
 * Pure color utilities. No hex->rgba helper existed anywhere in the repo
 * (checked utils/*.ts and context/ThemeContext.tsx) before this file.
 */

/**
 * Convert a hex color (#rgb, #rgba, #rrggbb, #rrggbbaa) to an rgba() string
 * at the given alpha. When the input is already an rgb()/rgba() string, the
 * color channels are reused and only the alpha is replaced - this lets
 * callers pass any theme color (hex or rgba) without pre-parsing it.
 *
 * Falls back to a fully-transparent black for input this function cannot
 * parse, so a bad theme value degrades to invisible rather than throwing.
 */
export function hexToRgba(color: string, alpha: number): string {
  const clampedAlpha = Math.min(1, Math.max(0, alpha));
  const trimmed = color.trim();

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i,
  );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
  }

  let hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

  // Expand shorthand #rgb / #rgba to full length.
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (hex.length !== 6 && hex.length !== 8) {
    return `rgba(0, 0, 0, ${clampedAlpha})`;
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(0, 0, 0, ${clampedAlpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}
