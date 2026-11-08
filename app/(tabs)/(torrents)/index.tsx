/**
 * index.tsx — Main torrents list screen (Torrents tab).
 * Nested under (tabs)/(torrents)/ with torrent detail so the tab bar stays visible.
 *
 * Key exports: TorrentsScreen (default)
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  InteractionManager,
  GestureResponderEvent,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTorrents } from '@/context/TorrentContext';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { TorrentInfo, ServerConfig } from '@/types/api';
import { TorrentCard } from '@/components/TorrentCard';
import { SkeletonTorrentCard } from '@/components/SkeletonLoader';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';
import { InputModal } from '@/components/InputModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { SearchHistoryDropdown } from '@/components/SearchHistoryDropdown';
import { SwipeActionsPanel } from '@/components/SwipeActionsPanel';
import { torrentsApi } from '@/services/api/torrents';
import { searchApi } from '@/services/api/search';
import { applicationApi } from '@/services/api/application';
import { apiClient } from '@/services/api/client';
import { storageService } from '@/services/storage';
import { ExpandedCardField, DEFAULT_PREFERENCES } from '@/types/preferences';
import { ServerManager } from '@/services/server-manager';
import { getPauseOnAddPreferenceKey } from '@/utils/apiVersion';
import { getPrefilledDownloader, planPluginUrlAdd, PrefilledPlugin } from '@/utils/search-download';
import { formatSpeed, kbToBytes } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { shadows } from '@/constants/shadows';
import { spacing, borderRadius } from '@/constants/spacing';
import { buttonStyles, buttonText } from '@/constants/buttons';
import { typography } from '@/constants/typography';
import { QuickConnectPanel } from '@/components/QuickConnectPanel';
import { ServerSwitcherModal } from '@/components/ServerSwitcherModal';
import { ServerIconBadge } from '@/components/ServerIconBadge';
import { useTorrentActions } from '@/hooks/useTorrentActions';
import { useGracefulError } from '@/hooks/useGracefulError';
import { getErrorMessage } from '@/utils/error';
import { extractMagnetLink } from '@/utils/magnet';
import { getAddTorrentDialogueVariant } from '@/utils/add-torrent-dialogue';
import { isTorrentCompleted } from '@/utils/torrent-state';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { MultiSelectPicker, MultiSelectPickerItem } from '@/components/MultiSelectPicker';
import { torrentHasAnyTag, UNTAGGED_FILTER } from '@/utils/tags';
import {
  MAX_PINNED_SEARCHES,
  SearchHistoryState,
  clearUnpinned,
  getHistoryEntries,
  recordQuery,
  removeQuery,
  togglePin,
} from '@/utils/search-history';

export default function TorrentsScreen() {
  const { t } = useTranslation();
  const { showToast, setToastTopOffset } = useToast();
  const router = useRouter();
  const {
    torrents,
    categories,
    tags,
    isLoading,
    error,
    refresh,
    isRecoveringFromBackground,
    initialLoadComplete,
  } = useTorrents();
  const { graceError, isPendingError } = useGracefulError(error);
  const {
    currentServer,
    isConnected,
    isLoading: serverIsLoading,
    isConnecting,
    isReconnecting,
    connectToServer,
  } = useServer();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{
    magnet?: string | string[];
    torrentFileUri?: string | string[];
    torrentFileName?: string | string[];
    sourceUrl?: string | string[];
    sourcePlugin?: string | string[];
  }>();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [torrentUrl, setTorrentUrl] = useState('');
  // The search plugin that must fetch `torrentUrl` when it was pre-filled from a
  // Search result whose link only that plugin can resolve (#284).
  const [sourcePlugin, setSourcePlugin] = useState<PrefilledPlugin | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<
    { uri: string; name: string; mimeType?: string }[]
  >([]);
  const [addingTorrent, setAddingTorrent] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  // The bulk actions bar is absolutely positioned over the list (see
  // bulkActionsBar), so without this the last card(s) render underneath it
  // and are partially hidden. Measured rather than hardcoded since its height
  // varies with the safe-area inset and Dynamic Type text scaling.
  const [bulkActionsBarHeight, setBulkActionsBarHeight] = useState(0);
  const [bulkMenuVisible, setBulkMenuVisible] = useState(false);
  const [showBulkCategoryPicker, setShowBulkCategoryPicker] = useState(false);
  // Tag editing works as a draft: toggles accumulate in bulkTagDraft and are
  // applied in one addTags/removeTags call when the picker closes.
  const [bulkTagMode, setBulkTagMode] = useState<'add' | 'remove' | null>(null);
  const [bulkTagDraft, setBulkTagDraft] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<
    'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'priority' | 'added_on'
  >('added_on');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Drives only the pull-to-refresh spinner. `isLoading` also flips on every
  // background poll/foreground re-sync, and wiring it to RefreshControl would
  // pop the iOS spinner on top of the search box on every load (#275).
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  // Recent/pinned searches for the search box (#282). The ref mirrors the
  // state so blur/submit handlers always record against the latest lists.
  const [searchHistory, setSearchHistory] = useState<SearchHistoryState>({
    history: [],
    pinned: [],
  });
  const searchHistoryRef = useRef(searchHistory);
  const [searchHistoryLimit, setSearchHistoryLimit] = useState(
    DEFAULT_PREFERENCES.torrentSearchHistoryLimit,
  );
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  // Measured so the dropdown can sit right under the search field, whatever
  // the header above it (server switcher row) happens to add.
  const [searchRowLayout, setSearchRowLayout] = useState({ x: spacing.md, y: 50, height: 0 });
  const [searchInputX, setSearchInputX] = useState(0);
  const [cardViewMode, setCardViewMode] = useState<'compact' | 'expanded'>('compact');
  const [expandedCardFields, setExpandedCardFields] = useState<Record<ExpandedCardField, boolean>>(
    DEFAULT_PREFERENCES.expandedCardFields,
  );
  const [expandedCardGridColumns, setExpandedCardGridColumns] = useState<3 | 4 | 5>(
    DEFAULT_PREFERENCES.expandedCardGridColumns,
  );
  const [defaultCategoryColor, setDefaultCategoryColor] = useState<string>(
    DEFAULT_PREFERENCES.defaultCategoryColor,
  );
  const [defaultTagColor, setDefaultTagColor] = useState<string>(
    DEFAULT_PREFERENCES.defaultTagColor,
  );
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(
    DEFAULT_PREFERENCES.categoryColors,
  );
  const [tagColors, setTagColors] = useState<Record<string, string>>(DEFAULT_PREFERENCES.tagColors);
  // Category/tag filter state (null = all categories, '' = uncategorized)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  const lastAppliedMagnetRef = useRef<{ value: string; at: number } | null>(null);
  const lastAppliedTorrentFileRef = useRef<{ value: string; at: number } | null>(null);
  const lastAppliedSourceUrlRef = useRef<{ value: string; at: number } | null>(null);

  // Action menu state
  const [selectedTorrent, setSelectedTorrent] = useState<TorrentInfo | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [listDeleteConfirm, setListDeleteConfirm] = useState<{
    title: string;
    message: string;
    hashes: string[];
    swipeableRef?: Swipeable | null;
  } | null>(null);
  const {
    actionMenuItems,
    dlLimitModalVisible,
    setDlLimitModalVisible,
    handleSetDownloadLimit,
    dlLimitDefaultValue,
    ulLimitModalVisible,
    setUlLimitModalVisible,
    handleSetUploadLimit,
    ulLimitDefaultValue,
    deleteConfirmVisible,
    setDeleteConfirmVisible,
    handleConfirmDelete,
  } = useTorrentActions(selectedTorrent);

  // Scroll animation refs
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderVisible = useRef(true);
  const isAnimating = useRef(false);
  // headerContainer is an absolute overlay (see styles.headerContainer), so
  // the list's paddingTop must reserve exactly its rendered height or content
  // either hides underneath it or leaves a gap above the first card. Its
  // content differs by selectMode (fewer buttons/rows), so this is measured
  // rather than a fixed constant — matches bulkActionsBarHeight below.
  const [headerHeight, setHeaderHeight] = useState(136);

  // Swipeable refs for closing open rows
  const openSwipeableRef = useRef<Swipeable | null>(null);
  const swipeHapticFired = useRef(false);

  // Track last known default filter so we only sync when user changes it in Settings
  const lastDefaultFilterRef = useRef<string | null>(null);

  // This screen's search/sort/add header overlays the top of the list (see
  // headerContainer/listContent below) rather than taking up its own layout
  // space, so the toast's default safe-area offset lands on top of it. Push
  // the toast down past the header — a bit further than listContent's own
  // paddingTop so it clears the header with room to spare — while this tab
  // is focused.
  useFocusEffect(
    useCallback(() => {
      setToastTopOffset(headerHeight + spacing.xxl);
      return () => setToastTopOffset(null);
    }, [setToastTopOffset, headerHeight]),
  );

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refresh]);

  // --- Recent searches (#282) -------------------------------------------
  const persistSearchHistory = useCallback(async (next: SearchHistoryState) => {
    try {
      await storageService.updatePreferences({
        torrentSearchHistory: next.history,
        torrentSearchPinned: next.pinned,
      });
    } catch {
      // best-effort
    }
  }, []);

  const applySearchHistory = useCallback(
    (next: SearchHistoryState) => {
      searchHistoryRef.current = next;
      setSearchHistory(next);
      void persistSearchHistory(next);
    },
    [persistSearchHistory],
  );

  // Records `query` (ignored when too short or history is off) and skips the
  // write when nothing would change. Only submit and picking an entry record:
  // the filter is live, so recording on blur saved half-typed fragments.
  const recordSearch = useCallback(
    (query: string) => {
      if (searchHistoryLimit <= 0) return;
      const { history, pinned } = searchHistoryRef.current;
      const nextHistory = recordQuery(history, pinned, query, searchHistoryLimit);
      if (
        nextHistory.length === history.length &&
        nextHistory.every((entry, index) => entry === history[index])
      ) {
        return;
      }
      applySearchHistory({ history: nextHistory, pinned });
    },
    [searchHistoryLimit, applySearchHistory],
  );

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (text.length > 0) setShowSearchHistory(false);
  }, []);

  const handleClearSearch = useCallback(() => {
    haptics.light();
    setSearchQuery('');
  }, []);

  const handleSelectHistoryQuery = useCallback(
    (query: string) => {
      haptics.light();
      setSearchQuery(query);
      setShowSearchHistory(false);
      recordSearch(query);
    },
    [recordSearch],
  );

  const handleToggleHistoryPin = useCallback(
    (query: string) => {
      haptics.light();
      const { history, pinned } = searchHistoryRef.current;
      const next = togglePin(history, pinned, query, searchHistoryLimit);
      if (next.history === history && next.pinned === pinned) {
        showToast(t('screens.torrents.pinLimitReached', { max: MAX_PINNED_SEARCHES }), 'info');
        return;
      }
      applySearchHistory(next);
    },
    [searchHistoryLimit, applySearchHistory, showToast, t],
  );

  const handleRemoveHistoryQuery = useCallback(
    (query: string) => {
      haptics.light();
      const { history, pinned } = searchHistoryRef.current;
      applySearchHistory(removeQuery(history, pinned, query));
    },
    [applySearchHistory],
  );

  const handleClearRecentSearches = useCallback(() => {
    haptics.light();
    applySearchHistory(clearUnpinned(searchHistoryRef.current.pinned));
  }, [applySearchHistory]);

  const searchHistoryEntries = useMemo(
    () => getHistoryEntries(searchHistory.history, searchHistory.pinned),
    [searchHistory],
  );
  // Shown whenever history is on, even before anything is saved — otherwise
  // the feature is invisible until you happen to trigger it (the dropdown
  // explains how searches get saved).
  const canShowSearchHistory = searchHistoryLimit > 0;

  // Close the dropdown whenever its trigger disappears (history switched off,
  // select mode entered, text typed or applied).
  useEffect(() => {
    if (showSearchHistory && (!canShowSearchHistory || selectMode || searchQuery.length > 0)) {
      setShowSearchHistory(false);
    }
  }, [showSearchHistory, canShowSearchHistory, selectMode, searchQuery]);

  // Check for filter + card view mode preference changes on screen focus
  useFocusEffect(
    useCallback(() => {
      const loadPreferences = async () => {
        try {
          const prefs = await storageService.getPreferences();
          const newDefault = prefs.defaultFilter || 'all';
          if (
            lastDefaultFilterRef.current !== null &&
            lastDefaultFilterRef.current !== newDefault
          ) {
            setFilter(newDefault);
          }
          lastDefaultFilterRef.current = newDefault;
          setCardViewMode(prefs.cardViewMode ?? 'compact');
          if (prefs.expandedCardFields) {
            setExpandedCardFields({
              ...DEFAULT_PREFERENCES.expandedCardFields,
              ...prefs.expandedCardFields,
            });
          }
          setExpandedCardGridColumns(
            prefs.expandedCardGridColumns === 3 || prefs.expandedCardGridColumns === 5
              ? prefs.expandedCardGridColumns
              : 4,
          );
          setDefaultCategoryColor(
            prefs.defaultCategoryColor || DEFAULT_PREFERENCES.defaultCategoryColor,
          );
          setDefaultTagColor(prefs.defaultTagColor || DEFAULT_PREFERENCES.defaultTagColor);
          setCategoryColors(prefs.categoryColors || {});
          setTagColors(prefs.tagColors || {});
          // Reloaded on focus so a limit changed in Settings → Appearance
          // (which also trims the stored history) takes effect immediately.
          const storedHistory: SearchHistoryState = {
            history: Array.isArray(prefs.torrentSearchHistory) ? prefs.torrentSearchHistory : [],
            pinned: Array.isArray(prefs.torrentSearchPinned) ? prefs.torrentSearchPinned : [],
          };
          searchHistoryRef.current = storedHistory;
          setSearchHistory(storedHistory);
          setSearchHistoryLimit(
            typeof prefs.torrentSearchHistoryLimit === 'number'
              ? prefs.torrentSearchHistoryLimit
              : DEFAULT_PREFERENCES.torrentSearchHistoryLimit,
          );
        } catch {
          // ignore
        }
      };
      loadPreferences();
    }, []),
  );

  // Load default sort/filter preferences only on app launch (once)
  useEffect(() => {
    const loadDefaultPreferences = async () => {
      try {
        const prefs = await storageService.getPreferences();
        // Load default sort/filter preferences only if not already set
        if (prefs.defaultSortBy) {
          setSortBy(prefs.defaultSortBy);
        }
        if (prefs.defaultSortDirection) {
          setSortDirection(prefs.defaultSortDirection);
        }
        if (prefs.defaultFilter) {
          setFilter(prefs.defaultFilter);
        }
        if (prefs.lastCategoryFilter !== undefined) {
          setCategoryFilter(prefs.lastCategoryFilter);
        }
        if (prefs.lastTagFilters && prefs.lastTagFilters.length > 0) {
          setTagFilters(prefs.lastTagFilters);
        }
        setCardViewMode(prefs.cardViewMode ?? 'compact');
        if (prefs.expandedCardFields) {
          setExpandedCardFields({
            ...DEFAULT_PREFERENCES.expandedCardFields,
            ...prefs.expandedCardFields,
          });
        }
        setExpandedCardGridColumns(
          prefs.expandedCardGridColumns === 3 || prefs.expandedCardGridColumns === 5
            ? prefs.expandedCardGridColumns
            : 4,
        );
      } catch {
        // Use defaults if loading fails
      }
    };
    loadDefaultPreferences();
    // Only run once on mount (app launch)
  }, []);

  // Sync pauseOnAdd from server when connected (best-effort background sync)
  useEffect(() => {
    if (isConnected) {
      (async () => {
        try {
          const serverPrefs = await applicationApi.getPreferences();
          const pauseOnAddKey = getPauseOnAddPreferenceKey(apiClient.getApiFeatures());
          const serverVal = !!(serverPrefs as Record<string, unknown>)[pauseOnAddKey];
          const localPrefs = await storageService.getPreferences();
          if (localPrefs.pauseOnAdd !== serverVal) {
            await storageService.savePreferences({ ...localPrefs, pauseOnAdd: serverVal });
          }
        } catch {
          // Best-effort sync — ignore errors
        }
      })();
    }
  }, [isConnected]);

  const handleOpenAddTorrent = useCallback(async () => {
    try {
      const prefs = await storageService.getPreferences();
      if (prefs.useFullAddTorrentDialogue) {
        router.push('/torrents/add');
        return;
      }
    } catch {
      // Fall back to compact modal.
    }
    setShowAddModal(true);
  }, [router]);

  useEffect(() => {
    const rawMagnet = Array.isArray(params.magnet) ? params.magnet[0] : params.magnet;
    const magnetLink = extractMagnetLink(rawMagnet);
    if (!magnetLink) return;

    const now = Date.now();
    if (
      lastAppliedMagnetRef.current &&
      lastAppliedMagnetRef.current.value === magnetLink &&
      now - lastAppliedMagnetRef.current.at < 1500
    ) {
      return;
    }
    lastAppliedMagnetRef.current = { value: magnetLink, at: now };

    const handleIncomingMagnet = async () => {
      let variant: 'compact' | 'full' = 'compact';
      try {
        const prefs = await storageService.getPreferences();
        variant = getAddTorrentDialogueVariant(prefs);
      } catch {
        // Keep compact fallback.
      }

      if (variant === 'full') {
        router.setParams({ magnet: undefined });
        InteractionManager.runAfterInteractions(() => {
          router.push({
            pathname: '/torrents/add',
            params: { magnet: magnetLink },
          });
        });
        return;
      }

      setTorrentUrl(magnetLink);
      setSourcePlugin(null);
      setShowAddModal(true);
      router.setParams({ magnet: undefined });
    };

    void handleIncomingMagnet();
  }, [params.magnet, router]);

  // Search tab's + button (#217), compact-dialogue branch — search.tsx has
  // already decided the variant before navigating here, so unlike the magnet
  // handoff above this never redirects to the full screen. Uses a distinct
  // sourceUrl param (set verbatim, not run through extractMagnetLink) because
  // Search results are often plain https:// download URLs, not magnets. A
  // result only its own plugin can resolve also brings a sourcePlugin param,
  // remembered with the URL so submit can hand the add to that plugin (#284).
  useEffect(() => {
    const rawSourceUrl = Array.isArray(params.sourceUrl) ? params.sourceUrl[0] : params.sourceUrl;
    const sourceUrl = rawSourceUrl?.trim();
    if (!sourceUrl) return;
    const rawSourcePlugin = Array.isArray(params.sourcePlugin)
      ? params.sourcePlugin[0]
      : params.sourcePlugin;
    const pluginName = rawSourcePlugin?.trim();

    const now = Date.now();
    if (
      lastAppliedSourceUrlRef.current &&
      lastAppliedSourceUrlRef.current.value === sourceUrl &&
      now - lastAppliedSourceUrlRef.current.at < 1500
    ) {
      return;
    }
    lastAppliedSourceUrlRef.current = { value: sourceUrl, at: now };

    setTorrentUrl(sourceUrl);
    setSourcePlugin(pluginName ? { url: sourceUrl, plugin: pluginName } : null);
    setShowAddModal(true);
    router.setParams({ sourceUrl: undefined, sourcePlugin: undefined });
  }, [params.sourceUrl, params.sourcePlugin, router]);

  useEffect(() => {
    const fileUri = Array.isArray(params.torrentFileUri)
      ? params.torrentFileUri[0]
      : params.torrentFileUri;
    if (!fileUri) return;
    const rawName = Array.isArray(params.torrentFileName)
      ? params.torrentFileName[0]
      : params.torrentFileName;
    const fileName = rawName || 'download.torrent';

    const now = Date.now();
    if (
      lastAppliedTorrentFileRef.current &&
      lastAppliedTorrentFileRef.current.value === fileUri &&
      now - lastAppliedTorrentFileRef.current.at < 1500
    ) {
      return;
    }
    lastAppliedTorrentFileRef.current = { value: fileUri, at: now };

    const handleIncomingTorrentFile = async () => {
      let variant: 'compact' | 'full' = 'compact';
      try {
        const prefs = await storageService.getPreferences();
        variant = getAddTorrentDialogueVariant(prefs);
      } catch {
        // Keep compact fallback.
      }

      if (variant === 'full') {
        router.setParams({
          torrentFileUri: undefined,
          torrentFileName: undefined,
        });
        InteractionManager.runAfterInteractions(() => {
          router.push({
            pathname: '/torrents/add',
            params: { torrentFileUri: fileUri, torrentFileName: fileName },
          });
        });
        return;
      }

      setSelectedFiles((prev) => [
        ...prev,
        { uri: fileUri, name: fileName, mimeType: 'application/x-bittorrent' },
      ]);
      setShowAddModal(true);
      router.setParams({
        torrentFileUri: undefined,
        torrentFileName: undefined,
      });
    };

    void handleIncomingTorrentFile();
  }, [params.torrentFileUri, params.torrentFileName, router]);

  // Filter, sort, and search logic
  const filteredTorrents = useMemo(() => {
    let filtered = [...torrents];

    if (filter !== 'all') {
      filtered = filtered.filter((torrent) => {
        switch (filter) {
          case 'downloading':
            return torrent.state === 'downloading';
          case 'uploading':
            return torrent.state === 'uploading';
          case 'completed':
            return isTorrentCompleted(torrent.state, torrent.progress);
          case 'paused':
            return (
              torrent.state === 'pausedDL' ||
              torrent.state === 'pausedUP' ||
              torrent.state === 'stoppedDL' ||
              torrent.state === 'stoppedUP'
            );
          case 'active':
            return torrent.dlspeed > 0 || torrent.upspeed > 0;
          case 'stuck':
            // Exclude seeding torrents (100% complete and stalledUP)
            if (torrent.state === 'stalledUP' && torrent.progress >= 1) {
              return false; // Seeding is not stuck
            }
            return (
              torrent.state === 'stalledDL' ||
              torrent.state === 'stalledUP' ||
              torrent.state === 'metaDL'
            );
          default:
            return true;
        }
      });
    }

    // Category filter: null = all, '' = uncategorized (no category set)
    if (categoryFilter !== null) {
      filtered = filtered.filter((torrent) =>
        categoryFilter === '' ? !torrent.category : torrent.category === categoryFilter,
      );
    }

    // Tag filter: OR semantics — torrent matches if it has any selected tag
    if (tagFilters.length > 0) {
      filtered = filtered.filter((torrent) => torrentHasAnyTag(torrent.tags, tagFilters));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (torrent) =>
          torrent.name.toLowerCase().includes(query) || torrent.hash.toLowerCase().includes(query),
      );
    }

    // Sort torrents - efficient O(n log n) with native sort
    filtered.sort((a, b) => {
      let comparison: number;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'progress':
          comparison = a.progress - b.progress;
          break;
        case 'dlspeed':
          comparison = a.dlspeed - b.dlspeed;
          break;
        case 'upspeed':
          comparison = a.upspeed - b.upspeed;
          break;
        case 'ratio':
          comparison = (a.ratio ?? 0) - (b.ratio ?? 0);
          break;
        case 'priority':
          comparison = a.priority - b.priority;
          break;
        case 'added_on':
          comparison = a.added_on - b.added_on;
          break;
        default:
          return 0;
      }

      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [torrents, filter, categoryFilter, tagFilters, searchQuery, sortBy, sortDirection]);

  // Selection handlers
  const toggleSelectMode = () => {
    haptics.medium();
    if (selectMode) {
      setSelectedHashes(new Set());
    }
    setSelectMode(!selectMode);
  };

  const toggleSelection = useCallback((hash: string) => {
    haptics.selection();
    setSelectedHashes((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(hash)) {
        newSelection.delete(hash);
      } else {
        newSelection.add(hash);
      }
      return newSelection;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedHashes(new Set(filteredTorrents.map((t) => t.hash)));
  }, [filteredTorrents]);

  const clearSelection = useCallback(() => {
    setSelectedHashes(new Set());
  }, []);

  // Bulk actions
  const handleBulkPause = async () => {
    if (selectedHashes.size === 0) return;
    haptics.medium();
    setBulkLoading(true);
    try {
      await torrentsApi.pauseTorrents(Array.from(selectedHashes));
      haptics.success();
      refresh();
      setSelectedHashes(new Set());
      setSelectMode(false);
    } catch (error: unknown) {
      haptics.error();
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkResume = async () => {
    if (selectedHashes.size === 0) return;
    haptics.medium();
    setBulkLoading(true);
    try {
      await torrentsApi.resumeTorrents(Array.from(selectedHashes));
      haptics.success();
      refresh();
      setSelectedHashes(new Set());
      setSelectMode(false);
    } catch (error: unknown) {
      haptics.error();
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedHashes.size === 0) return;
    const count = selectedHashes.size;
    haptics.warning();
    setListDeleteConfirm({
      title: t('alerts.deleteTorrents', { count }),
      message: t('alerts.deleteConfirm'),
      hashes: Array.from(selectedHashes),
    });
  };

  const handleConfirmListDelete = async (deleteFiles: boolean) => {
    if (!listDeleteConfirm) return;
    const { hashes, swipeableRef } = listDeleteConfirm;
    const count = hashes.length;
    setListDeleteConfirm(null);
    setBulkLoading(true);
    try {
      await torrentsApi.deleteTorrents(hashes, deleteFiles);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      refresh();
      if (count > 1 || selectMode) {
        setSelectedHashes(new Set());
        setSelectMode(false);
        showToast(t('toast.torrentsDeleted_other', { count }), 'success');
      } else {
        showToast(t('toast.torrentDeleted'), 'success');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBulkLoading(false);
      swipeableRef?.close();
    }
  };

  // Shared wrapper for the long-press bulk menu actions: mirrors the
  // pause/resume pattern (exit select mode on success, toast on error).
  const runBulkAction = async (action: (hashes: string[]) => Promise<void>) => {
    if (selectedHashes.size === 0) return;
    haptics.medium();
    setBulkLoading(true);
    try {
      await action(Array.from(selectedHashes));
      haptics.success();
      refresh();
      setSelectedHashes(new Set());
      setSelectMode(false);
    } catch (error: unknown) {
      haptics.error();
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkSetCategory = (category: string) => {
    setShowBulkCategoryPicker(false);
    void runBulkAction((hashes) => torrentsApi.setTorrentCategory(hashes, category));
  };

  const handleBulkTagsDone = () => {
    const mode = bulkTagMode;
    const draft = bulkTagDraft;
    setBulkTagMode(null);
    setBulkTagDraft([]);
    if (!mode || draft.length === 0) return;
    void runBulkAction((hashes) =>
      mode === 'add'
        ? torrentsApi.addTorrentTags(hashes, draft)
        : torrentsApi.removeTorrentTags(hashes, draft),
    );
  };

  const bulkMenuItems: ActionMenuItemDef[] = [
    { label: t('actions.resume'), icon: 'play', onPress: () => void handleBulkResume() },
    { label: t('actions.pause'), icon: 'pause', onPress: () => void handleBulkPause() },
    {
      label: t('actions.setCategory'),
      icon: 'folder-open-outline',
      onPress: () => setShowBulkCategoryPicker(true),
    },
    {
      label: t('actions.addTags'),
      icon: 'pricetag-outline',
      onPress: () => {
        setBulkTagDraft([]);
        setBulkTagMode('add');
      },
    },
    {
      label: t('actions.removeTags'),
      icon: 'pricetags-outline',
      onPress: () => {
        setBulkTagDraft([]);
        setBulkTagMode('remove');
      },
    },
    {
      label: t('actions.verifyData'),
      icon: 'checkmark-done-outline',
      onPress: () => void runBulkAction((hashes) => torrentsApi.recheckTorrents(hashes)),
    },
    {
      label: t('actions.reannounce'),
      icon: 'megaphone-outline',
      onPress: () => void runBulkAction((hashes) => torrentsApi.reannounceTorrents(hashes)),
    },
    {
      label: t('common.delete'),
      icon: 'trash-outline',
      onPress: handleBulkDelete,
      destructive: true,
    },
  ];

  // ─── Server quick-connect state (not-connected panel + the connected
  // server switcher, #249 — both list the same saved servers) ────────────────
  const [savedServers, setSavedServers] = useState<ServerConfig[]>([]);
  const [serversLoaded, setServersLoaded] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectErrors, setConnectErrors] = useState<Record<string, string>>({});
  const [showServerSwitcher, setShowServerSwitcher] = useState(false);

  // Refetch on every focus, connected or not, so an icon/color edited in
  // Settings shows up here next time this screen regains focus rather than
  // only on the next connect/disconnect.
  useFocusEffect(
    useCallback(() => {
      setServersLoaded(false);
      ServerManager.getServers()
        .then((s) => {
          setSavedServers(s);
          setServersLoaded(true);
        })
        .catch(() => {
          setSavedServers([]);
          setServersLoaded(true);
        });
    }, []),
  );

  const handleQuickConnect = useCallback(
    async (server: ServerConfig) => {
      haptics.medium();
      setConnectingId(server.id);
      setConnectErrors((prev) => {
        const next = { ...prev };
        delete next[server.id];
        return next;
      });
      try {
        // connectToServer resolves false (rather than throwing) when qBittorrent
        // answers the login with "Fails." — i.e. bad credentials. Without this
        // branch the most common failure of all produces no feedback at all.
        const connected = await connectToServer(server);
        if (!connected) {
          setConnectErrors((prev) => ({ ...prev, [server.id]: t('errors.checkCredentials') }));
          haptics.error();
        }
      } catch (err: unknown) {
        setConnectErrors((prev) => ({ ...prev, [server.id]: getErrorMessage(err) }));
        haptics.error();
      } finally {
        setConnectingId(null);
      }
    },
    [connectToServer, t],
  );

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-bittorrent', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Validate they're .torrent files by checking the extension
        const invalid = result.assets.some((file) => !file.name.toLowerCase().endsWith('.torrent'));
        if (invalid) {
          showToast(t('errors.selectTorrentFile'), 'error');
          return;
        }

        const files = result.assets.map((file) => ({ uri: file.uri, name: file.name }));
        setSelectedFiles((prev) => [...prev, ...files]);
        if (files.length === 1) {
          showToast(t('screens.torrents.fileSelected', { name: files[0].name }), 'success');
        } else {
          showToast(t('screens.torrents.filesSelected', { count: files.length }), 'success');
        }
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitTorrent = async () => {
    const urls = torrentUrl
      .split('\n')
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length === 0 && selectedFiles.length === 0) {
      showToast(t('errors.enterUrlOrMagnet'), 'error');
      return;
    }

    if (!isConnected) {
      showToast(t('toast.notConnected'), 'error');
      return;
    }

    try {
      setAddingTorrent(true);

      const prefs = await storageService.getPreferences();
      const addOptions = {
        stopped: prefs.pauseOnAdd === true,
        firstLastPiecePrio: Number(prefs.defaultPriority) > 0,
      };

      // A Search result only its plugin can resolve (HTML page → magnet, …) must be
      // fetched by that plugin, or qBittorrent downloads the page, fails to parse
      // it and still answers 200 (#284). Only for the untouched pre-filled URL.
      const downloader = getPrefilledDownloader(urls, sourcePlugin);
      const plan = planPluginUrlAdd(downloader, apiClient.getApiFeatures());

      const tasks: Promise<void>[] = [];
      if (selectedFiles.length > 0) {
        tasks.push(torrentsApi.addTorrentFile(selectedFiles, addOptions));
      }
      if (urls.length > 0) {
        if (plan === 'searchDownloadTorrent' && downloader) {
          tasks.push(searchApi.downloadTorrent(urls[0], downloader));
        } else {
          tasks.push(
            torrentsApi.addTorrent(
              urls,
              plan === 'addWithDownloader' ? { ...addOptions, downloader } : addOptions,
            ),
          );
        }
      }
      await Promise.all(tasks);

      haptics.success();
      setTorrentUrl('');
      setSourcePlugin(null);
      setSelectedFiles([]);
      setShowAddModal(false);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      refresh();
      if (plan === 'searchDownloadTorrent') {
        // search/downloadTorrent takes no options — say so rather than a plain "added".
        showToast(t('toast.pluginAddDefaultOptions'), 'info', 6000);
      } else {
        showToast(
          t('toast.torrentAdded', { count: urls.length + selectedFiles.length }),
          'success',
        );
      }
    } catch (error: unknown) {
      haptics.error();
      showToast(getErrorMessage(error), 'error');
    } finally {
      setAddingTorrent(false);
    }
  };

  // Swipe action handlers (call APIs directly, parameterized by torrent)
  const handleSwipePauseResume = useCallback(
    async (torrent: TorrentInfo, swipeableRef: Swipeable | null) => {
      haptics.medium();
      const isPaused =
        torrent.state === 'pausedDL' ||
        torrent.state === 'pausedUP' ||
        torrent.state === 'stoppedDL' ||
        torrent.state === 'stoppedUP';
      try {
        if (isPaused) {
          await torrentsApi.resumeTorrents([torrent.hash]);
        } else {
          await torrentsApi.pauseTorrents([torrent.hash]);
        }
        refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        showToast(
          msg || (isPaused ? t('errors.failedToResume') : t('errors.failedToPause')),
          'error',
        );
      }
      swipeableRef?.close();
    },
    [refresh, showToast, t],
  );

  const handleCardPauseResume = useCallback(
    async (torrent: TorrentInfo) => {
      haptics.medium();
      const isPaused =
        torrent.state === 'pausedDL' ||
        torrent.state === 'pausedUP' ||
        torrent.state === 'stoppedDL' ||
        torrent.state === 'stoppedUP';
      try {
        if (isPaused) {
          await torrentsApi.resumeTorrents([torrent.hash]);
        } else {
          await torrentsApi.pauseTorrents([torrent.hash]);
        }
        refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        showToast(
          msg || (isPaused ? t('errors.failedToResume') : t('errors.failedToPause')),
          'error',
        );
      }
    },
    [refresh, showToast, t],
  );

  const handleSwipeDelete = useCallback(
    (torrent: TorrentInfo, swipeableRef: Swipeable | null) => {
      haptics.warning();
      setListDeleteConfirm({
        title: t('common.delete'),
        message: t('alerts.deleteName', { name: torrent.name }),
        hashes: [torrent.hash],
        swipeableRef,
      });
    },
    [t],
  );

  const handleSwipeForceStart = useCallback(
    async (torrent: TorrentInfo, swipeableRef: Swipeable | null) => {
      haptics.medium();
      try {
        await torrentsApi.setForceStart([torrent.hash], true);
        refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        showToast(msg || t('errors.generic'), 'error');
      }
      swipeableRef?.close();
    },
    [refresh, showToast, t],
  );

  // Scroll handler — header show/hide only. Pinned (never hides) in
  // selectMode: Select All / Close must stay reachable without scrolling
  // back up, per #252-adjacent feedback.
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (selectMode) return;

      const currentScrollY = event.nativeEvent.contentOffset.y;
      const scrollDifference = currentScrollY - lastScrollY.current;

      if (currentScrollY <= 10) {
        if (!isHeaderVisible.current) {
          isHeaderVisible.current = true;
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
        lastScrollY.current = currentScrollY;
        return;
      }

      const minMovement = 15;
      if (Math.abs(scrollDifference) < minMovement) {
        lastScrollY.current = currentScrollY;
        return;
      }

      if (isAnimating.current) {
        lastScrollY.current = currentScrollY;
        return;
      }

      if (scrollDifference < -minMovement && !isHeaderVisible.current) {
        isAnimating.current = true;
        isHeaderVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          isAnimating.current = false;
        });
      } else if (scrollDifference > minMovement && isHeaderVisible.current) {
        isAnimating.current = true;
        isHeaderVisible.current = false;
        Animated.timing(headerTranslateY, {
          toValue: -200,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          isAnimating.current = false;
        });
      }

      lastScrollY.current = currentScrollY;
    },
    [headerTranslateY, selectMode],
  );

  // Snap the header back to visible when entering selectMode — it may have
  // been scrolled out of view before selection started, and while selected
  // it must stay pinned (handleScroll no-ops during selectMode above).
  useEffect(() => {
    if (selectMode) {
      isHeaderVisible.current = true;
      isAnimating.current = false;
      headerTranslateY.setValue(0);
    }
  }, [selectMode, headerTranslateY]);

  // Whether any secondary (category/tag) filter is active
  const hasSecondaryFilter = categoryFilter !== null || tagFilters.length > 0;

  const clearAllFilters = useCallback(async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter('all');
    setCategoryFilter(null);
    setTagFilters([]);
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({
        ...prefs,
        lastCategoryFilter: null,
        lastTagFilters: [],
      });
    } catch {
      // best-effort
    }
  }, []);

  // Category picker options: All + Uncategorized + sorted server categories
  const categoryPickerOptions = useMemo<OptionPickerItem[]>(() => {
    const sorted = Object.keys(categories).sort((a, b) => a.localeCompare(b));
    return [
      { label: t('filters.allCategories'), value: '__all__', icon: 'grid-outline' as const },
      { label: t('filters.uncategorized'), value: '', icon: 'remove-circle-outline' as const },
      ...sorted.map((name) => ({ label: name, value: name, icon: 'folder-outline' as const })),
    ];
  }, [categories, t]);

  // Tag multi-select options: sorted server tags
  const tagPickerOptions = useMemo<MultiSelectPickerItem[]>(() => {
    return [...tags]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ label: tag, value: tag, icon: 'pricetag-outline' as const }));
  }, [tags]);

  // Tag FILTER options: Untagged sentinel + server tags. Separate from
  // tagPickerOptions so the bulk Add Tags picker never offers the sentinel.
  const tagFilterPickerOptions = useMemo<MultiSelectPickerItem[]>(() => {
    return [
      {
        label: t('filters.untagged'),
        value: UNTAGGED_FILTER,
        icon: 'remove-circle-outline' as const,
      },
      ...tagPickerOptions,
    ];
  }, [tagPickerOptions, t]);

  // Bulk "Set Category" options: Uncategorized ('' clears it) + server categories
  const bulkCategoryOptions = useMemo<OptionPickerItem[]>(() => {
    const sorted = Object.keys(categories).sort((a, b) => a.localeCompare(b));
    return [
      { label: t('filters.uncategorized'), value: '', icon: 'remove-circle-outline' as const },
      ...sorted.map((name) => ({ label: name, value: name, icon: 'folder-outline' as const })),
    ];
  }, [categories, t]);

  // Bulk "Remove Tags" options: only tags actually present on the selection
  const bulkRemoveTagOptions = useMemo<MultiSelectPickerItem[]>(() => {
    if (bulkTagMode !== 'remove') return [];
    const present = new Set<string>();
    torrents.forEach((tor) => {
      if (!selectedHashes.has(tor.hash) || !tor.tags) return;
      tor.tags.split(',').forEach((tag) => {
        const trimmed = tag.trim();
        if (trimmed) present.add(trimmed);
      });
    });
    return [...present]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ label: tag, value: tag, icon: 'pricetag-outline' as const }));
  }, [bulkTagMode, torrents, selectedHashes]);

  const handleCategorySelect = useCallback(async (value: string) => {
    const newFilter = value === '__all__' ? null : value;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategoryFilter(newFilter);
    setShowCategoryPicker(false);
    haptics.light();
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, lastCategoryFilter: newFilter });
    } catch {
      // best-effort
    }
  }, []);

  const handleTagsChange = useCallback(async (values: string[]) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTagFilters(values);
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, lastTagFilters: values });
    } catch {
      // best-effort
    }
  }, []);

  // Filter options
  const filterOptions = [
    { key: 'all', labelKey: 'filters.all', icon: 'grid-outline' as const },
    { key: 'active', labelKey: 'filters.active', icon: 'pulse' as const },
    { key: 'completed', labelKey: 'filters.completed', icon: 'checkmark-circle' as const },
    { key: 'paused', labelKey: 'filters.paused', icon: 'pause-circle' as const },
    { key: 'stuck', labelKey: 'filters.stuck', icon: 'warning' as const },
    { key: 'downloading', labelKey: 'filters.downloading', icon: 'arrow-down' as const },
    { key: 'uploading', labelKey: 'filters.uploading', icon: 'arrow-up' as const },
  ];

  const sortOptions = [
    { key: 'added_on' as const, labelKey: 'sort.dateAdded', icon: 'time-outline' as const },
    { key: 'name' as const, labelKey: 'sort.name', icon: 'text-outline' as const },
    { key: 'size' as const, labelKey: 'sort.size', icon: 'albums-outline' as const },
    { key: 'progress' as const, labelKey: 'sort.progress', icon: 'stats-chart-outline' as const },
    { key: 'ratio' as const, labelKey: 'sort.ulRatio', icon: 'swap-horizontal-outline' as const },
    { key: 'priority' as const, labelKey: 'sort.priority', icon: 'list-outline' as const },
    { key: 'dlspeed' as const, labelKey: 'sort.dlSpeed', icon: 'arrow-down-outline' as const },
    { key: 'upspeed' as const, labelKey: 'sort.ulSpeed', icon: 'arrow-up-outline' as const },
  ];

  // Early returns
  // Show the "Not Connected" quick-connect screen whenever there is no live
  // connection (check this FIRST). currentServer intentionally survives a
  // disconnect for one-tap reconnect, so it must NOT gate this screen —
  // otherwise a disconnected app falls through to the empty torrent list.
  //
  // `connectingId !== null` keeps this panel mounted through a user-initiated
  // tap (#252): the moment handleQuickConnect fires, connectMutation goes
  // pending and serverIsLoading flips true, which would otherwise fall through
  // to the skeleton branch below and unmount the panel mid-tap — panel →
  // skeleton → panel in a frame (or ~10s on a real network), i.e. the blink.
  // An automatic background reconnect leaves connectingId null, so it still
  // falls through to the skeleton as before.
  if (!isConnected && (!serverIsLoading || connectingId !== null)) {
    return (
      <QuickConnectPanel
        savedServers={savedServers}
        serversLoaded={serversLoaded}
        connectingId={connectingId}
        connectErrors={connectErrors}
        onConnect={handleQuickConnect}
        onAddServer={() => router.push('/server/add')}
      />
    );
  }

  // Show skeleton list during initial app launch (server connecting or first
  // data fetch), during background recovery, or while a fresh error is still
  // within its grace window — most poll failures self-heal within a couple
  // of seconds and shouldn't flash a hard error.
  //
  // Skip this entirely while the compact Add Torrent modal is open (#220):
  // opening a magnet link foregrounds the app, which flips
  // isRecoveringFromBackground true on the exact same tick the magnet
  // handler is opening this modal. Returning the skeleton here unmounts the
  // Modal along with the rest of the screen, so the dialogue flashes and is
  // immediately dismissed. The modal already re-syncs on its own once
  // submitted, so there's no correctness reason to interrupt it.
  if (
    (isConnecting && !showAddModal) ||
    (!initialLoadComplete && (serverIsLoading || !isConnected || isLoading)) ||
    (initialLoadComplete &&
      !showAddModal &&
      (isRecoveringFromBackground || isReconnecting || isPendingError))
  ) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.skeletonList}>
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonTorrentCard key={i} />
            ))}
          </View>
        </View>
      </>
    );
  }

  // Only show persistent errors (not during background recovery, initial
  // connection, or a fresh error still within its grace window)
  if (graceError && initialLoadComplete) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <EmptyState
          style={{ backgroundColor: colors.background }}
          icon="alert-circle-outline"
          iconColor={colors.error}
          title={t('screens.torrents.somethingWentWrong')}
          subtitle={graceError}
          actionLabel={t('common.retry')}
          onAction={refresh}
        />
      </>
    );
  }

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Animated.View
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
          style={[
            styles.headerContainer,
            // In selectMode the header is pinned (see the selectMode effect
            // above) — switch it from an absolute overlay to a normal in-flow
            // sibling so it physically pushes the list down instead of
            // floating on top of it. Cards can only render underneath it (as
            // in normal browsing, by design) when it's an overlay; pinned +
            // overlay together is exactly the overlap this avoids.
            selectMode && styles.headerContainerPinned,
            {
              backgroundColor: 'transparent',
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={[styles.searchCard, { backgroundColor: 'transparent' }]}>
            {/* Current server — opens the quick server switcher (#249) */}
            {!selectMode && currentServer && (
              <TouchableOpacity
                style={styles.serverSwitcherRow}
                onPress={() => {
                  haptics.light();
                  setShowServerSwitcher(true);
                }}
                activeOpacity={0.7}
                accessibilityLabel={t('screens.torrents.switchServer')}
              >
                <ServerIconBadge server={currentServer} size={20} />
                <Text style={[styles.serverSwitcherText, { color: colors.text }]} numberOfLines={1}>
                  {currentServer.name}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Search bar with Sort button */}
            <View
              style={styles.searchRow}
              onLayout={(e) => {
                const { x, y, height } = e.nativeEvent.layout;
                setSearchRowLayout({ x, y, height });
              }}
            >
              {/* LEFT: Sort button — fixed 42×42 */}
              {!selectMode && (
                <TouchableOpacity
                  style={[
                    styles.searchSortButton,
                    {
                      backgroundColor: showSortMenu ? colors.primaryOpac : colors.background,
                      borderColor: colors.surface,
                    },
                  ]}
                  onPress={() => {
                    setShowSortMenu(!showSortMenu);
                    setShowSearchHistory(false);
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
              )}

              {/* CENTER: Search input — flex:1, loading indicator inside */}
              <View
                style={[
                  styles.searchInputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderWidth: 0.1,
                    borderColor: colors.surfaceOutline,
                  },
                ]}
                onLayout={(e) => setSearchInputX(e.nativeEvent.layout.x)}
              >
                <Ionicons
                  name="search"
                  size={18}
                  color={colors.textSecondary}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.searchInputCompact, { color: colors.text }]}
                  placeholder={t('placeholders.searchTorrents')}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onSubmitEditing={() => recordSearch(searchQuery)}
                  returnKeyType="search"
                  placeholderTextColor={colors.textSecondary}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={handleClearSearch}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={t('common.clearSearch')}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
                {searchQuery.length === 0 && canShowSearchHistory && !selectMode && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowSearchHistory(!showSearchHistory);
                      setShowSortMenu(false);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={t('screens.torrents.recentSearches')}
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={showSearchHistory ? colors.primary : colors.textSecondary}
                    />
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

              {/* RIGHT: Add torrent button — fixed 42×42 */}
              {!selectMode && (
                <TouchableOpacity
                  style={[styles.headerAddButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    void handleOpenAddTorrent();
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={t('screens.torrents.addTorrent')}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter row */}
            <View style={[styles.filterRow, { backgroundColor: 'transparent' }]}>
              {/* Scrollable filter options */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRowContainer}
                style={styles.filterScrollView}
              >
                {/* Checkbox that scrolls with filters */}
                <TouchableOpacity
                  style={styles.selectCheckbox}
                  onPress={() => {
                    if (selectMode) {
                      if (selectedHashes.size === filteredTorrents.length) {
                        clearSelection();
                      } else {
                        selectAll();
                      }
                    } else {
                      toggleSelectMode();
                    }
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={
                    selectMode
                      ? selectedHashes.size === filteredTorrents.length
                        ? t('screens.torrents.deselectAll')
                        : t('screens.torrents.selectAll')
                      : t('screens.torrents.selectMode')
                  }
                >
                  <Ionicons
                    name={
                      selectMode
                        ? selectedHashes.size === filteredTorrents.length
                          ? 'checkbox'
                          : 'square-outline'
                        : 'square-outline'
                    }
                    size={24}
                    color={
                      selectMode && selectedHashes.size === filteredTorrents.length
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                </TouchableOpacity>

                {!selectMode &&
                  filterOptions.map((item) => (
                    <FilterChip
                      key={item.key}
                      label={t(item.labelKey)}
                      icon={item.icon}
                      active={filter === item.key}
                      onPress={() => {
                        haptics.light();
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        if (filter === item.key) {
                          // Clicking same filter twice toggles sort direction (for DL/UL, reverse sort)
                          setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          if (item.key === 'downloading') setSortBy('dlspeed');
                          else if (item.key === 'uploading') setSortBy('upspeed');
                        } else {
                          setFilter(item.key);
                          if (item.key === 'downloading') setSortBy('dlspeed');
                          else if (item.key === 'uploading') setSortBy('upspeed');
                        }
                      }}
                    />
                  ))}

                {!selectMode && (
                  <>
                    {/* Visual separator */}
                    <View
                      style={[
                        styles.filterChipSeparator,
                        { backgroundColor: colors.surfaceOutline },
                      ]}
                    />

                    {/* Category filter chip */}
                    <FilterChip
                      icon="folder-outline"
                      active={categoryFilter !== null}
                      onPress={() => {
                        haptics.light();
                        setShowCategoryPicker(true);
                      }}
                      accessibilityLabel={t('filters.category')}
                      label={
                        categoryFilter === null
                          ? t('filters.category')
                          : categoryFilter === ''
                            ? t('filters.uncategorized')
                            : categoryFilter
                      }
                    />

                    {/* Tags filter chip */}
                    <FilterChip
                      icon="pricetag-outline"
                      active={tagFilters.length > 0}
                      onPress={() => {
                        haptics.light();
                        setShowTagPicker(true);
                      }}
                      accessibilityLabel={t('filters.tags')}
                      label={
                        tagFilters.length > 0
                          ? t('filters.tagsCount', { count: tagFilters.length })
                          : t('filters.tags')
                      }
                    />
                  </>
                )}

                {selectMode && (
                  <FilterChip
                    icon="close"
                    active
                    activeColor={colors.error}
                    onPress={toggleSelectMode}
                    label={t('common.close')}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </ScrollView>
            </View>

            {/* Recent searches dropdown — sits under the search field (#282) */}
            {showSearchHistory && canShowSearchHistory && !selectMode && (
              <SearchHistoryDropdown
                entries={searchHistoryEntries}
                onSelect={handleSelectHistoryQuery}
                onTogglePin={handleToggleHistoryPin}
                onRemove={handleRemoveHistoryQuery}
                onClearRecent={handleClearRecentSearches}
                style={{
                  top: searchRowLayout.y + searchRowLayout.height + spacing.xs,
                  left: searchRowLayout.x + searchInputX,
                  right: searchRowLayout.x,
                }}
              />
            )}

            {/* Sort options dropdown - positioned near search bar */}
            {showSortMenu && !selectMode && (
              <View
                style={[
                  styles.sortDropdown,
                  {
                    backgroundColor: isDark ? colors.surface : colors.background,
                    borderColor: colors.surfaceOutline,
                  },
                ]}
              >
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.sortOption,
                      sortBy === option.key && {
                        backgroundColor: isDark ? colors.primaryOpac : colors.primary,
                      },
                    ]}
                    onPress={() => {
                      haptics.light();
                      if (sortBy === option.key) {
                        // Toggle direction if clicking the same sort option
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        // Set new sort option with default direction (desc for most, asc for name)
                        setSortBy(option.key);
                        setSortDirection(option.key === 'name' ? 'asc' : 'desc');
                      }
                      setShowSortMenu(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={
                        sortBy === option.key
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
                          color:
                            sortBy === option.key
                              ? isDark
                                ? colors.primary
                                : '#FFFFFF'
                              : isDark
                                ? colors.textSecondary
                                : colors.text,
                          fontWeight: sortBy === option.key ? '600' : '400',
                        },
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                    {sortBy === option.key && (
                      <Ionicons
                        name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={18}
                        color={
                          sortBy === option.key
                            ? isDark
                              ? colors.primary
                              : '#FFFFFF'
                            : isDark
                              ? colors.textSecondary
                              : colors.text
                        }
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {/* Category filter picker */}
        <OptionPicker
          visible={showCategoryPicker}
          title={t('filters.category')}
          options={categoryPickerOptions}
          selectedValue={categoryFilter === null ? '__all__' : categoryFilter}
          onSelect={(value) => void handleCategorySelect(value)}
          onClose={() => setShowCategoryPicker(false)}
        />

        {/* Tags filter picker */}
        <MultiSelectPicker
          visible={showTagPicker}
          title={t('filters.tags')}
          options={tagFilterPickerOptions}
          selectedValues={tagFilters}
          onChange={(values) => void handleTagsChange(values)}
          onClose={() => setShowTagPicker(false)}
        />

        {/* Bulk actions menu — long-press while in select mode */}
        <ActionMenu
          visible={bulkMenuVisible}
          onClose={() => setBulkMenuVisible(false)}
          items={bulkMenuItems}
        />

        {/* Bulk Set Category picker */}
        <OptionPicker
          visible={showBulkCategoryPicker}
          title={t('actions.setCategory')}
          options={bulkCategoryOptions}
          onSelect={handleBulkSetCategory}
          onClose={() => setShowBulkCategoryPicker(false)}
        />

        {/* Bulk Add/Remove Tags picker — applies the draft on close */}
        <MultiSelectPicker
          visible={bulkTagMode !== null}
          title={bulkTagMode === 'remove' ? t('actions.removeTags') : t('actions.addTags')}
          options={bulkTagMode === 'remove' ? bulkRemoveTagOptions : tagPickerOptions}
          selectedValues={bulkTagDraft}
          onChange={setBulkTagDraft}
          onClose={handleBulkTagsDone}
        />

        {filteredTorrents.length === 0 ? (
          <View style={[styles.center, { backgroundColor: colors.background }]}>
            <Ionicons
              name={
                filter === 'all' && !hasSecondaryFilter
                  ? 'cloud-download-outline'
                  : 'funnel-outline'
              }
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filter === 'all' && !hasSecondaryFilter
                ? t('screens.torrents.noTorrents')
                : t('screens.torrents.noResults')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {filter === 'all' && !hasSecondaryFilter
                ? t('screens.torrents.addMagnetSubtitle')
                : categoryFilter !== null && tagFilters.length === 0 && filter === 'all'
                  ? t('screens.torrents.noCategoryResults')
                  : tagFilters.length > 0 && categoryFilter === null && filter === 'all'
                    ? t('screens.torrents.noTagResults')
                    : filter === 'stuck'
                      ? t('screens.torrents.noStuckResults')
                      : t('screens.torrents.noFilterResults', { filter })}
            </Text>
            {filter === 'all' && !hasSecondaryFilter ? (
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  void handleOpenAddTorrent();
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>{t('screens.torrents.addTorrent')}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.emptyButton,
                  {
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.surfaceOutline,
                  },
                ]}
                onPress={() => void clearAllFilters()}
              >
                <Text style={[styles.emptyButtonText, { color: colors.text }]}>
                  {t('screens.torrents.clearAllFilters')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredTorrents}
            keyExtractor={(item) => item.hash}
            style={{ flex: 1, backgroundColor: colors.background }}
            renderItem={({ item }) => {
              const itemIsPaused =
                item.state === 'pausedDL' ||
                item.state === 'pausedUP' ||
                item.state === 'stoppedDL' ||
                item.state === 'stoppedUP';

              let swipeRef: Swipeable | null = null;

              const swipeRadius =
                cardViewMode === 'compact' ? borderRadius.medium : borderRadius.large;

              const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => (
                <SwipeActionsPanel
                  progress={progress}
                  side="right"
                  radius={swipeRadius}
                  actions={[
                    {
                      key: 'pauseResume',
                      icon: itemIsPaused ? 'play' : 'pause',
                      label: itemIsPaused ? t('actions.resume') : t('actions.pause'),
                      color: itemIsPaused ? colors.success : colors.warning,
                      onPress: () => handleSwipePauseResume(item, swipeRef),
                    },
                    {
                      key: 'delete',
                      icon: 'trash',
                      label: t('common.delete'),
                      color: colors.error,
                      onPress: () => handleSwipeDelete(item, swipeRef),
                    },
                  ]}
                />
              );

              const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>) => (
                <SwipeActionsPanel
                  progress={progress}
                  side="left"
                  radius={swipeRadius}
                  actions={[
                    {
                      key: 'forceStart',
                      icon: 'flash',
                      label: t('actions.forceStart'),
                      color: colors.primary,
                      onPress: () => handleSwipeForceStart(item, swipeRef),
                    },
                  ]}
                />
              );

              return (
                <Swipeable
                  ref={(ref) => {
                    swipeRef = ref;
                  }}
                  friction={2}
                  rightThreshold={60}
                  leftThreshold={60}
                  overshootRight={false}
                  overshootLeft={false}
                  useNativeAnimations={false}
                  renderRightActions={renderRightActions}
                  renderLeftActions={renderLeftActions}
                  onSwipeableWillOpen={() => {
                    if (openSwipeableRef.current && openSwipeableRef.current !== swipeRef) {
                      openSwipeableRef.current.close();
                    }
                    openSwipeableRef.current = swipeRef;
                    if (!swipeHapticFired.current) {
                      haptics.medium();
                      swipeHapticFired.current = true;
                    }
                  }}
                  onSwipeableClose={() => {
                    if (openSwipeableRef.current === swipeRef) {
                      openSwipeableRef.current = null;
                    }
                    swipeHapticFired.current = false;
                  }}
                  onSwipeableOpenStartDrag={() => {
                    swipeHapticFired.current = false;
                  }}
                  enabled={!selectMode}
                >
                  <View style={styles.torrentItemContainer}>
                    {selectMode && (
                      <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => toggleSelection(item.hash)}
                        accessibilityLabel={
                          selectedHashes.has(item.hash)
                            ? t('screens.torrents.deselectTorrent')
                            : t('screens.torrents.selectTorrent')
                        }
                      >
                        <Ionicons
                          name={selectedHashes.has(item.hash) ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={
                            selectedHashes.has(item.hash) ? colors.primary : colors.textSecondary
                          }
                        />
                      </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                      <TorrentCard
                        torrent={item}
                        onPress={() => {
                          if (selectMode) {
                            toggleSelection(item.hash);
                          } else {
                            router.push(`/torrent/${item.hash}`);
                          }
                        }}
                        onLongPress={(event?: GestureResponderEvent) => {
                          haptics.medium();
                          if (selectMode) {
                            // Bulk menu for the current selection; a long-press
                            // with nothing selected selects the pressed row.
                            if (selectedHashes.size === 0) toggleSelection(item.hash);
                            setBulkMenuVisible(true);
                          } else {
                            setSelectedTorrent(item);
                            setMenuAnchor(
                              event
                                ? { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
                                : null,
                            );
                            setMenuVisible(true);
                          }
                        }}
                        onMenuPress={(anchor) => {
                          haptics.medium();
                          if (selectMode) {
                            // Mirror long-press bulk behavior in select mode.
                            if (selectedHashes.size === 0) toggleSelection(item.hash);
                            setBulkMenuVisible(true);
                          } else {
                            setSelectedTorrent(item);
                            setMenuAnchor(anchor);
                            setMenuVisible(true);
                          }
                        }}
                        onPauseResume={() => handleCardPauseResume(item)}
                        compact={cardViewMode === 'compact'}
                        expandedCardFields={expandedCardFields}
                        gridColumns={expandedCardGridColumns}
                        defaultCategoryColor={defaultCategoryColor}
                        defaultTagColor={defaultTagColor}
                        categoryColors={categoryColors}
                        tagColors={tagColors}
                      />
                    </View>
                  </View>
                </Swipeable>
              );
            }}
            refreshControl={
              <RefreshControl
                refreshing={isPullRefreshing}
                onRefresh={handlePullRefresh}
                // The header is an absolute overlay (see headerContainer), so
                // push the spinner below it instead of under the search box.
                // selectMode's header is in-flow and needs no offset.
                progressViewOffset={selectMode ? 0 : headerHeight}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={[
              styles.listContent,
              // Only the absolute-overlay (non-selectMode) header needs the
              // list content pushed down by its height — in selectMode the
              // header is a normal in-flow sibling (see headerContainerPinned)
              // and already occupies that space in the layout itself.
              selectMode ? { paddingTop: spacing.sm } : { paddingTop: headerHeight },
              selectMode && selectedHashes.size > 0 && { paddingBottom: bulkActionsBarHeight },
            ]}
            onScroll={handleScroll}
            scrollEventThrottle={50}
            removeClippedSubviews={false}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={10}
          />
        )}

        {selectMode && selectedHashes.size > 0 && (
          <View
            onLayout={(e) => setBulkActionsBarHeight(e.nativeEvent.layout.height)}
            style={[
              styles.bulkActionsBar,
              { backgroundColor: colors.surface, borderTopColor: colors.surfaceOutline },
            ]}
          >
            <TouchableOpacity
              style={[styles.bulkActionButton, { backgroundColor: colors.success }]}
              onPress={handleBulkResume}
              disabled={bulkLoading}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" />
              <Text style={styles.bulkActionText}>{t('actions.resume')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkActionButton, { backgroundColor: colors.warning }]}
              onPress={handleBulkPause}
              disabled={bulkLoading}
            >
              <Ionicons name="pause" size={20} color="#FFFFFF" />
              <Text style={styles.bulkActionText}>{t('actions.pause')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkActionButton, { backgroundColor: colors.error }]}
              onPress={handleBulkDelete}
              disabled={bulkLoading}
            >
              <Ionicons name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.bulkActionText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal
          visible={showAddModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalOverlayInner}
            >
              <TouchableOpacity
                style={styles.modalOverlayInner}
                activeOpacity={1}
                onPress={() => setShowAddModal(false)}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={(e) => e.stopPropagation()}
                  style={[styles.modalContent, { backgroundColor: colors.surface }]}
                >
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      {t('screens.torrents.addTorrent')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowAddModal(false);
                        setTorrentUrl('');
                        setSourcePlugin(null);
                        setSelectedFiles([]);
                      }}
                      accessibilityLabel={t('common.close')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                    {t('screens.torrents.urlOrMagnet')}
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                      },
                    ]}
                    value={torrentUrl}
                    onChangeText={setTorrentUrl}
                    placeholder={t('placeholders.magnetLink')}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={3}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textAlignVertical="top"
                  />
                  <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                    {t('screens.torrents.magnetMultiHint')}
                  </Text>

                  <View style={styles.divider}>
                    <View
                      style={[styles.dividerLine, { backgroundColor: colors.surfaceOutline }]}
                    />
                    <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
                      {t('common.or')}
                    </Text>
                    <View
                      style={[styles.dividerLine, { backgroundColor: colors.surfaceOutline }]}
                    />
                  </View>

                  {selectedFiles.length > 0 && (
                    <View
                      style={[
                        styles.fileListContainer,
                        { borderColor: colors.success, backgroundColor: colors.background },
                      ]}
                    >
                      <ScrollView style={styles.fileListScroll} nestedScrollEnabled>
                        {selectedFiles.map((file, index) => (
                          <View
                            key={`${file.uri}-${index}`}
                            style={[
                              styles.fileListRow,
                              index > 0 && {
                                borderTopColor: colors.surfaceOutline,
                                borderTopWidth: 1,
                              },
                            ]}
                          >
                            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                            <Text
                              style={[styles.fileListRowText, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {file.name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleRemoveSelectedFile(index)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityLabel={t('common.remove')}
                            >
                              <Ionicons
                                name="close-circle"
                                size={18}
                                color={colors.textSecondary}
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.filePickerButton,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.surfaceOutline,
                      },
                    ]}
                    onPress={handlePickFile}
                  >
                    <Ionicons name="document" size={20} color={colors.text} />
                    <Text style={[styles.filePickerText, { color: colors.text }]}>
                      {selectedFiles.length > 0
                        ? t('screens.torrents.addMoreFiles')
                        : t('screens.torrents.selectTorrentFile')}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        styles.modalButtonCancel,
                        { backgroundColor: colors.background },
                      ]}
                      onPress={() => {
                        setTorrentUrl('');
                        setSourcePlugin(null);
                        setSelectedFiles([]);
                        setShowAddModal(false);
                      }}
                    >
                      <Text style={[styles.modalButtonText, { color: colors.text }]}>
                        {t('common.cancel')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        styles.modalButtonAdd,
                        { backgroundColor: colors.primary },
                        addingTorrent && { opacity: 0.6 },
                      ]}
                      onPress={handleSubmitTorrent}
                      disabled={addingTorrent}
                    >
                      {addingTorrent ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                          {t('common.add')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <ActionMenu
          visible={menuVisible}
          onClose={() => {
            // Keep the anchor through the Modal's fade-out. Clearing it here
            // re-renders ActionMenu's bottom-sheet branch in place of the
            // popover while the dismiss animation is still running. Both open
            // paths set a fresh anchor before showing the menu again.
            setMenuVisible(false);
          }}
          items={actionMenuItems}
          anchor={menuAnchor ?? undefined}
        />

        <InputModal
          visible={dlLimitModalVisible}
          title={t('torrentDetail.setDownloadLimit')}
          message={t('screens.torrents.enterLimitKbs')}
          placeholder="0"
          defaultValue={dlLimitDefaultValue}
          keyboardType="numeric"
          allowEmpty
          computeHint={(value) => {
            const kb = parseFloat(value);
            return kb > 0 ? formatSpeed(kbToBytes(kb)) : null;
          }}
          onCancel={() => setDlLimitModalVisible(false)}
          onConfirm={(value) => {
            setDlLimitModalVisible(false);
            handleSetDownloadLimit(value);
          }}
        />

        <InputModal
          visible={ulLimitModalVisible}
          title={t('torrentDetail.setUploadLimit')}
          message={t('screens.torrents.enterLimitKbs')}
          placeholder="0"
          defaultValue={ulLimitDefaultValue}
          keyboardType="numeric"
          allowEmpty
          computeHint={(value) => {
            const kb = parseFloat(value);
            return kb > 0 ? formatSpeed(kbToBytes(kb)) : null;
          }}
          onCancel={() => setUlLimitModalVisible(false)}
          onConfirm={(value) => {
            setUlLimitModalVisible(false);
            handleSetUploadLimit(value);
          }}
        />

        <ConfirmModal
          visible={deleteConfirmVisible}
          title={t('common.delete')}
          message={
            selectedTorrent ? t('alerts.deleteName', { name: selectedTorrent.name }) : undefined
          }
          buttons={[
            { label: t('alerts.torrentOnly'), onPress: () => handleConfirmDelete(false) },
            {
              label: t('alerts.withFiles'),
              onPress: () => handleConfirmDelete(true),
              destructive: true,
            },
          ]}
          cancelLabel={t('common.cancel')}
          onCancel={() => setDeleteConfirmVisible(false)}
        />

        <ConfirmModal
          visible={!!listDeleteConfirm}
          title={listDeleteConfirm?.title ?? t('common.delete')}
          message={listDeleteConfirm?.message}
          buttons={[
            { label: t('alerts.torrentOnly'), onPress: () => handleConfirmListDelete(false) },
            {
              label: t('alerts.withFiles'),
              onPress: () => handleConfirmListDelete(true),
              destructive: true,
            },
          ]}
          cancelLabel={t('common.cancel')}
          onCancel={() => {
            listDeleteConfirm?.swipeableRef?.close();
            setListDeleteConfirm(null);
          }}
        />

        <ServerSwitcherModal
          visible={showServerSwitcher}
          servers={savedServers}
          currentServerId={currentServer?.id ?? null}
          onSelectServer={connectToServer}
          onManageServers={() => {
            setShowServerSwitcher(false);
            router.push('/settings/servers');
          }}
          onClose={() => setShowServerSwitcher(false)}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: spacing.lg,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
  },
  subMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  error: {
    fontSize: 16,
    marginBottom: spacing.lg,
    textAlign: 'center',
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
  // Not-connected layout
  notConnectedScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  notConnectedHero: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: spacing.xxxl,
  },
  notConnectedIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notConnectedServers: {
    marginBottom: spacing.xl,
  },
  notConnectedSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  notConnectedCard: {
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    ...shadows.card,
  },
  notConnectedServerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    gap: spacing.md,
  },
  notConnectedDivider: {
    height: 0.5,
    marginLeft: 68,
  },
  serverAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  serverAvatarLetter: {
    fontSize: 18,
    fontWeight: '700',
  },
  serverInfo: {
    flex: 1,
    minWidth: 0,
  },
  serverName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  serverAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverAddress: {
    fontSize: 12,
    fontWeight: '400',
  },
  serverErrorText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  connectPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  connectPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addServerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.large,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addServerIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addServerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyButtonText: {
    ...buttonText.primary,
  },
  retryButton: {
    ...buttonStyles.primary,
    marginTop: spacing.lg,
  },
  retryButtonText: {
    ...buttonText.primary,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  // Cancels the absolute positioning above — see its usage in selectMode.
  headerContainerPinned: {
    position: 'relative',
    top: undefined,
    left: undefined,
    right: undefined,
  },
  searchCard: {
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  serverSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    maxWidth: '100%',
  },
  serverSwitcherText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  searchIcon: {
    marginRight: spacing.xs + 2,
  },
  searchInputCompact: {
    flex: 1,
    ...typography.body,
  },
  clearButton: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: spacing.md,
    alignItems: 'center',
  },
  filterRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  filterScrollView: {
    flex: 1,
  },
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: borderRadius.small,
  },
  selectButtonStationary: {
    flexShrink: 0,
  },
  filterChipSeparator: {
    width: 1,
    height: 18,
    marginHorizontal: spacing.xs,
    alignSelf: 'center',
    opacity: 0.5,
  },
  listContent: {
    // paddingTop is applied dynamically (see headerHeight) — headerContainer
    // is an absolute overlay whose height varies with selectMode.
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.large,
  },
  skeletonList: {
    paddingTop: 100,
    paddingHorizontal: spacing.md,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  closeSelectButton: {
    padding: spacing.xs,
  },
  selectionCount: {
    ...typography.bodySemibold,
    padding: spacing.xs,
  },
  torrentItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  checkbox: {
    padding: 12,
    paddingRight: 8,
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
  bulkActionText: {
    ...typography.smallSemibold,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.large,
    padding: spacing.xl,
    ...shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    minWidth: '80%',
  },
  modalLabel: {
    ...typography.smallMedium,
    marginBottom: spacing.sm,
  },
  modalInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.large,
    padding: spacing.md,
    ...typography.small,
    minHeight: 80,
    marginBottom: spacing.xs,
  },
  modalHint: {
    ...typography.small,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...typography.smallMedium,
    marginHorizontal: spacing.md,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  filePickerText: {
    flex: 1,
    ...typography.body,
  },
  fileListContainer: {
    borderWidth: 1,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  fileListScroll: { maxHeight: 160 },
  fileListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  fileListRowText: {
    flex: 1,
    ...typography.body,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    ...buttonStyles.primary,
    flex: 1,
  },
  modalButtonCancel: {},
  modalButtonAdd: {},
  modalButtonText: {
    ...buttonText.primary,
  },
  headerAddButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSortButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectCheckbox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
  },
  sortDropdown: {
    position: 'absolute',
    top: 50,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  sortOptionText: {
    ...typography.secondary,
    flex: 1,
  },
});
