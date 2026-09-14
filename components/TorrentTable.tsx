/**
 * TorrentTable.tsx - desktop table for the 'regular' (iPad) and 'mac'
 * (Mac Catalyst) layout idioms, mirroring Pogona:
 *   - mac: MacTransfersView.swift transfersTable (dense 13-col, 26pt rows,
 *     28pt square artwork plate)
 *   - regular: TransferListScreen.swift tableView (8-col, 44pt rows)
 *
 * Compact (iPhone) never mounts this component.
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
import { desktopMetrics, type DesktopMetrics } from '@/constants/desktop';
import { hexToRgba } from '@/utils/color';
import type { LayoutIdiom } from '@/hooks/useLayoutIdiom';

type TableIdiom = Exclude<LayoutIdiom, 'compact'>;

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
  topInset?: number;
  /** Defaults to 'mac' so existing call sites and tests stay dense. */
  idiom?: TableIdiom;
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
  | 'added'
  | 'completed'
  | 'seen'
  | 'queue';

interface ColumnDef {
  key: ColumnKey;
  field: SortField | null;
  width?: number;
  minWidth?: number;
  align: 'left' | 'right';
}

const NAME_MIN_WIDTH = 180;
const MENU_WIDTH = 28;
const COLUMN_GAP = spacing.sm;
const ROW_PADDING_HORIZONTAL = spacing.md;
const PROGRESS_BAR_WIDTH = 60;
const PROGRESS_GAP = 4;
const PROGRESS_PERCENT_WIDTH = 40;

const MAC_COLUMNS: ColumnDef[] = [
  { key: 'name', field: 'name', minWidth: NAME_MIN_WIDTH, align: 'left' },
  { key: 'size', field: 'size', width: 80, align: 'right' },
  { key: 'progress', field: 'progress', width: 104, align: 'right' },
  { key: 'status', field: null, width: 100, align: 'left' },
  { key: 'down', field: 'dlspeed', width: 84, align: 'right' },
  { key: 'up', field: 'upspeed', width: 84, align: 'right' },
  { key: 'seeds', field: null, width: 60, align: 'right' },
  { key: 'peers', field: null, width: 60, align: 'right' },
  { key: 'eta', field: null, width: 68, align: 'right' },
  { key: 'ratio', field: 'ratio', width: 52, align: 'right' },
  { key: 'added', field: 'added_on', width: 96, align: 'right' },
  { key: 'completed', field: null, width: 96, align: 'right' },
  { key: 'seen', field: null, width: 96, align: 'right' },
];

const IPAD_COLUMNS: ColumnDef[] = [
  { key: 'name', field: 'name', minWidth: 220, align: 'left' },
  { key: 'status', field: null, width: 120, align: 'left' },
  { key: 'progress', field: 'progress', width: 140, align: 'right' },
  { key: 'down', field: 'dlspeed', width: 84, align: 'right' },
  { key: 'up', field: 'upspeed', width: 84, align: 'right' },
  { key: 'size', field: 'size', width: 80, align: 'right' },
  { key: 'ratio', field: 'ratio', width: 60, align: 'right' },
  { key: 'queue', field: 'priority', width: 48, align: 'right' },
];

function columnsForIdiom(idiom: TableIdiom): ColumnDef[] {
  return idiom === 'regular' ? IPAD_COLUMNS : MAC_COLUMNS;
}

function tableMinWidth(columns: ColumnDef[]): number {
  return columns.reduce((sum, col) => sum + (col.width ?? col.minWidth ?? 0), 0);
}

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

function formatPair(connected: number, total: number): string {
  return `${Math.max(0, connected)} | ${Math.max(0, total)}`;
}

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

function alignToJustify(align: 'left' | 'right'): 'flex-start' | 'flex-end' {
  return align === 'right' ? 'flex-end' : 'flex-start';
}

interface HeaderCellProps {
  column: ColumnDef;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: SortField, direction: 'asc' | 'desc') => void;
  showSeparator: boolean;
  metrics: DesktopMetrics;
}

function HeaderCell({
  column,
  sortBy,
  sortDirection,
  onSortChange,
  showSeparator,
  metrics,
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
      borderRightWidth: metrics.hairline,
      borderRightColor: colors.surfaceOutline,
    },
  ];

  const content = (
    <View style={[styles.headerCellContent, { justifyContent: alignToJustify(column.align) }]}>
      <Text
        style={[
          styles.headerLabel,
          { fontSize: metrics.tableHeaderFontSize, color: colors.textSecondary },
        ]}
        numberOfLines={1}
      >
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

interface TableHeaderProps {
  columns: ColumnDef[];
  metrics: DesktopMetrics;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: SortField, direction: 'asc' | 'desc') => void;
}

function TableHeader({ columns, metrics, sortBy, sortDirection, onSortChange }: TableHeaderProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.headerRow,
        {
          height: metrics.tableHeaderHeight,
          backgroundColor: colors.background,
          borderBottomColor: hexToRgba(colors.text, 0.08),
          borderBottomWidth: metrics.hairline,
        },
      ]}
    >
      {columns.map((column, index) => (
        <HeaderCell
          key={column.key}
          column={column}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          showSeparator={index !== columns.length - 1}
          metrics={metrics}
        />
      ))}
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
  columns: ColumnDef[];
  metrics: DesktopMetrics;
}

function cellSizeStyle(column: ColumnDef) {
  return column.width ? { width: column.width } : { flex: 1, minWidth: column.minWidth };
}

function TorrentTableRowInner({
  torrent,
  index,
  selected,
  onSelect,
  onContextMenu,
  alternatingRows,
  categoryColors,
  columns,
  metrics,
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
  const posterSize = metrics.tableArtworkSize;

  const openContextMenu = (x: number, y: number) => {
    onContextMenu(torrent.hash, { x, y });
  };

  const handleLongPress = (e: GestureResponderEvent) => {
    openContextMenu(e.nativeEvent.pageX, e.nativeEvent.pageY);
  };

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
    ? hexToRgba(colors.text, 0.08)
    : hovered
      ? hexToRgba(colors.text, 0.05)
      : alternatingRows && index % 2 === 1
        ? hexToRgba(colors.text, 0.03)
        : colors.background;

  const textColor = colors.text;
  const secondaryTextColor = colors.textSecondary;
  const downColor = colors.stateDownloading;
  const upColor = colors.stateSeeding;
  const numericStyle = [
    styles.cellText,
    styles.numericText,
    { fontSize: metrics.tableFontSize, color: secondaryTextColor },
  ];

  const renderCell = (column: ColumnDef) => {
    const wrap = { ...cellSizeStyle(column) };
    switch (column.key) {
      case 'name':
        return (
          <View key={column.key} style={[styles.nameCell, wrap]}>
            {hasPoster ? (
              <ArtworkThumbnail
                name={torrent.name}
                width={posterSize}
                square
                placeholderIcon="film-outline"
                showPlaceholderWhenInactive
              />
            ) : (
              <View style={[styles.stateGlyphSlot, { width: posterSize, height: posterSize }]}>
                <Ionicons name={stateIcon} size={Math.round(posterSize * 0.5)} color={stateColor} />
              </View>
            )}
            {categoryDotColor && (
              <View style={[styles.categoryDot, { backgroundColor: categoryDotColor }]} />
            )}
            <Text
              style={[
                styles.cellText,
                styles.nameText,
                { fontSize: metrics.tableFontSize, color: textColor },
              ]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {torrent.name}
            </Text>
          </View>
        );
      case 'size':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>{formatSize(totalSize)}</Text>
          </View>
        );
      case 'progress':
        return (
          <View key={column.key} style={[styles.progressCell, wrap]}>
            <View style={styles.progressBarWrap}>
              <AnimatedProgressBar
                progress={Math.min(100, Math.max(0, progress * 100))}
                color={selected ? colors.onAccent : stateColor}
                height={5}
              />
            </View>
            <Text style={[numericStyle, styles.progressPercent]}>
              {formatProgress(progress, 0)}
            </Text>
          </View>
        );
      case 'status':
        return (
          <View key={column.key} style={wrap}>
            <StatusBadge label={stateLabel} tint={stateColor} size="desktop" />
          </View>
        );
      case 'down':
        return (
          <View key={column.key} style={wrap}>
            <Text
              style={[
                styles.cellText,
                styles.numericText,
                { fontSize: metrics.tableFontSize, color: downColor },
              ]}
            >
              {dlspeed > 0 ? formatSpeed(dlspeed) : ''}
            </Text>
          </View>
        );
      case 'up':
        return (
          <View key={column.key} style={wrap}>
            <Text
              style={[
                styles.cellText,
                styles.numericText,
                { fontSize: metrics.tableFontSize, color: upColor },
              ]}
            >
              {upspeed > 0 ? formatSpeed(upspeed) : ''}
            </Text>
          </View>
        );
      case 'seeds':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>{formatPair(torrent.num_seeds, torrent.num_complete)}</Text>
          </View>
        );
      case 'peers':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>
              {formatPair(torrent.num_leechs, torrent.num_incomplete)}
            </Text>
          </View>
        );
      case 'eta':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>{etaVisible ? formatTime(torrent.eta) : ''}</Text>
          </View>
        );
      case 'ratio':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>{formatRatio(torrent.ratio)}</Text>
          </View>
        );
      case 'added':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>{formatShortDate(torrent.added_on)}</Text>
          </View>
        );
      case 'completed':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>{formatShortDate(torrent.completion_on)}</Text>
          </View>
        );
      case 'seen':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>{formatShortDate(torrent.seen_complete)}</Text>
          </View>
        );
      case 'queue':
        return (
          <View key={column.key} style={wrap}>
            <Text style={numericStyle}>
              {torrent.priority > 0 ? String(torrent.priority) : '-'}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Pressable
      onPress={() => onSelect(torrent.hash)}
      onLongPress={handleLongPress}
      onPointerDown={handlePointerDown}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={torrent.name}
      style={[styles.row, { height: metrics.tableRowHeight, backgroundColor }]}
    >
      {columns.map(renderCell)}
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
    prev.torrent.completion_on === next.torrent.completion_on &&
    prev.torrent.seen_complete === next.torrent.seen_complete &&
    prev.torrent.priority === next.torrent.priority &&
    prev.torrent.category === next.torrent.category &&
    prev.index === next.index &&
    prev.selected === next.selected &&
    prev.alternatingRows === next.alternatingRows &&
    prev.categoryColors === next.categoryColors &&
    prev.columns === next.columns &&
    prev.metrics === next.metrics &&
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
  idiom = 'mac',
}: TorrentTableProps) {
  const metrics = desktopMetrics(idiom);
  const columns = columnsForIdiom(idiom);
  const minWidth = tableMinWidth(columns) + MENU_WIDTH + ROW_PADDING_HORIZONTAL * 2;

  return (
    <ScrollView
      horizontal
      testID="torrent-table-hscroll"
      style={[styles.hScroll, topInset ? { paddingTop: topInset } : null]}
      contentContainerStyle={styles.hScrollContent}
      showsHorizontalScrollIndicator
    >
      <View style={[styles.tableContainer, { minWidth }]}>
        <TableHeader
          columns={columns}
          metrics={metrics}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
        />
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
              columns={columns}
              metrics={metrics}
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
    fontWeight: '500',
  },
  headerChevron: {
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PADDING_HORIZONTAL,
    gap: COLUMN_GAP,
  },
  nameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  cellText: {},
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
