/**
 * tmdb.ts - TMDB (The Movie Database) artwork lookups.
 *
 * Uses a DEDICATED axios instance, entirely separate from services/api/client.ts
 * (that singleton carries qBittorrent cookies and a per-server base URL). Only
 * the parsed release title (and year) are ever sent to TMDB, never the raw
 * torrent/release name - see utils/release-name.ts. Opt-in: requires a
 * user-supplied TMDB v3 API key, stored in expo-secure-store (never
 * AsyncStorage, since it is a secret).
 *
 * Key exports: searchArtwork, pickBest, lookupArtwork's building blocks
 * (get/set/has key), posterUrl/backdropUrl.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export type TmdbMediaType = 'movie' | 'tv';

export interface Artwork {
  tmdbId: number;
  mediaType: TmdbMediaType;
  title: string;
  year?: number;
  posterPath: string | null;
  backdropPath: string | null;
  popularity: number;
}

export type PosterSize = 'w154' | 'w342' | 'w500';

/** expo-secure-store key holding the user's TMDB v3 API key. */
export const TMDB_KEY_STORAGE = 'tmdb_api_key';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/';
const DEFAULT_RETRY_AFTER_MS = 2000;

/**
 * Dedicated axios instance for TMDB traffic only. Never share this with, or
 * import anything from, services/api/client.ts.
 */
const tmdbClient = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  timeout: 15000,
});

/** Thrown only on HTTP 429; every other failure resolves the call to null. */
export class TmdbRateLimitError extends Error {
  retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super('TMDB rate limit exceeded');
    this.name = 'TmdbRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown on a transient/unexpected failure (network error, timeout, a
 * non-429 error status, a malformed response) so callers can tell "the
 * lookup itself failed" apart from "the lookup succeeded and found nothing".
 * Never thrown for a missing key or a blank title - those resolve to null,
 * since there was nothing to look up.
 */
export class TmdbLookupError extends Error {
  constructor(cause: unknown) {
    super('TMDB lookup failed');
    this.name = 'TmdbLookupError';
    this.cause = cause;
  }
}

export async function getTmdbApiKey(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(TMDB_KEY_STORAGE);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/** Empty string (after trim) deletes the stored key rather than storing ''. */
export async function setTmdbApiKey(key: string): Promise<void> {
  const trimmed = (key ?? '').trim();
  if (!trimmed) {
    await SecureStore.deleteItemAsync(TMDB_KEY_STORAGE);
    return;
  }
  await SecureStore.setItemAsync(TMDB_KEY_STORAGE, trimmed);
}

export async function hasTmdbApiKey(): Promise<boolean> {
  const key = await getTmdbApiKey();
  return key !== null;
}

/** Shape of one /search/multi result item, as TMDB returns it. */
interface RawSearchResult {
  id?: number;
  media_type?: string;
  title?: string; // movies
  name?: string; // tv
  release_date?: string; // movies
  first_air_date?: string; // tv
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
}

function yearOf(item: RawSearchResult): number | undefined {
  const date = item.release_date || item.first_air_date;
  if (!date) return undefined;
  const year = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : undefined;
}

/**
 * Choose the best /search/multi candidate: drop "person" results and anything
 * without a poster, then prefer an exact year match, falling back to the
 * highest popularity.
 */
export function pickBest(results: unknown[], preferredYear?: number): Artwork | null {
  if (!Array.isArray(results)) return null;

  const candidates = results.filter((raw): raw is RawSearchResult => {
    if (!raw || typeof raw !== 'object') return false;
    const item = raw as RawSearchResult;
    return (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path != null;
  });
  if (candidates.length === 0) return null;

  let chosen: RawSearchResult | undefined;
  if (preferredYear !== undefined) {
    chosen = candidates.find((c) => yearOf(c) === preferredYear);
  }
  if (!chosen) {
    chosen = candidates.reduce((best, c) =>
      (c.popularity ?? 0) > (best.popularity ?? 0) ? c : best,
    );
  }

  return {
    tmdbId: chosen.id ?? 0,
    mediaType: chosen.media_type as TmdbMediaType,
    title: chosen.title || chosen.name || '',
    year: yearOf(chosen),
    posterPath: chosen.poster_path ?? null,
    backdropPath: chosen.backdrop_path ?? null,
    popularity: chosen.popularity ?? 0,
  };
}

function parseRetryAfterMs(headers: Record<string, string> | undefined): number {
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
  const seconds = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : DEFAULT_RETRY_AFTER_MS;
}

/**
 * Look up artwork by parsed title (and optional year). Uses `apiKey` when
 * given, else the stored key. Returns null on no key, empty title, or a
 * genuine no-match (a completed search that found nothing to show). Throws
 * TmdbRateLimitError on HTTP 429, and TmdbLookupError on any other failure
 * (bad status, network error, timeout, malformed response) - a caller must
 * not treat a thrown error as "no match".
 */
export async function searchArtwork(
  title: string,
  year?: number,
  apiKey?: string,
): Promise<Artwork | null> {
  const rawKey = apiKey !== undefined ? apiKey : await getTmdbApiKey();
  const key = rawKey?.trim();
  const query = title?.trim();
  if (!key || !query) return null;

  try {
    const response = await tmdbClient.get('/search/multi', {
      params: {
        api_key: key,
        query,
        include_adult: false,
      },
    });
    const results = response?.data?.results;
    return pickBest(Array.isArray(results) ? results : [], year);
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 429) {
      const headers = (error as { response?: { headers?: Record<string, string> } })?.response
        ?.headers;
      throw new TmdbRateLimitError(parseRetryAfterMs(headers));
    }
    throw new TmdbLookupError(error);
  }
}

export function posterUrl(path: string | null, size: PosterSize): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}${size}${path}`;
}

export function backdropUrl(path: string | null): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}w780${path}`;
}
