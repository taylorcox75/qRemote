import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, darkColors, lightColors } from '@/context/ThemeContext';
import { THEME_PRESETS, type ThemePreset } from '@/constants/themePresets';
import { findThemePreset, type ThemePresetSelection } from '@/utils/themePresets';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';

interface ThemePresetsSectionProps {
  /**
   * What is currently applied (see `getThemePresetSelection`). `null` while it
   * is still being read from storage: nothing is highlighted yet.
   */
  selection: ThemePresetSelection | null;
  onSelect: (preset: ThemePreset) => void;
}

function isSelected(preset: ThemePreset, selection: ThemePresetSelection | null): boolean {
  if (!selection) return false;
  if (selection.kind === 'default') return preset.id === 'default';
  if (selection.kind === 'preset') return preset.id === selection.id;
  return false;
}

/**
 * Settings → Theme "Presets" section (#286): a horizontally scrolling row of
 * swatch cards, each previewing the preset for the CURRENT light/dark mode.
 * Presentational only — applying (and confirming over custom colors) is the
 * screen's job.
 */
export function ThemePresetsSection({ selection, onSelect }: ThemePresetsSectionProps) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  // `default` has no overrides, so previewing it shows the live built-in palette;
  // every other preset defines all keys, so the spread is a no-op for them.
  const base = isDark ? darkColors : lightColors;
  const mode = isDark ? 'dark' : 'light';

  const basedOnPreset =
    selection?.kind === 'custom' ? findThemePreset(selection.basedOn) : undefined;
  const customCaption = basedOnPreset
    ? t('screens.settings.themePresetCustomBasedOn', { name: t(basedOnPreset.nameKey) })
    : t('screens.settings.themePresetCustom');

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        {t('screens.settings.themePresets').toUpperCase()}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {THEME_PRESETS.map((preset) => {
          const palette = { ...base, ...preset[mode] };
          const selected = isSelected(preset, selection);
          const name = t(preset.nameKey);
          return (
            <TouchableOpacity
              key={preset.id}
              testID={`theme-preset-${preset.id}`}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.primary : colors.surfaceOutline,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
              onPress={() => {
                if (!selected) onSelect(preset);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{ selected }}
            >
              {/* The swatch colors ARE the preset's data, not app chrome. */}
              <View
                testID={`theme-preset-preview-${preset.id}`}
                style={[
                  styles.previewBackground,
                  { backgroundColor: palette.background, borderColor: palette.surfaceOutline },
                ]}
              >
                <View
                  style={[
                    styles.previewSurface,
                    { backgroundColor: palette.surface, borderColor: palette.surfaceOutline },
                  ]}
                >
                  <View style={styles.previewTopRow}>
                    <View style={[styles.primaryDot, { backgroundColor: palette.primary }]} />
                    <View style={[styles.textBar, { backgroundColor: palette.text }]} />
                  </View>
                  <View style={styles.stateDots}>
                    {(
                      ['stateDownloading', 'stateSeeding', 'stateError', 'statePaused'] as const
                    ).map((key) => (
                      <View
                        key={key}
                        style={[styles.stateDot, { backgroundColor: palette[key] }]}
                      />
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
                  {name}
                </Text>
                {selected && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {selection?.kind === 'custom' && (
        <View style={styles.customRow} testID="theme-preset-custom-caption">
          <Ionicons name="color-palette-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.customText, { color: colors.textSecondary }]}>{customCaption}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
    letterSpacing: 0.5,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  card: {
    width: 132,
    borderRadius: borderRadius.medium,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  previewBackground: {
    height: 72,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    padding: spacing.sm,
  },
  previewSurface: {
    flex: 1,
    borderRadius: borderRadius.xsmall,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'space-between',
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  primaryDot: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
  },
  textBar: {
    width: 28,
    height: 4,
    borderRadius: 2,
  },
  stateDots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  name: {
    ...typography.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  customText: {
    ...typography.caption,
    fontSize: 12,
  },
});
