/**
 * "Pogona" theme preset - a shadcn zinc / green / blue reading of Pogona's
 * own macOS design system (see PogonaPalette.swift in the Pogona repo).
 *
 * This is a fixed preset users can apply from Settings > Theme & Colors, not
 * a new built-in palette: applying it writes into the existing per-mode
 * `customColors` override store (services/color-theme-manager.ts) exactly
 * like hand-picking each color would. It never touches lightColors /
 * darkColors / trueBlackColors in context/ThemeContext.tsx.
 *
 * Hex source (Pogona, light / dark):
 *   zinc-100 #F4F4F5 / zinc-900 #18181B   -- background / surface (swapped, see below)
 *   zinc-200 #E4E4E7 / zinc-800 #27272A   -- outline
 *   zinc-950 #09090B / zinc-50  #FAFAFA   -- text
 *   zinc-500 #71717A / zinc-400 #A1A1AA   -- text secondary, and neutral states
 *   green-600 #16A34A / green-400 #4ADE80 -- downloading
 *   blue-600  #2563EB / blue-400 #60A5FA  -- seeding
 *   red-600   #DC2626 / red-400  #F87171  -- destructive / error
 *   slate-500 #64748B / slate-400 #94A3B8 -- checking / metadata
 *   amber-500 #F59E0B                     -- warning (qRemote-only, not in Pogona)
 */
import type { ColorTheme } from '@/services/color-theme-manager';

export const POGONA_THEME_NAME = 'Pogona';

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Build a full Pogona-look ColorTheme (every ThemeColors key covered) for the
 * given base mode. Pass the result straight to
 * `colorThemeManager.saveCustomColors(isDark, buildPogonaTheme(...))`.
 */
export function buildPogonaTheme(base: 'light' | 'dark'): Required<ColorTheme> {
  if (base === 'dark') {
    const primary = '#60A5FA';
    const downloading = '#4ADE80';
    const seeding = '#60A5FA';
    const destructive = '#F87171';
    const checking = '#94A3B8';
    const zincNeutral = '#A1A1AA';
    return {
      background: '#09090B',
      surface: '#18181B',
      surfaceOutline: '#27272A',
      text: '#FAFAFA',
      textSecondary: '#A1A1AA',
      primary,
      primaryOpac: rgba(primary, 0.2),
      onAccent: '#FFFFFF',
      error: destructive,
      success: downloading,
      warning: '#F59E0B',
      stateDownloading: downloading,
      stateUploadAndDownload: downloading,
      stateSeeding: seeding,
      stateUploadOnly: seeding,
      stateError: destructive,
      stateStalled: zincNeutral,
      statePaused: zincNeutral,
      stateQueued: zincNeutral,
      stateOther: zincNeutral,
      stateChecking: checking,
      stateMetadata: checking,
    };
  }

  const primary = '#2563EB';
  const downloading = '#16A34A';
  const seeding = '#2563EB';
  const destructive = '#DC2626';
  const checking = '#64748B';
  const zincNeutral = '#71717A';
  return {
    background: '#F4F4F5',
    surface: '#FFFFFF',
    surfaceOutline: '#E4E4E7',
    text: '#09090B',
    textSecondary: '#71717A',
    primary,
    primaryOpac: rgba(primary, 0.15),
    onAccent: '#FFFFFF',
    error: destructive,
    success: downloading,
    warning: '#F59E0B',
    stateDownloading: downloading,
    stateUploadAndDownload: downloading,
    stateSeeding: seeding,
    stateUploadOnly: seeding,
    stateError: destructive,
    stateStalled: zincNeutral,
    statePaused: zincNeutral,
    stateQueued: zincNeutral,
    stateOther: zincNeutral,
    stateChecking: checking,
    stateMetadata: checking,
  };
}
