/**
 * TorrentRow.tsx - dense list row for the 'regular'/'mac' split layout,
 * mirroring Pogona's Features/TransferList/TransferRow.swift anatomy:
 * a 44pt poster, name + right-aligned percent on row 1, a 5pt tinted
 * progress capsule on row 2, and a caption stats line (status badge, size,
 * down/up speed, ETA) on row 3.
 *
 * Only used on 'regular'/'mac' layout idioms - the iPhone ('compact') list
 * keeps TorrentCard untouched.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TorrentInfo } from '@/types/api';
import { useTheme } from '@/context/ThemeContext';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { ArtworkThumbnail } from '@/components/ArtworkThumbnail';
import { StatusBadge } from '@/components/StatusBadge';
import { getStateColor, getStateLabel, hasEta } from '@/utils/torrent-state';
import { avatarColor } from '@/utils/server';
import { formatSpeed, formatSize, formatTime, formatProgress } from '@/utils/format';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';

interface TorrentRowProps {
  torrent: TorrentInfo;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  categoryColor?: string;
  tagColors?: Record<string, string>;
  style?: StyleProp<ViewStyle>;
}

export function TorrentRow({
  torrent,
  selected,
  onPress,
  onLongPress,
  categoryColor,
  tagColors,
  style,
}: TorrentRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);

  const dlspeed = torrent.dlspeed ?? 0;
  const upspeed = torrent.upspeed ?? 0;
  const progress = torrent.progress ?? 0;
  const stateColor = getStateColor(torrent.state, progress, dlspeed, upspeed, colors);
  const stateLabel = getStateLabel(torrent.state, progress, dlspeed, upspeed, t);
  const etaVisible = hasEta(torrent.eta, progress);

  const totalSize = torrent.total_size > 0 ? torrent.total_size : torrent.size || 0;

  const tagList = torrent.tags
    ? torrent.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const backgroundColor = selected
    ? colors.primaryOpac
    : hovered
      ? colors.surfaceOutline
      : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={torrent.name}
      style={[styles.row, { backgroundColor }, style]}
    >
      <ArtworkThumbnail
        name={torrent.name}
        width={44}
        placeholderIcon="film-outline"
        style={styles.artwork}
      />

      <View style={styles.column}>
        {/* Row 1: name + right-aligned tabular percent */}
        <View style={styles.headerRow}>
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {torrent.name}
          </Text>
          <Text style={[styles.percent, { color: colors.textSecondary }]} numberOfLines={1}>
            {formatProgress(progress, 0)}
          </Text>
        </View>

        {/* Row 2: 5pt tinted progress capsule */}
        <View style={styles.progressRow}>
          <AnimatedProgressBar
            progress={Math.min(100, Math.max(0, progress * 100))}
            color={stateColor}
            height={5}
          />
        </View>

        {/* Row 3: status badge, size, down/up speed, spacer, ETA */}
        <View style={styles.statsRow}>
          <StatusBadge label={stateLabel} tint={stateColor} style={styles.statusBadge} />

          <View style={styles.statItem}>
            <Ionicons name="save-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatSize(totalSize)}
            </Text>
          </View>

          {dlspeed > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="arrow-down" size={12} color={colors.stateDownloading} />
              <Text style={[styles.statText, { color: colors.stateDownloading }]} numberOfLines={1}>
                {formatSpeed(dlspeed)}
              </Text>
            </View>
          )}

          {upspeed > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="arrow-up" size={12} color={colors.stateSeeding} />
              <Text style={[styles.statText, { color: colors.stateSeeding }]} numberOfLines={1}>
                {formatSpeed(upspeed)}
              </Text>
            </View>
          )}

          <View style={styles.spacer} />

          {etaVisible && (
            <Text style={[styles.statText, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatTime(torrent.eta)}
            </Text>
          )}

          {(torrent.category || tagList.length > 0) && (
            <View style={styles.stickerRow}>
              {torrent.category ? (
                <View style={styles.statItem}>
                  <Ionicons
                    name="folder-outline"
                    size={12}
                    color={categoryColor ?? avatarColor(torrent.category)}
                  />
                  <Text
                    style={[styles.statText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {torrent.category}
                  </Text>
                </View>
              ) : null}
              {tagList.map((tag) => (
                <View key={tag} style={styles.statItem}>
                  <Ionicons
                    name="pricetag-outline"
                    size={12}
                    color={tagColors?.[tag] ?? avatarColor(tag)}
                  />
                  <Text
                    style={[styles.statText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  artwork: {
    marginRight: spacing.sm,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    ...typography.bodyMedium,
    flex: 1,
    minWidth: 0,
  },
  percent: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.sm,
  },
  progressRow: {
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing.sm,
  },
  statusBadge: {
    marginRight: 0,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    ...typography.caption,
  },
  spacer: {
    flex: 1,
  },
  stickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
