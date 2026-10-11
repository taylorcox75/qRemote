/**
 * search-tracker-topup.ts — attach the other sources' trackers to a torrent just
 * added from a group of duplicate Search results (#267).
 *
 * When a group is made of `.torrent` links the add itself can only carry the
 * primary's file. If the hash resolver (hooks/useSearchHashResolver.ts) learned
 * the other members' trackers, they are added afterwards with `addTrackers`, once
 * the torrent exists. Whichever route the add takes — instant, or the add-torrent
 * dialogue the user may keep open as long as they like — it ends with a torrent in
 * the client under a known torrent ID, which is what this waits for.
 *
 * Everything here is best-effort and silent: the add already succeeded (or was
 * abandoned), and a missing tracker is a nicety, not an error.
 */
import { torrentsApi } from '@/services/api/torrents';
import { tagsApi } from '@/services/api/tags';
import { clogDebug, clogWarn } from '@/services/connectivity-log';
import { TorrentInfo } from '@/types/api';
import { getErrorMessage } from '@/utils/error';

/**
 * The wait is long because the usual route is the add dialogue — the torrent
 * does not exist until the user finishes it. Cheap: one tiny `hashes=` lookup
 * per poll, and only for groups that actually have trackers to add.
 */
export const TRACKER_TOPUP_ATTEMPTS = 60;
export const TRACKER_TOPUP_DELAY_MS = 3000;

export interface TrackerFollowUp {
  /** qBittorrent's torrent ID (what `torrents/info?hashes=` and `addTrackers` take). */
  torrentId: string;
  trackers: string[];
}

/** Resolves after `ms`, or immediately if `signal` aborts first. */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** The client's entry for this torrent ID, if it has one. */
async function findTorrentById(torrentId: string): Promise<TorrentInfo | undefined> {
  const found = await torrentsApi.getTorrentList(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    [torrentId],
  );
  return found[0];
}

/**
 * Poll until the torrent shows up, then add the trackers once. A failed lookup
 * is just a blip and keeps waiting; a failed `addTrackers` is logged and NOT
 * retried. Stops quietly when `signal` aborts or the attempts run out.
 */
export async function addTrackersWhenTorrentAppears(
  followUp: TrackerFollowUp,
  signal: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < TRACKER_TOPUP_ATTEMPTS; attempt++) {
    await abortableDelay(TRACKER_TOPUP_DELAY_MS, signal);
    if (signal.aborted) return;
    let torrent: TorrentInfo | undefined;
    try {
      torrent = await findTorrentById(followUp.torrentId);
    } catch {
      continue;
    }
    if (signal.aborted) return;
    if (!torrent) continue;
    try {
      await torrentsApi.addTrackers(torrent.hash, followUp.trackers);
      clogDebug(
        'SEARCH',
        `Added ${followUp.trackers.length} tracker(s) from other sources to ${followUp.torrentId}`,
      );
    } catch (err: unknown) {
      clogWarn('SEARCH', `Could not add trackers from other sources: ${getErrorMessage(err)}`);
    }
    return;
  }
}

/**
 * Get ready to top a torrent up. Returns a `start` function to call once the
 * add has been submitted — it begins the background wait, registering its
 * AbortController in `activePolls` so the screen can abort it on unmount — or
 * null when there is nothing to do: the client ALREADY has this torrent (adding
 * the group again is the user's duplicate, not ours to tamper with), or that
 * could not be established. Never throws.
 *
 * The existence check happens here, before the add, so a torrent the client
 * already had is never mistaken for the one about to be added.
 */
export async function prepareTrackerTopUp(
  followUp: TrackerFollowUp,
  activePolls: Set<AbortController>,
): Promise<(() => void) | null> {
  try {
    if (await findTorrentById(followUp.torrentId)) return null;
  } catch {
    return null;
  }
  return () => {
    const controller = new AbortController();
    activePolls.add(controller);
    void addTrackersWhenTorrentAppears(followUp, controller.signal)
      .catch(() => {})
      .finally(() => {
        activePolls.delete(controller);
      });
  };
}

const TAG_MATCH_ATTEMPTS = 8;
const TAG_MATCH_DELAY_MS = 2000;

/**
 * search/downloadTorrent (used for plugin-native downloads, see
 * handleAddResult) never reports which torrent it added — it's fire-and-forget
 * server-side. Best-effort: poll the torrent list for a name match and tag it
 * once it appears, silently (no toast) since this is a background nicety, not
 * a user-initiated action. Prefers the newest match by `added_on` when several
 * share the same name. Aborts cleanly when `signal` is aborted (e.g. unmount).
 */
export async function tagNewlyDownloadedTorrent(
  fileName: string,
  tag: string,
  signal?: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < TAG_MATCH_ATTEMPTS; attempt++) {
    if (signal?.aborted) return;
    await abortableDelay(TAG_MATCH_DELAY_MS, signal);
    if (signal?.aborted) return;
    try {
      const list = await torrentsApi.getTorrentList();
      if (signal?.aborted) return;
      const match = list
        .filter(
          (torrent) =>
            torrent.name === fileName &&
            !torrent.tags
              .split(',')
              .map((existing) => existing.trim())
              .includes(tag),
        )
        .sort((a, b) => (b.added_on ?? 0) - (a.added_on ?? 0))[0];
      if (match) {
        await tagsApi.createTags([tag]);
        if (signal?.aborted) return;
        await torrentsApi.addTorrentTags([match.hash], [tag]);
        clogDebug('SEARCH', `Auto-tagged "${fileName}" with tracker tag "${tag}"`);
        return;
      }
    } catch {
      // Keep retrying — best-effort only, no user-facing error.
    }
  }
  if (signal?.aborted) return;
  clogWarn('SEARCH', `Could not find newly added torrent "${fileName}" to auto-tag with "${tag}"`);
}
