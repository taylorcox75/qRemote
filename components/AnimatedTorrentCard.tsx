import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { TorrentCard } from './TorrentCard';
import { TorrentInfo } from '../types/api';

interface AnimatedTorrentCardProps {
  torrent?: TorrentInfo;
  index: number;
  delay?: number;
  viewMode?: 'compact' | 'expanded';
  onPress?: () => void;
  children?: React.ReactNode;
}

/**
 * Animated wrapper for TorrentCard with staggered entrance
 * Can wrap any content or render TorrentCard directly
 */
export function AnimatedTorrentCard({
  torrent,
  index,
  delay = 50,
  viewMode,
  onPress,
  children,
}: AnimatedTorrentCardProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    // Stagger animation based on index
    const animationDelay = index * delay;

    opacity.value = withDelay(
      animationDelay,
      withSpring(1, {
        damping: 15,
        stiffness: 100,
      })
    );

    translateY.value = withDelay(
      animationDelay,
      withSpring(0, {
        damping: 15,
        stiffness: 100,
      })
    );
  }, [index, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children ? children : (
        torrent && <TorrentCard torrent={torrent} viewMode={viewMode} onPress={onPress || (() => {})} />
      )}
    </Animated.View>
  );
}


