/**
 * StatusBadge.tsx - shadcn-style status chip, mirroring Pogona's
 * DesignSystem/TransferFormatting.swift StatusBadge: caption-medium label
 * in the tint color, a 0.14-alpha tint fill, a 0.22-alpha tint border, and
 * a small radius.
 *
 * Used on 'regular'/'mac' layouts (TorrentRow); the iPhone ('compact')
 * layout keeps TorrentCard's own pill and never renders this component.
 *
 * `size` picks the desktop-table look ('desktop': 18pt tall, 11pt medium,
 * radius 4, paddingHorizontal 6, matching desktopMetrics('mac').badgeHeight/
 * badgeFontSize) vs the default 'compact' look, which is the original
 * untouched styling used by every existing call site. `selected` swaps the
 * label to colors.onAccent for a badge sitting on a solid selection fill
 * (TorrentTable's selected row on mac) while keeping its tint background/
 * border.
 */
import React from 'react';
import { Text, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { typography } from '@/constants/typography';
import { borderRadius } from '@/constants/spacing';
import { hexToRgba } from '@/utils/color';
import { desktopMetrics } from '@/constants/desktop';

// The 'desktop' size always mirrors the mac look (TorrentTable's rows), even
// on a build where this component itself never sees the 'regular' idiom -
// read straight from the mac token set rather than re-declaring its numbers.
const macMetrics = desktopMetrics('mac');

interface StatusBadgeProps {
  label: string;
  tint: string;
  style?: StyleProp<ViewStyle>;
  size?: 'desktop' | 'compact';
  selected?: boolean;
}

export function StatusBadge({
  label,
  tint,
  style,
  size = 'compact',
  selected = false,
}: StatusBadgeProps) {
  const { colors } = useTheme();
  const isDesktop = size === 'desktop';

  return (
    <View
      style={[
        styles.badge,
        isDesktop && styles.badgeDesktop,
        {
          backgroundColor: hexToRgba(tint, 0.14),
          borderColor: hexToRgba(tint, 0.22),
        },
        style,
      ]}
    >
      <Text
        style={[
          isDesktop ? styles.labelDesktop : styles.label,
          { color: selected ? colors.onAccent : tint || colors.text },
        ]}
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
  badgeDesktop: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 0,
    height: macMetrics.badgeHeight,
    justifyContent: 'center',
  },
  label: {
    ...typography.captionMedium,
  },
  labelDesktop: {
    fontSize: macMetrics.badgeFontSize,
    fontWeight: '500' as const,
    lineHeight: macMetrics.badgeFontSize + 2,
  },
});
