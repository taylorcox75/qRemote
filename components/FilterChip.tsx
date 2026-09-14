/**
 * FilterChip.tsx — Shared pill-shaped filter/category/tag chip used in
 * horizontal filter rows (torrents list, search plugin/category rows).
 */
import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { buttonStyles, buttonText } from '@/constants/buttons';
import { shadows } from '@/constants/shadows';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconSize?: number;
  /** Background/border color used when active. Defaults to colors.primary. */
  activeColor?: string;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
  /**
   * Desktop (regular/mac) selection: muted primary wash and primary
   * text/icon instead of the iPhone solid-fill chip. Compact callers
   * leave this unset.
   */
  muted?: boolean;
}

export function FilterChip({
  label,
  active,
  onPress,
  icon,
  iconSize = 14,
  activeColor,
  accessibilityLabel,
  accessibilityState,
  numberOfLines,
  style,
  textStyle,
  children,
  muted,
}: FilterChipProps) {
  const { colors } = useTheme();
  const resolvedActiveColor = activeColor ?? colors.primary;
  const mutedActive = !!muted && active;
  const foreground = mutedActive ? colors.primary : active ? '#FFFFFF' : colors.text;

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && !muted && shadows.filterActive,
        {
          backgroundColor: mutedActive
            ? colors.primaryOpac
            : active
              ? resolvedActiveColor
              : colors.surface,
          borderColor: mutedActive
            ? 'transparent'
            : active
              ? resolvedActiveColor
              : colors.surfaceOutline,
          borderWidth: active ? 0 : 0.2,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { selected: active }}
    >
      {icon && <Ionicons name={icon} size={iconSize} color={foreground} />}
      <Text
        style={[styles.chipText, { color: foreground }, textStyle]}
        numberOfLines={numberOfLines}
      >
        {label}
      </Text>
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    ...buttonStyles.chip,
  },
  chipText: {
    ...buttonText.chip,
  },
});
