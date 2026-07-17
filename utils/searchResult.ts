/**
 * searchResult.ts — helpers shared across the Search tab and result rows.
 */
import { SearchResult } from '@/types/api';

/**
 * Derive a display-friendly tracker/site host from a search result's
 * `siteUrl`. This is a heuristic, not a canonical indexer id — qBittorrent's
 * search API doesn't return which plugin produced a given result.
 */
export function siteHost(url: string): string {
  if (!url) return '';
  const stripped = url.replace(/^https?:\/\//i, '');
  return stripped.split('/')[0] || stripped;
}

const BRACKET_PREFIX = /^\[([^[\]]{1,40})\]\s*/;
const BRACKET_SUFFIX = /\s*\[([^[\]]{1,40})\]\s*$/;

// Common bracketed quality/codec/source/request tags in release titles that
// must never be mistaken for an indexer name (e.g. "Movie.2024 [1080p]").
const JUNK_TAG =
  /^(?:\d{3,4}[pi]|x\.?26[45]|h\.?26[45]|hevc|avc|av1|web-?dl|web-?rip|blu-?ray|bd-?rip|br-?rip|dvd-?rip|hdtv|remux|hdr10\+?|hdr|dolby.?vision|dv|aac(?:\d\.\d)?|dts(?:-?hd)?(?:.?ma)?|ac-?3|e-?ac-?3|ddp?\d\.\d|flac|mp3|opus|10-?bit|8-?bit|multi|dual.?audio|req(?:uest)?|internal|proper|repack|complete|extended|remastered|subbed|dubbed)$/i;

function validTag(raw: string | undefined): string | null {
  const tag = raw?.trim();
  if (!tag || JUNK_TAG.test(tag)) return null;
  return tag;
}

/**
 * Extract a `[Tag]` at the very end or start of a title. Bridge/aggregator
 * search plugins (Prowlarr, Jackett) route every result through one
 * qBittorrent plugin entry, so `siteUrl` is identical for every hit — they
 * conventionally embed the real per-result indexer name as a bracketed tag
 * in the title instead, since qBittorrent's search plugin protocol has no
 * dedicated per-result indexer field.
 *
 * Suffix is checked first (aggregators append the tracker tag at the END by
 * default — Prowlarr's `tracker_first: false`), then prefix (the
 * `tracker_first: true` variant). Known quality/codec tags are skipped at
 * both positions so "Movie [1080p]" yields no tag and "[REQ] Movie
 * [MyIndexer]" resolves to the indexer, not the request marker.
 */
export function extractBracketTag(fileName: string): string | null {
  if (!fileName) return null;
  const suffixTag = validTag(BRACKET_SUFFIX.exec(fileName)?.[1]);
  if (suffixTag) return suffixTag;
  return validTag(BRACKET_PREFIX.exec(fileName)?.[1]);
}

/**
 * Best-effort per-result indexer/tracker label. Pass `isAggregated: true`
 * when every result in the current batch shares one `siteUrl` (a strong
 * signal the search went through a proxying plugin like Prowlarr/Jackett),
 * so the bracketed-title tag is preferred over the constant host.
 */
export function resultTrackerLabel(result: SearchResult, isAggregated: boolean): string {
  if (isAggregated) {
    const tag = extractBracketTag(result.fileName);
    if (tag) return tag;
  }
  return siteHost(result.siteUrl);
}
