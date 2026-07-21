import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TorrentInfo } from '@/types/api';
import { useTheme } from '@/context/ThemeContext';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { haptics } from '@/utils/haptics';
import { getStateColor, getStateLabel, hasEta } from '@/utils/torrent-state';
import { formatSpeed, formatSize, formatTime, formatProgress, formatAvailability } from '@/utils/format';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { ExpandedCardField, DEFAULT_PREFERENCES } from '@/types/preferences';

interface TorrentCardProps {
  torrent: TorrentInfo;
  onPress: () => void;
  onLongPress?: () => void;
  onPauseResume?: () => void;
  onMenuPress?: (anchor: { x: number; y: number }) => void;
  compact?: boolean;
  expandedCardFields?: Record<ExpandedCardField, boolean>;
  /** Columns in the detailed-card stats grid (3 | 4 | 5). Defaults to 4. */
  gridColumns?: 3 | 4 | 5;
}

// Detailed-card cell: small secondary label stacked above the value.
// Short fields sit in a wrapping N-per-row grid; long fields (tags, tracker,
// savePath) take a full-width label/value row with middle truncation.
function DetailRow({
  label,
  value,
  truncate = false,
  fullWidth = false,
  columns = 4,
}: {
  label: string;
  value: string;
  truncate?: boolean;
  fullWidth?: boolean;
  columns?: 3 | 4 | 5;
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
    <View style={[detailRowStyles.cell, { width: COLUMN_WIDTH[columns] }]}>
      <Text style={[detailRowStyles.cellLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[detailRowStyles.cellValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const COLUMN_WIDTH: Record<3 | 4 | 5, `${number}%`> = {
  3: '33.33%',
  4: '25%',
  5: '20%',
};

const detailRowStyles = StyleSheet.create({
  fullRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
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
  cell: {
    paddingVertical: spacing.xs,
    paddingRight: 4,
  },
  cellLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  cellValue: {
    fontSize: 13,
    fontWeight: '500',
  },
});

function TorrentCardInner({
  torrent,
  onPress,
  onLongPress,
  onPauseResume,
  onMenuPress,
  compact = true,
  expandedCardFields,
  gridColumns = 4,
}: TorrentCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const menuButtonRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);

  const handleMenuPress = () => {
    if (!onMenuPress) return;
    // Anchor the popover to the button's bottom-left corner (frozen contract).
    menuButtonRef.current?.measureInWindow((x, y, _width, height) => {
      onMenuPress({ x, y: y + height });
    });
  };

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

  // Always-on stats line (compact + detailed): percent, ETA (when meaningful),
  // up/down speeds, ratio last. Not part of the toggleable field grid.
  const statusLine = [
    formatProgress(torrent.progress, 0),
    etaVisible ? formatTime(torrent.eta) : null,
    upspeed > 0 ? `${formatSpeed(upspeed)} ↑` : null,
    dlspeed > 0 ? `${formatSpeed(dlspeed)} ↓` : null,
    `${(torrent.ratio ?? 0).toFixed(2)} ${t('⇅')}`,
  ].filter(Boolean).join('  ·  ');

  // Build detail items: short fields become stacked label-over-value cells in
  // a wrapping N-per-row grid; long ones span a full-width truncated row.
  const detailItems: Array<{
    key: string;
    label: string;
    value: string;
    fullWidth?: boolean;
    truncate?: boolean;
  }> = [];

  if (!compact) {
    const addItem = (
      key: string,
      label: string,
      value: string,
      fullWidth = false,
      truncate = false,
    ) => {
      detailItems.push({ key, label, value, fullWidth, truncate });
    };

    if (show('seeds')) addItem('seeds', t('screens.settings.expandedCardFieldsList.seeds'), `${torrent.num_seeds} / ${torrent.num_complete}`);
    if (show('peers')) addItem('peers', t('screens.settings.expandedCardFieldsList.peers'), `${torrent.num_leechs} / ${torrent.num_incomplete}`);
    if (show('ratioLimit')) addItem('ratioLimit', t('screens.settings.expandedCardFieldsList.ratioLimit'), torrent.ratio_limit != null && torrent.ratio_limit >= 0 ? torrent.ratio_limit.toFixed(2) : '∞');
    if (show('maxRatio')) addItem('maxRatio', t('screens.settings.expandedCardFieldsList.maxRatio'), torrent.max_ratio != null && torrent.max_ratio >= 0 ? torrent.max_ratio.toFixed(2) : '∞');
    if (show('uploaded')) addItem('uploaded', t('screens.settings.expandedCardFieldsList.uploaded'), formatSize(torrent.uploaded));
    if (show('availability')) addItem('availability', t('screens.settings.expandedCardFieldsList.availability'), torrent.availability > 0 ? formatAvailability(torrent.availability) : '—');
    if (show('popularity') && torrent.popularity != null) addItem('popularity', t('screens.settings.expandedCardFieldsList.popularity'), torrent.popularity.toFixed(2));
    if (show('seedingTime')) addItem('seedingTime', t('screens.settings.expandedCardFieldsList.seedingTime'), torrent.seeding_time > 0 ? formatTime(torrent.seeding_time) : '—');
    if (show('addedOn')) {
      const added = new Date(torrent.added_on * 1000);
      const addedValid = torrent.added_on > 0 && !isNaN(added.getTime());
      addItem('addedOn', t('screens.settings.expandedCardFieldsList.addedOn'), addedValid ? added.toLocaleDateString() : '—');
      addItem('addedTime', t('screens.settings.expandedCardFieldsList.addedTime'), addedValid ? added.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
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
      style={[
        styles.card,
        !compact && styles.cardDetailed,
        {
          backgroundColor: colors.surface,
          borderLeftColor: stateColor,
        },
        isPaused && styles.cardPaused,
      ]}
    >
      {/* Line 1: Torrent name + tinted state badge + three-dot menu */}
      <View style={styles.headerRow}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {torrent.name}
        </Text>
        <View style={styles.badge}>
          {/* Tint layer: state color at low opacity behind fully-opaque text.
              getStateColor returns mixed formats (hex/rgb/rgba), so the tint is
              layered via View opacity instead of parsing/recomposing the color. */}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: stateColor, opacity: 0.28 }]}
          />
          {/* Theme text color, not the state color — state-colored text on its
              own tint can be unreadable for low-contrast states. */}
          <Text style={[styles.badgeText, { color: colors.text }]} numberOfLines={1}>
            {stateLabel}
          </Text>
        </View>
        {onMenuPress && (
          <TouchableOpacity
            ref={menuButtonRef}
            onPress={(e) => { e.stopPropagation?.(); handleMenuPress(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.menuButton}
            activeOpacity={0.6}
            accessibilityLabel={t('actions.torrentMenu')}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Always-on: percent · ETA · up speed · down speed · ratio */}
      <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
        {statusLine}
      </Text>

      {/* Progress bar + filled circular pause/play button */}
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <AnimatedProgressBar
            progress={Math.min(100, Math.max(0, progress))}
            color={stateColor}
            height={compact ? 4 : 5}
          />
        </View>
        {onPauseResume && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); haptics.medium(); onPauseResume(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.pauseCircle, !compact && styles.pauseCircleDetailed, { backgroundColor: stateColor }]}
            activeOpacity={0.7}
            accessibilityLabel={isPaused ? t('actions.resume') : t('actions.pause')}
          >
            {/* White-on-state-color matches the bulkAction buttons' precedent. */}
            <Ionicons name={isPaused ? 'play' : 'pause'} size={compact ? 13 : 14} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Always-on: Downloaded / Total */}
      <Text style={[styles.sizeText, { color: colors.textSecondary }]}>
        {formatSize(downloaded)} / {formatSize(totalSize)}
      </Text>

      {/* Expanded detail section — stacked label-over-value cells, N per row;
          full-width truncated rows for long fields */}
      {detailItems.length > 0 && (
        <View style={styles.detailGrid}>
          {detailItems.map((item) => (
            <DetailRow
              key={item.key}
              label={item.label}
              value={item.value}
              fullWidth={item.fullWidth}
              truncate={item.truncate}
              columns={gridColumns}
            />
          ))}
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
    prev.torrent.eta === next.torrent.eta &&
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
    prev.torrent.completed === next.torrent.completed &&
    prev.torrent.size === next.torrent.size &&
    prev.torrent.total_size === next.torrent.total_size &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onPauseResume === next.onPauseResume &&
    prev.onMenuPress === next.onMenuPress &&
    prev.compact === next.compact &&
    prev.expandedCardFields === next.expandedCardFields &&
    prev.gridColumns === next.gridColumns
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.medium,
    borderLeftWidth: 1.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm - 2,
    ...shadows.card,
  },
  cardDetailed: {
    borderRadius: borderRadius.large,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cardPaused: {
    opacity: 0.75,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
    paddingBottom: 2,
    flex: 1,
  },
  badge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginLeft: spacing.sm,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  menuButton: {
    marginLeft: spacing.xs,
    marginTop: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
    marginBottom: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  progressBar: {
    flex: 1,
  },
  pauseCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseCircleDetailed: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  sizeText: {
    fontSize: 12,
    fontWeight: '400',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
});
