import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius } from '../constants/spacing';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onHide }: ToastProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after duration
    const timer = setTimeout(() => {
      hide();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  const getIcon = (): string => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'warning':
        return 'warning';
      default:
        return 'information-circle';
    }
  };

  const getColor = (): string => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      default:
        return colors.primary;
    }
  };

  const topOffset = insets.top + (Platform.OS === 'ios' ? 8 : 16);

  return (
    <Modal
      transparent
      visible={true}
      animationType="none"
      statusBarTranslucent
      pointerEvents="box-none"
    >
      <View style={styles.modalContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              top: topOffset,
              transform: [{ translateY }],
              opacity,
              // Shadow properties inline to avoid overriding elevation from styles.container
              // Using shadows.large would set elevation: 4, overriding the 999999 value needed for modal visibility
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.content}
            onPress={hide}
            activeOpacity={0.9}
          >
            <Ionicons name={getIcon() as any} size={24} color={getColor()} />
            <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
              {message}
            </Text>
            <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    pointerEvents: 'box-none',
  },
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: borderRadius.medium,
    // Very high z-index and elevation to ensure toast appears above modal screens
    // Modal screens in expo-router can have high z-index values, so we use 999999
    zIndex: 999999,
    elevation: 999999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});

