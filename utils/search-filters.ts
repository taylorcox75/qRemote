/**
 * Client-side filters for Search tab results. qBittorrent's search API has no
 * server-side filtering beyond plugin/category, so these run on whatever the
 * job has returned so far. Pure — no React, no storage.
 *
 * The name / seeders / size filters mirror the qBittorrent WebUI's Search tab
 * (`SearchResultsTable.getFilteredAndSortedRows` + `containsAllTerms` in
 * qBittorrent's `src/webui/www/private/`), so a filter behaves the same here
 * as it does on the desktop/WebUI client. Deliberate differences are called
 * out where they occur.
 */
import { SearchResult } from '@/types/api';
import { getVideoQualityLabel, getVideoQualityRank } from '@/utils/video-quality';

/** Size units offered by the filter UI, smallest to largest (IEC, 1024-based). */
export const SEARCH_SIZE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const;
export type SearchSizeUnit = (typeof SEARCH_SIZE_UNITS)[number];

/**
 * Default units for the min/max size inputs. Same as the WebUI (min in MiB,
 * max in GiB) — typical bounds are "at least a few hundred MiB, at most a
 * couple of GiB".
 */
export const DEFAULT_MIN_SIZE_UNIT: SearchSizeUnit = 'MiB';
export const DEFAULT_MAX_SIZE_UNIT: SearchSizeUnit = 'GiB';

/**
 * Video qualities the filter offers (#268). A result matches one when its name
 * parses to that quality (`getVideoQualityRank`); results with no recognizable
 * quality — and ones that parse to a quality not offered, such as 1440p or SD —
 * are hidden while any quality is selected.
 */
export const SEARCH_QUALITY_OPTIONS = ['720p', '1080p', '2160p'] as const;
export type SearchQualityOption = (typeof SEARCH_QUALITY_OPTIONS)[number];

export interface SearchFilterOptions {
  /**
   * Hide results that report exactly 0 seeders. Only an explicit 0 is hidden:
   * qBittorrent uses -1 for "unknown", and a plugin may omit the field
   * entirely (null/undefined at runtime despite the type), so none of those
   * are treated as dead.
   */
  hideZeroSeeders?: boolean;
  /**
   * "Search in: names only" — the result name must contain every term of this
   * text. Pass the *submitted* search pattern (not the live input box) while
   * that mode is active, and leave it undefined for "everywhere".
   */
  nameTerms?: string;
  /** Free-text filter — the result name must contain every term. */
  filterText?: string;
  /** Inclusive seeders bounds. Unset / non-positive means "no bound". */
  minSeeders?: number;
  maxSeeders?: number;
  /** Inclusive size bounds in bytes. Unset / non-positive means "no bound". */
  minSize?: number;
  maxSize?: number;
  /** Keep only results of these qualities. Empty / unset means "any". */
  qualities?: readonly SearchQualityOption[];
}

/**
 * Splits `text` into lowercase terms on whitespace (any run of it), dropping
 * empty pieces and lone "+" / "-" tokens (which the WebUI also ignores).
 *
 * A leading "+" (required) or "-" (excluded) is kept on the term — see
 * {@link matchesAllTerms}. Quote characters get no special treatment: the
 * WebUI has no quoted-phrase support, so neither do we.
 */
export function tokenizeTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '' && term !== '+' && term !== '-');
}

/**
 * Whether `name` satisfies every term (as produced by {@link tokenizeTerms}).
 * Case-insensitive substring match, same rules as the WebUI's
 * `containsAllTerms`: a plain or "+"-prefixed term must be present, a
 * "-"-prefixed term must be absent. No accent folding ("cafe" does not match
 * "Café"), again matching the WebUI.
 */
export function matchesAllTerms(name: string | null | undefined, terms: string[]): boolean {
  const haystack = (name ?? '').toLowerCase();
  return terms.every((term) => {
    if (term.startsWith('-')) return !haystack.includes(term.slice(1));
    if (term.startsWith('+')) return haystack.includes(term.slice(1));
    return haystack.includes(term);
  });
}

/**
 * Turns the text of a size input plus its unit into bytes. Returns undefined
 * for anything that is not a positive number (blank, "abc", "0", negative),
 * which every consumer reads as "no bound" — the WebUI uses 0 for "unset" the
 * same way. Accepts a decimal comma ("1,5") since the iOS decimal pad shows
 * one on many locales.
 */
export function parseSizeInput(
  value: string | null | undefined,
  unit: SearchSizeUnit,
): number | undefined {
  const amount = parsePositiveNumber(value);
  if (amount === undefined) return undefined;
  const bytes = Math.round(amount * Math.pow(1024, SEARCH_SIZE_UNITS.indexOf(unit)));
  return bytes > 0 ? bytes : undefined;
}

/**
 * Turns the text of a seeders input into a whole number. Returns undefined for
 * anything that is not a positive number, i.e. "no bound".
 */
export function parseSeedersInput(value: string | null | undefined): number | undefined {
  const amount = parsePositiveNumber(value);
  if (amount === undefined) return undefined;
  const whole = Math.floor(amount);
  return whole > 0 ? whole : undefined;
}

function parsePositiveNumber(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

/**
 * Drops unset bounds and orders the rest, so a swapped pair (min 10, max 2)
 * means the range 2..10 rather than an empty set — same as the WebUI.
 */
function normalizeRange(
  min: number | undefined,
  max: number | undefined,
): { min?: number; max?: number } {
  const lo = typeof min === 'number' && Number.isFinite(min) && min > 0 ? min : undefined;
  const hi = typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : undefined;
  if (lo !== undefined && hi !== undefined && lo > hi) return { min: hi, max: lo };
  return { min: lo, max: hi };
}

/**
 * Whether any of the filter-panel filters (name terms, text filter, seeders
 * range, size range) would actually restrict results. `hideZeroSeeders` is
 * deliberately not counted: it is a separate persisted toggle in the sort
 * menu with its own empty state.
 */
export function hasActiveFilters(opts: SearchFilterOptions = {}): boolean {
  const seeders = normalizeRange(opts.minSeeders, opts.maxSeeders);
  const size = normalizeRange(opts.minSize, opts.maxSize);
  return (
    tokenizeTerms(opts.nameTerms).length > 0 ||
    tokenizeTerms(opts.filterText).length > 0 ||
    seeders.min !== undefined ||
    seeders.max !== undefined ||
    size.min !== undefined ||
    size.max !== undefined ||
    (opts.qualities?.length ?? 0) > 0
  );
}

/**
 * Applies the enabled filters in `opts` and returns the surviving results.
 * Never mutates `results`; returns the same array when no filter is active,
 * so callers can rely on cheap identity checks.
 *
 * Unknown values are never excluded by a range. qBittorrent reports -1 for
 * unknown seeders and plugins that don't know a size report -1 (or 0), so
 * those results stay visible under any seeders/size bound. This deviates from
 * the WebUI, whose "min" bounds drop them (it compares -1 < min) — on a phone,
 * a plugin that never reports seeders would otherwise have its entire result
 * list wiped by a single "min seeders" entry with no hint as to why.
 */
export function filterSearchResults(
  results: SearchResult[],
  opts: SearchFilterOptions = {},
): SearchResult[] {
  const nameTerms = tokenizeTerms(opts.nameTerms);
  const filterTerms = tokenizeTerms(opts.filterText);
  const seeders = normalizeRange(opts.minSeeders, opts.maxSeeders);
  const size = normalizeRange(opts.minSize, opts.maxSize);
  const qualities = opts.qualities ?? [];

  if (
    !opts.hideZeroSeeders &&
    qualities.length === 0 &&
    nameTerms.length === 0 &&
    filterTerms.length === 0 &&
    seeders.min === undefined &&
    seeders.max === undefined &&
    size.min === undefined &&
    size.max === undefined
  ) {
    return results;
  }

  return results.filter((r) => {
    if (opts.hideZeroSeeders && r.nbSeeders === 0) return false;
    if (nameTerms.length > 0 && !matchesAllTerms(r.fileName, nameTerms)) return false;
    if (filterTerms.length > 0 && !matchesAllTerms(r.fileName, filterTerms)) return false;
    if (qualities.length > 0) {
      const label = getVideoQualityLabel(getVideoQualityRank(r.fileName));
      if (!label || !(qualities as readonly string[]).includes(label)) return false;
    }

    const seedCount = r.nbSeeders;
    if (typeof seedCount === 'number' && seedCount >= 0) {
      if (seeders.min !== undefined && seedCount < seeders.min) return false;
      if (seeders.max !== undefined && seedCount > seeders.max) return false;
    }

    const bytes = r.fileSize;
    if (typeof bytes === 'number' && bytes > 0) {
      if (size.min !== undefined && bytes < size.min) return false;
      if (size.max !== undefined && bytes > size.max) return false;
    }
    return true;
  });
}

/**
 * The session-only values behind the Search tab's filter panel, as the raw
 * text the inputs hold. Kept as strings so a half-typed "1." or "" survives
 * re-renders; {@link draftToFilterOptions} does the parsing.
 */
export interface SearchFilterDraft {
  filterText: string;
  minSeeders: string;
  maxSeeders: string;
  minSize: string;
  minSizeUnit: SearchSizeUnit;
  maxSize: string;
  maxSizeUnit: SearchSizeUnit;
  qualities: SearchQualityOption[];
}

export const EMPTY_SEARCH_FILTER_DRAFT: SearchFilterDraft = {
  filterText: '',
  minSeeders: '',
  maxSeeders: '',
  minSize: '',
  minSizeUnit: DEFAULT_MIN_SIZE_UNIT,
  maxSize: '',
  maxSizeUnit: DEFAULT_MAX_SIZE_UNIT,
  qualities: [],
};

/** Parses a draft into filter options (everything but `nameTerms`/`hideZeroSeeders`). */
export function draftToFilterOptions(draft: SearchFilterDraft): SearchFilterOptions {
  return {
    filterText: draft.filterText,
    minSeeders: parseSeedersInput(draft.minSeeders),
    maxSeeders: parseSeedersInput(draft.maxSeeders),
    minSize: parseSizeInput(draft.minSize, draft.minSizeUnit),
    maxSize: parseSizeInput(draft.maxSize, draft.maxSizeUnit),
    qualities: draft.qualities,
  };
}

/** Whether the draft holds anything the user typed — i.e. "Clear filters" has work to do. */
export function isDraftDirty(draft: SearchFilterDraft): boolean {
  return (
    draft.filterText !== '' ||
    draft.minSeeders !== '' ||
    draft.maxSeeders !== '' ||
    draft.minSize !== '' ||
    draft.maxSize !== '' ||
    draft.qualities.length > 0
  );
}
