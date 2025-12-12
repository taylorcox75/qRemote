import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { borderRadius } from '../constants/spacing';
import { shadows } from '../constants/shadows';

interface GradientCardProps {
  children: React.ReactNode;
  colors?: string[];
  style?: ViewStyle;
  gradient?: 'primary' | 'success' | 'warning' | 'error' | 'subtle';
}

/**
 * Card with subtle gradient background
 * Used for hero sections and key UI elements
 */
export function GradientCard({
  children,
  colors: gradientColors,
  style,
  gradient = 'subtle',
}: GradientCardProps) {
  const { colors } = useTheme();

  const getGradient = (): string[] => {
    if (gradientColors) return gradientColors;

    switch (gradient) {
      case 'primary':
        return [colors.primary, colors.primary + 'CC'];
      case 'success':
        return [colors.success, colors.success + 'CC'];
      case 'warning':
        return [colors.warning, colors.warning + 'CC'];
      case 'error':
        return [colors.error, colors.error + 'CC'];
      case 'subtle':
      default:
        return [colors.surface, colors.surface];
    }
  };

  return (
    <LinearGradient
      colors={getGradient()}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, shadows.card, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
});


