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
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTorrents } from '../../context/TorrentContext';
import { useServer } from '../../context/ServerContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { TorrentInfo, TorrentState } from '../../types/api';
import { TorrentCard } from '../../components/TorrentCard';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { torrentsApi } from '../../services/api/torrents';
import { storageService } from '../../services/storage';
import { shadows } from '../../constants/shadows';
import { spacing, borderRadius } from '../../constants/spacing';
import { buttonStyles, buttonText } from '../../constants/buttons';
import { typography } from '../../constants/typography';

export default function TorrentsScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const { torrents, isLoading, error, refresh, isRecoveringFromBackground, initialLoadComplete } = useTorrents();
  const { isConnected, currentServer, isLoading: serverIsLoading } = useServer();
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
  
  // Card view mode state
  const [cardViewMode, setCardViewMode] = useState<'compact' | 'expanded'>('compact');

  // Scroll animation refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderVisible = useRef(true);
  const scrollThreshold = useRef(0);
  const fabScale = useRef(new Animated.Value(1)).current;
  const isFabVisible = useRef(true);
  const isTabBarVisible = useRef(true);
  const isAnimating = useRef(false);

  // Helper function to get tab bar style
  const getTabBarStyle = (visible: boolean) => ({
    backgroundColor: colors.surface,
    borderTopWidth: 0.18,
    borderTopColor: colors.surfaceOutline,
    display: visible ? 'flex' : 'none' as const,
  });

  // Update tab bar visibility
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: getTabBarStyle(isTabBarVisible.current),
    });
  }, [navigation, colors.surface, colors.surfaceOutline]);

  // Reset tab bar visibility when screen is focused
  useFocusEffect(
    useCallback(() => {
      isTabBarVisible.current = true;
      navigation.setOptions({
        tabBarStyle: getTabBarStyle(true),
      });
    }, [navigation, colors.surface, colors.surfaceOutline])
  );

  // Track last known default filter so we only sync when user changes it in Settings
  const lastDefaultFilterRef = useRef<string | null>(null);

  // Load card view mode and check for filter preference changes on screen focus
  useFocusEffect(
    useCallback(() => {
      const loadPreferences = async () => {
        try {
          const prefs = await storageService.getPreferences();
          const viewMode = prefs.cardViewMode || 'compact';
          setCardViewMode(viewMode);
          
          // Only update filter when the default filter preference has changed in Settings
          // (not when the user selects a different filter on this screen)
          const newDefault = prefs.defaultFilter || 'all';
          if (lastDefaultFilterRef.current !== null && lastDefaultFilterRef.current !== newDefault) {
            setFilter(newDefault);
          }
          lastDefaultFilterRef.current = newDefault;
        } catch (error) {
          setCardViewMode('compact');
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
      } catch (error) {
        // Use defaults if loading fails
      }
    };
    loadDefaultPreferences();
    // Only run once on mount (app launch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (selectMode) {
      setSelectedHashes(new Set());
    }
    setSelectMode(!selectMode);
  };

  const toggleSelection = (hash: string) => {
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
    setBulkLoading(true);
    try {
      await torrentsApi.pauseTorrents(Array.from(selectedHashes));
      refresh();
      setSelectedHashes(new Set());
      setSelectMode(false);
    } catch (error: any) {
      showToast(error.message || t('errors.failedToPause'), 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkResume = async () => {
    if (selectedHashes.size === 0) return;
    setBulkLoading(true);
    try {
      await torrentsApi.resumeTorrents(Array.from(selectedHashes));
      refresh();
      setSelectedHashes(new Set());
      setSelectMode(false);
    } catch (error: any) {
      showToast(error.message || t('errors.failedToResume'), 'error');
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
          text: 'Torrent Only',
          onPress: async () => {
            setBulkLoading(true);
            try {
              await torrentsApi.deleteTorrents(Array.from(selectedHashes), false);
              refresh();
              setSelectedHashes(new Set());
              setSelectMode(false);
              showToast(t('toast.torrentsDeleted_other', { count }), 'success');
            } catch (error: any) {
              showToast(error.message || t('errors.failedToDelete'), 'error');
            } finally {
              setBulkLoading(false);
            }
          },
        },
        {
          text: 'With Files',
          style: 'destructive',
          onPress: async () => {
            setBulkLoading(true);
            try {
              await torrentsApi.deleteTorrents(Array.from(selectedHashes), true);
              refresh();
              setSelectedHashes(new Set());
              setSelectMode(false);
              showToast(t('toast.torrentsDeleted_other', { count }), 'success');
            } catch (error: any) {
              showToast(error.message || t('errors.failedToDelete'), 'error');
            } finally {
              setBulkLoading(false);
            }
          },
        },
      ]
    );
  };

  // Torrent actions
  const handleAddTorrent = () => {
    setShowAddModal(true);
  };

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
        showToast(`File selected: ${file.name}`, 'success');
      }
    } catch (error: any) {
      showToast(error.message || t('errors.failedToPickFile'), 'error');
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
      
      if (selectedFile) {
        // Upload .torrent file
        await torrentsApi.addTorrentFile(selectedFile);
      } else {
        // Add magnet/URL
        await torrentsApi.addTorrent(torrentUrl.trim());
      }
      
      setTorrentUrl('');
      setSelectedFile(null);
      setShowAddModal(false);
      refresh();
      showToast(t('toast.torrentAdded'), 'success');
    } catch (error: any) {
      showToast(error.message || t('errors.failedToAdd'), 'error');
    } finally {
      setAddingTorrent(false);
    }
  };

  // Scroll handler - memoized to prevent re-creation
  const handleScroll = useCallback((event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const scrollDifference = currentScrollY - lastScrollY.current;

    // Detect if we're at or near the bottom (within 50px of bottom)
    const distanceFromBottom = contentHeight - layoutHeight - currentScrollY;
    const isNearBottom = distanceFromBottom < 50;

    // Always show header, FAB, and tab bar when at the top
    if (currentScrollY <= 10) {
      if (!isHeaderVisible.current) {
        isHeaderVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      if (!isFabVisible.current) {
        isFabVisible.current = true;
        Animated.timing(fabScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      if (!isTabBarVisible.current) {
        isTabBarVisible.current = true;
        navigation.setOptions({
          tabBarStyle: getTabBarStyle(true),
        });
      }
      lastScrollY.current = currentScrollY;
      return;
    }

    // When near bottom, hide FAB but keep header visible
    if (isNearBottom) {
      if (!isHeaderVisible.current) {
        isHeaderVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      // Hide FAB when at bottom
      if (isFabVisible.current) {
        isFabVisible.current = false;
        Animated.timing(fabScale, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      if (!isTabBarVisible.current) {
        isTabBarVisible.current = true;
        navigation.setOptions({
          tabBarStyle: getTabBarStyle(true),
        });
      }
      lastScrollY.current = currentScrollY;
      return;
    }

    const minMovement = 15; // Increased threshold to prevent jitter

    // Only update if there's significant movement to prevent rapid toggling
    if (Math.abs(scrollDifference) < minMovement) {
      lastScrollY.current = currentScrollY;
      return;
    }

    // Prevent rapid toggling if animation is in progress
    if (isAnimating.current) {
      lastScrollY.current = currentScrollY;
      return;
    }

    // Prioritize showing header when scrolling up - respond immediately
    if (scrollDifference < -minMovement && !isHeaderVisible.current) {
      // Scrolling up - show header, FAB, and tab bar immediately
      isAnimating.current = true;
      isHeaderVisible.current = true;
      isFabVisible.current = true;
      isTabBarVisible.current = true;
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        isAnimating.current = false;
      });
      Animated.timing(fabScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      navigation.setOptions({
        tabBarStyle: getTabBarStyle(true),
      });
    } else if (scrollDifference > minMovement && isHeaderVisible.current && !isNearBottom) {
      // Scrolling down - hide header, FAB, and tab bar (but not when bouncing at bottom)
      isAnimating.current = true;
      isHeaderVisible.current = false;
      isFabVisible.current = false;
      isTabBarVisible.current = false;
      Animated.timing(headerTranslateY, {
        toValue: -200,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        isAnimating.current = false;
      });
      Animated.timing(fabScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      navigation.setOptions({
        tabBarStyle: getTabBarStyle(false),
      });
    }

    lastScrollY.current = currentScrollY;
  }, [navigation, colors.surface, colors.surfaceOutline]);

  // Filter options
  const filterOptions = [
    { key: 'all', labelKey: 'filters.all', icon: 'grid-outline' },
    { key: 'active', labelKey: 'filters.active', icon: 'pulse' },
    { key: 'completed', labelKey: 'filters.completed', icon: 'checkmark-circle' },
    { key: 'paused', labelKey: 'filters.paused', icon: 'pause-circle' },
    { key: 'stuck', labelKey: 'filters.stuck', icon: 'warning' },
    { key: 'downloading', labelKey: 'filters.downloading', icon: 'arrow-down' },
    { key: 'uploading', labelKey: 'filters.uploading', icon: 'arrow-up' },
  ];

  const sortOptions = [
    { key: 'added_on' as const, labelKey: 'sort.dateAdded', icon: 'time-outline' },
    { key: 'name' as const, labelKey: 'sort.name', icon: 'text-outline' },
    { key: 'size' as const, labelKey: 'sort.size', icon: 'albums-outline' },
    { key: 'progress' as const, labelKey: 'sort.progress', icon: 'stats-chart-outline' },
    { key: 'ratio' as const, labelKey: 'sort.ulRatio', icon: 'swap-horizontal-outline' },
    { key: 'dlspeed' as const, labelKey: 'sort.dlSpeed', icon: 'arrow-down-outline' },
    { key: 'upspeed' as const, labelKey: 'sort.ulSpeed', icon: 'arrow-up-outline' },
  ];

  // Early returns
  // Only show "Not Connected" screen if no server is configured (check this FIRST)
  if (!isConnected && !currentServer && !serverIsLoading) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="cloud-offline-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('screens.torrents.notConnected')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t('screens.torrents.notConnectedSubtitle')}
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.emptyButtonText}>{t('common.goToSettings')}</Text>
          </TouchableOpacity>
        </View>
      </>
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
              {/* Search input */}
              <View
                style={[
                  styles.searchInputContainer,
                  {
                    backgroundColor: colors.surface,
                    borderWidth: 0.1,
                    borderColor: colors.surfaceOutline
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
              </View>
              
              {/* Loading indicator when syncing */}
              {isLoading && (
                <View style={[styles.syncIndicator, { backgroundColor: colors.background, borderColor: colors.surfaceOutline }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              
              {/* Sort button */}
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
                      name={item.icon as any}
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
                      name={option.icon as any}
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
            renderItem={({ item, index }) => (
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
                    viewMode={cardViewMode}
                    onPress={() => {
                      if (selectMode) {
                        toggleSelection(item.hash);
                      } else {
                        router.push(`/torrent/${item.hash}`);
                      }
                    }}
                  />
                </View>
              </View>
            )}
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

        {!selectMode && (
          <Animated.View
            style={[
              styles.fab,
              {
                backgroundColor: colors.primary,
                transform: [{ scale: fabScale }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleAddTorrent}
              style={styles.fabTouchable}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
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
                  Torrent URL or Magnet Link
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
                  <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
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
                    {selectedFile ? selectedFile.name : 'Select .torrent file'}
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
                      <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
            </KeyboardAvoidingView>
          </View>
        </Modal>
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
    // paddingBottom: 50, // Space for FAB and last card interaction
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
  fab: {
    position: 'absolute',
    bottom: spacing.xxl,
    right: spacing.xxl,
    ...buttonStyles.fab,
  },
  fabTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  searchSortButton: {
    ...buttonStyles.icon,
  },
  syncIndicator: {
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
