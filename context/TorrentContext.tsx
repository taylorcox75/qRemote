import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { TorrentInfo, MainData } from '../types/api';
import { syncApi } from '../services/api/sync';
import { useServer } from './ServerContext';

interface TorrentContextType {
  torrents: TorrentInfo[];
  categories: { [name: string]: any };
  tags: string[];
  serverState: any;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
}

const TorrentContext = createContext<TorrentContextType | undefined>(undefined);

export function TorrentProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useServer();
  const [torrents, setTorrents] = useState<TorrentInfo[]>([]);
  const [categories, setCategories] = useState<{ [name: string]: any }>({});
  const [tags, setTags] = useState<string[]>([]);
  const [serverState, setServerState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rid, setRid] = useState(0);
  const ridRef = useRef(0);

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
      
      if (data.full_update || ridRef.current === 0) {
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
        setServerState(data.server_state);
      }

      setRid(data.rid);
      ridRef.current = data.rid;
    } catch (err: any) {
      // Don't log errors if we're not connected - it's expected
      if (isConnected) {
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
      const interval = setInterval(() => {
        sync();
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
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

