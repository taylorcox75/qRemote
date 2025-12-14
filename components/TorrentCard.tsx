import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Dimensions, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TorrentInfo, TorrentState } from '../types/api';
import { torrentsApi } from '../services/api/torrents';
import { useServer } from '../context/ServerContext';
import { useTorrents } from '../context/TorrentContext';
import { useTheme } from '../context/ThemeContext';
import { useTransfer } from '../context/TransferContext';
import { useToast } from '../context/ToastContext';
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
  const isIOS = Platform.OS === 'ios';
  const menuRole = isIOS ? 'menu' : 'none';
  const menuItemRole = isIOS ? 'menuitem' : 'button';
  const separatorRole = isIOS ? 'separator' : 'none';

  const { isConnected, currentServer, reconnect } = useServer();
  const { sync } = useTorrents();
  const { isDark, colors } = useTheme();
  const { transferInfo, toggleAlternativeSpeedLimits, refresh: refreshTransfer } = useTransfer();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuButtonRef = useRef<any>(null);
  const menuContainerRef = useRef<View | null>(null);
  const hasAdjustedPosition = useRef(false);

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
      showToast('Not connected to a server. Please connect to a server first.', 'error');
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
          showToast('Lost connection to server. Please reconnect.', 'error');
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
      showToast(error.message || `Failed to ${wasPaused ? 'start' : 'pause'} torrent`, 'error');
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
      showToast('Not connected to a server. Please connect to a server first.', 'error');
      return;
    }

    setLoading(true);

    try {
      // Ensure server is set in API client
      if (!apiClient.getServer()) {
        // Server was cleared, try to reconnect
        const reconnected = await reconnect();
        if (!reconnected) {
          showToast('Lost connection to server. Please reconnect.', 'error');
          return;
        }
      }

      // Force start the torrent
      await torrentsApi.setForceStart([torrent.hash], true);
      
      // Sync in the background (don't wait for it)
      sync().catch(() => {});
    } catch (error: any) {
      console.error('Force Start error:', error);
      showToast(error.message || 'Failed to force start torrent', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyData = async () => {
    try {
      await torrentsApi.recheckTorrents([torrent.hash]);
      showToast('Verification started', 'success');
      sync().catch(() => {});
    } catch (error: any) {
      showToast(error.message || 'Failed to verify torrent', 'error');
    }
  };

  const handleReannounce = async () => {
    try {
      await torrentsApi.reannounceTorrents([torrent.hash]);
      showToast('Reannounce sent', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to reannounce', 'error');
    }
  };

  const handleCopyMagnet = async () => {
    try {
      if (torrent.magnet_uri) {
        await Clipboard.setStringAsync(torrent.magnet_uri);
        showToast('Magnet link copied to clipboard', 'success');
      } else {
        showToast('No magnet link available', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to copy magnet link', 'error');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Torrent',
      `Delete "${torrent.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Torrent Only',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], false);
              sync().catch(() => {});
              showToast('Torrent deleted', 'success');
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
              await torrentsApi.deleteTorrents([torrent.hash], true);
              sync().catch(() => {});
              showToast('Torrent deleted', 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to delete torrent', 'error');
            }
          },
        },
      ]
    );
  };

  const handleMaxPriority = async () => {
    if (!isConnected || !currentServer) {
      showToast('Not connected to a server.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (!apiClient.getServer()) {
        const reconnected = await reconnect();
        if (!reconnected) {
          showToast('Lost connection to server.', 'error');
          return;
        }
      }
      await torrentsApi.setMaximalPriority([torrent.hash]);
      sync().catch(() => {});
      showToast('Priority set to maximum', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set priority', 'error');
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
              showToast(`Download limit set to ${limitKB === 0 ? 'unlimited' : `${limitKB} KB/s`}`, 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to set download limit', 'error');
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
      showToast('Not connected to a server.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (!apiClient.getServer()) {
        const reconnected = await reconnect();
        if (!reconnected) {
          showToast('Lost connection to server.', 'error');
          return;
        }
      }
      await toggleAlternativeSpeedLimits();
      await refreshTransfer();
      const isEnabled = transferInfo?.use_alt_speed_limits;
      showToast(`Global speed limit ${!isEnabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle speed limit', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMenu = () => {
    if (menuButtonRef.current) {
      menuButtonRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        const screenWidth = Dimensions.get('window').width;
        const screenHeight = Dimensions.get('window').height;
        const menuWidth = 200;
        const menuX = Math.min(x - menuWidth + width, screenWidth - menuWidth - 16);
        
        // Conservative estimate: ~10 menu items at ~48px each + padding = ~500px
        // We'll use onLayout to get exact height and adjust
        const estimatedMenuHeight = 500;
        // Use safe area insets for proper padding
        const topPadding = Math.max(insets.top, 16) + 8;
        const bottomPadding = Math.max(insets.bottom, 16) + 8;
        const menuYBelow = y + height + 8;
        const spaceBelow = screenHeight - menuYBelow - bottomPadding;
        const spaceAbove = y - topPadding;
        
        // Determine best position: prefer below, but use above if not enough space below
        let finalY = menuYBelow;
        
        if (spaceBelow < estimatedMenuHeight) {
          // Not enough space below - position above if possible
          if (spaceAbove >= estimatedMenuHeight) {
            // Enough space above, position there
            finalY = y - estimatedMenuHeight - 8;
            // Ensure we don't go above screen
            if (finalY < topPadding) {
              finalY = topPadding;
            }
          } else {
            // Not enough space either way - position to maximize visibility
            // Position from bottom, ensuring full menu is visible
            finalY = screenHeight - estimatedMenuHeight - bottomPadding;
            // But don't go above the button if we have space
            if (finalY < menuYBelow && spaceBelow > estimatedMenuHeight * 0.5) {
              finalY = menuYBelow;
            }
            // Ensure we don't go above screen
            if (finalY < topPadding) {
              finalY = topPadding;
            }
          }
        }
        
        setMenuPosition({ x: menuX, y: finalY });
        hasAdjustedPosition.current = false;
        setMenuVisible(true);
      });
    }
  };

  const hideMenu = () => {
    setMenuVisible(false);
    hasAdjustedPosition.current = false;
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
        {/* Row 1: Title | Status | Menu */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {torrent.name}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[
              styles.stateBadge, 
              { backgroundColor: stateColor },
              isStalled && { borderWidth: 0, borderColor: colors.error },
              torrent.state === 'forcedMetaDL' && { borderWidth: 1, borderColor: '#FFD700' }
            ]}>
              <Text style={styles.stateText}>{stateLabel}</Text>
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
        </View>



        {/* Row 2: Progress bar | Play/Pause */}
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

        {/* Row 3 (compact only): Stats */}
        {viewMode === 'compact' && (
          <View style={styles.compactStatsRow}>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              {progress.toFixed(1)}%
            </Text>
            <Text style={[styles.compactDivider, { color: colors.textSecondary }]}>|</Text>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              {formatSize(torrent.total_size > 0 ? torrent.total_size : (torrent.size || 0))}
            </Text>
            <Text style={[styles.compactDivider, { color: colors.textSecondary }]}>|</Text>
            <Text style={[styles.compactStat, { color: colors.text }]}>
              {torrent.eta > 0 && torrent.eta < 8640000 ? formatTime(torrent.eta) : '∞'}
            </Text>
            <Text style={[styles.compactDivider, { color: colors.textSecondary }]}>|</Text>
            <View style={styles.compactSpeedContainer}>
              <Ionicons name="arrow-down" size={10} color={colors.primary} />
              <Text style={[styles.compactStat, { color: colors.text }]}>
                {formatSpeed(torrent.dlspeed)}
              </Text>
            </View>
            <Text style={[styles.compactDivider, { color: colors.textSecondary }]}>|</Text>
            <View style={styles.compactSpeedContainer}>
              <Ionicons name="arrow-up" size={10} color={colors.success} />
              <Text style={[styles.compactStat, { color: colors.text }]}>
                {formatSpeed(torrent.upspeed)}
              </Text>
            </View>
          </View>
        )}

        {viewMode === 'expanded' ? (
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
        ) : null}

      </TouchableOpacity>

      {/* Material Design Popup Menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={hideMenu}
        accessibilityViewIsModal
        accessibilityLabel="Torrent actions menu"
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={hideMenu}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          <View
            ref={menuContainerRef}
            onLayout={(event) => {
              // Prevent infinite loop - only adjust once
              if (hasAdjustedPosition.current) return;
              
              const { height } = event.nativeEvent.layout;
              if (height > 0 && menuButtonRef.current && height > 10) {
                menuButtonRef.current.measureInWindow((_x: number, y: number, _width: number, buttonHeight: number) => {
                  const screenHeight = Dimensions.get('window').height;
                  // Use safe area insets for proper padding
                  const topPadding = Math.max(insets.top, 16) + 8;
                  const bottomPadding = Math.max(insets.bottom, 16) + 8;
                  const currentTop = menuPosition.y;
                  const menuBottom = currentTop + height;
                  const buttonBottom = y + buttonHeight;
                  const buttonTop = y;
                  
                  let adjustedY = currentTop;
                  let needsAdjustment = false;
                  
                  // Check if menu extends below screen - reposition from bottom if needed
                  if (menuBottom > screenHeight - bottomPadding) {
                    // Not enough space at bottom, try positioning above button
                    const spaceAbove = buttonTop - topPadding;
                    if (spaceAbove >= height) {
                      // Enough space above, position there
                      adjustedY = buttonTop - height - 8;
                      needsAdjustment = true;
                    } else {
                      // Not enough space above either, position from bottom edge
                      adjustedY = screenHeight - height - bottomPadding;
                      needsAdjustment = true;
                    }
                  }
                  
                  // Check if menu extends above screen - reposition from top if needed
                  if (adjustedY < topPadding) {
                    // Not enough space at top, try positioning below button
                    const spaceBelow = screenHeight - buttonBottom - bottomPadding;
                    if (spaceBelow >= height) {
                      // Enough space below, position there
                      adjustedY = buttonBottom + 8;
                      needsAdjustment = true;
                    } else {
                      // Not enough space below either, position from top edge
                      adjustedY = topPadding;
                      needsAdjustment = true;
                    }
                  }
                  
                  // Final safety check: ensure menu is fully within screen bounds
                  if (adjustedY + height > screenHeight - bottomPadding) {
                    adjustedY = screenHeight - height - bottomPadding;
                    needsAdjustment = true;
                  }
                  if (adjustedY < topPadding) {
                    adjustedY = topPadding;
                    needsAdjustment = true;
                  }
                  
                  // Try to maintain gap from button if possible (but visibility is priority)
                  const gap = 8;
                  const menuTop = adjustedY;
                  const menuBottomAdjusted = adjustedY + height;
                  
                  // If menu overlaps button, try to move it if space allows
                  if (menuTop < buttonBottom + gap && menuBottomAdjusted > buttonTop - gap) {
                    const spaceBelow = screenHeight - buttonBottom - bottomPadding;
                    const spaceAbove = buttonTop - topPadding;
                    
                    // Prefer positioning below button if space allows
                    if (spaceBelow >= height && menuBottomAdjusted <= screenHeight - bottomPadding) {
                      adjustedY = buttonBottom + gap;
                      needsAdjustment = true;
                    } else if (spaceAbove >= height && menuTop >= topPadding) {
                      // Otherwise position above if space allows
                      adjustedY = buttonTop - height - gap;
                      needsAdjustment = true;
                    }
                  }
                  
                  // Final safety check after gap adjustment
                  if (adjustedY + height > screenHeight - bottomPadding) {
                    adjustedY = screenHeight - height - bottomPadding;
                    needsAdjustment = true;
                  }
                  if (adjustedY < topPadding) {
                    adjustedY = topPadding;
                    needsAdjustment = true;
                  }
                  
                  // Only update if adjustment is needed and significant (avoid jitter)
                  if (needsAdjustment && Math.abs(adjustedY - currentTop) > 5) {
                    hasAdjustedPosition.current = true;
                    setMenuPosition(prev => ({ ...prev, y: adjustedY }));
                  }
                });
              }
            }}
            style={[
              styles.menuContainer,
              {
                backgroundColor: colors.surface,
                top: menuPosition.y,
                left: menuPosition.x,
                shadowColor: colors.text,
              },
            ]}
            accessibilityRole={menuRole}
            accessibilityLabel="Torrent actions"
          >
            <MenuOption
              icon={isPaused ? 'play' : 'pause'}
              label={isPaused ? 'Resume' : 'Pause'}
              onPress={() => handleMenuAction(handlePauseResume)}
              colors={colors}
              accessibilityLabel={isPaused ? `Resume torrent ${torrent.name}` : `Pause torrent ${torrent.name}`}
              accessibilityHint={isPaused ? 'Resumes downloading or uploading this torrent' : 'Pauses downloading or uploading this torrent'}
            />
            <MenuOption
              icon="flash"
              label="Force Start"
              onPress={() => handleMenuAction(handleForceStart)}
              colors={colors}
              accessibilityLabel={`Force start torrent ${torrent.name}`}
              accessibilityHint="Forces the torrent to start downloading immediately"
            />
            <MenuOption
              icon="speedometer"
              label={`Global Speed Limit (${transferInfo?.use_alt_speed_limits ? 'ON' : 'OFF'})`}
              onPress={() => handleMenuAction(handleToggleGlobalSpeedLimit)}
              colors={colors}
              accessibilityLabel={`Toggle global speed limit, currently ${transferInfo?.use_alt_speed_limits ? 'on' : 'off'}`}
              accessibilityHint="Toggles the global alternative speed limits for all torrents"
            />
            <MenuOption
              icon="flag"
              label="Max Priority"
              onPress={() => handleMenuAction(handleMaxPriority)}
              colors={colors}
              accessibilityLabel={`Set maximum priority for ${torrent.name}`}
              accessibilityHint="Sets this torrent to the highest download priority"
            />
            <MenuOption
              icon="download"
              label="Set DL Limit"
              onPress={() => handleMenuAction(handleSetDownloadLimit)}
              colors={colors}
              accessibilityLabel={`Set download limit for ${torrent.name}`}
              accessibilityHint="Sets a download speed limit for this torrent in kilobytes per second"
            />
            <MenuOption
              icon="checkmark-circle"
              label="Verify Data"
              onPress={() => handleMenuAction(handleVerifyData)}
              colors={colors}
              accessibilityLabel={`Verify data integrity for ${torrent.name}`}
              accessibilityHint="Starts verification of downloaded data for this torrent"
            />
            <MenuOption
              icon="refresh"
              label="Reannounce"
              onPress={() => handleMenuAction(handleReannounce)}
              colors={colors}
              accessibilityLabel={`Reannounce ${torrent.name} to trackers`}
              accessibilityHint="Reannounces this torrent to all its trackers"
            />
            <MenuOption
              icon="link"
              label="Copy Magnet Link"
              onPress={() => handleMenuAction(handleCopyMagnet)}
              colors={colors}
              accessibilityLabel={`Copy magnet link for ${torrent.name}`}
              accessibilityHint="Copies the magnet link of this torrent to clipboard"
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.surfaceOutline }]} accessibilityRole={separatorRole as any} />
            <MenuOption
              icon="trash"
              label="Delete"
              onPress={() => handleMenuAction(handleDelete)}
              colors={colors}
              destructive
              accessibilityLabel={`Delete torrent ${torrent.name}`}
              accessibilityHint="Permanently deletes this torrent. You can choose to delete files as well"
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
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: any;
  destructive?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const menuItemRole = Platform.OS === 'ios' ? 'menuitem' : 'button';
  
  return (
    <TouchableOpacity
      style={styles.menuOption}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole={menuItemRole}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
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
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
    marginRight: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginRight: 6,
  },
  menuButton: {
    padding: 2,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    position: 'absolute',
    minWidth: 200,
    borderRadius: borderRadius.medium,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
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
    gap: 4,
    marginBottom: 2,
  },
  compactStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 2,
    marginBottom: 0,
    gap: 6,
  },
  compactStat: {
    fontSize: 10,
    fontWeight: '500',
  },
  compactDivider: {
    fontSize: 10,
    fontWeight: '300',
  },
  compactSpeedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  progressBar: {
    flexGrow: 1,
    flexShrink: 1,
    height: 5,
    backgroundColor: '#E5E5EA',
    borderRadius: 5,
    overflow: 'hidden',
    minWidth: 80,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressActionButton: {
    width: 28,
    height: 28,
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

