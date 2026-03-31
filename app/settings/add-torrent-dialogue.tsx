import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { storageService } from '@/services/storage';
import { AppPreferences, AddTorrentDialogField, DEFAULT_PREFERENCES } from '@/types/preferences';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

const FIELD_ORDER: AddTorrentDialogField[] = [
  'source',
  'savePath',
  'category',
  'tags',
  'rename',
  'stopped',
  'skipChecking',
  'rootFolder',
  'autoTMM',
  'sequentialDownload',
  'firstLastPiecePrio',
  'dlLimit',
  'upLimit',
  'ratioLimit',
  'seedingTimeLimit',
  'cookie',
];

export default function AddTorrentDialogueSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();

  const [useFull, setUseFull] = useState(false);
  const [fields, setFields] = useState<Record<AddTorrentDialogField, boolean>>(DEFAULT_PREFERENCES.addTorrentDialogueFields);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const prefs = await storageService.getPreferences();
          setUseFull(!!prefs.useFullAddTorrentDialogue);
          const stored = (prefs.addTorrentDialogueFields as Partial<typeof fields>) || {};
          const normalized = { ...DEFAULT_PREFERENCES.addTorrentDialogueFields, ...stored, source: true };
          setFields(normalized);
          if (stored.source === false) {
            await storageService.savePreferences({ ...prefs, addTorrentDialogueFields: normalized });
          }
        } catch {
          setUseFull(false);
          setFields(DEFAULT_PREFERENCES.addTorrentDialogueFields);
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

  const toggleField = useCallback(
    (field: AddTorrentDialogField, value: boolean) => {
      if (field === 'source') return;
      setFields((prev) => {
        const next = { ...prev, [field]: value, source: true };
        void savePreference('addTorrentDialogueFields', next as AppPreferences['addTorrentDialogueFields']);
        return next;
      });
    },
    []
  );

  const fieldMeta = useMemo(() => {
    const map: Record<AddTorrentDialogField, { icon: React.ComponentProps<typeof Ionicons>['name']; labelKey: string }> = {
      source: { icon: 'link-outline', labelKey: 'screens.settings.addTorrentDialogueFields.source' },
      savePath: { icon: 'folder-outline', labelKey: 'screens.settings.addTorrentDialogueFields.savePath' },
      category: { icon: 'folder-open-outline', labelKey: 'screens.settings.addTorrentDialogueFields.category' },
      tags: { icon: 'pricetag-outline', labelKey: 'screens.settings.addTorrentDialogueFields.tags' },
      rename: { icon: 'text-outline', labelKey: 'screens.settings.addTorrentDialogueFields.rename' },
      stopped: { icon: 'pause-circle-outline', labelKey: 'screens.settings.addTorrentDialogueFields.stopped' },
      skipChecking: { icon: 'checkmark-done-outline', labelKey: 'screens.settings.addTorrentDialogueFields.skipChecking' },
      rootFolder: { icon: 'folder-outline', labelKey: 'screens.settings.addTorrentDialogueFields.rootFolder' },
      autoTMM: { icon: 'sync-outline', labelKey: 'screens.settings.addTorrentDialogueFields.autoTMM' },
      sequentialDownload: { icon: 'swap-vertical-outline', labelKey: 'screens.settings.addTorrentDialogueFields.sequentialDownload' },
      firstLastPiecePrio: { icon: 'layers-outline', labelKey: 'screens.settings.addTorrentDialogueFields.firstLastPiecePrio' },
      dlLimit: { icon: 'download-outline', labelKey: 'screens.settings.addTorrentDialogueFields.dlLimit' },
      upLimit: { icon: 'arrow-up-outline', labelKey: 'screens.settings.addTorrentDialogueFields.upLimit' },
      ratioLimit: { icon: 'swap-horizontal-outline', labelKey: 'screens.settings.addTorrentDialogueFields.ratioLimit' },
      seedingTimeLimit: { icon: 'time-outline', labelKey: 'screens.settings.addTorrentDialogueFields.seedingTimeLimit' },
      cookie: { icon: 'document-text-outline', labelKey: 'screens.settings.addTorrentDialogueFields.cookie' },
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('screens.settings.addTorrentDialogue')}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.addTorrentDialogue').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="albums-outline" size={22} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.useFullDialogue')}</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                      {t('screens.settings.useFullDialogueHint')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={useFull}
                  onValueChange={(value) => {
                    setUseFull(value);
                    void savePreference('useFullAddTorrentDialogue', value);
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
            </View>
          </View>

          {useFull && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.fullDialogueFields').toUpperCase()}
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
                          <Text style={[styles.settingLabel, { color: colors.text }]}>{t(meta.labelKey)}</Text>
                        </View>
                        <Switch
                          value={value}
                          onValueChange={(v) => toggleField(field, v)}
                          disabled={field === 'source'}
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
          )}
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
  sectionHeader: { ...typography.label, marginBottom: spacing.sm, marginLeft: spacing.xs },
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
  settingHint: { fontSize: 12, marginTop: 1 },
  separator: { height: 1, marginLeft: 50 },
});

