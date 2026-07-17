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
 * Returns true if the torrent's tags string contains at least one of the
 * selected filter tags (OR semantics — matching any selected tag is sufficient).
 */
export function torrentHasAnyTag(torrentTagsCsv: string, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true;
  const torrentTags = parseTagsCsv(torrentTagsCsv);
  return selectedTags.some((sel) => torrentTags.includes(sel));
}
