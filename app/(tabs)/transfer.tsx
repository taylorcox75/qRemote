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
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTransfer } from '@/context/TransferContext';
import { ServerManager } from '@/services/server-manager';
import { ServerConfig } from '@/types/api';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { torrentsApi } from '@/services/api/torrents';
import { formatSize, formatSpeed, kbToBytes, bytesToKb } from '@/utils/format';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useSpeedTracker } from '@/hooks/useSpeedTracker';
import { SpeedGraph } from '@/components/SpeedGraph';
import { QuickConnectPanel } from '@/components/QuickConnectPanel';
import { OptionPicker } from '@/components/OptionPicker';

const SPEED_PRESETS = [
  { label: '∞', value: 0 },
  { label: '512K', value: 512 },
  { label: '1M', value: 1024 },
  { label: '2M', value: 2048 },
  { label: '5M', value: 5120 },
  { label: '10M', value: 10240 },
  { label: '20M', value: 20480 },
  { label: '50M', value: 51200 },
  { label: '100M', value: 102400 },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRAPH_HORIZONTAL_PADDING = spacing.lg * 2;
const GRAPH_WIDTH = SCREEN_WIDTH - GRAPH_HORIZONTAL_PADDING;

function buildSpeedOptions(t: (key: string, opts?: any) => string) {
  const options = SPEED_PRESETS.map((p) => ({
    label: p.value === 0 ? t('common.unlimited') : p.label,
    value: String(p.value),
  }));
  options.push({ label: t('screens.transfer.custom'), value: 'custom' });
  return options;
}

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
  } = useTransfer();
  const { isConnected, currentServer, isLoading: serverIsLoading, connectToServer } = useServer();
  const {
    torrents,
    serverState,
    sync: syncTorrents,
    isRecoveringFromBackground: torrentRecovering,
    initialLoadComplete,
  } = useTorrents();
  const isRecoveringFromBackground = transferRecovering || torrentRecovering;
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();

  // Quick-connect state
  const [savedServers, setSavedServers] = useState<ServerConfig[]>([]);
  const [serversLoaded, setServersLoaded] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectErrors, setConnectErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isConnected && !currentServer) {
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
  }, [isConnected, currentServer]);

  const handleQuickConnect = useCallback(
    async (server: ServerConfig) => {
      setConnectingId(server.id);
      setConnectErrors((prev) => {
        const next = { ...prev };
        delete next[server.id];
        return next;
      });
      try {
        await connectToServer(server);
      } catch (err: any) {
        setConnectErrors((prev) => ({ ...prev, [server.id]: err.message || 'Connection failed' }));
      } finally {
        setConnectingId(null);
      }
    },
    [connectToServer],
  );

  const [settingLimit, setSettingLimit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Speed limit picker state
  const [dlPickerVisible, setDlPickerVisible] = useState(false);
  const [ulPickerVisible, setUlPickerVisible] = useState(false);

  // Custom limit modal state
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitType, setLimitType] = useState<'download' | 'upload' | null>(null);
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
  const uploadGraphData = useMemo(
    () => speedData.map((point) => point.uploadSpeed),
    [speedData],
  );

  const speedOptions = useMemo(() => buildSpeedOptions(t), [t]);

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
    } catch (err: any) {
      showToast(err.message || 'Failed to pause all torrents', 'error');
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
    } catch (err: any) {
      showToast(err.message || 'Failed to resume all torrents', 'error');
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
    } catch (err: any) {
      showToast(err.message || 'Failed to force start all torrents', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseAllDownloads = async () => {
    setActionLoading('pauseDL');
    try {
      const downloadingHashes = torrents
        .filter(
          (t) => t.state === 'downloading' || t.state === 'forcedDL' || t.state === 'metaDL',
        )
        .map((t) => t.hash);
      if (downloadingHashes.length === 0) {
        showToast(t('screens.transfer.noDlTorrents'), 'info');
        setActionLoading(null);
        return;
      }
      await torrentsApi.pauseTorrents(downloadingHashes);
      await syncTorrents();
      showToast(
        t('screens.transfer.pausedDl', { count: downloadingHashes.length }),
        'success',
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to pause downloads', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseAllUploads = async () => {
    setActionLoading('pauseUL');
    try {
      const uploadingHashes = torrents
        .filter(
          (t) => t.state === 'uploading' || t.state === 'forcedUP' || t.state === 'stalledUP',
        )
        .map((t) => t.hash);
      if (uploadingHashes.length === 0) {
        showToast(t('screens.transfer.noUlTorrents'), 'info');
        setActionLoading(null);
        return;
      }
      await torrentsApi.pauseTorrents(uploadingHashes);
      await syncTorrents();
      showToast(
        t('screens.transfer.pausedUl', { count: uploadingHashes.length }),
        'success',
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to pause uploads', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAltSpeed = async () => {
    setActionLoading('altSpeed');
    try {
      await toggleAlternativeSpeedLimits();
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle alternative speed limits', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSpeedPickerSelect = async (type: 'download' | 'upload', value: string) => {
    if (value === 'custom') {
      const currentLimit =
        type === 'download' ? transferInfo?.dl_rate_limit : transferInfo?.up_rate_limit;
      setLimitType(type);
      setLimitInput(currentLimit && currentLimit > 0 ? String(bytesToKb(currentLimit)) : '');
      setLimitModalVisible(true);
      return;
    }
    const kbValue = parseInt(value, 10);
    setSettingLimit(true);
    try {
      const bytesValue = kbToBytes(kbValue);
      if (type === 'download') {
        await setDownloadLimit(bytesValue);
        showToast(
          kbValue === 0
            ? t('screens.transfer.downloadLimitRemoved')
            : t('screens.transfer.downloadLimitSet', { value: kbValue }),
          'success',
        );
      } else {
        await setUploadLimit(bytesValue);
        showToast(
          kbValue === 0
            ? t('screens.transfer.uploadLimitRemoved')
            : t('screens.transfer.uploadLimitSet', { value: kbValue }),
          'success',
        );
      }
    } catch (err: any) {
      showToast(err.message || `Failed to set ${type} limit`, 'error');
    } finally {
      setSettingLimit(false);
    }
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
      const limitInBytes = kbToBytes(limit);
      if (limitType === 'download') {
        await setDownloadLimit(limitInBytes);
      } else {
        await setUploadLimit(limitInBytes);
      }
      setLimitInput('');
      setLimitType(null);
    } catch (err: any) {
      showToast(err.message || `Failed to set ${limitType} limit`, 'error');
    } finally {
      setSettingLimit(false);
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return colors.success;
      case 'firewalled':
        return '#FF9500';
      case 'disconnected':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const diskSpaceInfo = serverState ? { free: serverState.free_space_on_disk || 0 } : null;

  // Current limit values as KB strings for the picker's selectedValue
  const currentDlLimitKb = transferInfo
    ? String(transferInfo.dl_rate_limit > 0 ? bytesToKb(transferInfo.dl_rate_limit) : 0)
    : '0';
  const currentUlLimitKb = transferInfo
    ? String(transferInfo.up_rate_limit > 0 ? bytesToKb(transferInfo.up_rate_limit) : 0)
    : '0';

  // --- Early returns for disconnected / loading / error states ---

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

  if (!initialLoadComplete && (serverIsLoading || !isConnected || isLoading)) {
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

  if (error && !isRecoveringFromBackground && initialLoadComplete) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.error }]}>{error}</Text>
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
                {t('screens.transfer.limitModalTitle', {
                  type: limitType === 'download' ? t('actions.downloaded') : t('actions.uploaded'),
                })}
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

        {/* Speed limit option pickers */}
        <OptionPicker
          visible={dlPickerVisible}
          title={t('screens.transfer.downloadLimit')}
          options={speedOptions}
          selectedValue={currentDlLimitKb}
          onSelect={(v) => handleSpeedPickerSelect('download', v)}
          onClose={() => setDlPickerVisible(false)}
        />
        <OptionPicker
          visible={ulPickerVisible}
          title={t('screens.transfer.uploadLimit')}
          options={speedOptions}
          selectedValue={currentUlLimitKb}
          onSelect={(v) => handleSpeedPickerSelect('upload', v)}
          onClose={() => setUlPickerVisible(false)}
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
                <Text style={[styles.heroSpeedValue, { color: colors.text }]}>
                  {formatSpeed(transferInfo.dl_info_speed)}
                </Text>
              </View>
              <View style={styles.heroSpeedItem}>
                <Ionicons name="arrow-up" size={20} color={colors.success} />
                <Text style={[styles.heroSpeedValue, { color: colors.text }]}>
                  {formatSpeed(transferInfo.up_info_speed)}
                </Text>
              </View>
            </View>
            <View style={styles.heroGraphContainer}>
              <View style={styles.heroGraphOverlay}>
                <SpeedGraph
                  data={downloadGraphData}
                  color={colors.primary}
                  width={GRAPH_WIDTH}
                  height={80}
                  maxValue={
                    transferInfo.dl_rate_limit > 0 ? transferInfo.dl_rate_limit : undefined
                  }
                />
              </View>
              <View style={styles.heroGraphOverlay}>
                <SpeedGraph
                  data={uploadGraphData}
                  color={colors.success}
                  width={GRAPH_WIDTH}
                  height={80}
                  maxValue={
                    transferInfo.up_rate_limit > 0 ? transferInfo.up_rate_limit : undefined
                  }
                />
              </View>
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
                onPress={() => setDlPickerVisible(true)}
                disabled={settingLimit}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.downloadLimit')}
                </Text>
                <View style={styles.rowTrailing}>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {transferInfo.dl_rate_limit > 0
                      ? formatSpeed(transferInfo.dl_rate_limit)
                      : t('common.unlimited')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <TouchableOpacity
                style={styles.row}
                onPress={() => setUlPickerVisible(true)}
                disabled={settingLimit}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.uploadLimit')}
                </Text>
                <View style={styles.rowTrailing}>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {transferInfo.up_rate_limit > 0
                      ? formatSpeed(transferInfo.up_rate_limit)
                      : t('common.unlimited')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('screens.transfer.alternativeSpeeds')}
                </Text>
                <Switch
                  value={isAltSpeedEnabled}
                  onValueChange={handleToggleAltSpeed}
                  disabled={actionLoading === 'altSpeed'}
                  trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                />
              </View>
            </View>
          </View>

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
                        backgroundColor: getConnectionStatusColor(
                          transferInfo.connection_status,
                        ),
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
                  <View
                    style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                  />
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
                  <View
                    style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                  />
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
    gap: spacing.xxxl,
    marginBottom: spacing.lg,
  },
  heroSpeedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroSpeedValue: {
    ...typography.largeTitle,
  },
  heroGraphContainer: {
    width: GRAPH_WIDTH,
    height: 80,
    position: 'relative',
  },
  heroGraphOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
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
  rowLabel: {
    ...typography.body,
  },
  rowValue: {
    ...typography.body,
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
