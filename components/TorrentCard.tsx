import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
  onPauseResume?: () => void;
  compact?: boolean;
}

function DetailRow({
  label,
  value,
  truncate = false,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={detailRowStyles.row}>
      <Text style={[detailRowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[detailRowStyles.value, { color: colors.text }]}
        numberOfLines={truncate ? 1 : undefined}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 64,
    marginRight: 8,
  },
  value: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
});

function TorrentCardInner({ torrent, onPress, onLongPress, onPauseResume, compact = true }: TorrentCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const progress = (torrent.progress || 0) * 100;
  const dlspeed = torrent.dlspeed ?? 0;
  const upspeed = torrent.upspeed ?? 0;
  const stateColor = getStateColor(torrent.state, torrent.progress, dlspeed, upspeed, colors);
  const stateLabel = getStateLabel(torrent.state, torrent.progress, dlspeed, upspeed, t);

  const isPaused =
    torrent.state === 'pausedDL' ||
    torrent.state === 'pausedUP' ||
    torrent.state === 'stoppedDL' ||
    torrent.state === 'stoppedUP';

  const totalSize = torrent.total_size > 0 ? torrent.total_size : torrent.size || 0;
  const downloaded = torrent.completed || 0;
  const hasEta = torrent.eta > 0 && torrent.eta < 8640000;

  const speedParts: string[] = [];
  if (dlspeed > 0) speedParts.push(`${formatSpeed(dlspeed)} ↓`);
  if (upspeed > 0) speedParts.push(`${formatSpeed(upspeed)} ↑`);
  const speedText = speedParts.length > 0 ? speedParts.join('  ') : null;

  // Build statusLine to include percent+ETA inline
  const statusLine = [
    stateLabel,
    speedText,
    `${progress.toFixed(0)}%`,
    hasEta ? formatTime(torrent.eta) : null,
  ].filter(Boolean).join('  ·  ');

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

      {/* Line 2: ● State · speed · percent · ETA + pause button */}
      <View style={styles.statusRow}>
        <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
          {statusLine}
        </Text>
        {onPauseResume && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onPauseResume(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.pauseButton}
            activeOpacity={0.6}
          >
            <Ionicons
              name={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
              size={22}
              color={isPaused ? colors.success : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Full-width progress bar — no siblings */}
      <View style={[styles.progressBar, { backgroundColor: colors.surfaceOutline }]}>
        <View style={[
          styles.progressFill,
          { width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: stateColor }
        ]} />
      </View>

      {/* Line 4: Downloaded / Total */}
      <Text style={[styles.sizeText, { color: colors.textSecondary }]}>
        {formatSize(downloaded)} / {formatSize(totalSize)}
      </Text>

      {/* Expanded detail section */}
      {!compact && (
        <View style={[styles.detailGrid, { borderTopColor: colors.surfaceOutline }]}>
          <DetailRow label="Seeds" value={`${torrent.num_seeds} / ${torrent.num_complete}`} />
          <DetailRow label="Peers" value={`${torrent.num_leechs} / ${torrent.num_incomplete}`} />
          <DetailRow label="Ratio" value={torrent.ratio != null ? torrent.ratio.toFixed(2) : '—'} />
          <DetailRow label="Uploaded" value={formatSize(torrent.uploaded)} />
          {!!torrent.category && (
            <DetailRow label="Category" value={torrent.category} />
          )}
          {!!torrent.tags && (
            <DetailRow label="Tags" value={torrent.tags} />
          )}
          {!!torrent.tracker && (
            <DetailRow label="Tracker" value={torrent.tracker} truncate />
          )}
          <DetailRow
            label="Added"
            value={new Date(torrent.added_on * 1000).toLocaleDateString()}
          />
          <DetailRow label="Active" value={formatTime(torrent.time_active)} />
          {!!torrent.save_path && (
            <DetailRow label="Path" value={torrent.save_path} truncate />
          )}
        </View>
      )}
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
    prev.torrent.num_seeds === next.torrent.num_seeds &&
    prev.torrent.num_leechs === next.torrent.num_leechs &&
    prev.torrent.ratio === next.torrent.ratio &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onPauseResume === next.onPauseResume &&
    prev.compact === next.compact
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
  pauseButton: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  sizeText: {
    fontSize: 13,
    fontWeight: '400',
  },
  detailGrid: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
