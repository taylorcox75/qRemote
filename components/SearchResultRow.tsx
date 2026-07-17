/**
 * SearchResultRow.tsx — Search result card.
 *
 * Tap semantics (mirrors TorrentCard's "tap = explore, button = act"):
 *   - tap on the row      → expand/collapse inline details + action buttons
 *   - tap on the + button → add the torrent (the ONLY way to add)
 *   - long-press          → opens the parent's action sheet (full menu)
 *
 * Visuals mirror TorrentCard: surface card, colored "health dot", filename
 * on line 1, meta line on line 2. Expanded state reveals the un-truncated
 * filename and an action chip row underneath.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { SearchResult } from '@/types/api';
import { formatSize } from '@/utils/format';
import { resultTrackerLabel } from '@/utils/searchResult';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
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
}

// Health dot mirrors the Torrents "state dot" convention:
//   success    >= 20 seeders   (healthy)
//   warning     1-19 seeders   (mediocre)
//   muted          0 seeders   (dead)
function healthColor(
  seeders: number,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
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
}: SearchResultRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const seeders = Math.max(0, result.nbSeeders ?? 0);
  const leechers = Math.max(0, result.nbLeechers ?? 0);
  const host = resultTrackerLabel(result, isAggregatedSource ?? false);
  const dotColor = healthColor(seeders, colors);

  return (
    <TouchableOpacity
      onPress={() => {
        haptics.light();
        setExpanded((prev) => !prev);
      }}
      onLongPress={onLongPress ? () => onLongPress(result) : undefined}
      activeOpacity={0.7}
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      <View style={styles.topRow}>
        <View style={styles.body}>
          {/* Line 1: filename — truncate when collapsed, full when expanded */}
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={expanded ? undefined : 2}
          >
            {result.fileName || '—'}
          </Text>

          {/* Line 2: health dot + meta */}
          <View style={styles.statusRow}>
            <View style={[styles.stateDot, { backgroundColor: dotColor }]} />
            <Text
              style={[styles.statusText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {formatSize(result.fileSize)}
              {'  ·  '}
              <Text style={{ color: colors.success }}>↑{seeders}</Text>
              {'  ·  '}
              <Text>↓{leechers}</Text>
              {host ? `  ·  ${host}` : ''}
            </Text>
            {/* Chevron hints that the row expands */}
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.textSecondary}
              style={styles.chevron}
            />
          </View>
        </View>

        {/* Right: the explicit add action. Inner TouchableOpacity does NOT
            propagate to the outer one in React Native, so tapping it adds
            the torrent without toggling the expand state. */}
        <TouchableOpacity
          onPress={() => {
            haptics.medium();
            onAdd(result);
          }}
          disabled={isAdding}
          accessibilityLabel={t('screens.search.addToQueue')}
          style={[
            styles.addButton,
            {
              backgroundColor: isAdding ? colors.surfaceOutline : colors.primary,
            },
          ]}
          activeOpacity={0.7}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="add" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Inline action row appears when expanded */}
      {expanded && (
        <>
          <View
            style={[styles.divider, { backgroundColor: colors.surfaceOutline }]}
          />
          <View style={styles.actionRow}>
            {result.descrLink && onOpenLink ? (
              <ActionPill
                icon="document-text-outline"
                label={t('screens.search.openDescription')}
                colors={colors}
                onPress={() => onOpenLink(result.descrLink)}
              />
            ) : null}
            {result.siteUrl && onOpenLink ? (
              <ActionPill
                icon="globe-outline"
                label={t('screens.search.openSite')}
                colors={colors}
                onPress={() => onOpenLink(result.siteUrl)}
              />
            ) : null}
            {result.fileUrl && onCopyUrl ? (
              <ActionPill
                icon="copy-outline"
                label={t('screens.search.copyLink')}
                colors={colors}
                onPress={() => onCopyUrl(result.fileUrl)}
              />
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

// ────────────────────────────────────────────────────── ActionPill ────────

interface ActionPillProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
}

function ActionPill({ icon, label, colors, onPress }: ActionPillProps) {
  return (
    <TouchableOpacity
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={[
        styles.actionPill,
        { backgroundColor: colors.background, borderColor: colors.surfaceOutline },
      ]}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text
        style={[styles.actionPillText, { color: colors.text }]}
        numberOfLines={1}
      >
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.medium,
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
});
