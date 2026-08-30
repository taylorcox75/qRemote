/**
 * trackers.ts — Helpers for qBittorrent's torrents/trackers response, which
 * prepends three pseudo-tracker entries (`** [DHT] **`, `** [PeX] **`,
 * `** [LSD] **`) representing those decentralized peer-discovery channels
 * rather than real announce URLs. Casing of the bracketed tag isn't
 * guaranteed across qBittorrent versions, so matching is case-insensitive.
 */
import { Tracker } from '@/types/api';

const PSEUDO_TRACKER_PATTERN = /\*\*\s*\[(dht|pex|lsd)\]\s*\*\*/i;

/** True for a normal announce-URL tracker, false for the DHT/PeX/LSD pseudo-entries. */
export function isRealTracker(url: string): boolean {
  return !!url && !PSEUDO_TRACKER_PATTERN.test(url);
}

export type DiscoveryChannel = 'dht' | 'pex' | 'lsd';
export type ChannelState = 'working' | 'notWorking' | 'disabled' | 'unknown';

// qBittorrent tracker status: 0 disabled, 1 not contacted, 2 working, 3 updating, 4 not working.
const STATUS_TO_STATE: Record<number, ChannelState> = {
  0: 'disabled',
  1: 'unknown',
  2: 'working',
  3: 'working',
  4: 'notWorking',
};

/**
 * Reads each discovery channel's state from the torrent's own pseudo-tracker
 * entries. A channel is `null` when its pseudo-tracker entry isn't present at
 * all (rather than 'unknown', which means present but not yet contacted).
 */
export function getPseudoTrackerStates(
  trackers: Tracker[],
): Record<DiscoveryChannel, ChannelState | null> {
  const result: Record<DiscoveryChannel, ChannelState | null> = {
    dht: null,
    pex: null,
    lsd: null,
  };
  for (const tracker of trackers) {
    const match = tracker.url.match(/\[(dht|pex|lsd)\]/i);
    if (!match) continue;
    const channel = match[1].toLowerCase() as DiscoveryChannel;
    result[channel] = STATUS_TO_STATE[tracker.status] ?? 'unknown';
  }
  return result;
}
