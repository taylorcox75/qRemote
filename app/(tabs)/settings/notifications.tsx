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
import { useTheme } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { storageService } from '@/services/storage';
import {
  AppPreferences,
  SoundActionKey,
  SoundEffectChoice,
  DEFAULT_PREFERENCES,
} from '@/types/preferences';
import { setHapticsEnabled } from '@/utils/haptics';
import { setSoundEffectsEnabled, setSoundEffectActions } from '@/utils/sounds';
import { playUiSound } from '@/modules/ui-sounds';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

const SOUND_ACTION_KEYS: SoundActionKey[] = [
  'reannounce',
  'pauseResume',
  'forceStart',
  'verifyData',
  'actionError',
];

export default function NotificationsSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();

  const [toastDuration, setToastDuration] = useState<number>(3000);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(false);
  const [soundActions, setSoundActions] = useState<Record<SoundActionKey, SoundEffectChoice>>(
    DEFAULT_PREFERENCES.soundEffectActions,
  );
  const [activeSoundPicker, setActiveSoundPicker] = useState<SoundActionKey | null>(null);

  const soundActionLabels: Record<SoundActionKey, string> = {
    reannounce: t('screens.settings.soundActionReannounce'),
    pauseResume: t('screens.settings.soundActionPauseResume'),
    forceStart: t('screens.settings.soundActionForceStart'),
    verifyData: t('screens.settings.soundActionVerifyData'),
    actionError: t('screens.settings.soundActionError'),
  };

  const soundChoiceOptions: OptionPickerItem[] = [
    { label: t('screens.settings.soundChoiceNone'), value: 'none', icon: 'volume-mute-outline' },
    { label: t('screens.settings.soundChoiceTap'), value: 'tap', icon: 'radio-button-on-outline' },
    {
      label: t('screens.settings.soundChoiceFanfare'),
      value: 'reannounce',
      icon: 'megaphone-outline',
    },
    { label: t('screens.settings.soundChoiceChime'), value: 'success', icon: 'sparkles-outline' },
    { label: t('screens.settings.soundChoiceAlert'), value: 'error', icon: 'warning-outline' },
  ];

  const loadPreferences = async () => {
    try {
      const prefs = await storageService.getPreferences();
      setToastDuration(Number(prefs.toastDuration) || 3000);
      const hapticPref = prefs.hapticFeedback !== false;
      setHapticFeedback(hapticPref);
      setSoundEffectsEnabledState(prefs.soundEffectsEnabled === true);
      setSoundActions(prefs.soundEffectActions ?? DEFAULT_PREFERENCES.soundEffectActions);
    } catch {
      // Use defaults
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, []),
  );

  const savePreference = async <K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K],
  ) => {
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
            {t('screens.settings.notificationsFeedback')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.notificationsFeedback').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="timer-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.notificationDuration')}
                    </Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                      {t('screens.settings.milliseconds')}
                    </Text>
                  </View>
                </View>
                <TextInput
                  style={[
                    styles.settingInput,
                    { borderColor: colors.textSecondary, color: colors.text },
                  ]}
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
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.hapticFeedback')}
                  </Text>
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

          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.soundEffects').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="musical-notes-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.soundEffects')}
                  </Text>
                </View>
                <Switch
                  value={soundEffectsEnabled}
                  onValueChange={(value) => {
                    setSoundEffectsEnabledState(value);
                    setSoundEffectsEnabled(value);
                    savePreference('soundEffectsEnabled', value);
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>

              {soundEffectsEnabled &&
                SOUND_ACTION_KEYS.map((actionKey) => {
                  const choice = soundActions[actionKey];
                  const choiceLabel = soundChoiceOptions.find((opt) => opt.value === choice)?.label;
                  return (
                    <View key={actionKey}>
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                      <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                          <Text style={[styles.settingLabel, { color: colors.text }]}>
                            {soundActionLabels[actionKey]}
                          </Text>
                        </View>
                        <View style={styles.soundActionControls}>
                          <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setActiveSoundPicker(actionKey)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.pickerText, { color: colors.text }]}>
                              {choiceLabel}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => choice !== 'none' && playUiSound(choice)}
                            disabled={choice === 'none'}
                            activeOpacity={0.7}
                            accessibilityLabel={t('screens.settings.previewSound')}
                          >
                            <Ionicons
                              name="play-circle-outline"
                              size={24}
                              color={choice === 'none' ? colors.textSecondary : colors.primary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        </ScrollView>
      </View>

      <OptionPicker
        visible={activeSoundPicker !== null}
        title={activeSoundPicker ? soundActionLabels[activeSoundPicker] : ''}
        options={soundChoiceOptions}
        selectedValue={activeSoundPicker ? soundActions[activeSoundPicker] : undefined}
        onSelect={(value) => {
          if (!activeSoundPicker) return;
          const nextActions = { ...soundActions, [activeSoundPicker]: value as SoundEffectChoice };
          setSoundActions(nextActions);
          setSoundEffectActions(nextActions);
          savePreference('soundEffectActions', nextActions);
          setActiveSoundPicker(null);
        }}
        onClose={() => setActiveSoundPicker(null)}
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
  sectionHeader: { ...typography.label, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { borderRadius: borderRadius.medium, overflow: 'hidden', ...shadows.card },
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
  pickerButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pickerText: { fontSize: 16, fontWeight: '500' },
  soundActionControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
