/**
 * useSearchHashResolver.ts — confirm which Search results are the same torrent
 * by asking the server for their info hash (#267).
 *
 * qBittorrent's search results carry no hash. Magnet results give theirs away
 * for free; a plain `.torrent` URL only does once the server has downloaded it,
 * which `torrents/fetchMetadata` (qBit 5.2+ / WebAPI ≥ 2.11.9) does without
 * adding anything. This hook resolves ONLY the `.torrent` results that already
 * look like duplicates (`findResolutionCandidates`) — never every result,
 * because each resolution makes the server fetch the file from the indexer and
 * private trackers rate-limit bursts. Policy:
 *   - at most MAX_CONCURRENT sources in progress at once, and at most
 *     MAX_RESOLUTIONS started per search job, most-seeded candidates first;
 *   - fetchMetadata answers 202 until the download lands, so each source is
 *     re-polled every POLL_DELAY_MS, up to MAX_TRIES calls in all, then dropped;
 *   - any error leaves the result unresolved, silently — it just stays grouped
 *     (or not) by the name+size guess;
 *   - nothing already resolved, failed or given up on is requested again;
 *   - a new search job starts from scratch, and unmounting (or switching jobs)
 *     aborts what is in flight and ignores whatever still arrives.
 *
 * Returns `fileUrl → ResolvedSource`, fed to `groupSearchResults`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { torrentsApi } from '@/services/api/torrents';
import { SearchResult } from '@/types/api';
import { ApiFeatures } from '@/utils/apiVersion';
import { getResultDownloader } from '@/utils/search-download';
import { findResolutionCandidates, ResolvedSource } from '@/utils/search-grouping';
import { siteHost } from '@/utils/searchResult';

export const MAX_CONCURRENT = 3;
export const MAX_RESOLUTIONS_PER_JOB = 30;
export const POLL_DELAY_MS = 2000;
export const MAX_TRIES = 5;

const EMPTY_RESOLVED: ReadonlyMap<string, ResolvedSource> = new Map();

interface Candidate {
  fileUrl: string;
  /** Search plugin that should fetch the URL, when it is safe to ask for that. */
  downloader?: string;
}

/** The work for one search job; replaced wholesale when the job changes. */
class ResolverRun {
  private readonly controller = new AbortController();
  private readonly attempted = new Set<string>();
  private readonly sleepers = new Set<{ timer: ReturnType<typeof setTimeout>; wake: () => void }>();
  private candidates: Candidate[] = [];
  private active = false;
  private started = 0;
  private inFlight = 0;
  private cancelled = false;

  constructor(private readonly onResolved: (fileUrl: string, entry: ResolvedSource) => void) {}

  /** Hand over the current candidate list (best first) and start whatever the limits allow. */
  update(candidates: Candidate[], active: boolean): void {
    this.candidates = candidates;
    this.active = active;
    this.pump();
  }

  /** Abort in-flight requests and make every pending wait return immediately. */
  cancel(): void {
    this.cancelled = true;
    this.controller.abort();
    for (const sleeper of this.sleepers) {
      clearTimeout(sleeper.timer);
      sleeper.wake();
    }
    this.sleepers.clear();
  }

  private pump(): void {
    while (
      !this.cancelled &&
      this.active &&
      this.inFlight < MAX_CONCURRENT &&
      this.started < MAX_RESOLUTIONS_PER_JOB
    ) {
      const next = this.candidates.find((candidate) => !this.attempted.has(candidate.fileUrl));
      if (!next) return;
      this.attempted.add(next.fileUrl);
      this.started += 1;
      this.inFlight += 1;
      void this.resolve(next).finally(() => {
        this.inFlight -= 1;
        this.pump();
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const sleeper = {
        timer: setTimeout(() => {
          this.sleepers.delete(sleeper);
          resolve();
        }, ms),
        wake: resolve,
      };
      this.sleepers.add(sleeper);
    });
  }

  private async resolve(candidate: Candidate): Promise<void> {
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      if (this.cancelled) return;
      let response;
      try {
        response = await torrentsApi.fetchMetadata(
          candidate.fileUrl,
          candidate.downloader,
          this.controller.signal,
        );
      } catch {
        // Not a torrent, a rate limit, a plugin that can't fetch it, a dead
        // session… Whatever it was, the result just stays unresolved.
        return;
      }
      if (this.cancelled) return;

      const torrentId = response.hash?.toLowerCase();
      // The v1 hash is what a magnet's btih carries, so it is the one that lets a
      // .torrent group with magnets; the torrent ID covers v2-only torrents.
      const hash = response.infohashV1?.toLowerCase() || torrentId;

      if (response.status === 'ready') {
        if (hash) {
          this.onResolved(candidate.fileUrl, { hash, torrentId, trackers: response.trackers });
        }
        return;
      }
      if (hash) {
        // 202 that already names the torrent (the URL redirected to a magnet):
        // enough to group by. Its trackers aren't known until metadata arrives,
        // which is not worth holding a slot for.
        this.onResolved(candidate.fileUrl, { hash, torrentId, trackers: [] });
        return;
      }
      // Still downloading; look again shortly.
      await this.sleep(POLL_DELAY_MS);
    }
  }
}

export interface UseSearchHashResolverOptions {
  /** The results on screen, before grouping — the only ones worth resolving. */
  results: SearchResult[];
  /** Current search job. A change (or null) discards everything resolved so far. */
  jobId: number | null;
  /** Off (grouping disabled) means no requests are made. */
  enabled: boolean;
  features: Pick<ApiFeatures, 'supportsFetchMetadata' | 'supportsFetchMetadataDownloader'>;
  /**
   * The screen's latched "every result shares one siteUrl" flag — a proxying
   * plugin (Prowlarr/Jackett). Those download links must not be routed through
   * the plugin (utils/search-download.ts `getResultDownloader` also rules them out
   * per result, which is what the add paths rely on). The hook also checks
   * `results` itself (see below), because the latch is set a render late and would
   * let the first requests slip past it.
   */
  isAggregatedSource: boolean;
}

export function useSearchHashResolver({
  results,
  jobId,
  enabled,
  features,
  isAggregatedSource,
}: UseSearchHashResolverOptions): ReadonlyMap<string, ResolvedSource> {
  const [store, setStore] = useState<{
    jobId: number | null;
    map: ReadonlyMap<string, ResolvedSource>;
  }>({ jobId: null, map: EMPTY_RESOLVED });
  const runRef = useRef<ResolverRun | null>(null);

  const active = enabled && features.supportsFetchMetadata && jobId !== null;
  const singleSite = useMemo(() => {
    const hosts = new Set<string>();
    for (const result of results) {
      const host = siteHost(result.siteUrl);
      if (host) hosts.add(host);
    }
    return hosts.size <= 1;
  }, [results]);
  const useDownloader =
    features.supportsFetchMetadataDownloader && !isAggregatedSource && !singleSite;

  const candidates = useMemo<Candidate[]>(() => {
    if (!active) return [];
    return findResolutionCandidates(results).map((result) => ({
      fileUrl: result.fileUrl,
      downloader: useDownloader ? getResultDownloader(result) : undefined,
    }));
  }, [active, results, useDownloader]);

  // One run per job. Declared before the scheduling effect so that, when the job
  // changes, the new run exists by the time candidates are handed to it.
  useEffect(() => {
    const run = new ResolverRun((fileUrl, entry) => {
      setStore((prev) => {
        const next = new Map(prev.jobId === jobId ? prev.map : EMPTY_RESOLVED);
        next.set(fileUrl, entry);
        return { jobId, map: next };
      });
    });
    runRef.current = run;
    return () => {
      run.cancel();
      if (runRef.current === run) runRef.current = null;
    };
  }, [jobId]);

  useEffect(() => {
    runRef.current?.update(candidates, active);
  }, [candidates, active, jobId]);

  return store.jobId === jobId ? store.map : EMPTY_RESOLVED;
}
