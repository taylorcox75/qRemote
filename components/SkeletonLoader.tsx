import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SkeletonLoaderProps {
  width?: number | string;
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
  style 
}: SkeletonLoaderProps) {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

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
      ])
    ).start();
  }, []);

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
});

