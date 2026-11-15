/**
 * SearchFilterPanel.tsx — Floating filter panel for the Search tab (#266),
 * mirroring the qBittorrent WebUI's Search filters: "Search in" scope,
 * free-text filter, seeders range and size range.
 *
 * Controlled and presentational: the screen owns the staged draft the panel edits
 * and, on Apply, turns it into `filterSearchResults` options (see
 * `utils/search-filters.ts`). Absolutely
 * positioned under the search row like the sort dropdown, so it must be
 * rendered inside the (absolutely positioned) header.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterChip } from '@/components/FilterChip';
import { useTheme } from '@/context/ThemeContext';
import { GlassSurface } from '@/components/GlassSurface';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { buttonStyles } from '@/constants/buttons';
import { typography } from '@/constants/typography';
import { SearchInMode } from '@/types/preferences';
import {
  SEARCH_QUALITY_OPTIONS,
  SEARCH_SIZE_UNITS,
  SearchFilterDraft,
  SearchQualityOption,
  SearchSizeUnit,
  isDraftDirty,
} from '@/utils/search-filters';

/** Distance from the top of the search card to the panel (matches the sort dropdown). */
export const SEARCH_FILTER_PANEL_TOP = 54;

interface SearchFilterPanelProps {
  draft: SearchFilterDraft;
  onChange: (patch: Partial<SearchFilterDraft>) => void;
  searchIn: SearchInMode;
  onSearchInChange: (mode: SearchInMode) => void;
  onClear: () => void;
  /** Commits the staged edits. Nothing the panel edits takes effect before this. */
  onApply: () => void;
  style?: StyleProp<ViewStyle>;
}

function nextUnit(unit: SearchSizeUnit): SearchSizeUnit {
  const i = SEARCH_SIZE_UNITS.indexOf(unit);
  return SEARCH_SIZE_UNITS[(i + 1) % SEARCH_SIZE_UNITS.length];
}

/** Adds `quality` to the selection, or removes it if already selected. */
function toggleQuality(
  selected: SearchQualityOption[],
  quality: SearchQualityOption,
): SearchQualityOption[] {
  return selected.includes(quality)
    ? selected.filter((q) => q !== quality)
    : [...selected, quality];
}

export function SearchFilterPanel({
  draft,
  onChange,
  searchIn,
  onSearchInChange,
  onClear,
  onApply,
  style,
}: SearchFilterPanelProps) {
  const { t } = useTranslation();
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // The panel hangs from the top of the screen, so on a short phone the
  // keyboard can cover its lower rows. Track the keyboard and cap the panel's
  // height to the space above it; the content then scrolls instead of hiding.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const maxHeight =
    keyboardHeight > 0
      ? Math.max(
          160,
          windowHeight - keyboardHeight - insets.top - SEARCH_FILTER_PANEL_TOP - spacing.sm,
        )
      : undefined;

  const inputStyle = [
    styles.input,
    {
      backgroundColor: isDark ? colors.background : colors.surface,
      borderColor: colors.surfaceOutline,
      color: colors.text,
    },
  ];
  const labelStyle = [styles.label, { color: colors.textSecondary }];
  // "Names only" is a filter too, so it counts as something to clear.
  const canClear = isDraftDirty(draft) || searchIn === 'names';

  return (
    <GlassSurface
      popover
      style={[
        styles.panel,
        {
          backgroundColor: isDark ? colors.surface : colors.background,
          borderColor: colors.surfaceOutline,
        },
        style,
      ]}
    >
      <ScrollView
        style={maxHeight !== undefined ? { maxHeight } : undefined}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={labelStyle}>{t('screens.search.searchIn')}</Text>
        <View style={styles.row}>
          <FilterChip
            label={t('screens.search.namesOnly')}
            active={searchIn === 'names'}
            numberOfLines={1}
            style={styles.flex}
            onPress={() => onSearchInChange('names')}
          />
          <FilterChip
            label={t('screens.search.everywhere')}
            active={searchIn === 'everywhere'}
            numberOfLines={1}
            style={styles.flex}
            onPress={() => onSearchInChange('everywhere')}
          />
        </View>

        <TextInput
          value={draft.filterText}
          onChangeText={(filterText) => onChange({ filterText })}
          style={inputStyle}
          placeholder={t('screens.search.filterPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t('screens.search.filterResults')}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          clearButtonMode="while-editing"
        />

        <Text style={labelStyle}>{t('screens.search.videoQuality')}</Text>
        <View style={styles.row}>
          {SEARCH_QUALITY_OPTIONS.map((quality) => (
            <FilterChip
              key={quality}
              label={quality}
              active={draft.qualities.includes(quality)}
              numberOfLines={1}
              style={styles.flex}
              onPress={() => onChange({ qualities: toggleQuality(draft.qualities, quality) })}
            />
          ))}
        </View>

        <Text style={labelStyle}>{t('screens.search.filterSeeders')}</Text>
        <View style={styles.row}>
          <TextInput
            value={draft.minSeeders}
            onChangeText={(v) => onChange({ minSeeders: v.replace(/[^0-9]/g, '') })}
            style={[inputStyle, styles.flex]}
            placeholder={t('screens.search.filterMin')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('screens.search.minSeeders')}
            keyboardType="number-pad"
            maxLength={7}
          />
          <Text style={[styles.rangeDash, { color: colors.textSecondary }]}>–</Text>
          <TextInput
            value={draft.maxSeeders}
            onChangeText={(v) => onChange({ maxSeeders: v.replace(/[^0-9]/g, '') })}
            style={[inputStyle, styles.flex]}
            placeholder={t('screens.search.filterMax')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('screens.search.maxSeeders')}
            keyboardType="number-pad"
            maxLength={7}
          />
        </View>

        <Text style={labelStyle}>{t('screens.search.filterSize')}</Text>
        <View style={styles.row}>
          <TextInput
            value={draft.minSize}
            onChangeText={(v) => onChange({ minSize: v.replace(/[^0-9.,]/g, '') })}
            style={[inputStyle, styles.flex]}
            placeholder={t('screens.search.filterMin')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('screens.search.minSize')}
            keyboardType="decimal-pad"
            maxLength={9}
          />
          <FilterChip
            label={draft.minSizeUnit}
            active={false}
            icon="chevron-expand"
            iconSize={12}
            style={styles.unitChip}
            accessibilityLabel={t('screens.search.sizeUnit', { unit: draft.minSizeUnit })}
            onPress={() => onChange({ minSizeUnit: nextUnit(draft.minSizeUnit) })}
          />
          <Text style={[styles.rangeDash, { color: colors.textSecondary }]}>–</Text>
          <TextInput
            value={draft.maxSize}
            onChangeText={(v) => onChange({ maxSize: v.replace(/[^0-9.,]/g, '') })}
            style={[inputStyle, styles.flex]}
            placeholder={t('screens.search.filterMax')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('screens.search.maxSize')}
            keyboardType="decimal-pad"
            maxLength={9}
          />
          <FilterChip
            label={draft.maxSizeUnit}
            active={false}
            icon="chevron-expand"
            iconSize={12}
            style={styles.unitChip}
            accessibilityLabel={t('screens.search.sizeUnit', { unit: draft.maxSizeUnit })}
            onPress={() => onChange({ maxSizeUnit: nextUnit(draft.maxSizeUnit) })}
          />
        </View>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={onClear}
          disabled={!canClear}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Ionicons
            name="close-circle-outline"
            size={16}
            color={canClear ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.clearButtonText,
              { color: canClear ? colors.primary : colors.textSecondary },
            ]}
          >
            {t('screens.search.clearFilters')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.applyButton, { backgroundColor: colors.primary }]}
          onPress={onApply}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('screens.search.applyFilters')}
        >
          <Text style={styles.applyButtonText}>{t('screens.search.applyFilters')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: SEARCH_FILTER_PANEL_TOP,
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.large,
    borderWidth: 0.5,
    ...shadows.large,
    zIndex: 1000,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.captionSemibold,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    height: 40,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
    paddingHorizontal: spacing.sm + 2,
    ...typography.body,
  },
  unitChip: {
    paddingHorizontal: spacing.sm,
    minWidth: 62,
  },
  rangeDash: {
    ...typography.body,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
  },
  applyButton: {
    ...buttonStyles.small,
    paddingVertical: spacing.sm + 2,
  },
  applyButtonText: {
    ...typography.bodySemibold,
    // Text on the primary fill — same white the other primary buttons use.
    color: '#FFFFFF',
  },
  clearButtonText: {
    ...typography.captionSemibold,
  },
});
