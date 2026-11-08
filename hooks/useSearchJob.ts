/**
 * useSearchJob.ts — Lifecycle hook for a single qBittorrent search job.
 *
 * Responsibilities:
 *  - Start a search and remember its job id.
 *  - Poll both status and (paginated) results while the job is running.
 *  - Auto-delete the previous job on a new start to avoid the server's
 *    concurrent-search limit.
 *  - Cleanup the server-side job on unmount.
 *
 * Returns a stable object that callers can pass into UI components without
 * worrying about polling, retries, or cleanup timing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { searchApi } from '@/services/api/search';
import {
  SearchJobStatus,
  SearchResult,
  SearchResultsResponse,
  SearchStatusValue,
} from '@/types/api';
import { getErrorMessage } from '@/utils/error';
import { useServer } from '@/context/ServerContext';
import { useReactiveReconnect } from '@/hooks/useReactiveReconnect';
import {
  broaderSearchPattern,
  matchesTitleApproximately,
  withoutQualityPattern,
} from '@/utils/search-relevance';

// Large bounded cap: the old 200 silently truncated aggregator searches
// (Prowlarr fanning out across many indexers), hiding whole indexers whose
// results landed past position 200 in the server's ordering. 0 would mean
// "no limit" per qBittorrent's API docs, but since this hook re-fetches the
// full window at offset 0 on every 2s poll tick, an unbounded payload grows
// monotonically for the whole search — 1000 keeps every realistic search
// intact while bounding per-tick transfer/parse cost and the FlatList size.
const RESULTS_LIMIT = 1000;
const POLL_INTERVAL_MS = 2000;

export interface UseSearchJobResult {
  jobId: number | null;
  status: SearchStatusValue | null;
  results: SearchResult[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  start: (pattern: string, plugins: string, category: string) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
}

async function fetchStatusAndResults(jobId: number): Promise<{
  status: SearchStatusValue;
  total: number;
  results: SearchResult[];
}> {
  const [statusList, resultsResponse]: [SearchJobStatus[], SearchResultsResponse] =
    await Promise.all([searchApi.getStatus(jobId), searchApi.getResults(jobId, RESULTS_LIMIT, 0)]);

  const jobStatus = statusList.find((entry) => entry.id === jobId);
  // Trust /results over /status when /status reports stale data (race-prone
  // immediately after a job finishes).
  const status: SearchStatusValue = resultsResponse.status ?? jobStatus?.status ?? 'Stopped';
  const total = resultsResponse.total ?? jobStatus?.total ?? 0;

  return {
    status,
    total,
    results: resultsResponse.results ?? [],
  };
}

export function useSearchJob(): UseSearchJobResult {
  const queryClient = useQueryClient();
  const { isConnected } = useServer();
  const [jobId, setJobId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  // Track active job in a ref so unmount cleanup always sees the latest value.
  const activeJobRef = useRef<number | null>(null);
  const originalSearchRef = useRef<{ pattern: string; plugins: string; category: string } | null>(null);
  const fallbackStageRef = useRef(0);
  const retryInFlightRef = useRef(false);
  const searchGenerationRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const completedResultsRef = useRef<SearchResult[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const queryKey = jobId !== null ? ['search', 'job', jobId] : ['search', 'job', 'idle'];

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery<{ status: SearchStatusValue; total: number; results: SearchResult[] }>({
    queryKey,
    queryFn: () => fetchStatusAndResults(jobId as number),
    enabled: isConnected && jobId !== null,
    // Stop polling once the server reports the job is Stopped.
    refetchInterval: (query) => {
      if (!isAppActive) return false;
      const latest = query.state.data;
      if (!latest) return POLL_INTERVAL_MS;
      return latest.status === 'Running' ? POLL_INTERVAL_MS : false;
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const stopInternal = useCallback(async (id: number) => {
    try {
      await searchApi.stop(id);
    } catch {
      // 404 is fine — job already stopped or removed.
    }
  }, []);

  const deleteInternal = useCallback(async (id: number) => {
    try {
      await searchApi.deleteSearch(id);
    } catch {
      // Tolerate 404 — server already cleaned up.
    }
  }, []);

  const reset = useCallback(async () => {
    const currentId = activeJobRef.current;
    searchGenerationRef.current += 1;
    activeJobRef.current = null;
    originalSearchRef.current = null;
    stopRequestedRef.current = true;
    retryInFlightRef.current = false;
    completedResultsRef.current = [];
    setJobId(null);
    setMutationError(null);
    if (currentId !== null && isConnected) {
      await deleteInternal(currentId);
    }
    queryClient.removeQueries({ queryKey: ['search', 'job'] });
  }, [deleteInternal, isConnected, queryClient]);

  const start = useCallback(
    async (pattern: string, plugins: string, category: string) => {
      if (!isConnected) {
        setMutationError('Not connected to a server.');
        return;
      }
      setIsStarting(true);
      setMutationError(null);
      searchGenerationRef.current += 1;
      originalSearchRef.current = null;
      fallbackStageRef.current = 0;
      stopRequestedRef.current = false;
      retryInFlightRef.current = false;
      completedResultsRef.current = [];

      // Clean up any in-flight job before starting a new one.
      const previousId = activeJobRef.current;
      if (previousId !== null) {
        await stopInternal(previousId);
        await deleteInternal(previousId);
      }

      let job;
      try {
        job = await searchApi.start(pattern, plugins, category);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        // 409 from qBT means the server's concurrent-search cap is hit. Try
        // once more after clearing any orphan jobs we know about.
        if (/409|conflict/i.test(message)) {
          try {
            job = await searchApi.start(pattern, plugins, category);
          } catch (retryErr: unknown) {
            setMutationError(getErrorMessage(retryErr));
            setIsStarting(false);
            return;
          }
        } else {
          setMutationError(message);
          setIsStarting(false);
          return;
        }
      }

      activeJobRef.current = job.id;
      originalSearchRef.current = { pattern, plugins, category };
      setJobId(job.id);
      setIsStarting(false);
      // Prime the cache so the first poll happens immediately.
      await queryClient.invalidateQueries({ queryKey: ['search', 'job', job.id] });
    },
    [deleteInternal, isConnected, queryClient, stopInternal],
  );

  // Plugins search the supplied text literally. Search again without quality
  // terms to include other versions; if no title matches, try a short prefix
  // to discover spelling variants. Keep earlier results across both retries.
  useEffect(() => {
    const original = originalSearchRef.current;
    if (!original || jobId === null || activeJobRef.current !== jobId ||
        stopRequestedRef.current || retryInFlightRef.current || !data || data.status !== 'Stopped') return;
    const stage = fallbackStageRef.current;
    if (stage >= 2) return;
    const relaxed = withoutQualityPattern(original.pattern);
    const hasCloseTitle = [...completedResultsRef.current, ...data.results].some((result) =>
      matchesTitleApproximately(result.fileName ?? '', original.pattern),
    );
    const nextPattern = stage === 0 && relaxed
      ? relaxed
      : !hasCloseTitle ? broaderSearchPattern(original.pattern) : null;
    if (!nextPattern) return;
    fallbackStageRef.current = stage === 0 && relaxed ? 1 : 2;
    retryInFlightRef.current = true;
    const generation = searchGenerationRef.current;
    setIsStarting(true);
    void (async () => {
      try {
        const fallback = await searchApi.start(nextPattern, original.plugins, original.category);
        if (activeJobRef.current !== jobId || searchGenerationRef.current !== generation || stopRequestedRef.current) {
          await deleteInternal(fallback.id);
          return;
        }
        completedResultsRef.current = [...completedResultsRef.current, ...data.results];
        activeJobRef.current = fallback.id;
        setJobId(fallback.id);
        await deleteInternal(jobId);
        await queryClient.invalidateQueries({ queryKey: ['search', 'job', fallback.id] });
      } catch (err: unknown) {
        setMutationError(getErrorMessage(err));
      } finally {
        retryInFlightRef.current = false;
        setIsStarting(false);
      }
    })();
  }, [data, deleteInternal, jobId, queryClient]);

  const stop = useCallback(async () => {
    const currentId = activeJobRef.current;
    if (currentId === null) return;
    stopRequestedRef.current = true;
    try {
      await stopInternal(currentId);
      await queryClient.invalidateQueries({ queryKey: ['search', 'job', currentId] });
    } catch (err: unknown) {
      setMutationError(getErrorMessage(err));
    }
  }, [queryClient, stopInternal]);

  // Cleanup on unmount: delete any server-side job we own.
  useEffect(() => {
    return () => {
      const currentId = activeJobRef.current;
      if (currentId !== null) {
        // Fire-and-forget; ignore errors during teardown.
        searchApi.deleteSearch(currentId).catch(() => {});
      }
    };
  }, []);

  // Force-stop and clear local state if the user disconnects mid-search.
  useEffect(() => {
    if (!isConnected && activeJobRef.current !== null) {
      activeJobRef.current = null;
      setJobId(null);
    }
  }, [isConnected]);

  // Refresh on returning from background while a job is active. Deliberately
  // NOT eagerly reconnecting here — checkAndReconnect always performs a
  // fresh login (server-manager.ts has no lightweight "is my session still
  // valid" path), so calling it on every foreground return re-authenticates
  // even when the old session was still fine. qBittorrent's search jobs are
  // tied to session state, so that unnecessary re-login was silently
  // orphaning the active search. If the session actually died while
  // backgrounded, the refetch below fails naturally and the reactive effect
  // below picks it up and reconnects — but only when it's actually needed.
  useEffect(() => {
    const handle = (next: AppStateStatus) => {
      appStateRef.current = next;
      setIsAppActive(next === 'active');
      if (next === 'active' && activeJobRef.current !== null) {
        InteractionManager.runAfterInteractions(() => {
          queryClient.invalidateQueries({
            queryKey: ['search', 'job', activeJobRef.current],
          });
        });
      }
    };
    const sub = AppState.addEventListener('change', handle);
    return () => sub.remove();
  }, [queryClient]);

  // Auto-reconnect when polling actually fails due to auth/connection loss
  // (e.g. a session that died while backgrounded). Shared policy with
  // TorrentContext — trigger conditions and cooldown live in the hook.
  useReactiveReconnect(queryError);

  const error = mutationError ?? (queryError ? getErrorMessage(queryError) : null);

  return {
    jobId,
    status: data?.status ?? null,
    results: [...completedResultsRef.current, ...(data?.results ?? [])],
    total: completedResultsRef.current.length > 0
      ? completedResultsRef.current.length + (data?.results.length ?? 0)
      : (data?.total ?? 0),
    isLoading: isStarting || isLoading,
    isFetching,
    error,
    start,
    stop,
    reset,
  };
}
