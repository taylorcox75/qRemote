/**
 * DesktopToolbar.tsx - single-row desktop toolbar replacing the phone's
 * absolutely-positioned search/sort header on the 'regular' (iPad) and
 * 'mac' (Mac Catalyst) layout idioms, mirroring Pogona's stock-macOS
 * toolbar: one metrics.toolbarHeight row, small icon buttons with a hover
 * wash (no pills, nothing floats), and a compact search field on the
 * right. Settings and Add already live in the sidebar / File menu on
 * desktop; this toolbar only owns search, sort, add and select-mode -
 * status/category/tag filters are owned by components/shell/Sidebar.tsx,
 * not this toolbar.
 *
 * Only rendered on 'regular'/'mac' - the iPhone ('compact') layout keeps
 * its own Animated header in app/(tabs)/(torrents)/index.tsx untouched.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { desktopMetrics } from '@/constants/desktop';
import { hexToRgba } from '@/utils/color';
import { spacing, borderRadius } from '@/constants/spacing';
import type { LayoutIdiom } from '@/hooks/useLayoutIdiom';
import type { SortField } from '@/types/preferences';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Mirrors app/(tabs)/(torrents)/index.tsx's `sortOptions` labelKeys (the
// 'sort' translation namespace) - keep the two in sync when a sort field
// is added, renamed or removed.
const SORT_LABEL_KEYS: Record<SortField, string> = {
  added_on: 'sort.dateAdded',
  name: 'sort.name',
  size: 'sort.size',
  progress: 'sort.progress',
  ratio: 'sort.ulRatio',
  priority: 'sort.priority',
  dlspeed: 'sort.dlSpeed',
  upspeed: 'sort.ulSpeed',
};

export interface DesktopToolbarProps {
  /** Never 'compact' - the caller only mounts this on regular/mac. */
  idiom: Exclude<LayoutIdiom, 'compact'>;
  /** Active filter label, e.g. the torrents-list status filter name. */
  title?: string;
  /** Visible torrent count for the active filter/search. */
  resultCount?: number;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  /** Opens the same sort menu the phone's sort button opens. */
  onSortPress: () => void;
  onAddPress: () => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
  /** Shared with the mac idiom's Find (Cmd+F) menu command. */
  searchInputRef: React.RefObject<TextInput | null>;
  /**
   * Sidebar collapse toggle, rendered only on 'regular' - the only place
   * left to reach it now that the compact header's own chevron (which used
   * to double as the collapse control on regular/mac both) is compact-only.
   * 'mac' is deliberately skipped: components/shell/Sidebar.tsx already has
   * its own chevron in that idiom's server header, so a second one here
   * would just duplicate it - matching regular is the one idiom that would
   * otherwise have no way to collapse the sidebar at all.
   */
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  hasSelection?: boolean;
  onDeletePress?: () => void;
  onResumePress?: () => void;
  onPausePress?: () => void;
  onQueueTopPress?: () => void;
  onQueueUpPress?: () => void;
  onQueueDownPress?: () => void;
  onQueueBottomPress?: () => void;
  onAltSpeedPress?: () => void;
  altSpeedActive?: boolean;
  onRecheckPress?: () => void;
  onReannouncePress?: () => void;
}

interface ToolbarIconButtonProps {
  icon: IoniconName;
  iconSize: number;
  buttonSize: number;
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  disabled?: boolean;
  active?: boolean;
}

function ToolbarIconButton({
  icon,
  iconSize,
  buttonSize,
  onPress,
  accessibilityLabel,
  selected,
  disabled,
  active,
}: ToolbarIconButtonProps) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={[
        styles.iconButton,
        { width: buttonSize, height: buttonSize, opacity: disabled ? 0.35 : 1 },
        hovered && !disabled && { backgroundColor: hexToRgba(colors.text, 0.08) },
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={active ? colors.warning : colors.text} />
    </Pressable>
  );
}

function ToolbarDivider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

function SortControl({
  idiom,
  sortBy,
  buttonSize,
  iconSize,
  onPress,
}: {
  idiom: DesktopToolbarProps['idiom'];
  sortBy: SortField;
  buttonSize: number;
  iconSize: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const metrics = desktopMetrics(idiom);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={t('screens.settings.sortBy')}
      style={[
        styles.sortControl,
        { height: buttonSize, paddingHorizontal: idiom === 'mac' ? spacing.xs : 0 },
        hovered && { backgroundColor: hexToRgba(colors.text, 0.08) },
      ]}
    >
      <Ionicons name="swap-vertical" size={iconSize} color={colors.text} />
      {idiom === 'mac' && (
        <Text
          style={[
            styles.sortLabel,
            { fontSize: metrics.sectionHeaderFontSize, color: colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {t(SORT_LABEL_KEYS[sortBy])}
        </Text>
      )}
    </Pressable>
  );
}

export function DesktopToolbar({
  idiom,
  title,
  resultCount,
  searchQuery,
  onSearchChange,
  onClearSearch,
  sortBy,
  onSortPress,
  onAddPress,
  selectMode,
  onToggleSelectMode,
  searchInputRef,
  sidebarCollapsed,
  onToggleSidebar,
  hasSelection = false,
  onDeletePress,
  onResumePress,
  onPausePress,
  onQueueTopPress,
  onQueueUpPress,
  onQueueDownPress,
  onQueueBottomPress,
  onAltSpeedPress,
  altSpeedActive = false,
  onRecheckPress,
  onReannouncePress,
}: DesktopToolbarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const metrics = desktopMetrics(idiom);
  const isMac = idiom === 'mac';

  return (
    <View
      style={[
        styles.bar,
        {
          height: isMac ? metrics.titlebarHeight : metrics.toolbarHeight,
          paddingLeft: isMac && sidebarCollapsed ? metrics.trafficLightsWidth : undefined,
          backgroundColor: colors.background,
          borderBottomColor: hexToRgba(colors.text, 0.08),
          borderBottomWidth: isMac ? 0 : metrics.hairline,
        },
      ]}
    >
      <View style={styles.left}>
        {idiom === 'regular' && (
          <ToolbarIconButton
            icon={sidebarCollapsed ? 'chevron-forward-outline' : 'chevron-back-outline'}
            iconSize={metrics.toolbarIconSize}
            buttonSize={metrics.toolbarControlHeight}
            onPress={onToggleSidebar}
            accessibilityLabel={t(sidebarCollapsed ? 'sidebar.expand' : 'sidebar.collapse')}
          />
        )}
        {title !== undefined && (
          <Text
            style={[
              isMac ? styles.titleMac : styles.titleRegular,
              { fontSize: metrics.toolbarFontSize, color: colors.text },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {resultCount !== undefined && (
          <Text
            style={[
              styles.count,
              { fontSize: metrics.sectionHeaderFontSize, color: colors.textSecondary },
            ]}
          >
            {resultCount}
          </Text>
        )}
        {isMac && (
          <View style={styles.chrome}>
            <ToolbarIconButton
              icon="add"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onAddPress}
              accessibilityLabel={t('screens.torrents.addTorrent')}
            />
            <ToolbarIconButton
              icon="trash-outline"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onDeletePress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('common.delete')}
            />
            <ToolbarDivider color={colors.surfaceOutline} />
            <ToolbarIconButton
              icon="play"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onResumePress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('actions.resume')}
            />
            <ToolbarIconButton
              icon="pause"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onPausePress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('actions.pause')}
            />
            <ToolbarDivider color={colors.surfaceOutline} />
            <ToolbarIconButton
              icon="play-skip-back"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onQueueTopPress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('commands.queueTop')}
            />
            <ToolbarIconButton
              icon="chevron-up"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onQueueUpPress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('commands.queueUp')}
            />
            <ToolbarIconButton
              icon="chevron-down"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onQueueDownPress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('commands.queueDown')}
            />
            <ToolbarIconButton
              icon="play-skip-forward"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onQueueBottomPress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('commands.queueBottom')}
            />
            <ToolbarDivider color={colors.surfaceOutline} />
            <ToolbarIconButton
              icon={altSpeedActive ? 'speedometer' : 'speedometer-outline'}
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onAltSpeedPress ?? (() => {})}
              active={altSpeedActive}
              accessibilityLabel={
                altSpeedActive ? t('statusBar.toggleAltSpeedOff') : t('statusBar.toggleAltSpeedOn')
              }
            />
            <ToolbarIconButton
              icon="refresh-outline"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onRecheckPress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('actions.recheck')}
            />
            <ToolbarIconButton
              icon="megaphone-outline"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onReannouncePress ?? (() => {})}
              disabled={!hasSelection}
              accessibilityLabel={t('actions.reannounce')}
            />
          </View>
        )}
        {!isMac && hasSelection && (
          <View style={styles.chrome}>
            <ToolbarIconButton
              icon="play"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onResumePress ?? (() => {})}
              accessibilityLabel={t('actions.resume')}
            />
            <ToolbarIconButton
              icon="pause"
              iconSize={metrics.toolbarIconSize}
              buttonSize={metrics.toolbarControlHeight}
              onPress={onPausePress ?? (() => {})}
              accessibilityLabel={t('actions.pause')}
            />
          </View>
        )}
      </View>

      <View style={styles.right}>
        {!isMac && (
          <ToolbarIconButton
            icon={selectMode ? 'close' : 'checkmark-circle-outline'}
            iconSize={metrics.toolbarIconSize}
            buttonSize={metrics.toolbarControlHeight}
            selected={selectMode}
            onPress={onToggleSelectMode}
            accessibilityLabel={selectMode ? t('common.close') : t('screens.torrents.selectMode')}
          />
        )}

        <SortControl
          idiom={idiom}
          sortBy={sortBy}
          buttonSize={metrics.toolbarControlHeight}
          iconSize={metrics.toolbarIconSize}
          onPress={onSortPress}
        />

        {!isMac && !selectMode && (
          <ToolbarIconButton
            icon="add"
            iconSize={metrics.toolbarIconSize}
            buttonSize={metrics.toolbarControlHeight}
            onPress={onAddPress}
            accessibilityLabel={t('screens.torrents.addTorrent')}
          />
        )}

        <View
          style={[
            styles.searchField,
            {
              width: metrics.searchFieldWidth,
              height: metrics.toolbarControlHeight,
              backgroundColor: hexToRgba(colors.text, 0.06),
            },
          ]}
        >
          <Ionicons
            name="search"
            size={metrics.toolbarFontSize}
            color={colors.textSecondary}
            style={styles.searchFieldIcon}
          />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder={t('placeholders.searchTorrents')}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.searchFieldInput,
              { fontSize: metrics.toolbarFontSize, color: colors.text },
            ]}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={onClearSearch}
              accessibilityRole="button"
              accessibilityLabel={t('common.clearSearch')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="close-circle"
                size={metrics.toolbarFontSize}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  titleMac: {
    fontWeight: '600',
  },
  titleRegular: {
    fontWeight: '600',
  },
  count: {
    fontVariant: ['tabular-nums'],
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  iconButton: {
    borderRadius: borderRadius.xsmall,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.xsmall,
  },
  sortLabel: {},
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.xsmall,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  searchFieldIcon: {
    flexShrink: 0,
  },
  searchFieldInput: {
    flex: 1,
    padding: 0,
  },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: spacing.sm,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    marginHorizontal: 4,
  },
});
