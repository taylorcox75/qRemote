import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { storageService } from '@/services/storage';
import { AppPreferences } from '@/types/preferences';
import { getStoredLanguage, setStoredLanguage } from '@/i18n';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

export default function AppearanceSettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isDark, toggleTheme, colors, reloadCustomColors } = useTheme();

  const [autoRefreshInterval, setAutoRefreshInterval] = useState('1000');
  const [cardViewMode, setCardViewMode] = useState<'compact' | 'expanded'>('compact');
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  const languageOptions: OptionPickerItem[] = [
    { label: 'English', value: 'en', icon: 'language-outline' },
    { label: 'Español', value: 'es', icon: 'language-outline' },
    { label: '中文', value: 'zh', icon: 'language-outline' },
    { label: 'Français', value: 'fr', icon: 'language-outline' },
    { label: 'Deutsch', value: 'de', icon: 'language-outline' },
    { label: 'Русский', value: 'ru', icon: 'language-outline' },
  ];

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [])
  );

  const loadPreferences = async () => {
    try {
      const prefs = await storageService.getPreferences();
      const interval = Number(prefs.autoRefreshInterval) || 1000;
      setAutoRefreshInterval(interval.toString());
      setCardViewMode(prefs.cardViewMode || 'compact');
    } catch {
      setAutoRefreshInterval('1000');
      setCardViewMode('compact');
    }
  };

  const savePreference = async <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, [key]: value });
    } catch {
      // Ignore save errors
    }
  };

  const saveAutoRefreshInterval = async (interval: string) => {
    try {
      const prefs = await storageService.getPreferences();
      prefs.autoRefreshInterval = parseInt(interval, 10);
      await storageService.savePreferences(prefs);
    } catch {
      // Ignore save errors
    }
  };

  const saveCardViewMode = async (mode: 'compact' | 'expanded') => {
    try {
      const prefs = await storageService.getPreferences();
      prefs.cardViewMode = mode;
      await storageService.savePreferences(prefs);
      setCardViewMode(mode);
    } catch {
      // Ignore save errors
    }
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('screens.settings.appearance')}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Language */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.language').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="language-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.language')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setLanguagePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {languageOptions.find((opt) => opt.value === ((i18n.language || 'en').startsWith('zh') ? 'zh' : (i18n.language || 'en')))?.label || 'English'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Theme & Colors */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.appearance').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => router.push('/settings/theme')}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="color-palette-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.themeAndColors')}</Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      {t('screens.settings.themeDescription')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => router.push('/settings/add-torrent-dialogue')}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.addTorrentDialogue')}</Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      {t('screens.settings.addTorrentDialogueDescription')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={cardViewMode === 'expanded' ? 'albums-outline' : 'list-outline'}
                    size={22}
                    color={colors.primary}
                  />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.detailedCardView')}</Text>
                </View>
                <Switch
                  value={cardViewMode === 'expanded'}
                  onValueChange={(value) => saveCardViewMode(value ? 'expanded' : 'compact')}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => router.push('/settings/detailed-card-fields')}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="list-circle-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.detailedCardFields')}</Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      {t('screens.settings.detailedCardFieldsDescription')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="refresh-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.refreshInterval')}</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.milliseconds')}</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.settingInput, { borderColor: colors.textSecondary, color: colors.text }]}
                  value={autoRefreshInterval}
                  onChangeText={setAutoRefreshInterval}
                  onBlur={() => saveAutoRefreshInterval(autoRefreshInterval)}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <OptionPicker
        visible={languagePickerVisible}
        title={t('screens.settings.language')}
        options={languageOptions}
        selectedValue={(i18n.language || 'en').startsWith('zh') ? 'zh' : (i18n.language || 'en')}
        onSelect={async (value) => {
          await setStoredLanguage(value);
          await i18n.changeLanguage(value);
          setLanguagePickerVisible(false);
        }}
        onClose={() => setLanguagePickerVisible(false)}
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
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    ...shadows.card,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  settingHint: {
    fontSize: 12,
    marginTop: 1,
  },
  separator: {
    height: 1,
    marginLeft: 50,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingInput: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 15,
    width: 80,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
});
