/**
 * serverIcons.ts — Curated Ionicons glyph set for the per-server badge (#224).
 *
 * Outline ("clear") glyphs only, matching every other icon in the app, so a
 * server's badge can be tinted with its badge color instead of carrying a
 * fixed-color emoji that can't follow the theme.
 *
 * Key exports: SERVER_ICON_OPTIONS, DEFAULT_SERVER_ICON
 */
import type React from 'react';
import { Ionicons } from '@expo/vector-icons';

export type ServerIconName = React.ComponentProps<typeof Ionicons>['name'];

export const DEFAULT_SERVER_ICON: ServerIconName = 'server-outline';

export const SERVER_ICON_OPTIONS: ServerIconName[] = [
  'server-outline',
  'home-outline',
  'business-outline',
  'cloud-outline',
  'desktop-outline',
  'laptop-outline',
  'hardware-chip-outline',
  'file-tray-stacked-outline',
  'wifi-outline',
  'globe-outline',
  'planet-outline',
  'rocket-outline',
  'flash-outline',
  'terminal-outline',
  'shield-checkmark-outline',
  'lock-closed-outline',
  'moon-outline',
  'sunny-outline',
  'snow-outline',
  'flame-outline',
  'leaf-outline',
  'star-outline',
  'heart-outline',
  'diamond-outline',
];
