/**
 * ShellContext.tsx — Desktop/iPad shell state (Phase B). Holds the layout
 * idiom, the selected torrent (for the split-view detail pane), the
 * sidebar's list filter, and whether the sidebar is collapsed.
 *
 * Only mounted on 'regular'/'mac' layouts — the 'compact' (iPhone) screens
 * never read this context, so nothing here can change iPhone behaviour.
 *
 * Key exports: ShellProvider, useShell, ListFilter, ShellState
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { useLayoutIdiom, LayoutIdiom } from '@/hooks/useLayoutIdiom';
import { useTorrents } from '@/context/TorrentContext';
import { useServer } from '@/context/ServerContext';

/** Mirrors index.tsx's local filter state — see utils/torrent-filters.ts for the status ids. */
export interface ListFilter {
  status: string;
  category: string | null;
  tags: string[];
}

export interface ShellState {
  idiom: LayoutIdiom;
  selectedHash: string | null;
  setSelectedHash(h: string | null): void;
  listFilter: ListFilter;
  setListFilter(f: ListFilter): void;
  sidebarCollapsed: boolean;
  toggleSidebar(): void;
}

const DEFAULT_LIST_FILTER: ListFilter = { status: 'all', category: null, tags: [] };

const ShellContext = createContext<ShellState | undefined>(undefined);

export function ShellProvider({ children }: { children: ReactNode }) {
  const idiom = useLayoutIdiom();
  const { torrents, initialLoadComplete } = useTorrents();
  const { isConnected } = useServer();

  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>(DEFAULT_LIST_FILTER);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Clear the selected torrent once it no longer exists in the live list, or
  // once the server disconnects — otherwise the detail pane would keep
  // showing a stale/deleted torrent. Gated on initialLoadComplete so a
  // still-loading first sync (torrents briefly empty) doesn't clear a hash
  // that was selected the moment the app opened, before data arrived.
  useEffect(() => {
    if (!selectedHash) return;
    if (!isConnected) {
      setSelectedHash(null);
      return;
    }
    if (initialLoadComplete && !torrents.some((torrent) => torrent.hash === selectedHash)) {
      setSelectedHash(null);
    }
  }, [selectedHash, isConnected, initialLoadComplete, torrents]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  // Memoized so useShell() consumers (e.g. app/(tabs)/_layout.tsx) don't
  // re-render every time this provider does. The provider itself re-renders
  // on every torrents poll (it subscribes to useTorrents() for the
  // selectedHash-clear effect above), but setSelectedHash/setListFilter are
  // stable setState functions, so the value only actually changes when
  // idiom, selectedHash, listFilter or sidebarCollapsed changes.
  const value = useMemo<ShellState>(
    () => ({
      idiom,
      selectedHash,
      setSelectedHash,
      listFilter,
      setListFilter,
      sidebarCollapsed,
      toggleSidebar,
    }),
    [idiom, selectedHash, listFilter, sidebarCollapsed, toggleSidebar],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const context = useContext(ShellContext);
  if (context === undefined) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
}
