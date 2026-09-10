// Release-name parser: turns a noisy scene/torrent name into a clean title
// (plus optional year / season / episode / quality metadata) so it can be
// looked up on an artwork provider like TMDB, or shown as a tidy row title.
//
// Examples:
//   "Show.Name.S02E03.1080p.WEB-DL.x264-GRP" -> title "Show Name", season 2,
//     episode 3, looksLikeTV true, resolution "1080p", source "WEB",
//     codec "x264", group "GRP"
//   "The Matrix (1999) [1080p]" -> title "The Matrix", year 1999
//
// Pure functions only: no React, no I/O. Ported from the PogonaCore Swift
// parsers (ReleaseName.swift for the richer struct/token tables, and
// MediaTitleParser.swift for the junk-token set and title-cut walk).

export interface ParsedReleaseName {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  looksLikeTV: boolean;
  resolution?: string;
  source?: string;
  codec?: string;
  group?: string;
  languages: string[];
}

// -- Token tables (uppercase keys; matched case-insensitively) -------------

const RESOLUTIONS: Record<string, string> = {
  '2160P': '4K',
  '4K': '4K',
  UHD: '4K',
  '1080P': '1080p',
  '1080I': '1080i',
  '720P': '720p',
  '720I': '720i',
  '480P': '480p',
  '576P': '576p',
};

const SOURCES: Record<string, string> = {
  BLURAY: 'BluRay',
  BDRIP: 'BDRip',
  BDREMUX: 'BDRemux',
  BRRIP: 'BluRay',
  WEBDL: 'WEB',
  WEBRIP: 'WEB',
  WEB: 'WEB',
  HDTV: 'HDTV',
  DVDRIP: 'DVDRip',
  DVD: 'DVD',
  HDCAM: 'CAM',
  CAM: 'CAM',
  TS: 'TS',
  REMUX: 'REMUX',
  HDRIP: 'HDRip',
};

const LANGUAGES: Record<string, string> = {
  MULTI: 'MULTI',
  MULTITRUEFRENCH: 'MULTI',
  VFF: 'VFF',
  VFQ: 'VFQ',
  VF2: 'VF2',
  VFI: 'VFI',
  VFO: 'VFO',
  VOF: 'VOF',
  VF: 'VF',
  VOSTFR: 'VOSTFR',
  VOST: 'VOST',
  TRUEFRENCH: 'TRUEFRENCH',
  FRENCH: 'FRENCH',
  ENG: 'ENG',
  ENGLISH: 'ENG',
};

const CODECS: Record<string, string> = {
  X264: 'x264',
  X265: 'x265',
  H264: 'x264',
  H265: 'x265',
  HEVC: 'x265',
  AVC: 'x264',
  XVID: 'XviD',
  DIVX: 'DivX',
  AV1: 'AV1',
  VC1: 'VC-1',
};

// Audio / edition / generic-quality tokens: they end the title (they are
// junk for display purposes) but are not stored in any struct field.
const EDITION_MARKERS = new Set([
  'EAC3',
  'AC3',
  'DD',
  'DDP',
  'DD5',
  'DDP5',
  'AAC',
  'DTS',
  'DTSHD',
  'FLAC',
  'MP3',
  'ATMOS',
  'TRUEHD',
  'DOLBY',
  'REPACK',
  'PROPER',
  'INTERNAL',
  'EXTENDED',
  'UNRATED',
  'REMASTERED',
  'INTEGRALE',
  'INTÉGRALE',
  'LIMITED',
  'COMPLETE',
  'IMAX',
  'HDR',
  'HDR10',
  'HDR10PLUS',
  'SDR',
  'DV',
  '10BIT',
  '8BIT',
  'HD',
]);

// -- Normalisation / structural regexes -------------------------------------

// Trailing filename extension, stripped before anything else so a dotted
// extension never ends up mistaken for a release token.
const EXTENSION_RE = /\.(mkv|mp4|avi|iso|torrent)$/i;

// Multi-token quality markers, collapsed to a single canonical spelling so
// the later split on separators keeps them whole (`Blu-Ray` -> `BluRay`,
// `WEB-DL` -> `WEBDL`, `H.264` -> `H264`). This runs before the trailing
// release-group strip so a `WEB-DL` tail is never mistaken for a `-DL` group.
const NORMALIZATIONS: Array<[RegExp, string]> = [
  [/blu[\s._-]?ray/gi, 'BluRay'],
  [/web[\s._-]?dl/gi, 'WEBDL'],
  [/web[\s._-]?rip/gi, 'WEBRip'],
  [/\bH[\s._-]?26([45])\b/gi, 'H26$1'],
  [/\bx[\s._-]?26([45])\b/gi, 'x26$1'],
];

// Trailing `-GROUP` release tag (`-FW`, `-AiRLiNE`).
const GROUP_RE = /-([A-Za-z0-9]{2,})$/;

// Characters normalised to spaces before tokenising. Hyphens are left alone
// here: they are handled as a token separator during the split below (after
// the release-group strip has already consumed a trailing `-GROUP`).
const SEPARATORS_RE = /[_.[\]{}()]/g;

// -- Token classification ---------------------------------------------------

function parseSeasonEpisodeToken(token: string): { season: number; episode?: number } | null {
  let m = /^S(\d{1,2})(?:E(\d{1,3}))?$/i.exec(token);
  if (m) {
    return {
      season: parseInt(m[1], 10),
      episode: m[2] !== undefined ? parseInt(m[2], 10) : undefined,
    };
  }
  // `1x02` / `01x123` form.
  m = /^(\d{1,2})x(\d{1,3})$/i.exec(token);
  if (m) {
    return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
  }
  return null;
}

function parseYearToken(token: string): number | undefined {
  if (!/^\d{4}$/.test(token)) return undefined;
  const y = parseInt(token, 10);
  if (y < 1900 || y > 2099) return undefined;
  return y;
}

function isMetadataMarker(token: string): boolean {
  if (parseSeasonEpisodeToken(token)) return true;
  if (parseYearToken(token) !== undefined) return true;
  const upper = token.toUpperCase();
  return (
    upper in RESOLUTIONS ||
    upper in SOURCES ||
    upper in LANGUAGES ||
    upper in CODECS ||
    EDITION_MARKERS.has(upper)
  );
}

// -- Public API ---------------------------------------------------------------

export function parseReleaseName(name: string): ParsedReleaseName {
  let working = name.replace(EXTENSION_RE, '');

  for (const [re, replacement] of NORMALIZATIONS) {
    working = working.replace(re, replacement);
  }

  let group: string | undefined;
  const groupMatch = GROUP_RE.exec(working);
  if (groupMatch) {
    group = groupMatch[1];
    working = working.slice(0, groupMatch.index);
  }

  working = working.replace(SEPARATORS_RE, ' ');
  const tokens = working.split(/[\s-]+/).filter((t) => t.length > 0);

  // The title is the leading run of tokens up to the first metadata/junk
  // marker (season/episode, year, resolution, source, language, codec, or
  // an edition tag). Bare digits stay eligible for the title so names like
  // "9 1 1 Nashville" survive.
  let boundary = tokens.length;
  for (let i = 0; i < tokens.length; i++) {
    if (isMetadataMarker(tokens[i])) {
      boundary = i;
      break;
    }
  }

  // Drop apostrophe artifacts (`Tom.Clancy.s` -> bare `s`) but keep numeric
  // tokens (some titles are just numbers).
  const titleTokens = tokens.slice(0, boundary).filter((t) => t.length > 1 || /^\d+$/.test(t));
  let title = titleTokens.join(' ').trim();
  if (!title) {
    // Fallback: if everything got stripped, keep the first few raw tokens
    // rather than returning nothing.
    title = tokens.slice(0, 3).join(' ').trim();
  }
  if (!title) {
    title = name.trim();
  }

  let year: number | undefined;
  let season: number | undefined;
  let episode: number | undefined;
  let resolution: string | undefined;
  let source: string | undefined;
  let codec: string | undefined;
  const languages: string[] = [];

  // Classify every token from the boundary onward (unlike the title cut,
  // this keeps scanning past the first marker so e.g. resolution, source
  // and codec can all be picked up from one name).
  for (const token of tokens.slice(boundary)) {
    const se = parseSeasonEpisodeToken(token);
    if (se) {
      if (season === undefined) season = se.season;
      if (episode === undefined && se.episode !== undefined) episode = se.episode;
      continue;
    }
    const y = parseYearToken(token);
    if (year === undefined && y !== undefined) {
      year = y;
      continue;
    }
    const upper = token.toUpperCase();
    if (resolution === undefined && RESOLUTIONS[upper]) {
      resolution = RESOLUTIONS[upper];
      continue;
    }
    if (LANGUAGES[upper]) {
      const lang = LANGUAGES[upper];
      if (!languages.includes(lang)) languages.push(lang);
      continue;
    }
    if (source === undefined && SOURCES[upper]) {
      source = SOURCES[upper];
      continue;
    }
    if (codec === undefined && CODECS[upper]) {
      codec = CODECS[upper];
      continue;
    }
    // Audio / edition tokens are intentionally ignored: they already ended
    // the title (if encountered before the boundary) and carry no field.
  }

  return {
    title,
    year,
    season,
    episode,
    looksLikeTV: season !== undefined,
    resolution,
    source,
    codec,
    group,
    languages,
  };
}

/// Zero-padded episode tag, e.g. `S02E03`, or `S05` for a whole season.
function episodeTag(p: ParsedReleaseName): string | undefined {
  if (p.season === undefined) return undefined;
  const s = String(p.season).padStart(2, '0');
  if (p.episode === undefined) return `S${s}`;
  return `S${s}E${String(p.episode).padStart(2, '0')}`;
}

/**
 * One-line title for dense rows: clean title + episode/year suffix, e.g.
 * `Nashville · S01E15` or `Planet Earth II · 2016`. Falls back to the bare
 * title when there is neither a season/episode nor a year.
 */
export function rowTitle(p: ParsedReleaseName): string {
  const suffix = episodeTag(p) ?? (p.year !== undefined ? String(p.year) : undefined);
  if (!suffix) return p.title;
  return `${p.title} · ${suffix}`;
}
