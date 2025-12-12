import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { TorrentInfo } from '../types/api';
import { useTheme } from '../context/ThemeContext';
import { formatSpeed, formatSize, formatTime } from '../utils/format';
import { spacing, borderRadius } from '../constants/spacing';
import { shadows } from '../constants/shadows';

interface ExpandableTorrentCardProps {
  torrent: TorrentInfo;
  onPress?: () => void;
}

/**
 * Torrent card that expands to show detailed stats
 * Tap to expand/collapse for progressive disclosure
 */
export function ExpandableTorrentCard({ torrent, onPress }: ExpandableTorrentCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const height = useSharedValue(100);
  const rotation = useSharedValue(0);

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    height.value = withSpring(newExpanded ? 220 : 100, {
      damping: 15,
      stiffness: 150,
    });
    
    rotation.value = withTiming(newExpanded ? 180 : 0, { duration: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const animatedChevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const progress = (torrent.progress || 0) * 100;
  const isPaused = torrent.state.includes('paused') || torrent.state.includes('stopped');

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.surface },
        shadows.card,
        animatedStyle,
      ]}
    >
      <TouchableOpacity onPress={handleToggle} activeOpacity={0.7}>
        {/* Header - Always Visible */}
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {torrent.name}
          </Text>
          <Animated.View style={animatedChevron}>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </Animated.View>
        </View>

        {/* Progress Bar - Always Visible */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.surfaceOutline }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <Text style={[styles.percentage, { color: colors.text }]}>
            {progress.toFixed(1)}%
          </Text>
        </View>

        {/* Expanded Content */}
        {expanded && (
          <View style={styles.expandedContent}>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Ionicons name="arrow-down" size={16} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatSpeed(torrent.dlspeed)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Download
                </Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="arrow-up" size={16} color={colors.success} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatSpeed(torrent.upspeed)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Upload
                </Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {torrent.eta > 0 ? formatTime(torrent.eta) : '∞'}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  ETA
                </Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {torrent.num_seeds} / {torrent.num_complete}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Seeds
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={onPress}
              >
                <Ionicons name="information-circle" size={18} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
              >
                <Ionicons name={isPaused ? 'play' : 'pause'} size={18} color={colors.warning} />
                <Text style={[styles.actionText, { color: colors.warning }]}>
                  {isPaused ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentage: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'right',
  },
  expandedContent: {
    marginTop: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.small,
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});


