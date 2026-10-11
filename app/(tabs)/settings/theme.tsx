import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, ThemeColors } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { ColorPicker } from '@/components/ColorPicker';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ThemePresetsSection } from '@/components/ThemePresetsSection';
import {
  colorThemeManager,
  type EditableColorKey,
  type ColorTheme,
} from '@/services/color-theme-manager';
import type { ThemePreset } from '@/constants/themePresets';
import {
  getThemePresetSelection,
  presetApplyNeedsConfirm,
  type ThemePresetSelection,
} from '@/utils/themePresets';
import { useToast } from '@/context/ToastContext';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { DEFAULT_PREFERENCES, type ThemeMode } from '@/types/preferences';
import { storageService } from '@/services/storage';

interface ColorSettingRowProps {
  label: string;
  color: string;
  onPress: () => void;
  colors: ThemeColors;
}

function ColorSettingRow({ label, color, onPress, colors }: ColorSettingRowProps) {
  return (
    <TouchableOpacity style={styles.colorRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.colorLabel, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.colorPreview,
          { backgroundColor: color, borderColor: colors.surfaceOutline },
        ]}
      />
    </TouchableOpacity>
  );
}

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const { isDark, themeMode, setThemeMode, colors, reloadCustomColors } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorPickerKey, setColorPickerKey] = useState<EditableColorKey | null>(null);
  const [themeModePickerVisible, setThemeModePickerVisible] = useState(false);
  // What is applied right now, derived from storage (null until first read).
  const [presetSelection, setPresetSelection] = useState<ThemePresetSelection | null>(null);
  // A preset the user tapped while they have custom colors; applied only on confirm.
  const [pendingPreset, setPendingPreset] = useState<ThemePreset | null>(null);

  const readPresetSelection = useCallback(async (): Promise<ThemePresetSelection> => {
    const prefs = await storageService.getPreferences();
    return getThemePresetSelection(prefs.customColors, prefs.themePresetId);
  }, []);

  const refreshPresetSelection = useCallback(async () => {
    try {
      setPresetSelection(await readPresetSelection());
    } catch {
      // Leave the previous selection; the section just won't update its highlight.
    }
  }, [readPresetSelection]);

  // Every color change goes through here so the highlighted preset follows it:
  // editing a color after applying a preset naturally flips it to "Custom".
  const reloadColors = async () => {
    await reloadCustomColors();
    await refreshPresetSelection();
  };

  const applyPreset = async (preset: ThemePreset) => {
    try {
      await colorThemeManager.applyThemePreset(preset);
      await reloadColors();
      showToast(t('screens.settings.themePresetApplied', { name: t(preset.nameKey) }), 'success');
    } catch {
      showToast(t('screens.settings.themePresetApplyFailed'), 'error');
    }
  };

  const handlePresetSelect = async (preset: ThemePreset) => {
    // Decide from storage at tap time, not from state that may be stale (or not
    // loaded yet): custom colors are only ever replaced after an explicit confirm.
    let current: ThemePresetSelection;
    try {
      current = await readPresetSelection();
    } catch {
      current = { kind: 'custom' };
    }
    setPresetSelection(current);
    if (presetApplyNeedsConfirm(current)) {
      setPendingPreset(preset);
    } else {
      await applyPreset(preset);
    }
  };

  useEffect(() => {
    reloadCustomColors();
    let cancelled = false;
    readPresetSelection()
      .then((selection) => {
        if (!cancelled) setPresetSelection(selection);
      })
      .catch(() => {
        // Leave the highlight empty; tapping a preset re-reads storage anyway.
      });
    return () => {
      cancelled = true;
    };
    // Only run once on mount — reloadCustomColors isn't memoized in
    // ThemeContext, so including it would re-fire this on every color change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleColorSelect = (key: EditableColorKey) => {
    setColorPickerKey(key);
    setColorPickerVisible(true);
  };

  const themeModeOptions: OptionPickerItem[] = [
    {
      label: t('screens.settings.themeModeSystem'),
      value: 'system',
      icon: 'phone-portrait-outline',
    },
    { label: t('screens.settings.themeModeLight'), value: 'light', icon: 'sunny-outline' },
    { label: t('screens.settings.themeModeDark'), value: 'dark', icon: 'moon-outline' },
  ];
  const currentThemeModeLabel =
    themeModeOptions.find((opt) => opt.value === themeMode)?.label ??
    t('screens.settings.themeModeSystem');

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.background, borderBottomColor: colors.surfaceOutline },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('screens.settings.themeAndColors')}
          </Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Theme presets */}
          <ThemePresetsSection selection={presetSelection} onSelect={handlePresetSelect} />

          {/* Theme Mode */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.appearance').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setThemeModePickerVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('screens.settings.themeMode')}
                accessibilityValue={{ text: currentThemeModeLabel }}
              >
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={isDark ? 'moon-outline' : 'sunny-outline'}
                    size={22}
                    color={colors.primary}
                  />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.themeMode')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      {t('screens.settings.themeModeHint')}
                    </Text>
                  </View>
                </View>
                <View style={styles.themeModeValue}>
                  <Text style={[styles.themeModeValueText, { color: colors.text }]}>
                    {currentThemeModeLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Torrent state colors (badge & border by activity) */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.torrentStateColors')}
              </Text>
              <TouchableOpacity
                accessibilityLabel={t('screens.settings.resetStateColors')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={async () => {
                  try {
                    await colorThemeManager.resetTorrentStateColors(isDark);
                    await reloadColors();
                    showToast(t('toast.stateColorsReset'), 'success');
                  } catch {
                    showToast(t('errors.failedToResetStateColors'), 'error');
                  }
                }}
              >
                <Ionicons name="refresh" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <ColorSettingRow
                label="Downloading"
                color={colors.stateDownloading}
                onPress={() => handleColorSelect('stateDownloading')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Seeding (idle)"
                color={colors.stateSeeding}
                onPress={() => handleColorSelect('stateSeeding')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Download + Upload"
                color={colors.stateUploadAndDownload}
                onPress={() => handleColorSelect('stateUploadAndDownload')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Upload only"
                color={colors.stateUploadOnly}
                onPress={() => handleColorSelect('stateUploadOnly')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Error / Stalled DL"
                color={colors.stateError}
                onPress={() => handleColorSelect('stateError')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Stalled (upload)"
                color={colors.stateStalled}
                onPress={() => handleColorSelect('stateStalled')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Paused / Stopped"
                color={colors.statePaused}
                onPress={() => handleColorSelect('statePaused')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Checking"
                color={colors.stateChecking}
                onPress={() => handleColorSelect('stateChecking')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Metadata"
                color={colors.stateMetadata}
                onPress={() => handleColorSelect('stateMetadata')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Queued"
                color={colors.stateQueued}
                onPress={() => handleColorSelect('stateQueued')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Other"
                color={colors.stateOther}
                onPress={() => handleColorSelect('stateOther')}
                colors={colors}
              />
            </View>
          </View>

          {/* Advanced Color Customization */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.advancedColors')}
              </Text>
              <TouchableOpacity
                accessibilityLabel={t('screens.settings.resetColors')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={async () => {
                  try {
                    await colorThemeManager.resetCustomColors(isDark);
                    await reloadColors();
                    showToast(t('toast.colorsReset'), 'success');
                  } catch {
                    showToast(t('errors.failedToResetColors'), 'error');
                  }
                }}
              >
                <Ionicons name="refresh" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <ColorSettingRow
                label="Primary"
                color={colors.primary}
                onPress={() => handleColorSelect('primary')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Error"
                color={colors.error}
                onPress={() => handleColorSelect('error')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Success"
                color={colors.success}
                onPress={() => handleColorSelect('success')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Warning"
                color={colors.warning}
                onPress={() => handleColorSelect('warning')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Background"
                color={colors.background}
                onPress={() => handleColorSelect('background')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Surface"
                color={colors.surface}
                onPress={() => handleColorSelect('surface')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Surface Outline"
                color={colors.surfaceOutline}
                onPress={() => handleColorSelect('surfaceOutline')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Text"
                color={colors.text}
                onPress={() => handleColorSelect('text')}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label="Text Secondary"
                color={colors.textSecondary}
                onPress={() => handleColorSelect('textSecondary')}
                colors={colors}
              />
            </View>
          </View>

          {/* Category & tag sticker colors */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.categoryTagColors').toUpperCase()}
              </Text>
              <TouchableOpacity
                accessibilityLabel={t('screens.settings.resetCategoryTagColors')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={async () => {
                  try {
                    const prefs = await storageService.getPreferences();
                    await storageService.savePreferences({
                      ...prefs,
                      defaultCategoryColor: DEFAULT_PREFERENCES.defaultCategoryColor,
                      defaultTagColor: DEFAULT_PREFERENCES.defaultTagColor,
                      categoryColors: {},
                      tagColors: {},
                    });
                    showToast(t('toast.categoryTagColorsReset'), 'success');
                  } catch {
                    showToast(t('errors.failedToResetCategoryTagColors'), 'error');
                  }
                }}
              >
                <Ionicons name="refresh" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => router.push('/settings/category-tag-colors')}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="pricetags-outline" size={22} color={colors.primary} />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.categoryTagColors')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      {t('screens.settings.categoryTagColorsHint')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ColorPicker
            visible={colorPickerVisible}
            currentColor={colorPickerKey ? colors[colorPickerKey] : '#000000'}
            onColorChange={async (newColor) => {
              try {
                const custom = await colorThemeManager.getCustomColors(isDark);
                const updatedCustom: ColorTheme = {
                  ...(custom || {}),
                  [colorPickerKey!]: newColor,
                };
                await colorThemeManager.saveCustomColors(isDark, updatedCustom);
                await reloadColors();
                showToast(`${colorPickerKey} color updated`, 'success');
              } catch {
                showToast(t('errors.failedToSaveColor'), 'error');
              }
            }}
            onClose={() => setColorPickerVisible(false)}
          />
        </ScrollView>
      </View>

      <ConfirmModal
        visible={pendingPreset !== null}
        title={t('screens.settings.themePresetReplaceTitle')}
        message={
          pendingPreset
            ? t('screens.settings.themePresetReplaceMessage', { name: t(pendingPreset.nameKey) })
            : undefined
        }
        buttons={[
          {
            label: t('screens.settings.themePresetReplaceConfirm'),
            destructive: true,
            onPress: () => {
              const preset = pendingPreset;
              setPendingPreset(null);
              if (preset) applyPreset(preset);
            },
          },
        ]}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPendingPreset(null)}
      />

      <OptionPicker
        visible={themeModePickerVisible}
        title={t('screens.settings.themeMode')}
        options={themeModeOptions}
        selectedValue={themeMode}
        onSelect={async (value) => {
          await setThemeMode(value as ThemeMode);
          setThemeModePickerVisible(false);
        }}
        onClose={() => setThemeModePickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.headline,
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
  },
  card: {
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.md,
    ...shadows.card,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
    gap: spacing.sm,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    ...typography.bodyMedium,
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginHorizontal: spacing.md,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  colorLabel: {
    ...typography.bodyMedium,
    fontSize: 16,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.small,
    borderWidth: 2,
  },
  themeModeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  themeModeValueText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
