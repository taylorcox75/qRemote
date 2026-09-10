/**
 * useArtwork.ts - Resolve TMDB artwork for one raw release name.
 *
 * Thin TanStack Query wrapper around services/artwork-store.ts's
 * lookupArtwork(), gated on the ArtworkContext feature flag (`active`).
 * Cached indefinitely per rawName (staleTime: Infinity - a poster/backdrop
 * for a given release name never changes within a session) but garbage
 * collected after an hour of no observers, so a purged cache doesn't
 * accumulate forever for very long torrent lists.
 */
import { useQuery } from '@tanstack/react-query';
import { useArtworkSettings } from '@/context/ArtworkContext';
import { lookupArtwork, peekArtwork } from '@/services/artwork-store';
import type { Artwork } from '@/services/tmdb';

const GC_TIME_MS = 60 * 60 * 1000; // 1 hour

export interface UseArtworkResult {
  /** undefined when the feature is inactive, no name was given, or the last
   * lookup failed transiently and will be retried on the next mount/focus;
   * null = looked up, genuinely no match. */
  artwork: Artwork | null | undefined;
  loading: boolean;
}

async function fetchArtwork(rawName: string): Promise<Artwork | null> {
  const result = await lookupArtwork(rawName);
  // services/artwork-store.ts deliberately resolves null WITHOUT persisting
  // a cache entry on a transient failure (network error, bad key, a second
  // 429) so a dropped connection never becomes a permanent "no artwork"
  // verdict - only a genuine no-match gets written to its cache. peekArtwork
  // is a synchronous read of that same cache, so if it still doesn't know
  // this rawName right after lookupArtwork resolved null, the null was
  // transient. Surface that as a query error instead of a resolved "no
  // artwork" result, or staleTime: Infinity below would cache the transient
  // failure for the rest of the session.
  if (result === null && peekArtwork(rawName) === undefined) {
    throw new Error(`Transient artwork lookup failure for "${rawName}"`);
  }
  return result;
}

export function useArtwork(rawName: string | undefined): UseArtworkResult {
  const { active } = useArtworkSettings();
  const enabled = active && !!rawName;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['artwork', rawName],
    queryFn: () => fetchArtwork(rawName as string),
    enabled,
    staleTime: Infinity,
    gcTime: GC_TIME_MS,
    // A rate-limited/offline lookup should be retried on the next mount or
    // focus (an errored query does that on its own), not hammered here - the
    // app-wide default (services/query-client.ts) is retry: 2 with backoff.
    retry: false,
  });

  return {
    artwork: enabled && !isError ? data : undefined,
    loading: enabled && isLoading,
  };
}
