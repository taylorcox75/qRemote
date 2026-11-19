/**
 * release-tags.ts — video codec (#304) and release source (#302) tags parsed
 * from a release name, for the Search filter panel's chip groups.
 *
 * Names separate tokens with dots, dashes, underscores, spaces or brackets
 * ("Show.S01E01.1080p.WEB-DL.H.265-GRP"), so the name is lowercased and every
 * run of separators becomes one space before matching whole words. That lets
 * "H.265", "h265" and "HEVC" all read as the same codec, and keeps "x2650"
 * or "webrips" from matching by accident.
 */

export const SEARCH_CODEC_OPTIONS = ['x265', 'x264', 'av1'] as const;
export type SearchCodecOption = (typeof SEARCH_CODEC_OPTIONS)[number];

export const SEARCH_SOURCE_OPTIONS = ['bluray', 'remux', 'web-dl', 'webrip'] as const;
export type SearchSourceOption = (typeof SEARCH_SOURCE_OPTIONS)[number];

/** Chip labels — technical tags, the same in every language. */
export const CODEC_LABELS: Record<SearchCodecOption, string> = {
  x265: 'x265 / HEVC',
  x264: 'x264 / AVC',
  av1: 'AV1',
};
export const SOURCE_LABELS: Record<SearchSourceOption, string> = {
  bluray: 'BluRay',
  remux: 'REMUX',
  'web-dl': 'WEB-DL',
  webrip: 'WEBRip',
};

const CODEC_PATTERNS: Record<SearchCodecOption, RegExp> = {
  x265: /\b(x ?265|h ?265|hevc)\b/,
  x264: /\b(x ?264|h ?264|avc)\b/,
  av1: /\bav1\b/,
};

const SOURCE_PATTERNS: Record<SearchSourceOption, RegExp> = {
  bluray: /\b(blu ?ray|bd ?rip|br ?rip|bdremux)\b/,
  remux: /\b(remux|bdremux)\b/,
  // Scene names often write a WEB-DL as just "WEB"; a WEBRip never is.
  'web-dl': /\b(web ?dl)\b|\bweb\b(?! ?rip\b)/,
  webrip: /\bweb ?rip\b/,
};

function normalize(name: string | null | undefined): string {
  return ` ${(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/** Every codec tag found in `name` (a release can carry none). */
export function getReleaseCodecs(name: string | null | undefined): SearchCodecOption[] {
  const n = normalize(name);
  return SEARCH_CODEC_OPTIONS.filter((c) => CODEC_PATTERNS[c].test(n));
}

/** Every source tag found in `name` — "BluRay REMUX" is both. */
export function getReleaseSources(name: string | null | undefined): SearchSourceOption[] {
  const n = normalize(name);
  return SEARCH_SOURCE_OPTIONS.filter((s) => SOURCE_PATTERNS[s].test(n));
}
