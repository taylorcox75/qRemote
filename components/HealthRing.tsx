import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface HealthRingProps {
  seeds: number;
  peers: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

/**
 * Circular health indicator showing torrent health based on seed/peer ratio
 * Green (>2 ratio) = Excellent
 * Orange (0.5-2) = Good
 * Red (<0.5) = Poor
 */
export function HealthRing({
  seeds,
  peers,
  size = 32,
  strokeWidth = 3,
  children,
}: HealthRingProps) {
  const { colors } = useTheme();

  // Calculate health score (0-100)
  const ratio = seeds / (peers + 1);
  const health = Math.min(100, ratio * 50);

  // Determine color based on ratio
  const getHealthColor = (): string => {
    if (ratio > 2) return colors.success; // Excellent
    if (ratio > 0.5) return colors.warning; // Good
    return colors.error; // Poor
  };

  const healthColor = getHealthColor();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (health / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceOutline}
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Health progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={healthColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      
      {/* Center content (icon) */}
      <View style={styles.centerContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});


