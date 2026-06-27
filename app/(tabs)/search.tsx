/**
 * search.tsx — Main "Search" tab.
 *
 * Visually mirrors the Torrents tab: same search row layout, same chip styling,
 * same sort dropdown, and the same surface card rows for results. Wraps
 * qBittorrent's /api/v2/search/* endpoints behind a clean, consistent UI.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Share,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { SearchResultRow } from '@/components/SearchResultRow';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useSearchJob } from '@/hooks/useSearchJob';
import { searchApi } from '@/services/api/search';
import { torrentsApi } from '@/services/api/torrents';
import { storageService } from '@/services/storage';
import { SearchPlugin, SearchResult } from '@/types/api';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { buttonStyles, buttonText } from '@/constants/buttons';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';
import { FEATURES } from '@/constants/features';

const ALL = 'all';
const ENABLED = 'enabled';

type SortKey = 'seeders' | 'size' | 'name' | 'leechers';

const SORT_OPTIONS: Array<{ key: SortKey; labelKey: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'seeders', labelKey: 'screens.search.sortSeeders', icon: 'arrow-up-outline' },
  { key: 'leechers', labelKey: 'screens.search.sortLeechers', icon: 'arrow-down-outline' },
  { key: 'size', labelKey: 'screens.search.sortSize', icon: 'cube-outline' },
  { key: 'name', labelKey: 'screens.search.sortName', icon: 'text-outline' },
];

export default function SearchScreen() {
  // Search is a compile-time feature flag (off by default for App Store builds).
  // Block direct/deep-link navigation when the feature is disabled.
  if (!FEATURES.search) return <Redirect href="/" />;
  return <SearchScreenContent />;
}

function SearchScreenContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isConnected } = useServer();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();

  const {
    jobId,
    status,
    results,
    total,
    isLoading,
    error,
    start,
    stop,
    reset,
  } = useSearchJob();

  const [query, setQuery] = useState('');
  const [plugin, setPlugin] = useState<string>(ENABLED);
  const [category, setCategory] = useState<string>(ALL);
  const [sortBy, setSortBy] = useState<SortKey>('seeders');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [pendingAddUrl, setPendingAddUrl] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<SearchResult | null>(null);

  // Load remembered query/plugin/category once at mount.
  useEffect(() => {
    (async () => {
      try {
        const prefs = await storageService.getPreferences();
        if (prefs.lastSearchQuery) setQuery(prefs.lastSearchQuery);
        if (prefs.lastSearchPlugin) setPlugin(prefs.lastSearchPlugin);
        if (prefs.lastSearchCategory) setCategory(prefs.lastSearchCategory);
      } catch {
        // ignore — defaults are fine
      }
    })();
  }, []);

  const pluginsQuery = useQuery<SearchPlugin[]>({
    queryKey: ['search', 'plugins'],
    queryFn: () => searchApi.getPlugins(),
    enabled: isConnected,
    staleTime: 30_000,
    retry: 1,
  });

  const plugins = useMemo(() => pluginsQuery.data ?? [], [pluginsQuery.data]);
  const noPlugins = !pluginsQuery.isLoading && plugins.length === 0;

  // Sorted plugin list with enabled ones first, used to build the chip row.
  const sortedPlugins = useMemo(() => {
    return [...plugins].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [plugins]);

  // Categories supported by the currently selected plugin.
  const categories = useMemo(() => {
    if (plugin === ALL || plugin === ENABLED) return [];
    const selected = plugins.find((p) => p.name === plugin);
    return selected?.supportedCategories.filter((c) => c.id && c.id !== ALL) || [];
  }, [plugin, plugins]);

  // Sort the live results client-side; qBittorrent's search API doesn't sort.
  const sortedResults = useMemo(() => {
    const sorted = [...results];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'seeders':
          cmp = (a.nbSeeders ?? 0) - (b.nbSeeders ?? 0);
          break;
        case 'leechers':
          cmp = (a.nbLeechers ?? 0) - (b.nbLeechers ?? 0);
          break;
        case 'size':
          cmp = (a.fileSize ?? 0) - (b.fileSize ?? 0);
          break;
        case 'name':
          cmp = (a.fileName || '').localeCompare(b.fileName || '');
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [results, sortBy, sortDirection]);

  // ────────────────────────────────────────────────── actions ──────────────

  const handleSubmit = useCallback(async () => {
    const pattern = query.trim();
    if (!pattern) return;
    if (!isConnected) {
      showToast(t('toast.notConnected'), 'error');
      return;
    }
    // Dismiss the keyboard so results have full screen space.
    Keyboard.dismiss();
    haptics.medium();
    try {
      await start(pattern, plugin, category);
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({
        ...prefs,
        lastSearchQuery: pattern,
        lastSearchPlugin: plugin,
        lastSearchCategory: category,
      });
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    }
  }, [category, isConnected, plugin, query, showToast, start, t]);

  // Route hook errors through the toast system to avoid duplicate UI.
  useEffect(() => {
    if (!error) return;
    if (/409|conflict/i.test(error)) {
      showToast(t('screens.search.serverBusy'), 'error');
    } else if (/404/.test(error)) {
      void reset();
    } else {
      showToast(error, 'error');
    }
  }, [error, reset, showToast, t]);

  const handleAddResult = useCallback(
    async (result: SearchResult) => {
      if (!result.fileUrl) return;
      setPendingAddUrl(result.fileUrl);
      try {
        await torrentsApi.addTorrent(result.fileUrl);
        haptics.success();
        showToast(t('screens.search.addedToast'), 'success');
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      } finally {
        setPendingAddUrl(null);
      }
    },
    [showToast, t],
  );

  const handleLongPressResult = useCallback((result: SearchResult) => {
    haptics.medium();
    setActionResult(result);
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
        showToast(t('screens.search.linkCopied'), 'success');
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

  const handleOpenPlugins = useCallback(() => {
    router.push('/search/plugins');
  }, [router]);

  const onClearQuery = () => {
    setQuery('');
    if (jobId !== null) void reset();
  };

  // Long-press action sheet items
  const actionItems: ActionMenuItemDef[] = useMemo(() => {
    if (!actionResult) return [];
    const items: ActionMenuItemDef[] = [
      {
        label: t('screens.search.addToQueue'),
        icon: 'add-circle-outline',
        onPress: () => void handleAddResult(actionResult),
      },
    ];
    if (actionResult.descrLink) {
      items.push({
        label: t('screens.search.openDescription'),
        icon: 'document-text-outline',
        onPress: () => void handleOpenLink(actionResult.descrLink),
      });
    }
    if (actionResult.siteUrl) {
      items.push({
        label: t('screens.search.openSite'),
        icon: 'globe-outline',
        onPress: () => void handleOpenLink(actionResult.siteUrl),
      });
    }
    if (actionResult.fileUrl) {
      items.push({
        label: t('screens.search.copyLink'),
        icon: 'copy-outline',
        onPress: () => void handleCopyUrl(actionResult.fileUrl),
      });
      items.push({
        label: t('screens.search.shareLink'),
        icon: 'share-outline',
        onPress: () => void handleShareUrl(actionResult.fileUrl),
      });
    }
    return items;
  }, [actionResult, handleAddResult, handleCopyUrl, handleOpenLink, handleShareUrl, t]);

  // ────────────────────────────────────────────────── chip data ───────────

  type PluginChip = { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] };

  const pluginChips: PluginChip[] = useMemo(() => {
    const chips: PluginChip[] = [
      { key: ENABLED, label: t('screens.search.enabledPlugins'), icon: 'checkmark-circle' },
      { key: ALL, label: t('screens.search.allPlugins'), icon: 'apps' },
    ];
    for (const p of sortedPlugins) {
      chips.push({
        key: p.name,
        label: p.enabled ? p.fullName : `${p.fullName} (${t('common.disabled')})`,
        icon: 'extension-puzzle',
      });
    }
    return chips;
  }, [sortedPlugins, t]);

  // ────────────────────────────────────────────────── empty states ────────

  const renderEmptyState = () => {
    if (!isConnected) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="cloud-offline-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('toast.notConnected')}
          </Text>
        </View>
      );
    }
    if (pluginsQuery.isLoading) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (noPlugins) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="extension-puzzle-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('screens.search.noPluginsTitle')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t('screens.search.noPluginsSubtitle')}
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={handleOpenPlugins}
            activeOpacity={0.8}
          >
            <View style={styles.emptyButtonInner}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>{t('screens.search.installPlugins')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }
    if (jobId === null) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('screens.search.tipsTitle')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t('screens.search.tipsBody')}
          </Text>
        </View>
      );
    }
    if (status === 'Stopped' && total === 0) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="file-tray-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('screens.search.noResults')}
          </Text>
        </View>
      );
    }
    if (status === 'Running' && results.length === 0) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('screens.search.runningInitial')}
          </Text>
        </View>
      );
    }
    return null;
  };

  // ────────────────────────────────────────────────── markup ──────────────

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header: search row + filter chip rows + status + sort dropdown.
            Wrapping in TouchableWithoutFeedback lets the user tap any empty
            area in the header (gap between chips, status banner, etc.) to
            dismiss the keyboard without stealing taps from the controls. */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.searchCard}>
          {/* Search row: [42x42 plugins button] [search input] [42x42 submit] */}
          <View style={styles.searchRow}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: showSortMenu ? colors.primaryOpac : colors.background,
                  borderColor: colors.surfaceOutline,
                },
              ]}
              onPress={() => {
                haptics.light();
                setShowSortMenu(!showSortMenu);
              }}
              activeOpacity={0.7}
              accessibilityLabel={t('screens.settings.sortBy')}
            >
              <Ionicons
                name="swap-vertical"
                size={18}
                color={showSortMenu ? colors.primary : colors.text}
              />
            </TouchableOpacity>

            <View
              style={[
                styles.searchInputContainer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.surfaceOutline,
                },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={colors.textSecondary}
                style={styles.searchInputIcon}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('screens.search.placeholder')}
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={handleSubmit}
              />
              {query.length > 0 && !isLoading && (
                <TouchableOpacity
                  onPress={onClearQuery}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              {isLoading && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginLeft: spacing.xs }}
                />
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: query.trim() ? colors.primary : colors.surfaceOutline,
                },
              ]}
              onPress={handleSubmit}
              activeOpacity={0.7}
              disabled={!query.trim()}
            >
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Plugin chip row */}
          <View style={styles.filterRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRowContainer}
            >
              <TouchableOpacity
                style={styles.pluginsCornerButton}
                onPress={handleOpenPlugins}
                activeOpacity={0.7}
                accessibilityLabel={t('screens.search.pluginsTitle')}
              >
                <Ionicons name="extension-puzzle-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {pluginChips.map((chip) => {
                const isActive = plugin === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    style={[
                      styles.filterChip,
                      isActive && shadows.filterActive,
                      {
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderColor: isActive ? colors.primary : colors.surfaceOutline,
                        borderWidth: isActive ? 0 : 0.2,
                      },
                    ]}
                    onPress={() => {
                      haptics.light();
                      setPlugin(chip.key);
                      setCategory(ALL);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={chip.icon}
                      size={14}
                      color={isActive ? '#FFFFFF' : colors.text}
                    />
                    <Text
                      style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : colors.text }]}
                      numberOfLines={1}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Category chip row (only when a specific plugin is selected) */}
          {categories.length > 0 && (
            <View style={styles.filterRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRowContainer}
              >
                <View style={styles.filterRowLabel}>
                  <Ionicons name="folder-outline" size={14} color={colors.textSecondary} />
                </View>
                {[
                  { id: ALL, name: t('screens.search.allCategories') },
                  ...categories,
                ].map((cat) => {
                  const isActive = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.filterChip,
                        isActive && shadows.filterActive,
                        {
                          backgroundColor: isActive ? colors.primary : colors.surface,
                          borderColor: isActive ? colors.primary : colors.surfaceOutline,
                          borderWidth: isActive ? 0 : 0.2,
                        },
                      ]}
                      onPress={() => {
                        haptics.light();
                        setCategory(cat.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : colors.text }]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Running banner + result count */}
          {jobId !== null && (
            <View style={styles.statusBanner}>
              <View style={styles.statusBannerLeft}>
                {status === 'Running' ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.statusBannerText, { color: colors.textSecondary }]}>
                      {t('screens.search.runningCount', { count: total })}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.statusBannerText, { color: colors.textSecondary }]}>
                      {t('screens.search.foundCount', { count: total })}
                    </Text>
                  </>
                )}
              </View>
              {status === 'Running' && (
                <TouchableOpacity
                  style={[
                    styles.stopChip,
                    { backgroundColor: colors.error, borderColor: colors.error },
                  ]}
                  onPress={() => void stop()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="stop" size={12} color="#FFFFFF" />
                  <Text style={[styles.stopChipText, { color: '#FFFFFF' }]}>
                    {t('screens.search.stop')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Sort dropdown — appears when sort icon is toggled */}
          {showSortMenu && (
            <View
              style={[
                styles.sortDropdown,
                {
                  backgroundColor: isDark ? colors.surface : colors.background,
                  borderColor: colors.surfaceOutline,
                },
              ]}
            >
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.sortOption,
                      isActive && {
                        backgroundColor: isDark
                          ? 'rgba(100, 150, 255, 0.15)'
                          : colors.primary,
                      },
                    ]}
                    onPress={() => {
                      haptics.light();
                      if (isActive) {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy(opt.key);
                        setSortDirection(opt.key === 'name' ? 'asc' : 'desc');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={18}
                      color={
                        isActive
                          ? isDark
                            ? colors.primary
                            : '#FFFFFF'
                          : isDark
                          ? colors.textSecondary
                          : colors.text
                      }
                    />
                    <Text
                      style={[
                        styles.sortOptionText,
                        {
                          color: isActive
                            ? isDark
                              ? colors.primary
                              : '#FFFFFF'
                            : isDark
                            ? colors.textSecondary
                            : colors.text,
                          fontWeight: isActive ? '600' : '400',
                        },
                      ]}
                    >
                      {t(opt.labelKey)}
                    </Text>
                    {isActive && (
                      <Ionicons
                        name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={18}
                        color={isDark ? colors.primary : '#FFFFFF'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        </TouchableWithoutFeedback>

        {/* Results list / empty state */}
        {sortedResults.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={sortedResults}
            keyExtractor={(item, idx) => `${item.fileUrl}-${idx}`}
            renderItem={({ item }) => (
              <SearchResultRow
                result={item}
                onAdd={handleAddResult}
                onLongPress={handleLongPressResult}
                onOpenLink={handleOpenLink}
                onCopyUrl={handleCopyUrl}
                isAdding={pendingAddUrl === item.fileUrl}
              />
            )}
            contentContainerStyle={{ paddingBottom: spacing.xxxl, paddingTop: spacing.xs }}
            keyboardShouldPersistTaps="handled"
            // Scrolling or starting a drag on the result list dismisses the keyboard
            // on iOS, matching the system Mail/Messages convention.
            keyboardDismissMode="on-drag"
          />
        )}
      </View>

      <ActionMenu
        visible={actionResult !== null}
        onClose={() => setActionResult(null)}
        items={actionItems}
      />
    </>
  );
}

// ────────────────────────────────────────────────────── styles ────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchCard: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    height: 42,
    borderWidth: 0.5,
    ...shadows.small,
  },
  searchInputIcon: {
    marginRight: spacing.xs + 2,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
  },
  submitButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  filterRowLabel: {
    paddingHorizontal: spacing.xs,
  },
  pluginsCornerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  filterChip: {
    ...buttonStyles.chip,
    maxWidth: 180,
  },
  filterChipText: {
    ...buttonText.chip,
    letterSpacing: 0.2,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs + 2,
  },
  statusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: 1,
  },
  statusBannerText: {
    ...typography.caption,
  },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 0.5,
  },
  stopChipText: {
    ...typography.captionSemibold,
  },
  sortDropdown: {
    marginTop: spacing.xs,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    paddingVertical: spacing.xs,
    ...shadows.medium,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  sortOptionText: {
    flex: 1,
    fontSize: 15,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.secondary,
    textAlign: 'center',
  },
  emptyButton: {
    ...buttonStyles.primary,
    marginTop: spacing.sm,
  },
  emptyButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyButtonText: {
    ...buttonText.primary,
  },
});
