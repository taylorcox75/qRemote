import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { formatSpeed } from '../utils/format';

interface CircularProgressProps {
  current: number;
  limit: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function CircularProgress({
  current,
  limit,
  color,
  size = 60,
  strokeWidth = 6,
  showLabel = true,
}: CircularProgressProps) {
  const { colors } = useTheme();

  const percentage = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color coding: green < 80%, yellow 80-95%, red > 95%
  let progressColor = color;
  if (limit > 0) {
    if (percentage >= 95) {
      progressColor = colors.error;
    } else if (percentage >= 80) {
      progressColor = colors.warning;
    }
  }

  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.surfaceOutline}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[styles.percentage, { color: colors.text }]}>
            {percentage.toFixed(0)}%
          </Text>
          <Text style={[styles.speed, { color: colors.textSecondary }]} numberOfLines={1}>
            {formatSpeed(current)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  labelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    fontSize: 12,
    fontWeight: '700',
  },
  speed: {
    fontSize: 8,
    marginTop: 2,
  },
});
