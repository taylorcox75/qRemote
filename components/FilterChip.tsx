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
  /**
   * Makes the icon its own tap target inside the chip: tapping it calls this
   * instead of `onPress` (e.g. the Search tab pins a plugin from its chip icon).
   * Has no effect without an `icon`.
   */
  onIconPress?: () => void;
  /** Accessibility label for the icon button (and the VoiceOver action) when `onIconPress` is set. */
  iconAccessibilityLabel?: string;
  /** Background/border color used when active. Defaults to colors.primary. */
  activeColor?: string;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
}

// Stays inside the chip's padding: touches outside the chip never reach the icon.
const ICON_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 4 };

export function FilterChip({
  label,
  active,
  onPress,
  icon,
  iconSize = 14,
  onIconPress,
  iconAccessibilityLabel,
  activeColor,
  accessibilityLabel,
  accessibilityState,
  numberOfLines,
  style,
  textStyle,
  children,
}: FilterChipProps) {
  const { colors } = useTheme();
  const resolvedActiveColor = activeColor ?? colors.primary;
  const hasIconButton = !!icon && !!onIconPress;
  const iconElement = icon ? (
    <Ionicons name={icon} size={iconSize} color={active ? '#FFFFFF' : colors.text} />
  ) : null;

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && shadows.filterActive,
        {
          backgroundColor: active ? resolvedActiveColor : colors.surface,
          borderColor: active ? resolvedActiveColor : colors.surfaceOutline,
          borderWidth: active ? 0 : 0.2,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { selected: active }}
      // The chip is one VoiceOver element, so the icon button inside it can't
      // be focused on its own — expose it as a custom action instead.
      accessibilityActions={
        hasIconButton ? [{ name: 'iconPress', label: iconAccessibilityLabel }] : undefined
      }
      onAccessibilityAction={
        hasIconButton
          ? (event) => {
              if (event.nativeEvent.actionName === 'iconPress') onIconPress?.();
            }
          : undefined
      }
    >
      {hasIconButton ? (
        <TouchableOpacity
          onPress={onIconPress}
          hitSlop={ICON_HIT_SLOP}
          activeOpacity={0.5}
          accessibilityRole="button"
          accessibilityLabel={iconAccessibilityLabel}
        >
          {iconElement}
        </TouchableOpacity>
      ) : (
        iconElement
      )}
      <Text
        style={[styles.chipText, { color: active ? '#FFFFFF' : colors.text }, textStyle]}
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
