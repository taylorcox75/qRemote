/**
 * search.tsx — Main "Search" tab.
 *
 * Visually mirrors the Torrents tab: same search row layout, same chip styling,
 * same sort dropdown, and the same surface card rows for results. Wraps
 * qBittorrent's /api/v2/search/* endpoints behind a clean, consistent UI.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { SearchResultRow } from '@/components/SearchResultRow';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { useApiFeatures } from '@/context/ApiVersionContext';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useSearchJob } from '@/hooks/useSearchJob';
import { searchApi } from '@/services/api/search';
import { torrentsApi } from '@/services/api/torrents';
import { storageService } from '@/services/storage';
import { SearchPlugin, SearchResult } from '@/types/api';
import { siteHost, resultTrackerLabel } from '@/utils/searchResult';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { buttonStyles, buttonText } from '@/constants/buttons';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';

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
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { isConnected } = useServer();
  const { features } = useApiFeatures();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const queryInputRef = useRef<TextInput>(null);

  // Scroll-to-collapse header, matching the Torrents tab's pattern: the
  // header floats absolutely above the list and slides off-screen on scroll
  // down, back in on scroll up (or near the top). headerHeight is measured
  // via onLayout rather than hardcoded like Torrents' — this header's height
  // varies a lot more (category/indexer rows and the sort dropdown are all
  // conditional), so a fixed guess would leave gaps or clip content.
  const [headerHeight, setHeaderHeight] = useState(0);
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderVisible = useRef(true);
  const isAnimating = useRef(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const scrollDifference = currentScrollY - lastScrollY.current;

      // Larger "hug the top" zone than a bare scroll-to-zero check, so the
      // header stays put through small bounces/overscroll near the top
      // instead of snapping open and shut.
      if (currentScrollY <= 30) {
        if (!isHeaderVisible.current) {
          isHeaderVisible.current = true;
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start();
        }
        lastScrollY.current = currentScrollY;
        return;
      }

      // Middle ground between too twitchy (15 — collapsed on any incidental
      // touch drift) and too sluggish (40 — needed several cards of scroll
      // before reacting, since this compares per-event deltas which
      // scrollEventThrottle already batches).
      const minMovement = 22;
      if (Math.abs(scrollDifference) < minMovement || isAnimating.current) {
        lastScrollY.current = currentScrollY;
        return;
      }

      if (scrollDifference < -minMovement && !isHeaderVisible.current) {
        isAnimating.current = true;
        isHeaderVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          isAnimating.current = false;
        });
      } else if (scrollDifference > minMovement && isHeaderVisible.current) {
        isAnimating.current = true;
        isHeaderVisible.current = false;
        Animated.timing(headerTranslateY, {
          toValue: -(headerHeight || 300),
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          isAnimating.current = false;
        });
      }

      lastScrollY.current = currentScrollY;
    },
    [headerHeight, headerTranslateY],
  );

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
  const [plugin, setPlugin] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [selectedTrackers, setSelectedTrackers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>('seeders');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [pendingAddUrl, setPendingAddUrl] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<SearchResult | null>(null);

  // Load remembered plugin/category once at mount. The query text itself is
  // deliberately NOT restored — it should reset on a fresh app launch, and
  // React state already keeps it intact when just switching tabs within the
  // same running session (this screen stays mounted, it doesn't remount).
  useEffect(() => {
    (async () => {
      try {
        const prefs = await storageService.getPreferences();
        if (prefs.lastSearchPlugin) setPlugin(prefs.lastSearchPlugin);
        if (prefs.lastSearchCategory) setCategory(prefs.lastSearchCategory);
      } catch {
        // ignore — defaults are fine
      }
    })();
  }, []);

  // Re-tapping the already-active Search tab focuses the query input and
  // opens the keyboard. `tabPress` fires on this tab's own navigation
  // whenever its icon is tapped, whether switching to it or not — checking
  // isFocused() at that moment is what distinguishes "already here, tapped
  // again" (true) from "switching in from another tab" (false).
  useEffect(() => {
    // useNavigation()'s generic return type doesn't know about the
    // bottom-tabs navigator's "tabPress" event — narrow just enough to
    // register the listener without pulling in @react-navigation types
    // directly (expo-router discourages that as of SDK 56+).
    const tabsNavigation = navigation as unknown as {
      addListener: (event: 'tabPress', callback: () => void) => () => void;
    };
    const unsubscribe = tabsNavigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        queryInputRef.current?.focus();
      }
    });
    return unsubscribe;
  }, [navigation]);

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

  // Categories supported by the currently selected plugin. When searching
  // across every plugin (ALL, or the legacy ENABLED value some users may
  // still have persisted), fall back to the union of every installed
  // plugin's categories, deduped by id — qBittorrent's category filter is
  // still valid to apply across plugins/indexers, it just isn't limited to
  // one plugin's specific list in that case.
  const categories = useMemo(() => {
    if (plugin === ALL || plugin === ENABLED) {
      const seen = new Map<string, { id: string; name: string }>();
      for (const p of plugins) {
        for (const c of p.supportedCategories) {
          if (c.id && c.id !== ALL && !seen.has(c.id)) {
            seen.set(c.id, c);
          }
        }
      }
      return [...seen.values()];
    }
    const selected = plugins.find((p) => p.name === plugin);
    return selected?.supportedCategories.filter((c) => c.id && c.id !== ALL) || [];
  }, [plugin, plugins]);

  // Aggregator/bridge plugins (Prowlarr, Jackett) proxy every result through
  // one qBittorrent plugin entry, so siteUrl is identical across the whole
  // batch — in that case the real per-result indexer name lives in a
  // bracketed tag in the title instead (see resultTrackerLabel).
  //
  // LATCHED for the lifetime of a search: once a batch looks aggregated it
  // stays aggregated even if a later poll adds a result from a second host
  // (e.g. a direct plugin alongside Prowlarr). Flipping mid-search would
  // relabel every chip from bracket-tag to hostname, orphaning any labels
  // the user already selected in selectedTrackers and silently filtering
  // out everything. Non-aggregated results without a bracket tag still fall
  // back to their hostname label inside resultTrackerLabel, so latching
  // stays correct for mixed batches. Reset alongside selectedTrackers on
  // each new search (handleSubmit / onClearQuery).
  const [isAggregatedSource, setIsAggregatedSource] = useState(false);
  useEffect(() => {
    if (isAggregatedSource || results.length < 2) return;
    const hosts = new Set(results.map((r) => siteHost(r.siteUrl)).filter(Boolean));
    if (hosts.size <= 1) setIsAggregatedSource(true);
  }, [results, isAggregatedSource]);

  // Tracker chips derived from whatever results have come back so far — this
  // naturally grows as more plugins/indexers report in during a running
  // search, since it's recomputed from `results` on every poll tick.
  const availableTrackers = useMemo(() => {
    const labels = new Set<string>();
    for (const r of results) {
      const label = resultTrackerLabel(r, isAggregatedSource);
      if (label) labels.add(label);
    }
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [results, isAggregatedSource]);

  const toggleTracker = useCallback((host: string) => {
    haptics.light();
    setSelectedTrackers((prev) => {
      const next = new Set(prev);
      if (next.has(host)) {
        next.delete(host);
      } else {
        next.add(host);
      }
      return next;
    });
  }, []);

  // Sort the live results client-side; qBittorrent's search API doesn't sort.
  // De-duplicate by fileUrl first so the list keyExtractor can rely on a
  // stable, unique key instead of the array index.
  const sortedResults = useMemo(() => {
    const seenUrls = new Set<string>();
    const deduped = results.filter((r) => {
      if (seenUrls.has(r.fileUrl)) return false;
      seenUrls.add(r.fileUrl);
      return true;
    });
    // Empty selection means "no tracker filter" — show everything.
    const filtered =
      selectedTrackers.size === 0
        ? deduped
        : deduped.filter((r) => selectedTrackers.has(resultTrackerLabel(r, isAggregatedSource)));
    filtered.sort((a, b) => {
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
    return filtered;
  }, [results, selectedTrackers, isAggregatedSource, sortBy, sortDirection]);

  // The FlatList unmounts whenever the (filtered) result set is empty — the
  // empty state has no scrollable surface, so no onScroll event could ever
  // fire to bring a collapsed header back. Restore it explicitly here, or a
  // filter that matches nothing leaves the search bar and every filter chip
  // stranded off-screen with no way to recover.
  useEffect(() => {
    if (sortedResults.length === 0 && !isHeaderVisible.current) {
      isHeaderVisible.current = true;
      lastScrollY.current = 0;
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [sortedResults.length, headerTranslateY]);

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
      setSelectedTrackers(new Set());
      setIsAggregatedSource(false);
      await start(pattern, plugin, category);
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({
        ...prefs,
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
    } else if (/404|endpoint not found/i.test(error)) {
      // The search job expired or was cleaned up server-side — apiClient
      // rewrites 404s into an "Endpoint not found: <url>" message with no
      // literal status code in it, so match that text too, not just "404".
      void reset();
    } else {
      showToast(error, 'error');
    }
  }, [error, reset, showToast, t]);

  // Toast once when a search naturally finishes (Running -> Stopped with
  // results). Tracking the previous status avoids re-firing while status
  // stays 'Stopped', and a manual reset() sets status back to null rather
  // than 'Stopped', so it doesn't trigger this. Skipped when total is 0 —
  // the empty state already communicates "no results" without a toast on
  // top of it.
  const prevStatusRef = useRef<typeof status>(null);
  useEffect(() => {
    if (prevStatusRef.current === 'Running' && status === 'Stopped' && total > 0) {
      showToast(t('screens.search.foundCount', { count: total }), 'success');
    }
    prevStatusRef.current = status;
  }, [status, total, showToast, t]);

  const handleAddResult = useCallback(
    async (result: SearchResult) => {
      if (!result.fileUrl) return;
      setPendingAddUrl(result.fileUrl);
      try {
        // Non-magnet result URLs from direct tracker plugins often need the
        // plugin's context to resolve (login cookies, magnet extraction from
        // an HTML page, …) — delegate those to search/downloadTorrent
        // (qBit 5.0+) so the owning plugin fetches server-side, the way
        // qBittorrent's own WebUI adds results. Aggregator (Prowlarr/Jackett)
        // URLs are the exception: they carry their own apikey, and their
        // download links often answer with a redirect straight to a magnet
        // URI — qBittorrent CORE follows that fine via torrents/add, while
        // the Python search plugins choke on the non-HTTP redirect.
        const isMagnet = result.fileUrl.trim().toLowerCase().startsWith('magnet:');
        if (
          !isMagnet &&
          !isAggregatedSource &&
          features.supportsSearchDownloadTorrent &&
          result.engineName
        ) {
          await searchApi.downloadTorrent(result.fileUrl, result.engineName);
        } else {
          await torrentsApi.addTorrent(result.fileUrl);
        }
        haptics.success();
        showToast(t('screens.search.addedToast'), 'success');
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      } finally {
        setPendingAddUrl(null);
      }
    },
    [features.supportsSearchDownloadTorrent, isAggregatedSource, showToast, t],
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
    setSelectedTrackers(new Set());
    setIsAggregatedSource(false);
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
        <EmptyState
          style={{ backgroundColor: colors.background }}
          icon="cloud-offline-outline"
          title={t('toast.notConnected')}
        />
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
        <EmptyState
          style={{ backgroundColor: colors.background }}
          icon="extension-puzzle-outline"
          title={t('screens.search.noPluginsTitle')}
          subtitle={t('screens.search.noPluginsSubtitle')}
          actionLabel={t('screens.search.installPlugins')}
          actionIcon="add"
          onAction={handleOpenPlugins}
        />
      );
    }
    if (jobId === null) {
      return (
        <EmptyState
          style={{ backgroundColor: colors.background }}
          icon="search-outline"
          title={t('screens.search.tipsTitle')}
          subtitle={t('screens.search.tipsBody')}
        />
      );
    }
    if (results.length > 0 && selectedTrackers.size > 0) {
      // Raw results exist, but the tracker filter excludes all of them.
      return (
        <EmptyState
          style={{ backgroundColor: colors.background }}
          icon="funnel-outline"
          title={t('screens.search.noTrackerResults')}
          actionLabel={t('screens.search.allTrackers')}
          actionIcon="close-circle-outline"
          onAction={() => setSelectedTrackers(new Set())}
        />
      );
    }
    if (status === 'Stopped' && total === 0) {
      return (
        <EmptyState
          style={{ backgroundColor: colors.background }}
          icon="file-tray-outline"
          title={t('screens.search.noResults')}
        />
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
            Floats absolutely above the list and slides away on scroll (see
            handleScroll). Wrapping in TouchableWithoutFeedback lets the user
            tap any empty area in the header (gap between chips, status
            banner, etc.) to dismiss the keyboard without stealing taps from
            the controls. */}
        <Animated.View
          style={[
            styles.headerContainer,
            { transform: [{ translateY: headerTranslateY }] },
          ]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.searchCard, { backgroundColor: colors.background }]}>
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
                ref={queryInputRef}
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
                  accessibilityLabel={t('common.clearSearch')}
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
              accessibilityLabel={t('screens.search.tabTitle')}
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
                  <FilterChip
                    key={chip.key}
                    label={chip.label}
                    icon={chip.icon}
                    active={isActive}
                    numberOfLines={1}
                    style={styles.filterChip}
                    textStyle={styles.filterChipText}
                    onPress={() => {
                      haptics.light();
                      setPlugin(chip.key);
                      setCategory(ALL);
                    }}
                  />
                );
              })}
            </ScrollView>
          </View>

          {/* Tracker/indexer chip row — populates as results stream in, so it
              grows while a search is still running (each plugin/indexer
              reports at its own pace). Multi-select: toggling a chip filters
              already-fetched results client-side, it does not re-run the
              search. Rendered above Category since it's independent of which
              plugin is selected. */}
          {availableTrackers.length > 1 && (
            <View style={styles.filterRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRowContainer}
              >
                <View style={styles.filterRowLabel}>
                  <Ionicons name="globe-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.filterRowLabelText, { color: colors.textSecondary }]}>
                    {t('screens.search.indexerLabel')}
                  </Text>
                </View>
                <FilterChip
                  label={t('screens.search.allTrackers')}
                  active={selectedTrackers.size === 0}
                  numberOfLines={1}
                  style={styles.filterChip}
                  textStyle={styles.filterChipText}
                  onPress={() => {
                    haptics.light();
                    setSelectedTrackers(new Set());
                  }}
                />
                {availableTrackers.map((host) => (
                  <FilterChip
                    key={host}
                    label={host}
                    active={selectedTrackers.has(host)}
                    numberOfLines={1}
                    style={styles.filterChip}
                    textStyle={styles.filterChipText}
                    onPress={() => toggleTracker(host)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

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
                  <Text style={[styles.filterRowLabelText, { color: colors.textSecondary }]}>
                    {t('screens.search.categoryLabel')}
                  </Text>
                </View>
                {[
                  { id: ALL, name: t('screens.search.allCategories') },
                  ...categories,
                ].map((cat) => {
                  const isActive = category === cat.id;
                  return (
                    <FilterChip
                      key={cat.id}
                      label={cat.name}
                      active={isActive}
                      numberOfLines={1}
                      style={styles.filterChip}
                      textStyle={styles.filterChipText}
                      onPress={() => {
                        haptics.light();
                        setCategory(cat.id);
                      }}
                    />
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
                        backgroundColor: isDark ? colors.primaryOpac : colors.primary,
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
                      setShowSortMenu(false);
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
        </Animated.View>

        {/* Results list / empty state */}
        {sortedResults.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={sortedResults}
            keyExtractor={(item) => item.fileUrl}
            renderItem={({ item }) => (
              <SearchResultRow
                result={item}
                isAggregatedSource={isAggregatedSource}
                onAdd={handleAddResult}
                onLongPress={handleLongPressResult}
                onOpenLink={handleOpenLink}
                onCopyUrl={handleCopyUrl}
                isAdding={pendingAddUrl === item.fileUrl}
              />
            )}
            contentContainerStyle={{ paddingBottom: spacing.xxxl, paddingTop: headerHeight + spacing.xs }}
            onScroll={handleScroll}
            scrollEventThrottle={50}
            keyboardShouldPersistTaps="handled"
            // Scrolling or starting a drag on the result list dismisses the keyboard
            // on iOS, matching the system Mail/Messages convention.
            keyboardDismissMode="on-drag"
            removeClippedSubviews={false}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={10}
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
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
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
    marginTop: spacing.xs,
  },
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  filterRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  filterRowLabelText: {
    ...typography.captionSemibold,
    letterSpacing: 0.2,
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
  // True floating popup anchored under the sort button (left side of the
  // search row: 8 card padding + 42 button + 4 gap), overlaying the chip
  // rows instead of sitting inline below them — matches the Torrents tab.
  sortDropdown: {
    position: 'absolute',
    top: 54,
    left: spacing.md,
    minWidth: 200,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    ...shadows.large,
    zIndex: 1000,
    overflow: 'hidden',
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
  emptySubtitle: {
    ...typography.secondary,
    textAlign: 'center',
  },
});
