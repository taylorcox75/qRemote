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
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { applicationApi } from '@/services/api/application';
import { ApplicationPreferences } from '@/types/api';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

export default function ServerSettingsAdvancedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();

  const [mailEnabled, setMailEnabled] = useState(false);
  const [mailSender, setMailSender] = useState('');
  const [mailRecipient, setMailRecipient] = useState('');
  const [mailSmtp, setMailSmtp] = useState('');
  const [mailEncryption, setMailEncryption] = useState<'None' | 'STARTTLS' | 'SMTPS'>('None');
  const [mailAuthEnabled, setMailAuthEnabled] = useState(false);
  const [mailUsername, setMailUsername] = useState('');
  const [mailPassword, setMailPassword] = useState('');

  const [autorunOnAddedEnabled, setAutorunOnAddedEnabled] = useState(false);
  const [autorunOnAddedProgram, setAutorunOnAddedProgram] = useState('');
  const [autorunEnabled, setAutorunEnabled] = useState(false);
  const [autorunProgram, setAutorunProgram] = useState('');

  const [encryptionPickerVisible, setEncryptionPickerVisible] = useState(false);

  const encryptionOptions: OptionPickerItem[] = [
    {
      label: t('screens.settings.emailEncryptionNone'),
      value: 'None',
      icon: 'close-circle-outline',
    },
    {
      label: t('screens.settings.emailEncryptionStartTls'),
      value: 'STARTTLS',
      icon: 'lock-open-outline',
    },
    {
      label: t('screens.settings.emailEncryptionSmtps'),
      value: 'SMTPS',
      icon: 'lock-closed-outline',
    },
  ];

  const loadPreferences = async () => {
    try {
      const prefs = (await applicationApi.getPreferences()) as Record<string, unknown>;
      setMailEnabled(!!prefs.mail_notification_enabled);
      setMailSender((prefs.mail_notification_sender as string) || '');
      setMailRecipient((prefs.mail_notification_email as string) || '');
      setMailSmtp((prefs.mail_notification_smtp as string) || '');
      setMailEncryption(
        (prefs.mail_notification_encryption_type as 'None' | 'STARTTLS' | 'SMTPS') || 'None',
      );
      setMailAuthEnabled(!!prefs.mail_notification_auth_enabled);
      setMailUsername((prefs.mail_notification_username as string) || '');
      setMailPassword((prefs.mail_notification_password as string) || '');

      setAutorunOnAddedEnabled(!!prefs.autorun_on_torrent_added_enabled);
      setAutorunOnAddedProgram((prefs.autorun_on_torrent_added_program as string) || '');
      setAutorunEnabled(!!prefs.autorun_enabled);
      setAutorunProgram((prefs.autorun_program as string) || '');
    } catch {
      // Not connected / failed to load — leave defaults
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, []),
  );

  const setServerPreference = async <K extends keyof ApplicationPreferences>(
    key: K,
    value: ApplicationPreferences[K],
    applyLocally: () => void,
    rollback: () => void,
  ) => {
    applyLocally();
    try {
      await applicationApi.setPreferences({ [key]: value });
      showToast(t('toast.serverSettingUpdated'), 'success');
    } catch {
      rollback();
      showToast(t('errors.failedToUpdateServerSetting'), 'error');
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
            {t('screens.settings.advancedServerSettings')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Email Notifications */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.emailNotifications').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="mail-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.emailNotificationsEnabled')}
                  </Text>
                </View>
                <Switch
                  value={mailEnabled}
                  onValueChange={(value) => {
                    const prev = mailEnabled;
                    setServerPreference(
                      'mail_notification_enabled',
                      value,
                      () => setMailEnabled(value),
                      () => setMailEnabled(prev),
                    );
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              {mailEnabled && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('screens.settings.emailFromAddress')}
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text }]}
                      placeholder={t('screens.settings.emailFromAddressPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={mailSender}
                      onChangeText={setMailSender}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={() => {
                        const prev = mailSender;
                        setServerPreference(
                          'mail_notification_sender',
                          mailSender,
                          () => {},
                          () => setMailSender(prev),
                        );
                      }}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('screens.settings.emailToAddress')}
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text }]}
                      placeholder={t('screens.settings.emailToAddressPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={mailRecipient}
                      onChangeText={setMailRecipient}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={() => {
                        const prev = mailRecipient;
                        setServerPreference(
                          'mail_notification_email',
                          mailRecipient,
                          () => {},
                          () => setMailRecipient(prev),
                        );
                      }}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('screens.settings.emailSmtpServer')}
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text }]}
                      placeholder={t('screens.settings.emailSmtpServerPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={mailSmtp}
                      onChangeText={setMailSmtp}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={() => {
                        const prev = mailSmtp;
                        setServerPreference(
                          'mail_notification_smtp',
                          mailSmtp,
                          () => {},
                          () => setMailSmtp(prev),
                        );
                      }}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.emailEncryption')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setEncryptionPickerVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerText, { color: colors.text }]}>
                        {encryptionOptions.find((opt) => opt.value === mailEncryption)?.label}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Ionicons name="key-outline" size={22} color={colors.primary} />
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.emailAuthentication')}
                      </Text>
                    </View>
                    <Switch
                      value={mailAuthEnabled}
                      onValueChange={(value) => {
                        const prev = mailAuthEnabled;
                        setServerPreference(
                          'mail_notification_auth_enabled',
                          value,
                          () => setMailAuthEnabled(value),
                          () => setMailAuthEnabled(prev),
                        );
                      }}
                      trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                      ios_backgroundColor={colors.surfaceOutline}
                    />
                  </View>
                  {mailAuthEnabled && (
                    <>
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                      <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          {t('screens.settings.emailUsername')}
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { color: colors.text }]}
                          placeholder={t('screens.settings.emailUsernamePlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                          value={mailUsername}
                          onChangeText={setMailUsername}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onBlur={() => {
                            const prev = mailUsername;
                            setServerPreference(
                              'mail_notification_username',
                              mailUsername,
                              () => {},
                              () => setMailUsername(prev),
                            );
                          }}
                        />
                      </View>
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                      <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          {t('screens.settings.emailPassword')}
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { color: colors.text }]}
                          placeholder={t('screens.settings.emailPasswordPlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                          value={mailPassword}
                          onChangeText={setMailPassword}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          onBlur={() => {
                            const prev = mailPassword;
                            setServerPreference(
                              'mail_notification_password',
                              mailPassword,
                              () => {},
                              () => setMailPassword(prev),
                            );
                          }}
                        />
                      </View>
                    </>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Automation */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.automationSection').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.runOnTorrentAdded')}
                  </Text>
                </View>
                <Switch
                  value={autorunOnAddedEnabled}
                  onValueChange={(value) => {
                    const prev = autorunOnAddedEnabled;
                    setServerPreference(
                      'autorun_on_torrent_added_enabled',
                      value,
                      () => setAutorunOnAddedEnabled(value),
                      () => setAutorunOnAddedEnabled(prev),
                    );
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              {autorunOnAddedEnabled && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text, flex: 1 }]}
                      placeholder={t('screens.settings.runProgramPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={autorunOnAddedProgram}
                      onChangeText={setAutorunOnAddedProgram}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={() => {
                        const prev = autorunOnAddedProgram;
                        setServerPreference(
                          'autorun_on_torrent_added_program',
                          autorunOnAddedProgram,
                          () => {},
                          () => setAutorunOnAddedProgram(prev),
                        );
                      }}
                    />
                  </View>
                </>
              )}
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="checkmark-done-circle-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.runOnTorrentFinished')}
                  </Text>
                </View>
                <Switch
                  value={autorunEnabled}
                  onValueChange={(value) => {
                    const prev = autorunEnabled;
                    setServerPreference(
                      'autorun_enabled',
                      value,
                      () => setAutorunEnabled(value),
                      () => setAutorunEnabled(prev),
                    );
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              {autorunEnabled && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text, flex: 1 }]}
                      placeholder={t('screens.settings.runProgramPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={autorunProgram}
                      onChangeText={setAutorunProgram}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={() => {
                        const prev = autorunProgram;
                        setServerPreference(
                          'autorun_program',
                          autorunProgram,
                          () => {},
                          () => setAutorunProgram(prev),
                        );
                      }}
                    />
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <OptionPicker
        visible={encryptionPickerVisible}
        title={t('screens.settings.emailEncryption')}
        options={encryptionOptions}
        selectedValue={mailEncryption}
        onSelect={(value) => {
          const encryption = value as 'None' | 'STARTTLS' | 'SMTPS';
          const prev = mailEncryption;
          setEncryptionPickerVisible(false);
          setServerPreference(
            'mail_notification_encryption_type',
            encryption,
            () => setMailEncryption(encryption),
            () => setMailEncryption(prev),
          );
        }}
        onClose={() => setEncryptionPickerVisible(false)}
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
  settingLabel: { fontSize: 16, fontWeight: '500', flexShrink: 1 },
  separator: { height: 1, marginLeft: 50 },
  pickerButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pickerText: { fontSize: 16, fontWeight: '500' },
  fieldRow: { paddingHorizontal: 16, paddingVertical: 8 },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  fieldInput: { fontSize: 16, paddingVertical: 4 },
});
