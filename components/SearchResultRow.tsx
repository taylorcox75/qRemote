/**
 * SearchResultRow.tsx — Search result card.
 *
 * Tap semantics (mirrors TorrentCard's "tap = explore, button = act"):
 *   - tap on the row       → expand/collapse inline details + action buttons
 *   - tap on the + button  → add the torrent (behavior depends on the
 *                            searchAddOpensDialogue preference — see search.tsx)
 *   - tap on the cart      → queue/unqueue this result for a batch add (#217)
 *   - long-press           → opens the parent's action sheet (full menu)
 *
 * The + button and the cart button are independent affordances: + never
 * touches the cart, and the cart button never adds anything by itself.
 *
 * Compact (iPhone) visuals mirror TorrentCard: surface card, colored
 * "health dot", filename on line 1, meta line on line 2. On regular/mac
 * the same row is a dense hairline strip matching TorrentTable density
 * (no card chrome, 13pt/15pt name, toolbar-sized + / cart). Expanded
 * state still reveals the un-truncated filename and an action chip row.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useShell } from '@/context/ShellContext';
import { ArtworkThumbnail } from '@/components/ArtworkThumbnail';
import { SearchResult } from '@/types/api';
import { formatSize, formatDate } from '@/utils/format';
import { resultTrackerLabel } from '@/utils/searchResult';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { desktopMetrics } from '@/constants/desktop';
import { hexToRgba } from '@/utils/color';
import { haptics } from '@/utils/haptics';

interface SearchResultRowProps {
  result: SearchResult;
  /** True when every result in the current batch shares one siteUrl (a
   * proxying plugin like Prowlarr/Jackett) — see resultTrackerLabel. */
  isAggregatedSource?: boolean;
  onAdd: (result: SearchResult) => void;
  onLongPress?: (result: SearchResult) => void;
  onOpenLink?: (url: string) => void;
  onCopyUrl?: (url: string) => void;
  isAdding?: boolean;
  /** True when this result is already queued in the cart (#217). */
  inCart?: boolean;
  /** Omit to hide the cart button entirely. */
  onToggleCart?: (result: SearchResult) => void;
}

// Health dot mirrors the Torrents "state dot" convention:
//   success    >= 20 seeders   (healthy)
//   warning     1-19 seeders   (mediocre)
//   muted          0 seeders   (dead)
function healthColor(seeders: number, colors: ReturnType<typeof useTheme>['colors']): string {
  if (seeders >= 20) return colors.success;
  if (seeders > 0) return colors.warning;
  return colors.textSecondary;
}

export function SearchResultRow({
  result,
  isAggregatedSource,
  onAdd,
  onLongPress,
  onOpenLink,
  onCopyUrl,
  isAdding,
  inCart,
  onToggleCart,
}: SearchResultRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { idiom } = useShell();
  const desktop = idiom !== 'compact';
  const metrics = desktop ? desktopMetrics(idiom) : null;
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const seeders = Math.max(0, result.nbSeeders ?? 0);
  const leechers = Math.max(0, result.nbLeechers ?? 0);
  const host = resultTrackerLabel(result, isAggregatedSource ?? false);
  const dotColor = healthColor(seeders, colors);

  const toggleExpanded = () => {
    haptics.light();
    setExpanded((prev) => !prev);
  };

  const artworkSize = metrics?.tableArtworkSize ?? 44;
  const controlSize = metrics?.toolbarControlHeight ?? 36;
  const iconSize = metrics?.toolbarIconSize ?? 20;
  const nameSize = metrics?.tableFontSize;
  const captionSize = metrics?.tableHeaderFontSize;
  const radius = metrics?.selectionRadius ?? borderRadius.medium;

  const inner = (
    <>
      <View style={[styles.topRow, desktop && styles.topRowDesktop]}>
        {/* Self-fetching, opt-in TMDB poster (returns null when the feature
            is inactive, so layout is unchanged for users with it off). */}
        <ArtworkThumbnail
          name={result.fileName || ''}
          width={artworkSize}
          placeholderIcon="film-outline"
        />
        <View style={styles.body}>
          {/* Line 1: filename — truncate when collapsed, full when expanded */}
          <Text
            style={[
              styles.name,
              desktop &&
                nameSize !== undefined && {
                  fontSize: nameSize,
                  lineHeight: Math.round(nameSize * 1.3),
                  marginBottom: 2,
                  fontWeight: '500',
                },
              { color: colors.text },
            ]}
            numberOfLines={expanded ? undefined : desktop ? 1 : 2}
          >
            {result.fileName || '—'}
          </Text>

          {/* Line 2: health dot + meta */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.stateDot,
                desktop && styles.stateDotDesktop,
                { backgroundColor: dotColor },
              ]}
            />
            {/* numberOfLines=2, not 1: size/seeders/leechers/host/date can
                overflow one line once a date is present — wrap instead of
                silently truncating the date off the end. Desktop is a
                single tabular line like TorrentTable. */}
            <Text
              style={[
                styles.statusText,
                desktop &&
                  captionSize !== undefined && {
                    fontSize: captionSize,
                    lineHeight: Math.round(captionSize * 1.3),
                  },
                { color: colors.textSecondary },
              ]}
              numberOfLines={desktop ? 1 : 2}
            >
              {formatSize(result.fileSize)}
              {'  ·  '}
              <Text style={{ color: colors.success }}>↑{seeders}</Text>
              {'  ·  '}
              <Text>↓{leechers}</Text>
              {host ? `  ·  ${host}` : ''}
              {/* qBittorrent sends -1 (not undefined) when the plugin didn't
                  report a date — only render when it's a real timestamp. */}
              {result.pubDate && result.pubDate > 0 ? `  ·  ${formatDate(result.pubDate)}` : ''}
            </Text>
            {/* Chevron hints that the row expands */}
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={desktop ? (metrics?.toolbarIconSize ?? 14) : 14}
              color={colors.textSecondary}
              style={styles.chevron}
            />
          </View>
        </View>

        {/* Right: the explicit add action, plus the cart toggle.
            Compact stacks them; desktop puts them in a row so the
            strip can sit at table-row height. Inner TouchableOpacity
            does NOT propagate to the outer one in React Native, so
            tapping either button acts without toggling expand. */}
        <View style={[styles.actionColumn, desktop && styles.actionColumnDesktop]}>
          <TouchableOpacity
            onPress={() => {
              haptics.medium();
              onAdd(result);
            }}
            disabled={isAdding}
            accessibilityLabel={t('screens.search.addToQueue')}
            style={[
              styles.addButton,
              desktop && {
                width: controlSize,
                height: controlSize,
                borderRadius: radius,
              },
              {
                backgroundColor: isAdding ? colors.surfaceOutline : colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="add" size={desktop ? iconSize : 20} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          {onToggleCart && result.fileUrl ? (
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                onToggleCart(result);
              }}
              accessibilityLabel={
                inCart ? t('screens.search.removeFromCart') : t('screens.search.addToCart')
              }
              accessibilityState={{ selected: !!inCart }}
              style={[
                styles.cartButton,
                desktop && {
                  width: controlSize,
                  height: controlSize,
                  borderRadius: radius,
                },
                {
                  backgroundColor: inCart ? colors.primaryOpac : colors.background,
                  borderColor: inCart ? colors.primary : colors.surfaceOutline,
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={inCart ? 'cart' : 'cart-outline'}
                size={desktop ? iconSize : 18}
                color={inCart ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Inline action row appears when expanded */}
      {expanded && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.surfaceOutline }]} />
          <View style={styles.actionRow}>
            {result.descrLink && onOpenLink ? (
              <ActionPill
                icon="document-text-outline"
                label={t('screens.search.openDescription')}
                colors={colors}
                dense={desktop}
                onPress={() => onOpenLink(result.descrLink)}
              />
            ) : null}
            {result.siteUrl && onOpenLink ? (
              <ActionPill
                icon="globe-outline"
                label={t('screens.search.openSite')}
                colors={colors}
                dense={desktop}
                onPress={() => onOpenLink(result.siteUrl)}
              />
            ) : null}
            {result.fileUrl && onCopyUrl ? (
              <ActionPill
                icon="copy-outline"
                label={t('screens.search.copyLink')}
                colors={colors}
                dense={desktop}
                onPress={() => onCopyUrl(result.fileUrl)}
              />
            ) : null}
          </View>
        </>
      )}
    </>
  );

  if (!desktop) {
    return (
      <TouchableOpacity
        onPress={toggleExpanded}
        onLongPress={onLongPress ? () => onLongPress(result) : undefined}
        activeOpacity={0.7}
        style={[styles.card, { backgroundColor: colors.surface }]}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  const rowBackground = hovered ? hexToRgba(colors.text, 0.06) : colors.background;

  return (
    <Pressable
      onPress={toggleExpanded}
      onLongPress={onLongPress ? () => onLongPress(result) : undefined}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      style={[
        styles.denseRow,
        {
          backgroundColor: rowBackground,
          borderBottomColor: colors.surfaceOutline,
          minHeight: metrics?.tableRowHeight,
          paddingHorizontal: metrics?.sidebarInsetHorizontal,
        },
      ]}
    >
      {inner}
    </Pressable>
  );
}

// ────────────────────────────────────────────────────── ActionPill ────────

interface ActionPillProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
  dense?: boolean;
}

function ActionPill({ icon, label, colors, onPress, dense }: ActionPillProps) {
  return (
    <TouchableOpacity
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={[
        styles.actionPill,
        dense && styles.actionPillDense,
        { backgroundColor: colors.background, borderColor: colors.surfaceOutline },
      ]}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={dense ? 12 : 14} color={colors.primary} />
      <Text style={[styles.actionPillText, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ────────────────────────────────────────────────────── styles ────────────

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.medium,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.bodySemibold,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    flex: 1,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  actionColumn: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 0.5,
  },
  actionPillText: {
    ...typography.captionSemibold,
    letterSpacing: 0.2,
  },
  actionPillDense: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  topRowDesktop: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  stateDotDesktop: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionColumnDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  denseRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
