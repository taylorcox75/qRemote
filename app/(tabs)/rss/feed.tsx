/**
 * feed.tsx — Article list for a single RSS feed.
 *
 * Reached from the feed/folder tree screen via
 * router.push({ pathname: '/rss/feed', params: { path: encodeURIComponent(itemPath) } }) —
 * qBittorrent RSS paths use `\` as a separator, which is why the target feed
 * is passed as an encoded query param rather than a `[path]` dynamic segment.
 * There's no per-feed fetch endpoint: useRssFeeds() always returns the whole
 * tree, so the feed shown here is located by matching `path` against the
 * flattened `feeds` list.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Share,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { EmptyState } from '@/components/EmptyState';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useServer } from '@/context/ServerContext';
import { useRssFeeds } from '@/hooks/useRssFeeds';
import { torrentsApi } from '@/services/api/torrents';
import { RssArticle } from '@/types/api';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';
import { toSearchQuery } from '@/utils/rss';

export default function RssFeedArticlesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ path?: string }>();
  const itemPath = params.path ? decodeURIComponent(params.path) : '';

  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const { isConnected } = useServer();
  const { feeds, isLoading, refresh, refreshItem, markAsRead } = useRssFeeds();

  const [refreshing, setRefreshing] = useState(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<RssArticle | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>();

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const feed = useMemo(() => feeds.find((f) => f.path === itemPath)?.feed, [feeds, itemPath]);
  const articles = useMemo(() => feed?.articles ?? [], [feed]);

  // ────────────────────────────────────────────────── actions ─────────────

  const handlePullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleRefreshFeed = useCallback(async () => {
    if (!itemPath) return;
    setIsRefreshingFeed(true);
    try {
      await refreshItem(itemPath);
      haptics.success();
      showToast(t('screens.rss.feedRefreshedToast'), 'success');
    } catch (err: unknown) {
      haptics.error();
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsRefreshingFeed(false);
    }
  }, [itemPath, refreshItem, showToast, t]);

  const handleMarkAllRead = useCallback(async () => {
    if (!itemPath) return;
    setIsMarkingAllRead(true);
    try {
      await markAsRead(itemPath);
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [itemPath, markAsRead, showToast]);

  // Tapping a row is a low-friction read-tracking gesture, not a big
  // confirmable action — stay silent on success, only surface failures via
  // haptics (no toast, to avoid noise on every tap).
  const handleRowPress = useCallback(
    async (article: RssArticle) => {
      try {
        await markAsRead(itemPath, article.id);
        haptics.light();
      } catch {
        haptics.error();
      }
    },
    [itemPath, markAsRead],
  );

  const toggleSelectMode = useCallback(() => {
    haptics.medium();
    setSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    haptics.selection();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllPress = useCallback(() => {
    if (!selectMode) {
      haptics.medium();
      setSelectMode(true);
      return;
    }
    haptics.selection();
    setSelectedIds((prev) =>
      prev.size === articles.length ? new Set() : new Set(articles.map((a) => a.id)),
    );
  }, [selectMode, articles]);

  const handleBulkAddAsTorrent = useCallback(async () => {
    const targets = articles.filter((a) => selectedIds.has(a.id) && a.torrentURL);
    if (targets.length === 0) {
      showToast(t('screens.rss.noSelectedArticlesHaveTorrents'), 'error');
      return;
    }
    setBulkLoading(true);
    try {
      const results = await Promise.allSettled(
        targets.map((a) => torrentsApi.addTorrent(a.torrentURL as string)),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded > 0) {
        haptics.success();
        showToast(t('screens.rss.articlesAddedToast', { count: succeeded }), 'success');
      }
      if (failed > 0) {
        haptics.error();
        if (succeeded === 0) {
          const firstFailure = results.find(
            (r): r is PromiseRejectedResult => r.status === 'rejected',
          );
          showToast(getErrorMessage(firstFailure?.reason), 'error');
        }
      }
      setSelectMode(false);
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  }, [articles, selectedIds, showToast, t]);

  const handleBulkMarkRead = useCallback(async () => {
    if (selectedIds.size === 0 || !itemPath) return;
    setBulkLoading(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) => markAsRead(itemPath, id)),
      );
      const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (firstFailure) {
        haptics.error();
        showToast(getErrorMessage(firstFailure.reason), 'error');
      } else {
        haptics.success();
      }
      setSelectMode(false);
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, itemPath, markAsRead, showToast]);

  const handleLongPressArticle = useCallback(
    (article: RssArticle, anchor?: { x: number; y: number }) => {
      haptics.medium();
      setMenuAnchor(anchor);
      setSelectedArticle(article);
    },
    [],
  );

  const handleOpenLink = useCallback(
    async (url: string | undefined) => {
      if (!url) return;
      try {
        await Linking.openURL(url);
      } catch {
        showToast(getErrorMessage(new Error('Cannot open link')), 'error');
      }
    },
    [showToast],
  );

  const handleCopyUrl = useCallback(
    async (url: string | undefined) => {
      if (!url) return;
      try {
        await Clipboard.setStringAsync(url);
        haptics.light();
        showToast(t('screens.rss.linkCopiedToast'), 'success');
      } catch {
        // ignore — clipboard write rarely fails
      }
    },
    [showToast, t],
  );

  const handleShareUrl = useCallback(async (url: string | undefined) => {
    if (!url) return;
    try {
      await Share.share({ message: url });
    } catch {
      // user dismissed share sheet
    }
  }, []);

  const handleAddAsTorrent = useCallback(
    async (article: RssArticle) => {
      if (!article.torrentURL) return;
      try {
        await torrentsApi.addTorrent(article.torrentURL);
        haptics.success();
        showToast(t('screens.rss.articleAddedToast'), 'success');
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      }
    },
    [showToast, t],
  );

  // Watchlist-style feeds (e.g. Plex Watchlist) carry a title but no
  // torrentURL — there's nothing to add directly. Jumping to the Search tab
  // with the title pre-filled is the actual useful action for those.
  const handleSearchForThis = useCallback(
    (article: RssArticle) => {
      haptics.selection();
      // `ts` is a nonce so the Search tab re-runs the handoff even when the
      // same title is sent twice (the `q` param alone wouldn't change).
      router.push({
        pathname: '/(tabs)/search',
        params: { q: toSearchQuery(article.title), ts: String(Date.now()) },
      });
    },
    [router],
  );

  const actionItems: ActionMenuItemDef[] = useMemo(() => {
    if (!selectedArticle) return [];
    const items: ActionMenuItemDef[] = [];
    if (selectedArticle.torrentURL) {
      items.push({
        label: t('screens.rss.addAsTorrent'),
        icon: 'add-circle-outline',
        onPress: () => void handleAddAsTorrent(selectedArticle),
      });
    }
    if (selectedArticle.title) {
      items.push({
        label: t('screens.rss.searchForThis'),
        icon: 'search-outline',
        onPress: () => handleSearchForThis(selectedArticle),
      });
    }
    if (selectedArticle.link) {
      items.push({
        label: t('screens.rss.openLink'),
        icon: 'open-outline',
        onPress: () => void handleOpenLink(selectedArticle.link),
      });
      items.push({
        label: t('screens.rss.copyLink'),
        icon: 'copy-outline',
        onPress: () => void handleCopyUrl(selectedArticle.link),
      });
      items.push({
        label: t('screens.rss.shareLink'),
        icon: 'share-outline',
        onPress: () => void handleShareUrl(selectedArticle.link),
      });
    }
    return items;
  }, [
    selectedArticle,
    t,
    handleOpenLink,
    handleCopyUrl,
    handleShareUrl,
    handleAddAsTorrent,
    handleSearchForThis,
  ]);

  const headerTitle = feed?.title || feed?.url || t('screens.rss.feedsTitle');

  // ────────────────────────────────────────────────── render ──────────────

  const renderItem = ({ item }: { item: RssArticle }) => {
    // NOTE: qBittorrent's rss/items response has no confirmed explicit
    // read/unread boolean field on the article object today (open question
    // in the RSS feature's implementation plan) — defensively check a couple
    // of conventional field names and treat missing/undefined as unread
    // (bold). Verify this against a live qBittorrent server before shipping.
    const isRead = Boolean(item.isRead ?? item.read);
    const dateLabel = item.date ? formatArticleDate(item.date) : '';
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.surfaceOutline }]}
        onPress={() => (selectMode ? toggleSelection(item.id) : void handleRowPress(item))}
        onLongPress={(e) =>
          selectMode
            ? toggleSelection(item.id)
            : handleLongPressArticle(item, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })
        }
        activeOpacity={0.7}
        accessibilityLabel={
          selectMode
            ? isSelected
              ? t('screens.rss.deselectArticle')
              : t('screens.rss.selectArticle')
            : undefined
        }
      >
        {selectMode && (
          <View style={styles.checkbox}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={22}
              color={isSelected ? colors.primary : colors.textSecondary}
            />
          </View>
        )}
        <View style={styles.articleContent}>
          <Text
            style={[isRead ? typography.body : typography.bodySemibold, { color: colors.text }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {!!dateLabel && (
            <Text style={[styles.articleDate, { color: colors.textSecondary }]}>{dateLabel}</Text>
          )}
          {!!item.description && (
            <Text
              style={[styles.articleDescription, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}
        </View>
        {!selectMode && (
          <TouchableOpacity
            onPress={(e) =>
              handleLongPressArticle(item, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })
            }
            hitSlop={8}
            style={styles.menuButton}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity
            onPress={() => (selectMode ? toggleSelectMode() : router.back())}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={selectMode ? t('common.cancel') : t('common.back')}
          >
            <Ionicons name={selectMode ? 'close' : 'arrow-back'} size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {selectMode
              ? t('screens.rss.articlesSelectedCount', { count: selectedIds.size })
              : headerTitle}
          </Text>
          {selectMode ? (
            <View style={styles.headerRight} />
          ) : (
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => void handleMarkAllRead()}
                disabled={isMarkingAllRead || !itemPath}
                style={[
                  styles.headerButton,
                  (isMarkingAllRead || !itemPath) && styles.headerButtonDisabled,
                ]}
                activeOpacity={0.7}
                accessibilityLabel={t('screens.rss.markAllRead')}
              >
                {isMarkingAllRead ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="checkmark-done-outline" size={22} color={colors.text} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleRefreshFeed()}
                disabled={isRefreshingFeed || !itemPath}
                style={[
                  styles.headerButton,
                  (isRefreshingFeed || !itemPath) && styles.headerButtonDisabled,
                ]}
                activeOpacity={0.7}
                accessibilityLabel={t('screens.rss.refresh')}
              >
                {isRefreshingFeed ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={22} color={colors.text} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {isConnected && !isLoading && articles.length > 0 && (
          <TouchableOpacity
            style={[styles.selectionRow, { borderBottomColor: colors.surfaceOutline }]}
            onPress={handleSelectAllPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={
                selectMode && selectedIds.size === articles.length ? 'checkbox' : 'square-outline'
              }
              size={20}
              color={
                selectMode && selectedIds.size === articles.length
                  ? colors.primary
                  : colors.textSecondary
              }
            />
            <Text style={[styles.selectionLabel, { color: colors.textSecondary }]}>
              {selectMode
                ? selectedIds.size === articles.length
                  ? t('screens.torrents.deselectAll')
                  : t('screens.torrents.selectAll')
                : t('screens.rss.selectArticles')}
            </Text>
          </TouchableOpacity>
        )}

        {!isConnected ? (
          <EmptyState subtitle={t('toast.notConnected')} />
        ) : isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !feed || articles.length === 0 ? (
          <EmptyState
            icon="newspaper-outline"
            title={t('screens.rss.noArticlesTitle')}
            subtitle={t('screens.rss.noArticlesSubtitle')}
          />
        ) : (
          <FlatList
            data={articles}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void handlePullToRefresh()}
                tintColor={colors.primary}
              />
            }
          />
        )}

        {selectMode && (
          <View
            style={[
              styles.bulkActionsBar,
              { backgroundColor: colors.surface, borderTopColor: colors.surfaceOutline },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.bulkActionButton,
                {
                  backgroundColor: colors.primary,
                  opacity: selectedIds.size === 0 || bulkLoading ? 0.5 : 1,
                },
              ]}
              onPress={() => void handleBulkAddAsTorrent()}
              disabled={selectedIds.size === 0 || bulkLoading}
              activeOpacity={0.8}
            >
              {bulkLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.bulkActionText}>{t('screens.rss.addSelectedAsTorrents')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.bulkActionButtonSecondary,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.surfaceOutline,
                  opacity: selectedIds.size === 0 || bulkLoading ? 0.5 : 1,
                },
              ]}
              onPress={() => void handleBulkMarkRead()}
              disabled={selectedIds.size === 0 || bulkLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done-outline" size={20} color={colors.primary} />
              <Text style={[styles.bulkActionText, { color: colors.primary }]}>
                {t('screens.rss.markSelectedRead')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <ActionMenu
        visible={selectedArticle !== null}
        onClose={() => setSelectedArticle(null)}
        items={actionItems}
        anchor={menuAnchor}
      />
    </>
  );
}

// Simple, non-over-engineered date formatting: parse as a Date and fall back
// to a raw substring if a particular feed's date string doesn't parse.
function formatArticleDate(raw: string): string {
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return raw.slice(0, 16);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h4,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
  },
  selectionLabel: {
    ...typography.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  checkbox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  articleContent: {
    flex: 1,
    gap: 4,
    marginRight: spacing.xs,
  },
  menuButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  articleDate: {
    ...typography.caption,
  },
  articleDescription: {
    ...typography.secondary,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkActionsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    ...shadows.medium,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.large,
  },
  bulkActionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
  },
  bulkActionText: {
    ...typography.smallSemibold,
    color: '#FFFFFF',
  },
});
