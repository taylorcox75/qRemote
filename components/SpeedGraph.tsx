import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

interface SpeedGraphProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  maxValue?: number;
}

/**
 * The Y-axis ceiling a SpeedGraph will actually render at for this data/maxValue
 * pair. `maxValue` (e.g. a configured rate limit) is a floor, not a ceiling —
 * actual throughput can briefly exceed it — so callers that show a scale label
 * alongside the graph should use this instead of the raw `maxValue`, or the
 * label will disagree with what the chart is scaled to.
 */
export function computeSpeedGraphMax(data: number[], maxValue?: number): number {
  return Math.max(maxValue || 0, ...(data && data.length > 0 ? data : []), 1);
}

/**
 * Rounds a bytes/sec value up to a clean number in whatever unit `formatSpeed`
 * would display it in (KiB/s, MiB/s, ...) — e.g. 47.3 MiB/s -> 50 MiB/s — so a
 * chart's top edge reads as a round number instead of an arbitrary peak. Uses
 * the classic 1/2/5/10 "nice numbers" step sequence.
 */
export function niceGraphCeiling(bytesPerSecond: number): number {
  if (bytesPerSecond <= 0) return 1;

  const k = 1024;
  const maxUnitIndex = 3; // B, KiB, MiB, GiB/s — matches formatSpeed's sizes table
  const unitIndex = Math.min(maxUnitIndex, Math.floor(Math.log(bytesPerSecond) / Math.log(k)));
  const unitBase = Math.pow(k, unitIndex);
  const scaled = bytesPerSecond / unitBase;

  const magnitude = Math.pow(10, Math.floor(Math.log10(scaled)));
  const residual = scaled / magnitude;

  // A tiny epsilon so an already-clean value (e.g. a 10 MiB/s rate limit,
  // which computeSpeedGraphMax folds straight into the raw max) doesn't get
  // bumped to the next step by floating-point noise landing just above 1/2/5.
  const EPSILON = 1e-9;
  let niceResidual: number;
  if (residual <= 1 + EPSILON) niceResidual = 1;
  else if (residual <= 2 + EPSILON) niceResidual = 2;
  else if (residual <= 5 + EPSILON) niceResidual = 5;
  else niceResidual = 10;

  return niceResidual * magnitude * unitBase;
}

export function SpeedGraph({ data, color, width = 150, height = 50, maxValue }: SpeedGraphProps) {
  const { colors } = useTheme();

  const { path, gradientId } = useMemo(() => {
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
    const max = computeSpeedGraphMax(data, maxValue);
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
        <Svg width={width} height={height}>
          <Path
            d={`M 4,${height / 2} L ${width - 4},${height / 2}`}
            stroke={colors.surfaceOutline}
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        </Svg>
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
