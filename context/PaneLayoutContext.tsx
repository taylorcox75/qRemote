/**
 * PaneLayoutContext.tsx — lets a screen render inside one pane of a split
 * view (the Torrents list | detail on wide windows) as if the pane were the
 * whole window.
 *
 * `PaneLayout` overrides, for everything below it:
 * - the safe-area insets (a pane only keeps the edges it actually touches),
 * - the width `useReadableLayout` measures gutters and graphs against,
 * - the glass tab bar's side, computed once from the real window insets
 *   (inside a pane the inset comparison that detects a side rail no longer
 *   holds).
 * Without a `PaneLayout` above it, every hook behaves exactly as before.
 */
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';
import type { TabBarSide } from '@/utils/glass-layout';

interface PaneLayoutValue {
  width: number;
  tabBarSide: TabBarSide;
}

const PaneLayoutContext = createContext<PaneLayoutValue | null>(null);

export function usePaneLayout(): PaneLayoutValue | null {
  return useContext(PaneLayoutContext);
}

interface PaneLayoutProps {
  /** null renders children untouched (no override). */
  pane: { width: number; insets: EdgeInsets; tabBarSide: TabBarSide } | null;
  children: ReactNode;
}

export function PaneLayout({ pane, children }: PaneLayoutProps) {
  const value = useMemo(
    () => (pane ? { width: pane.width, tabBarSide: pane.tabBarSide } : null),
    [pane],
  );
  // Same element types whether or not `pane` is set, so toggling the split
  // never remounts what's inside (the Torrents stack keeps its history).
  return (
    <PaneLayoutContext.Provider value={value}>
      <SafeAreaInsetsContext.Consumer>
        {(outer) => (
          <SafeAreaInsetsContext.Provider value={pane ? pane.insets : outer}>
            {children}
          </SafeAreaInsetsContext.Provider>
        )}
      </SafeAreaInsetsContext.Consumer>
    </PaneLayoutContext.Provider>
  );
}

/** Selected torrent for the split view's detail pane. */
interface TorrentSplitValue {
  /** The list and detail are side by side right now. */
  active: boolean;
  selectedHash: string | null;
  select: (hash: string | null) => void;
}

export const TorrentSplitContext = createContext<TorrentSplitValue>({
  active: false,
  selectedHash: null,
  select: () => {},
});

export function useTorrentSplit(): TorrentSplitValue {
  return useContext(TorrentSplitContext);
}

/** Settings two-pane state: the menu stays in a left column on wide windows. */
interface SettingsSplitValue {
  active: boolean;
  /** Current route inside the Settings stack, e.g. '/settings/appearance'. */
  pathname: string;
}

export const SettingsSplitContext = createContext<SettingsSplitValue>({
  active: false,
  pathname: '',
});

export function useSettingsSplit(): SettingsSplitValue {
  return useContext(SettingsSplitContext);
}
