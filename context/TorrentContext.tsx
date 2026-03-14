/**
 * TorrentContext.tsx — React Context providing torrent list, categories, tags, and server state via rid-based incremental sync.
 *
 * Key exports: TorrentProvider, useTorrents
 * Known issues: isRecoveringFromBackground was a ref that didn't trigger re-renders (fixed to use state in Task 1.4d).
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TorrentInfo, MainData, ServerState, Category } from '@/types/api';
import { syncApi } from '@/services/api/sync';
import { useServer } from './ServerContext';
import { getErrorMessage } from '@/utils/error';

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
  const { isConnected, checkAndReconnect } = useServer();
  const queryClient = useQueryClient();

  const ridRef = useRef(0);
  const stateRef = useRef<SyncState>({ ...EMPTY_STATE });
  const syncVersionRef = useRef(0);

  const appStateRef = useRef(AppState.currentState);
  const lastActiveTime = useRef(Date.now());
  const [isRecoveringState, setIsRecoveringState] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

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
        serverState = serverState
          ? { ...serverState, ...data.server_state }
          : data.server_state;
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
    refetchInterval: 2000,
    enabled: isConnected,
  });

  // Mark initial load complete once we receive data (persists across disconnects)
  useEffect(() => {
    if (dataUpdatedAt > 0 && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [dataUpdatedAt, initialLoadComplete]);

  // Clear recovery state after successful fetch
  useEffect(() => {
    if (dataUpdatedAt > 0 && isRecoveringState) {
      setIsRecoveringState(false);
    }
  }, [dataUpdatedAt, isRecoveringState]);

  // Reset sync state when disconnected
  useEffect(() => {
    if (!isConnected) {
      ridRef.current = 0;
      stateRef.current = { ...EMPTY_STATE };
      syncVersionRef.current++;
      queryClient.removeQueries({ queryKey: ['torrents'] });
    }
  }, [isConnected, queryClient]);

  // AppState handler: background/foreground recovery
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previousAppState === 'background' && nextAppState === 'active') {
        const timeInBackground = Date.now() - lastActiveTime.current;
        lastActiveTime.current = Date.now();

        if (isConnected) {
          setIsRecoveringState(true);

          if (timeInBackground > 30000) {
            await checkAndReconnect();
          }

          // Force full re-sync on foreground
          syncVersionRef.current++;
          ridRef.current = 0;
          await queryClient.invalidateQueries({ queryKey: ['torrents'] });
          setIsRecoveringState(false);
        }
      } else if (nextAppState === 'background') {
        lastActiveTime.current = Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isConnected, checkAndReconnect, queryClient]);

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
