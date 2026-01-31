import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, Alert } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { TorrentCard } from './TorrentCard';
import { TorrentInfo } from '../types/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { torrentsApi } from '../services/api/torrents';
import { useTorrents } from '../context/TorrentContext';
import { spacing } from '../constants/spacing';

interface SwipeableTorrentCardProps {
  torrent: TorrentInfo;
  viewMode?: 'compact' | 'expanded';
  onPress: () => void;
}

/**
 * Torrent card with swipe actions
 * - Swipe right: Pause/Resume (orange)
 * - Swipe left: Delete (red)
 */
export function SwipeableTorrentCard({
  torrent,
  viewMode,
  onPress,
}: SwipeableTorrentCardProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { sync } = useTorrents();
  const swipeableRef = useRef<Swipeable>(null);

  const isPaused =
    torrent.state === 'pausedDL' ||
    torrent.state === 'pausedUP' ||
    torrent.state === 'stoppedDL' ||
    torrent.state === 'stoppedUP';

  const handlePauseResume = async () => {
    try {
      if (isPaused) {
        await torrentsApi.resumeTorrents([torrent.hash]);
      } else {
        await torrentsApi.pauseTorrents([torrent.hash]);
      }
      sync().catch(() => {});
      swipeableRef.current?.close();
    } catch (error: any) {
      showToast(error.message || 'Failed to pause/resume torrent', 'error');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Torrent',
      `Delete "${torrent.name}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: 'Torrent Only',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], false);
              showToast('Torrent deleted', 'success');
              sync().catch(() => {});
              swipeableRef.current?.close();
            } catch (error: any) {
              showToast(error.message || 'Failed to delete', 'error');
            }
          },
        },
        {
          text: 'With Files',
          style: 'destructive',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], true);
              showToast('Torrent deleted', 'success');
              sync().catch(() => {});
              swipeableRef.current?.close();
            } catch (error: any) {
              showToast(error.message || 'Failed to delete', 'error');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <RectButton style={[styles.leftAction, { backgroundColor: colors.warning }]} onPress={handlePauseResume}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name={isPaused ? 'play' : 'pause'} size={24} color="#FFFFFF" />
          <Text style={styles.actionText}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </Animated.View>
      </RectButton>
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <RectButton style={[styles.rightAction, { backgroundColor: colors.error }]} onPress={handleDelete}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash" size={24} color="#FFFFFF" />
          <Text style={styles.actionText}>Delete</Text>
        </Animated.View>
      </RectButton>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
    >
      <TorrentCard torrent={torrent} viewMode={viewMode} onPress={onPress} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: spacing.xl,
    flex: 1,
  },
  rightAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: spacing.xl,
    flex: 1,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});


