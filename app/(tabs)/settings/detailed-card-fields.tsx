import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { storageService } from '@/services/storage';
import { AppPreferences, ExpandedCardField, DEFAULT_PREFERENCES } from '@/types/preferences';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

const FIELD_ORDER: ExpandedCardField[] = [
  'seeds',
  'peers',
  'ratioLimit',
  'maxRatio',
  'uploaded',
  'availability',
  'popularity',
  'addedOn',
  'seedingTime',
  'tags',
  'category',
  'tracker',
  'savePath',
];

function resolveGridColumns(value: unknown): 3 | 4 | 5 {
  return value === 3 || value === 5 ? value : 4;
}

export default function DetailedCardFieldsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();

  const [fields, setFields] = useState<Record<ExpandedCardField, boolean>>(
    DEFAULT_PREFERENCES.expandedCardFields
  );
  const [gridColumns, setGridColumns] = useState<3 | 4 | 5>(
    DEFAULT_PREFERENCES.expandedCardGridColumns
  );
  const [gridPickerVisible, setGridPickerVisible] = useState(false);

  const gridOptions: OptionPickerItem[] = useMemo(
    () => [
      { label: t('screens.settings.detailedCardGridColumns3'), value: '3', icon: 'grid-outline' },
      { label: t('screens.settings.detailedCardGridColumns4'), value: '4', icon: 'grid-outline' },
      { label: t('screens.settings.detailedCardGridColumns5'), value: '5', icon: 'grid-outline' },
    ],
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const prefs = await storageService.getPreferences();
          const stored = (prefs.expandedCardFields as Partial<Record<ExpandedCardField, boolean>>) || {};
          setFields({ ...DEFAULT_PREFERENCES.expandedCardFields, ...stored });
          setGridColumns(resolveGridColumns(prefs.expandedCardGridColumns));
        } catch {
          setFields(DEFAULT_PREFERENCES.expandedCardFields);
          setGridColumns(DEFAULT_PREFERENCES.expandedCardGridColumns);
        }
      };
      load();
    }, [])
  );

  const savePreference = async <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, [key]: value });
    } catch {
      // Ignore save errors
    }
  };

  const toggleField = useCallback((field: ExpandedCardField, value: boolean) => {
    setFields((prev) => {
      const next = { ...prev, [field]: value };
      void savePreference('expandedCardFields', next as AppPreferences['expandedCardFields']);
      return next;
    });
  }, []);

  const saveGridColumns = async (value: string) => {
    const columns = resolveGridColumns(Number(value));
    setGridColumns(columns);
    setGridPickerVisible(false);
    await savePreference('expandedCardGridColumns', columns);
  };

  const fieldMeta = useMemo(() => {
    // Core stats (progress, ETA, speeds, ratio, status) live on the always-on
    // header line / badge and are intentionally absent from this picker.
    const map: Partial<
      Record<ExpandedCardField, { icon: React.ComponentProps<typeof Ionicons>['name']; labelKey: string }>
    > = {
      seeds: { icon: 'leaf-outline', labelKey: 'screens.settings.expandedCardFieldsList.seeds' },
      peers: { icon: 'people-outline', labelKey: 'screens.settings.expandedCardFieldsList.peers' },
      ratioLimit: { icon: 'git-compare-outline', labelKey: 'screens.settings.expandedCardFieldsList.ratioLimit' },
      maxRatio: { icon: 'trending-up-outline', labelKey: 'screens.settings.expandedCardFieldsList.maxRatio' },
      uploaded: { icon: 'cloud-upload-outline', labelKey: 'screens.settings.expandedCardFieldsList.uploaded' },
      availability: { icon: 'stats-chart-outline', labelKey: 'screens.settings.expandedCardFieldsList.availability' },
      popularity: { icon: 'flame-outline', labelKey: 'screens.settings.expandedCardFieldsList.popularity' },
      savePath: { icon: 'folder-outline', labelKey: 'screens.settings.expandedCardFieldsList.savePath' },
      tracker: { icon: 'globe-outline', labelKey: 'screens.settings.expandedCardFieldsList.tracker' },
      addedOn: { icon: 'calendar-outline', labelKey: 'screens.settings.expandedCardFieldsList.addedOn' },
      seedingTime: { icon: 'hourglass-outline', labelKey: 'screens.settings.expandedCardFieldsList.seedingTime' },
      tags: { icon: 'pricetag-outline', labelKey: 'screens.settings.expandedCardFieldsList.tags' },
      category: { icon: 'folder-open-outline', labelKey: 'screens.settings.expandedCardFieldsList.category' },
    };
    return map;
  }, []);

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7} accessibilityLabel={t('common.back')}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('screens.settings.detailedCardFields')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.detailedCardGridColumns').toUpperCase()}
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              {t('screens.settings.detailedCardGridColumnsDescription')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setGridPickerVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="grid-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.detailedCardGridColumns')}
                  </Text>
                </View>
                <View style={styles.pickerValue}>
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {t(`screens.settings.detailedCardGridColumns${gridColumns}`)}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.expandedCardFields')}
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              {t('screens.settings.expandedCardFieldsHint')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {FIELD_ORDER.map((field, idx) => {
                const meta = fieldMeta[field];
                if (!meta) return null;
                const value = !!fields[field];
                const isLast = idx === FIELD_ORDER.length - 1;
                return (
                  <React.Fragment key={field}>
                    <View style={styles.settingRow}>
                      <View style={styles.settingLeft}>
                        <Ionicons name={meta.icon} size={22} color={colors.primary} />
                        <Text style={[styles.settingLabel, { color: colors.text }]}>
                          {t(meta.labelKey)}
                        </Text>
                      </View>
                      <Switch
                        value={value}
                        onValueChange={(v) => toggleField(field, v)}
                        trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                        ios_backgroundColor={colors.surfaceOutline}
                      />
                    </View>
                    {!isLast && <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      <OptionPicker
        visible={gridPickerVisible}
        title={t('screens.settings.detailedCardGridColumns')}
        options={gridOptions}
        selectedValue={String(gridColumns)}
        onSelect={saveGridColumns}
        onClose={() => setGridPickerVisible(false)}
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
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  sectionHeader: { ...typography.label, marginBottom: spacing.xs, marginLeft: spacing.xs },
  sectionHint: { fontSize: 12, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { borderRadius: borderRadius.medium, overflow: 'hidden', ...shadows.card },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: spacing.md },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  pickerValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pickerText: { fontSize: 15, fontWeight: '500' },
  separator: { height: 1, marginLeft: 50 },
});
