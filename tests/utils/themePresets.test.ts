import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_THEME_PRESET_ID, THEME_PRESETS, type ThemePreset } from '@/constants/themePresets';
import type { ColorTheme } from '@/services/color-theme-manager';
import { contrastRatio } from '@/utils/color';
import {
  findThemePreset,
  getThemePresetSelection,
  presetApplyNeedsConfirm,
} from '@/utils/themePresets';

// Typed as a Record over `keyof ColorTheme` so adding a key to `ColorTheme`
// without deciding how presets handle it fails to compile.
const ALL_KEYS_RECORD: Record<keyof ColorTheme, true> = {
  primary: true,
  error: true,
  success: true,
  warning: true,
  background: true,
  surface: true,
  surfaceOutline: true,
  text: true,
  textSecondary: true,
  stateDownloading: true,
  stateSeeding: true,
  stateUploadAndDownload: true,
  stateUploadOnly: true,
  stateError: true,
  stateStalled: true,
  statePaused: true,
  stateChecking: true,
  stateMetadata: true,
  stateQueued: true,
  stateOther: true,
  primaryOpac: true,
  onAccent: true,
};
const ALL_KEYS = Object.keys(ALL_KEYS_RECORD) as (keyof ColorTheme)[];
const STATE_KEYS = ALL_KEYS.filter((k) => k.startsWith('state')) as (keyof ColorTheme)[];

const NON_DEFAULT_PRESETS = THEME_PRESETS.filter((p) => p.id !== DEFAULT_THEME_PRESET_ID);
const VARIANTS = ['dark', 'light'] as const;

const cases = NON_DEFAULT_PRESETS.flatMap((preset) =>
  VARIANTS.map((variant) => ({
    name: `${preset.id} / ${variant}`,
    preset,
    variant,
    colors: preset[variant] as Required<ColorTheme>,
  })),
);

/** Names every key that falls short, so one failure lists the whole palette. */
function failures(
  colors: Required<ColorTheme>,
  keys: (keyof ColorTheme)[],
  against: keyof ColorTheme,
  min: number,
): string[] {
  return keys
    .map((key) => ({ key, ratio: contrastRatio(colors[key], colors[against]) }))
    .filter(({ ratio }) => ratio < min)
    .map(
      ({ key, ratio }) =>
        `${key} ${colors[key]} on ${against} ${colors[against]} = ${ratio.toFixed(2)} (< ${min})`,
    );
}

function rgbDistance(a: string, b: string): number {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

describe('THEME_PRESETS data', () => {
  it('lists the seven starter presets, default first', () => {
    expect(THEME_PRESETS.map((p) => p.id)).toEqual([
      'default',
      'oled',
      'nord',
      'dracula',
      'solarized',
      'highContrast',
      'qbittorrentClassic',
    ]);
  });

  it('has unique ids and name keys derived from the id', () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of THEME_PRESETS) {
      expect(preset.nameKey).toBe(`screens.settings.presetName.${preset.id}`);
    }
  });

  it('default is the empty preset (no overrides in either mode)', () => {
    const preset = findThemePreset(DEFAULT_THEME_PRESET_ID) as ThemePreset;
    expect(preset.dark).toEqual({});
    expect(preset.light).toEqual({});
  });

  it('every preset name key resolves in all seven locales', () => {
    for (const locale of ['en', 'es', 'zh', 'fr', 'de', 'ru', 'pl']) {
      const json = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../locales', locale, 'translation.json'), 'utf8'),
      );
      for (const preset of THEME_PRESETS) {
        const value = preset.nameKey.split('.').reduce((node, part) => node?.[part], json);
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
  });

  describe.each(cases)('$name', ({ colors }) => {
    it('defines every ColorTheme key (and nothing else)', () => {
      expect(Object.keys(colors).sort()).toEqual([...ALL_KEYS].sort());
    });

    it('uses 6-digit hex for every key the color picker can edit', () => {
      const editable = ALL_KEYS.filter((k) => k !== 'primaryOpac');
      const bad = editable.filter((k) => !/^#[0-9A-Fa-f]{6}$/.test(colors[k]));
      expect(bad).toEqual([]);
    });

    it('primaryOpac is an rgba() tint of primary', () => {
      const match = colors.primaryOpac.match(/^rgba\((\d+), (\d+), (\d+), (0?\.\d+)\)$/);
      expect(match).not.toBeNull();
      const [, r, g, b] = match as RegExpMatchArray;
      const hex = [r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
      expect(`#${hex}`.toUpperCase()).toBe(colors.primary.toUpperCase());
    });
  });
});

describe('theme preset contrast', () => {
  describe.each(cases)('$name', ({ preset, colors }) => {
    const isHighContrast = preset.id === 'highContrast';

    it(`text is readable on background and surface (>= ${isHighContrast ? 7 : 4.5})`, () => {
      const min = isHighContrast ? 7 : 4.5;
      expect([
        ...failures(colors, ['text'], 'background', min),
        ...failures(colors, ['text'], 'surface', min),
      ]).toEqual([]);
    });

    it('secondary text is legible on surface and background (>= 3)', () => {
      expect([
        ...failures(colors, ['textSecondary'], 'surface', 3),
        ...failures(colors, ['textSecondary'], 'background', 3),
      ]).toEqual([]);
    });

    it('every torrent-state color stands out on surface (>= 3)', () => {
      expect(failures(colors, STATE_KEYS, 'surface', 3)).toEqual([]);
    });

    it('accent colors stand out on surface (>= 3)', () => {
      expect(failures(colors, ['primary', 'error', 'success', 'warning'], 'surface', 3)).toEqual(
        [],
      );
    });

    it('onAccent labels are readable on filled primary and error (>= 3)', () => {
      expect([
        ...failures(colors, ['onAccent'], 'primary', 3),
        ...failures(colors, ['onAccent'], 'error', 3),
      ]).toEqual([]);
    });

    it('the surface outline is visible against the surface', () => {
      expect(contrastRatio(colors.surfaceOutline, colors.surface)).toBeGreaterThanOrEqual(1.2);
    });

    it('surface is distinguishable from background', () => {
      expect(colors.surface.toUpperCase()).not.toBe(colors.background.toUpperCase());
    });

    it('downloading, seeding, error and paused are pairwise distinct', () => {
      const keys = ['stateDownloading', 'stateSeeding', 'stateError', 'statePaused'] as const;
      const tooClose: string[] = [];
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const distance = rgbDistance(colors[keys[i]], colors[keys[j]]);
          if (distance < 60) {
            tooClose.push(`${keys[i]} ~ ${keys[j]} (${distance.toFixed(0)})`);
          }
        }
      }
      expect(tooClose).toEqual([]);
    });
  });
});

describe('findThemePreset', () => {
  it('finds a preset by id', () => {
    expect(findThemePreset('nord')?.id).toBe('nord');
  });

  it('returns undefined for unknown, empty or missing ids', () => {
    expect(findThemePreset('nope')).toBeUndefined();
    expect(findThemePreset('')).toBeUndefined();
    expect(findThemePreset(undefined)).toBeUndefined();
    expect(findThemePreset(null)).toBeUndefined();
  });
});

describe('getThemePresetSelection', () => {
  const nord = findThemePreset('nord') as ThemePreset;
  const dracula = findThemePreset('dracula') as ThemePreset;
  const stored = (preset: ThemePreset) => ({
    dark: { ...preset.dark },
    light: { ...preset.light },
  });

  describe('default', () => {
    it('is default when nothing is stored', () => {
      expect(getThemePresetSelection(undefined, undefined)).toEqual({ kind: 'default' });
      expect(getThemePresetSelection(null, null)).toEqual({ kind: 'default' });
      expect(getThemePresetSelection({}, undefined)).toEqual({ kind: 'default' });
    });

    it('treats empty / undefined-valued color objects as no customs', () => {
      expect(getThemePresetSelection({ dark: {}, light: {} }, undefined)).toEqual({
        kind: 'default',
      });
      expect(getThemePresetSelection({ dark: { primary: undefined } }, undefined)).toEqual({
        kind: 'default',
      });
    });

    it('is default when a remembered preset id has no colors behind it (user reset)', () => {
      expect(getThemePresetSelection({}, 'nord')).toEqual({ kind: 'default' });
      expect(getThemePresetSelection({ dark: {}, light: {} }, 'oled')).toEqual({
        kind: 'default',
      });
    });
  });

  describe('preset', () => {
    it('is the preset when both modes deep-equal it', () => {
      expect(getThemePresetSelection(stored(nord), 'nord')).toEqual({
        kind: 'preset',
        id: 'nord',
      });
    });

    it('ignores key order and undefined-valued keys', () => {
      const reordered = {
        dark: Object.fromEntries(Object.entries(nord.dark).reverse()),
        light: { ...nord.light, primary: nord.light.primary, text: nord.light.text },
      };
      expect(getThemePresetSelection(reordered, 'nord')).toEqual({ kind: 'preset', id: 'nord' });
      expect(
        getThemePresetSelection(
          { ...stored(nord), dark: { ...nord.dark, error: undefined } },
          'nord',
        ),
      ).toEqual({ kind: 'custom', basedOn: 'nord' });
    });

    it.each(NON_DEFAULT_PRESETS.map((p) => [p.id, p] as const))(
      '%s round-trips as its own preset',
      (id, preset) => {
        expect(getThemePresetSelection(stored(preset), id)).toEqual({ kind: 'preset', id });
      },
    );
  });

  describe('custom', () => {
    it('existing custom colors with no preset id are custom, with no basedOn', () => {
      expect(
        getThemePresetSelection(
          { dark: { primary: '#123456' }, light: { text: '#000000' } },
          undefined,
        ),
      ).toEqual({ kind: 'custom' });
      expect(getThemePresetSelection({ dark: { primary: '#123456' } }, undefined)).toEqual({
        kind: 'custom',
      });
    });

    it('never classifies colors as a preset without that preset id (even if they happen to match)', () => {
      expect(getThemePresetSelection(stored(nord), undefined)).toEqual({ kind: 'custom' });
      expect(getThemePresetSelection(stored(nord), null)).toEqual({ kind: 'custom' });
    });

    it('colors matching a preset other than the remembered id are custom based on the remembered one', () => {
      expect(getThemePresetSelection(stored(nord), 'dracula')).toEqual({
        kind: 'custom',
        basedOn: 'dracula',
      });
      expect(dracula.id).toBe('dracula');
    });

    it('editing one color after applying a preset becomes custom based on it', () => {
      const edited = stored(nord);
      edited.dark = { ...edited.dark, primary: '#FF00FF' };
      expect(getThemePresetSelection(edited, 'nord')).toEqual({ kind: 'custom', basedOn: 'nord' });
    });

    it('a preset color in only one mode (the other mode reset) is custom based on it', () => {
      expect(getThemePresetSelection({ light: { ...nord.light } }, 'nord')).toEqual({
        kind: 'custom',
        basedOn: 'nord',
      });
      expect(getThemePresetSelection({ dark: { ...nord.dark } }, 'nord')).toEqual({
        kind: 'custom',
        basedOn: 'nord',
      });
    });

    it('an extra stored key makes it custom', () => {
      const extra = stored(nord);
      extra.light = { ...extra.light };
      delete extra.light.stateOther;
      expect(getThemePresetSelection(extra, 'nord')).toEqual({ kind: 'custom', basedOn: 'nord' });
    });

    it('an unknown remembered id is ignored (custom, no basedOn)', () => {
      expect(getThemePresetSelection(stored(nord), 'removed-preset')).toEqual({ kind: 'custom' });
    });

    it('a stored "default" id never counts as basedOn', () => {
      expect(getThemePresetSelection({ dark: { primary: '#123456' } }, 'default')).toEqual({
        kind: 'custom',
      });
    });
  });
});

describe('presetApplyNeedsConfirm', () => {
  it('asks only when the user has custom colors to lose', () => {
    expect(presetApplyNeedsConfirm({ kind: 'custom' })).toBe(true);
    expect(presetApplyNeedsConfirm({ kind: 'custom', basedOn: 'nord' })).toBe(true);
    expect(presetApplyNeedsConfirm({ kind: 'default' })).toBe(false);
    expect(presetApplyNeedsConfirm({ kind: 'preset', id: 'nord' })).toBe(false);
  });
});
