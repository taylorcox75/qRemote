/**
 * useRssRules.ts — Data hook for qBittorrent RSS auto-downloading rules.
 *
 * Same shape as useRssFeeds: a moderate staleTime + manual refresh(), no
 * continuous polling, since rules only change when the user edits them here.
 */
import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rssApi } from '@/services/api/rss';
import { RssRule, RssRulesResponse } from '@/types/api';
import { useServer } from '@/context/ServerContext';
import { useReactiveReconnect } from '@/hooks/useReactiveReconnect';

const QUERY_KEY = ['rss', 'rules'];

export function useRssRules() {
  const { isConnected } = useServer();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery<RssRulesResponse>({
    queryKey: QUERY_KEY,
    queryFn: () => rssApi.getAllRules(),
    enabled: isConnected,
    staleTime: 10_000,
    retry: 1,
  });

  useReactiveReconnect(queryError);

  const rules = useMemo(() => data ?? {}, [data]);
  const ruleList = useMemo(
    () =>
      Object.entries(rules)
        .map(([name, rule]) => ({ name, rule }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rules],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const setRule = useCallback(
    async (ruleName: string, ruleDef: RssRule) => {
      await rssApi.setRule(ruleName, ruleDef);
      await refresh();
    },
    [refresh],
  );

  const renameRule = useCallback(
    async (ruleName: string, newRuleName: string) => {
      await rssApi.renameRule(ruleName, newRuleName);
      await refresh();
    },
    [refresh],
  );

  const removeRule = useCallback(
    async (ruleName: string) => {
      await rssApi.removeRule(ruleName);
      await refresh();
    },
    [refresh],
  );

  return {
    rules,
    ruleList,
    isLoading,
    isFetching,
    error: queryError,
    refresh,
    setRule,
    renameRule,
    removeRule,
  };
}

export type UseRssRulesResult = ReturnType<typeof useRssRules>;
