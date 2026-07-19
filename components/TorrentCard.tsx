import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TorrentInfo } from '@/types/api';
import { useTheme } from '@/context/ThemeContext';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { haptics } from '@/utils/haptics';
import { getStateColor, getStateLabel, hasEta, isTorrentComplete } from '@/utils/torrent-state';
import { formatSpeed, formatSize, formatTime, formatProgress, formatAvailability } from '@/utils/format';
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
  column = 'left',
  fullWidth = false,
}: {
  label: string;
  value: string;
  truncate?: boolean;
  column?: 'left' | 'right';
  fullWidth?: boolean;
}) {
  const { colors } = useTheme();

  if (fullWidth) {
    return (
      <View style={detailRowStyles.fullRow}>
        <Text style={[detailRowStyles.fullLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text
          style={[detailRowStyles.fullValue, { color: colors.text }]}
          numberOfLines={truncate ? 1 : undefined}
          ellipsizeMode="middle"
        >
          {value}
        </Text>
      </View>
    );
  }

  return (
    <View style={[detailRowStyles.cell, column === 'right' && detailRowStyles.cellRight]}>
      <Text style={[detailRowStyles.cellLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[detailRowStyles.cellValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// Renders two label/value cells together on a single row, immune to the
// surrounding grid's flex-wrap ordering — used for pairs (e.g. date + time)
// that must never split across rows regardless of preceding item parity.
function PairRow({
  label,
  value,
  label2,
  value2,
}: {
  label: string;
  value: string;
  label2: string;
  value2: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={detailRowStyles.pairRow}>
      <View style={detailRowStyles.cell}>
        <Text style={[detailRowStyles.cellLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[detailRowStyles.cellValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <View style={[detailRowStyles.cell, detailRowStyles.cellRight]}>
        <Text style={[detailRowStyles.cellLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label2}
        </Text>
        <Text style={[detailRowStyles.cellValue, { color: colors.text }]} numberOfLines={1}>
          {value2}
        </Text>
      </View>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  fullRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    width: '100%',
  },
  fullLabel: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 64,
    marginRight: 8,
  },
  fullValue: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  pairRow: {
    flexDirection: 'row',
    width: '100%',
  },
  cell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingRight: 6,
  },
  cellRight: {
    paddingRight: 0,
    paddingLeft: 6,
    justifyContent: 'flex-end',
  },
  cellLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
    flexShrink: 0,
  },
  cellValue: {
    fontSize: 12,
    fontWeight: '400',
    flexShrink: 1,
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
  const etaVisible = hasEta(torrent.eta, torrent.progress ?? 0);
  const seeding = isTorrentComplete(torrent.progress ?? 0);

  const speedParts: string[] = [];
  if (dlspeed > 0) speedParts.push(`${formatSpeed(dlspeed)} ↓`);
  if (upspeed > 0) speedParts.push(`${formatSpeed(upspeed)} ↑`);
  const speedText = speedParts.length > 0 ? speedParts.join('  ') : null;

  // Build statusLine to include percent+ETA/ratio inline. Once a torrent is
  // seeding, ETA is meaningless (see hasEta) and ratio becomes the relevant metric.
  const statusLine = [
    stateLabel,
    speedText,
    formatProgress(torrent.progress, 0),
    etaVisible ? formatTime(torrent.eta) : null,
    !etaVisible && seeding ? `${t('torrentDetail.ratio')}: ${(torrent.ratio ?? 0).toFixed(2)}` : null,
  ].filter(Boolean).join('  ·  ');

  // Build two-column detail items: short fields get 50% width, long ones span full width.
  // Column parity is tracked only across short items so full-width rows don't disrupt pairing.
  const detailItems: Array<{
    key: string;
    label: string;
    value: string;
    fullWidth?: boolean;
    truncate?: boolean;
    column?: 'left' | 'right';
    pair?: boolean;
    label2?: string;
    value2?: string;
  }> = [];

  if (!compact) {
    let shortCount = 0;
    const addItem = (
      key: string,
      label: string,
      value: string,
      fullWidth = false,
      truncate = false,
    ) => {
      if (fullWidth) {
        detailItems.push({ key, label, value, fullWidth, truncate });
      } else {
        detailItems.push({ key, label, value, column: shortCount++ % 2 === 0 ? 'left' : 'right' });
      }
    };

    if (show('status')) addItem('status', t('screens.settings.expandedCardFieldsList.status'), stateLabel);
    if (show('progress')) addItem('progress', t('screens.settings.expandedCardFieldsList.progress'), formatProgress(torrent.progress));
    if (show('dlSpeed')) addItem('dlSpeed', t('screens.settings.expandedCardFieldsList.dlSpeed'), dlspeed > 0 ? formatSpeed(dlspeed) : '—');
    if (show('ulSpeed')) addItem('ulSpeed', t('screens.settings.expandedCardFieldsList.ulSpeed'), upspeed > 0 ? formatSpeed(upspeed) : '—');
    if (show('eta') && etaVisible) addItem('eta', t('screens.settings.expandedCardFieldsList.eta'), formatTime(torrent.eta));
    if (show('seeds')) addItem('seeds', t('screens.settings.expandedCardFieldsList.seeds'), `${torrent.num_seeds} / ${torrent.num_complete}`);
    if (show('peers')) addItem('peers', t('screens.settings.expandedCardFieldsList.peers'), `${torrent.num_leechs} / ${torrent.num_incomplete}`);
    if (show('ratio')) addItem('ratio', t('screens.settings.expandedCardFieldsList.ratio'), torrent.ratio != null ? torrent.ratio.toFixed(2) : '—');
    if (show('ratioLimit')) addItem('ratioLimit', t('screens.settings.expandedCardFieldsList.ratioLimit'), torrent.ratio_limit != null && torrent.ratio_limit >= 0 ? torrent.ratio_limit.toFixed(2) : '∞');
    if (show('maxRatio')) addItem('maxRatio', t('screens.settings.expandedCardFieldsList.maxRatio'), torrent.max_ratio != null && torrent.max_ratio >= 0 ? torrent.max_ratio.toFixed(2) : '∞');
    if (show('uploaded')) addItem('uploaded', t('screens.settings.expandedCardFieldsList.uploaded'), formatSize(torrent.uploaded));
    if (show('availability')) addItem('availability', t('screens.settings.expandedCardFieldsList.availability'), torrent.availability > 0 ? formatAvailability(torrent.availability) : '—');
    if (show('popularity') && torrent.popularity != null) addItem('popularity', t('screens.settings.expandedCardFieldsList.popularity'), torrent.popularity.toFixed(2));
    if (show('seedingTime')) addItem('seedingTime', t('screens.settings.expandedCardFieldsList.seedingTime'), torrent.seeding_time > 0 ? formatTime(torrent.seeding_time) : '—');
    if (show('addedOn')) {
      // Date + time rendered as a self-contained left/right pair on one row —
      // does not consume a shortCount slot, so it never splits across rows
      // and doesn't disrupt column parity for fields that follow it.
      const added = new Date(torrent.added_on * 1000);
      const addedValid = torrent.added_on > 0 && !isNaN(added.getTime());
      detailItems.push({
        key: 'addedOn',
        pair: true,
        label: t('screens.settings.expandedCardFieldsList.addedOn'),
        value: addedValid ? added.toLocaleDateString() : '—',
        label2: t('screens.settings.expandedCardFieldsList.addedTime'),
        value2: addedValid ? added.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
      });
    }
    if (show('tags') && !!torrent.tags) addItem('tags', t('screens.settings.expandedCardFieldsList.tags'), torrent.tags, true);
    if (show('category') && !!torrent.category) addItem('category', t('screens.settings.expandedCardFieldsList.category'), torrent.category);
    if (show('tracker') && !!torrent.tracker) addItem('tracker', t('screens.settings.expandedCardFieldsList.tracker'), torrent.tracker, true, true);
    if (show('savePath') && !!torrent.save_path) addItem('savePath', t('screens.settings.expandedCardFieldsList.savePath'), torrent.save_path, true, true);
  }

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
            onPress={(e) => { e.stopPropagation?.(); haptics.medium(); onPauseResume(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.pauseButton}
            activeOpacity={0.6}
            accessibilityLabel={isPaused ? t('actions.resume') : t('actions.pause')}
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
      <View style={styles.progressBar}>
        <AnimatedProgressBar
          progress={Math.min(100, Math.max(0, progress))}
          color={stateColor}
          height={4}
        />
      </View>

      {/* Line 4: Downloaded / Total */}
      <Text style={[styles.sizeText, { color: colors.textSecondary }]}>
        {formatSize(downloaded)} / {formatSize(totalSize)}
      </Text>

      {/* Expanded detail section — two-column grid for short fields, full-width for long ones */}
      {detailItems.length > 0 && (
        <View style={[styles.detailGrid, { borderTopColor: colors.surfaceOutline }]}>
          {detailItems.map((item) =>
            item.pair ? (
              <PairRow
                key={item.key}
                label={item.label}
                value={item.value}
                label2={item.label2 ?? ''}
                value2={item.value2 ?? ''}
              />
            ) : (
              <DetailRow
                key={item.key}
                label={item.label}
                value={item.value}
                column={item.column}
                fullWidth={item.fullWidth}
                truncate={item.truncate}
              />
            ),
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
    prev.torrent.ratio_limit === next.torrent.ratio_limit &&
    prev.torrent.max_ratio === next.torrent.max_ratio &&
    prev.torrent.uploaded === next.torrent.uploaded &&
    prev.torrent.uploaded_session === next.torrent.uploaded_session &&
    prev.torrent.downloaded_session === next.torrent.downloaded_session &&
    prev.torrent.amount_left === next.torrent.amount_left &&
    prev.torrent.availability === next.torrent.availability &&
    prev.torrent.popularity === next.torrent.popularity &&
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
    marginBottom: 4,
  },
  sizeText: {
    fontSize: 13,
    fontWeight: '400',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
