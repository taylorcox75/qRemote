import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TorrentState } from '../types/api';

interface AnimatedStateIconProps {
  state: TorrentState;
  size?: number;
  color: string;
}

/**
 * Animated icon that changes based on torrent state
 * - Downloading: Bouncing down arrow
 * - Uploading: Bouncing up arrow
 * - Complete: Check with draw-in
 * - Paused: Static pause
 */
export function AnimatedStateIcon({ state, size = 20, color }: AnimatedStateIconProps) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Stop any existing animations
    bounceAnim.stopAnimation();
    rotateAnim.stopAnimation();

    if (state === 'downloading' || state === 'forcedDL') {
      // Bounce down arrow
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (state === 'uploading' || state === 'forcedUP') {
      // Bounce up arrow
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (state === 'checkingDL' || state === 'checkingUP') {
      // Rotate for checking
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      bounceAnim.setValue(0);
      rotateAnim.setValue(0);
    }

    return () => {
      bounceAnim.stopAnimation();
      rotateAnim.stopAnimation();
    };
  }, [state]);

  const translateY = bounceAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-3, 3],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getIcon = (): string => {
    if (state === 'downloading' || state === 'forcedDL' || state === 'metaDL') {
      return 'arrow-down-circle';
    }
    if (state === 'uploading' || state === 'forcedUP') {
      return 'arrow-up-circle';
    }
    if (state === 'stalledDL' || state === 'stalledUP') {
      return 'pause-circle';
    }
    if (state === 'checkingDL' || state === 'checkingUP') {
      return 'sync-circle';
    }
    if (state === 'pausedDL' || state === 'pausedUP' || state === 'stoppedDL') {
      return 'pause-circle-outline';
    }
    if (state === 'error') {
      return 'alert-circle';
    }
    if (state === 'queuedDL' || state === 'queuedUP') {
      return 'time-outline';
    }
    return 'ellipse-outline';
  };

  const animatedStyle =
    state === 'checkingDL' || state === 'checkingUP'
      ? { transform: [{ rotate }] }
      : { transform: [{ translateY }] };

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={getIcon() as any} size={size} color={color} />
    </Animated.View>
  );
}


