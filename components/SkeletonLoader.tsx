import React, { useEffect, useState } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface SkeletonLoaderProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Skeleton loader with shimmer effect
 * Used for loading states instead of spinners
 */
export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  const { colors } = useTheme();
  const [animatedValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceOutline,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.surface,
            opacity,
          },
        ]}
      />
    </View>
  );
}

/**
 * Skeleton card for loading torrent cards
 */
export function SkeletonTorrentCard() {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <SkeletonLoader width="70%" height={18} borderRadius={4} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="40%" height={24} borderRadius={6} style={{ marginBottom: 12 }} />
      <SkeletonLoader width="100%" height={6} borderRadius={3} style={{ marginBottom: 8 }} />
      <View style={styles.statsRow}>
        <SkeletonLoader width="20%" height={12} borderRadius={4} />
        <SkeletonLoader width="25%" height={12} borderRadius={4} />
        <SkeletonLoader width="20%" height={12} borderRadius={4} />
        <SkeletonLoader width="20%" height={12} borderRadius={4} />
      </View>
    </View>
  );
}

/**
 * Skeleton for the torrent detail screen — shown while a dead session is
 * reconnecting and there's no torrent data to render yet (see
 * app/(tabs)/(torrents)/torrent/[hash].tsx). Loosely shaped after that
 * screen's hero card (name + state badge, progress bar, size line) plus one
 * section below — an approximate placeholder, not a pixel-accurate clone,
 * same spirit as SkeletonTorrentCard above.
 */
export function SkeletonTorrentDetail() {
  const { colors } = useTheme();

  return (
    <View style={styles.detailContainer}>
      <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
        <View style={styles.heroHeaderRow}>
          <SkeletonLoader width="65%" height={20} borderRadius={4} />
          <SkeletonLoader width={70} height={20} borderRadius={9999} />
        </View>
        <SkeletonLoader width="100%" height={5} borderRadius={3} style={{ marginBottom: 8 }} />
        <SkeletonLoader width="45%" height={13} borderRadius={4} />
      </View>
      <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>
        <SkeletonLoader width="30%" height={14} borderRadius={4} style={{ marginBottom: 10 }} />
        <View style={styles.statsRow}>
          <SkeletonLoader width="20%" height={12} borderRadius={4} />
          <SkeletonLoader width="25%" height={12} borderRadius={4} />
          <SkeletonLoader width="20%" height={12} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  card: {
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  detailCard: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
});
