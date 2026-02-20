import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { TorrentInfo, MainData, ServerState } from '../types/api';
import { syncApi } from '../services/api/sync';
import { useServer } from './ServerContext';

interface TorrentContextType {
  torrents: TorrentInfo[];
  categories: { [name: string]: any };
  tags: string[];
  serverState: Partial<ServerState> | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  isRecoveringFromBackground: boolean;
  initialLoadComplete: boolean;
}

const TorrentContext = createContext<TorrentContextType | undefined>(undefined);

export function TorrentProvider({ children }: { children: ReactNode }) {
  const { isConnected, checkAndReconnect } = useServer();
  const [torrents, setTorrents] = useState<TorrentInfo[]>([]);
  const [categories, setCategories] = useState<{ [name: string]: any }>({});
  const [tags, setTags] = useState<string[]>([]);
  const [serverState, setServerState] = useState<Partial<ServerState> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rid, setRid] = useState(0);
  const ridRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const lastActiveTime = useRef(Date.now());
  const isRecoveringFromBackground = useRef(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    ridRef.current = rid;
  }, [rid]);

  const sync = useCallback(async () => {
    if (!isConnected) return;

    try {
      setError(null);
      const currentRid = ridRef.current;
      const data: MainData = await syncApi.getMainData(currentRid);
      const isFullUpdate = data.full_update || currentRid === 0;
      
      // Mark initial load as complete after first successful sync
      if (!initialLoadComplete) {
        setInitialLoadComplete(true);
      }
      
      // Clear recovery flag on successful sync
      if (isRecoveringFromBackground.current) {
        isRecoveringFromBackground.current = false;
      }
      
      if (isFullUpdate) {
        // Full update
        if (data.torrents && Object.keys(data.torrents).length > 0) {
          const torrentsArray = Object.values(data.torrents);
          // Filter out invalid torrents (only check for essential fields)
          const validTorrents = torrentsArray.filter((t) => {
            if (!t || !t.hash) {
              return false;
            }
            // Ensure progress is a valid number (default to 0 if invalid)
            if (typeof t.progress !== 'number' || isNaN(t.progress)) {
              t.progress = 0;
            }
            return true;
          });
          setTorrents(validTorrents);
        } else {
          setTorrents([]);
        }
        if (data.categories) {
          setCategories(data.categories);
        }
        if (data.tags) {
          setTags(data.tags);
        }
      } else {
        // Incremental update - qBittorrent only sends changed fields, so we need to merge
        if (data.torrents) {
          setTorrents((prev) => {
            // Convert previous array to map for efficient lookup
            const torrentMap = new Map<string, TorrentInfo>();
            prev.forEach((t) => {
              if (t && t.hash) {
                torrentMap.set(t.hash, t);
              }
            });
            
            // Merge incremental updates with existing torrent data
            if (data.torrents) {
              Object.keys(data.torrents).forEach((hashKey) => {
                const incrementalUpdate = data.torrents![hashKey];
                // The key IS the hash - use it to look up existing torrent
                const existingTorrent = torrentMap.get(hashKey);
                if (existingTorrent) {
                  // Merge: keep existing data, update with new fields
                  // Ensure hash is preserved from existing torrent
                  const merged = { ...existingTorrent, ...incrementalUpdate, hash: hashKey };
                  torrentMap.set(hashKey, merged);
                } else {
                  // New torrent (shouldn't happen in incremental, but handle it)
                  // Ensure hash is set from the key
                  if (!incrementalUpdate.hash) {
                    incrementalUpdate.hash = hashKey;
                  }
                  torrentMap.set(hashKey, incrementalUpdate);
                }
              });
            }
            
            // Convert back to array and ensure valid data
            const torrentsArray = Array.from(torrentMap.values());
            return torrentsArray.map((t) => {
              // Ensure progress is a valid number (default to 0 if invalid)
              if (typeof t.progress !== 'number' || isNaN(t.progress)) {
                t.progress = 0;
              }
              return t;
            }).filter((t) => t && t.hash); // Only filter out torrents without hash
          });
        }
        if (data.torrents_removed) {
          setTorrents((prev) => prev.filter((t) => !data.torrents_removed!.includes(t.hash)));
        }
        if (data.categories) {
          setCategories((prev) => ({ ...prev, ...data.categories }));
        }
        if (data.categories_removed) {
          setCategories((prev) => {
            const updated = { ...prev };
            data.categories_removed!.forEach((name) => delete updated[name]);
            return updated;
          });
        }
        if (data.tags) {
          setTags((prev) => [...new Set([...prev, ...data.tags!])]);
        }
        if (data.tags_removed) {
          setTags((prev) => prev.filter((tag) => !data.tags_removed!.includes(tag)));
        }
      }

      if (data.server_state) {
        setServerState((prev) => {
          if (isFullUpdate || !prev) {
            return data.server_state!;
          }

          // /sync/maindata incremental responses may include only changed server_state fields.
          return { ...prev, ...data.server_state };
        });
      }

      setRid(data.rid);
      ridRef.current = data.rid;
    } catch (err: any) {
      // Don't set error if we're recovering from background - transient network issues are expected
      if (isConnected && !isRecoveringFromBackground.current) {
        setError(err.message || 'Failed to sync torrents');
      }
    }
  }, [isConnected]);

  const refresh = useCallback(async () => {
    if (!isConnected) return;

    setIsLoading(true);
    setRid(0);
    ridRef.current = 0;
    try {
      await sync();
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sync]);

  useEffect(() => {
    if (isConnected) {
      // Initial refresh
      setIsLoading(true);
      setRid(0);
      ridRef.current = 0;
      sync().finally(() => {
        setIsLoading(false);
      });
      
      // Set up polling for real-time updates
      intervalRef.current = setInterval(() => {
        sync();
      }, 2000); // Poll every 2 seconds

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      setTorrents([]);
      setCategories({});
      setTags([]);
      setServerState(null);
      setRid(0);
      ridRef.current = 0;
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // AppState listener for background/foreground handling
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousAppState = appState.current;
      appState.current = nextAppState;

      if (previousAppState === 'background' && nextAppState === 'active') {
        // App came back to foreground
        const timeInBackground = Date.now() - lastActiveTime.current;
        
        // If app was in background for more than 30 seconds, connection might be stale
        if (timeInBackground > 30000 && isConnected) {
          isRecoveringFromBackground.current = true;
          
          // Try to reconnect silently
          const reconnected = await checkAndReconnect();
          
          if (reconnected) {
            // Clear error and force a fresh sync
            setError(null);
            setRid(0);
            ridRef.current = 0;
            
            // Resume polling
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            intervalRef.current = setInterval(() => {
              sync();
            }, 2000);
            
            // Do an immediate sync
            await sync();
          }
          
          isRecoveringFromBackground.current = false;
        } else if (isConnected) {
          // Just resume polling, connection should still be good
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          intervalRef.current = setInterval(() => {
            sync();
          }, 2000);
          
          // Do an immediate sync
          await sync();
        }
        
        lastActiveTime.current = Date.now();
      } else if (nextAppState === 'background') {
        // App went to background - pause polling to save battery
        lastActiveTime.current = Date.now();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (nextAppState === 'active') {
        // App became active (but wasn't in background before)
        lastActiveTime.current = Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [isConnected, checkAndReconnect, sync]);

  return (
    <TorrentContext.Provider
      value={{
        torrents,
        categories,
        tags,
        serverState,
        isLoading,
        error,
        refresh,
        sync,
        isRecoveringFromBackground: isRecoveringFromBackground.current,
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
