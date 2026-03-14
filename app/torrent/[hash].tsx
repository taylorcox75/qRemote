/**
 * [hash].tsx — Torrent detail screen with iOS-style grouped inset sections.
 *
 * Layout: Hero → Actions → General → Transfer → Network → Content → Advanced → Dates
 * All 16 former "Advanced" button actions remain accessible as toggle, picker,
 * input, or navigation rows.
 *
 * Key exports: TorrentDetail (default)
 */
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  AppState,
  AppStateStatus,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useTorrents } from '@/context/TorrentContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { InputModal } from '@/components/InputModal';
import { OptionPicker } from '@/components/OptionPicker';
import { getStateColor, getStateLabel } from '@/utils/torrent-state';
import { torrentsApi } from '@/services/api/torrents';
import { syncApi } from '@/services/api/sync';
import {
  TorrentProperties,
  Tracker,
  TorrentFile,
  TorrentInfo,
} from '@/types/api';
import { formatDate } from '@/utils/format';

export default function TorrentDetail() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { isConnected, isLoading } = useServer();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { categories } = useTorrents();

  useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
    });
  }, [navigation]);

  const [torrent, setTorrent] = useState<TorrentInfo | null>(null);
  const [properties, setProperties] = useState<TorrentProperties | null>(null);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [files, setFiles] = useState<TorrentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null);

  const [peersModalVisible, setPeersModalVisible] = useState(false);
  const [peersData, setPeersData] = useState<Array<{ ip: string; progress: number; client?: string }>>([]);
  const [peersLoading, setPeersLoading] = useState(false);

  const [inputModalVisible, setInputModalVisible] = useState(false);
  const [inputModalConfig, setInputModalConfig] = useState<{
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    keyboardType?: 'default' | 'numeric';
    allowEmpty?: boolean;
    onConfirm: (value: string) => void;
  }>({ title: '', onConfirm: () => {} });

  const [priorityPickerVisible, setPriorityPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────

  useEffect(() => {
    if (hash && isConnected) {
      loadTorrentData();
    }
  }, [hash, isConnected]);

  const loadTorrentData = async () => {
    try {
      setLoading(true);
      const [torrentList, props, trackersData, filesData] = await Promise.all([
        torrentsApi.getTorrentList(undefined, undefined, undefined, undefined, undefined, undefined, undefined, [hash]),
        torrentsApi.getTorrentProperties(hash),
        torrentsApi.getTorrentTrackers(hash),
        torrentsApi.getTorrentContents(hash),
      ]);

      if (torrentList.length > 0) {
        setTorrent(torrentList[0]);
      }
      setProperties(props);
      setTrackers(trackersData);
      setFiles(filesData);
      return torrentList.length > 0 ? torrentList[0] : null;
    } catch (error: any) {
      showToast(error.message || 'Failed to load torrent details', 'error');
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTorrentData();
  };

  const silentRefresh = useCallback(async () => {
    try {
      const [torrentList, props, trackersData, filesData] = await Promise.all([
        torrentsApi.getTorrentList(undefined, undefined, undefined, undefined, undefined, undefined, undefined, [hash]),
        torrentsApi.getTorrentProperties(hash),
        torrentsApi.getTorrentTrackers(hash),
        torrentsApi.getTorrentContents(hash),
      ]);

      if (torrentList.length > 0) setTorrent(torrentList[0]);
      setProperties(props);
      setTrackers(trackersData);
      setFiles(filesData);
    } catch {
      // Silent failure — don't interrupt the user
    }
  }, [hash]);

  // ── Polling ───────────────────────────────────────────────────────────

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      silentRefresh();
    }, 2000);
  }, [silentRefresh]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!hash || !isConnected) {
      stopPolling();
      return;
    }
    startPolling();
    return stopPolling;
  }, [hash, isConnected, startPolling, stopPolling]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev === 'background' && nextState === 'active' && isConnected && hash) {
        silentRefresh();
        startPolling();
      } else if (nextState === 'background') {
        stopPolling();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [hash, isConnected, silentRefresh, startPolling, stopPolling]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handlePauseResume = async () => {
    if (actionLoading) return;
    const currentlyPaused = torrent!.state.includes('paused') || torrent!.state.includes('stopped');
    const expectedNewState = !currentlyPaused;
    setOptimisticPaused(expectedNewState);
    setActionLoading(true);
    try {
      if (currentlyPaused) {
        await torrentsApi.resumeTorrents([torrent!.hash]);
      } else {
        await torrentsApi.pauseTorrents([torrent!.hash]);
      }
      let attempts = 0;
      const maxAttempts = 6;
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const freshTorrent = await loadTorrentData();
        if (freshTorrent) {
          const newIsPaused = freshTorrent.state.includes('paused') || freshTorrent.state.includes('stopped');
          if (newIsPaused === expectedNewState) break;
        }
        attempts++;
      }
      setOptimisticPaused(null);
      setActionLoading(false);
    } catch (error: any) {
      setOptimisticPaused(null);
      showToast(error.message || 'Failed to update torrent', 'error');
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Torrent',
      `Delete "${torrent!.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Torrent Only',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent!.hash], false);
              showToast('Torrent deleted', 'success');
              router.back();
            } catch (error: any) {
              showToast(error.message || 'Failed to delete torrent', 'error');
            }
          },
        },
        {
          text: 'With Files',
          style: 'destructive',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent!.hash], true);
              showToast('Torrent deleted', 'success');
              router.back();
            } catch (error: any) {
              showToast(error.message || 'Failed to delete torrent', 'error');
            }
          },
        },
      ]
    );
  };

  const handleRecheck = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.recheckTorrents([torrent!.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to recheck torrent', 'error');
      setActionLoading(false);
    }
  };

  const handleOpenPeerDetails = async () => {
    if (!hash) return;
    setPeersModalVisible(true);
    setPeersLoading(true);
    setPeersData([]);
    try {
      const data = await syncApi.getTorrentPeers(hash, 0);
      const peersObj = data?.peers ?? {};
      const list = Object.entries(peersObj).map(([addr, p]: [string, any]) => ({
        ip: addr,
        progress: typeof p?.progress === 'number' ? p.progress : 0,
        client: p?.client || '',
      }));
      list.sort((a, b) => b.progress - a.progress);
      setPeersData(list);
    } catch (error: any) {
      showToast(error.message || 'Failed to load peer details', 'error');
      setPeersModalVisible(false);
    } finally {
      setPeersLoading(false);
    }
  };

  const handleReannounce = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.reannounceTorrents([torrent!.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to reannounce torrent', 'error');
      setActionLoading(false);
    }
  };

  const handleForceStart = async () => {
    try {
      setActionLoading(true);
      const isForceStarted = torrent?.force_start || false;
      await torrentsApi.setForceStart([torrent!.hash], !isForceStarted);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast(`Force start ${!isForceStarted ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle force start', 'error');
      setActionLoading(false);
    }
  };

  const handleSuperSeeding = async () => {
    try {
      setActionLoading(true);
      const isSuperSeeding = torrent?.super_seeding || false;
      await torrentsApi.setSuperSeeding([torrent!.hash], !isSuperSeeding);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast(`Super seeding ${!isSuperSeeding ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle super seeding', 'error');
      setActionLoading(false);
    }
  };

  const handleSequentialDownload = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.toggleSequentialDownload([torrent!.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast('Sequential download toggled', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle sequential download', 'error');
      setActionLoading(false);
    }
  };

  const handleFirstLastPiecePriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.setFirstLastPiecePriority([torrent!.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast('First/Last piece priority toggled', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set priority', 'error');
      setActionLoading(false);
    }
  };

  const handleAutomaticManagement = async () => {
    try {
      setActionLoading(true);
      const isAutoManaged = torrent?.auto_tmm || false;
      await torrentsApi.setAutomaticTorrentManagement([torrent!.hash], !isAutoManaged);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast(`Automatic management ${!isAutoManaged ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle automatic management', 'error');
      setActionLoading(false);
    }
  };

  const handleIncreasePriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.increasePriority([torrent!.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to increase priority', 'error');
      setActionLoading(false);
    }
  };

  const handleDecreasePriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.decreasePriority([torrent!.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to decrease priority', 'error');
      setActionLoading(false);
    }
  };

  const handleMaxPriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.setMaximalPriority([torrent!.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast('Priority set to maximum', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set priority', 'error');
      setActionLoading(false);
    }
  };

  const handleMinPriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.setMinimalPriority([torrent!.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast('Priority set to minimum', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set priority', 'error');
      setActionLoading(false);
    }
  };

  const handleSetDownloadLimit = () => {
    setInputModalConfig({
      title: 'Set Download Limit',
      message: 'Enter limit in bytes (0 for unlimited)',
      defaultValue: properties?.dl_limit?.toString() || '0',
      keyboardType: 'numeric',
      allowEmpty: true,
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        try {
          setActionLoading(true);
          const limit = parseInt(value) || 0;
          await torrentsApi.setTorrentDownloadLimit([torrent!.hash], limit);
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast(`Download limit set to ${limit === 0 ? 'unlimited' : formatSpeed(limit)}`, 'success');
        } catch (error: any) {
          showToast(error.message || 'Failed to set download limit', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleSetUploadLimit = () => {
    setInputModalConfig({
      title: 'Set Upload Limit',
      message: 'Enter limit in bytes (0 for unlimited)',
      defaultValue: properties?.up_limit?.toString() || '0',
      keyboardType: 'numeric',
      allowEmpty: true,
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        try {
          setActionLoading(true);
          const limit = parseInt(value) || 0;
          await torrentsApi.setTorrentUploadLimit([torrent!.hash], limit);
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast(`Upload limit set to ${limit === 0 ? 'unlimited' : formatSpeed(limit)}`, 'success');
        } catch (error: any) {
          showToast(error.message || 'Failed to set upload limit', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleSetCategory = () => {
    setInputModalConfig({
      title: 'Set Category',
      message: 'Enter category name',
      defaultValue: torrent!.category || '',
      allowEmpty: true,
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentCategory([torrent!.hash], value || '');
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast(`Category set to ${value || 'None'}`, 'success');
        } catch (error: any) {
          showToast(error.message || 'Failed to set category', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleAddTags = () => {
    setInputModalConfig({
      title: 'Add Tags',
      message: 'Enter tags (comma-separated)',
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        if (!value) return;
        try {
          setActionLoading(true);
          const tags = value.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag !== '');
          await torrentsApi.addTorrentTags([torrent!.hash], tags);
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast(`Added ${tags.length} tag(s)`, 'success');
        } catch (error: any) {
          showToast(error.message || 'Failed to add tags', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleRemoveTags = () => {
    setInputModalConfig({
      title: 'Remove Tags',
      message: 'Enter tags to remove (comma-separated)',
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        if (!value) return;
        try {
          setActionLoading(true);
          const tags = value.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag !== '');
          await torrentsApi.removeTorrentTags([torrent!.hash], tags);
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast(`Removed ${tags.length} tag(s)`, 'success');
        } catch (error: any) {
          showToast(error.message || 'Failed to remove tags', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleSetLocation = () => {
    setInputModalConfig({
      title: 'Move to…',
      message: 'Enter new save path',
      defaultValue: properties?.save_path || '',
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        if (!value) return;
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentLocation([torrent!.hash], value);
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast('Location updated', 'success');
        } catch (error: any) {
          showToast(error.message || 'Failed to set location', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleRenameTorrent = () => {
    setInputModalConfig({
      title: 'Rename Torrent',
      message: 'Enter new name',
      defaultValue: torrent!.name,
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        if (!value) return;
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentName(torrent!.hash, value);
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast('Torrent renamed', 'success');
        } catch (error: any) {
          showToast(error.message || 'Failed to rename torrent', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  // ── Picker handlers ───────────────────────────────────────────────────

  const handlePrioritySelect = async (value: string) => {
    setPriorityPickerVisible(false);
    switch (value) {
      case 'max': await handleMaxPriority(); break;
      case 'increase': await handleIncreasePriority(); break;
      case 'decrease': await handleDecreasePriority(); break;
      case 'min': await handleMinPriority(); break;
    }
  };

  const handleCategorySelect = async (value: string) => {
    setCategoryPickerVisible(false);
    if (value === '__add_new__') {
      handleSetCategory();
      return;
    }
    try {
      setActionLoading(true);
      await torrentsApi.setTorrentCategory([torrent!.hash], value);
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadTorrentData();
      showToast(`Category set to ${value || 'None'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set category', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading & error states ────────────────────────────────────────────

  if (isLoading && !isConnected) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!isConnected) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.text }]}>Not connected to a server</Text>
        </View>
      </>
    );
  }

  if (loading && !torrent) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!torrent) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.text }]}>Torrent not found</Text>
        </View>
      </>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────

  const formatTime = (seconds: number): string => {
    if (seconds < 0) return '∞';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    return `${formatSize(bytesPerSecond)}/s`;
  };

  const progress = (torrent.progress || 0) * 100;
  const dlspeed = torrent.dlspeed ?? 0;
  const upspeed = torrent.upspeed ?? 0;
  const actualIsPaused = torrent.state.includes('paused') || torrent.state.includes('stopped');
  const isPaused = optimisticPaused !== null ? optimisticPaused : actualIsPaused;

  let stateColor = getStateColor(torrent.state, torrent.progress, dlspeed, upspeed, colors);
  let stateLabel = getStateLabel(torrent.state, torrent.progress, dlspeed, upspeed);

  if (optimisticPaused !== null) {
    if (optimisticPaused) {
      stateColor = colors.statePaused;
      stateLabel = 'Paused';
    } else {
      if (torrent.progress >= 1) {
        stateColor = colors.stateSeeding;
        stateLabel = 'Seeding';
      } else {
        stateColor = colors.stateDownloading;
        stateLabel = 'Downloading';
      }
    }
  }

  const priorityDisplay = torrent.priority <= 0 ? 'Not queued' : `#${torrent.priority}`;

  const categoryOptions = [
    { label: 'None', value: '' },
    ...Object.keys(categories || {}).map(cat => ({ label: cat, value: cat })),
    { label: 'Add New…', value: '__add_new__' },
  ];

  const priorityOptions = [
    { label: 'Maximum', value: 'max' },
    { label: 'Increase', value: 'increase' },
    { label: 'Decrease', value: 'decrease' },
    { label: 'Minimum', value: 'min' },
  ];

  // ── Row render helpers ────────────────────────────────────────────────

  const renderRows = (rows: (React.ReactNode | null | false | undefined)[]) => {
    const filtered = rows.filter(Boolean) as React.ReactNode[];
    return filtered.map((row, i) => (
      <React.Fragment key={i}>
        {row}
        {i < filtered.length - 1 && (
          <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
        )}
      </React.Fragment>
    ));
  };

  const staticRow = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );

  const tappableRow = (label: string, value: string, onPress: () => void) => (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={actionLoading}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const toggleRow = (label: string, value: boolean, onToggle: () => void) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={actionLoading}
        trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
      />
    </View>
  );

  const navRow = (label: string, value: string, onPress: () => void) => (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </View>
    </TouchableOpacity>
  );

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.topBar, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {/* ── Hero ────────────────────────────────────────────── */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={3}>
              {torrent.name}
            </Text>
            <View style={styles.stateRow}>
              <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                {stateLabel}
              </Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceOutline }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(progress, 100)}%`, backgroundColor: stateColor },
                ]}
              />
            </View>
            <View style={styles.heroStatsRow}>
              <Text style={[styles.heroStatText, { color: colors.textSecondary }]}>
                {torrent.eta > 0 && torrent.eta < 8640000
                  ? `${formatTime(torrent.eta)} remaining`
                  : progress >= 100
                  ? 'Complete'
                  : '∞'}
              </Text>
              <Text style={[styles.heroStatText, { color: colors.textSecondary }]}>
                {formatSize(torrent.total_size > 0 ? torrent.total_size : torrent.size)}
              </Text>
            </View>
          </View>

          {/* ── Actions ─────────────────────────────────────────── */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.primary }]}
              onPress={handlePauseResume}
              disabled={actionLoading}
            >
              <Ionicons name={isPaused ? 'play' : 'pause'} size={18} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.textSecondary }]}
              onPress={handleRecheck}
              disabled={actionLoading}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Recheck</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.error }]}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.actionBtnText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>

          {/* ── GENERAL ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GENERAL</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              staticRow('Size', formatSize(torrent.total_size > 0 ? torrent.total_size : torrent.size)),
              staticRow('Downloaded', formatSize(torrent.downloaded)),
              staticRow('Uploaded', formatSize(torrent.uploaded)),
              staticRow('Ratio', torrent.ratio ? torrent.ratio.toFixed(2) : '0.00'),
              properties && staticRow('Save Path', properties.save_path),
              tappableRow('Category', torrent.category || 'None', () => setCategoryPickerVisible(true)),
              tappableRow('Tags', torrent.tags || 'None', handleAddTags),
              tappableRow('Remove Tags', '', handleRemoveTags),
            ])}
          </View>

          {/* ── TRANSFER ────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TRANSFER</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              staticRow('DL Speed', formatSpeed(dlspeed)),
              staticRow('UL Speed', formatSpeed(upspeed)),
              staticRow('ETA', torrent.eta > 0 && torrent.eta < 8640000 ? formatTime(torrent.eta) : '∞'),
              tappableRow(
                'DL Limit',
                properties && properties.dl_limit > 0 ? formatSpeed(properties.dl_limit) : 'Unlimited',
                handleSetDownloadLimit,
              ),
              tappableRow(
                'UL Limit',
                properties && properties.up_limit > 0 ? formatSpeed(properties.up_limit) : 'Unlimited',
                handleSetUploadLimit,
              ),
            ])}
          </View>

          {/* ── NETWORK ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NETWORK</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              tappableRow(
                'Seeds',
                `${torrent.num_seeds || 0} / ${torrent.num_complete || 0}`,
                handleOpenPeerDetails,
              ),
              tappableRow(
                'Peers',
                `${torrent.num_leechs || 0} / ${torrent.num_incomplete || 0}`,
                handleOpenPeerDetails,
              ),
              staticRow('Availability', torrent.availability ? torrent.availability.toFixed(2) : '0.00'),
            ])}
          </View>

          {/* ── CONTENT ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CONTENT</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              navRow('Files', `${files.length} file${files.length !== 1 ? 's' : ''}`, () =>
                router.push(`/torrent/files?hash=${hash}`),
              ),
              navRow('Trackers', `${trackers.length} tracker${trackers.length !== 1 ? 's' : ''}`, () =>
                router.push(`/torrent/manage-trackers?hash=${hash}`),
              ),
            ])}
          </View>

          {/* ── ADVANCED ────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ADVANCED</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              tappableRow('Priority', priorityDisplay, () => setPriorityPickerVisible(true)),
              toggleRow('Sequential Download', torrent.seq_dl ?? false, handleSequentialDownload),
              toggleRow('First/Last Piece Priority', torrent.f_l_piece_prio ?? false, handleFirstLastPiecePriority),
              toggleRow('Super Seeding', torrent.super_seeding ?? false, handleSuperSeeding),
              toggleRow('Force Start', torrent.force_start ?? false, handleForceStart),
              tappableRow('Rename', torrent.name, handleRenameTorrent),
              tappableRow('Move to…', properties?.save_path || '', handleSetLocation),
              tappableRow('Reannounce', '', handleReannounce),
            ])}
          </View>

          {/* ── DATES ───────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATES</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              staticRow('Added', formatDate(torrent.added_on)),
              staticRow('Completed', formatDate(torrent.completion_on)),
              staticRow('Last Activity', formatDate(torrent.last_activity)),
            ])}
          </View>
        </ScrollView>

        {/* ── Modals ──────────────────────────────────────────── */}

        <InputModal
          visible={inputModalVisible}
          title={inputModalConfig.title}
          message={inputModalConfig.message}
          placeholder={inputModalConfig.placeholder}
          defaultValue={inputModalConfig.defaultValue}
          keyboardType={inputModalConfig.keyboardType}
          allowEmpty={inputModalConfig.allowEmpty}
          onCancel={() => setInputModalVisible(false)}
          onConfirm={inputModalConfig.onConfirm}
        />

        <OptionPicker
          visible={priorityPickerVisible}
          title="Set Priority"
          options={priorityOptions}
          onSelect={handlePrioritySelect}
          onClose={() => setPriorityPickerVisible(false)}
        />

        <OptionPicker
          visible={categoryPickerVisible}
          title="Set Category"
          options={categoryOptions}
          selectedValue={torrent.category || ''}
          onSelect={handleCategorySelect}
          onClose={() => setCategoryPickerVisible(false)}
        />

        {/* Peers Modal */}
        <Modal
          visible={peersModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setPeersModalVisible(false)}
        >
          <View style={styles.peersModalOverlay}>
            <View style={[styles.peersModalContent, { backgroundColor: colors.surface }]}>
              <View style={[styles.peersModalHeader, { borderBottomColor: colors.surfaceOutline }]}>
                <Text style={[styles.peersModalTitle, { color: colors.text }]}>Connected Peers</Text>
                <TouchableOpacity onPress={() => setPeersModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {peersLoading ? (
                <View style={styles.peersModalBody}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.peersModalLoadingText, { color: colors.textSecondary }]}>
                    Loading peer details…
                  </Text>
                </View>
              ) : peersData.length === 0 ? (
                <View style={styles.peersModalBody}>
                  <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.peersModalEmptyText, { color: colors.textSecondary }]}>
                    No connected peers
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.peersModalScroll} contentContainerStyle={styles.peersModalScrollContent}>
                  {peersData.map((p, idx) => (
                    <View
                      key={`${p.ip}-${idx}`}
                      style={[styles.peerRow, { borderBottomColor: colors.surfaceOutline }]}
                    >
                      <Text style={[styles.peerProgress, { color: colors.text }]}>
                        {(p.progress * 100).toFixed(1)}%
                      </Text>
                      <View style={styles.peerInfo}>
                        <Text style={[styles.peerIp, { color: colors.text }]} numberOfLines={1}>
                          {p.ip}
                        </Text>
                        {p.client ? (
                          <Text style={[styles.peerClient, { color: colors.textSecondary }]} numberOfLines={1}>
                            {p.client}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },

  // Hero
  heroCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 8,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateText: {
    fontSize: 15,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStatText: {
    fontSize: 13,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Section
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 16,
    marginBottom: 6,
    marginTop: 20,
  },
  sectionCard: {
    borderRadius: 10,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 44,
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowValue: {
    fontSize: 16,
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '60%',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 4,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },

  // Peers modal
  peersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  peersModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  peersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  peersModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  peersModalBody: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  peersModalLoadingText: {
    fontSize: 14,
  },
  peersModalEmptyText: {
    fontSize: 14,
  },
  peersModalScroll: {
    maxHeight: 400,
  },
  peersModalScrollContent: {
    paddingBottom: 24,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 16,
  },
  peerProgress: {
    fontSize: 16,
    fontWeight: '600',
    width: 52,
  },
  peerInfo: {
    flex: 1,
    minWidth: 0,
  },
  peerIp: {
    fontSize: 14,
    fontWeight: '500',
  },
  peerClient: {
    fontSize: 12,
    marginTop: 2,
  },
});
