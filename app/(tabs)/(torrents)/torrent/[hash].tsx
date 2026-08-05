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
  Modal,
  AppState,
  AppStateStatus,
  Switch,
  useWindowDimensions,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useTorrents } from '@/context/TorrentContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { SpeedGraph, computeSpeedGraphMax, niceGraphCeiling } from '@/components/SpeedGraph';
import { PieceMap } from '@/components/PieceMap';
import { InputModal, InputModalPreset } from '@/components/InputModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { OptionPicker } from '@/components/OptionPicker';
import { TagsModal } from '@/components/TagsModal';
import { CategoryModal } from '@/components/CategoryModal';
import { getStateColor, getStateLabel, hasEta } from '@/utils/torrent-state';
import { torrentsApi } from '@/services/api/torrents';
import { syncApi } from '@/services/api/sync';
import { tagsApi } from '@/services/api/tags';
import { categoriesApi } from '@/services/api/categories';
import { TorrentProperties, Tracker, TorrentFile, TorrentInfo } from '@/types/api';
import {
  formatDate,
  formatProgress,
  formatAvailability,
  kbToBytes,
  bytesToKb,
} from '@/utils/format';
import { getErrorMessage, getErrorStatus } from '@/utils/error';
import {
  describeShareLimit,
  parseShareLimitInput,
  parseSpeedLimitInput,
  SHARE_LIMIT_GLOBAL,
  SHARE_LIMIT_UNLIMITED,
} from '@/utils/limit-input';
import { haptics } from '@/utils/haptics';

const SPEED_HISTORY_LEN = 30;

const PATH_POPOVER_WIDTH = 280;
const PATH_POPOVER_MARGIN = 12;
const PATH_POPOVER_ANCHOR_GAP = 8;

function normalizePieceStates(data: unknown): number[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map((v) => Number(v) || 0);
  if (typeof data === 'object') {
    return Object.keys(data as Record<string, number>)
      .map((k) => Number(k))
      .filter((k) => !Number.isNaN(k))
      .sort((a, b) => a - b)
      .map((k) => Number((data as Record<string, number>)[k]) || 0);
  }
  return [];
}

function trackerStatusColor(
  status: number,
  colors: { success: string; primary: string; error: string; textSecondary: string },
): string {
  // qBittorrent: 0 disabled, 1 not contacted, 2 working, 3 updating, 4 not working
  switch (status) {
    case 2:
      return colors.success;
    case 3:
      return colors.primary;
    case 4:
      return colors.error;
    default:
      return colors.textSecondary;
  }
}

function isRealTracker(url: string): boolean {
  return (
    !!url &&
    !url.includes('**') &&
    !url.includes('DHT') &&
    !url.includes('PEX') &&
    !url.includes('LSD')
  );
}

export default function TorrentDetail() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { isConnected, isLoading } = useServer();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { categories, tags } = useTorrents();
  const { t } = useTranslation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const graphWidth = Math.max(120, windowWidth - 64);
  const insets = useSafeAreaInsets();

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
  const [pieceStates, setPieceStates] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dlHistory, setDlHistory] = useState<number[]>(() => Array(SPEED_HISTORY_LEN).fill(0));
  const [ulHistory, setUlHistory] = useState<number[]>(() => Array(SPEED_HISTORY_LEN).fill(0));

  const [pathModal, setPathModal] = useState<{
    title: string;
    value: string;
    anchor: { x: number; y: number };
  } | null>(null);
  const [pathPopoverHeight, setPathPopoverHeight] = useState<number | null>(null);

  const [peersModalVisible, setPeersModalVisible] = useState(false);
  const [peersData, setPeersData] = useState<
    Array<{ ip: string; progress: number; client?: string }>
  >([]);
  const [peersLoading, setPeersLoading] = useState(false);

  const [inputModalVisible, setInputModalVisible] = useState(false);
  const [inputModalConfig, setInputModalConfig] = useState<{
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    keyboardType?: 'default' | 'numeric' | 'numbers-and-punctuation';
    allowEmpty?: boolean;
    validate?: (value: string) => string | null;
    presets?: InputModalPreset[];
    computeHint?: (value: string) => string | null;
    pathAutocomplete?: boolean;
    onConfirm: (value: string) => void;
  }>({ title: '', onConfirm: () => {} });
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const [priorityPickerVisible, setPriorityPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [tagsModalVisible, setTagsModalVisible] = useState(false);
  const [renameTooltipVisible, setRenameTooltipVisible] = useState(false);

  // Optimistic state for toggle rows so they feel instant
  const [optSeqDl, setOptSeqDl] = useState<boolean | null>(null);
  const [optFlPiece, setOptFlPiece] = useState<boolean | null>(null);
  const [optSuperSeeding, setOptSuperSeeding] = useState<boolean | null>(null);
  const [optForceStart, setOptForceStart] = useState<boolean | null>(null);
  const [optAutoTmm, setOptAutoTmm] = useState<boolean | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────

  useEffect(() => {
    torrentGoneRef.current = false;
    if (hash && isConnected) {
      loadTorrentData();
    }
    // loadTorrentData isn't memoized — only re-run when hash/isConnected change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, isConnected]);

  const pushSpeedSample = (info: TorrentInfo | null | undefined) => {
    const dl = info?.dlspeed ?? 0;
    const ul = info?.upspeed ?? 0;
    setDlHistory((prev) => [...prev.slice(1), dl]);
    setUlHistory((prev) => [...prev.slice(1), ul]);
  };

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /** Latch so the two independent refresh paths can't both pop the screen. */
  const torrentGoneRef = useRef(false);

  /**
   * The torrent no longer exists on the server — it was removed elsewhere, or a
   * share limit with a "Remove torrent" action fired. Stop polling (otherwise we
   * keep 404-ing every 2s), say so plainly, and leave the dead screen.
   */
  const handleTorrentGone = useCallback(() => {
    if (torrentGoneRef.current) return;
    torrentGoneRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    showToast(t('torrentDetail.torrentRemoved'), 'error');
    // Deep links can land here with nothing to go back to.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [showToast, t, router]);

  const loadTorrentData = async () => {
    try {
      setLoading(true);
      const [torrentList, props, trackersData, filesData, piecesData] = await Promise.all([
        torrentsApi.getTorrentList(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [hash],
        ),
        torrentsApi.getTorrentProperties(hash),
        torrentsApi.getTorrentTrackers(hash),
        torrentsApi.getTorrentContents(hash),
        torrentsApi.getTorrentPiecesStates(hash).catch(() => null),
      ]);

      const next = torrentList.length > 0 ? torrentList[0] : null;
      // torrents/info answers 200 with an empty list for a hash that's gone,
      // so this — not the 404 below — is the usual signal.
      if (!next) {
        handleTorrentGone();
        return null;
      }
      setTorrent(next);
      setProperties(props);
      setTrackers(trackersData);
      setFiles(filesData);
      setPieceStates(normalizePieceStates(piecesData));
      pushSpeedSample(next);
      setLastUpdatedAt(new Date());
      return next;
    } catch (error: unknown) {
      // torrents/properties 404s for an unknown hash. The other calls here are
      // core endpoints present since WebAPI 2.0, so a 404 means the torrent is
      // gone rather than the endpoint being unsupported.
      if (getErrorStatus(error) === 404) {
        handleTorrentGone();
        return null;
      }
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
      const [torrentList, props, trackersData, filesData, piecesData] = await Promise.all([
        torrentsApi.getTorrentList(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [hash],
        ),
        torrentsApi.getTorrentProperties(hash),
        torrentsApi.getTorrentTrackers(hash),
        torrentsApi.getTorrentContents(hash),
        torrentsApi.getTorrentPiecesStates(hash).catch(() => null),
      ]);

      const next = torrentList.length > 0 ? torrentList[0] : null;
      if (!next) {
        handleTorrentGone();
        return;
      }
      setTorrent(next);
      setProperties(props);
      setTrackers(trackersData);
      setFiles(filesData);
      setPieceStates(normalizePieceStates(piecesData));
      const dl = next.dlspeed ?? 0;
      const ul = next.upspeed ?? 0;
      setDlHistory((prev) => [...prev.slice(1), dl]);
      setUlHistory((prev) => [...prev.slice(1), ul]);
      setLastUpdatedAt(new Date());
    } catch (error: unknown) {
      // Still silent for ordinary failures — but a vanished torrent has to be
      // acted on, or this poll 404s every 2 seconds forever.
      if (getErrorStatus(error) === 404) {
        handleTorrentGone();
      }
    }
  }, [hash, handleTorrentGone]);

  // ── Polling ───────────────────────────────────────────────────────────

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
    haptics.medium();
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
        await new Promise((resolve) => setTimeout(resolve, 500));
        const freshTorrent = await loadTorrentData();
        if (freshTorrent) {
          const newIsPaused =
            freshTorrent.state.includes('paused') || freshTorrent.state.includes('stopped');
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
    haptics.warning();
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async (deleteFiles: boolean) => {
    if (!torrent) return;
    setDeleteConfirmVisible(false);
    try {
      await torrentsApi.deleteTorrents([torrent.hash], deleteFiles);
      haptics.success();
      showToast(t('toast.torrentDeleted'), 'success');
      router.back();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleRecheck = async () => {
    haptics.medium();
    try {
      setActionLoading(true);
      await torrentsApi.recheckTorrents([torrent!.hash]);
      await new Promise((resolve) => setTimeout(resolve, 250));
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
      const data = (await syncApi.getTorrentPeers(hash, 0)) as {
        peers?: Record<string, { progress?: number; client?: string }>;
      };
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
      haptics.medium();
      await torrentsApi.reannounceTorrents([torrent!.hash]);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast(t('toast.reannounceSent'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleCopyMagnet = async () => {
    try {
      if (torrent?.magnet_uri) {
        await Clipboard.setStringAsync(torrent.magnet_uri);
        haptics.success();
        showToast(t('toast.magnetCopied'), 'success');
      } else {
        showToast(t('toast.noMagnetAvailable'), 'error');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleCopyPath = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      haptics.success();
      showToast(t('toast.pathCopied'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  /**
   * Everything setShareLimits needs in order to leave alone what the user isn't
   * editing. The sentinels ('Default', -2) mean "use the global setting", NOT
   * "unchanged", so a limit edit that doesn't echo these back silently resets
   * them — and a global action of "Remove torrent" then deletes the torrent.
   */
  const currentShareLimits = () => ({
    inactiveSeedingTimeLimit: torrent?.inactive_seeding_time_limit,
    shareLimitAction: torrent?.share_limit_action,
    shareLimitsMode: torrent?.share_limits_mode,
  });

  const shareLimitPresets: InputModalPreset[] = [
    { label: t('common.unlimited'), value: String(SHARE_LIMIT_UNLIMITED) },
    { label: t('torrentDetail.useGlobal'), value: String(SHARE_LIMIT_GLOBAL) },
  ];

  /** Describe a ratio limit the user just set, resolving both sentinels to words. */
  const formatShareRatio = (ratioLimit: number): string => {
    if (ratioLimit === SHARE_LIMIT_GLOBAL) return t('torrentDetail.useGlobal');
    if (ratioLimit < 0) return t('common.unlimited');
    return ratioLimit.toFixed(2);
  };

  const handleSetRatioLimit = () => {
    const current = torrent?.ratio_limit != null ? torrent.ratio_limit.toString() : '';
    setInputModalConfig({
      title: t('torrentDetail.setRatioLimit'),
      message: t('torrentDetail.enterRatioLimit'),
      defaultValue: current,
      keyboardType: 'numbers-and-punctuation',
      allowEmpty: true,
      validate: (value: string) =>
        parseShareLimitInput(value) === null ? t('errors.validNumber') : null,
      presets: shareLimitPresets,
      onConfirm: async (value: string) => {
        const ratioLimit = parseShareLimitInput(value);
        // validate() already blocks this; belt and braces so a bad value can
        // never reach the server as an accidental "unlimited".
        if (ratioLimit === null) {
          showToast(t('errors.validNumber'), 'error');
          return;
        }
        setInputModalVisible(false);
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentShareLimits([torrent!.hash], {
            ratioLimit,
            seedingTimeLimit: torrent?.seeding_time_limit ?? SHARE_LIMIT_GLOBAL,
            ...currentShareLimits(),
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          await loadTorrentData();
          haptics.success();
          showToast(
            t('torrentDetail.ratioLimitSet', { value: formatShareRatio(ratioLimit) }),
            'success',
          );
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleSetSeedingTimeLimit = () => {
    const current =
      torrent?.seeding_time_limit != null ? torrent.seeding_time_limit.toString() : '';
    setInputModalConfig({
      title: t('torrentDetail.setSeedingTimeLimit'),
      message: t('torrentDetail.enterSeedingTimeMinutes'),
      defaultValue: current,
      keyboardType: 'numbers-and-punctuation',
      allowEmpty: true,
      validate: (value: string) =>
        parseShareLimitInput(value, { integer: true }) === null ? t('errors.validNumber') : null,
      presets: shareLimitPresets,
      onConfirm: async (value: string) => {
        const seedingTimeLimit = parseShareLimitInput(value, { integer: true });
        if (seedingTimeLimit === null) {
          showToast(t('errors.validNumber'), 'error');
          return;
        }
        setInputModalVisible(false);
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentShareLimits([torrent!.hash], {
            ratioLimit: torrent?.ratio_limit ?? SHARE_LIMIT_GLOBAL,
            seedingTimeLimit,
            ...currentShareLimits(),
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          await loadTorrentData();
          haptics.success();
          showToast(
            t('torrentDetail.seedingTimeLimitSet', {
              value:
                seedingTimeLimit === SHARE_LIMIT_GLOBAL
                  ? t('torrentDetail.useGlobal')
                  : seedingTimeLimit < 0
                    ? t('common.unlimited')
                    : formatTime(seedingTimeLimit * 60),
            }),
            'success',
          );
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleForceStart = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const isForceStarted = torrent?.force_start || false;
      setOptForceStart(!isForceStarted);
      await torrentsApi.setForceStart([torrent!.hash], !isForceStarted);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadTorrentData();
      setOptForceStart(null);
      setActionLoading(false);
      showToast(
        t('toast.forceStartToggled', {
          status: t(`common.${!isForceStarted ? 'enabled' : 'disabled'}`),
        }),
        'success',
      );
    } catch (error: unknown) {
      setOptForceStart(null);
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleSuperSeeding = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const isSuperSeeding = torrent?.super_seeding || false;
      setOptSuperSeeding(!isSuperSeeding);
      await torrentsApi.setSuperSeeding([torrent!.hash], !isSuperSeeding);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadTorrentData();
      setOptSuperSeeding(null);
      setActionLoading(false);
      showToast(
        t('toast.superSeedingToggled', {
          status: t(`common.${!isSuperSeeding ? 'enabled' : 'disabled'}`),
        }),
        'success',
      );
    } catch (error: unknown) {
      setOptSuperSeeding(null);
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleSequentialDownload = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const isSeq = torrent?.seq_dl || false;
      setOptSeqDl(!isSeq);
      await torrentsApi.toggleSequentialDownload([torrent!.hash]);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadTorrentData();
      setOptSeqDl(null);
      setActionLoading(false);
      showToast(t('toast.sequentialToggled'), 'success');
    } catch (error: unknown) {
      setOptSeqDl(null);
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleFirstLastPiecePriority = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const isFlPiece = torrent?.f_l_piece_prio || false;
      setOptFlPiece(!isFlPiece);
      await torrentsApi.setFirstLastPiecePriority([torrent!.hash]);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadTorrentData();
      setOptFlPiece(null);
      setActionLoading(false);
      showToast(t('torrentDetail.firstLastPieceToggled'), 'success');
    } catch (error: unknown) {
      setOptFlPiece(null);
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleAutomaticManagement = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const isAutoManaged = torrent?.auto_tmm || false;
      setOptAutoTmm(!isAutoManaged);
      await torrentsApi.setAutomaticTorrentManagement([torrent!.hash], !isAutoManaged);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadTorrentData();
      setOptAutoTmm(null);
      setActionLoading(false);
      showToast(
        t('toast.autoManagementToggled', {
          status: t(`common.${!isAutoManaged ? 'enabled' : 'disabled'}`),
        }),
        'success',
      );
    } catch (error: unknown) {
      setOptAutoTmm(null);
      showToast(getErrorMessage(error), 'error');
      setActionLoading(false);
    }
  };

  const handleIncreasePriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.increasePriority([torrent!.hash]);
      await new Promise((resolve) => setTimeout(resolve, 250));
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
      await new Promise((resolve) => setTimeout(resolve, 250));
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
      await new Promise((resolve) => setTimeout(resolve, 250));
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
      await new Promise((resolve) => setTimeout(resolve, 250));
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
      message: t('screens.torrents.enterLimitKbs'),
      defaultValue:
        properties?.dl_limit && properties.dl_limit > 0
          ? String(bytesToKb(properties.dl_limit))
          : '0',
      keyboardType: 'numeric',
      allowEmpty: true,
      validate: (value: string) =>
        parseSpeedLimitInput(value) === null ? t('errors.validNumber') : null,
      computeHint: (value: string) => {
        const kb = parseSpeedLimitInput(value);
        return kb && kb > 0 ? formatSpeed(kbToBytes(kb)) : null;
      },
      onConfirm: async (value: string) => {
        const limitKb = parseSpeedLimitInput(value);
        if (limitKb === null) {
          showToast(t('errors.validNumber'), 'error');
          return;
        }
        const limitBytes = kbToBytes(limitKb);
        setInputModalVisible(false);
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentDownloadLimit([torrent!.hash], limitBytes);
          await new Promise((resolve) => setTimeout(resolve, 500));
          await loadTorrentData();
          haptics.success();
          showToast(
            t('torrentDetail.dlLimitSet', {
              value: limitBytes === 0 ? t('common.unlimited') : formatSpeed(limitBytes),
            }),
            'success',
          );
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
      message: t('screens.torrents.enterLimitKbs'),
      defaultValue:
        properties?.up_limit && properties.up_limit > 0
          ? String(bytesToKb(properties.up_limit))
          : '0',
      keyboardType: 'numeric',
      allowEmpty: true,
      validate: (value: string) =>
        parseSpeedLimitInput(value) === null ? t('errors.validNumber') : null,
      computeHint: (value: string) => {
        const kb = parseSpeedLimitInput(value);
        return kb && kb > 0 ? formatSpeed(kbToBytes(kb)) : null;
      },
      onConfirm: async (value: string) => {
        const limitKb = parseSpeedLimitInput(value);
        if (limitKb === null) {
          showToast(t('errors.validNumber'), 'error');
          return;
        }
        const limitBytes = kbToBytes(limitKb);
        setInputModalVisible(false);
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentUploadLimit([torrent!.hash], limitBytes);
          await new Promise((resolve) => setTimeout(resolve, 500));
          await loadTorrentData();
          haptics.success();
          showToast(
            t('torrentDetail.ulLimitSet', {
              value: limitBytes === 0 ? t('common.unlimited') : formatSpeed(limitBytes),
            }),
            'success',
          );
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

  const handleSetLocation = () => {
    setInputModalConfig({
      title: t('torrentDetail.moveTo'),
      message: t('torrentDetail.enterNewSavePath'),
      defaultValue: properties?.save_path || '',
      pathAutocomplete: true,
      onConfirm: async (value: string) => {
        setInputModalVisible(false);
        if (!value) return;
        try {
          setActionLoading(true);
          await torrentsApi.setTorrentLocation([torrent!.hash], value);
          await new Promise((resolve) => setTimeout(resolve, 500));
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
          await new Promise((resolve) => setTimeout(resolve, 500));
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
      case 'max':
        await handleMaxPriority();
        break;
      case 'increase':
        await handleIncreasePriority();
        break;
      case 'decrease':
        await handleDecreasePriority();
        break;
      case 'min':
        await handleMinPriority();
        break;
    }
  };

  const handleCategorySelect = async (value: string) => {
    setCategoryPickerVisible(false);
    try {
      setActionLoading(true);
      await torrentsApi.setTorrentCategory([torrent!.hash], value);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadTorrentData();
      showToast(t('toast.categorySet', { value: value || t('common.none') }), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCategoryCreateAndSelect = async (categoryName: string) => {
    setCategoryPickerVisible(false);
    try {
      setActionLoading(true);
      await categoriesApi.addCategory(categoryName, '');
      await torrentsApi.setTorrentCategory([torrent!.hash], categoryName);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadTorrentData();
      showToast(t('toast.categorySet', { value: categoryName }), 'success');
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
          <Text style={[styles.message, { color: colors.text }]}>
            {t('torrentDetail.notConnected')}
          </Text>
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
          <Text style={[styles.message, { color: colors.text }]}>
            {t('torrentDetail.notFound')}
          </Text>
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
  const dlSparkMax = niceGraphCeiling(computeSpeedGraphMax(dlHistory));
  const ulSparkMax = niceGraphCeiling(computeSpeedGraphMax(ulHistory));
  const actualIsPaused = torrent.state.includes('paused') || torrent.state.includes('stopped');
  const isPaused = optimisticPaused !== null ? optimisticPaused : actualIsPaused;

  let stateColor = getStateColor(torrent.state, torrent.progress, dlspeed, upspeed, colors);
  let stateLabel = getStateLabel(torrent.state, torrent.progress, dlspeed, upspeed, t);

  if (optimisticPaused !== null) {
    if (optimisticPaused) {
      if (torrent.progress >= 1) {
        // Pausing/stopping a finished torrent — qBittorrent's own WebUI
        // calls this "Completed", not "Paused".
        stateColor = colors.stateSeeding;
        stateLabel = t('torrentDetail.completed');
      } else {
        stateColor = colors.statePaused;
        stateLabel = t('torrentDetail.paused');
      }
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

  const priorityDisplay =
    torrent.priority <= 0 ? t('torrentDetail.notQueued') : `#${torrent.priority}`;

  const priorityOptions = [
    { label: t('torrentDetail.maximum'), value: 'max' },
    { label: t('torrentDetail.increase'), value: 'increase' },
    { label: t('torrentDetail.decrease'), value: 'decrease' },
    { label: t('torrentDetail.minimum'), value: 'min' },
  ];

  /**
   * Render a share-limit row value.
   *
   * `own` is the torrent's own setting (-2 = follow the global limit, -1 = none);
   * `effective` is the limit qBittorrent will actually enforce, with -2 already
   * resolved. Showing `own` alone reads "Unlimited" for a torrent that is in fact
   * capped by the global limit, which is what this fixes.
   */
  const shareLimitValue = (
    own: number | null | undefined,
    effective: number | null | undefined,
    format: (value: number) => string,
  ): string => {
    const described = describeShareLimit(own, effective);
    switch (described.kind) {
      case 'unlimited':
        return t('common.unlimited');
      case 'global':
        return described.effective == null
          ? t('common.unlimited')
          : t('torrentDetail.globalLimit', { value: format(described.effective) });
      case 'value':
        return format(described.value);
    }
  };

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

  /**
   * The "Rename" row only renames the torrent's own display name — it does
   * NOT touch the file/folder on disk, which surprises people expecting a
   * filesystem rename. The info icon pops a one-off tooltip clarifying that,
   * same pattern as the Auto TMM tooltip on the add-torrent screen.
   */
  const renameRow = (label: string, value: string, onPress: () => void) => (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={actionLoading}>
      <View style={styles.rowLabelWithInfo}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <TouchableOpacity
          onPress={() => setRenameTooltipVisible(true)}
          accessibilityLabel={t('common.moreInfo')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
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

  const pathRow = (label: string, value: string) => (
    <TouchableOpacity
      style={styles.row}
      onPress={(e: GestureResponderEvent) => {
        setPathPopoverHeight(null);
        setPathModal({
          title: label,
          value,
          anchor: { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY },
        });
      }}
      disabled={actionLoading}
    >
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

  /**
   * A path row that isn't tappable as a whole — only its two icon buttons
   * are: an edit button that opens the path editor (with autocomplete) via
   * `onEdit`, and an info button that pops the existing full-path popover
   * (for when the ellipsized value doesn't tell the whole story).
   */
  const editablePathRow = (label: string, value: string, onEdit: () => void) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text
            style={[styles.rowValue, styles.editablePathValue, { color: colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {value}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={onEdit}
          disabled={actionLoading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={t('common.edit')}
        >
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        {value ? (
          <TouchableOpacity
            onPress={(e: GestureResponderEvent) => {
              setPathPopoverHeight(null);
              setPathModal({
                title: label,
                value,
                anchor: { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY },
              });
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common.moreInfo')}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const categoryBadgeRow = (label: string, category: string, onPress: () => void) => (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={actionLoading}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {category ? (
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: colors.primaryOpac, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.categoryBadgeText, { color: colors.primary }]} numberOfLines={1}>
              {category}
            </Text>
          </View>
        ) : (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('common.none')}
          </Text>
        )}
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const tagsBadgeRow = (label: string, tagsCsv: string, onPress: () => void) => {
    const tagList = tagsCsv
      ? tagsCsv
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
    return (
      <TouchableOpacity
        style={[styles.row, tagList.length > 1 && styles.rowMultiline]}
        onPress={onPress}
        disabled={actionLoading}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <View style={styles.rowRight}>
          {tagList.length === 0 ? (
            <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('common.none')}
            </Text>
          ) : (
            <View style={styles.tagsChipWrap}>
              {tagList.map((tag, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor: colors.primaryOpac,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[styles.categoryBadgeText, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const toggleRow = (label: string, value: boolean, onToggle: () => void) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
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

  const trackerNavRowWithReannounce = (label: string, value: string, onPress: () => void) => (
    <View style={styles.trackerRowOuter}>
      <TouchableOpacity
        style={styles.reannounceIconBtn}
        onPress={handleReannounce}
        disabled={actionLoading}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={t('actions.reannounce')}
      >
        <Ionicons name="megaphone-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.trackerRowContent} onPress={onPress}>
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
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
        <View style={[styles.topBar, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.topBarIconBtn}
              onPress={handleCopyMagnet}
              accessibilityLabel={t('torrentDetail.copyMagnet')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="magnet-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topBarIconBtn}
              onPress={handleReannounce}
              disabled={actionLoading}
              accessibilityLabel={t('torrentDetail.reannounce')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="megaphone-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── Hero ────────────────────────────────────────────── */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
            <View style={styles.heroHeaderRow}>
              <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={3}>
                {torrent.name}
              </Text>
              <View style={styles.heroBadge}>
                <View
                  style={[StyleSheet.absoluteFill, { backgroundColor: stateColor, opacity: 0.28 }]}
                />
                <Text style={[styles.heroBadgeText, { color: colors.text }]} numberOfLines={1}>
                  {stateLabel}
                </Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              <View style={styles.progressBarFlex}>
                <AnimatedProgressBar
                  progress={Math.min(progress, 100)}
                  color={stateColor}
                  height={5}
                />
              </View>
              <TouchableOpacity
                onPress={handlePauseResume}
                disabled={actionLoading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.pauseCircle, { backgroundColor: stateColor }]}
                activeOpacity={0.7}
                accessibilityLabel={isPaused ? t('torrentDetail.resume') : t('torrentDetail.pause')}
              >
                <Ionicons name={isPaused ? 'play' : 'pause'} size={14} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text
              style={[styles.heroSizeLine, { color: colors.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {formatSize(torrent.completed)}
              {' / '}
              {formatSize(torrent.total_size > 0 ? torrent.total_size : torrent.size)}
              {torrent.amount_left > 0
                ? ` · ${t('torrentDetail.amountLeft', { size: formatSize(torrent.amount_left) })}`
                : ''}
              {torrent.time_active > 0
                ? ` · ${t('torrentDetail.activeFor', { time: formatTime(torrent.time_active) })}`
                : ''}
            </Text>

            <View style={styles.sparklineRow}>
              <SpeedGraph
                data={dlHistory}
                color={colors.primary}
                width={graphWidth}
                height={36}
                maxValue={dlSparkMax}
              />
              <Text style={[styles.sparklineScaleCaption, { color: colors.textSecondary }]}>
                {t('screens.transfer.graphScale', { value: formatSpeed(dlSparkMax) })}
              </Text>
            </View>
            <View style={[styles.sparklineRow, { marginTop: 4 }]}>
              <SpeedGraph
                data={ulHistory}
                color={colors.success}
                width={graphWidth}
                height={28}
                maxValue={ulSparkMax}
              />
              <Text style={[styles.sparklineScaleCaption, { color: colors.textSecondary }]}>
                {t('screens.transfer.graphScale', { value: formatSpeed(ulSparkMax) })}
              </Text>
            </View>

            <View style={styles.heroStatsGrid}>
              {(
                [
                  {
                    key: 'dlSpeed',
                    label: t('torrentDetail.dlSpeed'),
                    value: formatSpeed(dlspeed),
                  },
                  {
                    key: 'ulSpeed',
                    label: t('torrentDetail.ulSpeed'),
                    value: formatSpeed(upspeed),
                  },
                  {
                    key: 'eta',
                    label: t('torrentDetail.eta'),
                    value: hasEta(torrent.eta, torrent.progress) ? formatTime(torrent.eta) : '—',
                  },
                  {
                    key: 'ratio',
                    label: t('torrentDetail.ratio'),
                    value: torrent.ratio != null ? torrent.ratio.toFixed(2) : '0.00',
                  },
                  {
                    key: 'uploaded',
                    label: t('torrentDetail.uploaded'),
                    value: formatSize(torrent.uploaded),
                  },
                  {
                    key: 'seeds',
                    label: t('torrentDetail.seeds'),
                    value: `${torrent.num_seeds || 0} / ${torrent.num_complete || 0}`,
                    onPress: handleOpenPeerDetails,
                  },
                  {
                    key: 'peers',
                    label: t('torrentDetail.peers'),
                    value: `${torrent.num_leechs || 0} / ${torrent.num_incomplete || 0}`,
                    onPress: handleOpenPeerDetails,
                  },
                  {
                    key: 'availability',
                    label: t('torrentDetail.availability'),
                    value:
                      torrent.availability > 0 ? formatAvailability(torrent.availability) : '—',
                  },
                ] as Array<{
                  key: string;
                  label: string;
                  value: string;
                  onPress?: () => void;
                }>
              ).map((item) => {
                const cell = (
                  <>
                    <Text
                      style={[styles.heroStatLabel, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.heroStatValue, { color: colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {item.value}
                    </Text>
                  </>
                );
                return item.onPress ? (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.heroStatCell}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    {cell}
                  </TouchableOpacity>
                ) : (
                  <View key={item.key} style={styles.heroStatCell}>
                    {cell}
                  </View>
                );
              })}
            </View>

            {(() => {
              const realTrackers = trackers.filter((tr) => isRealTracker(tr.url));
              if (realTrackers.length === 0) return null;
              return (
                <TouchableOpacity
                  style={[styles.trackerHealthRow, { borderTopColor: colors.surfaceOutline }]}
                  onPress={() => router.push(`/torrent/manage-trackers?hash=${hash}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>
                    {t('torrentDetail.trackerHealth')}
                  </Text>
                  <View style={styles.trackerDots}>
                    {realTrackers.slice(0, 12).map((tr, i) => (
                      <View
                        key={`${tr.url}-${i}`}
                        style={[
                          styles.trackerDot,
                          { backgroundColor: trackerStatusColor(tr.status, colors) },
                        ]}
                      />
                    ))}
                    {realTrackers.length > 12 && (
                      <Text style={[styles.trackerMore, { color: colors.textSecondary }]}>
                        +{realTrackers.length - 12}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })()}

            {pieceStates.length > 0 && (
              <View style={[styles.pieceMapBlock, { borderTopColor: colors.surfaceOutline }]}>
                <Text
                  style={[styles.heroStatLabel, { color: colors.textSecondary, marginBottom: 6 }]}
                >
                  {t('torrentDetail.pieceMap')}
                  {properties?.pieces_have != null && properties?.pieces_num
                    ? `  ·  ${properties.pieces_have}/${properties.pieces_num}`
                    : ''}
                </Text>
                <PieceMap states={pieceStates} />
              </View>
            )}

            {lastUpdatedAt && (
              <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
                {t('torrentDetail.lastUpdated', {
                  time: lastUpdatedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                })}
              </Text>
            )}
          </View>

          {/* ── Actions ─────────────────────────────────────────── */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.textSecondary }]}
              onPress={handleRecheck}
              disabled={actionLoading}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
                {t('torrentDetail.recheck')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.error }]}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.actionBtnText, { color: colors.error }]}>
                {t('common.delete')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── GENERAL ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('torrentDetail.general')}
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              properties &&
                editablePathRow(
                  t('torrentDetail.savePath'),
                  properties.save_path,
                  handleSetLocation,
                ),
              properties?.download_path &&
                pathRow(t('torrentDetail.downloadPath'), properties.download_path),
              categoryBadgeRow(t('torrentDetail.category'), torrent.category || '', () =>
                setCategoryPickerVisible(true),
              ),
              tagsBadgeRow(t('torrentDetail.tags'), torrent.tags || '', handleAddTags),
            ])}
          </View>

          {/* ── TRANSFER ────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('torrentDetail.transfer')}
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              staticRow(
                t('torrentDetail.downloaded'),
                formatSize(torrent.downloaded ?? torrent.completed),
              ),
              staticRow(t('torrentDetail.uploaded'), formatSize(torrent.uploaded)),
              tappableRow(
                t('torrentDetail.dlLimit'),
                properties && properties.dl_limit > 0
                  ? formatSpeed(properties.dl_limit)
                  : t('common.unlimited'),
                handleSetDownloadLimit,
              ),
              tappableRow(
                t('torrentDetail.ulLimit'),
                properties && properties.up_limit > 0
                  ? formatSpeed(properties.up_limit)
                  : t('common.unlimited'),
                handleSetUploadLimit,
              ),
              tappableRow(
                t('torrentDetail.maxRatio'),
                shareLimitValue(torrent.ratio_limit, torrent.max_ratio, (value) =>
                  value.toFixed(2),
                ),
                handleSetRatioLimit,
              ),
              staticRow(t('torrentDetail.seedingTime'), formatTime(torrent.seeding_time)),
              tappableRow(
                t('torrentDetail.maxSeedingTime'),
                shareLimitValue(torrent.seeding_time_limit, torrent.max_seeding_time, (value) =>
                  formatTime(value * 60),
                ),
                handleSetSeedingTimeLimit,
              ),
            ])}
          </View>

          {/* ── NETWORK ─────────────────────────────────────────── */}
          {torrent.popularity != null && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('torrentDetail.network')}
              </Text>
              <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
                {renderRows([
                  staticRow(t('torrentDetail.popularity'), torrent.popularity.toFixed(2)),
                ])}
              </View>
            </>
          )}

          {/* ── CONTENT ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('torrentDetail.content')}
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              navRow(
                t('torrentDetail.files'),
                t('torrentDetail.filesCount', { count: files.length }),
                () => router.push(`/torrent/files?hash=${hash}`),
              ),
              trackerNavRowWithReannounce(
                t('torrentDetail.trackers'),
                t('torrentDetail.trackersCount', { count: trackers.length }),
                () => router.push(`/torrent/manage-trackers?hash=${hash}`),
              ),
            ])}
          </View>

          {/* ── ADVANCED ────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('torrentDetail.advanced')}
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {renderRows([
              tappableRow(t('torrentDetail.priority'), priorityDisplay, () =>
                setPriorityPickerVisible(true),
              ),
              toggleRow(
                t('torrentDetail.autoManagement'),
                optAutoTmm ?? torrent.auto_tmm ?? false,
                handleAutomaticManagement,
              ),
              toggleRow(
                t('torrentDetail.sequentialDownload'),
                optSeqDl ?? torrent.seq_dl ?? false,
                handleSequentialDownload,
              ),
              toggleRow(
                t('torrentDetail.firstLastPiecePriority'),
                optFlPiece ?? torrent.f_l_piece_prio ?? false,
                handleFirstLastPiecePriority,
              ),
              toggleRow(
                t('torrentDetail.superSeeding'),
                optSuperSeeding ?? torrent.super_seeding ?? false,
                handleSuperSeeding,
              ),
              toggleRow(
                t('torrentDetail.forceStart'),
                optForceStart ?? torrent.force_start ?? false,
                handleForceStart,
              ),
              renameRow(t('torrentDetail.rename'), torrent.name, handleRenameTorrent),
            ])}
          </View>

          {/* ── DATES ───────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('torrentDetail.dates')}
          </Text>
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
          validate={inputModalConfig.validate}
          presets={inputModalConfig.presets}
          computeHint={inputModalConfig.computeHint}
          pathAutocomplete={inputModalConfig.pathAutocomplete}
          onCancel={() => setInputModalVisible(false)}
          onConfirm={inputModalConfig.onConfirm}
        />

        <ConfirmModal
          visible={deleteConfirmVisible}
          title={t('torrentDetail.deleteTorrent')}
          message={torrent ? t('alerts.deleteName', { name: torrent.name }) : undefined}
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

        <OptionPicker
          visible={priorityPickerVisible}
          title={t('torrentDetail.setPriority')}
          options={priorityOptions}
          onSelect={handlePrioritySelect}
          onClose={() => setPriorityPickerVisible(false)}
        />

        <CategoryModal
          visible={categoryPickerVisible}
          currentCategory={torrent.category || ''}
          allCategories={Object.keys(categories || {})}
          loading={actionLoading}
          onSelect={handleCategorySelect}
          onCreateAndSelect={handleCategoryCreateAndSelect}
          onDeleteCategory={async (name) => {
            try {
              setActionLoading(true);
              await categoriesApi.removeCategories([name]);
              await loadTorrentData();
              showToast(t('toast.categoryDeleted', { name }), 'success');
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
            } finally {
              setActionLoading(false);
            }
          }}
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
          onDeleteTag={async (tag) => {
            try {
              setActionLoading(true);
              await tagsApi.deleteTags([tag]);
              await loadTorrentData();
              showToast(t('toast.tagDeleted', { tag }), 'success');
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
            } finally {
              setActionLoading(false);
            }
          }}
          onClose={() => setTagsModalVisible(false)}
        />

        <Modal
          visible={renameTooltipVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRenameTooltipVisible(false)}
        >
          <TouchableOpacity
            style={styles.tooltipOverlay}
            activeOpacity={1}
            onPress={() => setRenameTooltipVisible(false)}
          >
            <View style={[styles.tooltipContainer, { backgroundColor: colors.surface }]}>
              <View style={styles.tooltipHeader}>
                <Ionicons name="create-outline" size={24} color={colors.primary} />
                <Text style={[styles.tooltipTitle, { color: colors.text }]}>
                  {t('torrentDetail.rename')}
                </Text>
              </View>
              <Text style={[styles.tooltipText, { color: colors.text }]}>
                {t('torrentDetail.renameTooltip')}
              </Text>
              <TouchableOpacity
                style={[styles.tooltipButton, { backgroundColor: colors.primary }]}
                onPress={() => setRenameTooltipVisible(false)}
              >
                <Text style={styles.tooltipButtonText}>{t('server.gotIt')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

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
                <Text style={[styles.peersModalTitle, { color: colors.text }]}>
                  {t('torrentDetail.connectedPeers')}
                </Text>
                <TouchableOpacity
                  onPress={() => setPeersModalVisible(false)}
                  accessibilityLabel={t('common.close')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
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
                <ScrollView
                  style={styles.peersModalScroll}
                  contentContainerStyle={styles.peersModalScrollContent}
                >
                  {peersData.map((p, idx) => (
                    <View
                      key={`${p.ip}-${idx}`}
                      style={[styles.peerRow, { borderBottomColor: colors.surfaceOutline }]}
                    >
                      <Text style={[styles.peerProgress, { color: colors.text }]}>
                        {formatProgress(p.progress)}
                      </Text>
                      <View style={styles.peerInfo}>
                        <Text style={[styles.peerIp, { color: colors.text }]} numberOfLines={1}>
                          {p.ip}
                        </Text>
                        {p.client ? (
                          <Text
                            style={[styles.peerClient, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
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

        <Modal
          visible={!!pathModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPathModal(null)}
        >
          <TouchableOpacity
            style={styles.pathPopoverOverlay}
            activeOpacity={1}
            onPress={() => setPathModal(null)}
          >
            {pathModal &&
              (() => {
                const minLeft = insets.left + PATH_POPOVER_MARGIN;
                const maxLeft =
                  windowWidth - insets.right - PATH_POPOVER_MARGIN - PATH_POPOVER_WIDTH;
                const left = Math.max(
                  minLeft,
                  Math.min(pathModal.anchor.x - PATH_POPOVER_WIDTH / 2, maxLeft),
                );

                const minTop = insets.top + PATH_POPOVER_MARGIN;
                const maxPopoverHeight =
                  windowHeight - insets.top - insets.bottom - PATH_POPOVER_MARGIN * 2;
                const effectiveHeight = Math.min(pathPopoverHeight ?? 0, maxPopoverHeight);
                const maxTop = windowHeight - insets.bottom - PATH_POPOVER_MARGIN - effectiveHeight;
                const top = Math.max(
                  minTop,
                  Math.min(pathModal.anchor.y + PATH_POPOVER_ANCHOR_GAP, maxTop),
                );

                return (
                  <View
                    onLayout={(e: LayoutChangeEvent) =>
                      setPathPopoverHeight(e.nativeEvent.layout.height)
                    }
                    style={[
                      styles.pathPopover,
                      {
                        left,
                        top,
                        maxHeight: maxPopoverHeight,
                        backgroundColor: colors.surface,
                        borderColor: colors.surfaceOutline,
                        opacity: pathPopoverHeight === null ? 0 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.pathPopoverHeader,
                        { borderBottomColor: colors.surfaceOutline },
                      ]}
                    >
                      <Text
                        style={[styles.pathPopoverTitle, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {pathModal.title}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setPathModal(null)}
                        accessibilityLabel={t('common.close')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.pathPopoverScroll} bounces={false}>
                      <Text style={[styles.pathModalValue, { color: colors.text }]}>
                        {pathModal.value}
                      </Text>
                    </ScrollView>
                    <TouchableOpacity
                      style={[styles.pathModalCopyButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleCopyPath(pathModal.value)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.pathModalCopyButtonText}>{t('common.copy')}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
          </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  topBarIconBtn: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 40,
  },

  // Hero
  heroCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    flex: 1,
  },
  heroBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    maxWidth: 140,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBarFlex: {
    flex: 1,
  },
  pauseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSizeLine: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  sparklineRow: {
    marginBottom: 2,
  },
  sparklineScaleCaption: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 1,
  },
  heroStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  heroStatCell: {
    width: '25%',
    paddingVertical: 4,
    paddingRight: 8,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  trackerHealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trackerDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  trackerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackerMore: {
    fontSize: 11,
    fontWeight: '500',
  },
  pieceMapBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  lastUpdated: {
    fontSize: 11,
    marginTop: 10,
    textAlign: 'right',
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
  rowLabelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    fontSize: 16,
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '60%',
  },
  editablePathValue: {
    maxWidth: undefined,
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

  // Full-path popover (Save Path / Download Path), anchored near the tapped row
  pathPopoverOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pathPopover: {
    position: 'absolute',
    width: PATH_POPOVER_WIDTH,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  pathPopoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pathPopoverTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 8,
  },
  pathPopoverScroll: {
    maxHeight: 160,
  },
  pathModalValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  pathModalCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
  },
  pathModalCopyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Category badge (also reused for tag chips)
  categoryBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 160,
  },
  categoryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tagsChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
    flex: 1,
  },
  rowMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 8,
  },

  // Tracker row with reannounce icon
  trackerRowOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    minHeight: 44,
    paddingVertical: 10,
  },
  reannounceIconBtn: {
    padding: 4,
    marginRight: 8,
  },
  trackerRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  tooltipContainer: {
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    width: '100%',
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  tooltipTitle: { fontSize: 20, fontWeight: '600' },
  tooltipText: { fontSize: 15, lineHeight: 22 },
  tooltipButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tooltipButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
