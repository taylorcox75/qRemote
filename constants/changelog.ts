/**
 * App changelog / release notes.
 * Used by the in-app "What's New" panel in Settings.
 * Add new releases at the top.
 */

export interface ChangelogRelease {
  version: string;
  date: string; // ISO date YYYY-MM-DD
  changes: string[];
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: '3.7.15',
    date: '2026-07-21',
    changes: [
      'Fixed the "Pause on Add" setting not actually taking effect on qBittorrent 5.0+ servers — it was written to a preference key that a newer qBittorrent no longer recognizes, so the toggle silently reverted whenever the screen reloaded',
      'Fixed magnet and .torrent links not opening the add-torrent dialog when tapped from another app while qRemote was fully closed (cold launch)',
    ],
  },
  {
    version: '3.7.14',
    date: '2026-07-18',
    changes: [
      'Fixed a bug where a server host pasted with a trailing slash (e.g. from a full URL) was saved with the slash intact instead of being stripped',
      'Reduced iOS launch/navigation crash risk by deferring deep-link routing until navigation is ready and removing a push/replace race in magnet and .torrent open flows',
      'Reduced iOS background/foreground crash risk by pausing heavy polling while the app is backgrounded and resuming sync/search after UI interactions complete',
    ],
  },
  {
    version: '3.7.13',
    date: '2026-07-18',
    changes: [
      'Fixed unreadable status bar icons (time, battery, signal) when the app is in light mode while the device is in dark mode',
      'Search results now add reliably: direct tracker results go through qBittorrent’s search plugin (qBittorrent 5.0+) for login/cookie handling, while Prowlarr/Jackett results use a direct add so magnet redirects resolve instantly',
      'The search sort menu now closes after picking an option and floats above the filter rows instead of pushing them down',
      'Long-pressing while multi-selecting torrents now opens a bulk actions menu: set category, add/remove tags, verify data, reannounce, resume, pause, and delete',
      'Categories and tags can now be deleted from the server: long-press a chip in the torrent detail category/tags popups, or use the delete buttons in Settings → Torrent Defaults (all with confirmation)',
      'The tag filter now has an Untagged option to show torrents with no tags, matching the category filter’s Uncategorized',
      'The "Added on" field on the detailed torrent card now shows date and time side by side on their own row',
    ],
  },
  {
    version: '3.7.12',
    date: '2026-07-16',
    changes: [
      'Progress and availability now truncate instead of rounding up — an incomplete torrent never shows "100%", and availability below 1.0 never shows "1.000" (below 1.0 the complete file cannot be assembled from connected peers)',
      'Availability is now shown as a ratio to 3 decimals (matching qBittorrent) and appears on the expanded card even when above 1.0',
    ],
  },
  {
    version: '3.7.2',
    date: '2026-07-16',
    changes: [
      'Progress and availability now truncate instead of rounding up — a torrent at 99.96% no longer shows "100%", and availability 0.9999 shows "0.999" instead of "1.00" (below 1.0 the complete file cannot be assembled from connected peers)',
      'Availability is now shown as a ratio to 3 decimals (matching qBittorrent) and appears on the expanded card even when above 1.0',
    ],
  },
  {
    version: '3.7.1',
    date: '2026-07-16',
    changes: [
      'Fixed .torrent files not offering qRemote under "Always Open With" in the Files app — tapping a torrent now opens it in qRemote instead of Preview (previously only the Share sheet worked)',
    ],
  },
  {
    version: '3.7.0',
    date: '2026-07-16',
    changes: [
      'Search is now available to everyone — search your qBittorrent plugins, filter, sort, and add results in one tap',
      'Filter search results by indexer as they load (works with Prowlarr/Jackett), plus category filtering across all plugins',
      'Search results are no longer capped at 200',
      'Search polish: filters collapse as you scroll, double-tap the tab icon to focus the search bar, result-count toast when a search finishes',
      'Fixed toasts freezing the screen on iOS — and they now actually appear on every screen',
      'Fixed an active search being wiped when switching apps — the app now reconnects only when the connection actually dropped',
      'Fixed a crash loop and a stray "Endpoint not found" toast on the search tab',
      'Upgraded to Expo SDK 57 / React Native 0.86 — now requires iOS 16.4 or later',
    ],
  },
  {
    version: '3.6.0',
    date: '2026-07-04',
    changes: ['Enabled search feature flag'],
  },
  {
    version: '3.5.1',
    date: '2026-07-04',
    changes: [
      'qRemote now registers as an "Open In" handler for .torrent files — open a torrent file from another app to add it directly',
      'Fixed connection diagnostic incorrectly reporting login failure on servers that respond with HTTP 204',
      'Compact torrent cards now show the seed ratio once a torrent is complete',
      'Added Popularity (qBittorrent 5.x) to detailed cards and the torrent detail screen',
      'Fixed Basic Auth toggle being clipped off the card edge on the server add/edit screens',
      'Translated the entire torrent detail screen into Spanish, Chinese, French and German (previously showed English)',
      'Translated most remaining screens (settings, transfer, logs, trackers, search) into Spanish, Chinese, French, German and Russian — previously showed English in several places',
      'Improved accessibility: added descriptive labels to icon-only buttons throughout the app for screen reader support',
      'Fixed a few hardcoded colors that did not adapt to dark mode (filter menu dividers, bulk-select bar border, download progress glow effect)',
      'Search results no longer show duplicate entries and scroll more smoothly',
      'Fixed "Run Full Diagnostic" falsely reporting HTTP 403 on the API check step for servers the app can otherwise connect to, by fixing the diagnostic\'s unreliable session-cookie capture',
    ],
  },
  {
    version: '3.4.2',
    date: '2026-06-27',
    changes: [
      'Expanded torrent card now shows details in a two-column grid, cutting card height roughly in half',
      'Detail card field toggles (ETA, speeds, availability, seeding time) now always appear when enabled, showing — when no live data is available',
      'Set Category popup redesigned to match the Tags popup: chip-based selection, all server categories listed, create new inline',
      'Creating a new category from the torrent detail screen is now fixed — categories are properly saved to the server before being assigned',
      'Tags displayed in the torrent detail screen now appear as individual chips matching the Category badge style',
      'Improved qBittorrent v4.x compatibility',
      'Added category and tag filters to the torrents tab — tap the Category or Tags chip in the filter row to narrow the list',
      'Tag filters use OR semantics: a torrent matches if it has any of the selected tags',
      'Filter selections are remembered across sessions',
      'Search plugin support (feature flag - disabled for App Store builds)',
      'Added optional Basic Auth credentials for servers behind a reverse proxy',
    ],
  },
  {
    version: '3.3.0',
    date: '2026-06-05',
    changes: [
      'Theme now follows your system light/dark appearance automatically',
      'Added server fallback URL support with automatic failover',
      'Fixed top safe-area background color in tabs so the status bar matches',
    ],
  },
  {
    version: '3.2.1',
    date: '2026-05-29',
    changes: ['Minor bugfixes'],
  },
  {
    version: '3.2.0',
    date: '2026-05-29',
    changes: ['Search plugin support'],
  },
  {
    version: '3.1.2',
    date: '2026-05-29',
    changes: [
      'Fixed alternative speed limit units, key handling, and IEC labels',
      'Added ability to rename files and folders from the file browser',
    ],
  },
  {
    version: '3.1.1',
    date: '2026-05-26',
    changes: [
      'Improved authentication to support qBittorrent 5.x 204 + Set-Cookie login responses',
    ],
  },
  {
    version: '3.1.0',
    date: '2026-04-11',
    changes: [
      'Replaced all Alert.prompt dialogs with InputModal for consistent cross-platform text input',
      'Resolved Rules of Hooks violation in Confetti component — confetti animations are now reliable',
      'Fixed pause button missing onPress handler in torrent cards',
      'Corrected background color reference in root layout and trimmed trailing space from app name',
    ],
  },
  {
    version: '3.0.1',
    date: '2026-03-31',
    changes: [
      'Added Russian (ru) translation',
      'Fixed card view layout inconsistencies in the torrent list',
    ],
  },
  {
    version: '3.0.0',
    date: '2026-03-28',
    changes: [
      'Full UI overhaul: redesigned navigation, typography, and layout for a more polished, consistent experience across all screens',
      'Refactored core connection layer for improved reliability, faster reconnects, and cleaner error surfacing',
      'Torrent list performance improvements — large libraries scroll noticeably smoother with reduced re-render overhead',
      'Consolidated settings architecture: preferences, server config, and theme controls unified under a single, restructured settings flow',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-03-11',
    changes: [
      'Quick-connect: tap any saved server directly from the not-connected screen — no digging through Settings',
      'Torrent detail view now live-updates automatically, so progress, speed, and state stay current without a manual pull-to-refresh',
      'Transfer tab recovers silently from brief connection drops instead of throwing a full error screen',
      'Settings preferences now actually do something — connection timeout, retry attempts, haptic feedback, pause-on-add, and more are wired up end-to-end',
      'Bottom tab bar color is now consistent across all tabs',
      'Upload-only torrent state color updated to a cleaner green',
    ],
  },
  {
    version: '2.1.2',
    date: '2026-03-11',
    changes: [
      'Fixed torrent state colors: torrents uploading and downloading uses user defined theme',
    ],
  },
  {
    version: '2.1.1',
    date: '2026-03-01',
    changes: [
      'Files: file tree no longer collapses after toggling download or changing priority',
      'Files: long and nested file names wrap to multiple lines instead of being cut off',
      'Files: "Change Priority" bulk button to set priority for all selected files (themed menu)',
      'Files: fixed file count display layout (selected/total no longer cut off)',
    ],
  },
  {
    version: '2.1.0',
    date: '2025-02-27',
    changes: [
      'Customizable torrent state colors in Theme & Colors (downloading, seeding, upload only, error, stalled, paused, checking, metadata, queued, other)',
      'Separate reset-to-default for torrent state colors (Advanced colors reset unchanged)',
      'Torrent state colors section moved above Advanced colors in theme settings',
    ],
  },
  {
    version: '2.0.2',
    date: '2025-02-26',
    changes: ['Fixed default save path updates not being applied on the qBittorrent server'],
  },
  {
    version: '2.0.1',
    date: '2026-02-19',
    changes: [
      'Fixed transfer stats (free disk space, queued size, avg queue time) disappearing after switching server',
      "What's New popup updated with v2.0.0 and v1.1.3 release notes",
    ],
  },
  {
    version: '2.0.0',
    date: '2026-02-18',
    changes: [
      'Export logs with connectivity logging and debug panel export button',
      'Applied Apple developer NSAllowsArbitraryLoads flag',
      'Info button for torrent seed percent/leech',
      'Sorting by ratio',
      'Language translation support',
    ],
  },
  {
    version: '1.1.3',
    date: '2026-02-06',
    changes: [
      'Bugfix: hostname handling',
      'Fix protocol prefix handling and add community links',
      'General bugfix and cleanup',
    ],
  },
  {
    version: '1.1.2',
    date: '2026-02-05',
    changes: [
      'Backwards compatibility improvements for existing server configs',
      'Fixed basePath persistence for reverse proxy users',
      'Normalized host format on load to prevent double-protocol issues on upgrade',
      'Include basePath in settings export and import',
      'Defensive theme loading for legacy preference formats',
      'Coerce numeric preferences (timeouts, intervals) for robustness',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-02-02',
    changes: [
      'Fixed protocol prefix handling - no more double http:// issues',
      'Simplified server configuration with helpful tooltips',
      'Added cancel button during connection testing',
      'Removed confusing Base Path field',
      "Added What's New section",
      'Improved UX with cleaner placeholders and info icons',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-02-01',
    changes: [
      'Fixed hostname handling and connection issues',
      'Improved loading screen experience',
      'Better background app restoration',
    ],
  },
  {
    version: '1.0.6',
    date: '2024-12-16',
    changes: ['Fixed popup and Android localhost issues', 'General stability improvements'],
  },
  {
    version: '1.0.5',
    date: '2024-12-14',
    changes: [
      'Major UI cleanup and enhancements',
      'Improved add server form robustness',
      'Added credential toggle for local networks',
      'Fixed Android server configuration issues',
    ],
  },
];
