import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useTorrents } from '@/context/TorrentContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { ColorPicker } from '@/components/ColorPicker';
import { categoriesApi } from '@/services/api/categories';
import { storageService } from '@/services/storage';
import { DEFAULT_PREFERENCES } from '@/types/preferences';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

type ColorTarget =
  | { kind: 'defaultCategory' }
  | { kind: 'defaultTag' }
  | { kind: 'category'; name: string }
  | { kind: 'tag'; name: string };

interface ColorSettingRowProps {
  label: string;
  color: string;
  hasOverride?: boolean;
  onPress: () => void;
  onReset?: () => void;
  textColor: string;
  outlineColor: string;
}

function ColorSettingRow({
  label,
  color,
  hasOverride,
  onPress,
  onReset,
  textColor,
  outlineColor,
}: ColorSettingRowProps) {
  return (
    <TouchableOpacity style={styles.colorRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.colorLabel, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.colorRowRight}>
        {hasOverride && onReset && (
          <TouchableOpacity
            onPress={onReset}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.resetButton}
          >
            <Ionicons name="refresh" size={16} color={textColor} />
          </TouchableOpacity>
        )}
        <View
          style={[styles.colorPreview, { backgroundColor: color, borderColor: outlineColor }]}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function CategoryTagColorsScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { tags } = useTorrents();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [categories, setCategories] = useState<Record<string, { name: string; savePath: string }>>(
    {},
  );
  const [defaultCategoryColor, setDefaultCategoryColor] = useState(
    DEFAULT_PREFERENCES.defaultCategoryColor,
  );
  const [defaultTagColor, setDefaultTagColor] = useState(DEFAULT_PREFERENCES.defaultTagColor);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorTarget, setColorTarget] = useState<ColorTarget | null>(null);

  const loadColors = async () => {
    try {
      const prefs = await storageService.getPreferences();
      setDefaultCategoryColor(
        prefs.defaultCategoryColor || DEFAULT_PREFERENCES.defaultCategoryColor,
      );
      setDefaultTagColor(prefs.defaultTagColor || DEFAULT_PREFERENCES.defaultTagColor);
      setCategoryColors(prefs.categoryColors || {});
      setTagColors(prefs.tagColors || {});
    } catch {
      // Use defaults
    }
  };

  const loadCategories = async () => {
    try {
      const allCategories = await categoriesApi.getAllCategories();
      setCategories(allCategories);
    } catch {
      // Not connected / failed to load
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadColors();
      loadCategories();
    }, []),
  );

  const openColorPicker = (target: ColorTarget) => {
    setColorTarget(target);
    setColorPickerVisible(true);
  };

  const currentColorFor = (target: ColorTarget | null): string => {
    if (!target) return '#000000';
    switch (target.kind) {
      case 'defaultCategory':
        return defaultCategoryColor;
      case 'defaultTag':
        return defaultTagColor;
      case 'category':
        return categoryColors[target.name] ?? defaultCategoryColor;
      case 'tag':
        return tagColors[target.name] ?? defaultTagColor;
    }
  };

  const handleColorChange = async (newColor: string) => {
    if (!colorTarget) return;
    try {
      const prefs = await storageService.getPreferences();
      switch (colorTarget.kind) {
        case 'defaultCategory':
          await storageService.savePreferences({ ...prefs, defaultCategoryColor: newColor });
          setDefaultCategoryColor(newColor);
          break;
        case 'defaultTag':
          await storageService.savePreferences({ ...prefs, defaultTagColor: newColor });
          setDefaultTagColor(newColor);
          break;
        case 'category': {
          const updated = { ...categoryColors, [colorTarget.name]: newColor };
          await storageService.savePreferences({ ...prefs, categoryColors: updated });
          setCategoryColors(updated);
          break;
        }
        case 'tag': {
          const updated = { ...tagColors, [colorTarget.name]: newColor };
          await storageService.savePreferences({ ...prefs, tagColors: updated });
          setTagColors(updated);
          break;
        }
      }
      showToast(t('toast.colorUpdated'), 'success');
    } catch {
      showToast(t('errors.failedToSaveColor'), 'error');
    }
  };

  const resetCategoryColor = async (name: string) => {
    try {
      const prefs = await storageService.getPreferences();
      const updated = { ...categoryColors };
      delete updated[name];
      await storageService.savePreferences({ ...prefs, categoryColors: updated });
      setCategoryColors(updated);
    } catch {
      showToast(t('errors.failedToSaveColor'), 'error');
    }
  };

  const resetTagColor = async (name: string) => {
    try {
      const prefs = await storageService.getPreferences();
      const updated = { ...tagColors };
      delete updated[name];
      await storageService.savePreferences({ ...prefs, tagColors: updated });
      setTagColors(updated);
    } catch {
      showToast(t('errors.failedToSaveColor'), 'error');
    }
  };

  const categoryNames = Object.keys(categories);

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('screens.settings.categoryTagColors')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.defaultColors').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <ColorSettingRow
                label={t('screens.settings.defaultCategoryColor')}
                color={defaultCategoryColor}
                onPress={() => openColorPicker({ kind: 'defaultCategory' })}
                textColor={colors.text}
                outlineColor={colors.surfaceOutline}
              />
              <View style={[styles.separator, { backgroundColor: colors.background }]} />
              <ColorSettingRow
                label={t('screens.settings.defaultTagColor')}
                color={defaultTagColor}
                onPress={() => openColorPicker({ kind: 'defaultTag' })}
                textColor={colors.text}
                outlineColor={colors.surfaceOutline}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.categories').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {categoryNames.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('screens.settings.noCategories')}
                </Text>
              ) : (
                categoryNames.map((name, index) => (
                  <View key={name}>
                    <ColorSettingRow
                      label={name}
                      color={categoryColors[name] ?? defaultCategoryColor}
                      hasOverride={name in categoryColors}
                      onPress={() => openColorPicker({ kind: 'category', name })}
                      onReset={() => resetCategoryColor(name)}
                      textColor={colors.text}
                      outlineColor={colors.surfaceOutline}
                    />
                    {index < categoryNames.length - 1 && (
                      <View style={[styles.separator, { backgroundColor: colors.background }]} />
                    )}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.tags').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {tags.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('screens.settings.noTags')}
                </Text>
              ) : (
                tags.map((tag, index) => (
                  <View key={tag}>
                    <ColorSettingRow
                      label={tag}
                      color={tagColors[tag] ?? defaultTagColor}
                      hasOverride={tag in tagColors}
                      onPress={() => openColorPicker({ kind: 'tag', name: tag })}
                      onReset={() => resetTagColor(tag)}
                      textColor={colors.text}
                      outlineColor={colors.surfaceOutline}
                    />
                    {index < tags.length - 1 && (
                      <View style={[styles.separator, { backgroundColor: colors.background }]} />
                    )}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <ColorPicker
        visible={colorPickerVisible}
        currentColor={currentColorFor(colorTarget)}
        onColorChange={handleColorChange}
        onClose={() => setColorPickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.headline, fontSize: 18 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: spacing.lg },
  section: { marginTop: spacing.md, marginBottom: spacing.sm },
  sectionHeader: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.md,
    ...shadows.card,
    overflow: 'hidden',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  colorRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorLabel: {
    ...typography.bodyMedium,
    fontSize: 16,
    flex: 1,
    marginRight: spacing.sm,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.small,
    borderWidth: 2,
  },
  resetButton: {
    padding: 4,
  },
  separator: {
    height: 1,
    marginHorizontal: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    padding: spacing.md,
    textAlign: 'center',
  },
});
