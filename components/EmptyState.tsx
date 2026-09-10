/**
 * EmptyState.tsx — Shared icon + title (+ optional subtitle + action button)
 * placeholder view, used for empty lists and error/no-connection states
 * across the app.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { buttonStyles, buttonText } from '@/constants/buttons';

// Mac Catalyst gets a denser placeholder: smaller icon, macOS-scale title/
// message and halved vertical spacing, matching constants/spacing.ts's own
// denser mac ramp. iPhone and iPad keep the exact values below (this const
// is false there, same pattern as components/SettingRow.tsx).
const isMac = Platform.OS === 'ios' && (Platform.isMacCatalyst ?? false);

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
  const resolvedIconSize = iconSize ?? (isMac ? 28 : compact ? 40 : 64);

  return (
    <View
      style={[
        isMac ? styles.macContainer : compact ? styles.compactContainer : styles.container,
        style,
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={resolvedIconSize} color={iconColor ?? colors.textSecondary} />
      )}
      {title && (
        <Text
          style={[
            isMac ? styles.macTitle : compact ? styles.compactTitle : styles.title,
            { color: isMac ? colors.textSecondary : colors.text },
          ]}
        >
          {title}
        </Text>
      )}
      {subtitle && (
        <Text
          style={[
            isMac ? styles.macSubtitle : compact ? styles.compactSubtitle : styles.subtitle,
            { color: colors.textSecondary },
          ]}
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
  // Mac Catalyst: denser than even the compact variant above, matching
  // macOS form density. spacing.lg is already mac-scaled at module load
  // (constants/spacing.ts); halving it here is on top of that.
  macContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: spacing.lg / 2,
  },
  macTitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  macSubtitle: {
    fontSize: 11,
    textAlign: 'center',
  },
});
