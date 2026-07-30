/**
 * transfer.tsx — Global transfer dashboard showing speed stats, limits, and session info.
 *
 * Key exports: TransferScreen (default)
 * Known issues: Some hardcoded English strings remain (Task 3.3 will add i18n coverage).
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTransfer } from '@/context/TransferContext';
import { ServerManager } from '@/services/server-manager';
import { ServerConfig, ApplicationPreferences } from '@/types/api';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { torrentsApi } from '@/services/api/torrents';
import { applicationApi } from '@/services/api/application';
import { formatSize, formatSpeed, formatTime, kbToBytes, bytesToKb } from '@/utils/format';
import { parseSpeedLimitInput } from '@/utils/limit-input';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useSpeedTracker } from '@/hooks/useSpeedTracker';
import { SpeedGraph, computeSpeedGraphMax, niceGraphCeiling } from '@/components/SpeedGraph';
import { QuickConnectPanel } from '@/components/QuickConnectPanel';
import { InputModal } from '@/components/InputModal';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';
import { useGracefulError } from '@/hooks/useGracefulError';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRAPH_HORIZONTAL_PADDING = spacing.lg * 2;
const GRAPH_WIDTH = SCREEN_WIDTH - GRAPH_HORIZONTAL_PADDING;
// The graph card adds its own horizontal padding, so the SVGs inside it are
// narrower than the card's outer width.
const GRAPH_CARD_PADDING = spacing.sm;
const INNER_GRAPH_WIDTH = GRAPH_WIDTH - GRAPH_CARD_PADDING * 2;

export default function TransferScreen() {
  const { t } = useTranslation();
  const {
    transferInfo,
    isLoading,
    error,
    isRecoveringFromBackground: transferRecovering,
    refresh,
    toggleAlternativeSpeedLimits,
    setDownloadLimit,
    setUploadLimit,
    setAltDownloadLimit,
    setAltUploadLimit,
  } = useTransfer();
  const { isConnected, isLoading: serverIsLoading, connectToServer } = useServer();
  const {
    torrents,
    serverState,
    sync: syncTorrents,
    isRecoveringFromBackground: torrentRecovering,
    initialLoadComplete,
  } = useTorrents();
  const isRecoveringFromBackground = transferRecovering || torrentRecovering;
  const { graceError, isPendingError } = useGracefulError(error);
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();

  // Quick-connect state
  const [savedServers, setSavedServers] = useState<ServerConfig[]>([]);
  const [serversLoaded, setServersLoaded] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectErrors, setConnectErrors] = useState<Record<string, string>>({});

  useEffect(() => {
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
  }, [isConnected]);

  const handleQuickConnect = useCallback(
    async (server: ServerConfig) => {
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
        }
      } catch (err: unknown) {
        setConnectErrors((prev) => ({ ...prev, [server.id]: getErrorMessage(err) }));
      } finally {
        setConnectingId(null);
      }
    },
    [connectToServer, t],
  );

  const [settingLimit, setSettingLimit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Global seeding limits (server preferences)
  const [ratioLimitEnabled, setRatioLimitEnabled] = useState(false);
  const [maxRatio, setMaxRatio] = useState(0);
  const [seedingTimeLimitEnabled, setSeedingTimeLimitEnabled] = useState(false);
  const [maxSeedingTime, setMaxSeedingTime] = useState(0);
  const [maxRatioAct, setMaxRatioAct] = useState(0);
  const [maxRatioModalVisible, setMaxRatioModalVisible] = useState(false);
  const [maxSeedingTimeModalVisible, setMaxSeedingTimeModalVisible] = useState(false);
  const [maxRatioActPickerVisible, setMaxRatioActPickerVisible] = useState(false);

  const loadSeedingLimits = useCallback(async () => {
    try {
      const prefs = (await applicationApi.getPreferences()) as ApplicationPreferences;
      setRatioLimitEnabled(!!prefs.max_ratio_enabled);
      setMaxRatio(typeof prefs.max_ratio === 'number' ? prefs.max_ratio : 0);
      setSeedingTimeLimitEnabled(!!prefs.max_seeding_time_enabled);
      setMaxSeedingTime(typeof prefs.max_seeding_time === 'number' ? prefs.max_seeding_time : 0);
      setMaxRatioAct(typeof prefs.max_ratio_act === 'number' ? prefs.max_ratio_act : 0);
    } catch {
      // Not connected / failed to load — leave previous state
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isConnected) {
        loadSeedingLimits();
      }
    }, [isConnected, loadSeedingLimits]),
  );

  const setSeedingLimitPreference = async <K extends keyof ApplicationPreferences>(
    key: K,
    value: ApplicationPreferences[K],
    applyLocally: () => void,
    rollback: () => void,
  ) => {
    applyLocally();
    try {
      await applicationApi.setPreferences({ [key]: value });
      showToast(t('toast.serverSettingUpdated'), 'success');
    } catch {
      rollback();
      showToast(t('errors.failedToUpdateServerSetting'), 'error');
    }
  };

  const maxRatioActOptions: OptionPickerItem[] = [
    { label: t('screens.transfer.actionPause'), value: '0' },
    { label: t('screens.transfer.actionRemove'), value: '1' },
  ];

  // Custom limit modal state
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitType, setLimitType] = useState<
    'download' | 'upload' | 'altDownload' | 'altUpload' | null
  >(null);
  const [limitInput, setLimitInput] = useState('');

  // Speed tracking
  const { speedData, stats, addSpeedData, resetStats } = useSpeedTracker(
    isConnected && !!transferInfo,
  );

  useEffect(() => {
    if (transferInfo && isConnected) {
      addSpeedData(transferInfo.dl_info_speed || 0, transferInfo.up_info_speed || 0);
    }
  }, [transferInfo?.dl_info_speed, transferInfo?.up_info_speed, isConnected, addSpeedData]);

  const downloadGraphData = useMemo(
    () => speedData.map((point) => point.downloadSpeed),
    [speedData],
  );
  const uploadGraphData = useMemo(() => speedData.map((point) => point.uploadSpeed), [speedData]);

  // Both lines share one scale (matches qBittorrent's own WebUI chart), rounded
  // up to a clean number so the top edge reads as "50 MiB/s", not "47.3 MiB/s".
  const graphMax = useMemo(() => {
    const rawMax = Math.max(
      computeSpeedGraphMax(
        downloadGraphData,
        transferInfo && transferInfo.dl_rate_limit > 0 ? transferInfo.dl_rate_limit : undefined,
      ),
      computeSpeedGraphMax(
        uploadGraphData,
        transferInfo && transferInfo.up_rate_limit > 0 ? transferInfo.up_rate_limit : undefined,
      ),
    );
    return niceGraphCeiling(rawMax);
  }, [downloadGraphData, uploadGraphData, transferInfo]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), syncTorrents()]);
    setRefreshing(false);
  }, [refresh, syncTorrents]);

  // --- Action handlers (preserved) ---

  const handlePauseAll = async () => {
    setActionLoading('pause');
    try {
      await torrentsApi.pauseTorrents(['all']);
      await syncTorrents();
      showToast(t('screens.transfer.allPaused'), 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeAll = async () => {
    setActionLoading('resume');
    try {
      await torrentsApi.resumeTorrents(['all']);
      await syncTorrents();
      showToast(t('screens.transfer.allResumed'), 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleForceStartAll = async () => {
    setActionLoading('forceStart');
    try {
      await torrentsApi.setForceStart(['all'], true);
      await syncTorrents();
      showToast(t('screens.transfer.forceStartEnabled'), 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseAllDownloads = async () => {
    setActionLoading('pauseDL');
    try {
      const downloadingHashes = torrents
        .filter((t) => t.state === 'downloading' || t.state === 'forcedDL' || t.state === 'metaDL')
        .map((t) => t.hash);
      if (downloadingHashes.length === 0) {
        showToast(t('screens.transfer.noDlTorrents'), 'info');
        setActionLoading(null);
        return;
      }
      await torrentsApi.pauseTorrents(downloadingHashes);
      await syncTorrents();
      showToast(t('screens.transfer.pausedDl', { count: downloadingHashes.length }), 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseAllUploads = async () => {
    setActionLoading('pauseUL');
    try {
      const uploadingHashes = torrents
        .filter((t) => t.state === 'uploading' || t.state === 'forcedUP' || t.state === 'stalledUP')
        .map((t) => t.hash);
      if (uploadingHashes.length === 0) {
        showToast(t('screens.transfer.noUlTorrents'), 'info');
        setActionLoading(null);
        return;
      }
      await torrentsApi.pauseTorrents(uploadingHashes);
      await syncTorrents();
      showToast(t('screens.transfer.pausedUl', { count: uploadingHashes.length }), 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAltSpeed = async () => {
    haptics.medium();
    setActionLoading('altSpeed');
    try {
      await toggleAlternativeSpeedLimits();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openLimitModal = (type: 'download' | 'upload') => {
    const currentLimit =
      type === 'download' ? transferInfo?.dl_rate_limit : transferInfo?.up_rate_limit;
    setLimitType(type);
    setLimitInput(currentLimit && currentLimit > 0 ? String(bytesToKb(currentLimit)) : '');
    setLimitModalVisible(true);
  };

  const handleLimitSubmit = async () => {
    if (!limitType) return;
    const limit = parseFloat(limitInput);
    if (isNaN(limit) || limit < 0) {
      showToast(t('errors.validNumber'), 'error');
      return;
    }
    try {
      setSettingLimit(true);
      setLimitModalVisible(false);
      if (limitType === 'altDownload') {
        // Alt limits accept bytes/s on the qBT preferences endpoint, so convert
        // the KiB/s user input the same way regular limits do.
        await setAltDownloadLimit(kbToBytes(Math.round(limit)));
        showToast(
          limit === 0
            ? t('screens.transfer.altDownloadLimitRemoved')
            : t('screens.transfer.altDownloadLimitSet', { value: Math.round(limit) }),
          'success',
        );
      } else if (limitType === 'altUpload') {
        await setAltUploadLimit(kbToBytes(Math.round(limit)));
        showToast(
          limit === 0
            ? t('screens.transfer.altUploadLimitRemoved')
            : t('screens.transfer.altUploadLimitSet', { value: Math.round(limit) }),
          'success',
        );
      } else {
        const limitInBytes = kbToBytes(limit);
        if (limitType === 'download') {
          await setDownloadLimit(limitInBytes);
          showToast(
            limit === 0
              ? t('screens.transfer.downloadLimitRemoved')
              : t('screens.transfer.downloadLimitSet', { value: Math.round(limit) }),
            'success',
          );
        } else {
          await setUploadLimit(limitInBytes);
          showToast(
            limit === 0
              ? t('screens.transfer.uploadLimitRemoved')
              : t('screens.transfer.uploadLimitSet', { value: Math.round(limit) }),
            'success',
          );
        }
      }
      setLimitInput('');
      setLimitType(null);
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSettingLimit(false);
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return colors.success;
      case 'firewalled':
        return colors.warning;
      case 'disconnected':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const diskSpaceInfo = serverState ? { free: serverState.free_space_on_disk || 0 } : null;

  // --- Early returns for disconnected / loading / error states ---

  // Show the quick-connect screen whenever there is no live connection.
  // currentServer intentionally survives a disconnect (for one-tap
  // reconnect), so it must NOT gate this screen.
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

  // Show the loading spinner during initial launch, during background
  // recovery, or while a fresh error is still within its grace window —
  // most poll failures self-heal within a couple of seconds and shouldn't
  // flash a hard error.
  if (
    (!initialLoadComplete && (serverIsLoading || !isConnected || isLoading)) ||
    (initialLoadComplete && (isRecoveringFromBackground || isPendingError))
  ) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (graceError && initialLoadComplete) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.error }]}>{graceError}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={refresh}
        >
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!transferInfo && isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!transferInfo) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          {t('screens.transfer.noTransferInfo')}
        </Text>
      </View>
    );
  }

  const isAltSpeedEnabled = transferInfo.use_alt_speed_limits ?? false;

  const getDisplayLimit = (regularLimit: number, altLimit: number | undefined) => {
    // When alt speed is active, show the configured alt limit; fall back to the active
    // rate limit (which equals the alt limit when alt mode is on, so the display is always
    // correct even when the preferences fetch fails).
    const limit = isAltSpeedEnabled ? (altLimit ?? regularLimit) : regularLimit;
    return limit > 0 ? formatSpeed(limit) : t('common.unlimited');
  };

  const getLimitModalTitle = () => {
    switch (limitType) {
      case 'download':
        return t('screens.transfer.downloadLimit');
      case 'upload':
        return t('screens.transfer.uploadLimit');
      case 'altDownload':
        return t('screens.transfer.altDownloadLimit');
      case 'altUpload':
        return t('screens.transfer.altUploadLimit');
      default:
        return '';
    }
  };

  const openAltLimitModal = (type: 'altDownload' | 'altUpload') => {
    const currentBytes =
      type === 'altDownload' ? transferInfo.alt_dl_limit : transferInfo.alt_up_limit;
    setLimitType(type);
    setLimitInput(
      currentBytes != null && currentBytes > 0 ? String(Math.round(bytesToKb(currentBytes))) : '',
    );
    setLimitModalVisible(true);
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Custom limit modal */}
        <Modal
          visible={limitModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLimitModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {getLimitModalTitle()}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {t('screens.transfer.limitModalSubtitle')}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.surfaceOutline,
                    color: colors.text,
                  },
                ]}
                placeholder={t('placeholders.enterKbs')}
                placeholderTextColor={colors.textSecondary}
                value={limitInput}
                onChangeText={setLimitInput}
                keyboardType="numeric"
                autoFocus
              />
              {limitInput && parseFloat(limitInput) > 0 && (
                <Text style={[styles.modalEquivalent, { color: colors.primary }]}>
                  = {formatSpeed(kbToBytes(parseFloat(limitInput)))}
                </Text>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.background }]}
                  onPress={() => setLimitModalVisible(false)}
                >
                  <Text style={[styles.modalButtonLabel, { color: colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleLimitSubmit}
                >
                  <Text style={[styles.modalButtonLabel, { color: '#FFFFFF' }]}>
                    {t('screens.transfer.set')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <InputModal
          visible={maxRatioModalVisible}
          title={t('screens.transfer.maxRatio')}
          defaultValue={maxRatio.toFixed(2)}
          keyboardType="numeric"
          validate={(value) =>
            parseSpeedLimitInput(value) === null ? t('errors.validNumber') : null
          }
          presets={[
            {
              label: t('common.unlimited'),
              value: '',
              // "Unlimited" for a global limit means turning the limit off
              // entirely — there's no sentinel number for it like per-torrent
              // limits have.
              action: () => {
                setMaxRatioModalVisible(false);
                const prev = ratioLimitEnabled;
                setSeedingLimitPreference(
                  'max_ratio_enabled',
                  false,
                  () => setRatioLimitEnabled(false),
                  () => setRatioLimitEnabled(prev),
                );
              },
            },
          ]}
          onCancel={() => setMaxRatioModalVisible(false)}
          onConfirm={(value) => {
            const parsed = parseSpeedLimitInput(value);
            if (parsed === null) {
              showToast(t('errors.validNumber'), 'error');
              return;
            }
            setMaxRatioModalVisible(false);
            const prev = maxRatio;
            setSeedingLimitPreference(
              'max_ratio',
              parsed,
              () => setMaxRatio(parsed),
              () => setMaxRatio(prev),
            );
          }}
        />

        <InputModal
          visible={maxSeedingTimeModalVisible}
          title={t('screens.transfer.maxSeedingTime')}
          defaultValue={String(maxSeedingTime)}
          keyboardType="numeric"
          validate={(value) =>
            parseSpeedLimitInput(value) === null ? t('errors.validNumber') : null
          }
          presets={[
            {
              label: t('common.unlimited'),
              value: '',
              action: () => {
                setMaxSeedingTimeModalVisible(false);
                const prev = seedingTimeLimitEnabled;
                setSeedingLimitPreference(
                  'max_seeding_time_enabled',
                  false,
                  () => setSeedingTimeLimitEnabled(false),
                  () => setSeedingTimeLimitEnabled(prev),
                );
              },
            },
          ]}
          onCancel={() => setMaxSeedingTimeModalVisible(false)}
          onConfirm={(value) => {
            const parsed = parseSpeedLimitInput(value);
            if (parsed === null) {
              showToast(t('errors.validNumber'), 'error');
              return;
            }
            const rounded = Math.round(parsed);
            setMaxSeedingTimeModalVisible(false);
            const prev = maxSeedingTime;
            setSeedingLimitPreference(
              'max_seeding_time',
              rounded,
              () => setMaxSeedingTime(rounded),
              () => setMaxSeedingTime(prev),
            );
          }}
        />

        <OptionPicker
          visible={maxRatioActPickerVisible}
          title={t('screens.transfer.whenLimitReached')}
          options={maxRatioActOptions}
          selectedValue={String(maxRatioAct)}
          onSelect={(value) => {
            const act = Number(value);
            const prev = maxRatioAct;
            setMaxRatioActPickerVisible(false);
            setSeedingLimitPreference(
              'max_ratio_act',
              act,
              () => setMaxRatioAct(act),
              () => setMaxRatioAct(prev),
            );
          }}
          onClose={() => setMaxRatioActPickerVisible(false)}
        />

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
          {/* ========== HERO SECTION ========== */}
          <View style={styles.heroSection}>
            <View style={styles.heroSpeedRow}>
              <View style={styles.heroSpeedItem}>
                <Ionicons name="arrow-down" size={20} color={colors.primary} />
                <Text
                  style={[styles.heroSpeedValue, { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {formatSpeed(transferInfo.dl_info_speed)}
                </Text>
              </View>
              <View style={styles.heroSpeedItem}>
                <Ionicons name="arrow-up" size={20} color={colors.success} />
                <Text
                  style={[styles.heroSpeedValue, { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {formatSpeed(transferInfo.up_info_speed)}
                </Text>
              </View>
            </View>
            <View style={[styles.heroGraphCard, { backgroundColor: colors.surface }]}>
              <View style={styles.heroGraphContainer}>
                <View style={styles.heroGraphOverlay}>
                  <SpeedGraph
                    data={downloadGraphData}
                    color={colors.primary}
                    width={INNER_GRAPH_WIDTH}
                    height={80}
                    maxValue={graphMax}
                  />
                </View>
                <View style={styles.heroGraphOverlay}>
                  <SpeedGraph
                    data={uploadGraphData}
                    color={colors.success}
                    width={INNER_GRAPH_WIDTH}
                    height={80}
                    maxValue={graphMax}
                  />
                </View>
              </View>
              <Text style={[styles.graphScaleCaption, { color: colors.textSecondary }]}>
                {t('screens.transfer.graphScale', { value: formatSpeed(graphMax) })}
              </Text>
            </View>
          </View>

          {/* ========== SPEED LIMITS ========== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.transfer.speedLimits')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => openLimitModal('download')}
                disabled={settingLimit || isAltSpeedEnabled}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.downloadLimit')}
                </Text>
                <View style={styles.rowTrailing}>
                  {isAltSpeedEnabled && (
                    <Text style={[styles.altBadge, { color: colors.primary }]}>ALT</Text>
                  )}
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {getDisplayLimit(transferInfo.dl_rate_limit, transferInfo.alt_dl_limit)}
                  </Text>
                  <Ionicons
                    name="pencil"
                    size={14}
                    color={isAltSpeedEnabled ? colors.surfaceOutline : colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <TouchableOpacity
                style={styles.row}
                onPress={() => openLimitModal('upload')}
                disabled={settingLimit || isAltSpeedEnabled}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.uploadLimit')}
                </Text>
                <View style={styles.rowTrailing}>
                  {isAltSpeedEnabled && (
                    <Text style={[styles.altBadge, { color: colors.primary }]}>ALT</Text>
                  )}
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {getDisplayLimit(transferInfo.up_rate_limit, transferInfo.alt_up_limit)}
                  </Text>
                  <Ionicons
                    name="pencil"
                    size={14}
                    color={isAltSpeedEnabled ? colors.surfaceOutline : colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              {/* Alt Download Limit — always editable */}
              <TouchableOpacity
                style={styles.row}
                onPress={() => openAltLimitModal('altDownload')}
                disabled={settingLimit}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.altDownloadLimit')}
                </Text>
                <View style={styles.rowTrailing}>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {transferInfo.alt_dl_limit != null && transferInfo.alt_dl_limit > 0
                      ? formatSpeed(transferInfo.alt_dl_limit)
                      : t('common.unlimited')}
                  </Text>
                  <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              {/* Alt Upload Limit — always editable */}
              <TouchableOpacity
                style={styles.row}
                onPress={() => openAltLimitModal('altUpload')}
                disabled={settingLimit}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.altUploadLimit')}
                </Text>
                <View style={styles.rowTrailing}>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {transferInfo.alt_up_limit != null && transferInfo.alt_up_limit > 0
                      ? formatSpeed(transferInfo.alt_up_limit)
                      : t('common.unlimited')}
                  </Text>
                  <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.alternativeSpeeds')}
                </Text>
                <View style={styles.switchHost}>
                  <Switch
                    value={isAltSpeedEnabled}
                    onValueChange={handleToggleAltSpeed}
                    disabled={actionLoading === 'altSpeed'}
                    trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ========== SEEDING LIMITS ========== */}
          {isConnected && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.transfer.seedingLimits')}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.ratioLimitEnabled')}
                  </Text>
                  <View style={styles.switchHost}>
                    <Switch
                      value={ratioLimitEnabled}
                      onValueChange={(value) => {
                        const prev = ratioLimitEnabled;
                        setSeedingLimitPreference(
                          'max_ratio_enabled',
                          value,
                          () => setRatioLimitEnabled(value),
                          () => setRatioLimitEnabled(prev),
                        );
                      }}
                      trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                    />
                  </View>
                </View>

                {ratioLimitEnabled && (
                  <>
                    <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => setMaxRatioModalVisible(true)}
                    >
                      <Text style={[styles.rowLabel, { color: colors.text }]}>
                        {t('screens.transfer.maxRatio')}
                      </Text>
                      <View style={styles.rowTrailing}>
                        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                          {maxRatio.toFixed(2)}
                        </Text>
                        <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  </>
                )}

                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.seedingTimeLimitEnabled')}
                  </Text>
                  <View style={styles.switchHost}>
                    <Switch
                      value={seedingTimeLimitEnabled}
                      onValueChange={(value) => {
                        const prev = seedingTimeLimitEnabled;
                        setSeedingLimitPreference(
                          'max_seeding_time_enabled',
                          value,
                          () => setSeedingTimeLimitEnabled(value),
                          () => setSeedingTimeLimitEnabled(prev),
                        );
                      }}
                      trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                    />
                  </View>
                </View>

                {seedingTimeLimitEnabled && (
                  <>
                    <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => setMaxSeedingTimeModalVisible(true)}
                    >
                      <Text style={[styles.rowLabel, { color: colors.text }]}>
                        {t('screens.transfer.maxSeedingTime')}
                      </Text>
                      <View style={styles.rowTrailing}>
                        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                          {formatTime(maxSeedingTime * 60)}
                        </Text>
                        <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  </>
                )}

                {(ratioLimitEnabled || seedingTimeLimitEnabled) && (
                  <>
                    <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => setMaxRatioActPickerVisible(true)}
                    >
                      <Text style={[styles.rowLabel, { color: colors.text }]}>
                        {t('screens.transfer.whenLimitReached')}
                      </Text>
                      <View style={styles.rowTrailing}>
                        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                          {maxRatioActOptions.find((opt) => opt.value === String(maxRatioAct))
                            ?.label ?? maxRatioActOptions[0].label}
                        </Text>
                        <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}

          {/* ========== ACTIONS ========== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.transfer.actions')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={styles.row}
                onPress={handleResumeAll}
                disabled={actionLoading !== null}
              >
                <View style={styles.rowLeading}>
                  {actionLoading === 'resume' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="play" size={20} color={colors.primary} />
                  )}
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.resumeAll')}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <TouchableOpacity
                style={styles.row}
                onPress={handlePauseAll}
                disabled={actionLoading !== null}
              >
                <View style={styles.rowLeading}>
                  {actionLoading === 'pause' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="pause" size={20} color={colors.primary} />
                  )}
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.pauseAll')}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <TouchableOpacity
                style={styles.row}
                onPress={handleForceStartAll}
                disabled={actionLoading !== null}
              >
                <View style={styles.rowLeading}>
                  {actionLoading === 'forceStart' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="flash" size={20} color={colors.primary} />
                  )}
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.forceStartAll')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ========== THIS SESSION ========== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.transfer.thisSession')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.downloaded')}
                </Text>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                  {formatSize(transferInfo.dl_info_data)}
                </Text>
              </View>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.uploaded')}
                </Text>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                  {formatSize(transferInfo.up_info_data)}
                </Text>
              </View>
            </View>
          </View>

          {/* ========== ALL TIME ========== */}
          {serverState && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.transfer.allTime')}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.downloaded')}
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {formatSize(serverState.alltime_dl || 0)}
                  </Text>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.uploaded')}
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {formatSize(serverState.alltime_ul || 0)}
                  </Text>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.globalRatio')}
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {serverState.global_ratio || '0.00'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ========== CONNECTION ========== */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.transfer.connection')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.row}>
                <View style={styles.rowLeading}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: getConnectionStatusColor(transferInfo.connection_status),
                      },
                    ]}
                  />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('screens.transfer.status')}
                  </Text>
                </View>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                  {transferInfo.connection_status.charAt(0).toUpperCase() +
                    transferInfo.connection_status.slice(1)}
                </Text>
              </View>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.dhtNodes')}
                </Text>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                  {transferInfo.dht_nodes.toLocaleString()}
                </Text>
              </View>

              {serverState && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>
                      {t('screens.transfer.peers')}
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                      {(serverState.total_peer_connections || 0).toLocaleString()}
                    </Text>
                  </View>
                </>
              )}

              {diskSpaceInfo && diskSpaceInfo.free > 0 && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>
                      {t('screens.transfer.freeDiskSpace')}
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                      {formatSize(diskSpaceInfo.free)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  loadingText: {
    ...typography.small,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  errorTitle: {
    ...typography.h4,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    ...typography.bodySemibold,
  },

  // Hero
  heroSection: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroSpeedRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: spacing.lg,
  },
  heroSpeedItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  heroSpeedValue: {
    ...typography.largeTitle,
    flexShrink: 1,
  },
  heroGraphCard: {
    width: GRAPH_WIDTH,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingHorizontal: GRAPH_CARD_PADDING,
    borderRadius: 12,
  },
  heroGraphContainer: {
    width: INNER_GRAPH_WIDTH,
    height: 80,
    position: 'relative',
  },
  heroGraphOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  graphScaleCaption: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  // Sections
  section: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    // Match torrent-detail / Settings switch rows so UISwitch sits optically
    // centered with the label (minHeight alone leaves the control top-heavy).
    paddingVertical: 10,
  },
  rowLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // UISwitch's layout frame is taller than the visible control and top-weighted;
  // clip to the visual height so alignItems: 'center' on the row actually centers it.
  switchHost: {
    height: 31,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowLabel: {
    ...typography.body,
    flex: 1,
    marginRight: spacing.md,
  },
  rowSub: {
    ...typography.caption,
    marginTop: 2,
  },
  rowValue: {
    ...typography.body,
  },
  altBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: spacing.xxl,
  },
  modalTitle: {
    ...typography.h4,
    marginBottom: spacing.xs + 2,
  },
  modalSubtitle: {
    ...typography.small,
    marginBottom: spacing.xl,
  },
  modalInput: {
    borderWidth: 0.5,
    borderRadius: 12,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  modalEquivalent: {
    ...typography.smallMedium,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  modalButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  modalButtonLabel: {
    ...typography.bodySemibold,
  },
});
