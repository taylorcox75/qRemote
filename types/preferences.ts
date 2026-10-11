import { ColorTheme } from '@/services/color-theme-manager';

export type SortField =
  'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'priority' | 'added_on';

export type ExpandedCardField =
  | 'dlSpeed'
  | 'ulSpeed'
  | 'eta'
  | 'status'
  | 'seeds'
  | 'peers'
  | 'ratio'
  | 'ratioLimit'
  | 'maxRatio'
  | 'uploaded'
  | 'availability'
  | 'popularity'
  | 'savePath'
  | 'tracker'
  | 'addedOn'
  | 'seedingTime'
  | 'tags'
  | 'category'
  | 'progress';

export type AddTorrentDialogField =
  | 'source'
  | 'savePath'
  | 'useDownloadPath'
  | 'category'
  | 'tags'
  | 'rename'
  | 'stopped'
  | 'skipChecking'
  | 'rootFolder'
  | 'upLimit'
  | 'dlLimit'
  | 'ratioLimit'
  | 'seedingTimeLimit'
  | 'sequentialDownload'
  | 'firstLastPiecePrio'
  | 'autoTMM'
  | 'cookie';

export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Search tab "Search in" scope: 'names' keeps only results whose name contains
 * every term of the submitted search; 'everywhere' keeps whatever the plugins
 * returned (the pre-#266 behavior).
 */
export type SearchInMode = 'names' | 'everywhere';

export interface AppPreferences {
  /**
   * @deprecated Use `themeMode` instead. Kept for backward compatibility:
   * existing users have this set to 'dark' | 'light' (or boolean) and the
   * ThemeContext still reads it as a fallback when `themeMode` is absent.
   */
  theme: string | boolean;

  /**
   * Theme selection. 'system' follows the OS appearance and reactively updates
   * when the user toggles light/dark in their device settings.
   */
  themeMode: ThemeMode;

  /** Per-theme color overrides, keyed by 'dark' | 'light' */
  customColors: Record<string, ColorTheme>;

  /**
   * Id of the theme preset last applied from Settings → Theme (#286). Optional
   * and written only when the user applies a preset — absent for everyone who
   * has never picked one. It is a hint, not the source of truth: whether a
   * preset is "selected" is decided by comparing `customColors` against that
   * preset (see `getThemePresetSelection`), so a stale id can't mislabel anything.
   */
  themePresetId?: string;

  /** Default sticker color applied to every category that has no per-name override */
  defaultCategoryColor: string;

  /** Default sticker color applied to every tag that has no per-name override */
  defaultTagColor: string;

  /** Per-category sticker color overrides, keyed by category name */
  categoryColors: Record<string, string>;

  /** Per-tag sticker color overrides, keyed by tag name */
  tagColors: Record<string, string>;

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

  /**
   * Recent (unpinned) queries typed into the Torrents tab search box, newest
   * first. Capped by `torrentSearchHistoryLimit` (#282).
   */
  torrentSearchHistory: string[];

  /** Pinned Torrents-tab searches (max 10). Not counted toward the history limit. */
  torrentSearchPinned: string[];

  /** How many recent searches to keep. 0 turns the history off. */
  torrentSearchHistoryLimit: number;

  /** Whether newly added torrents start paused */
  pauseOnAdd: boolean;

  /** Default save path for new torrents */
  defaultSavePath: string;

  /** Whether the add-torrent screen's "incomplete torrents" path field was last enabled */
  lastUseDownloadPath: boolean;

  /** Last incomplete-torrents download path typed on the add-torrent screen */
  lastDownloadPath: string;

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

  /** Auto-tag torrents added from Search with the result's tracker/indexer label (not categorization) */
  autoCategorizeByTracker: boolean;

  /** When enabled, the add-torrent button opens the full add-torrent screen */
  useFullAddTorrentDialogue: boolean;

  /**
   * When enabled, the + on a Search result opens the add-torrent dialogue
   * pre-filled instead of instantly adding with server defaults (#217).
   */
  searchAddOpensDialogue: boolean;

  /** Per-field visibility for the full add-torrent screen */
  addTorrentDialogueFields: Record<AddTorrentDialogField, boolean>;

  /** Per-field visibility for the expanded (detailed) torrent card */
  expandedCardFields: Record<ExpandedCardField, boolean>;

  /** Number of columns in the detailed torrent card stats grid */
  expandedCardGridColumns: 3 | 4 | 5;

  /** Last selected search plugin ("all", "enabled", or a plugin name) */
  lastSearchPlugin?: string;

  /** Last selected search category ("all" or a plugin-supported category id) */
  lastSearchCategory?: string;

  /**
   * Search tab: hide results that report exactly 0 seeders. Only an explicit 0
   * is hidden — qBittorrent uses -1 for "unknown", which stays visible.
   */
  searchHideZeroSeeders?: boolean;

  /**
   * Search tab: collapse results that look like the same torrent (same info hash,
   * or same name and size) into one expandable row (#267). Absent is treated as
   * on, so the default is applied to existing users too.
   */
  searchGroupDuplicates?: boolean;

  /**
   * Search tab "Search in" default (#266). Absent is treated as 'everywhere',
   * so existing users see no change.
   */
  searchInMode?: SearchInMode;

  /**
   * Search tab: `name` ids of the plugins the user pinned (#283). Pinned
   * plugins' chips are listed first in the plugin chip row. Names that are no
   * longer installed are ignored (and pruned the next time the pins change).
   */
  searchPinnedPlugins?: string[];

  /**
   * Last active category filter on the torrents tab.
   * null = All categories; '' = Uncategorized (torrents with no category set).
   */
  lastCategoryFilter?: string | null;

  /** Last active tag filters on the torrents tab (OR semantics). */
  lastTagFilters?: string[];
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark',
  themeMode: 'system',
  customColors: {},
  defaultCategoryColor: '#0A84FF',
  defaultTagColor: '#30D158',
  categoryColors: {},
  tagColors: {},
  defaultSortBy: 'added_on',
  defaultSortDirection: 'desc',
  defaultFilter: 'all',
  cardViewMode: 'compact',
  torrentSearchHistory: [],
  torrentSearchPinned: [],
  torrentSearchHistoryLimit: 5,
  pauseOnAdd: false,
  defaultSavePath: '',
  lastUseDownloadPath: false,
  lastDownloadPath: '',
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
  useFullAddTorrentDialogue: false,
  searchAddOpensDialogue: true,
  addTorrentDialogueFields: {
    source: true,
    savePath: true,
    useDownloadPath: true,
    category: true,
    tags: true,
    rename: true,
    stopped: true,
    skipChecking: true,
    rootFolder: true,
    upLimit: true,
    dlLimit: true,
    ratioLimit: true,
    seedingTimeLimit: true,
    sequentialDownload: true,
    firstLastPiecePrio: true,
    autoTMM: true,
    cookie: true,
  },
  expandedCardFields: {
    dlSpeed: true,
    ulSpeed: true,
    eta: true,
    status: false,
    seeds: true,
    peers: true,
    ratio: true,
    ratioLimit: false,
    maxRatio: false,
    uploaded: true,
    availability: true,
    popularity: true,
    savePath: false,
    tracker: false,
    addedOn: true,
    seedingTime: false,
    tags: true,
    category: true,
    progress: false,
  },
  expandedCardGridColumns: 4,
  lastSearchPlugin: 'all',
  lastSearchCategory: 'all',
  searchHideZeroSeeders: false,
  searchGroupDuplicates: true,
  searchInMode: 'everywhere',
  searchPinnedPlugins: [],
  lastCategoryFilter: null,
  lastTagFilters: [],
};
