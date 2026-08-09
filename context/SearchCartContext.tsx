import React, { createContext, useContext, useCallback, useMemo, useState, ReactNode } from 'react';

export interface SearchCartItem {
  /** Unique key — the result's download URL. */
  fileUrl: string;
  fileName: string;
  fileSize: number;
  nbSeeders: number;
  /**
   * resultTrackerLabel(result, isAggregatedSource) resolved at the moment the
   * item was carted. Captured here because isAggregatedSource is Search-screen
   * state the add screen can't see, and it's what checkout groups by (#217).
   */
  indexerLabel: string;
}

interface SearchCartContextType {
  items: SearchCartItem[];
  count: number;
  has: (fileUrl: string) => boolean;
  add: (item: SearchCartItem) => void;
  remove: (fileUrl: string) => void;
  toggle: (item: SearchCartItem) => void;
  clear: () => void;
}

const SearchCartContext = createContext<SearchCartContextType | undefined>(undefined);

/**
 * Session-scoped queue of Search results a user wants to add together with
 * one shared set of options (#217). Deliberately not persisted to
 * AsyncStorage — plugin download URLs are often session/token-bound, so
 * surviving an app restart would just accumulate stale entries.
 */
export function SearchCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SearchCartItem[]>([]);

  const has = useCallback(
    (fileUrl: string) => items.some((item) => item.fileUrl === fileUrl),
    [items],
  );

  const add = useCallback((item: SearchCartItem) => {
    setItems((prev) =>
      prev.some((existing) => existing.fileUrl === item.fileUrl) ? prev : [...prev, item],
    );
  }, []);

  const remove = useCallback((fileUrl: string) => {
    setItems((prev) => prev.filter((item) => item.fileUrl !== fileUrl));
  }, []);

  const toggle = useCallback((item: SearchCartItem) => {
    setItems((prev) => {
      if (prev.some((existing) => existing.fileUrl === item.fileUrl)) {
        return prev.filter((existing) => existing.fileUrl !== item.fileUrl);
      }
      return [...prev, item];
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const contextValue = useMemo(
    () => ({ items, count: items.length, has, add, remove, toggle, clear }),
    [items, has, add, remove, toggle, clear],
  );

  return <SearchCartContext.Provider value={contextValue}>{children}</SearchCartContext.Provider>;
}

export function useSearchCart() {
  const context = useContext(SearchCartContext);
  if (context === undefined) {
    throw new Error('useSearchCart must be used within a SearchCartProvider');
  }
  return context;
}
