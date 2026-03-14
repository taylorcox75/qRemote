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
import { storageService } from '@/services/storage';
import { AppPreferences } from '@/types/preferences';
import { setHapticsEnabled } from '@/utils/haptics';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

export default function NotificationsSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();

  const [toastDuration, setToastDuration] = useState<number>(3000);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [])
  );

  const loadPreferences = async () => {
    try {
      const prefs = await storageService.getPreferences();
      setToastDuration(Number(prefs.toastDuration) || 3000);
      const hapticPref = prefs.hapticFeedback !== false;
      setHapticFeedback(hapticPref);
    } catch {
      // Use defaults
    }
  };

  const savePreference = async (key: keyof AppPreferences, value: any) => {
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, [key]: value });
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('screens.settings.notificationsFeedback')}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.notificationsFeedback').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="timer-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.notificationDuration')}</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.milliseconds')}</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.settingInput, { borderColor: colors.textSecondary, color: colors.text }]}
                  value={toastDuration.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 1000 && num <= 10000) {
                      setToastDuration(num);
                      savePreference('toastDuration', num);
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.hapticFeedback')}</Text>
                </View>
                <Switch
                  value={hapticFeedback}
                  onValueChange={(value) => {
                    setHapticFeedback(value);
                    setHapticsEnabled(value);
                    savePreference('hapticFeedback', value);
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
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
