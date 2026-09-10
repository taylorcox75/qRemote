import { buildPogonaTheme, POGONA_THEME_NAME } from '@/constants/pogonaTheme';
import type { ThemeColors } from '@/context/ThemeContext';

const THEME_COLOR_KEYS: (keyof ThemeColors)[] = [
  'background',
  'surface',
  'surfaceOutline',
  'text',
  'textSecondary',
  'primary',
  'primaryOpac',
  'onAccent',
  'error',
  'success',
  'warning',
  'stateDownloading',
  'stateSeeding',
  'stateUploadAndDownload',
  'stateUploadOnly',
  'stateError',
  'stateStalled',
  'statePaused',
  'stateChecking',
  'stateMetadata',
  'stateQueued',
  'stateOther',
];

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const RGBA_RE = /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)$/;

function isValidColorValue(value: string): boolean {
  return HEX_RE.test(value) || RGBA_RE.test(value);
}

describe('buildPogonaTheme', () => {
  it('exposes a stable preset name', () => {
    expect(POGONA_THEME_NAME).toBe('Pogona');
  });

  it.each(['light', 'dark'] as const)('covers every ThemeColors key for %s', (base) => {
    const theme = buildPogonaTheme(base);
    for (const key of THEME_COLOR_KEYS) {
      expect(theme[key]).toBeDefined();
      expect(typeof theme[key]).toBe('string');
    }
  });

  it.each(['light', 'dark'] as const)(
    'every value is a valid hex or rgba color string for %s',
    (base) => {
      const theme = buildPogonaTheme(base);
      for (const key of THEME_COLOR_KEYS) {
        const value = theme[key as keyof typeof theme] as string;
        expect(isValidColorValue(value)).toBe(true);
      }
    },
  );

  it('onAccent is white in both modes (filled-button contrast)', () => {
    expect(buildPogonaTheme('light').onAccent).toBe('#FFFFFF');
    expect(buildPogonaTheme('dark').onAccent).toBe('#FFFFFF');
  });

  it('light and dark differ on every key', () => {
    const light = buildPogonaTheme('light');
    const dark = buildPogonaTheme('dark');
    // Deliberately identical in both modes: onAccent (always white on a
    // saturated fill) and warning (Pogona defines a single amber-500, no
    // dark variant).
    const sameInBothModes = new Set(['onAccent', 'warning']);
    for (const key of THEME_COLOR_KEYS) {
      if (sameInBothModes.has(key)) continue;
      expect(light[key as keyof typeof light]).not.toBe(dark[key as keyof typeof dark]);
    }
  });

  it('the overall palette still differs between light and dark', () => {
    const light = buildPogonaTheme('light');
    const dark = buildPogonaTheme('dark');
    expect(light.background).not.toBe(dark.background);
    expect(light.text).not.toBe(dark.text);
  });

  it('downloading and seeding states use distinct green/blue hues', () => {
    const light = buildPogonaTheme('light');
    expect(light.stateDownloading).toBe(light.success);
    expect(light.stateUploadAndDownload).toBe(light.stateDownloading);
    expect(light.stateSeeding).toBe(light.primary);
    expect(light.stateUploadOnly).toBe(light.stateSeeding);
    expect(light.stateSeeding).not.toBe(light.stateDownloading);
  });

  it('neutral states (stalled/paused/queued/other) share the zinc tone', () => {
    const dark = buildPogonaTheme('dark');
    expect(dark.stateStalled).toBe(dark.textSecondary);
    expect(dark.statePaused).toBe(dark.textSecondary);
    expect(dark.stateQueued).toBe(dark.textSecondary);
    expect(dark.stateOther).toBe(dark.textSecondary);
  });

  it('checking and metadata share the slate tone, distinct from the neutral zinc', () => {
    const light = buildPogonaTheme('light');
    expect(light.stateChecking).toBe(light.stateMetadata);
    expect(light.stateChecking).not.toBe(light.textSecondary);
  });

  it('primaryOpac is an alpha-reduced rgba of primary', () => {
    const light = buildPogonaTheme('light');
    expect(light.primaryOpac).toBe('rgba(37, 99, 235, 0.15)');
    const dark = buildPogonaTheme('dark');
    expect(dark.primaryOpac).toBe('rgba(96, 165, 250, 0.2)');
  });
});
