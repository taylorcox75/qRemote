import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface AnimatedProgressBarProps {
  progress: number; // 0-100
  color?: string;
  height?: number;
  animated?: boolean;
  showGlow?: boolean;
}

/**
 * Animated progress bar with optional glow effect
 * Smoothly animates width changes with spring physics
 */
export function AnimatedProgressBar({
  progress,
  color,
  height = 6,
  animated = true,
  showGlow = false,
}: AnimatedProgressBarProps) {
  const { colors } = useTheme();
  const progressAnim = useRef(new Animated.Value(progress)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const barColor = color || colors.primary;

  useEffect(() => {
    if (animated) {
      Animated.spring(progressAnim, {
        toValue: progress,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(progress);
    }
  }, [progress, animated]);

  useEffect(() => {
    if (showGlow && progress < 100 && progress > 0) {
      // Pulse animation when actively downloading
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [showGlow, progress]);

  const width = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { height, borderRadius: height / 2 }]}>
      <View style={[styles.background, { backgroundColor: colors.surfaceOutline }]} />
      
      <Animated.View
        style={[
          styles.fill,
          {
            width,
            backgroundColor: barColor,
            borderRadius: height / 2,
          },
        ]}
      >
        {/* Glow effect */}
        {showGlow && progress > 0 && progress < 100 && (
          <Animated.View
            style={[
              styles.glow,
              {
                backgroundColor: barColor,
                opacity: 0.4,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  fill: {
    height: '100%',
    position: 'relative',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
});


