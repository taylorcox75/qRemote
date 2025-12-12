import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SpeedGraphProps {
  data: number[]; // Array of speed values
  width?: number;
  height?: number;
  color?: string;
  animated?: boolean;
}

/**
 * Mini sparkline graph for speed visualization
 * Shows bandwidth history with smooth line and gradient fill
 */
export function SpeedGraph({
  data,
  width = 100,
  height = 40,
  color,
  animated = true,
}: SpeedGraphProps) {
  const { colors } = useTheme();
  const graphColor = color || colors.primary;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      progress.value = withTiming(1, { duration: 800 });
    } else {
      progress.value = 1;
    }
  }, [data, animated]);

  // Calculate points
  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * width;
    const y = height - ((value - minValue) / range) * height;
    return { x, y };
  });

  // Create path
  let pathData = '';
  if (points.length > 0) {
    pathData = `M ${points[0].x},${points[0].y}`;
    
    // Use quadratic curves for smooth line
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      pathData += ` Q ${prev.x},${prev.y} ${midX},${midY}`;
    }
    
    // Last point
    if (points.length > 1) {
      const last = points[points.length - 1];
      pathData += ` L ${last.x},${last.y}`;
    }
  }

  // Create filled area path
  const fillPathData = pathData + ` L ${width},${height} L 0,${height} Z`;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - progress.value) * width * 2,
  }));

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={graphColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={graphColor} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Filled area */}
        <Path
          d={fillPathData}
          fill="url(#gradient)"
        />

        {/* Line */}
        <AnimatedPath
          d={pathData}
          stroke={graphColor}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={width * 2}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});


