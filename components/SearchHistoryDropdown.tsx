/**
 * SearchHistoryDropdown.tsx — Recent/pinned searches popover for the Torrents
 * tab search box (#282). Rendered inside the header (same pattern as the sort
 * dropdown in app/(tabs)/(torrents)/index.tsx); the parent supplies `style` with
 * the `top`/`left`/`right` position and owns open/closed state.
 *
 * Each row: leading icon (thumbtack if pinned, clock otherwise), the query (tap to
 * reuse it), a pin toggle and a remove button. The footer clears every unpinned
 * entry. With no entries yet it shows how searches get saved, so the feature
 * is discoverable before first use. Pure list logic lives in utils/search-history.ts.
 *
 * Key exports: SearchHistoryDropdown
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { SearchHistoryEntry } from '@/utils/search-history';
import { shadows } from '@/constants/shadows';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';

interface SearchHistoryDropdownProps {
  /** Pinned entries first, then recent ones (see `getHistoryEntries`). */
  entries: SearchHistoryEntry[];
  onSelect: (query: string) => void;
  onTogglePin: (query: string) => void;
  onRemove: (query: string) => void;
  /** Clears every unpinned entry. The footer is hidden when none are left. */
  onClearRecent: () => void;
  /** Absolute position (`top`/`left`/`right`) within the header. */
  style?: StyleProp<ViewStyle>;
}

export function SearchHistoryDropdown({
  entries,
  onSelect,
  onTogglePin,
  onRemove,
  onClearRecent,
  style,
}: SearchHistoryDropdownProps) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const hasRecent = entries.some((entry) => !entry.pinned);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surface : colors.background,
          borderColor: colors.surfaceOutline,
        },
        style,
      ]}
    >
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        {t('screens.torrents.recentSearches')}
      </Text>
      <ScrollView
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {entries.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('screens.torrents.noRecentSearches')}
          </Text>
        )}
        {entries.map((entry) => (
          <View key={entry.query} style={styles.row}>
            <TouchableOpacity
              style={styles.queryButton}
              onPress={() => onSelect(entry.query)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={entry.query}
            >
              {entry.pinned ? (
                <Ionicons name="pin" size={16} color={colors.primary} style={styles.thumbtack} />
              ) : (
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              )}
              <Text style={[styles.queryText, { color: colors.text }]} numberOfLines={1}>
                {entry.query}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => onTogglePin(entry.query)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={
                entry.pinned ? t('screens.torrents.unpinSearch') : t('screens.torrents.pinSearch')
              }
            >
              <Ionicons
                name={entry.pinned ? 'pin' : 'pin-outline'}
                size={18}
                color={entry.pinned ? colors.primary : colors.textSecondary}
                style={styles.thumbtack}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => onRemove(entry.query)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={t('screens.torrents.removeSearch')}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      {hasRecent && (
        <TouchableOpacity
          style={[styles.footer, { borderTopColor: colors.surfaceOutline }]}
          onPress={onClearRecent}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('screens.torrents.clearRecentSearches')}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {t('screens.torrents.clearRecentSearches')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    minWidth: 240,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    ...shadows.large,
    zIndex: 1000,
    overflow: 'hidden',
  },
  title: {
    ...typography.label,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  queryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  queryText: {
    ...typography.secondary,
    flex: 1,
  },
  iconButton: {
    padding: spacing.xs,
  },
  // Ionicons' pin is an upright map-style needle; tilted 45° it reads as a
  // thumbtack without pulling in a second icon font.
  thumbtack: {
    transform: [{ rotate: '45deg' }],
  },
  emptyText: {
    ...typography.secondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    ...typography.secondary,
    flex: 1,
  },
});
