/**
 * torrent-filters.ts - Pure status-filter predicate shared by the sidebar
 * (components/shell/Sidebar.tsx) and its counts.
 *
 * Compact (iPhone) chips keep the original seven ids (`STATUS_FILTER_IDS`)
 * and index.tsx's own switch. The regular/mac sidebar uses
 * `DESKTOP_STATUS_FILTER_IDS` (Pogona's État buckets) and
 * `matchesStatusFilter` for both counts and list filtering.
 *
 * `isTorrentCompleted` is imported from utils/torrent-state.ts.
 */
import { TorrentInfo } from '@/types/api';
import { isTorrentCompleted } from '@/utils/torrent-state';

export type StatusFilterId =
  | 'all'
  | 'active'
  | 'completed'
  | 'paused'
  | 'stuck'
  | 'downloading'
  | 'uploading'
  | 'seeding'
  | 'running'
  | 'inactive'
  | 'stalled'
  | 'checking'
  | 'error';

/** Same order index.tsx's `filterOptions` renders its chips in. Compact only. */
export const STATUS_FILTER_IDS: StatusFilterId[] = [
  'all',
  'active',
  'completed',
  'paused',
  'stuck',
  'downloading',
  'uploading',
];

/**
 * Pogona FilterSidebar "État" buckets. Used by the regular/mac sidebar only;
 * compact keeps STATUS_FILTER_IDS (the chip row) unchanged.
 */
export const DESKTOP_STATUS_FILTER_IDS: StatusFilterId[] = [
  'all',
  'downloading',
  'seeding',
  'completed',
  'running',
  'paused',
  'active',
  'inactive',
  'stalled',
  'checking',
  'error',
];

const PAUSED_STATES = new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']);
const CHECKING_STATES = new Set(['checkingDL', 'checkingUP', 'checkingResumeData', 'allocating']);
const ERROR_STATES = new Set(['error', 'missingFiles']);
const SEEDING_STATES = new Set(['uploading', 'forcedUP']);
const DOWNLOADING_STATES = new Set(['downloading', 'forcedDL', 'metaDL', 'forcedMetaDL']);

/**
 * Returns true when `torrent` belongs to `filterId`. `filterId` is typed as
 * `string` (not `StatusFilterId`) so callers holding a persisted or
 * user-controlled filter id (e.g. ShellContext's ListFilter.status) don't
 * need to narrow it first - an unrecognised id falls through to `true`,
 * matching index.tsx's switch `default`.
 */
export function matchesStatusFilter(torrent: TorrentInfo, filterId: string): boolean {
  switch (filterId) {
    case 'all':
      return true;
    case 'downloading':
      // Compact chips still match only `state === 'downloading'` via
      // index.tsx's own switch. Desktop (and this helper) follow Pogona /
      // qBittorrent's Downloading bucket: active DL, forced DL, and metadata.
      return DOWNLOADING_STATES.has(torrent.state);
    case 'uploading':
      return torrent.state === 'uploading';
    case 'seeding':
      return SEEDING_STATES.has(torrent.state);
    case 'completed':
      return isTorrentCompleted(torrent.state, torrent.progress);
    case 'paused':
      return PAUSED_STATES.has(torrent.state);
    case 'running':
      return !PAUSED_STATES.has(torrent.state);
    case 'active':
      return torrent.dlspeed > 0 || torrent.upspeed > 0;
    case 'inactive':
      return torrent.dlspeed <= 0 && torrent.upspeed <= 0;
    case 'stuck':
      // Exclude seeding torrents (100% complete and stalledUP) - seeding is
      // not stuck. Compact chip behaviour, kept byte-identical.
      if (torrent.state === 'stalledUP' && torrent.progress >= 1) {
        return false;
      }
      return (
        torrent.state === 'stalledDL' || torrent.state === 'stalledUP' || torrent.state === 'metaDL'
      );
    case 'stalled':
      return torrent.state === 'stalledDL' || torrent.state === 'stalledUP';
    case 'checking':
      return CHECKING_STATES.has(torrent.state);
    case 'error':
      return ERROR_STATES.has(torrent.state);
    default:
      return true;
  }
}

/**
 * Host of a working-tracker URL, matching Pogona's `Transfer.trackerHost`.
 * Empty string when the URL is missing or unparseable.
 */
export function trackerHost(trackerUrl: string | undefined | null): string {
  if (!trackerUrl) return '';
  try {
    const withScheme = trackerUrl.includes('://') ? trackerUrl : `http://${trackerUrl}`;
    return new URL(withScheme).hostname;
  } catch {
    return '';
  }
}

export interface TrackerHostCount {
  host: string;
  count: number;
}

/** Deduped tracker hosts across a torrent list, sorted by hostname. */
export function trackerHosts(torrents: TorrentInfo[]): TrackerHostCount[] {
  const counts = new Map<string, number>();
  for (const torrent of torrents) {
    const host = trackerHost(torrent.tracker);
    if (!host) continue;
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => a.host.localeCompare(b.host));
}
