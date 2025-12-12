import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { shadows } from '../constants/shadows';
import { borderRadius, spacing } from '../constants/spacing';

interface FABAction {
  icon: string;
  label: string;
  color?: string;
  onPress: () => void;
}

interface ContextualFABProps {
  actions: FABAction[];
  mainIcon?: string;
}

/**
 * Contextual Floating Action Button
 * Shows different actions based on app state
 * Expands to reveal action menu
 */
export function ContextualFAB({ actions, mainIcon = 'add' }: ContextualFABProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const animatedValue = new Animated.Value(expanded ? 1 : 0);

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);

    Animated.spring(animatedValue, {
      toValue: newExpanded ? 1 : 0,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const rotation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={styles.container}>
      {/* Action Buttons */}
      {expanded &&
        actions.map((action, index) => {
          const translateY = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(60 * (index + 1))],
          });

          const opacity = animatedValue.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0, 1],
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.actionContainer,
                {
                  transform: [{ translateY }],
                  opacity,
                },
              ]}
            >
              <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: action.color || colors.surface },
                  shadows.medium,
                ]}
                onPress={() => {
                  action.onPress();
                  handleToggle();
                }}
              >
                <Ionicons name={action.icon as any} size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

      {/* Main FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }, shadows.large]}
        onPress={handleToggle}
        activeOpacity={0.9}
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name={mainIcon as any} size={28} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xxl,
    right: spacing.lg,
    alignItems: 'flex-end',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: borderRadius.small,
    color: '#FFFFFF',
  },
});


