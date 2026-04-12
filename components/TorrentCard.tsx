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
import { ExpandedCardField, DEFAULT_PREFERENCES } from '@/types/preferences';

interface TorrentCardProps {
  torrent: TorrentInfo;
  onPress: () => void;
  onLongPress?: () => void;
  onPauseResume?: () => void;
  compact?: boolean;
  expandedCardFields?: Record<ExpandedCardField, boolean>;
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

function TorrentCardInner({
  torrent,
  onPress,
  onLongPress,
  onPauseResume,
  compact = true,
  expandedCardFields,
}: TorrentCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const fields: Record<ExpandedCardField, boolean> = {
    ...DEFAULT_PREFERENCES.expandedCardFields,
    ...expandedCardFields,
  };

  const show = (field: ExpandedCardField) => !compact && fields[field];

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
    `${Math.floor(progress)}%`,
    hasEta ? formatTime(torrent.eta) : null,
  ].filter(Boolean).join('  ·  ');

  // Determine whether any detail rows will be rendered
  const hasAnyDetail =
    !compact &&
    (fields.dlSpeed ||
      fields.ulSpeed ||
      fields.eta ||
      fields.status ||
      fields.seeds ||
      fields.peers ||
      fields.ratio ||
      fields.uploaded ||
      fields.availability ||
      fields.seedingTime ||
      fields.addedOn ||
      fields.tags ||
      fields.category ||
      fields.tracker ||
      fields.savePath ||
      fields.progress);

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
      {hasAnyDetail && (
        <View style={[styles.detailGrid, { borderTopColor: colors.surfaceOutline }]}>
          {show('status') && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.status')}
              value={stateLabel}
            />
          )}
          {show('progress') && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.progress')}
              value={`${(Math.floor(progress * 10) / 10).toFixed(1)}%`}
            />
          )}
          {show('dlSpeed') && dlspeed > 0 && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.dlSpeed')}
              value={`${formatSpeed(dlspeed)}`}
            />
          )}
          {show('ulSpeed') && upspeed > 0 && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.ulSpeed')}
              value={`${formatSpeed(upspeed)}`}
            />
          )}
          {show('eta') && hasEta && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.eta')}
              value={formatTime(torrent.eta)}
            />
          )}
          {show('seeds') && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.seeds')}
              value={`${torrent.num_seeds} / ${torrent.num_complete}`}
            />
          )}
          {show('peers') && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.peers')}
              value={`${torrent.num_leechs} / ${torrent.num_incomplete}`}
            />
          )}
          {show('ratio') && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.ratio')}
              value={torrent.ratio != null ? torrent.ratio.toFixed(2) : '—'}
            />
          )}
          {show('uploaded') && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.uploaded')}
              value={formatSize(torrent.uploaded)}
            />
          )}
          {show('availability') && torrent.availability > 0 && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.availability')}
              value={(Math.floor(torrent.availability * 1000) / 1000).toFixed(3)}
            />
          )}
          {show('seedingTime') && torrent.seeding_time > 0 && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.seedingTime')}
              value={formatTime(torrent.seeding_time)}
            />
          )}
          {show('addedOn') && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.addedOn')}
              value={new Date(torrent.added_on * 1000).toLocaleDateString()}
            />
          )}
          {show('tags') && !!torrent.tags && (
            <DetailRow label={t('screens.settings.expandedCardFieldsList.tags')} value={torrent.tags} />
          )}
          {show('category') && !!torrent.category && (
            <DetailRow label={t('screens.settings.expandedCardFieldsList.category')} value={torrent.category} />
          )}
          {show('tracker') && !!torrent.tracker && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.tracker')}
              value={torrent.tracker}
              truncate
            />
          )}
          {show('savePath') && !!torrent.save_path && (
            <DetailRow
              label={t('screens.settings.expandedCardFieldsList.savePath')}
              value={torrent.save_path}
              truncate
            />
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
    prev.torrent.uploaded === next.torrent.uploaded &&
    prev.torrent.uploaded_session === next.torrent.uploaded_session &&
    prev.torrent.downloaded_session === next.torrent.downloaded_session &&
    prev.torrent.amount_left === next.torrent.amount_left &&
    prev.torrent.availability === next.torrent.availability &&
    prev.torrent.seeding_time === next.torrent.seeding_time &&
    prev.torrent.dl_limit === next.torrent.dl_limit &&
    prev.torrent.up_limit === next.torrent.up_limit &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onPauseResume === next.onPauseResume &&
    prev.compact === next.compact &&
    prev.expandedCardFields === next.expandedCardFields
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
