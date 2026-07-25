/**
 * feed.tsx — Article list for a single RSS feed.
 *
 * Reached from the feed/folder tree screen via
 * router.push({ pathname: '/settings/rss-feed', params: { path: encodeURIComponent(itemPath) } }) —
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
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';

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

  const feed = useMemo(() => feeds.find((f) => f.path === itemPath)?.feed, [feeds, itemPath]);
  const articles = feed?.articles ?? [];

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

  const handleLongPressArticle = useCallback((article: RssArticle) => {
    haptics.medium();
    setSelectedArticle(article);
  }, []);

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
      router.push({ pathname: '/(tabs)/search', params: { q: article.title } });
    },
    [router],
  );

  const actionItems: ActionMenuItemDef[] = useMemo(() => {
    if (!selectedArticle) return [];
    const items: ActionMenuItemDef[] = [];
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

    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.surfaceOutline }]}
        onPress={() => void handleRowPress(item)}
        onLongPress={() => handleLongPressArticle(item)}
        activeOpacity={0.7}
      >
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
      </TouchableOpacity>
    );
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {headerTitle}
          </Text>
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
        </View>

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
      </SafeAreaView>

      <ActionMenu
        visible={selectedArticle !== null}
        onClose={() => setSelectedArticle(null)}
        items={actionItems}
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
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    gap: 4,
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
});
