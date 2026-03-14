/**
 * index.tsx — Main torrents list screen (home tab).
 *
 * Key exports: TorrentsScreen (default)
 * Known issues: Alert.prompt used in TorrentCard (iOS-only, deferred to Task 2.2).
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
  Alert,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTorrents } from '@/context/TorrentContext';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { TorrentInfo, ServerConfig } from '@/types/api';
import { TorrentCard } from '@/components/TorrentCard';
import { ActionMenu } from '@/components/ActionMenu';
import { InputModal } from '@/components/InputModal';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { torrentsApi } from '@/services/api/torrents';
import { applicationApi } from '@/services/api/application';
import { storageService } from '@/services/storage';
import { ServerManager } from '@/services/server-manager';
import { haptics } from '@/utils/haptics';
import { shadows } from '@/constants/shadows';
import { spacing, borderRadius } from '@/constants/spacing';
import { buttonStyles, buttonText } from '@/constants/buttons';
import { typography } from '@/constants/typography';
import { QuickConnectPanel } from '@/components/QuickConnectPanel';
import { useTorrentActions } from '@/hooks/useTorrentActions';
import { getErrorMessage } from '@/utils/error';

export default function TorrentsScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const { torrents, isLoading, error, refresh, isRecoveringFromBackground, initialLoadComplete } = useTorrents();
  const { isConnected, currentServer, isLoading: serverIsLoading, connectToServer } = useServer();
  const { colors, isDark } = useTheme();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [torrentUrl, setTorrentUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [addingTorrent, setAddingTorrent] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'added_on'>('added_on');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [cardViewMode, setCardViewMode] = useState<'compact' | 'expanded'>('compact');

  // Action menu state
  const [selectedTorrent, setSelectedTorrent] = useState<TorrentInfo | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const {
    actionMenuItems,
    dlLimitModalVisible,
    setDlLimitModalVisible,
    handleSetDownloadLimit,
    dlLimitDefaultValue,
  } = useTorrentActions(selectedTorrent);

  // Scroll animation refs
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderVisible = useRef(true);
  const isAnimating = useRef(false);

  // Swipeable refs for closing open rows
  const openSwipeableRef = useRef<Swipeable | null>(null);
  const swipeHapticFired = useRef(false);

  // Track last known default filter so we only sync when user changes it in Settings
  const lastDefaultFilterRef = useRef<string | null>(null);

  // Check for filter preference changes on screen focus
  useFocusEffect(
    useCallback(() => {
      const loadPreferences = async () => {
        try {
          const prefs = await storageService.getPreferences();
          const newDefault = prefs.defaultFilter || 'all';
          if (lastDefaultFilterRef.current !== null && lastDefaultFilterRef.current !== newDefault) {
            setFilter(newDefault);
          }
          lastDefaultFilterRef.current = newDefault;
        } catch {
          // ignore
        }
      };
      loadPreferences();
    }, [])
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
        setCardViewMode(prefs.cardViewMode ?? 'compact');
      } catch (error) {
        // Use defaults if loading fails
      }
    };
    loadDefaultPreferences();
    // Only run once on mount (app launch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync pauseOnAdd from server when connected (best-effort background sync)
  useEffect(() => {
    if (isConnected) {
      applicationApi.getPreferences().then((serverPrefs) => {
        const serverVal = !!(serverPrefs as Record<string, unknown>).start_paused_enabled;
        storageService.getPreferences().then((localPrefs) => {
          if (localPrefs.pauseOnAdd !== serverVal) {
            storageService.savePreferences({ ...localPrefs, pauseOnAdd: serverVal });
          }
        });
      }).catch(() => {});
    }
  }, [isConnected]);

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
            return torrent.state === 'uploading' && torrent.progress === 1;
          case 'paused':
            return torrent.state === 'pausedDL' || torrent.state === 'pausedUP' || torrent.state === 'stoppedDL' || torrent.state === 'stoppedUP';
          case 'active':
            return torrent.dlspeed > 0 || torrent.upspeed > 0;
          case 'stuck':
            // Exclude seeding torrents (100% complete and stalledUP)
            if (torrent.state === 'stalledUP' && torrent.progress >= 1) {
              return false; // Seeding is not stuck
            }
            return torrent.state === 'stalledDL' || torrent.state === 'stalledUP' || torrent.state === 'metaDL';
          default:
            return true;
        }
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (torrent) =>
          torrent.name.toLowerCase().includes(query) ||
          torrent.hash.toLowerCase().includes(query)
      );
    }

    // Sort torrents - efficient O(n log n) with native sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
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
  }, [torrents, filter, searchQuery, sortBy, sortDirection]);

  // Selection handlers
  const toggleSelectMode = () => {
    haptics.medium();
    if (selectMode) {
      setSelectedHashes(new Set());
    }
    setSelectMode(!selectMode);
  };

  const toggleSelection = (hash: string) => {
    haptics.selection();
    const newSelection = new Set(selectedHashes);
    if (newSelection.has(hash)) {
      newSelection.delete(hash);
    } else {
      newSelection.add(hash);
    }
    setSelectedHashes(newSelection);
  };

  const selectAll = () => {
    const allHashes = new Set(filteredTorrents.map(t => t.hash));
    setSelectedHashes(allHashes);
  };

  const clearSelection = () => {
    setSelectedHashes(new Set());
  };

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
    Alert.alert(
      t('alerts.deleteTorrents', { count }),
      t('alerts.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('torrentDetail.torrentOnly'),
          onPress: async () => {
            setBulkLoading(true);
            try {
              await torrentsApi.deleteTorrents(Array.from(selectedHashes), false);
              refresh();
              setSelectedHashes(new Set());
              setSelectMode(false);
              showToast(t('toast.torrentsDeleted_other', { count }), 'success');
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
            } finally {
              setBulkLoading(false);
            }
          },
        },
        {
          text: t('torrentDetail.withFiles'),
          style: 'destructive',
          onPress: async () => {
            setBulkLoading(true);
            try {
              await torrentsApi.deleteTorrents(Array.from(selectedHashes), true);
              refresh();
              setSelectedHashes(new Set());
              setSelectMode(false);
              showToast(t('toast.torrentsDeleted_other', { count }), 'success');
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
            } finally {
              setBulkLoading(false);
            }
          },
        },
      ]
    );
  };

  // ─── Server quick-connect state (used in not-connected early return) ────────
  const [savedServers, setSavedServers] = useState<ServerConfig[]>([]);
  const [serversLoaded, setServersLoaded] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectErrors, setConnectErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isConnected && !currentServer) {
      setServersLoaded(false);
      ServerManager.getServers()
        .then((s) => { setSavedServers(s); setServersLoaded(true); })
        .catch(() => { setSavedServers([]); setServersLoaded(true); });
    }
  }, [isConnected, currentServer]);

  const handleQuickConnect = useCallback(async (server: ServerConfig) => {
    haptics.medium();
    setConnectingId(server.id);
    setConnectErrors((prev) => { const next = { ...prev }; delete next[server.id]; return next; });
    try {
      await connectToServer(server);
    } catch (err: unknown) {
      setConnectErrors((prev) => ({ ...prev, [server.id]: getErrorMessage(err) }));
      haptics.error();
    } finally {
      setConnectingId(null);
    }
  }, [connectToServer]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-bittorrent', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Validate it's a .torrent file by checking the extension
        if (!file.name.toLowerCase().endsWith('.torrent')) {
          showToast(t('errors.selectTorrentFile'), 'error');
          return;
        }
        
        setSelectedFile({
          uri: file.uri,
          name: file.name,
        });
        setTorrentUrl(''); // Clear URL input when file is selected
        showToast(t('screens.torrents.fileSelected', { name: file.name }), 'success');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleSubmitTorrent = async () => {
    if (!torrentUrl.trim() && !selectedFile) {
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

      if (selectedFile) {
        await torrentsApi.addTorrentFile(selectedFile, addOptions);
      } else {
        await torrentsApi.addTorrent(torrentUrl.trim(), addOptions);
      }

      haptics.success();
      setTorrentUrl('');
      setSelectedFile(null);
      setShowAddModal(false);
      refresh();
      showToast(t('toast.torrentAdded'), 'success');
    } catch (error: unknown) {
      haptics.error();
      showToast(getErrorMessage(error), 'error');
    } finally {
      setAddingTorrent(false);
    }
  };

  // Swipe action handlers (call APIs directly, parameterized by torrent)
  const handleSwipePauseResume = useCallback(async (torrent: TorrentInfo, swipeableRef: Swipeable | null) => {
    haptics.medium();
    const isPaused =
      torrent.state === 'pausedDL' || torrent.state === 'pausedUP' ||
      torrent.state === 'stoppedDL' || torrent.state === 'stoppedUP';
    try {
      if (isPaused) {
        await torrentsApi.resumeTorrents([torrent.hash]);
      } else {
        await torrentsApi.pauseTorrents([torrent.hash]);
      }
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      showToast(msg || (isPaused ? t('errors.failedToResume') : t('errors.failedToPause')), 'error');
    }
    swipeableRef?.close();
  }, [refresh, showToast, t]);

  const handleCardPauseResume = useCallback(async (torrent: TorrentInfo) => {
    haptics.medium();
    const isPaused =
      torrent.state === 'pausedDL' || torrent.state === 'pausedUP' ||
      torrent.state === 'stoppedDL' || torrent.state === 'stoppedUP';
    try {
      if (isPaused) {
        await torrentsApi.resumeTorrents([torrent.hash]);
      } else {
        await torrentsApi.pauseTorrents([torrent.hash]);
      }
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      showToast(msg || (isPaused ? t('errors.failedToResume') : t('errors.failedToPause')), 'error');
    }
  }, [refresh, showToast, t]);

  const handleSwipeDelete = useCallback((torrent: TorrentInfo, swipeableRef: Swipeable | null) => {
    haptics.medium();
    Alert.alert(
      t('common.delete'),
      t('torrentDetail.deleteConfirm', { name: torrent.name }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => swipeableRef?.close() },
        {
          text: t('torrentDetail.torrentOnly'),
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], false);
              refresh();
              showToast(t('toast.torrentDeleted'), 'success');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '';
              showToast(msg || t('errors.failedToDelete'), 'error');
            }
            swipeableRef?.close();
          },
        },
        {
          text: t('torrentDetail.withFiles'),
          style: 'destructive',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], true);
              refresh();
              showToast(t('toast.torrentDeleted'), 'success');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '';
              showToast(msg || t('errors.failedToDelete'), 'error');
            }
            swipeableRef?.close();
          },
        },
      ],
    );
  }, [refresh, showToast, t]);

  const handleSwipeForceStart = useCallback(async (torrent: TorrentInfo, swipeableRef: Swipeable | null) => {
    haptics.medium();
    try {
      await torrentsApi.setForceStart([torrent.hash], true);
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      showToast(msg || t('errors.generic'), 'error');
    }
    swipeableRef?.close();
  }, [refresh, showToast, t]);

  // Scroll handler — header show/hide only
  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
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
      }).start(() => { isAnimating.current = false; });
    } else if (scrollDifference > minMovement && isHeaderVisible.current) {
      isAnimating.current = true;
      isHeaderVisible.current = false;
      Animated.timing(headerTranslateY, {
        toValue: -200,
        duration: 200,
        useNativeDriver: true,
      }).start(() => { isAnimating.current = false; });
    }

    lastScrollY.current = currentScrollY;
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
    { key: 'dlspeed' as const, labelKey: 'sort.dlSpeed', icon: 'arrow-down-outline' as const },
    { key: 'upspeed' as const, labelKey: 'sort.ulSpeed', icon: 'arrow-up-outline' as const },
  ];

  // Early returns
  // Only show "Not Connected" screen if no server is configured (check this FIRST)
  if (!isConnected && !currentServer && !serverIsLoading) {
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

  // Show loading screen during initial app launch (server connecting or first data fetch)
  if (!initialLoadComplete && (serverIsLoading || !isConnected || isLoading)) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary, marginTop: 16 }]}>
            {t('common.loading')}
          </Text>
        </View>
      </>
    );
  }

  // Only show persistent errors (not during background recovery or initial connection)
  if (error && !isRecoveringFromBackground && initialLoadComplete) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('screens.torrents.somethingWentWrong')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={refresh}
          >
            <Text style={styles.emptyButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Animated.View
          style={[
            styles.headerContainer,
            {
              backgroundColor: 'transparent',
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={[styles.searchCard, { backgroundColor: "transparent" }]}>
            {/* Search bar with Sort button */}
            <View style={styles.searchRow}>

              {/* LEFT: Sort button — fixed 42×42 */}
              {!selectMode && (
                <TouchableOpacity
                  style={[
                    styles.searchSortButton,
                    {
                      backgroundColor: showSortMenu ? colors.primaryOpac : colors.background,
                      borderColor: colors.surfaceOutline,
                    },
                  ]}
                  onPress={() => setShowSortMenu(!showSortMenu)}
                  activeOpacity={0.7}
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

              {/* RIGHT: Add torrent button — fixed 42×42 */}
              {!selectMode && (
                <TouchableOpacity
                  style={[styles.headerAddButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowAddModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}

            </View>

            {/* Filter row */}
            <View style={[styles.filterRow, { backgroundColor:"transparent" }]}>
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
                    selectedHashes.size === filteredTorrents.length
                      ? clearSelection()
                      : selectAll();
                  } else {
                    toggleSelectMode();
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={
                    selectMode 
                      ? (selectedHashes.size === filteredTorrents.length ? 'checkbox' : 'square-outline')
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
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.filterChipCompact,
                      filter === item.key && styles.filterChipElevated,
                      {
                        backgroundColor: filter === item.key ? colors.primary : colors.surface,
                        borderColor: filter === item.key ? colors.primary : colors.surfaceOutline,
                        borderWidth: filter === item.key ? 0 : 0.2,
                      },
                    ]}
                    onPress={() => {
                      haptics.light();
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
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={14}
                      color={filter === item.key ? '#FFFFFF' : colors.text}
                    />
                    <Text
                      style={[
                        styles.filterChipTextCompact,
                        {
                          color: filter === item.key ? '#FFFFFF' : colors.text,
                        },
                      ]}
                    >
                      {t(item.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
                
              {selectMode && (
                <TouchableOpacity
                  onPress={toggleSelectMode}
                  style={[
                    styles.filterChipCompact,
                    {
                      backgroundColor: colors.error,
                      borderColor: colors.error,
                      marginLeft: 8,
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                  <Text 
                    style={[styles.filterChipTextCompact, { color: '#FFFFFF' }]}
                  >
                    {t('common.close')}
                  </Text>
                </TouchableOpacity>
              )}
              </ScrollView>
            </View>
            
            {/* Sort options dropdown - positioned near search bar */}
            {showSortMenu && !selectMode && (
              <View style={[styles.sortDropdown, { 
                backgroundColor: isDark ? colors.surface : colors.background,
                borderColor: colors.surfaceOutline 
              }]}>
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.sortOption,
                      sortBy === option.key && { 
                        backgroundColor: isDark ? 'rgba(100, 150, 255, 0.15)' : colors.primary 
                        
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
                      color={sortBy === option.key ? (isDark ? colors.primary : '#FFFFFF') : (isDark ? colors.textSecondary : colors.text)}
                    />
                    <Text
                      style={[
                        styles.sortOptionText,
                        {
                          color: sortBy === option.key ? (isDark ? colors.primary : '#FFFFFF') : (isDark ? colors.textSecondary : colors.text),
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
                        color={sortBy === option.key ? (isDark ? colors.primary : '#FFFFFF') : (isDark ? colors.textSecondary : colors.text)}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {filteredTorrents.length === 0 ? (
          <View style={[styles.center, { backgroundColor: colors.background }]}>
            <Ionicons 
              name={filter === 'all' ? 'cloud-download-outline' : 'funnel-outline'} 
              size={64} 
              color={colors.textSecondary} 
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filter === 'all' ? t('screens.torrents.noTorrents') : t('screens.torrents.noResults')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {filter === 'all' 
                ? t('screens.torrents.addMagnetSubtitle') 
                : filter === 'stuck' ? t('screens.torrents.noStuckResults') : t('screens.torrents.noFilterResults', { filter })}
            </Text>
            {filter === 'all' ? (
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowAddModal(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>{t('screens.torrents.addTorrent')}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceOutline }]}
                onPress={() => setFilter('all')}
              >
                <Text style={[styles.emptyButtonText, { color: colors.text }]}>{t('screens.torrents.clearFilter')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredTorrents}
            keyExtractor={(item) => item.hash}
            style={{ backgroundColor: colors.background }}
            renderItem={({ item }) => {
              const itemIsPaused =
                item.state === 'pausedDL' || item.state === 'pausedUP' ||
                item.state === 'stoppedDL' || item.state === 'stoppedUP';

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
                        { backgroundColor: itemIsPaused ? colors.success : '#FF9500' },
                      ]}
                      onPress={() => handleSwipePauseResume(item, swipeRef)}
                    >
                      <Animated.View style={[styles.swipeActionContent, { transform: [{ scale: pauseScale }] }]}>
                        <Ionicons name={itemIsPaused ? 'play' : 'pause'} size={22} color="#FFFFFF" />
                        <Text style={styles.swipeActionText}>
                          {itemIsPaused ? t('actions.resume') : t('actions.pause')}
                        </Text>
                      </Animated.View>
                    </RectButton>
                    <RectButton
                      style={[styles.swipeAction, { backgroundColor: '#FF3B30' }]}
                      onPress={() => handleSwipeDelete(item, swipeRef)}
                    >
                      <Animated.View style={[styles.swipeActionContent, { transform: [{ scale: deleteScale }] }]}>
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
                    style={[styles.swipeActionLeft, { backgroundColor: '#007AFF' }]}
                    onPress={() => handleSwipeForceStart(item, swipeRef)}
                  >
                    <Animated.View style={[styles.swipeActionContent, { transform: [{ scale }] }]}>
                      <Ionicons name="flash" size={22} color="#FFFFFF" />
                      <Text style={styles.swipeActionText}>{t('actions.forceStart')}</Text>
                    </Animated.View>
                  </RectButton>
                );
              };

              return (
                <Swipeable
                  ref={(ref) => { swipeRef = ref; }}
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
                      >
                        <Ionicons
                          name={selectedHashes.has(item.hash) ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={selectedHashes.has(item.hash) ? colors.primary : colors.textSecondary}
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
                        onLongPress={() => {
                          haptics.medium();
                          setSelectedTorrent(item);
                          setMenuVisible(true);
                        }}
                        onPauseResume={() => handleCardPauseResume(item)}
                        compact={cardViewMode === 'compact'}
                      />
                    </View>
                  </View>
                </Swipeable>
              );
            }}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />
            }
            contentContainerStyle={styles.listContent}
            onScroll={handleScroll}
            scrollEventThrottle={50}
            removeClippedSubviews={false}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={10}
          />
        )}

        {selectMode && selectedHashes.size > 0 && (
          <View style={[styles.bulkActionsBar, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.bulkActionButton, { backgroundColor: colors.success }]}
              onPress={handleBulkResume}
              disabled={bulkLoading}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" />
              <Text style={styles.bulkActionText}>{t('actions.resume')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkActionButton, { backgroundColor: '#FF9500' }]}
              onPress={handleBulkPause}
              disabled={bulkLoading}
            >
              <Ionicons name="pause" size={20} color="#FFFFFF" />
              <Text style={styles.bulkActionText}>{t('actions.pause')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkActionButton, { backgroundColor: '#FF3B30' }]}
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
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{t('screens.torrents.addTorrent')}</Text>
                  <TouchableOpacity onPress={() => {
                    setShowAddModal(false);
                    setTorrentUrl('');
                    setSelectedFile(null);
                  }}>
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
                  onChangeText={(text) => {
                    setTorrentUrl(text);
                    if (text.trim() && selectedFile) {
                      setSelectedFile(null); // Clear file when URL is entered
                    }
                  }}
                  placeholder={t('placeholders.magnetLink')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlignVertical="top"
                  editable={!selectedFile}
                />

                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.surfaceOutline }]} />
                  <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t('common.or')}</Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.surfaceOutline }]} />
                </View>

                <TouchableOpacity
                  style={[
                    styles.filePickerButton,
                    {
                      backgroundColor: selectedFile ? colors.success : colors.background,
                      borderColor: selectedFile ? colors.success : colors.surfaceOutline,
                    },
                  ]}
                  onPress={handlePickFile}
                  disabled={!!torrentUrl.trim()}
                >
                  <Ionicons 
                    name={selectedFile ? 'checkmark-circle' : 'document'} 
                    size={20} 
                    color={selectedFile ? '#FFFFFF' : colors.text} 
                  />
                  <Text style={[
                    styles.filePickerText, 
                    { 
                      color: selectedFile ? '#FFFFFF' : colors.text,
                      fontWeight: selectedFile ? '600' : '400',
                    }
                  ]}>
                    {selectedFile ? selectedFile.name : t('screens.torrents.selectTorrentFile')}
                  </Text>
                  {selectedFile && (
                    <TouchableOpacity
                      onPress={() => setSelectedFile(null)}
                      style={styles.clearFileButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
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
                      setSelectedFile(null);
                      setShowAddModal(false);
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('common.cancel')}</Text>
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
                      <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>{t('common.add')}</Text>
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
          onClose={() => setMenuVisible(false)}
          items={actionMenuItems}
        />

        <InputModal
          visible={dlLimitModalVisible}
          title={t('torrentDetail.setDownloadLimit')}
          message={t('screens.torrents.enterLimitKbs')}
          placeholder="0"
          defaultValue={dlLimitDefaultValue}
          keyboardType="numeric"
          allowEmpty
          onCancel={() => setDlLimitModalVisible(false)}
          onConfirm={(value) => {
            setDlLimitModalVisible(false);
            handleSetDownloadLimit(value);
          }}
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
  filterChip: {
    ...buttonStyles.chip,
  },
  filterChipElevated: {
    ...shadows.filterActive,
  },
  selectButtonStationary: {
    flexShrink: 0,
  },
  filterChipText: {
    ...typography.smallSemibold,
    letterSpacing: 0.3,
  },
  filterChipCompact: {
    ...buttonStyles.chip,
  },
  filterChipTextCompact: {
    ...buttonText.chip,
  },
  listContent: {
    paddingTop: 100,
    borderRadius: borderRadius.large,
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
    borderTopColor: 'rgba(0,0,0,0.1)',
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
  clearFileButton: {
    padding: spacing.xs,
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
    right: spacing.md,
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
