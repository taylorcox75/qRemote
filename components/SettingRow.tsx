/**
 * SettingRow.tsx — Shared icon + label (+ optional hint) + right-slot row,
 * used for toggle/switch settings across server and settings screens.
 */
import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/constants/spacing';

interface SettingRowProps {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  label: string;
  hint?: string;
  children?: ReactNode;
}

export function SettingRow({ icon, iconColor, label, hint, children }: SettingRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {icon && (
          <Ionicons name={icon} size={20} color={iconColor ?? colors.primary} style={styles.icon} />
        )}
        <View style={styles.textContainer}>
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          {hint && <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flexShrink: 1,
  },
  label: {
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 1,
  },
});
