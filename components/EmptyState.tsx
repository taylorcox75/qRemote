/**
 * EmptyState.tsx — Shared icon + title (+ optional subtitle + action button)
 * placeholder view, used for empty lists and error/no-connection states
 * across the app.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { buttonStyles, buttonText } from '@/constants/buttons';

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconSize?: number;
  iconColor?: string;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onAction?: () => void;
  /** Smaller, more compact layout for inline/nested empty states (e.g. within a card). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon,
  iconSize,
  iconColor,
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  compact,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const resolvedIconSize = iconSize ?? (compact ? 40 : 64);

  return (
    <View style={[compact ? styles.compactContainer : styles.container, style]}>
      {icon && <Ionicons name={icon} size={resolvedIconSize} color={iconColor ?? colors.textSecondary} />}
      {title && (
        <Text style={[compact ? styles.compactTitle : styles.title, { color: colors.text }]}>{title}</Text>
      )}
      {subtitle && (
        <Text
          style={[compact ? styles.compactSubtitle : styles.subtitle, { color: colors.textSecondary }]}
        >
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[buttonStyles.primary, styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <View style={styles.actionButtonInner}>
            {actionIcon && <Ionicons name={actionIcon} size={20} color="#FFFFFF" />}
            <Text style={buttonText.primary}>{actionLabel}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: spacing.lg,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.secondary,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: spacing.sm,
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  compactTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  compactSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
});
