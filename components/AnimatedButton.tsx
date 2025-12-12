import React, { useRef } from 'react';
import { TouchableOpacity, Animated, ViewStyle, TouchableOpacityProps } from 'react-native';

interface AnimatedButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  scaleValue?: number;
}

/**
 * A button component with scale animation on press
 * Provides a subtle iOS-like press feedback
 */
export function AnimatedButton({ 
  children, 
  onPress, 
  style, 
  scaleValue = 0.96,
  disabled,
  ...props 
}: AnimatedButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: true,
      friction: 3,
      tension: 40,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
      tension: 40,
    }).start();
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      activeOpacity={1}
      disabled={disabled}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

