/**
 * StatusBadge.tsx - shadcn-style status chip, mirroring Pogona's
 * DesignSystem/TransferFormatting.swift StatusBadge: caption-medium label
 * in the tint color, a 0.14-alpha tint fill, a 0.22-alpha tint border, and
 * a small radius.
 *
 * Used on 'regular'/'mac' layouts (TorrentRow); the iPhone ('compact')
 * layout keeps TorrentCard's own pill and never renders this component.
 */
import React from 'react';
import { Text, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { typography } from '@/constants/typography';
import { borderRadius } from '@/constants/spacing';
import { hexToRgba } from '@/utils/color';

interface StatusBadgeProps {
  label: string;
  tint: string;
  style?: StyleProp<ViewStyle>;
}

export function StatusBadge({ label, tint, style }: StatusBadgeProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: hexToRgba(tint, 0.14),
          borderColor: hexToRgba(tint, 0.22),
        },
        style,
      ]}
    >
      <Text
        style={[styles.label, { color: tint || colors.text }]}
        numberOfLines={1}
        accessibilityLabel={label}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.xsmall,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.captionMedium,
  },
});
