/**
 * useRssFeeds.ts — Data hook for the qBittorrent RSS folder/feed tree.
 *
 * Unlike search jobs, RSS feeds refresh server-side on qBittorrent's own
 * timer, so this doesn't need continuous polling — a moderate staleTime plus
 * manual refresh() (pull-to-refresh, focus effects) is enough. Centralizes
 * the flattened folder/feed lists here since they're needed by the tree
 * screen, the rule editor's feed picker, and the move/rename pickers alike.
 */
import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rssApi } from '@/services/api/rss';
import { RssItemsResponse } from '@/types/api';
import { flattenRssTree } from '@/utils/rss';
import { useServer } from '@/context/ServerContext';
import { useReactiveReconnect } from '@/hooks/useReactiveReconnect';

const QUERY_KEY = ['rss', 'items'];

export function useRssFeeds() {
  const { isConnected } = useServer();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery<RssItemsResponse>({
    queryKey: QUERY_KEY,
    queryFn: () => rssApi.getAllItems(true),
    enabled: isConnected,
    staleTime: 10_000,
    retry: 1,
  });

  useReactiveReconnect(queryError);

  const tree = useMemo(() => data ?? {}, [data]);
  const { folders, feeds } = useMemo(() => flattenRssTree(tree), [tree]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const addFolder = useCallback(
    async (path: string) => {
      await rssApi.addFolder(path);
      await refresh();
    },
    [refresh],
  );

  const addFeed = useCallback(
    async (url: string, path: string) => {
      await rssApi.addFeed(url, path);
      await refresh();
    },
    [refresh],
  );

  const removeItem = useCallback(
    async (path: string) => {
      await rssApi.removeItem(path);
      await refresh();
    },
    [refresh],
  );

  const moveItem = useCallback(
    async (itemPath: string, destPath: string) => {
      await rssApi.moveItem(itemPath, destPath);
      await refresh();
    },
    [refresh],
  );

  const refreshItem = useCallback(
    async (itemPath: string) => {
      await rssApi.refreshItem(itemPath);
      await refresh();
    },
    [refresh],
  );

  const markAsRead = useCallback(
    async (itemPath: string, articleId?: string) => {
      await rssApi.markAsRead(itemPath, articleId);
      await refresh();
    },
    [refresh],
  );

  return {
    tree,
    folders,
    feeds,
    isLoading,
    isFetching,
    error: queryError,
    refresh,
    addFolder,
    addFeed,
    removeItem,
    moveItem,
    refreshItem,
    markAsRead,
  };
}

export type UseRssFeedsResult = ReturnType<typeof useRssFeeds>;
