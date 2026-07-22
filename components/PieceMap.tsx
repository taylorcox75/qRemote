import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { borderRadius } from '@/constants/spacing';

interface PieceMapProps {
  /** Piece states: 0 = missing, 1 = downloading, 2 = have. Array or sparse object. */
  states: number[] | Record<string, number> | null | undefined;
  /** Max bars to render (downsamples large torrents). */
  maxBars?: number;
  height?: number;
}

function normalizeStates(states: PieceMapProps['states']): number[] {
  if (!states) return [];
  if (Array.isArray(states)) return states.map((v) => Number(v) || 0);
  return Object.keys(states)
    .map((k) => Number(k))
    .filter((k) => !Number.isNaN(k))
    .sort((a, b) => a - b)
    .map((k) => Number((states as Record<string, number>)[k]) || 0);
}

/** Downsample by taking the “hottest” state in each bucket (2 > 1 > 0). */
function downsample(states: number[], maxBars: number): number[] {
  if (states.length === 0) return [];
  if (states.length <= maxBars) return states;
  const out: number[] = [];
  const bucketSize = states.length / maxBars;
  for (let i = 0; i < maxBars; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    let best = 0;
    for (let j = start; j < end; j++) {
      if (states[j] > best) best = states[j];
    }
    out.push(best);
  }
  return out;
}

/**
 * Bitfield heatmap for torrent piece states — classic torrent-client eye candy.
 */
export function PieceMap({ states, maxBars = 120, height = 28 }: PieceMapProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // Hero sits in 16px page padding + 16px card padding each side.
  const mapWidth = Math.max(120, windowWidth - 64);

  const bars = useMemo(() => downsample(normalizeStates(states), maxBars), [states, maxBars]);

  if (bars.length === 0) return null;

  const gap = 1;
  const barWidth = Math.max(1, (mapWidth - gap * (bars.length - 1)) / bars.length);

  const colorFor = (state: number) => {
    if (state === 2) return colors.success;
    if (state === 1) return colors.primary;
    return colors.surfaceOutline;
  };

  return (
    <View style={[styles.row, { height, width: mapWidth }]}>
      {bars.map((state, i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            height: '100%',
            marginRight: i < bars.length - 1 ? gap : 0,
            borderRadius: borderRadius.xsmall / 2,
            backgroundColor: colorFor(state),
            opacity: state === 0 ? 0.45 : 1,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: borderRadius.small,
  },
});
