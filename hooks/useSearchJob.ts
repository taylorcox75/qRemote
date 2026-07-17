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
import { AppState, AppStateStatus } from 'react-native';
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
    await Promise.all([
      searchApi.getStatus(jobId),
      searchApi.getResults(jobId, RESULTS_LIMIT, 0),
    ]);

  const jobStatus = statusList.find((entry) => entry.id === jobId);
  // Trust /results over /status when /status reports stale data (race-prone
  // immediately after a job finishes).
  const status: SearchStatusValue =
    resultsResponse.status ?? jobStatus?.status ?? 'Stopped';
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
  // Track active job in a ref so unmount cleanup always sees the latest value.
  const activeJobRef = useRef<number | null>(null);

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
      const latest = query.state.data;
      if (!latest) return POLL_INTERVAL_MS;
      return latest.status === 'Running' ? POLL_INTERVAL_MS : false;
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const stopInternal = useCallback(
    async (id: number) => {
      try {
        await searchApi.stop(id);
      } catch {
        // 404 is fine — job already stopped or removed.
      }
    },
    [],
  );

  const deleteInternal = useCallback(
    async (id: number) => {
      try {
        await searchApi.deleteSearch(id);
      } catch {
        // Tolerate 404 — server already cleaned up.
      }
    },
    [],
  );

  const reset = useCallback(async () => {
    const currentId = activeJobRef.current;
    activeJobRef.current = null;
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
      setJobId(job.id);
      setIsStarting(false);
      // Prime the cache so the first poll happens immediately.
      await queryClient.invalidateQueries({ queryKey: ['search', 'job', job.id] });
    },
    [deleteInternal, isConnected, queryClient, stopInternal],
  );

  const stop = useCallback(async () => {
    const currentId = activeJobRef.current;
    if (currentId === null) return;
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
      if (next === 'active' && activeJobRef.current !== null) {
        queryClient.invalidateQueries({
          queryKey: ['search', 'job', activeJobRef.current],
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

  const error = mutationError
    ?? (queryError ? getErrorMessage(queryError) : null);

  return {
    jobId,
    status: data?.status ?? null,
    results: data?.results ?? [],
    total: data?.total ?? 0,
    isLoading: isStarting || isLoading,
    isFetching,
    error,
    start,
    stop,
    reset,
  };
}
