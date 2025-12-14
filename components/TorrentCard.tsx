import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TorrentInfo, TorrentState } from '../types/api';
import { torrentsApi } from '../services/api/torrents';
import { useServer } from '../context/ServerContext';
import { useTorrents } from '../context/TorrentContext';
import { useTheme } from '../context/ThemeContext';
import { useTransfer } from '../context/TransferContext';
import { apiClient } from '../services/api/client';
import { formatSpeed, formatSize, formatTime } from '../utils/format';
import * as Clipboard from 'expo-clipboard';
import { shadows } from '../constants/shadows';
import { spacing, borderRadius } from '../constants/spacing';

interface TorrentCardProps {
  torrent: TorrentInfo;
  viewMode?: 'compact' | 'expanded';
  onPress: () => void;
}

export function TorrentCard({ torrent, viewMode = 'expanded', onPress }: TorrentCardProps) {

  const { isConnected, currentServer, reconnect } = useServer();
  const { sync } = useTorrents();
  const { isDark, colors } = useTheme();
  const { transferInfo, toggleAlternativeSpeedLimits, refresh: refreshTransfer } = useTransfer();
  const [loading, setLoading] = useState(false);
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuButtonRef = useRef<TouchableOpacity>(null);

  // Check if torrent is stopped/paused
  // A torrent is considered paused/stopped if:
  // 1. State is explicitly pausedDL, pausedUP, or stoppedDL
  // Note: Stalled states (stalledDL, stalledUP) are still active, not paused
  const actualIsPaused = torrent.state === 'pausedDL' || torrent.state === 'pausedUP' || torrent.state === 'stoppedDL';
  
  // Check if trrrent is stalled
  const isStalled = torrent.state === 'stalledDL' || torrent.state === 'stalledUP';
  
  // Use optimistic state if set, otherwise use actual state
  const isPaused = optimisticPaused !== null ? optimisticPaused : actualIsPaused;

  const handlePauseResume = async () => {
    if (!isConnected || !currentServer) {
      Alert.alert('Error', 'Not connected to a server. Please connect to a server first.');
      return;
    }

    // Optimistically update the UI immediately
    const wasPaused = isPaused;
    setOptimisticPaused(!wasPaused);
    setLoading(true);

    try {
      // Ensure server is set in API client
      if (!apiClient.getServer()) {
        // Server was cleared, try to reconnect
        const reconnected = await reconnect();
        if (!reconnected) {
          // Revert optimistic update
          setOptimisticPaused(null);
          Alert.alert('Error', 'Lost connection to server. Please reconnect.');
          return;
        }
      }

      // Make the API call
      if (wasPaused) {
        await torrentsApi.resumeTorrents([torrent.hash]);
      } else {
        await torrentsApi.pauseTorrents([torrent.hash]);
      }
      
      // Sync in the background (don't wait for it)
      sync().catch(() => {});
    } catch (error: any) {
      // Revert optimistic update on error
      setOptimisticPaused(null);
      console.error('Pause/Resume error:', error);
      Alert.alert('Error', error.message || `Failed to ${wasPaused ? 'start' : 'pause'} torrent`);
    } finally {
      setLoading(false);
      // Clear optimistic state after a delay to allow sync to update
      setTimeout(() => {
        setOptimisticPaused(null);
      }, 2000);
    }
  };

  const handleForceStart = async () => {
    if (!isConnected || !currentServer) {
      Alert.alert('Error', 'Not connected to a server. Please connect to a server first.');
      return;
    }

    setLoading(true);

    try {
      // Ensure server is set in API client
      if (!apiClient.getServer()) {
        // Server was cleared, try to reconnect
        const reconnected = await reconnect();
        if (!reconnected) {
          Alert.alert('Error', 'Lost connection to server. Please reconnect.');
          return;
        }
      }

      // Force start the torrent
      await torrentsApi.setForceStart([torrent.hash], true);
      
      // Sync in the background (don't wait for it)
      sync().catch(() => {});
    } catch (error: any) {
      console.error('Force Start error:', error);
      Alert.alert('Error', error.message || 'Failed to force start torrent');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyData = async () => {
    try {
      await torrentsApi.recheckTorrents([torrent.hash]);
      Alert.alert('Success', 'Verification started');
      sync().catch(() => {});
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify torrent');
    }
  };

  const handleReannounce = async () => {
    try {
      await torrentsApi.reannounceTorrents([torrent.hash]);
      Alert.alert('Success', 'Reannounce sent');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reannounce');
    }
  };

  const handleCopyMagnet = async () => {
    try {
      if (torrent.magnet_uri) {
        await Clipboard.setStringAsync(torrent.magnet_uri);
        Alert.alert('Copied', 'Magnet link copied to clipboard');
      } else {
        Alert.alert('Error', 'No magnet link available');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to copy magnet link');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Torrent',
      'Do you want to delete the torrent files too?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Torrent Only',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], false);
              sync().catch(() => {});
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete torrent');
            }
          },
        },
        {
          text: 'With Files',
          style: 'destructive',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], true);
              sync().catch(() => {});
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete torrent');
            }
          },
        },
      ]
    );
  };

  const handleMaxPriority = async () => {
    if (!isConnected || !currentServer) {
      Alert.alert('Error', 'Not connected to a server.');
      return;
    }

    setLoading(true);
    try {
      if (!apiClient.getServer()) {
        const reconnected = await reconnect();
        if (!reconnected) {
          Alert.alert('Error', 'Lost connection to server.');
          return;
        }
      }
      await torrentsApi.setMaximalPriority([torrent.hash]);
      sync().catch(() => {});
      Alert.alert('Success', 'Priority set to maximum');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set priority');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDownloadLimit = () => {
    Alert.prompt(
      'Set Download Limit',
      'Enter limit in KB/s (0 for unlimited)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: async (value: string | undefined) => {
            if (value === undefined || value === null) return;
            try {
              setLoading(true);
              const limitKB = parseFloat(value) || 0;
              const limitBytes = limitKB * 1024;
              await torrentsApi.setTorrentDownloadLimit([torrent.hash], limitBytes);
              sync().catch(() => {});
              Alert.alert('Success', `Download limit set to ${limitKB === 0 ? 'unlimited' : `${limitKB} KB/s`}`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to set download limit');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
      torrent.dl_limit > 0 ? String(torrent.dl_limit / 1024) : '0'
    );
  };

  const handleToggleGlobalSpeedLimit = async () => {
    if (!isConnected || !currentServer) {
      Alert.alert('Error', 'Not connected to a server.');
      return;
    }

    setLoading(true);
    try {
      if (!apiClient.getServer()) {
        const reconnected = await reconnect();
        if (!reconnected) {
          Alert.alert('Error', 'Lost connection to server.');
          return;
        }
      }
      await toggleAlternativeSpeedLimits();
      await refreshTransfer();
      const isEnabled = transferInfo?.use_alt_speed_limits;
      Alert.alert('Success', `Global speed limit ${!isEnabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to toggle speed limit');
    } finally {
      setLoading(false);
    }
  };

  const showMenu = () => {
    if (menuButtonRef.current) {
      menuButtonRef.current.measureInWindow((x, y, width, height) => {
        const screenWidth = Dimensions.get('window').width;
        const menuWidth = 200;
        const menuX = Math.min(x - menuWidth + width, screenWidth - menuWidth - 16);
        setMenuPosition({ x: menuX, y: y + height + 8 });
        setMenuVisible(true);
      });
    }
  };

  const hideMenu = () => {
    setMenuVisible(false);
  };

  const handleMenuAction = (action: () => void) => {
    hideMenu();
    setTimeout(() => action(), 100);
  };

  const getStateColor = (state: TorrentState, progress: number): string => {
    // If torrent is 100% complete and stalled, show as green (Seeding)
    if (state === 'stalledUP' && progress >= 1) {
      return colors.success;
    }
    
    switch (state) {
      case 'downloading':
        
      case 'forcedDL':
        return colors.primary; // Blue for downloading states
      case 'metaDL':
        return colors.warning
      case 'forcedMetaDL':
        return colors.primary; // Blue for forced metadata download
      case 'uploading':
      case 'forcedUP':
        return  colors.success // Green for uploading states
      case 'pausedDL':
      case 'pausedUP':
        return isDark ? colors.surfaceOutline : colors.text
      case 'error':
        return '#FF3B30';
      case 'checkingDL':
      case 'checkingUP':
        return colors.warning
        case 'stoppedDL':
          return isDark ? colors.surfaceOutline : colors.text
      case 'stoppedUP':
        return colors.success
      case 'stalledDL':
        return colors.error
      case 'stalledUP':
        return isDark ? colors.surfaceOutline : colors.text
        default:
        return isDark ? colors.surfaceOutline : colors.text
    } 
  };

  const getStateLabel = (state: TorrentState, progress: number): string => {
    // If torrent is 100% complete and stalled, show as "Seeding"
    if (state === 'stalledUP' && progress >= 1) {
      return 'Seeding';
    }
    
    switch (state) {
      case 'downloading':
        return 'Downloading';
      case 'metaDL':
        return 'Metadata';
      case 'forcedMetaDL':
        return 'Forced Meta';
      case 'forcedDL':
        return 'Forced DL';
      case 'uploading':
        return 'Uploading';
      case 'forcedUP':
        return 'Forced UP';
      case 'pausedDL':
        return 'Paused';
      case 'pausedUP':
        return 'Paused';
      case 'error':
        return 'Error';
      case 'checkingDL':
      case 'checkingUP':
        return 'Checking';
      case 'queuedDL':
        return 'Queued';
      case 'queuedUP':
        return 'Queued';
      case 'stalledDL':
        return 'Stalled DL';
      case 'stalledUP':
        return 'Stalled UP';
      case 'stoppedDL':
        return 'Stopped';
      case 'stoppedUP':
        return 'Seeding';
      default:
        return state;
    }
  };

  const progress = (torrent.progress || 0) * 100;
  const stateColor = getStateColor(torrent.state, torrent.progress);
  const stateLabel = getStateLabel(torrent.state, torrent.progress);

  // Determine card state styling
  const cardStateStyle = () => {
    const styles: any = {};
    
    // Add colored left border for active states
    if (torrent.state === 'downloading' || torrent.state === 'forcedDL') {
      styles.borderLeftWidth = 3;
      styles.borderLeftColor = colors.primary;
    } else if (torrent.state === 'uploading' || torrent.state === 'forcedUP') {
      styles.borderLeftWidth = 3;
      styles.borderLeftColor = colors.success;
    } else if (torrent.state === 'stalledUP' && torrent.progress >= 1) {
      // Seeding (100% complete)
      styles.borderLeftWidth = 3;
      styles.borderLeftColor = colors.success;
    } else if (torrent.state === 'error') {
      styles.borderLeftWidth = 3;
      styles.borderLeftColor = colors.error;
    } else if (torrent.state === 'stalledDL' || torrent.state === 'stalledUP') {
      styles.borderLeftWidth = 3;
      styles.borderLeftColor = colors.error;
    }
    
    // Reduce opacity for paused/stopped
    if (isPaused || torrent.state === 'stoppedDL') {
      styles.opacity = 0.6;
    }
    
    return styles;
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, cardStateStyle()]}>
      <TouchableOpacity onPress={onPress} onLongPress={showMenu} activeOpacity={0.7} style={styles.cardContent}>
        {/* Row 1: Title | Menu */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {torrent.name}
            </Text>
            {/* Row 2: Centered status */}
            <View style={styles.statusRow}>
              <View style={[
                styles.stateBadge, 
                { backgroundColor: stateColor },
                isStalled && { borderWidth: 0, borderColor: colors.error },
                torrent.state === 'forcedMetaDL' && { borderWidth: 1, borderColor: '#FFD700' }
              ]}>
                <Text style={styles.stateText}>{stateLabel}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            ref={menuButtonRef}
            style={styles.menuButton}
            onPress={(e) => {
              e.stopPropagation();
              showMenu();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>



        {/* Row 3: Progress bar | Pause/Play */}
        <View style={styles.progressBarRow}>
          <View style={[styles.progressBar, { backgroundColor: colors.surfaceOutline }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: stateColor },
              ]}
            />
          </View>
          <TouchableOpacity
            style={[styles.progressActionButton, { backgroundColor: stateColor }]}
            onPress={(e) => {
              e.stopPropagation();
              handlePauseResume();
            }}
            disabled={loading}
            activeOpacity={0.76}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isPaused ? (
              <Ionicons name="play" size={16} color="#FFFFFF" />
            ) : (
              <Ionicons name="pause" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {viewMode === 'compact' ? (
          <View style={styles.compactStatsRow}>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              {progress.toFixed(1)}%
            </Text>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              {torrent.eta > 0 && torrent.eta < 8640000 ? formatTime(torrent.eta) : '∞'}
            </Text>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              {formatSpeed(torrent.dlspeed)}
            </Text>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              {formatSpeed(torrent.upspeed)}
            </Text>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              {formatSize(torrent.total_size > 0 ? torrent.total_size : torrent.size)}
            </Text>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              Ratio: {torrent.ratio ? torrent.ratio.toFixed(2) : '0.00'}
            </Text>
          </View>
        ) : (
          <>
      <View style={styles.statsGrid}>

        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DL Speed:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {formatSpeed(torrent.dlspeed)}
        </Text>
        </View>
          <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ETA:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {torrent.eta > 0 && torrent.eta < 8640000 ? formatTime(torrent.eta) : '∞'}
        </Text>  
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Downloaded:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {formatSize(torrent.downloaded)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>UL Ratio:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {torrent.ratio ? torrent.ratio.toFixed(2) : '0.00'}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Availability:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {torrent.availability ? torrent.availability.toFixed(2) : '0.00'}
          </Text>
        </View>
</View>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>UL Speed:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {formatSpeed(torrent.upspeed)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Percent:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {progress.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Size:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {formatSize(torrent.total_size > 0 ? torrent.total_size : torrent.size)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Seeds:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {torrent.num_seeds || 0} / {torrent.num_complete || 0}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Peers:</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {torrent.num_leechs || 0} / {torrent.num_incomplete || 0}
          </Text>
        </View>         
      </View>
          </>
        )}

      </TouchableOpacity>

      {/* Material Design Popup Menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={hideMenu}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={hideMenu}
        >
          <View
            style={[
              styles.menuContainer,
              {
                backgroundColor: colors.surface,
                top: menuPosition.y,
                left: menuPosition.x,
                shadowColor: colors.text,
              },
            ]}
          >
            <MenuOption
              icon={isPaused ? 'play' : 'pause'}
              label={isPaused ? 'Resume' : 'Pause'}
              onPress={() => handleMenuAction(handlePauseResume)}
              colors={colors}
            />
            <MenuOption
              icon="flash"
              label="Force Start"
              onPress={() => handleMenuAction(handleForceStart)}
              colors={colors}
            />
            <MenuOption
              icon="speedometer"
              label={`Global Speed Limit (${transferInfo?.use_alt_speed_limits ? 'ON' : 'OFF'})`}
              onPress={() => handleMenuAction(handleToggleGlobalSpeedLimit)}
              colors={colors}
            />
            <MenuOption
              icon="flag"
              label="Max Priority"
              onPress={() => handleMenuAction(handleMaxPriority)}
              colors={colors}
            />
            <MenuOption
              icon="download"
              label="Set DL Limit"
              onPress={() => handleMenuAction(handleSetDownloadLimit)}
              colors={colors}
            />
            <MenuOption
              icon="checkmark-circle"
              label="Verify Data"
              onPress={() => handleMenuAction(handleVerifyData)}
              colors={colors}
            />
            <MenuOption
              icon="refresh"
              label="Reannounce"
              onPress={() => handleMenuAction(handleReannounce)}
              colors={colors}
            />
            <MenuOption
              icon="link"
              label="Copy Magnet Link"
              onPress={() => handleMenuAction(handleCopyMagnet)}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.surfaceOutline }]} />
            <MenuOption
              icon="trash"
              label="Delete"
              onPress={() => handleMenuAction(handleDelete)}
              colors={colors}
              destructive
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MenuOption({
  icon,
  label,
  onPress,
  colors,
  destructive = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: any;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.menuOption}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={destructive ? colors.error : colors.primary}
        style={styles.menuIcon}
      />
      <Text
        style={[
          styles.menuOptionText,
          { color: destructive ? colors.error : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.sm,
    flex: 1,
    ...shadows.card,
    overflow: 'hidden',
  },
  cardContent: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  menuButton: {
    padding: 4,
    marginTop: 2,
  },
  statusRow: {
    alignItems: 'flex-start',
    marginTop: 6,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    position: 'absolute',
    minWidth: 200,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.xs,
    ...shadows.card,
    elevation: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  menuIcon: {
    marginRight: spacing.md,
    width: 24,
  },
  menuOptionText: {
    fontSize: 15,
    flex: 1,
  },
  menuDivider: {
    height: 1,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
  },
  stateBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.small,
  },
  stateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  compactStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 2,
    marginBottom: 0,
    gap: 4,
  },
  compactStat: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressActionButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaPercentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  etaText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  forceStartButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: borderRadius.small,
  },
  forceStartButtonTextSmall: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  forceStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.small,
    minHeight: 28,
  },
  forceStartButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 2 ,
  },
  statItem: {
    flex: 1,
    // minWidth: '22%',
    maxWidth: '20%',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginBottom: 1,
  },
  statValue: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '500',
  },
});

