/**
 * app/rss/index.tsx — RSS feed & folder tree.
 *
 * Lists every folder/feed in qBittorrent's RSS tree as a flat, indented list
 * (folders start collapsed; tapping toggles expansion). Long-pressing a row
 * opens an ActionMenu for that item (new subfolder/add feed/rename/move/
 * remove, plus refresh/mark-all-read for feeds). Tapping a feed pushes the
 * article-list screen at /rss/feed. The auto-download rules screen is one
 * tap away via the header's funnel button.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { InputModal } from '@/components/InputModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useServer } from '@/context/ServerContext';
import { useRssFeeds } from '@/hooks/useRssFeeds';
import { RssFeed, RssItemsResponse } from '@/types/api';
import { isRssFeed, joinRssPath, parentRssPath, rssPathBaseName } from '@/utils/rss';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';

type Row =
  | { kind: 'folder'; path: string; depth: number }
  | { kind: 'feed'; path: string; feed: RssFeed; depth: number };

type PendingInput =
  | { kind: 'addRootFeed' }
  | { kind: 'addRootFolder' }
  | { kind: 'newSubfolder'; parentPath: string }
  | { kind: 'addFeedHere'; parentPath: string }
  | { kind: 'rename'; path: string };

type PendingRemove = { kind: 'folder' | 'feed'; path: string };
type PendingMove = { kind: 'folder' | 'feed'; path: string };
type MenuTarget = { kind: 'folder' | 'feed'; path: string };

function getUrlHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function buildRows(
  tree: RssItemsResponse,
  expandedFolders: Set<string>,
  parentPath = '',
  depth = 0,
): Row[] {
  const rows: Row[] = [];
  for (const [name, node] of Object.entries(tree)) {
    const path = joinRssPath(parentPath, name);
    if (isRssFeed(node)) {
      rows.push({ kind: 'feed', path, feed: node, depth });
    } else {
      rows.push({ kind: 'folder', path, depth });
      if (expandedFolders.has(path)) {
        rows.push(...buildRows(node as RssItemsResponse, expandedFolders, path, depth + 1));
      }
    }
  }
  return rows;
}

export default function RssFeedsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const { isConnected } = useServer();
  const {
    tree,
    folders,
    feeds,
    isLoading,
    refresh,
    addFolder,
    addFeed,
    removeItem,
    moveItem,
    refreshItem,
    markAsRead,
  } = useRssFeeds();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>();
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const rows = useMemo(() => buildRows(tree, expandedFolders), [tree, expandedFolders]);

  const toggleFolder = useCallback((path: string) => {
    haptics.selection();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handlePullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const expandFolder = useCallback((path: string) => {
    if (!path) return;
    setExpandedFolders((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────── mutations ───────

  const handleRefreshFeed = useCallback(
    async (path: string) => {
      setBusyPath(path);
      try {
        await refreshItem(path);
        haptics.success();
        showToast(t('screens.rss.feedRefreshedToast'), 'success');
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      } finally {
        setBusyPath(null);
      }
    },
    [refreshItem, showToast, t],
  );

  const handleMarkAllRead = useCallback(
    async (path: string) => {
      setBusyPath(path);
      try {
        await markAsRead(path);
        haptics.success();
        showToast(t('screens.rss.markAllRead'), 'success');
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      } finally {
        setBusyPath(null);
      }
    },
    [markAsRead, showToast, t],
  );

  const handleCopyFeedUrl = useCallback(
    async (path: string) => {
      const url = feeds.find((f) => f.path === path)?.feed.url;
      if (!url) return;
      try {
        await Clipboard.setStringAsync(url);
        haptics.light();
        showToast(t('screens.rss.linkCopiedToast'), 'success');
      } catch {
        // ignore — clipboard write rarely fails
      }
    },
    [feeds, showToast, t],
  );

  const handleRefreshAll = useCallback(async () => {
    if (feeds.length === 0) return;
    setRefreshingAll(true);
    try {
      const results = await Promise.allSettled(feeds.map((f) => refreshItem(f.path)));
      await refresh();
      const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (firstFailure) {
        haptics.error();
        showToast(getErrorMessage(firstFailure.reason), 'error');
      } else {
        haptics.success();
        showToast(t('screens.rss.allFeedsRefreshedToast'), 'success');
      }
    } finally {
      setRefreshingAll(false);
    }
  }, [feeds, refreshItem, refresh, showToast, t]);

  const handleInputConfirm = useCallback(
    async (rawValue: string) => {
      const pending = pendingInput;
      setPendingInput(null);
      if (!pending) return;
      try {
        switch (pending.kind) {
          case 'addRootFeed':
            await addFeed(rawValue, '');
            haptics.success();
            showToast(t('screens.rss.feedAddedToast'), 'success');
            break;
          case 'addRootFolder':
            await addFolder(rawValue);
            haptics.success();
            showToast(t('screens.rss.folderAddedToast'), 'success');
            break;
          case 'newSubfolder':
            await addFolder(joinRssPath(pending.parentPath, rawValue));
            haptics.success();
            showToast(t('screens.rss.folderAddedToast'), 'success');
            expandFolder(pending.parentPath);
            break;
          case 'addFeedHere':
            await addFeed(rawValue, pending.parentPath);
            haptics.success();
            showToast(t('screens.rss.feedAddedToast'), 'success');
            expandFolder(pending.parentPath);
            break;
          case 'rename': {
            const newPath = joinRssPath(parentRssPath(pending.path), rawValue);
            setBusyPath(pending.path);
            await moveItem(pending.path, newPath);
            haptics.success();
            showToast(t('screens.rss.itemRenamedToast'), 'success');
            break;
          }
        }
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      } finally {
        setBusyPath(null);
      }
    },
    [pendingInput, addFeed, addFolder, moveItem, expandFolder, showToast, t],
  );

  const handleConfirmRemove = useCallback(async () => {
    const pending = pendingRemove;
    setPendingRemove(null);
    if (!pending) return;
    setBusyPath(pending.path);
    try {
      await removeItem(pending.path);
      haptics.success();
      showToast(t('screens.rss.itemRemovedToast'), 'success');
    } catch (err: unknown) {
      haptics.error();
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusyPath(null);
    }
  }, [pendingRemove, removeItem, showToast, t]);

  const handleMoveSelect = useCallback(
    async (destFolder: string) => {
      const pending = pendingMove;
      setPendingMove(null);
      if (!pending) return;
      const newPath = joinRssPath(destFolder, rssPathBaseName(pending.path));
      if (newPath === pending.path) return;
      setBusyPath(pending.path);
      try {
        await moveItem(pending.path, newPath);
        haptics.success();
        showToast(t('screens.rss.itemMovedToast'), 'success');
        if (destFolder) expandFolder(destFolder);
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      } finally {
        setBusyPath(null);
      }
    },
    [pendingMove, moveItem, expandFolder, showToast, t],
  );

  // ─────────────────────────────────────────────────────── row actions ───────

  const handleOpenFeed = useCallback(
    (path: string) => {
      router.push({ pathname: '/rss/feed', params: { path: encodeURIComponent(path) } });
    },
    [router],
  );

  const openFolderMenu = useCallback((path: string, anchor?: { x: number; y: number }) => {
    setMenuAnchor(anchor);
    setMenuTarget({ kind: 'folder', path });
  }, []);

  const openFeedMenu = useCallback((path: string, anchor?: { x: number; y: number }) => {
    setMenuAnchor(anchor);
    setMenuTarget({ kind: 'feed', path });
  }, []);

  // ─────────────────────────────────────────────────────── derived UI ───────

  const menuItems = useMemo<ActionMenuItemDef[]>(() => {
    if (!menuTarget) return [];
    const { kind, path } = menuTarget;
    if (kind === 'folder') {
      return [
        {
          label: t('screens.rss.newSubfolder'),
          icon: 'folder-outline',
          onPress: () => setPendingInput({ kind: 'newSubfolder', parentPath: path }),
        },
        {
          label: t('screens.rss.addFeedHere'),
          icon: 'add-circle-outline',
          onPress: () => setPendingInput({ kind: 'addFeedHere', parentPath: path }),
        },
        {
          label: t('screens.rss.rename'),
          icon: 'pencil-outline',
          onPress: () => setPendingInput({ kind: 'rename', path }),
        },
        {
          label: t('screens.rss.move'),
          icon: 'swap-horizontal-outline',
          onPress: () => setPendingMove({ kind: 'folder', path }),
        },
        {
          label: t('common.delete'),
          icon: 'trash-outline',
          destructive: true,
          onPress: () => setPendingRemove({ kind: 'folder', path }),
        },
      ];
    }
    return [
      {
        label: t('screens.rss.refresh'),
        icon: 'refresh-outline',
        onPress: () => void handleRefreshFeed(path),
      },
      {
        label: t('screens.rss.copyLink'),
        icon: 'copy-outline',
        onPress: () => void handleCopyFeedUrl(path),
      },
      {
        label: t('screens.rss.rename'),
        icon: 'pencil-outline',
        onPress: () => setPendingInput({ kind: 'rename', path }),
      },
      {
        label: t('screens.rss.move'),
        icon: 'swap-horizontal-outline',
        onPress: () => setPendingMove({ kind: 'feed', path }),
      },
      {
        label: t('screens.rss.markAllRead'),
        icon: 'checkmark-done-outline',
        onPress: () => void handleMarkAllRead(path),
      },
      {
        label: t('common.delete'),
        icon: 'trash-outline',
        destructive: true,
        onPress: () => setPendingRemove({ kind: 'feed', path }),
      },
    ];
  }, [menuTarget, t, handleRefreshFeed, handleCopyFeedUrl, handleMarkAllRead]);

  const inputModalConfig = useMemo(() => {
    if (!pendingInput) return null;
    switch (pendingInput.kind) {
      case 'addRootFeed':
      case 'addFeedHere':
        return {
          title: t('screens.rss.addFeedPrompt'),
          message: t('screens.rss.addFeedHint'),
          placeholder: t('screens.rss.addFeedPlaceholder'),
          defaultValue: undefined as string | undefined,
        };
      case 'addRootFolder':
      case 'newSubfolder':
        return {
          title: t('screens.rss.addFolderPrompt'),
          message: t('screens.rss.addFolderHint'),
          placeholder: t('screens.rss.addFolderPlaceholder'),
          defaultValue: undefined as string | undefined,
        };
      case 'rename':
        return {
          title: t('screens.rss.renamePrompt'),
          message: t('screens.rss.renameHint'),
          placeholder: undefined as string | undefined,
          defaultValue: rssPathBaseName(pendingInput.path),
        };
    }
  }, [pendingInput, t]);

  const moveOptions = useMemo<OptionPickerItem[]>(() => {
    if (!pendingMove) return [];
    const options: OptionPickerItem[] = [{ label: t('screens.rss.moveToRoot'), value: '' }];
    for (const folder of folders) {
      if (pendingMove.kind === 'folder') {
        if (folder === pendingMove.path || folder.startsWith(`${pendingMove.path}\\`)) continue;
      }
      options.push({ label: folder, value: folder });
    }
    return options;
  }, [pendingMove, folders, t]);

  const removeConfirmConfig = useMemo(() => {
    if (!pendingRemove) return null;
    return pendingRemove.kind === 'folder'
      ? { title: t('alerts.deleteFolder'), message: t('alerts.deleteFolderMessage') }
      : { title: t('alerts.deleteFeed'), message: t('alerts.deleteFeedMessage') };
  }, [pendingRemove, t]);

  const showEmpty = !isLoading && isConnected && rows.length === 0;

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <View style={styles.headerButton} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('screens.rss.feedsTitle')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => setPendingInput({ kind: 'addRootFeed' })}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{t('screens.rss.addFeed')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
            ]}
            onPress={() => setPendingInput({ kind: 'addRootFolder' })}
            activeOpacity={0.7}
          >
            <Ionicons name="folder-outline" size={18} color={colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {t('screens.rss.addFolder')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.surfaceOutline,
                opacity: refreshingAll ? 0.5 : 1,
              },
            ]}
            onPress={() => void handleRefreshAll()}
            disabled={refreshingAll}
            activeOpacity={0.7}
          >
            {refreshingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.primary} />
            )}
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {t('screens.rss.refreshAll')}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !isConnected ? (
          <EmptyState subtitle={t('toast.notConnected')} />
        ) : showEmpty ? (
          <EmptyState
            icon="logo-rss"
            iconSize={56}
            title={t('screens.rss.noFeedsTitle')}
            subtitle={t('screens.rss.noFeedsSubtitle')}
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(row) => `${row.kind}:${row.path}`}
            style={{ backgroundColor: colors.background }}
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
            renderItem={({ item }) =>
              item.kind === 'folder' ? (
                <FolderRow
                  path={item.path}
                  depth={item.depth}
                  isExpanded={expandedFolders.has(item.path)}
                  isBusy={busyPath === item.path}
                  colors={colors}
                  onToggle={() => toggleFolder(item.path)}
                  onLongPress={(anchor) => openFolderMenu(item.path, anchor)}
                  onMenuPress={(anchor) => openFolderMenu(item.path, anchor)}
                />
              ) : (
                <FeedRow
                  feed={item.feed}
                  depth={item.depth}
                  isBusy={busyPath === item.path}
                  colors={colors}
                  onPress={() => handleOpenFeed(item.path)}
                  onLongPress={(anchor) => openFeedMenu(item.path, anchor)}
                  onMenuPress={(anchor) => openFeedMenu(item.path, anchor)}
                />
              )
            }
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
        visible={menuTarget !== null}
        onClose={() => setMenuTarget(null)}
        items={menuItems}
        anchor={menuAnchor}
      />

      <InputModal
        visible={pendingInput !== null}
        title={inputModalConfig?.title ?? ''}
        message={inputModalConfig?.message}
        placeholder={inputModalConfig?.placeholder}
        defaultValue={inputModalConfig?.defaultValue}
        onCancel={() => setPendingInput(null)}
        onConfirm={(value) => void handleInputConfirm(value)}
      />

      <ConfirmModal
        visible={pendingRemove !== null}
        title={removeConfirmConfig?.title ?? ''}
        message={removeConfirmConfig?.message}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPendingRemove(null)}
        buttons={[
          {
            label: t('common.delete'),
            destructive: true,
            onPress: () => void handleConfirmRemove(),
          },
        ]}
      />

      <OptionPicker
        visible={pendingMove !== null}
        title={t('screens.rss.moveTitle')}
        options={moveOptions}
        selectedValue={pendingMove ? parentRssPath(pendingMove.path) : undefined}
        onSelect={(value) => void handleMoveSelect(value)}
        onClose={() => setPendingMove(null)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────── row components ───────

type Anchor = { x: number; y: number };

interface FolderRowProps {
  path: string;
  depth: number;
  isExpanded: boolean;
  isBusy: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  onToggle: () => void;
  onLongPress: (anchor: Anchor) => void;
  onMenuPress: (anchor: Anchor) => void;
}

function FolderRow({
  path,
  depth,
  isExpanded,
  isBusy,
  colors,
  onToggle,
  onLongPress,
  onMenuPress,
}: FolderRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        { paddingLeft: spacing.lg + depth * spacing.lg, opacity: isBusy ? 0.5 : 1 },
      ]}
      onPress={onToggle}
      onLongPress={(e) => onLongPress({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
      disabled={isBusy}
      activeOpacity={0.6}
    >
      <Ionicons
        name={isExpanded ? 'chevron-down' : 'chevron-forward'}
        size={16}
        color={colors.textSecondary}
        style={styles.chevron}
      />
      <Ionicons name="folder" size={20} color={colors.primary} style={styles.rowIcon} />
      <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>
        {rssPathBaseName(path)}
      </Text>
      {isBusy && <ActivityIndicator size="small" color={colors.primary} />}
      <TouchableOpacity
        onPress={(e) => onMenuPress({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
        hitSlop={8}
        style={styles.menuButton}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface FeedRowProps {
  feed: RssFeed;
  depth: number;
  isBusy: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
  onLongPress: (anchor: Anchor) => void;
  onMenuPress: (anchor: Anchor) => void;
}

function FeedRow({ feed, depth, isBusy, colors, onPress, onLongPress, onMenuPress }: FeedRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        { paddingLeft: spacing.lg + depth * spacing.lg, opacity: isBusy ? 0.5 : 1 },
      ]}
      onPress={onPress}
      onLongPress={(e) => onLongPress({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
      disabled={isBusy}
      activeOpacity={0.6}
    >
      <View style={styles.rowIcon}>
        {feed.isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name="logo-rss"
            size={18}
            color={feed.hasError ? colors.error : colors.primary}
          />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowTitle, { color: feed.hasError ? colors.error : colors.text }]}
          numberOfLines={1}
        >
          {feed.title || feed.url}
        </Text>
        {feed.title ? (
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {getUrlHost(feed.url)}
          </Text>
        ) : null}
      </View>
      {isBusy && <ActivityIndicator size="small" color={colors.primary} />}
      <TouchableOpacity
        onPress={(e) => onMenuPress({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
        hitSlop={8}
        style={styles.menuButton}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
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
  headerTitle: {
    ...typography.h4,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  primaryButton: {
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chevron: {
    width: 16,
  },
  rowIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.bodyMedium,
  },
  rowSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  menuButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
});
