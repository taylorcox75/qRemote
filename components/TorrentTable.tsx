/**
 * TorrentTable.tsx - dense 11-column desktop table for the 'mac' idiom,
 * mirroring Pogona's Features/Main/MacTransfersView.swift `transfersTable`
 * anatomy: a desktopMetrics('mac')-tall row per torrent (26pt), a 20pt
 * square leading slot (TMDB poster art when active and matched, else a
 * tinted Ionicons state glyph - see getStateIcon) before the name cell,
 * right-aligned tabular-nums numeric columns, and a header row whose cells
 * double as sort toggles - 24pt tall, 11pt medium sentence-case secondary
 * labels (Finder-style, not uppercase), a hairline bottom border and
 * hairline separators between header cells only.
 *
 * Only rendered on the 'mac' layout idiom - the iPhone ('compact') and iPad
 * ('regular') layouts keep TorrentCard/TorrentRow untouched.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TorrentInfo } from '@/types/api';
import { SortField } from '@/types/preferences';
import { useTheme } from '@/context/ThemeContext';
import { useArtworkSettings } from '@/context/ArtworkContext';
import { useArtwork } from '@/hooks/useArtwork';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';
import { ArtworkThumbnail } from '@/components/ArtworkThumbnail';
import { StatusBadge } from '@/components/StatusBadge';
import { getStateColor, getStateLabel, hasEta } from '@/utils/torrent-state';
import { formatSpeed, formatSize, formatTime, formatRatio, formatProgress } from '@/utils/format';
import { spacing } from '@/constants/spacing';
import { desktopMetrics } from '@/constants/desktop';
import { hexToRgba } from '@/utils/color';

const METRICS = desktopMetrics('mac');

interface TorrentTableProps {
  torrents: TorrentInfo[];
  selectedHash: string | null;
  onSelect: (hash: string) => void;
  onContextMenu: (hash: string, anchor: { x: number; y: number }) => void;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: SortField, direction: 'asc' | 'desc') => void;
  alternatingRows: boolean;
  categoryColors?: Record<string, string>;
  // Pixels of empty space to reserve above the header row so the absolutely
  // positioned search/sort header (index.tsx styles.headerContainer,
  // zIndex 1000) does not cover the column headers or the first rows. Mirrors
  // the FlatList branch's styles.listContent.paddingTop; 0 (default) keeps
  // callers outside the mac shell (tests, future reuse) unaffected.
  topInset?: number;
}

type ColumnKey =
  | 'name'
  | 'size'
  | 'progress'
  | 'status'
  | 'down'
  | 'up'
  | 'seeds'
  | 'peers'
  | 'eta'
  | 'ratio'
  | 'added';

interface ColumnDef {
  key: ColumnKey;
  /** Sortable column's SortField, or null when the column has no SortField
   * equivalent in types/preferences.ts (status, seeds, peers, eta). */
  field: SortField | null;
  /** Fixed width in px, or undefined for the flexible name column. */
  width?: number;
  minWidth?: number;
  align: 'left' | 'right';
}

const NAME_MIN_WIDTH = 180;
const SIZE_WIDTH = 80;
const PROGRESS_WIDTH = 104;
const STATUS_WIDTH = 100;
const DOWN_WIDTH = 84;
const UP_WIDTH = 84;
const SEEDS_WIDTH = 60;
const PEERS_WIDTH = 60;
const ETA_WIDTH = 68;
const RATIO_WIDTH = 52;
const ADDED_WIDTH = 96;
// Trailing per-row context-menu button. Not a COLUMNS entry (no sortable
// field, no header label) - onPointerDown/onHoverIn/onHoverOut right-click
// below never fire on this RN/Fabric build (RCTGetDispatchW3CPointerEvents
// defaults NO and nothing in this app enables it), so this is the only way
// a mouse/trackpad user can reach the context menu without a long-press.
const MENU_WIDTH = 28;
const ROW_HEIGHT = METRICS.tableRowHeight;
const HEADER_HEIGHT = METRICS.tableHeaderHeight;
const COLUMN_GAP = spacing.sm;
const ROW_PADDING_HORIZONTAL = spacing.md;
const POSTER_SIZE = 20;
const PROGRESS_BAR_WIDTH = 60;
const PROGRESS_GAP = 4;
const PROGRESS_PERCENT_WIDTH = 40;

const COLUMNS: ColumnDef[] = [
  { key: 'name', field: 'name', minWidth: NAME_MIN_WIDTH, align: 'left' },
  { key: 'size', field: 'size', width: SIZE_WIDTH, align: 'right' },
  { key: 'progress', field: 'progress', width: PROGRESS_WIDTH, align: 'right' },
  { key: 'status', field: null, width: STATUS_WIDTH, align: 'left' },
  { key: 'down', field: 'dlspeed', width: DOWN_WIDTH, align: 'right' },
  { key: 'up', field: 'upspeed', width: UP_WIDTH, align: 'right' },
  { key: 'seeds', field: null, width: SEEDS_WIDTH, align: 'right' },
  { key: 'peers', field: null, width: PEERS_WIDTH, align: 'right' },
  { key: 'eta', field: null, width: ETA_WIDTH, align: 'right' },
  { key: 'ratio', field: 'ratio', width: RATIO_WIDTH, align: 'right' },
  { key: 'added', field: 'added_on', width: ADDED_WIDTH, align: 'right' },
];

const FIXED_COLUMNS_WIDTH = COLUMNS.reduce((sum, col) => sum + (col.width ?? 0), 0);
// Sum of the fixed columns plus the flexible Name column's minWidth - tuned
// so a 1060pt content width (the mac shell's default window) fits every
// column with no horizontal scroll; narrower windows still scroll via the
// ScrollView above.
const TABLE_MIN_WIDTH = FIXED_COLUMNS_WIDTH + NAME_MIN_WIDTH;

// Short date ("Sep 10" for the current year, "Sep 10, 2026" otherwise),
// mirroring Pogona's dense technical/tabular table columns. utils/format.ts's
// formatDate returns a full locale datetime string (too long for a 96px
// column), so this formats locally with the device's own locale/calendar
// rather than forcing en-US.
function formatShortDate(epochSeconds: number | undefined | null): string {
  if (epochSeconds == null || isNaN(epochSeconds) || epochSeconds <= 0) return '-';
  const d = new Date(epochSeconds * 1000);
  if (isNaN(d.getTime())) return '-';
  const currentYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(
    undefined,
    currentYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

// "connected | swarm total" pair, mirroring Fmt.pair ("2 | 40").
function formatPair(connected: number, total: number): string {
  return `${Math.max(0, connected)} | ${Math.max(0, total)}`;
}

// State glyph for the name-cell leading slot when there's no poster to show
// (artwork inactive, or no TMDB match/poster for this row). Mirrors
// getStateColor's grouping (utils/torrent-state.ts) 1:1 so the glyph and the
// tint it's drawn in (getStateColor) always agree on which state group a row
// is in.
function getStateIcon(
  state: string,
  progress: number,
  dlspeed: number,
  upspeed: number,
): keyof typeof Ionicons.glyphMap {
  const downloading = dlspeed > 0;
  const uploading = upspeed > 0;

  if (downloading && uploading) return 'arrow-down-circle';
  if (uploading && !downloading) return 'arrow-up-circle';

  if (state === 'stalledUP' && progress >= 1) return 'checkmark-circle';
  if ((state === 'stoppedDL' || state === 'pausedDL') && progress >= 1) {
    return 'checkmark-circle';
  }

  switch (state) {
    case 'downloading':
    case 'forcedDL':
      return 'arrow-down-circle';
    case 'metaDL':
    case 'forcedMetaDL':
      return 'ellipsis-horizontal-circle';
    case 'uploading':
    case 'forcedUP':
      return 'arrow-up-circle';
    case 'pausedDL':
    case 'stoppedDL':
      return 'pause-circle';
    case 'pausedUP':
    case 'stoppedUP':
      return 'checkmark-circle';
    case 'error':
    case 'missingFiles':
      return 'alert-circle';
    case 'checkingDL':
    case 'checkingUP':
      return 'sync-circle';
    case 'queuedDL':
    case 'queuedUP':
      return 'time';
    case 'stalledDL':
    case 'stalledUP':
      return 'ellipsis-horizontal-circle';
    case 'allocating':
    case 'checkingResumeData':
    case 'moving':
    case 'unknown':
    default:
      return 'ellipsis-horizontal-circle';
  }
}

interface HeaderCellProps {
  column: ColumnDef;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: SortField, direction: 'asc' | 'desc') => void;
  showSeparator: boolean;
}

function HeaderCell({
  column,
  sortBy,
  sortDirection,
  onSortChange,
  showSeparator,
}: HeaderCellProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const label = t(`table.columns.${column.key}`);
  const active = column.field !== null && column.field === sortBy;
  const sizeStyle = column.width ? { width: column.width } : { flex: 1, minWidth: column.minWidth };
  const wrapperStyle = [
    styles.headerCellWrap,
    sizeStyle,
    showSeparator && {
      borderRightWidth: METRICS.hairline,
      borderRightColor: colors.surfaceOutline,
    },
  ];

  const content = (
    <View style={[styles.headerCellContent, { justifyContent: alignToJustify(column.align) }]}>
      <Text style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      {active && (
        <Ionicons
          name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
          size={10}
          color={colors.textSecondary}
          style={styles.headerChevron}
        />
      )}
    </View>
  );

  if (column.field === null) {
    return <View style={wrapperStyle}>{content}</View>;
  }

  const field = column.field;
  const accessibilityLabel = active
    ? `${label}, ${sortDirection === 'asc' ? t('table.sortedAscending') : t('table.sortedDescending')}`
    : label;

  return (
    <Pressable
      style={wrapperStyle}
      onPress={() => onSortChange(field, active && sortDirection === 'asc' ? 'desc' : 'asc')}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
    >
      {content}
    </Pressable>
  );
}

function alignToJustify(align: 'left' | 'right'): 'flex-start' | 'flex-end' {
  return align === 'right' ? 'flex-end' : 'flex-start';
}

interface TableHeaderProps {
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: SortField, direction: 'asc' | 'desc') => void;
}

function TableHeader({ sortBy, sortDirection, onSortChange }: TableHeaderProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.headerRow,
        { backgroundColor: colors.surface, borderBottomColor: colors.surfaceOutline },
      ]}
    >
      {COLUMNS.map((column, index) => (
        <HeaderCell
          key={column.key}
          column={column}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          showSeparator={index !== COLUMNS.length - 1}
        />
      ))}
      {/* Spacer matching the row's trailing menu button - keeps columns
          aligned without adding an unsortable COLUMNS entry (and the i18n
          key that would need). */}
      <View style={{ width: MENU_WIDTH }} />
    </View>
  );
}

interface TableRowProps {
  torrent: TorrentInfo;
  index: number;
  selected: boolean;
  onSelect: (hash: string) => void;
  onContextMenu: (hash: string, anchor: { x: number; y: number }) => void;
  alternatingRows: boolean;
  categoryColors?: Record<string, string>;
}

function TorrentTableRowInner({
  torrent,
  index,
  selected,
  onSelect,
  onContextMenu,
  alternatingRows,
  categoryColors,
}: TableRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const menuButtonRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const { active: artworkActive } = useArtworkSettings();
  const { artwork } = useArtwork(torrent.name);
  const hasPoster = artworkActive && !!artwork?.posterPath;

  const dlspeed = torrent.dlspeed ?? 0;
  const upspeed = torrent.upspeed ?? 0;
  const progress = torrent.progress ?? 0;
  const stateColor = getStateColor(torrent.state, progress, dlspeed, upspeed, colors);
  const stateLabel = getStateLabel(torrent.state, progress, dlspeed, upspeed, t);
  const stateIcon = getStateIcon(torrent.state, progress, dlspeed, upspeed);
  const etaVisible = hasEta(torrent.eta, progress);
  const totalSize = torrent.total_size > 0 ? torrent.total_size : torrent.size || 0;
  const categoryDotColor = torrent.category ? categoryColors?.[torrent.category] : undefined;

  const openContextMenu = (x: number, y: number) => {
    onContextMenu(torrent.hash, { x, y });
  };

  const handleLongPress = (e: GestureResponderEvent) => {
    openContextMenu(e.nativeEvent.pageX, e.nativeEvent.pageY);
  };

  // Secondary (right) click on trackpad/mouse - would use the `button` field
  // RN 0.86 exposes on the PointerEvent's nativeEvent (W3C convention: 2 =
  // secondary button), and onHoverIn/onHoverOut below for the mouse-hover
  // highlight. Both are inert on this build: Fabric only instantiates the
  // pointer-event handler (and with it UIHoverGestureRecognizer) when
  // RCTGetDispatchW3CPointerEvents() is true, the static default is NO, and
  // nothing in this app calls RCTSetDispatchW3CPointerEvents(YES). Left
  // wired for when a config plugin enables that natively; the ellipsis
  // button below is the real mouse/trackpad path to the context menu today.
  const handlePointerDown = (e: {
    nativeEvent: { button?: number; pageX: number; pageY: number };
  }) => {
    if (e.nativeEvent.button === 2) {
      openContextMenu(e.nativeEvent.pageX, e.nativeEvent.pageY);
    }
  };

  const handleMenuPress = () => {
    menuButtonRef.current?.measureInWindow((x, y, _width, height) => {
      openContextMenu(x, y + height);
    });
  };

  const backgroundColor = selected
    ? colors.primary
    : hovered
      ? hexToRgba(colors.text, 0.06)
      : alternatingRows && index % 2 === 1
        ? hexToRgba(colors.text, 0.03)
        : colors.background;

  const textColor = selected ? colors.onAccent : colors.text;
  const secondaryTextColor = selected ? colors.onAccent : colors.textSecondary;
  const downColor = selected ? colors.onAccent : colors.stateDownloading;
  const upColor = selected ? colors.onAccent : colors.stateSeeding;

  return (
    <Pressable
      onPress={() => onSelect(torrent.hash)}
      onLongPress={handleLongPress}
      onPointerDown={handlePointerDown}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={torrent.name}
      style={[styles.row, { backgroundColor }]}
    >
      {/* Name */}
      <View style={[styles.nameCell, { flex: 1, minWidth: NAME_MIN_WIDTH }]}>
        {hasPoster ? (
          <ArtworkThumbnail
            name={torrent.name}
            width={POSTER_SIZE}
            square
            placeholderIcon="film-outline"
            showPlaceholderWhenInactive
          />
        ) : (
          <View style={styles.stateGlyphSlot}>
            <Ionicons name={stateIcon} size={14} color={stateColor} />
          </View>
        )}
        {categoryDotColor && (
          <View style={[styles.categoryDot, { backgroundColor: categoryDotColor }]} />
        )}
        <Text
          style={[styles.cellText, styles.nameText, { color: textColor }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {torrent.name}
        </Text>
      </View>

      {/* Size */}
      <View style={{ width: SIZE_WIDTH }}>
        <Text style={[styles.cellText, styles.numericText, { color: secondaryTextColor }]}>
          {formatSize(totalSize)}
        </Text>
      </View>

      {/* Progress */}
      <View style={[styles.progressCell, { width: PROGRESS_WIDTH }]}>
        <View style={styles.progressBarWrap}>
          <AnimatedProgressBar
            progress={Math.min(100, Math.max(0, progress * 100))}
            color={selected ? colors.onAccent : stateColor}
            height={5}
          />
        </View>
        <Text
          style={[
            styles.cellText,
            styles.numericText,
            styles.progressPercent,
            { color: secondaryTextColor },
          ]}
        >
          {formatProgress(progress, 0)}
        </Text>
      </View>

      {/* Status */}
      <View style={{ width: STATUS_WIDTH }}>
        <StatusBadge label={stateLabel} tint={stateColor} size="desktop" selected={selected} />
      </View>

      {/* Down */}
      <View style={{ width: DOWN_WIDTH }}>
        <Text style={[styles.cellText, styles.numericText, { color: downColor }]}>
          {dlspeed > 0 ? formatSpeed(dlspeed) : ''}
        </Text>
      </View>

      {/* Up */}
      <View style={{ width: UP_WIDTH }}>
        <Text style={[styles.cellText, styles.numericText, { color: upColor }]}>
          {upspeed > 0 ? formatSpeed(upspeed) : ''}
        </Text>
      </View>

      {/* Seeds */}
      <View style={{ width: SEEDS_WIDTH }}>
        <Text style={[styles.cellText, styles.numericText, { color: secondaryTextColor }]}>
          {formatPair(torrent.num_seeds, torrent.num_complete)}
        </Text>
      </View>

      {/* Peers */}
      <View style={{ width: PEERS_WIDTH }}>
        <Text style={[styles.cellText, styles.numericText, { color: secondaryTextColor }]}>
          {formatPair(torrent.num_leechs, torrent.num_incomplete)}
        </Text>
      </View>

      {/* ETA */}
      <View style={{ width: ETA_WIDTH }}>
        <Text style={[styles.cellText, styles.numericText, { color: secondaryTextColor }]}>
          {etaVisible ? formatTime(torrent.eta) : ''}
        </Text>
      </View>

      {/* Ratio */}
      <View style={{ width: RATIO_WIDTH }}>
        <Text style={[styles.cellText, styles.numericText, { color: secondaryTextColor }]}>
          {formatRatio(torrent.ratio)}
        </Text>
      </View>

      {/* Added */}
      <View style={{ width: ADDED_WIDTH }}>
        <Text style={[styles.cellText, styles.numericText, { color: secondaryTextColor }]}>
          {formatShortDate(torrent.added_on)}
        </Text>
      </View>

      {/* Menu - the real mouse/trackpad path to the context menu (see the
          onPointerDown comment above); mirrors TorrentCard's onMenuPress
          button (measure-in-window anchor, same accessibility label). */}
      <Pressable
        ref={menuButtonRef}
        onPress={(e) => {
          e.stopPropagation?.();
          handleMenuPress();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ width: MENU_WIDTH, alignItems: 'center' }}
        accessibilityRole="button"
        accessibilityLabel={t('actions.torrentMenu')}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color={secondaryTextColor} />
      </Pressable>
    </Pressable>
  );
}

// Every torrent.* field read above must appear here, or the row can go
// stale while its hash stays put (mirrors TorrentCard's comparator).
const TorrentTableRow = React.memo(TorrentTableRowInner, (prev, next) => {
  return (
    prev.torrent.hash === next.torrent.hash &&
    prev.torrent.name === next.torrent.name &&
    prev.torrent.state === next.torrent.state &&
    prev.torrent.progress === next.torrent.progress &&
    prev.torrent.dlspeed === next.torrent.dlspeed &&
    prev.torrent.upspeed === next.torrent.upspeed &&
    prev.torrent.eta === next.torrent.eta &&
    prev.torrent.size === next.torrent.size &&
    prev.torrent.total_size === next.torrent.total_size &&
    prev.torrent.num_seeds === next.torrent.num_seeds &&
    prev.torrent.num_complete === next.torrent.num_complete &&
    prev.torrent.num_leechs === next.torrent.num_leechs &&
    prev.torrent.num_incomplete === next.torrent.num_incomplete &&
    prev.torrent.ratio === next.torrent.ratio &&
    prev.torrent.added_on === next.torrent.added_on &&
    prev.torrent.category === next.torrent.category &&
    prev.index === next.index &&
    prev.selected === next.selected &&
    prev.alternatingRows === next.alternatingRows &&
    prev.categoryColors === next.categoryColors &&
    prev.onSelect === next.onSelect &&
    prev.onContextMenu === next.onContextMenu
  );
});

export function TorrentTable({
  torrents,
  selectedHash,
  onSelect,
  onContextMenu,
  sortBy,
  sortDirection,
  onSortChange,
  alternatingRows,
  categoryColors,
  topInset = 0,
}: TorrentTableProps) {
  return (
    <ScrollView
      horizontal
      testID="torrent-table-hscroll"
      style={[styles.hScroll, topInset ? { paddingTop: topInset } : null]}
      contentContainerStyle={styles.hScrollContent}
      showsHorizontalScrollIndicator
    >
      <View style={[styles.tableContainer, { minWidth: TABLE_MIN_WIDTH }]}>
        <TableHeader sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} />
        <FlatList
          data={torrents}
          keyExtractor={(item) => item.hash}
          style={styles.list}
          renderItem={({ item, index }) => (
            <TorrentTableRow
              torrent={item}
              index={index}
              selected={item.hash === selectedHash}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              alternatingRows={alternatingRows}
              categoryColors={categoryColors}
            />
          )}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScroll: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  hScrollContent: {
    flexGrow: 1,
  },
  tableContainer: {
    flexGrow: 1,
    flexDirection: 'column',
  },
  list: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HEADER_HEIGHT,
    borderBottomWidth: METRICS.hairline,
    paddingHorizontal: ROW_PADDING_HORIZONTAL,
    gap: COLUMN_GAP,
  },
  headerCellWrap: {
    height: '100%',
    justifyContent: 'center',
  },
  headerCellContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: METRICS.tableHeaderFontSize,
    fontWeight: '500',
  },
  headerChevron: {
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingHorizontal: ROW_PADDING_HORIZONTAL,
    gap: COLUMN_GAP,
  },
  nameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  cellText: {
    fontSize: METRICS.tableFontSize,
  },
  nameText: {
    flex: 1,
    minWidth: 0,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateGlyphSlot: {
    width: POSTER_SIZE,
    height: POSTER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numericText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  progressCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PROGRESS_GAP,
  },
  progressBarWrap: {
    width: PROGRESS_BAR_WIDTH,
  },
  progressPercent: {
    width: PROGRESS_PERCENT_WIDTH,
  },
});
