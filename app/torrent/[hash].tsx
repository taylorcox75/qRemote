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
import { useTranslation } from 'react-i18next';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useTorrents } from '@/context/TorrentContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { InputModal } from '@/components/InputModal';
import { OptionPicker } from '@/components/OptionPicker';
import { TagsModal } from '@/components/TagsModal';
import { getStateColor, getStateLabel } from '@/utils/torrent-state';
import { torrentsApi } from '@/services/api/torrents';
import { syncApi } from '@/services/api/sync';
import { tagsApi } from '@/services/api/tags';
import {
  TorrentProperties,
  Tracker,
  TorrentFile,
  TorrentInfo,
} from '@/types/api';
import { formatDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/error';

export default function TorrentDetail() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { isConnected, isLoading } = useServer();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { categories, tags } = useTorrents();
  const { t } = useTranslation();

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
  const [tagsModalVisible, setTagsModalVisible] = useState(false);

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
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
    } catch (error: unknown) {
      setOptimisticPaused(null);
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('torrentDetail.deleteTorrent'),
      t('alerts.deleteName', { name: torrent!.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('alerts.torrentOnly'),
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent!.hash], false);
              showToast(t('toast.torrentDeleted'), 'success');
              router.back();
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
            }
          },
        },
        {
          text: t('alerts.withFiles'),
          style: 'destructive',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent!.hash], true);
              showToast(t('toast.torrentDeleted'), 'success');
              router.back();
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
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
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleOpenPeerDetails = async () => {
    if (!hash) return;
    setPeersModalVisible(true);
    setPeersLoading(true);
    setPeersData([]);
    try {
      const data = await syncApi.getTorrentPeers(hash, 0) as { peers?: Record<string, { progress?: number; client?: string }> };
      const peersObj = data?.peers ?? {};
      const list = Object.entries(peersObj).map(([addr, p]) => ({
        ip: addr,
        progress: typeof p?.progress === 'number' ? p.progress : 0,
        client: p?.client || '',
      }));
      list.sort((a, b) => b.progress - a.progress);
      setPeersData(list);
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
      showToast(t('toast.forceStartToggled', { status: t(`common.${!isForceStarted ? 'enabled' : 'disabled'}`) }), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
      showToast(t('toast.superSeedingToggled', { status: t(`common.${!isSuperSeeding ? 'enabled' : 'disabled'}`) }), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
      showToast(t('toast.sequentialToggled'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
      showToast(t('torrentDetail.firstLastPieceToggled'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
      showToast(t('toast.autoManagementToggled', { status: t(`common.${!isAutoManaged ? 'enabled' : 'disabled'}`) }), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
      showToast(t('toast.prioritySetMax'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
      showToast(t('toast.prioritySetMin'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleSetDownloadLimit = () => {
    setInputModalConfig({
      title: t('torrentDetail.setDownloadLimit'),
      message: t('torrentDetail.enterLimitBytes'),
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
          showToast(t('torrentDetail.dlLimitSet', { value: limit === 0 ? t('common.unlimited') : formatSpeed(limit) }), 'success');
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleSetUploadLimit = () => {
    setInputModalConfig({
      title: t('torrentDetail.setUploadLimit'),
      message: t('torrentDetail.enterLimitBytes'),
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
          showToast(t('torrentDetail.ulLimitSet', { value: limit === 0 ? t('common.unlimited') : formatSpeed(limit) }), 'success');
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleSetCategory = () => {
    setInputModalConfig({
      title: t('torrentDetail.setCategory'),
      message: t('torrentDetail.enterCategoryName'),
      defaultValue: torrent!.category || '',
      allowEmpty: true,
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentCategory([torrent!.hash], value || '');
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast(t('toast.categorySet', { value: value || t('common.none') }), 'success');
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleAddTags = () => setTagsModalVisible(true);

  // kept for backwards-compat with any remaining usages; opens same modal
  const handleRemoveTags = () => setTagsModalVisible(true);

  const handleSetLocation = () => {
    setInputModalConfig({
      title: t('torrentDetail.moveTo'),
      message: t('torrentDetail.enterNewSavePath'),
      defaultValue: properties?.save_path || '',
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        if (!value) return;
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentLocation([torrent!.hash], value);
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast(t('toast.locationUpdated'), 'success');
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleRenameTorrent = () => {
    setInputModalConfig({
      title: t('torrentDetail.renameTorrent'),
      message: t('torrentDetail.enterNewName'),
      defaultValue: torrent!.name,
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        if (!value) return;
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentName(torrent!.hash, value);
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadTorrentData();
          showToast(t('toast.torrentRenamed'), 'success');
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
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
      showToast(t('toast.categorySet', { value: value || t('common.none') }), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
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
          <Text style={[styles.message, { color: colors.text }]}>{t('torrentDetail.notConnected')}</Text>
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
          <Text style={[styles.message, { color: colors.text }]}>{t('torrentDetail.notFound')}</Text>
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
  let stateLabel = getStateLabel(torrent.state, torrent.progress, dlspeed, upspeed, t);

  if (optimisticPaused !== null) {
    if (optimisticPaused) {
      stateColor = colors.statePaused;
      stateLabel = t('torrentDetail.paused');
    } else {
      if (torrent.progress >= 1) {
        stateColor = colors.stateSeeding;
        stateLabel = t('torrentDetail.seeding');
      } else {
        stateColor = colors.stateDownloading;
        stateLabel = t('torrentDetail.downloading');
      }
    }
  }

  const priorityDisplay = torrent.priority <= 0 ? t('torrentDetail.notQueued') : `#${torrent.priority}`;

  const categoryOptions = [
    { label: t('common.none'), value: '' },
    ...Object.keys(categories || {}).map(cat => ({ label: cat, value: cat })),
    { label: t('torrentDetail.addNew'), value: '__add_new__' },
  ];

  const priorityOptions = [
    { label: t('torrentDetail.maximum'), value: 'max' },
    { label: t('torrentDetail.increase'), value: 'increase' },
    { label: t('torrentDetail.decrease'), value: 'decrease' },
    { label: t('torrentDetail.minimum'), value: 'min' },
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
                  ? t('torrentDetail.remaining', { time: formatTime(torrent.eta) })
                  : progress >= 100
                  ? t('torrentDetail.complete')
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
                {isPaused ? t('torrentDetail.resume') : t('torrentDetail.pause')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.textSecondary }]}
              onPress={handleRecheck}
              disabled={actionLoading}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>{t('torrentDetail.recheck')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.error }]}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.actionBtnText, { color: colors.error }]}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── GENERAL ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('torrentDetail.general')}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              staticRow(t('torrentDetail.size'), formatSize(torrent.total_size > 0 ? torrent.total_size : torrent.size)),
              staticRow(t('torrentDetail.downloaded'), formatSize(torrent.completed)),
              staticRow(t('torrentDetail.uploaded'), formatSize(torrent.uploaded)),
              staticRow(t('torrentDetail.ratio'), torrent.ratio ? torrent.ratio.toFixed(2) : '0.00'),
              properties && staticRow(t('torrentDetail.savePath'), properties.save_path),
              tappableRow(t('torrentDetail.category'), torrent.category || t('common.none'), () => setCategoryPickerVisible(true)),
              tappableRow(t('torrentDetail.tags'), torrent.tags || t('common.none'), handleAddTags),
              tappableRow(t('torrentDetail.removeTags'), '', handleRemoveTags),
            ])}
          </View>

          {/* ── TRANSFER ────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('torrentDetail.transfer')}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              staticRow(t('torrentDetail.dlSpeed'), formatSpeed(dlspeed)),
              staticRow(t('torrentDetail.ulSpeed'), formatSpeed(upspeed)),
              staticRow(t('torrentDetail.eta'), torrent.eta > 0 && torrent.eta < 8640000 ? formatTime(torrent.eta) : '∞'),
              tappableRow(
                t('torrentDetail.dlLimit'),
                properties && properties.dl_limit > 0 ? formatSpeed(properties.dl_limit) : t('common.unlimited'),
                handleSetDownloadLimit,
              ),
              tappableRow(
                t('torrentDetail.ulLimit'),
                properties && properties.up_limit > 0 ? formatSpeed(properties.up_limit) : t('common.unlimited'),
                handleSetUploadLimit,
              ),
            ])}
          </View>

          {/* ── NETWORK ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('torrentDetail.network')}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              tappableRow(
                t('torrentDetail.seeds'),
                `${torrent.num_seeds || 0} / ${torrent.num_complete || 0}`,
                handleOpenPeerDetails,
              ),
              tappableRow(
                t('torrentDetail.peers'),
                `${torrent.num_leechs || 0} / ${torrent.num_incomplete || 0}`,
                handleOpenPeerDetails,
              ),
              staticRow(t('torrentDetail.availability'), torrent.availability ? torrent.availability.toFixed(2) : '0.00'),
            ])}
          </View>

          {/* ── CONTENT ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('torrentDetail.content')}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              navRow(t('torrentDetail.files'), t('torrentDetail.filesCount', { count: files.length }), () =>
                router.push(`/torrent/files?hash=${hash}`),
              ),
              navRow(t('torrentDetail.trackers'), t('torrentDetail.trackersCount', { count: trackers.length }), () =>
                router.push(`/torrent/manage-trackers?hash=${hash}`),
              ),
            ])}
          </View>

          {/* ── ADVANCED ────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('torrentDetail.advanced')}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              tappableRow(t('torrentDetail.priority'), priorityDisplay, () => setPriorityPickerVisible(true)),
              toggleRow(t('torrentDetail.sequentialDownload'), torrent.seq_dl ?? false, handleSequentialDownload),
              toggleRow(t('torrentDetail.firstLastPiecePriority'), torrent.f_l_piece_prio ?? false, handleFirstLastPiecePriority),
              toggleRow(t('torrentDetail.superSeeding'), torrent.super_seeding ?? false, handleSuperSeeding),
              toggleRow(t('torrentDetail.forceStart'), torrent.force_start ?? false, handleForceStart),
              tappableRow(t('torrentDetail.rename'), torrent.name, handleRenameTorrent),
              tappableRow(t('torrentDetail.moveTo'), properties?.save_path || '', handleSetLocation),
              tappableRow(t('torrentDetail.reannounce'), '', handleReannounce),
            ])}
          </View>

          {/* ── DATES ───────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('torrentDetail.dates')}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              staticRow(t('torrentDetail.added'), formatDate(torrent.added_on)),
              staticRow(t('torrentDetail.completed'), formatDate(torrent.completion_on)),
              staticRow(t('torrentDetail.lastActivity'), formatDate(torrent.last_activity)),
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
          title={t('torrentDetail.setPriority')}
          options={priorityOptions}
          onSelect={handlePrioritySelect}
          onClose={() => setPriorityPickerVisible(false)}
        />

        <OptionPicker
          visible={categoryPickerVisible}
          title={t('torrentDetail.setCategory')}
          options={categoryOptions}
          selectedValue={torrent.category || ''}
          onSelect={handleCategorySelect}
          onClose={() => setCategoryPickerVisible(false)}
        />

        <TagsModal
          visible={tagsModalVisible}
          currentTagsCsv={torrent.tags || ''}
          allServerTags={tags}
          loading={actionLoading}
          onAddTag={async (tag) => {
            try {
              setActionLoading(true);
              await torrentsApi.addTorrentTags([torrent.hash], [tag]);
              await loadTorrentData();
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
            } finally {
              setActionLoading(false);
            }
          }}
          onRemoveTag={async (tag) => {
            try {
              setActionLoading(true);
              await torrentsApi.removeTorrentTags([torrent.hash], [tag]);
              await loadTorrentData();
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
            } finally {
              setActionLoading(false);
            }
          }}
          onCreateTag={async (tag) => {
            try {
              setActionLoading(true);
              await tagsApi.createTags([tag]);
              await torrentsApi.addTorrentTags([torrent.hash], [tag]);
              await loadTorrentData();
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
            } finally {
              setActionLoading(false);
            }
          }}
          onClose={() => setTagsModalVisible(false)}
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
                <Text style={[styles.peersModalTitle, { color: colors.text }]}>{t('torrentDetail.connectedPeers')}</Text>
                <TouchableOpacity onPress={() => setPeersModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {peersLoading ? (
                <View style={styles.peersModalBody}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.peersModalLoadingText, { color: colors.textSecondary }]}>
                    {t('torrentDetail.loadingPeers')}
                  </Text>
                </View>
              ) : peersData.length === 0 ? (
                <View style={styles.peersModalBody}>
                  <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.peersModalEmptyText, { color: colors.textSecondary }]}>
                    {t('torrentDetail.noConnectedPeers')}
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
