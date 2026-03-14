import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TorrentInfo } from '@/types/api';
import { useTheme } from '@/context/ThemeContext';
import { getStateColor, getStateLabel } from '@/utils/torrent-state';
import { formatSpeed, formatSize, formatTime } from '@/utils/format';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

interface TorrentCardProps {
  torrent: TorrentInfo;
  onPress: () => void;
  onLongPress?: () => void;
}

function TorrentCardInner({ torrent, onPress, onLongPress }: TorrentCardProps) {
  const { colors } = useTheme();

  const progress = (torrent.progress || 0) * 100;
  const dlspeed = torrent.dlspeed ?? 0;
  const upspeed = torrent.upspeed ?? 0;
  const stateColor = getStateColor(torrent.state, torrent.progress, dlspeed, upspeed, colors);
  const stateLabel = getStateLabel(torrent.state, torrent.progress, dlspeed, upspeed);

  const isPaused =
    torrent.state === 'pausedDL' ||
    torrent.state === 'pausedUP' ||
    torrent.state === 'stoppedDL' ||
    torrent.state === 'stoppedUP';

  const totalSize = torrent.total_size > 0 ? torrent.total_size : torrent.size || 0;
  const downloaded = torrent.downloaded || 0;
  const hasEta = torrent.eta > 0 && torrent.eta < 8640000;

  const speedParts: string[] = [];
  if (dlspeed > 0) speedParts.push(`${formatSpeed(dlspeed)} ↓`);
  if (upspeed > 0) speedParts.push(`${formatSpeed(upspeed)} ↑`);
  const speedText = speedParts.length > 0 ? ` · ${speedParts.join('  ')}` : '';

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={[styles.card, { backgroundColor: colors.surface }, isPaused && styles.cardPaused]}
    >
      {/* Line 1: Torrent name */}
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
        {torrent.name}
      </Text>

      {/* Line 2: ● State · speed */}
      <View style={styles.statusRow}>
        <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
          {stateLabel}{speedText}
        </Text>
      </View>

      {/* Line 3: Progress bar + percentage + ETA */}
      <View style={styles.progressRow}>
        <View style={[styles.progressBar, { backgroundColor: colors.surfaceOutline }]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: stateColor }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {progress.toFixed(0)}%{hasEta ? ` · ${formatTime(torrent.eta)}` : ''}
        </Text>
      </View>

      {/* Line 4: Downloaded / Total */}
      <Text style={[styles.sizeText, { color: colors.textSecondary }]}>
        {formatSize(downloaded)} / {formatSize(totalSize)}
      </Text>
    </TouchableOpacity>
  );
}

export const TorrentCard = React.memo(TorrentCardInner, (prev, next) => {
  return (
    prev.torrent.hash === next.torrent.hash &&
    prev.torrent.state === next.torrent.state &&
    prev.torrent.progress === next.torrent.progress &&
    prev.torrent.dlspeed === next.torrent.dlspeed &&
    prev.torrent.upspeed === next.torrent.upspeed &&
    prev.torrent.name === next.torrent.name &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.medium,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...shadows.card,
  },
  cardPaused: {
    opacity: 0.6,
  },
  name: {
    ...typography.headline,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '400',
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '400',
    minWidth: 70,
    textAlign: 'right',
  },
  sizeText: {
    fontSize: 13,
    fontWeight: '400',
  },
});
