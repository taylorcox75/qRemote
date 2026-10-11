/**
 * search-history.ts — Pure helpers for the Torrents tab's "recent searches"
 * list (#282): recording, pinning, removing and ordering queries.
 *
 * Two lists are persisted (`torrentSearchHistory` and `torrentSearchPinned`):
 * `history` holds the recent, unpinned queries (newest first) and is capped by
 * the user's limit; `pinned` holds entries the user wants to keep and does NOT
 * count toward that limit. A query lives in exactly one of the two lists.
 * Matching is case-insensitive; the most recently used casing wins.
 *
 * Key exports: recordQuery, togglePin, removeQuery, clearUnpinned,
 * applyHistoryLimit, getHistoryEntries, MAX_PINNED_SEARCHES
 */

/** Queries shorter than this (after trimming) are never recorded. */
export const MIN_RECORDED_QUERY_LENGTH = 2;

/** Hard cap on pinned entries. */
export const MAX_PINNED_SEARCHES = 10;

/** Values offered in Settings → Appearance. 0 turns the history off. */
export const SEARCH_HISTORY_LIMIT_OPTIONS = [0, 3, 5, 10, 15] as const;

export interface SearchHistoryState {
  history: string[];
  pinned: string[];
}

export interface SearchHistoryEntry {
  query: string;
  pinned: boolean;
}

function keyOf(query: string): string {
  return query.trim().toLowerCase();
}

function normalizeLimit(limit: number): number {
  if (Number.isNaN(limit)) return 0;
  return Math.max(0, Math.floor(limit));
}

function indexOfQuery(list: string[], query: string): number {
  const key = keyOf(query);
  return list.findIndex((entry) => keyOf(entry) === key);
}

function without(list: string[], query: string): string[] {
  const key = keyOf(query);
  return list.filter((entry) => keyOf(entry) !== key);
}

/** Keeps only the newest `limit` entries (0 or less empties the list). */
export function applyHistoryLimit(history: string[], limit: number): string[] {
  const max = normalizeLimit(limit);
  return max === 0 ? [] : history.slice(0, max);
}

/**
 * Returns the new recent-searches list after the user searched for `query`.
 *
 * - Trims the query and ignores anything under `MIN_RECORDED_QUERY_LENGTH`.
 * - De-dupes case-insensitively, moving the entry to the front with its latest
 *   casing.
 * - A query that is already pinned stays pinned and is not duplicated here.
 * - Trims to `limit`; a limit of 0 (history off) always yields `[]`.
 */
export function recordQuery(
  history: string[],
  pinned: string[],
  query: string,
  limit: number,
): string[] {
  const max = normalizeLimit(limit);
  if (max === 0) return [];

  const trimmed = query.trim();
  if (trimmed.length < MIN_RECORDED_QUERY_LENGTH) return applyHistoryLimit(history, max);

  const rest = without(history, trimmed);
  if (indexOfQuery(pinned, trimmed) !== -1) return applyHistoryLimit(rest, max);
  return applyHistoryLimit([trimmed, ...rest], max);
}

/**
 * Moves `query` between the recent and pinned lists.
 *
 * - A recent entry becomes pinned (appended, so pins keep a stable order).
 *   Unchanged when `MAX_PINNED_SEARCHES` are already pinned.
 * - A pinned entry returns to the front of the recent list, trimmed to `limit`
 *   (default: no trimming).
 * - A query in neither list is left alone.
 */
export function togglePin(
  history: string[],
  pinned: string[],
  query: string,
  limit: number = Number.POSITIVE_INFINITY,
): SearchHistoryState {
  const pinnedIndex = indexOfQuery(pinned, query);
  if (pinnedIndex !== -1) {
    const entry = pinned[pinnedIndex];
    return {
      history: applyHistoryLimit([entry, ...without(history, entry)], limit),
      pinned: without(pinned, entry),
    };
  }

  const historyIndex = indexOfQuery(history, query);
  if (historyIndex === -1 || pinned.length >= MAX_PINNED_SEARCHES) return { history, pinned };

  const entry = history[historyIndex];
  return { history: without(history, entry), pinned: [...pinned, entry] };
}

/** Removes `query` from both lists. */
export function removeQuery(
  history: string[],
  pinned: string[],
  query: string,
): SearchHistoryState {
  return { history: without(history, query), pinned: without(pinned, query) };
}

/** "Clear recent": empties the recent list and keeps every pinned entry. */
export function clearUnpinned(pinned: string[]): SearchHistoryState {
  return { history: [], pinned };
}

/** Display order for the dropdown: pinned first, then recent (never twice). */
export function getHistoryEntries(history: string[], pinned: string[]): SearchHistoryEntry[] {
  const entries: SearchHistoryEntry[] = pinned.map((query) => ({ query, pinned: true }));
  for (const query of history) {
    if (indexOfQuery(pinned, query) === -1) entries.push({ query, pinned: false });
  }
  return entries;
}
