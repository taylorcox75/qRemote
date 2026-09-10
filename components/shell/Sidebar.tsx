/**
 * Sidebar.tsx - Desktop/iPad shell sidebar (Phase B), modelled on Pogona's
 * FilterSidebar: a scrollable list of destinations, status filters,
 * categories and tags, each section collapsible via a chevron header.
 * Only rendered on 'regular'/'mac' layouts - 'compact' (iPhone) screens
 * never mount this component.
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
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
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
  return (
    <View>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={onToggle}
        // sectionHeader keeps its compact 28pt visual height; hitSlop pads
        // the actual touch target out to the iPadOS HIG 44pt minimum.
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={12}
          color={colors.textSecondary}
        />
        <Text style={[typography.label, styles.sectionTitle, { color: colors.textSecondary }]}>
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
  count?: number;
  active?: boolean;
  onPress: () => void;
}

function Row({ label, icon, iconColor, count, active, onPress }: RowProps) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const backgroundColor = active
    ? colors.primaryOpac
    : hovered
      ? colors.surfaceOutline
      : 'transparent';
  return (
    <Pressable
      style={[styles.row, { backgroundColor }]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={16}
          color={active ? colors.primary : (iconColor ?? colors.textSecondary)}
          style={styles.rowIcon}
        />
      )}
      <Text
        style={[typography.body, styles.rowLabel, { color: active ? colors.primary : colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count !== undefined && (
        <Text style={[typography.captionMedium, { color: colors.textSecondary }]}>{count}</Text>
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
              <ServerIconBadge server={currentServer} size={32} />
              <Text
                style={[typography.smallSemibold, styles.serverName, { color: colors.text }]}
                numberOfLines={1}
              >
                {currentServer.name}
              </Text>
            </>
          ) : (
            <View style={styles.serverName} />
          )}
          {idiom === 'mac' && (
            <Pressable
              onPress={toggleSidebar}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('sidebar.collapse')}
            >
              <Ionicons name="chevron-back-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            active={listFilter.category === null}
            onPress={() => selectCategory(null)}
          />
          {uncategorizedCount > 0 && (
            <Row
              label={t('filters.uncategorized')}
              icon="folder-outline"
              count={uncategorizedCount}
              active={listFilter.category === ''}
              onPress={() => selectCategory('')}
            />
          )}
          {categoryNames.map((name) => (
            <Row
              key={name}
              label={name}
              icon="folder"
              count={torrents.filter((torrent) => torrent.category === name).length}
              active={listFilter.category === name}
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
              count={untaggedCount}
              active={listFilter.tags.includes(UNTAGGED_FILTER)}
              onPress={() => toggleTag(UNTAGGED_FILTER)}
            />
          )}
          {tagNames.map((tag) => (
            <Row
              key={tag}
              label={tag}
              icon="pricetag"
              count={torrents.filter((torrent) => parseTagsCsv(torrent.tags).includes(tag)).length}
              active={listFilter.tags.includes(tag)}
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
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 28,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.small,
    marginHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  rowIcon: {
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
  },
});
