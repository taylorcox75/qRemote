import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { storageService } from '@/services/storage';
import { AppPreferences, ExpandedCardField, DEFAULT_PREFERENCES } from '@/types/preferences';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

const FIELD_ORDER: ExpandedCardField[] = [
  'dlSpeed',
  'ulSpeed',
  'eta',
  'status',
  'seeds',
  'peers',
  'ratio',
  'uploaded',
  'availability',
  'progress',
  'addedOn',
  'seedingTime',
  'tags',
  'category',
  'tracker',
  'savePath',
];

export default function DetailedCardFieldsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();

  const [fields, setFields] = useState<Record<ExpandedCardField, boolean>>(
    DEFAULT_PREFERENCES.expandedCardFields
  );

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const prefs = await storageService.getPreferences();
          const stored = (prefs.expandedCardFields as Partial<Record<ExpandedCardField, boolean>>) || {};
          setFields({ ...DEFAULT_PREFERENCES.expandedCardFields, ...stored });
        } catch {
          setFields(DEFAULT_PREFERENCES.expandedCardFields);
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

  const fieldMeta = useMemo(() => {
    const map: Record<ExpandedCardField, { icon: React.ComponentProps<typeof Ionicons>['name']; labelKey: string }> = {
      dlSpeed: { icon: 'download-outline', labelKey: 'screens.settings.expandedCardFieldsList.dlSpeed' },
      ulSpeed: { icon: 'arrow-up-outline', labelKey: 'screens.settings.expandedCardFieldsList.ulSpeed' },
      eta: { icon: 'time-outline', labelKey: 'screens.settings.expandedCardFieldsList.eta' },
      status: { icon: 'ellipse-outline', labelKey: 'screens.settings.expandedCardFieldsList.status' },
      seeds: { icon: 'leaf-outline', labelKey: 'screens.settings.expandedCardFieldsList.seeds' },
      peers: { icon: 'people-outline', labelKey: 'screens.settings.expandedCardFieldsList.peers' },
      ratio: { icon: 'swap-horizontal-outline', labelKey: 'screens.settings.expandedCardFieldsList.ratio' },
      uploaded: { icon: 'cloud-upload-outline', labelKey: 'screens.settings.expandedCardFieldsList.uploaded' },
      availability: { icon: 'stats-chart-outline', labelKey: 'screens.settings.expandedCardFieldsList.availability' },
      savePath: { icon: 'folder-outline', labelKey: 'screens.settings.expandedCardFieldsList.savePath' },
      tracker: { icon: 'globe-outline', labelKey: 'screens.settings.expandedCardFieldsList.tracker' },
      addedOn: { icon: 'calendar-outline', labelKey: 'screens.settings.expandedCardFieldsList.addedOn' },
      seedingTime: { icon: 'hourglass-outline', labelKey: 'screens.settings.expandedCardFieldsList.seedingTime' },
      tags: { icon: 'pricetag-outline', labelKey: 'screens.settings.expandedCardFieldsList.tags' },
      category: { icon: 'folder-open-outline', labelKey: 'screens.settings.expandedCardFieldsList.category' },
      progress: { icon: 'pie-chart-outline', labelKey: 'screens.settings.expandedCardFieldsList.progress' },
    };
    return map;
  }, []);

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7}>
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
              {t('screens.settings.expandedCardFields')}
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              {t('screens.settings.expandedCardFieldsHint')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {FIELD_ORDER.map((field, idx) => {
                const meta = fieldMeta[field];
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
      </SafeAreaView>
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
  separator: { height: 1, marginLeft: 50 },
});
