import { ColorTheme } from '@/services/color-theme-manager';

export type SortField =
  | 'name'
  | 'size'
  | 'progress'
  | 'dlspeed'
  | 'upspeed'
  | 'ratio'
  | 'added_on';

export interface AppPreferences {
  /** 'dark' | 'light'; legacy values stored as boolean are also accepted */
  theme: string | boolean;

  /** Per-theme color overrides, keyed by 'dark' | 'light' */
  customColors: Record<string, ColorTheme>;

  /** Field to sort the torrent list by */
  defaultSortBy: SortField;

  /** Sort direction for the torrent list */
  defaultSortDirection: 'asc' | 'desc';

  /** Active torrent state filter (e.g. 'all', 'downloading', 'seeding') */
  defaultFilter: string;

  /**
   * @deprecated Transitional — kept for backward compatibility.
   * Task 2.2 removes multi-view UI; this key may be dropped once a
   * preference migration system is in place.
   */
  cardViewMode: 'compact' | 'expanded';

  /** Whether newly added torrents start paused */
  pauseOnAdd: boolean;

  /** Default save path for new torrents */
  defaultSavePath: string;

  /** Default download priority for new torrents (0 = normal) */
  defaultPriority: number;

  /** Duration in ms for toast notifications */
  toastDuration: number;

  /** Whether haptic feedback is enabled */
  hapticFeedback: boolean;

  /** Auto-connect to the last used server on app launch */
  autoConnectLastServer: boolean;

  /** Connection timeout in ms */
  connectionTimeout: number;

  /** API request timeout in ms */
  apiTimeout: number;

  /** Number of automatic retry attempts for failed API requests */
  retryAttempts: number;

  /** Enable connectivity debug mode */
  debugMode: boolean;

  /** Polling interval in ms for torrent/transfer data refresh */
  autoRefreshInterval: number;

  /** Whether the user has completed the onboarding flow */
  hasCompletedOnboarding: boolean;

  /** Auto-categorize torrents by tracker hostname */
  autoCategorizeByTracker: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark',
  customColors: {},
  defaultSortBy: 'added_on',
  defaultSortDirection: 'desc',
  defaultFilter: 'all',
  cardViewMode: 'compact',
  pauseOnAdd: false,
  defaultSavePath: '',
  defaultPriority: 0,
  toastDuration: 3000,
  hapticFeedback: true,
  autoConnectLastServer: true,
  connectionTimeout: 10000,
  apiTimeout: 30000,
  retryAttempts: 3,
  debugMode: false,
  autoRefreshInterval: 1000,
  hasCompletedOnboarding: false,
  autoCategorizeByTracker: false,
};
