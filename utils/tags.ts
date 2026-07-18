/**
 * tags.ts — Shared helpers for parsing qBittorrent's comma-separated tag strings.
 *
 * qBittorrent stores tags on TorrentInfo as a single CSV string (e.g. "linux,iso,seedbox").
 * These utilities centralise the split logic used across filter, display, and edit surfaces.
 */

/** Parse a torrent's CSV tag string into a trimmed, non-empty array. */
export function parseTagsCsv(csv: string): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Sentinel filter value meaning "torrents with no tags at all". Never a real
 * tag name — kept out of any UI that writes tags to the server (only the
 * filter picker offers it, mirroring the category filter's Uncategorized).
 */
export const UNTAGGED_FILTER = '__untagged__';

/**
 * Returns true if the torrent's tags string contains at least one of the
 * selected filter tags (OR semantics — matching any selected tag is sufficient).
 * The UNTAGGED_FILTER sentinel matches torrents that have no tags.
 */
export function torrentHasAnyTag(torrentTagsCsv: string, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true;
  const torrentTags = parseTagsCsv(torrentTagsCsv);
  if (selectedTags.includes(UNTAGGED_FILTER) && torrentTags.length === 0) return true;
  return selectedTags.some((sel) => torrentTags.includes(sel));
}
