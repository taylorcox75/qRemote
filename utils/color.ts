/**
 * withAlpha — apply an alpha channel to a colour string of any format the
 * theme uses. `colors.*` defaults mix hex, rgb() and rgba() (AGENTS §8), so
 * appending a hex alpha suffix (e.g. `color + '18'`) silently produces an
 * opaque colour instead of a translucent one whenever the base is an
 * rgb()/rgba() string — React Native's colour parser is unanchored and just
 * ignores the trailing characters it doesn't recognize.
 */
export function withAlpha(color: string, alpha: number): string {
  const clampedAlpha = Math.min(1, Math.max(0, alpha));
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedAlpha})`;
}

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();

  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i,
  );
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  return null;
}
