/**
 * torrent-filters.ts - Pure status-filter predicate shared by the sidebar
 * (components/shell/Sidebar.tsx) and its counts.
 *
 * matchesStatusFilter() mirrors app/(tabs)/(torrents)/index.tsx's local
 * `filteredTorrents` switch exactly (same filter ids, same branch order,
 * same tie-breaks) - see that file's `filteredTorrents` useMemo. It is a
 * deliberate re-implementation, not a shared import, per the sidebar's own
 * "reimplement, don't edit index.tsx" instruction; `isTorrentCompleted` is
 * imported rather than re-derived because it already lives in the shared,
 * independently-tested utils/torrent-state.ts that index.tsx itself calls
 * into for the same branch.
 *
 * index.tsx's predicate was unambiguous for all seven ids - no judgment
 * calls were needed to port it.
 */
import { TorrentInfo } from '@/types/api';
import { isTorrentCompleted } from '@/utils/torrent-state';

export type StatusFilterId =
  'all' | 'active' | 'completed' | 'paused' | 'stuck' | 'downloading' | 'uploading';

/** Same order index.tsx's `filterOptions` renders its chips in. */
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
      return torrent.state === 'downloading';
    case 'uploading':
      return torrent.state === 'uploading';
    case 'completed':
      return isTorrentCompleted(torrent.state, torrent.progress);
    case 'paused':
      return (
        torrent.state === 'pausedDL' ||
        torrent.state === 'pausedUP' ||
        torrent.state === 'stoppedDL' ||
        torrent.state === 'stoppedUP'
      );
    case 'active':
      return torrent.dlspeed > 0 || torrent.upspeed > 0;
    case 'stuck':
      // Exclude seeding torrents (100% complete and stalledUP) - seeding is
      // not stuck.
      if (torrent.state === 'stalledUP' && torrent.progress >= 1) {
        return false;
      }
      return (
        torrent.state === 'stalledDL' || torrent.state === 'stalledUP' || torrent.state === 'metaDL'
      );
    default:
      return true;
  }
}
