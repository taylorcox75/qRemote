import { DEFAULT_THEME_PRESET_ID, THEME_PRESETS, type ThemePreset } from '@/constants/themePresets';
import type { ColorTheme } from '@/services/color-theme-manager';

/**
 * What the Theme screen should show as selected (#286). Derived from what is
 * actually stored — never from the remembered `themePresetId` alone — so a
 * stale id can't mislabel colors, and a user's own colors are never mistaken
 * for a preset.
 *
 * - `default`: no overrides in either mode (the built-in palettes).
 * - `preset`: the stored overrides equal that preset's colors in BOTH modes.
 * - `custom`: anything else. `basedOn` is the remembered preset id when it's a
 *   known one (the user applied it, then edited); absent for colors that were
 *   never a preset — including every existing user's hand-picked colors.
 */
export type ThemePresetSelection =
  { kind: 'default' } | { kind: 'preset'; id: string } | { kind: 'custom'; basedOn?: string };

/** Look up a preset by its stored id; `undefined` for a missing/unknown id. */
export function findThemePreset(id: string | undefined | null): ThemePreset | undefined {
  if (!id) return undefined;
  return THEME_PRESETS.find((preset) => preset.id === id);
}

function definedEntries(theme: ColorTheme | undefined | null): [string, unknown][] {
  if (!theme || typeof theme !== 'object') return [];
  return Object.entries(theme).filter(([, value]) => value !== undefined);
}

function hasCustoms(theme: ColorTheme | undefined | null): boolean {
  return definedEntries(theme).length > 0;
}

function sameColors(a: ColorTheme | undefined | null, b: ColorTheme | undefined | null): boolean {
  const entriesA = definedEntries(a);
  const entriesB = definedEntries(b);
  if (entriesA.length !== entriesB.length) return false;
  const recordB = Object.fromEntries(entriesB);
  return entriesA.every(([key, value]) => recordB[key] === value);
}

/**
 * Classify the stored `customColors` / `themePresetId`. Pure — reads nothing,
 * writes nothing.
 */
export function getThemePresetSelection(
  customColors: Partial<Record<string, ColorTheme>> | undefined | null,
  themePresetId: string | undefined | null,
): ThemePresetSelection {
  const dark = customColors?.dark;
  const light = customColors?.light;

  if (!hasCustoms(dark) && !hasCustoms(light)) {
    return { kind: 'default' };
  }

  // Only a known, non-default preset can be "based on" or "selected": `default`
  // is never stored as an id (applying it clears the overrides instead).
  const preset =
    themePresetId === DEFAULT_THEME_PRESET_ID ? undefined : findThemePreset(themePresetId);
  if (!preset) {
    return { kind: 'custom' };
  }

  if (sameColors(dark, preset.dark) && sameColors(light, preset.light)) {
    return { kind: 'preset', id: preset.id };
  }
  return { kind: 'custom', basedOn: preset.id };
}

/**
 * Applying a preset replaces both modes' colors, so it needs a confirmation
 * exactly when the user has colors of their own to lose — i.e. the selection is
 * `custom`. Replacing the default or another preset (nothing user-authored)
 * applies immediately.
 */
export function presetApplyNeedsConfirm(selection: ThemePresetSelection): boolean {
  return selection.kind === 'custom';
}
