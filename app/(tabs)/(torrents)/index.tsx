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
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTorrents } from '@/context/TorrentContext';
import { useShell } from '@/context/ShellContext';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useTransfer } from '@/context/TransferContext';
import { TorrentInfo, ServerConfig } from '@/types/api';
import { TorrentCard } from '@/components/TorrentCard';
import { TorrentRow } from '@/components/TorrentRow';
import { TorrentTable } from '@/components/TorrentTable';
import { MacStatusBar } from '@/components/MacStatusBar';
import { TorrentDetailBody } from '@/components/torrent-detail/TorrentDetailBody';
import { SkeletonTorrentCard } from '@/components/SkeletonLoader';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';
import { InputModal } from '@/components/InputModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { torrentsApi } from '@/services/api/torrents';
import { applicationApi } from '@/services/api/application';
import { apiClient } from '@/services/api/client';
import { storageService } from '@/services/storage';
import { ExpandedCardField, SortField, DEFAULT_PREFERENCES } from '@/types/preferences';
import { ServerManager } from '@/services/server-manager';
import { getPauseOnAddPreferenceKey } from '@/utils/apiVersion';
import { formatSpeed, kbToBytes } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { shadows } from '@/constants/shadows';
import { spacing, borderRadius } from '@/constants/spacing';
import { buttonStyles, buttonText } from '@/constants/buttons';
import { typography } from '@/constants/typography';
import { QuickConnectPanel } from '@/components/QuickConnectPanel';
import { DesktopToolbar } from '@/components/shell/DesktopToolbar';
import { desktopMetrics } from '@/constants/desktop';
import { useTorrentActions } from '@/hooks/useTorrentActions';
import { useMacCommands } from '@/hooks/useMacCommands';
import type { MacCommandId } from '@/modules/mac-commands';
import { useGracefulError } from '@/hooks/useGracefulError';
import { getErrorMessage } from '@/utils/error';
import { extractMagnetLink } from '@/utils/magnet';
import { getAddTorrentDialogueVariant } from '@/utils/add-torrent-dialogue';
import { isTorrentCompleted } from '@/utils/torrent-state';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { MultiSelectPicker, MultiSelectPickerItem } from '@/components/MultiSelectPicker';
import { torrentHasAnyTag, UNTAGGED_FILTER } from '@/utils/tags';
import { clampMacDetailPanelHeight } from '@/utils/mac-detail-panel';

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
  const { isConnected, isLoading: serverIsLoading, connectToServer } = useServer();
  const { colors, isDark } = useTheme();
  const shell = useShell();
  // Mac idiom only: the same toggle MacStatusBar's alt-speed button calls.
  const { toggleAlternativeSpeedLimits } = useTransfer();
  const idiom = shell.idiom;
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{
    magnet?: string | string[];
    torrentFileUri?: string | string[];
    torrentFileName?: string | string[];
    sourceUrl?: string | string[];
  }>();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [torrentUrl, setTorrentUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<
    { uri: string; name: string; mimeType?: string }[]
  >([]);
  const [addingTorrent, setAddingTorrent] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
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
  // Mac idiom only: dense TorrentTable row striping and the bottom-docked
  // detail panel's height (persisted on splitter-drag release below).
  const [macAlternatingRows, setMacAlternatingRows] = useState<boolean>(
    DEFAULT_PREFERENCES.macAlternatingRows,
  );
  const [macDetailPanelHeight, setMacDetailPanelHeight] = useState<number>(
    DEFAULT_PREFERENCES.macDetailPanelHeight,
  );
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

  // Swipeable refs for closing open rows
  const openSwipeableRef = useRef<Swipeable | null>(null);
  const swipeHapticFired = useRef(false);

  // Mac idiom only: the Find (cmd F) menu command focuses this instead of
  // showing/hiding anything - the search input is already always rendered.
  const searchInputRef = useRef<TextInput>(null);

  // Mac idiom only: draggable splitter between TorrentTable and the
  // bottom-docked detail panel (mirrors Pogona's PanelSplitter).
  //
  // macDetailPanelHeightAnim drives the panel's actual height during a drag
  // via .setValue() (Animated.View below), so every pointer-move frame only
  // touches that one native view instead of re-rendering this whole screen
  // (and, transitively, every visible TorrentTable row - see onSelect below
  // for the same class of fix). macDetailPanelHeightRef is written directly
  // in onPanResponderMove so it always holds the live drag position (not
  // just the last *committed* height); onPanResponderRelease is the only
  // place that commits to React state (for re-renders that read the height,
  // e.g. on idiom change) and to storage.
  const macDetailPanelHeightAnim = useRef(new Animated.Value(macDetailPanelHeight)).current;
  const macDetailPanelHeightRef = useRef(macDetailPanelHeight);
  useEffect(() => {
    macDetailPanelHeightRef.current = macDetailPanelHeight;
    macDetailPanelHeightAnim.setValue(macDetailPanelHeight);
  }, [macDetailPanelHeight, macDetailPanelHeightAnim]);
  const macSplitterDragStartHeight = useRef(macDetailPanelHeight);
  const macSplitterPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          macSplitterDragStartHeight.current = macDetailPanelHeightRef.current;
        },
        onPanResponderMove: (_evt, gestureState) => {
          // The splitter sits above the panel, so dragging it up (negative
          // dy) grows the panel and dragging it down shrinks it.
          const next = clampMacDetailPanelHeight(
            macSplitterDragStartHeight.current - gestureState.dy,
          );
          macDetailPanelHeightRef.current = next;
          macDetailPanelHeightAnim.setValue(next);
        },
        onPanResponderRelease: () => {
          setMacDetailPanelHeight(macDetailPanelHeightRef.current);
          void (async () => {
            try {
              const prefs = await storageService.getPreferences();
              await storageService.savePreferences({
                ...prefs,
                macDetailPanelHeight: macDetailPanelHeightRef.current,
              });
            } catch {
              // best-effort
            }
          })();
        },
      }),
    [macDetailPanelHeightAnim],
  );

  // Track last known default filter so we only sync when user changes it in Settings
  const lastDefaultFilterRef = useRef<string | null>(null);

  // Live snapshot of categoryFilter/tagFilters for the once-per-focus
  // preference-reload effect below, which is memoized with an empty
  // dependency array (so its AsyncStorage read timing never changes on
  // compact/iPhone) and would otherwise only ever see the category/tags from
  // its first render.
  const categoryFilterRef = useRef(categoryFilter);
  const tagFiltersRef = useRef(tagFilters);
  useEffect(() => {
    categoryFilterRef.current = categoryFilter;
    tagFiltersRef.current = tagFilters;
  }, [categoryFilter, tagFilters]);

  // Compact: the search/sort/add header overlays the top of the list (see
  // headerContainer/listContent below) rather than taking up its own layout
  // space, so the toast's default safe-area offset lands on top of it. Push
  // the toast down past the header — a bit further than listContent's own
  // paddingTop so it clears the header with room to spare — while this tab
  // is focused. regular/mac: DesktopToolbar sits in normal document flow
  // instead (not absolutely positioned), so only its own height needs
  // clearing, not the compact header's much taller overlay.
  useFocusEffect(
    useCallback(() => {
      setToastTopOffset(
        idiom === 'compact'
          ? styles.listContent.paddingTop + spacing.xxl
          : desktopMetrics(idiom).toolbarHeight + spacing.sm,
      );
      return () => setToastTopOffset(null);
    }, [setToastTopOffset, idiom]),
  );

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
            // Regular/mac: mirror this write into the shell too, or the
            // shell<->local sync effect below sees the shell's now-stale
            // status and reverts it right back.
            pushListFilterToShell(newDefault, categoryFilterRef.current, tagFiltersRef.current);
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
          setMacAlternatingRows(prefs.macAlternatingRows ?? DEFAULT_PREFERENCES.macAlternatingRows);
          setMacDetailPanelHeight(
            prefs.macDetailPanelHeight ?? DEFAULT_PREFERENCES.macDetailPanelHeight,
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
        // Regular/mac: mirror the restored filter/category/tags into the
        // shell too (matching whatever the setters above just resolved to),
        // or the shell<->local sync effect below sees the shell still at its
        // DEFAULT_LIST_FILTER and reverts these restored values right back.
        pushListFilterToShell(
          prefs.defaultFilter || 'all',
          prefs.lastCategoryFilter !== undefined ? prefs.lastCategoryFilter : null,
          prefs.lastTagFilters && prefs.lastTagFilters.length > 0 ? prefs.lastTagFilters : [],
        );
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
        setMacAlternatingRows(prefs.macAlternatingRows ?? DEFAULT_PREFERENCES.macAlternatingRows);
        setMacDetailPanelHeight(
          prefs.macDetailPanelHeight ?? DEFAULT_PREFERENCES.macDetailPanelHeight,
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
      setShowAddModal(true);
      router.setParams({ magnet: undefined });
    };

    void handleIncomingMagnet();
  }, [params.magnet, router]);

  // Search tab's + button (#217), compact-dialogue branch — search.tsx has
  // already decided the variant before navigating here, so unlike the magnet
  // handoff above this never redirects to the full screen. Uses a distinct
  // sourceUrl param (set verbatim, not run through extractMagnetLink) because
  // Search results are often plain https:// download URLs, not magnets.
  useEffect(() => {
    const rawSourceUrl = Array.isArray(params.sourceUrl) ? params.sourceUrl[0] : params.sourceUrl;
    const sourceUrl = rawSourceUrl?.trim();
    if (!sourceUrl) return;

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
    setShowAddModal(true);
    router.setParams({ sourceUrl: undefined });
  }, [params.sourceUrl, router]);

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

  // Regular/mac only: mirror the sidebar's ListFilter into this screen's own
  // filter/categoryFilter/tagFilters state whenever the sidebar changes it.
  // One-directional and event-driven: depends only on shell.listFilter (not
  // the local filter/categoryFilter/tagFilters state), and is guarded by a
  // ref rather than a value comparison against local state, so it reacts
  // only to a genuine new shell.listFilter and never re-fires just because a
  // local write (from pushListFilterToShell below, or from the
  // preference-restore effects above) happened to change local state first.
  // Compact (iPhone) never reads shell.listFilter, so this is a no-op there
  // beyond the idiom check itself.
  const appliedShellListFilterRef = useRef(shell.listFilter);
  useEffect(() => {
    if (idiom === 'compact') return;
    if (appliedShellListFilterRef.current === shell.listFilter) return;
    appliedShellListFilterRef.current = shell.listFilter;
    const { status, category, tags } = shell.listFilter;
    setFilter(status);
    setCategoryFilter(category);
    setTagFilters(tags);
    // Converge with the in-list filter chips (handleCategorySelect,
    // handleTagsChange, the downloading/uploading chip): same auto-sort,
    // and the same persisted last-used filter, so a sidebar selection
    // survives relaunch instead of being silently reverted by the
    // chip-era prefs.lastCategoryFilter/lastTagFilters restore above.
    if (status === 'downloading') setSortBy('dlspeed');
    else if (status === 'uploading') setSortBy('upspeed');
    (async () => {
      try {
        const prefs = await storageService.getPreferences();
        await storageService.savePreferences({
          ...prefs,
          lastCategoryFilter: category,
          lastTagFilters: tags,
        });
      } catch {
        // best-effort
      }
    })();
  }, [idiom, shell.listFilter]);

  // Regular/mac only: used by the in-list filter chips (status/category/tags)
  // to write their change back into the sidebar's shared ListFilter. Compact
  // never calls this in a way that has any effect (idiom is always
  // 'compact'), so this doesn't touch the iPhone path.
  const pushListFilterToShell = useCallback(
    (status: string, category: string | null, tags: string[]) => {
      if (idiom === 'compact') return;
      shell.setListFilter({ status, category, tags });
    },
    [idiom, shell],
  );

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

  // Mac idiom only: stable so TorrentTableRow's memo comparator
  // (prev.onSelect === next.onSelect) doesn't fail - and every visible row
  // re-render - on renders this screen makes for unrelated reasons.
  // shell.setSelectedHash is itself a raw useState setter (stable identity).
  const handleMacTableSelect = useCallback(
    (hash: string) => shell.setSelectedHash(hash),
    [shell.setSelectedHash],
  );

  // Mac idiom only: TorrentTable's header-click sort writes back into the
  // same sortBy/sortDirection state the FlatList branch already sorts by.
  const handleMacSortChange = useCallback((field: SortField, direction: 'asc' | 'desc') => {
    setSortBy(field);
    setSortDirection(direction);
  }, []);

  // Mac idiom only: TorrentTable's right-click/long-press opens the same
  // ActionMenu the FlatList's per-row long-press uses.
  const handleMacContextMenu = useCallback(
    (hash: string, anchor: { x: number; y: number }) => {
      const torrent = filteredTorrents.find((t) => t.hash === hash);
      if (!torrent) return;
      setSelectedTorrent(torrent);
      setMenuAnchor(anchor);
      setMenuVisible(true);
    },
    [filteredTorrents],
  );

  // Mac idiom only: menu-bar / keyboard-shortcut commands (File > New
  // Transfer, the Transfer menu, etc. - see modules/mac-commands and
  // hooks/useMacCommands.ts). useMacCommands() is a no-op off Mac Catalyst
  // (isMacIdiom() reads the native UIDevice userInterfaceIdiom once), so this
  // is safe to call unconditionally on every idiom without affecting
  // compact/regular behaviour. Per-torrent commands act on shell.selectedHash
  // rather than the action-menu's selectedTorrent state, since the two are
  // independent (selectedHash is the split-view/table selection; selectedTorrent
  // is whichever row's action menu or delete confirm is currently open).
  const macRunOnSelected = useCallback(
    async (action: (hash: string) => Promise<void>) => {
      const hash = shell.selectedHash;
      if (!hash) return;
      try {
        await action(hash);
        refresh();
      } catch (error: unknown) {
        showToast(getErrorMessage(error), 'error');
      }
    },
    [shell.selectedHash, refresh, showToast],
  );

  const macRunOnAll = useCallback(
    async (action: (hashes: string[]) => Promise<void>) => {
      if (torrents.length === 0) return;
      try {
        await action(torrents.map((torrent) => torrent.hash));
        refresh();
      } catch (error: unknown) {
        showToast(getErrorMessage(error), 'error');
      }
    },
    [torrents, refresh, showToast],
  );

  const handleMacDelete = useCallback(() => {
    const hash = shell.selectedHash;
    if (!hash) return;
    const torrent = torrents.find((t) => t.hash === hash);
    if (!torrent) return;
    setSelectedTorrent(torrent);
    setDeleteConfirmVisible(true);
  }, [shell.selectedHash, torrents, setDeleteConfirmVisible]);

  const handleMacFind = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const macCommandHandlers = useMemo(
    () => ({
      newTransfer: () => void handleOpenAddTorrent(),
      refresh: () => void refresh(),
      find: handleMacFind,
      toggleSidebar: shell.toggleSidebar,
      preferences: () => router.navigate('/(tabs)/settings'),
      resumeAll: () => void macRunOnAll((hashes) => torrentsApi.resumeTorrents(hashes)),
      pauseAll: () => void macRunOnAll((hashes) => torrentsApi.pauseTorrents(hashes)),
      toggleAltSpeed: () => void toggleAlternativeSpeedLimits(),
      resume: () => void macRunOnSelected((hash) => torrentsApi.resumeTorrents([hash])),
      pause: () => void macRunOnSelected((hash) => torrentsApi.pauseTorrents([hash])),
      delete: handleMacDelete,
      recheck: () => void macRunOnSelected((hash) => torrentsApi.recheckTorrents([hash])),
      reannounce: () => void macRunOnSelected((hash) => torrentsApi.reannounceTorrents([hash])),
      queueTop: () => void macRunOnSelected((hash) => torrentsApi.setMaximalPriority([hash])),
      queueUp: () => void macRunOnSelected((hash) => torrentsApi.increasePriority([hash])),
      queueDown: () => void macRunOnSelected((hash) => torrentsApi.decreasePriority([hash])),
      queueBottom: () => void macRunOnSelected((hash) => torrentsApi.setMinimalPriority([hash])),
    }),
    [
      handleOpenAddTorrent,
      refresh,
      handleMacFind,
      shell.toggleSidebar,
      router,
      macRunOnAll,
      toggleAlternativeSpeedLimits,
      macRunOnSelected,
      handleMacDelete,
    ],
  );

  const macEnabledCommands = useMemo<MacCommandId[]>(() => {
    const base: MacCommandId[] = ['newTransfer', 'refresh', 'find', 'toggleSidebar', 'preferences'];
    if (!isConnected) return base;
    const withGlobal: MacCommandId[] = [...base, 'resumeAll', 'pauseAll', 'toggleAltSpeed'];
    if (!shell.selectedHash) return withGlobal;
    return [
      ...withGlobal,
      'resume',
      'pause',
      'delete',
      'recheck',
      'reannounce',
      'queueTop',
      'queueUp',
      'queueDown',
      'queueBottom',
    ];
  }, [isConnected, shell.selectedHash]);

  useMacCommands(macCommandHandlers, macEnabledCommands);

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

  // ─── Server quick-connect state (used in not-connected early return) ────────
  const [savedServers, setSavedServers] = useState<ServerConfig[]>([]);
  const [serversLoaded, setServersLoaded] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectErrors, setConnectErrors] = useState<Record<string, string>>({});

  // Refetch on every focus (not just isConnected changes) so an icon/color
  // edited in Settings while still disconnected shows up when this screen
  // regains focus, instead of only refreshing on the next connect/disconnect.
  useFocusEffect(
    useCallback(() => {
      if (!isConnected) {
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
      }
    }, [isConnected]),
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

      const tasks: Promise<void>[] = [];
      if (selectedFiles.length > 0) {
        tasks.push(torrentsApi.addTorrentFile(selectedFiles, addOptions));
      }
      if (urls.length > 0) {
        tasks.push(torrentsApi.addTorrent(urls, addOptions));
      }
      await Promise.all(tasks);

      haptics.success();
      setTorrentUrl('');
      setSelectedFiles([]);
      setShowAddModal(false);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      refresh();
      showToast(t('toast.torrentAdded', { count: urls.length + selectedFiles.length }), 'success');
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

  // Scroll handler — header show/hide only
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
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
    [headerTranslateY],
  );

  // Whether any secondary (category/tag) filter is active
  const hasSecondaryFilter = categoryFilter !== null || tagFilters.length > 0;

  const clearAllFilters = useCallback(async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter('all');
    setCategoryFilter(null);
    setTagFilters([]);
    pushListFilterToShell('all', null, []);
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
  }, [pushListFilterToShell]);

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

  const handleCategorySelect = useCallback(
    async (value: string) => {
      const newFilter = value === '__all__' ? null : value;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCategoryFilter(newFilter);
      setShowCategoryPicker(false);
      pushListFilterToShell(filter, newFilter, tagFilters);
      haptics.light();
      try {
        const prefs = await storageService.getPreferences();
        await storageService.savePreferences({ ...prefs, lastCategoryFilter: newFilter });
      } catch {
        // best-effort
      }
    },
    [filter, tagFilters, pushListFilterToShell],
  );

  const handleTagsChange = useCallback(
    async (values: string[]) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTagFilters(values);
      pushListFilterToShell(filter, categoryFilter, values);
      try {
        const prefs = await storageService.getPreferences();
        await storageService.savePreferences({ ...prefs, lastTagFilters: values });
      } catch {
        // best-effort
      }
    },
    [filter, categoryFilter, pushListFilterToShell],
  );

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

  // regular/mac only: DesktopToolbar's title, the active status-filter
  // label (same labelKey set as filterOptions above).
  const activeFilterLabel = t(
    filterOptions.find((option) => option.key === filter)?.labelKey ?? 'filters.all',
  );

  // Early returns
  // Show the "Not Connected" quick-connect screen whenever there is no live
  // connection (check this FIRST). currentServer intentionally survives a
  // disconnect for one-tap reconnect, so it must NOT gate this screen —
  // otherwise a disconnected app falls through to the empty torrent list.
  if (!isConnected && !serverIsLoading) {
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
    (!initialLoadComplete && (serverIsLoading || !isConnected || isLoading)) ||
    (initialLoadComplete && !showAddModal && (isRecoveringFromBackground || isPendingError))
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

  // Regular/mac with a wide enough window (>= 1000pt) split the screen into
  // this list (left) and a detail pane (right) instead of pushing the
  // torrent-detail route. Compact (iPhone) and any narrower regular/mac
  // window render mainContent alone, exactly as the screen always has.
  // Gated on the raw window width, per spec, rather than the width left
  // over after subtracting the 240pt sidebar: subtracting it first would
  // mean the split pane never appears on an open-sidebar 11-inch (1194),
  // 10.9-inch (1180) or 10.2-inch (1080) iPad in landscape, or the mini
  // (1024) -- only the 13-inch (1366) would clear 1000 with the sidebar
  // open. The list column still shrinks with the sidebar open (down to
  // 574pt on the 11-inch), which TorrentRow's middle-ellipsis handles.
  const showDetailPane = idiom === 'regular' && windowWidth >= 1000;

  // Shared option list for the sort dropdown, rendered from two different
  // gated spots below (compact header vs. desktop toolbar) so the JSX isn't
  // duplicated. See the two `sortDropdown` renders inside mainContent.
  const sortOptionsList = (
    <>
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
    </>
  );

  const mainContent = (
    <>
      {/* Compact (iPhone) only: the original absolutely-positioned Animated
          header, byte-identical to before. regular/mac render DesktopToolbar
          instead (below) - see components/shell/DesktopToolbar.tsx. */}
      {idiom === 'compact' && (
        <Animated.View
          style={[
            styles.headerContainer,
            {
              backgroundColor: 'transparent',
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={[styles.searchCard, { backgroundColor: 'transparent' }]}>
            {/* Search bar with Sort button */}
            <View style={styles.searchRow}>
              {/* LEFT: Sort button - fixed 42×42 */}
              {!selectMode && (
                <TouchableOpacity
                  style={[
                    styles.searchSortButton,
                    {
                      backgroundColor: showSortMenu ? colors.primaryOpac : colors.background,
                      borderColor: colors.surface,
                    },
                  ]}
                  onPress={() => setShowSortMenu(!showSortMenu)}
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

              {/* CENTER: Search input - flex:1, loading indicator inside */}
              <View
                style={[
                  styles.searchInputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderWidth: 0.1,
                    borderColor: colors.surfaceOutline,
                  },
                ]}
              >
                <Ionicons
                  name="search"
                  size={18}
                  color={colors.textSecondary}
                  style={styles.searchIcon}
                />
                <TextInput
                  ref={searchInputRef}
                  style={[styles.searchInputCompact, { color: colors.text }]}
                  placeholder={t('placeholders.searchTorrents')}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={colors.textSecondary}
                />
                {isLoading && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ marginLeft: spacing.xs }}
                  />
                )}
              </View>

              {/* RIGHT: Add torrent button - fixed 42×42 */}
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
                {/* Checkbox that scrolls with filters. This whole header is
                  compact-only now (regular/mac render DesktopToolbar
                  instead, which owns select-mode via its own button, not
                  select-all), so no idiom check is needed here any more. */}
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
                          pushListFilterToShell(item.key, categoryFilter, tagFilters);
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
          </View>

          {/* Sort options dropdown - lives inside the Animated header so it
              rides along with headerTranslateY when the header scroll-hides;
              a sibling outside this transform would stay pinned in place
              while the header slides away underneath it. */}
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
              {sortOptionsList}
            </View>
          )}
        </Animated.View>
      )}

      {/* regular/mac only: single-row desktop toolbar in normal flow,
          replacing the compact header above. Settings and Add live in the
          sidebar / File menu; the sidebar also owns category/tag filters -
          this toolbar only owns search, sort, add and select-mode. */}
      {idiom !== 'compact' && (
        <DesktopToolbar
          idiom={idiom}
          title={activeFilterLabel}
          resultCount={filteredTorrents.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortPress={() => setShowSortMenu(!showSortMenu)}
          onAddPress={() => {
            void handleOpenAddTorrent();
          }}
          selectMode={selectMode}
          onToggleSelectMode={toggleSelectMode}
          searchInputRef={searchInputRef}
          sidebarCollapsed={shell.sidebarCollapsed}
          onToggleSidebar={shell.toggleSidebar}
        />
      )}

      {/* regular/mac only: sort options dropdown for DesktopToolbar's sort
          control (same showSortMenu state and onPress handler as above:
          () => setShowSortMenu(!showSortMenu)), anchored under its button at
          the right edge via styles.sortDropdownDesktop. The compact copy
          lives inside the Animated header above so it rides along with
          headerTranslateY - see the comment there. */}
      {idiom !== 'compact' && showSortMenu && !selectMode && (
        <View
          style={[
            styles.sortDropdown,
            styles.sortDropdownDesktop,
            {
              backgroundColor: isDark ? colors.surface : colors.background,
              borderColor: colors.surfaceOutline,
            },
          ]}
        >
          {sortOptionsList}
        </View>
      )}

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

      {/* Bulk actions menu - long-press while in select mode */}
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

      {/* Bulk Add/Remove Tags picker - applies the draft on close */}
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
              filter === 'all' && !hasSecondaryFilter ? 'cloud-download-outline' : 'funnel-outline'
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
      ) : idiom === 'mac' ? (
        <TorrentTable
          torrents={filteredTorrents}
          selectedHash={shell.selectedHash}
          onSelect={handleMacTableSelect}
          onContextMenu={handleMacContextMenu}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={handleMacSortChange}
          alternatingRows={macAlternatingRows}
          categoryColors={categoryColors}
          topInset={0}
        />
      ) : (
        <FlatList
          data={filteredTorrents}
          keyExtractor={(item) => item.hash}
          style={{ backgroundColor: colors.background }}
          renderItem={({ item }) => {
            const itemIsPaused =
              item.state === 'pausedDL' ||
              item.state === 'pausedUP' ||
              item.state === 'stoppedDL' ||
              item.state === 'stoppedUP';

            let swipeRef: Swipeable | null = null;

            const renderRightActions = (
              _progress: Animated.AnimatedInterpolation<number>,
              dragX: Animated.AnimatedInterpolation<number>,
            ) => {
              const pauseScale = dragX.interpolate({
                inputRange: [-120, -60, 0],
                outputRange: [0.6, 1, 0],
                extrapolate: 'clamp',
              });
              const deleteScale = dragX.interpolate({
                inputRange: [-240, -160, -120],
                outputRange: [1, 0.8, 0],
                extrapolate: 'clamp',
              });

              return (
                <View style={styles.swipeActionsRight}>
                  <RectButton
                    style={[
                      styles.swipeAction,
                      { backgroundColor: itemIsPaused ? colors.success : colors.warning },
                    ]}
                    onPress={() => handleSwipePauseResume(item, swipeRef)}
                  >
                    <Animated.View
                      style={[styles.swipeActionContent, { transform: [{ scale: pauseScale }] }]}
                    >
                      <Ionicons name={itemIsPaused ? 'play' : 'pause'} size={22} color="#FFFFFF" />
                      <Text style={styles.swipeActionText}>
                        {itemIsPaused ? t('actions.resume') : t('actions.pause')}
                      </Text>
                    </Animated.View>
                  </RectButton>
                  <RectButton
                    style={[styles.swipeAction, { backgroundColor: colors.error }]}
                    onPress={() => handleSwipeDelete(item, swipeRef)}
                  >
                    <Animated.View
                      style={[styles.swipeActionContent, { transform: [{ scale: deleteScale }] }]}
                    >
                      <Ionicons name="trash" size={22} color="#FFFFFF" />
                      <Text style={styles.swipeActionText}>{t('common.delete')}</Text>
                    </Animated.View>
                  </RectButton>
                </View>
              );
            };

            const renderLeftActions = (
              _progress: Animated.AnimatedInterpolation<number>,
              dragX: Animated.AnimatedInterpolation<number>,
            ) => {
              const scale = dragX.interpolate({
                inputRange: [0, 60, 120],
                outputRange: [0, 1, 1],
                extrapolate: 'clamp',
              });

              return (
                <RectButton
                  style={[styles.swipeActionLeft, { backgroundColor: colors.primary }]}
                  onPress={() => handleSwipeForceStart(item, swipeRef)}
                >
                  <Animated.View style={[styles.swipeActionContent, { transform: [{ scale }] }]}>
                    <Ionicons name="flash" size={22} color="#FFFFFF" />
                    <Text style={styles.swipeActionText}>{t('actions.forceStart')}</Text>
                  </Animated.View>
                </RectButton>
              );
            };

            // Regular/mac split layout with a wide-enough detail pane
            // selects into the shell instead of navigating; iPhone
            // ('compact') and any narrower regular/mac window keep the
            // original router.push navigation unchanged.
            const handleRowPress = () => {
              if (selectMode) {
                toggleSelection(item.hash);
              } else if (showDetailPane) {
                shell.setSelectedHash(item.hash);
              } else {
                router.push(`/torrent/${item.hash}`);
              }
            };

            const handleRowLongPress = (event?: GestureResponderEvent) => {
              haptics.medium();
              if (selectMode) {
                // Bulk menu for the current selection; a long-press
                // with nothing selected selects the pressed row.
                if (selectedHashes.size === 0) toggleSelection(item.hash);
                setBulkMenuVisible(true);
              } else {
                setSelectedTorrent(item);
                setMenuAnchor(
                  event ? { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY } : null,
                );
                setMenuVisible(true);
              }
            };

            // Regular/mac dense list rows (cardViewMode === 'compact') use
            // TorrentRow; the expanded grid keeps TorrentCard exactly as it
            // has always rendered. Compact idiom always keeps TorrentCard.
            const useTorrentRow = idiom !== 'compact' && cardViewMode === 'compact';

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
                    {useTorrentRow ? (
                      <TorrentRow
                        torrent={item}
                        selected={shell.selectedHash === item.hash}
                        onPress={handleRowPress}
                        onLongPress={handleRowLongPress}
                        categoryColor={
                          item.category
                            ? (categoryColors[item.category] ?? defaultCategoryColor)
                            : undefined
                        }
                        tagColors={tagColors}
                      />
                    ) : (
                      <TorrentCard
                        torrent={item}
                        onPress={handleRowPress}
                        onLongPress={handleRowLongPress}
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
                    )}
                  </View>
                </View>
              </Swipeable>
            );
          }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />
          }
          contentContainerStyle={
            idiom === 'compact' ? styles.listContent : styles.listContentDesktop
          }
          onScroll={handleScroll}
          scrollEventThrottle={50}
          removeClippedSubviews={false}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
        />
      )}

      {idiom !== 'mac' && selectMode && selectedHashes.size > 0 && (
        <View
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
                  <View style={[styles.dividerLine, { backgroundColor: colors.surfaceOutline }]} />
                  <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
                    {t('common.or')}
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.surfaceOutline }]} />
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
                            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
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
    </>
  );

  // Compact (iPhone) keeps the exact original tree: mainContent sits
  // directly in the container View, no matter what showDetailPane resolves
  // to (it is always false on compact, but we branch on idiom rather than on
  // showDetailPane so the compact code path is untouched byte-for-byte).
  if (idiom === 'compact') {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {mainContent}
        </View>
      </>
    );
  }

  // Mac idiom: bottom-docked detail panel instead of the regular idiom's
  // width-gated right-hand pane, mirroring Pogona's MacTransfersView column
  // stack (transfersTable -> PanelSplitter -> bottomPanel -> MacStatusBar).
  // Always docked regardless of window width -- there is no showDetailPane
  // gate here. mainContent already renders TorrentTable in place of the
  // FlatList for this idiom (see the branch above).
  if (idiom === 'mac') {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.macTableArea}>{mainContent}</View>
          <View
            style={[styles.macSplitter, { backgroundColor: colors.surfaceOutline }]}
            accessibilityRole="adjustable"
            accessibilityLabel={t('screens.torrents.macPanelResize')}
            {...macSplitterPanResponder.panHandlers}
          />
          <Animated.View
            style={[
              styles.macDetailPanel,
              { height: macDetailPanelHeightAnim, borderTopColor: colors.surfaceOutline },
            ]}
          >
            {shell.selectedHash ? (
              <TorrentDetailBody
                key={shell.selectedHash}
                hash={shell.selectedHash}
                embedded
                onDismiss={() => shell.setSelectedHash(null)}
              />
            ) : (
              <EmptyState icon="albums-outline" title={t('screens.torrents.selectTorrentHint')} />
            )}
          </Animated.View>
          <MacStatusBar />
        </View>
      </>
    );
  }

  // Regular: keep the same parent chain (container -> detailSplitList ->
  // mainContent) whether or not showDetailPane is currently true, so crossing
  // the 1000pt threshold on a live resize only mounts/unmounts the sibling
  // detail pane instead of tearing down and rebuilding the list subtree.
  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background },
          showDetailPane && styles.detailSplitRow,
        ]}
      >
        <View style={styles.detailSplitList}>{mainContent}</View>
        {showDetailPane ? (
          <View style={[styles.detailSplitPane, { borderLeftColor: colors.surfaceOutline }]}>
            {shell.selectedHash ? (
              <TorrentDetailBody
                key={shell.selectedHash}
                hash={shell.selectedHash}
                embedded
                onDismiss={() => shell.setSelectedHash(null)}
              />
            ) : (
              <EmptyState icon="albums-outline" title={t('screens.torrents.selectTorrentHint')} />
            )}
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Regular idiom's width-gated detail-pane split (showDetailPane) only:
  // compact (iPhone) never applies these, and mac uses the bottom-docked
  // macTableArea/macSplitter/macDetailPanel styles below instead.
  detailSplitRow: {
    flexDirection: 'row',
  },
  detailSplitList: {
    flex: 1,
  },
  detailSplitPane: {
    width: 380,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  // Mac idiom bottom-docked detail panel (table -> splitter -> panel ->
  // MacStatusBar); the 'regular' side-pane styles above don't apply here.
  macTableArea: {
    flex: 1,
    // The horizontal ScrollView + FlatList inside would otherwise report
    // their content height and push the panel and status bar off screen.
    flexShrink: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  macSplitter: {
    height: 6,
  },
  macDetailPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
  searchCard: {
    borderRadius: borderRadius.medium,
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
    paddingTop: 100,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.large,
  },
  // regular idiom's FlatList: DesktopToolbar sits in normal flow above the
  // list (no absolutely-positioned header), so there is no top inset to
  // reserve. mac renders TorrentTable instead of this FlatList.
  listContentDesktop: {
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
  swipeActionsRight: {
    flexDirection: 'row',
    width: 160,
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionLeft: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
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
  // regular/mac only: anchors under DesktopToolbar's sort button (right
  // edge) instead of the compact header's left edge.
  sortDropdownDesktop: {
    left: undefined,
    right: spacing.md,
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
