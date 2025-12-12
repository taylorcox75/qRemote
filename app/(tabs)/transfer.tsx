import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTransfer } from '../../context/TransferContext';
import { useServer } from '../../context/ServerContext';
import { useTorrents } from '../../context/TorrentContext';
import { useTheme } from '../../context/ThemeContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { torrentsApi } from '../../services/api/torrents';
import { formatSize, formatSpeed, kbToBytes, bytesToKb } from '../../utils/format';
import { shadows } from '../../constants/shadows';
import { spacing, borderRadius } from '../../constants/spacing';
import { buttonStyles, buttonText } from '../../constants/buttons';
import { typography } from '../../constants/typography';

const SPEED_PRESETS = [
  { label: '∞', value: 0 },
  { label: '512K', value: 512 },
  { label: '1M', value: 1024 },
  { label: '2M', value: 2048 },
  { label: '5M', value: 5120 },
  { label: '10M', value: 10240 },
];

export default function TransferScreen() {
  const { transferInfo, isLoading, error, refresh, toggleAlternativeSpeedLimits, setDownloadLimit, setUploadLimit } = useTransfer();
  const { isConnected } = useServer();
  const { serverState, sync: syncTorrents } = useTorrents();
  const { colors, isDark } = useTheme();
  
  const [settingLimit, setSettingLimit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitType, setLimitType] = useState<'download' | 'upload' | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), syncTorrents()]);
    setRefreshing(false);
  }, [refresh, syncTorrents]);

  const handlePauseAll = async () => {
    setActionLoading('pause');
    try {
      await torrentsApi.pauseTorrents(['all']);
      await syncTorrents();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pause all torrents');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeAll = async () => {
    setActionLoading('resume');
    try {
      await torrentsApi.resumeTorrents(['all']);
      await syncTorrents();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resume all torrents');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAltSpeed = async () => {
    setActionLoading('altSpeed');
    try {
      await toggleAlternativeSpeedLimits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to toggle alternative speed limits');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePresetSelect = async (type: 'download' | 'upload', kbValue: number) => {
    setSettingLimit(true);
    try {
      const bytesValue = kbToBytes(kbValue);
      if (type === 'download') {
        await setDownloadLimit(bytesValue);
      } else {
        await setUploadLimit(bytesValue);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to set ${type} limit`);
    } finally {
      setSettingLimit(false);
    }
  };

  const openLimitModal = (type: 'download' | 'upload') => {
    setLimitType(type);
    const currentLimit = type === 'download' 
      ? transferInfo?.dl_rate_limit 
      : transferInfo?.up_rate_limit;
    setLimitInput(currentLimit && currentLimit > 0 ? String(bytesToKb(currentLimit)) : '');
    setLimitModalVisible(true);
  };

  const handleLimitSubmit = async () => {
    if (!limitType) return;
    
    const limit = parseFloat(limitInput);
    if (isNaN(limit) || limit < 0) {
      Alert.alert('Error', 'Please enter a valid number');
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
      Alert.alert('Error', err.message || `Failed to set ${limitType} limit`);
    } finally {
      setSettingLimit(false);
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return colors.success;
      case 'firewalled': return '#FF9500';
      case 'disconnected': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const diskSpaceInfo = serverState ? { free: serverState.free_space_on_disk || 0 } : null;

  if (!isConnected) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Ionicons name="cloud-offline-outline" size={56} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Not Connected</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Connect to a server in Settings
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
        <Text style={[styles.emptyTitle, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={refresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !transferInfo) {
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
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No transfer info</Text>
      </View>
    );
  }

  const isAltSpeedEnabled = transferInfo.use_alt_speed_limits ?? false;

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Limit Input Modal */}
        <Modal
          visible={limitModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLimitModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {limitType === 'download' ? 'Download' : 'Upload'} Limit
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Enter limit in KB/s (0 for unlimited)
              </Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                placeholder="Enter KB/s"
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
                  <Text style={[styles.modalButtonTextCancel, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleLimitSubmit}
                >
                  <Text style={styles.modalButtonText}>Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {/* Speed Dashboard */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>CURRENT SPEED</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {/* Speed Graphs */}
              <View style={styles.graphsContainer}>
                <View style={styles.graphItem}>
                  <View style={styles.graphHeader}>
                    <Ionicons name="arrow-down" size={18} color={colors.primary} />
                    <Text style={[styles.graphLabel, { color: colors.textSecondary }]}>Download</Text>
                  </View>
                  <View style={{ width: 150, height: 50, backgroundColor: colors.surface, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Graph</Text>
                  </View>
                  <Text style={[styles.graphValue, { color: colors.text }]}>
                    {formatSpeed(transferInfo.dl_info_speed)}
                  </Text>
                </View>

                <View style={[styles.graphDivider, { backgroundColor: colors.surfaceOutline }]} />

                <View style={styles.graphItem}>
                  <View style={styles.graphHeader}>
                    <Ionicons name="arrow-up" size={18} color={colors.success} />
                    <Text style={[styles.graphLabel, { color: colors.textSecondary }]}>Upload</Text>
                  </View>
                  <View style={{ width: 150, height: 50, backgroundColor: colors.surface, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Graph</Text>
                  </View>
                  <Text style={[styles.graphValue, { color: colors.text }]}>
                    {formatSpeed(transferInfo.up_info_speed)}
                  </Text>
                </View>
              </View>
              <View style={[styles.limitsBar, { backgroundColor: colors.background }]}>
                <View style={styles.limitItem}>
                  <Ionicons name="arrow-down" size={14} color={colors.primary} />
                  <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                    {transferInfo.dl_rate_limit > 0 ? formatSpeed(transferInfo.dl_rate_limit) : '∞'}
                  </Text>
                </View>
                <Text style={[styles.limitsLabel, { color: colors.textSecondary }]}>Limits</Text>
                <View style={styles.limitItem}>
                  <Ionicons name="arrow-up" size={14} color={colors.success} />
                  <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                    {transferInfo.up_rate_limit > 0 ? formatSpeed(transferInfo.up_rate_limit) : '∞'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>QUICK ACTIONS</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.success + '12' }]}
                  onPress={handleResumeAll}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'resume' ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Ionicons name="play" size={20} color={colors.text} />
                  )}
                  <Text style={[styles.actionText, { color: colors.text }]}>Resume All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#FF9500' + '12' }]}
                  onPress={handlePauseAll}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'pause' ? (
                    <ActivityIndicator size="small" color="#FF9500" />
                  ) : (
                    <Ionicons name="pause" size={20} color="#FF9500" />
                  )}
                  <Text style={[styles.actionText, { color: '#FF9500' }]}>Pause All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: isAltSpeedEnabled ? colors.primary + '20' : colors.background }]}
                  onPress={handleToggleAltSpeed}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'altSpeed' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons 
                      name={isAltSpeedEnabled ? 'speedometer' : 'speedometer-outline'} 
                      size={20} 
                      color={isAltSpeedEnabled ? colors.text : colors.textSecondary} 
                    />
                  )}
                  <Text style={[styles.actionText, { color: isAltSpeedEnabled ? colors.text : colors.text }]}>
                    Alt Speed
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Statistics */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>STATISTICS</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.subsectionLabel, { color: colors.textSecondary }]}>This Session</Text>
              <View style={styles.statsRow}>
                <StatBox icon="cloud-download-outline" iconColor={colors.primary} label="Downloaded" value={formatSize(transferInfo.dl_info_data)} colors={colors} />
                <StatBox icon="cloud-upload-outline" iconColor={colors.success} label="Uploaded" value={formatSize(transferInfo.up_info_data)} colors={colors} />
              </View>

              {serverState && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <Text style={[styles.subsectionLabel, { color: colors.textSecondary }]}>All Time</Text>
                  <View style={styles.statsRow}>
                    <StatBox icon="download-outline" iconColor={colors.primary} label="Total DL" value={formatSize(serverState.alltime_dl || 0)} colors={colors} />
                    <StatBox icon="push-outline" iconColor={colors.success} label="Total UL" value={formatSize(serverState.alltime_ul || 0)} colors={colors} />
                  </View>
                  <View style={[styles.infoRow, { backgroundColor: colors.background }]}>
                    <View style={styles.infoLeft}>
                      <Ionicons name="swap-horizontal-outline" size={18} color={colors.textSecondary} />
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Global Ratio</Text>
                    </View>
                    <Text style={[styles.infoValue, { color: colors.text }]}>{serverState.global_ratio || '0.00'}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Speed Limits */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>SPEED LIMITS</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {/* Download */}
              <View style={styles.limitSection}>
                <View style={styles.limitHeader}>
                  <View style={styles.limitTitleRow}>
                    <Ionicons name="arrow-down-circle" size={20} color={colors.primary} />
                    <Text style={[styles.limitTitle, { color: colors.text }]}>Download</Text>
                  </View>
                  <TouchableOpacity style={styles.editButton} onPress={() => openLimitModal('download')}>
                    <Text style={[styles.editButtonText, { color: colors.primary }]}>
                      {transferInfo.dl_rate_limit > 0 ? formatSpeed(transferInfo.dl_rate_limit) : 'Unlimited'}
                    </Text>
                    <Ionicons name="pencil" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.presetsWrap}>
                  {SPEED_PRESETS.map((preset) => {
                    const isActive = transferInfo.dl_rate_limit === kbToBytes(preset.value);
                    return (
                      <TouchableOpacity
                        key={`dl-${preset.value}`}
                        style={[styles.presetChip, { backgroundColor: isActive ? colors.primary : colors.background, borderColor: isActive ? colors.primary : colors.surfaceOutline }]}
                        onPress={() => handlePresetSelect('download', preset.value)}
                        disabled={settingLimit}
                      >
                        <Text style={[styles.presetChipText, { color: isActive ? '#FFFFFF' : colors.text }]}>{preset.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              {/* Upload */}
              <View style={styles.limitSection}>
                <View style={styles.limitHeader}>
                  <View style={styles.limitTitleRow}>
                    <Ionicons name="arrow-up-circle" size={20} color={colors.success} />
                    <Text style={[styles.limitTitle, { color: colors.text }]}>Upload</Text>
                  </View>
                  <TouchableOpacity style={styles.editButton} onPress={() => openLimitModal('upload')}>
                    <Text style={[styles.editButtonText, { color: colors.success }]}>
                      {transferInfo.up_rate_limit > 0 ? formatSpeed(transferInfo.up_rate_limit) : 'Unlimited'}
                    </Text>
                    <Ionicons name="pencil" size={14} color={colors.success} />
                  </TouchableOpacity>
                </View>
                <View style={styles.presetsWrap}>
                  {SPEED_PRESETS.map((preset) => {
                    const isActive = transferInfo.up_rate_limit === kbToBytes(preset.value);
                    return (
                      <TouchableOpacity
                        key={`ul-${preset.value}`}
                        style={[styles.presetChip, { backgroundColor: isActive ? colors.success : colors.background, borderColor: isActive ? colors.success : colors.surfaceOutline }]}
                        onPress={() => handlePresetSelect('upload', preset.value)}
                        disabled={settingLimit}
                      >
                        <Text style={[styles.presetChipText, { color: isActive ? '#FFFFFF' : colors.text }]}>{preset.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          {/* Connection */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>CONNECTION</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.connectionRow}>
                <View style={[styles.statusDot, { backgroundColor: getConnectionStatusColor(transferInfo.connection_status) }]} />
                <View style={styles.connectionInfo}>
                  <Text style={[styles.connectionTitle, { color: colors.text }]}>
                    {transferInfo.connection_status.charAt(0).toUpperCase() + transferInfo.connection_status.slice(1)}
                  </Text>
                  <Text style={[styles.connectionSubtitle, { color: colors.textSecondary }]}>Connection Status</Text>
                </View>
              </View>

              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <View style={styles.networkRow}>
                <View style={styles.networkItem}>
                  <Ionicons name="git-network-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.networkValue, { color: colors.text }]}>{transferInfo.dht_nodes.toLocaleString()}</Text>
                  <Text style={[styles.networkLabel, { color: colors.textSecondary }]}>DHT Nodes</Text>
                </View>
                {serverState && (
                  <View style={styles.networkItem}>
                    <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.networkValue, { color: colors.text }]}>{(serverState.total_peer_connections || 0).toLocaleString()}</Text>
                    <Text style={[styles.networkLabel, { color: colors.textSecondary }]}>Peers</Text>
                  </View>
                )}
              </View>

              {diskSpaceInfo && diskSpaceInfo.free > 0 && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.storageRow}>
                    <View style={{ width: 80, height: 80, backgroundColor: colors.surface, borderRadius: 40, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="server" size={32} color={colors.primary} />
                    </View>
                    <View style={styles.storageInfo}>
                      <Text style={[styles.storageLabel, { color: colors.textSecondary }]}>
                        Free Disk Space
                      </Text>
                      <Text style={[styles.storageValue, { color: colors.text }]}>
                        {formatSize(diskSpaceInfo.free)}
                      </Text>
                      {serverState?.total_size && (
                        <Text style={[styles.storageTotal, { color: colors.textSecondary }]}>
                          of {formatSize(serverState.total_size)}
                        </Text>
                      )}
                    </View>
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

function StatBox({ icon, iconColor, label, value, colors }: { icon: string; iconColor: string; label: string; value: string; colors: any }) {
  return (
    <View style={[styles.statBox, { backgroundColor: colors.background }]}>
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
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
  emptyTitle: {
    ...typography.h4,
  },
  emptySubtitle: {
    ...typography.small,
    textAlign: 'center',
  },
  retryButton: {
    ...buttonStyles.primary,
    marginTop: spacing.sm,
  },
  retryButtonText: {
    ...buttonText.primary,
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
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    ...shadows.card,
  },
  separator: {
    height: 1,
    marginLeft: spacing.lg,
  },
  subsectionLabel: {
    ...typography.captionSemibold,
    letterSpacing: 0.3,
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 8,
  },

  // Speed Dashboard
  graphsContainer: {
    flexDirection: 'row',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  graphItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  graphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  graphLabel: {
    ...typography.label,
  },
  graphValue: {
    ...typography.h3,
    marginTop: spacing.xs,
  },
  graphDivider: {
    width: 1,
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  speedRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xl,
  },
  speedItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  speedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedInfo: {
    alignItems: 'flex-start',
  },
  speedValue: {
    ...typography.h4,
  },
  speedLabel: {
    ...typography.captionMedium,
    marginTop: 2,
  },
  speedDivider: {
    width: 1,
    height: 40,
    alignSelf: 'center',
  },
  limitsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.xl,
    gap: spacing.lg,
  },
  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  limitText: {
    ...typography.small,
    fontWeight: '500',
  },
  limitsLabel: {
    ...typography.captionMedium,
  },

  // Quick Actions
  actionsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.large,
    gap: spacing.sm,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Statistics
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm + 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md + 2,
    borderRadius: borderRadius.large,
    gap: spacing.xs + 2,
  },
  statValue: {
    ...typography.bodySemibold,
  },
  statLabel: {
    ...typography.label,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.large,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  infoLabel: {
    ...typography.small,
  },
  infoValue: {
    ...typography.secondaryMedium,
    fontWeight: '600',
  },

  // Speed Limits
  limitSection: {
    padding: spacing.lg,
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  limitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  limitTitle: {
    ...typography.bodySemibold,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editButtonText: {
    ...typography.smallSemibold,
  },
  presetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    // borderRadius: 16,  
    borderWidth: .25,
    minWidth: 50,
    alignItems: 'center',
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Connection
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    // borderRadius: 16,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  networkRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  networkItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  networkValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  networkLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  storageCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageInfo: {
    flex: 1,
  },
  storageLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  storageValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  storageTotal: {
    fontSize: 13,
    marginTop: 2,
  },
  diskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  diskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  diskLabel: {
    fontSize: 14,
  },
  diskValue: {
    fontSize: 15,
    fontWeight: '600',
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
    borderRadius: borderRadius.large,
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
    borderRadius: borderRadius.large,
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
    ...buttonStyles.small,
    minWidth: 70,
  },
  modalButtonText: {
    ...buttonText.small,
    color: '#FFFFFF',
  },
  modalButtonTextCancel: {
    ...buttonText.small,
  },
});
