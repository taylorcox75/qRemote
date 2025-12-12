import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const CONFETTI_COUNT = 30;

interface ConfettiProps {
  active: boolean;
  duration?: number;
}

/**
 * Confetti celebration animation
 * Triggered when a download completes
 */
export function Confetti({ active, duration = 2000 }: ConfettiProps) {
  const confettiPieces = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      x: useRef(new Animated.Value(Math.random() * width)).current,
      y: useRef(new Animated.Value(-20)).current,
      rotation: useRef(new Animated.Value(0)).current,
      color: getRandomColor(),
    }))
  ).current;

  useEffect(() => {
    if (active) {
      // Animate all confetti pieces
      const animations = confettiPieces.map((piece) =>
        Animated.parallel([
          Animated.timing(piece.y, {
            toValue: height + 50,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(piece.rotation, {
            toValue: Math.random() * 4 - 2,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      );

      Animated.stagger(30, animations).start();
    }
  }, [active]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {confettiPieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: piece.color,
              left: piece.x,
              transform: [
                { translateY: piece.y },
                {
                  rotate: piece.rotation.interpolate({
                    inputRange: [-2, 2],
                    outputRange: ['-720deg', '720deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function getRandomColor(): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Cyan
    '#45B7D1', // Blue
    '#FFA07A', // Orange
    '#98D8C8', // Green
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Light blue
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});


