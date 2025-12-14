import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface SpeedGraphProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  maxValue?: number;
}

export function SpeedGraph({ data, color, width = 150, height = 50, maxValue }: SpeedGraphProps) {
  const { colors } = useTheme();

  const { path, gradientId, yScale, domain } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        path: '',
        gradientId: `gradient-${color.replace('#', '')}`,
        yScale: 1,
        domain: { min: 0, max: 1 },
      };
    }

    const padding = 4;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    const max = maxValue || Math.max(...data, 1);
    const min = 0;

    const domain = { min, max: max || 1 };
    const yScale = graphHeight / (domain.max - domain.min || 1);

    const points: string[] = [];
    data.forEach((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * graphWidth;
      const y = padding + graphHeight - (value - domain.min) * yScale;
      points.push(`${x},${y}`);
    });

    const path = points.join(' ');

    return {
      path,
      gradientId: `gradient-${color.replace('#', '')}-${Date.now()}`,
      yScale,
      domain,
    };
  }, [data, width, height, maxValue, color]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height, backgroundColor: 'transparent' }]}>
        <View style={styles.emptyContainer}>
          {/* Empty state - could show a placeholder */}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} style={styles.svg}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {/* Area fill */}
        {data.length > 0 && (
          <Polyline
            points={`${4},${height - 4} ${path} ${width - 4},${height - 4}`}
            fill={`url(#${gradientId})`}
            fillOpacity={0.3}
          />
        )}
        {/* Line */}
        {data.length > 1 && (
          <Polyline
            points={path}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Single point if only one data point */}
        {data.length === 1 && (
          <Line
            x1={width / 2}
            y1={height - 4}
            x2={width / 2}
            y2={4}
            stroke={color}
            strokeWidth="1.5"
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  svg: {
    position: 'absolute',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
