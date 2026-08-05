import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { shadows } from '@/constants/shadows';
import { spacing, borderRadius } from '@/constants/spacing';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Standard iOS bottom-tab-bar content height (React Navigation's default —
// this app doesn't override tabBarStyle.height), used to keep the toast
// clear of the tab bar without needing each tab screen to opt in.
const TAB_BAR_HEIGHT = 49;

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
  /** False for screens with no bottom tab bar to clear — the native modal
   *  sheets (server add/edit) mounting <ModalToast/>. Every other screen,
   *  tab or not, keeps this true: the tab bar is either visible or just off
   *  the bottom of a pushed screen, so reserving its space costs nothing
   *  more than a slightly bigger gap on the screens where it isn't there. */
  withinTabBar?: boolean;
}

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onHide,
  withinTabBar = true,
}: ToastProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Fall back to initialWindowMetrics/hardcoded values for the brief window
  // before SafeAreaProvider has measured real insets on first render.
  const safeBottom =
    insets.bottom || initialWindowMetrics?.insets.bottom || (Platform.OS === 'ios' ? 34 : 0);
  const translateY = useRef(new Animated.Value(100)).current;
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
        toValue: 100,
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

  const getIcon = (): React.ComponentProps<typeof Ionicons>['name'] => {
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

  const bottomOffset = safeBottom + (withinTabBar ? TAB_BAR_HEIGHT : 0) + spacing.md;

  const toastContent = (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          bottom: bottomOffset,
          transform: [{ translateY }],
          opacity,
        },
        shadows.large,
      ]}
    >
      <TouchableOpacity style={styles.content} onPress={hide} activeOpacity={0.9}>
        <Ionicons name={getIcon()} size={24} color={getColor()} />
        <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {message}
        </Text>
        <TouchableOpacity
          onPress={hide}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  return toastContent;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: borderRadius.medium,
    zIndex: 9999,
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
