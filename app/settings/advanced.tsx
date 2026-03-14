import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { storageService } from '@/services/storage';
import { apiClient } from '@/services/api/client';
import { applicationApi } from '@/services/api/application';
import { ServerManager } from '@/services/server-manager';
import { setDebugMode as setConnectivityDebugMode } from '@/services/connectivity-log';
import { haptics } from '@/utils/haptics';
import { APP_VERSION } from '@/utils/version';
import { AppPreferences } from '@/types/preferences';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { getErrorMessage } from '@/utils/error';

export default function AdvancedSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { isConnected } = useServer();
  const { showToast } = useToast();

  const [apiTimeout, setApiTimeout] = useState<number>(30000);
  const [retryAttempts, setRetryAttempts] = useState<number>(3);
  const [debugMode, setDebugMode] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState<number>(10000);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [])
  );

  const loadPreferences = async () => {
    try {
      const prefs = await storageService.getPreferences();
      setApiTimeout(Number(prefs.apiTimeout) || 30000);
      setRetryAttempts(Number(prefs.retryAttempts) || 3);
      setDebugMode(prefs.debugMode || false);
      setConnectionTimeout(Number(prefs.connectionTimeout) || 10000);
    } catch {
      // Use defaults
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

  const exportSettings = async () => {
    try {
      const prefs = await storageService.getPreferences();
      const servers = await ServerManager.getServers();
      const exportData = {
        preferences: prefs,
        servers: servers.map(s => ({
          id: s.id,
          name: s.name,
          host: s.host,
          port: s.port,
          basePath: s.basePath,
          username: s.username,
          useHttps: s.useHttps,
          bypassAuth: s.bypassAuth,
        })),
        exportDate: new Date().toISOString(),
        appVersion: APP_VERSION,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const docDir = FileSystem.documentDirectory;
      if (!docDir) {
        showToast(t('errors.fileSystemNotAvailable'), 'error');
        return;
      }

      const fileName = 'qremote-settings.json';
      const fileUri = `${docDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonString);

      if (await Sharing.isAvailableAsync()) {
        const shareOptions: Sharing.SharingOptions = {
          mimeType: 'application/json',
          dialogTitle: 'Save Settings',
        };
        if (Platform.OS === 'ios') {
          shareOptions.UTI = 'public.json';
        }
        await Sharing.shareAsync(fileUri, shareOptions);
      } else {
        showToast(t('errors.sharingNotAvailable'), 'error');
      }
    } catch (error: unknown) {
      console.error('Export settings error:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const importSettings = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      const importData = JSON.parse(fileContent);

      if (!importData.preferences || !importData.servers) {
        showToast(t('errors.invalidSettingsFormat'), 'error');
        return;
      }

      await storageService.savePreferences(importData.preferences);

      const existingServers = await ServerManager.getServers();
      const existingServerIds = new Set(existingServers.map(s => s.id));

      for (const serverData of importData.servers) {
        if (!existingServerIds.has(serverData.id)) {
          await ServerManager.saveServer({ ...serverData, password: '' });
        }
      }

      await loadPreferences();
      showToast(t('toast.settingsImported'), 'success');
    } catch (error: unknown) {
      console.error('Import settings error:', error);
      if (getErrorMessage(error).includes('JSON')) {
        showToast(t('errors.failedToParseSettings'), 'error');
      } else {
        showToast(getErrorMessage(error), 'error');
      }
    }
  };

  const handleShutdown = () => {
    Alert.alert(
      t('screens.settings.shutdownQbittorrent'),
      t('alerts.shutdownConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('screens.settings.shutdownQbittorrent'),
          style: 'destructive',
          onPress: async () => {
            haptics.heavy();
            try {
              await applicationApi.shutdown();
              showToast(t('toast.shutdownInitiated'), 'success');
            } catch {
              showToast(t('errors.failedToShutdown'), 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('screens.settings.advanced')}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Connection */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.serverManagement').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="timer-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.connectionTimeout')}</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.milliseconds')}</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.settingInput, { borderColor: colors.textSecondary, color: colors.text }]}
                  value={connectionTimeout.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 1000 && num <= 60000) {
                      setConnectionTimeout(num);
                      savePreference('connectionTimeout', num);
                      apiClient.updateSettings({ connectionTimeout: num });
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.apiTimeout')}</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.milliseconds')}</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.settingInput, { borderColor: colors.textSecondary, color: colors.text }]}
                  value={apiTimeout.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 5000 && num <= 120000) {
                      setApiTimeout(num);
                      savePreference('apiTimeout', num);
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="repeat-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.retryAttempts')}</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.retryAttemptsHint')}</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.settingInput, { borderColor: colors.textSecondary, color: colors.text }]}
                  value={retryAttempts.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 0 && num <= 10) {
                      setRetryAttempts(num);
                      savePreference('retryAttempts', num);
                      apiClient.updateSettings({ retryAttempts: num });
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* Debug */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.debug')}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="bug-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.debugMode')}</Text>
                </View>
                <Switch
                  value={debugMode}
                  onValueChange={(value) => {
                    setDebugMode(value);
                    setConnectivityDebugMode(value);
                    savePreference('debugMode', value);
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => router.push('/(tabs)/logs')}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.viewLogs')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Backup & Restore */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.backupRestore').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity style={styles.settingRow} onPress={exportSettings}>
                <View style={styles.settingLeft}>
                  <Ionicons name="download-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.exportSettings')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <TouchableOpacity style={styles.settingRow} onPress={importSettings}>
                <View style={styles.settingLeft}>
                  <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.importSettings')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Danger Zone */}
          {isConnected && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.error }]}>{t('screens.settings.dangerZone').toUpperCase()}</Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={styles.dangerRow} onPress={handleShutdown}>
                  <View style={styles.dangerLeft}>
                    <Ionicons name="power-outline" size={22} color={colors.error} />
                    <View>
                      <Text style={[styles.dangerLabel, { color: colors.error }]}>{t('screens.settings.shutdownQbittorrent')}</Text>
                      <Text style={[styles.dangerHint, { color: colors.textSecondary }]}>{t('screens.settings.shutdownHint')}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
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
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  dangerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dangerLabel: { ...typography.bodyMedium },
  dangerHint: { ...typography.caption, marginTop: 1 },
});
