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
    changes: [
      'Fixed default save path updates not being applied on the qBittorrent server',
    ],
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
    changes: [
      'Fixed popup and Android localhost issues',
      'General stability improvements',
    ],
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
