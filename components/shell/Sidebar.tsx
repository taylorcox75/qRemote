/**
 * Sidebar.tsx - Desktop/iPad shell sidebar (Phase B), modelled on Pogona's
 * FilterSidebar: a scrollable list of destinations, status filters,
 * categories and tags, each section collapsible via a chevron header.
 * Only rendered on 'regular'/'mac' layouts - 'compact' (iPhone) screens
 * never mount this component.
 *
 * Sizing/typography come from desktopMetrics(idiom) (constants/desktop.ts)
 * so mac reads as stock macOS (13pt/26pt rows, 11pt caps section headers,
 * solid accent selection) and regular keeps iPadOS conventions (17pt/44pt
 * rows, tint-fill selection). Selection/hover styling is idiom-specific, and
 * on mac also depends on the row's Row.variant:
 * - mac 'solid' (destinations only) - solid colors.primary fill with
 *   onAccent text/icon/count. Only one destination row is ever active, so
 *   this is the sole solid-fill row on screen at a time.
 * - mac 'quiet' (status/category/tag filters) - a quiet selection instead of
 *   a second solid fill: hexToRgba(colors.text, 0.08) background,
 *   colors.text label, colors.textSecondary count, the icon keeps its normal
 *   state tint (not overridden), plus a 3pt colors.primary bar at the row's
 *   left edge inside the rounded highlight (Finder-style tag emphasis).
 * - regular ignores variant entirely: colors.primaryOpac fill with
 *   colors.primary text/icon for both destinations and filters, no hover
 *   (touch has no hover state).
 * mac also gets a subtle hover wash regardless of variant.
 *
 * Key exports: Sidebar
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { useShell } from '@/context/ShellContext';
import { useTorrents } from '@/context/TorrentContext';
import { useServer } from '@/context/ServerContext';
import { applicationApi } from '@/services/api/application';
import { ServerIconBadge } from '@/components/ServerIconBadge';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { desktopMetrics } from '@/constants/desktop';
import { hexToRgba } from '@/utils/color';
import { STATUS_FILTER_IDS, matchesStatusFilter, StatusFilterId } from '@/utils/torrent-filters';
import { parseTagsCsv, UNTAGGED_FILTER } from '@/utils/tags';

interface SidebarProps {
  style?: ViewStyle;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface DestinationDef {
  key: 'torrents' | 'transfer' | 'search' | 'rss' | 'settings';
  route: string;
  labelKey: string;
  icon: IoniconName;
  activeIcon: IoniconName;
}

const DESTINATIONS: DestinationDef[] = [
  {
    key: 'torrents',
    route: '/(tabs)/(torrents)',
    labelKey: 'screens.torrents.tabTitle',
    icon: 'list-outline',
    activeIcon: 'list',
  },
  {
    key: 'transfer',
    route: '/(tabs)/transfer',
    labelKey: 'screens.transfer.title',
    icon: 'speedometer-outline',
    activeIcon: 'speedometer',
  },
  {
    key: 'search',
    route: '/(tabs)/search',
    labelKey: 'screens.search.tabTitle',
    icon: 'search-outline',
    activeIcon: 'search',
  },
  {
    key: 'rss',
    route: '/(tabs)/rss',
    labelKey: 'screens.rss.feedsTitle',
    icon: 'logo-rss',
    activeIcon: 'logo-rss',
  },
  {
    key: 'settings',
    route: '/(tabs)/settings',
    labelKey: 'screens.settings.title',
    icon: 'settings-outline',
    activeIcon: 'settings',
  },
];

/** Icon glyph per status filter - same set index.tsx's filterOptions uses. */
const STATUS_FILTER_ICONS: Record<StatusFilterId, IoniconName> = {
  all: 'grid-outline',
  active: 'pulse',
  completed: 'checkmark-circle',
  paused: 'pause-circle',
  stuck: 'warning',
  downloading: 'arrow-down',
  uploading: 'arrow-up',
};

/**
 * Tint per status filter. Filters with a direct analogue in torrent state
 * use that colors.state* token (downloading/uploading/paused/stuck mirror
 * their qBittorrent state family 1:1; completed reuses stateSeeding, the
 * same "done" color torrent-state.ts converges completed torrents toward).
 * 'all' and 'active' have no single-state analogue - they're deliberately
 * generic (textSecondary / primary) rather than borrowing an unrelated
 * state color.
 */
function statusFilterTint(id: StatusFilterId, colors: ReturnType<typeof useTheme>['colors']) {
  switch (id) {
    case 'downloading':
      return colors.stateDownloading;
    case 'uploading':
      return colors.stateUploadOnly;
    case 'paused':
      return colors.statePaused;
    case 'stuck':
      return colors.stateStalled;
    case 'completed':
      return colors.stateSeeding;
    case 'active':
      return colors.primary;
    case 'all':
    default:
      return colors.textSecondary;
  }
}

function isDestinationActive(pathname: string, key: DestinationDef['key']): boolean {
  switch (key) {
    case 'torrents':
      return (
        pathname === '/' || pathname.startsWith('/torrent/') || pathname.startsWith('/torrents/')
      );
    case 'transfer':
      return pathname.startsWith('/transfer');
    case 'search':
      return pathname.startsWith('/search');
    case 'rss':
      return pathname.startsWith('/rss');
    case 'settings':
      return pathname.startsWith('/settings');
    default:
      return false;
  }
}

interface SectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, expanded, onToggle, children }: SectionProps) {
  const { colors } = useTheme();
  const { idiom } = useShell();
  const metrics = desktopMetrics(idiom);
  return (
    <View>
      <TouchableOpacity
        style={[
          styles.sectionHeader,
          {
            height: metrics.sectionHeaderHeight,
            paddingHorizontal: metrics.sidebarInsetHorizontal,
          },
        ]}
        onPress={onToggle}
        // sectionHeader keeps its metrics-driven visual height (mac 22pt /
        // regular 32pt); hitSlop pads the actual touch target out to the
        // iPadOS HIG 44pt minimum on regular (mac's own 22pt row is already
        // within Apple's pointer-target guidance).
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={idiom === 'mac' ? 10 : 12}
          color={colors.textSecondary}
        />
        <Text
          style={[
            typography.label,
            styles.sectionTitle,
            {
              fontSize: metrics.sectionHeaderFontSize,
              letterSpacing: 0.5,
              color: colors.textSecondary,
            },
          ]}
        >
          {title}
        </Text>
      </TouchableOpacity>
      {expanded && children}
    </View>
  );
}

interface RowProps {
  label: string;
  icon?: IoniconName;
  iconColor?: string;
  /** Overrides metrics.sidebarIconSize - used for category dots / tag icons. */
  iconSize?: number;
  count?: number;
  active?: boolean;
  /**
   * 'solid' (default) is the destination look: on mac a solid colors.primary
   * fill with onAccent text/icon/count. 'quiet' is the status/category/tag
   * filter look: on mac a hexToRgba(colors.text, 0.08) wash with colors.text
   * label, the icon's normal state tint kept as-is, and a 3pt colors.primary
   * bar at the row's left edge instead of a second solid fill. Ignored on
   * regular, which always uses colors.primaryOpac + colors.primary text/icon.
   */
  variant?: 'solid' | 'quiet';
  onPress: () => void;
}

function Row({
  label,
  icon,
  iconColor,
  iconSize,
  count,
  active,
  variant = 'solid',
  onPress,
}: RowProps) {
  const { colors } = useTheme();
  const { idiom } = useShell();
  const metrics = desktopMetrics(idiom);
  const isMac = idiom === 'mac';
  const isQuiet = isMac && variant === 'quiet';
  const [hovered, setHovered] = useState(false);

  const backgroundColor = active
    ? isMac
      ? isQuiet
        ? hexToRgba(colors.text, 0.08)
        : colors.primary
      : colors.primaryOpac
    : hovered && isMac
      ? hexToRgba(colors.text, 0.06)
      : 'transparent';

  const activeContentColor = isMac ? colors.onAccent : colors.primary;
  const labelColor = active ? (isQuiet ? colors.text : activeContentColor) : colors.text;
  const rowIconColor =
    active && !isQuiet ? activeContentColor : (iconColor ?? colors.textSecondary);
  const countColor = active && isMac && !isQuiet ? colors.onAccent : colors.textSecondary;

  return (
    <Pressable
      style={[
        styles.row,
        {
          height: metrics.sidebarRowHeight,
          paddingHorizontal: metrics.sidebarInsetHorizontal,
          marginHorizontal: metrics.sidebarRowMargin,
          borderRadius: metrics.selectionRadius,
          backgroundColor,
        },
      ]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {active && isQuiet && (
        <View
          style={[
            styles.filterBar,
            {
              backgroundColor: colors.primary,
              borderTopLeftRadius: metrics.selectionRadius,
              borderBottomLeftRadius: metrics.selectionRadius,
            },
          ]}
        />
      )}
      {icon && (
        <Ionicons
          name={icon}
          size={iconSize ?? metrics.sidebarIconSize}
          color={rowIconColor}
          style={styles.rowIcon}
        />
      )}
      <Text
        style={[
          typography.body,
          styles.rowLabel,
          { fontSize: metrics.sidebarFontSize, color: labelColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count !== undefined && (
        <Text
          style={[
            typography.captionMedium,
            styles.rowCount,
            { fontSize: metrics.sectionHeaderFontSize, color: countColor },
          ]}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}

export function Sidebar({ style }: SidebarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { idiom, listFilter, setListFilter, toggleSidebar } = useShell();
  const { torrents, categories, tags } = useTorrents();
  const { currentServer, isConnected } = useServer();
  const metrics = desktopMetrics(idiom);
  const isMac = idiom === 'mac';
  // Category dots / tag icons read a dedicated size, not metrics.sidebarIconSize
  // (which sizes the destination/status glyphs): 8pt on mac, 15pt on regular.
  const categoryTagIconSize = metrics.sidebarCategoryIconSize;

  const preferencesQuery = useQuery({
    queryKey: ['application', 'preferences'],
    queryFn: () => applicationApi.getPreferences(),
    enabled: isConnected,
    staleTime: 30_000,
  });
  const showRss = isConnected && preferencesQuery.data?.rss_processing_enabled === true;

  const [destinationsExpanded, setDestinationsExpanded] = useState(true);
  const [statusExpanded, setStatusExpanded] = useState(true);
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);

  const visibleDestinations = DESTINATIONS.filter((d) => d.key !== 'rss' || showRss);

  const categoryNames = Object.keys(categories).sort((a, b) => a.localeCompare(b));
  const tagNames = [...tags].sort((a, b) => a.localeCompare(b));
  const uncategorizedCount = torrents.filter((torrent) => !torrent.category).length;
  const untaggedCount = torrents.filter(
    (torrent) => parseTagsCsv(torrent.tags).length === 0,
  ).length;

  const selectStatus = (id: StatusFilterId) => {
    setListFilter({ ...listFilter, status: id });
    router.navigate('/(tabs)/(torrents)');
  };

  const selectCategory = (category: string | null) => {
    setListFilter({
      ...listFilter,
      category: listFilter.category === category ? null : category,
    });
    router.navigate('/(tabs)/(torrents)');
  };

  const toggleTag = (tag: string) => {
    const isSelected = listFilter.tags.includes(tag);
    setListFilter({
      ...listFilter,
      tags: isSelected ? listFilter.tags.filter((t) => t !== tag) : [...listFilter.tags, tag],
    });
    router.navigate('/(tabs)/(torrents)');
  };

  // Mac keeps the header (and its collapse chevron) visible even while
  // disconnected - Pogona's transfersTable always has a titlebar. Regular
  // (iPad) keeps the pre-existing behaviour untouched: no header at all
  // until a server is connected, and no chevron - the sidebar toggle for
  // regular already lives in the torrents list header (index.tsx,
  // idiom !== 'compact'); a second one here would duplicate that control.
  const showServerHeader = idiom === 'mac' || !!currentServer;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }, style]}>
      {showServerHeader && (
        <View style={[styles.serverHeader, { borderBottomColor: colors.surfaceOutline }]}>
          {currentServer ? (
            <>
              <ServerIconBadge server={currentServer} size={metrics.sidebarServerBadgeSize} />
              <Text
                style={[
                  typography.smallSemibold,
                  styles.serverName,
                  { fontSize: metrics.sidebarFontSize, color: colors.text },
                ]}
                numberOfLines={1}
              >
                {currentServer.name}
              </Text>
            </>
          ) : (
            <View style={styles.serverName} />
          )}
          {isMac && (
            <Pressable
              onPress={toggleSidebar}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('sidebar.collapse')}
            >
              <Ionicons
                name="chevron-back-outline"
                size={metrics.sidebarCollapseIconSize}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, isMac && styles.scrollContentMac]}
      >
        <Section
          title={t('sidebar.sections.destinations')}
          expanded={destinationsExpanded}
          onToggle={() => setDestinationsExpanded((prev) => !prev)}
        >
          {visibleDestinations.map((destination) => {
            const active = isDestinationActive(pathname, destination.key);
            return (
              <Row
                key={destination.key}
                label={t(destination.labelKey)}
                icon={active ? destination.activeIcon : destination.icon}
                active={active}
                onPress={() => router.navigate(destination.route)}
              />
            );
          })}
        </Section>

        <Section
          title={t('sidebar.sections.status')}
          expanded={statusExpanded}
          onToggle={() => setStatusExpanded((prev) => !prev)}
        >
          {STATUS_FILTER_IDS.map((id) => (
            <Row
              key={id}
              label={t(`filters.${id}`)}
              icon={STATUS_FILTER_ICONS[id]}
              iconColor={statusFilterTint(id, colors)}
              count={torrents.filter((torrent) => matchesStatusFilter(torrent, id)).length}
              active={listFilter.status === id}
              variant="quiet"
              onPress={() => selectStatus(id)}
            />
          ))}
        </Section>

        <Section
          title={t('sidebar.sections.categories')}
          expanded={categoriesExpanded}
          onToggle={() => setCategoriesExpanded((prev) => !prev)}
        >
          <Row
            label={t('filters.allCategories')}
            icon="folder-outline"
            iconSize={categoryTagIconSize}
            active={listFilter.category === null}
            variant="quiet"
            onPress={() => selectCategory(null)}
          />
          {uncategorizedCount > 0 && (
            <Row
              label={t('filters.uncategorized')}
              icon="folder-outline"
              iconSize={categoryTagIconSize}
              count={uncategorizedCount}
              active={listFilter.category === ''}
              variant="quiet"
              onPress={() => selectCategory('')}
            />
          )}
          {categoryNames.map((name) => (
            <Row
              key={name}
              label={name}
              icon="folder"
              iconSize={categoryTagIconSize}
              count={torrents.filter((torrent) => torrent.category === name).length}
              active={listFilter.category === name}
              variant="quiet"
              onPress={() => selectCategory(name)}
            />
          ))}
        </Section>

        <Section
          title={t('sidebar.sections.tags')}
          expanded={tagsExpanded}
          onToggle={() => setTagsExpanded((prev) => !prev)}
        >
          {untaggedCount > 0 && (
            <Row
              label={t('filters.untagged')}
              icon="pricetag-outline"
              iconSize={categoryTagIconSize}
              count={untaggedCount}
              active={listFilter.tags.includes(UNTAGGED_FILTER)}
              variant="quiet"
              onPress={() => toggleTag(UNTAGGED_FILTER)}
            />
          )}
          {tagNames.map((tag) => (
            <Row
              key={tag}
              label={tag}
              icon="pricetag"
              iconSize={categoryTagIconSize}
              count={torrents.filter((torrent) => parseTagsCsv(torrent.tags).includes(tag)).length}
              active={listFilter.tags.includes(tag)}
              variant="quiet"
              onPress={() => toggleTag(tag)}
            />
          ))}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  serverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  serverName: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  // Mac's sidebar is a denser column that can overflow the window sooner
  // than regular's; Pogona-style sidebars use a tight 8pt bottom gutter
  // rather than spacing.xl's roomier iPad-derived padding.
  scrollContentMac: {
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  filterBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  rowIcon: {
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
  },
  rowCount: {
    fontVariant: ['tabular-nums'],
  },
});
