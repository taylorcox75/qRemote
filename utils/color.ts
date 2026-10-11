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

/**
 * WCAG 2.x relative luminance of a colour (0 = black, 1 = white). Accepts the
 * same formats as `withAlpha` (hex 3/6/8-digit, rgb(), rgba()); any alpha
 * channel is ignored, i.e. the colour is treated as opaque.
 */
function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * WCAG contrast ratio between two colours, from 1 (identical) to 21 (black on
 * white). Order does not matter. Alpha is ignored (both colours are treated as
 * opaque), and a colour string that can't be parsed yields 1 ("no contrast")
 * so threshold checks fail safe.
 */
export function contrastRatio(a: string, b: string): number {
  const rgbA = parseColorToRgb(a);
  const rgbB = parseColorToRgb(b);
  if (!rgbA || !rgbB) {
    return 1;
  }
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
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
