/**
 * TorrentContext.tsx — React Context providing torrent list, categories, tags, and server state via rid-based incremental sync.
 *
 * Key exports: TorrentProvider, useTorrents
 * Known issues: isRecoveringFromBackground was a ref that didn't trigger re-renders (fixed to use state in Task 1.4d).
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TorrentInfo, MainData, ServerState, Category } from '@/types/api';
import { syncApi } from '@/services/api/sync';
import { useServer } from './ServerContext';
import { getErrorMessage } from '@/utils/error';
import { useReactiveReconnect } from '@/hooks/useReactiveReconnect';

interface TorrentContextType {
  torrents: TorrentInfo[];
  categories: { [name: string]: Category };
  tags: string[];
  serverState: Partial<ServerState> | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  isRecoveringFromBackground: boolean;
  initialLoadComplete: boolean;
}

interface SyncState {
  torrents: TorrentInfo[];
  categories: { [name: string]: Category };
  tags: string[];
  serverState: Partial<ServerState> | null;
}

const EMPTY_STATE: SyncState = { torrents: [], categories: {}, tags: [], serverState: null };

const TorrentContext = createContext<TorrentContextType | undefined>(undefined);

export function TorrentProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useServer();
  const queryClient = useQueryClient();

  const ridRef = useRef(0);
  const stateRef = useRef<SyncState>({ ...EMPTY_STATE });
  const syncVersionRef = useRef(0);

  const appStateRef = useRef(AppState.currentState);
  const lastActiveTime = useRef(Date.now());
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const [isRecoveringState, setIsRecoveringState] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Tracks the most recent successful sync timestamp, and the value it was
  // at when a recovery window started — so the "clear recovery" effect below
  // can tell a genuinely new fetch apart from the stale timestamp that was
  // already sitting there when recovery began. See that effect for why this
  // distinction matters.
  const dataUpdatedAtRef = useRef(0);
  const recoveryBaselineRef = useRef(0);

  const syncQueryFn = useCallback(async (): Promise<SyncState> => {
    const version = syncVersionRef.current;
    const currentRid = ridRef.current;
    const data: MainData = await syncApi.getMainData(currentRid);

    // A newer sync was requested while this one was in-flight — discard side-effects
    if (version !== syncVersionRef.current) {
      return stateRef.current;
    }

    const isFullUpdate = data.full_update || currentRid === 0;
    let state: SyncState;

    if (isFullUpdate) {
      const torrentsArray = data.torrents ? Object.values(data.torrents) : [];
      const validTorrents = torrentsArray.filter((t) => {
        if (!t || !t.hash) return false;
        if (typeof t.progress !== 'number' || isNaN(t.progress)) t.progress = 0;
        return true;
      });

      state = {
        torrents: validTorrents,
        categories: data.categories ?? {},
        tags: data.tags ?? [],
        serverState: data.server_state ?? null,
      };
    } else {
      const prev = stateRef.current;
      let torrents = [...prev.torrents];
      let categories = { ...prev.categories };
      let tags = [...prev.tags];
      let serverState: Partial<ServerState> | null = prev.serverState
        ? { ...prev.serverState }
        : null;

      if (data.torrents) {
        const torrentMap = new Map<string, TorrentInfo>();
        torrents.forEach((t) => {
          if (t && t.hash) torrentMap.set(t.hash, t);
        });

        Object.keys(data.torrents).forEach((hashKey) => {
          const update = data.torrents![hashKey];
          const existing = torrentMap.get(hashKey);
          if (existing) {
            torrentMap.set(hashKey, { ...existing, ...update, hash: hashKey });
          } else {
            if (!update.hash) update.hash = hashKey;
            torrentMap.set(hashKey, update);
          }
        });

        torrents = Array.from(torrentMap.values())
          .map((t) => {
            if (typeof t.progress !== 'number' || isNaN(t.progress)) t.progress = 0;
            return t;
          })
          .filter((t) => t && t.hash);
      }

      if (data.torrents_removed) {
        torrents = torrents.filter((t) => !data.torrents_removed!.includes(t.hash));
      }

      if (data.categories) {
        categories = { ...categories, ...data.categories };
      }
      if (data.categories_removed) {
        data.categories_removed.forEach((name) => delete categories[name]);
      }

      if (data.tags) {
        tags = [...new Set([...tags, ...data.tags])];
      }
      if (data.tags_removed) {
        tags = tags.filter((tag) => !data.tags_removed!.includes(tag));
      }

      if (data.server_state) {
        serverState = serverState ? { ...serverState, ...data.server_state } : data.server_state;
      }

      state = { torrents, categories, tags, serverState };
    }

    ridRef.current = data.rid;
    stateRef.current = state;
    return state;
  }, []);

  const {
    data: syncData,
    isLoading: queryIsLoading,
    error: queryError,
    dataUpdatedAt,
  } = useQuery<SyncState>({
    queryKey: ['torrents'],
    queryFn: syncQueryFn,
    refetchInterval: isAppActive ? 2000 : false,
    enabled: isConnected,
  });

  // Mark initial load complete once we receive data (persists across disconnects)
  useEffect(() => {
    if (dataUpdatedAt > 0 && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [dataUpdatedAt, initialLoadComplete]);

  // Keep the latest successful-sync timestamp available to the AppState
  // handler (below) without adding it to that effect's own deps.
  useEffect(() => {
    dataUpdatedAtRef.current = dataUpdatedAt;
  }, [dataUpdatedAt]);

  // Clear recovery state only once a fetch *newer than the one already
  // sitting there when recovery started* actually lands. `dataUpdatedAt`
  // being merely nonzero isn't enough — it holds the last successful sync
  // from potentially hours ago, so comparing against 0 cleared this on the
  // very next render, before the foreground re-sync had a chance to run.
  useEffect(() => {
    if (isRecoveringState && dataUpdatedAt > recoveryBaselineRef.current) {
      setIsRecoveringState(false);
    }
  }, [dataUpdatedAt, isRecoveringState]);

  // Safety cap: if a foreground recovery never resolves (e.g. the refetch
  // below got deduped into an already-in-flight poll and no new data ever
  // lands), don't leave the user on a skeleton forever. The normal exits are
  // already bounded — a successful re-sync clears the flag above, and a
  // genuine failure flips isConnected false, which routes to the
  // not-connected screen regardless.
  useEffect(() => {
    if (!isRecoveringState) return undefined;
    const timeout = setTimeout(() => setIsRecoveringState(false), 15000);
    return () => clearTimeout(timeout);
  }, [isRecoveringState]);

  // Reset sync state when disconnected
  useEffect(() => {
    if (!isConnected) {
      ridRef.current = 0;
      stateRef.current = { ...EMPTY_STATE };
      syncVersionRef.current++;
      queryClient.removeQueries({ queryKey: ['torrents'] });
    }
  }, [isConnected, queryClient]);

  // Auto-reconnect when the sync fails due to auth or connection failure.
  // Covers: qBittorrent server restart (session invalidated), dev Fast
  // Refresh re-evaluating apiClient (singleton loses cookies/currentServer),
  // and a session that died while the app was backgrounded. Cooldown and
  // trigger conditions live in the shared hook.
  useReactiveReconnect(queryError);

  // AppState handler: background/foreground recovery
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;
      setIsAppActive(nextAppState === 'active');

      if (previousAppState === 'background' && nextAppState === 'active') {
        lastActiveTime.current = Date.now();

        if (isConnected) {
          // Baseline against the last successful sync *before* flipping the
          // flag, so the clear effect above can tell a genuinely new fetch
          // apart from the stale timestamp already sitting there.
          recoveryBaselineRef.current = dataUpdatedAtRef.current;
          setIsRecoveringState(true);

          // Deliberately NOT eagerly reconnecting here. checkAndReconnect
          // always performs a fresh login (server-manager.ts has no
          // lightweight "is my session still valid" path) — calling it on
          // every foreground return, even when the old session was still
          // fine, was forcing a needless re-login on every single app
          // switch. qBittorrent's search jobs are tied to session state, so
          // that was silently orphaning any in-progress search. If the
          // session actually died while backgrounded, the re-sync below
          // will fail naturally and the reactive effect above (which
          // watches queryError) picks it up and reconnects — but only when
          // it's actually needed.

          // Force full re-sync on foreground
          syncVersionRef.current++;
          ridRef.current = 0;
          await new Promise<void>((resolve) => {
            InteractionManager.runAfterInteractions(() => {
              queryClient.invalidateQueries({ queryKey: ['torrents'] }).finally(() => resolve());
            });
          });
          // Deliberately not clearing the flag here — invalidateQueries
          // settles regardless of whether the refetch itself failed (e.g.
          // the qBittorrent session died while backgrounded). The baselined
          // clear effect above is what turns recovery off, once a fetch
          // newer than the pre-recovery baseline actually lands (either
          // this re-sync succeeding outright, or a later poll succeeding
          // after the reactive reconnect effect re-logs in) — and
          // isConnected flipping false (genuine disconnect) still falls
          // through to the normal not-connected screen regardless.
        }
      } else if (nextAppState === 'background') {
        lastActiveTime.current = Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isConnected, queryClient]);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    syncVersionRef.current++;
    ridRef.current = 0;
    await queryClient.invalidateQueries({ queryKey: ['torrents'] });
  }, [isConnected, queryClient]);

  const sync = useCallback(async () => {
    if (!isConnected) return;
    await queryClient.invalidateQueries({ queryKey: ['torrents'] });
  }, [isConnected, queryClient]);

  const torrents = isConnected ? (syncData?.torrents ?? []) : [];
  const categories = isConnected ? (syncData?.categories ?? {}) : {};
  const tags = isConnected ? (syncData?.tags ?? []) : [];
  const serverState = isConnected ? (syncData?.serverState ?? null) : null;
  const error = isRecoveringState ? null : queryError ? getErrorMessage(queryError) : null;

  return (
    <TorrentContext.Provider
      value={{
        torrents,
        categories,
        tags,
        serverState,
        isLoading: queryIsLoading,
        error,
        refresh,
        sync,
        isRecoveringFromBackground: isRecoveringState,
        initialLoadComplete,
      }}
    >
      {children}
    </TorrentContext.Provider>
  );
}

export function useTorrents() {
  const context = useContext(TorrentContext);
  if (context === undefined) {
    throw new Error('useTorrents must be used within a TorrentProvider');
  }
  return context;
}
