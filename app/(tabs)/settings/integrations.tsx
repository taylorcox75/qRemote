/**
 * settings/integrations.tsx - Third-party integrations (TMDB posters).
 *
 * Key exports: IntegrationsSettingsScreen (default)
 * Lets the user opt in to TMDB artwork for recognised movies/series, store
 * their TMDB v3 API key (expo-secure-store, never AsyncStorage, see
 * services/tmdb.ts), and clear the local poster cache. Only the parsed
 * release title (and year) is ever sent to TMDB, never the raw torrent name,
 * see utils/release-name.ts.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useArtworkSettings } from '@/context/ArtworkContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { storageService } from '@/services/storage';
import { getTmdbApiKey, setTmdbApiKey } from '@/services/tmdb';
import { clearArtworkCache } from '@/services/artwork-store';
import { getErrorMessage } from '@/utils/error';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

const TMDB_API_SETTINGS_URL = 'https://www.themoviedb.org/settings/api';

export default function IntegrationsSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const { refresh: refreshArtwork } = useArtworkSettings();
  const queryClient = useQueryClient();

  const [postersEnabled, setPostersEnabled] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [removingKey, setRemovingKey] = useState(false);
  const [confirmRemoveKeyVisible, setConfirmRemoveKeyVisible] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const [prefs, storedKey] = await Promise.all([
        storageService.getPreferences(),
        getTmdbApiKey(),
      ]);
      setPostersEnabled(prefs.tmdbPostersEnabled === true);
      setHasKey(storedKey !== null);
    } catch {
      // Use defaults
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadState();
      // Never keep a typed secret sitting in memory across screen visits.
      setApiKeyInput('');
    }, [loadState]),
  );

  const handleToggle = async (value: boolean) => {
    setPostersEnabled(value);
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, tmdbPostersEnabled: value });
      await refreshArtwork();
    } catch (error) {
      setPostersEnabled(!value);
      showToast(getErrorMessage(error), 'error');
    }
  };

  // Shared by an explicit Save (always a non-empty key - the Save action is
  // disabled while the field is empty, see below) and the explicit "Remove
  // TMDB API key" row (always an empty key, behind its own ConfirmModal).
  const applyKeyChange = async (newKey: string) => {
    const trimmed = newKey.trim();
    await setTmdbApiKey(trimmed);
    const nowHasKey = trimmed.length > 0;
    setHasKey(nowHasKey);
    setApiKeyInput('');

    if (!nowHasKey && postersEnabled) {
      // A deleted key with the toggle still on would claim a feature that
      // can no longer do anything -- turn it off so the screen and the
      // actual behaviour stay in sync.
      setPostersEnabled(false);
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, tmdbPostersEnabled: false });
    }

    await refreshArtwork();
    // A saved (corrected) or removed key invalidates every previously
    // resolved lookup - drop them so already-mounted rows re-query
    // instead of showing artwork looked up under the old key.
    queryClient.removeQueries({ queryKey: ['artwork'] });
    showToast(
      nowHasKey
        ? t('screens.integrations.keySavedToast')
        : t('screens.integrations.keyRemovedToast'),
      'success',
    );
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      await applyKeyChange(apiKeyInput);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    setConfirmRemoveKeyVisible(false);
    setRemovingKey(true);
    try {
      await applyKeyChange('');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRemovingKey(false);
    }
  };

  const handleClearCache = async () => {
    setConfirmClearVisible(false);
    setClearingCache(true);
    try {
      await clearArtworkCache();
      // The store's cache is gone, but already-mounted rows still hold their
      // resolved TanStack Query results (staleTime: Infinity) - drop those
      // too, or "looked up again as needed" wouldn't actually happen.
      queryClient.removeQueries({ queryKey: ['artwork'] });
      showToast(t('screens.integrations.cacheClearedToast'), 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setClearingCache(false);
    }
  };

  const statusLabel =
    postersEnabled && hasKey
      ? t('screens.integrations.statusEnabled')
      : hasKey
        ? t('screens.integrations.keySavedDisabled')
        : t('screens.integrations.noKey');
  const statusColor = postersEnabled && hasKey ? colors.success : colors.textSecondary;

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
            {t('screens.settings.integrations')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.integrations.tmdbSection').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="image-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.integrations.showPosters')}
                  </Text>
                </View>
                <Switch
                  value={postersEnabled}
                  onValueChange={(value) => void handleToggle(value)}
                  trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.integrations.apiKeyLabel')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => void handleSaveKey()}
                    disabled={savingKey || !apiKeyInput.trim()}
                    style={{ opacity: savingKey || !apiKeyInput.trim() ? 0.4 : 1 }}
                  >
                    {savingKey ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={[styles.saveText, { color: colors.primary }]}>
                        {t('common.save')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.apiKeyInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.surfaceOutline,
                    },
                  ]}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  placeholder={
                    hasKey
                      ? t('screens.integrations.apiKeyPlaceholderSaved')
                      : t('screens.integrations.apiKeyPlaceholder')
                  }
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t('screens.integrations.status')}
                </Text>
                <Text style={[styles.statusValue, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              {hasKey && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => setConfirmRemoveKeyVisible(true)}
                    disabled={removingKey}
                    activeOpacity={0.7}
                  >
                    <View style={styles.settingLeft}>
                      <Ionicons name="key-outline" size={22} color={colors.error} />
                      <Text style={[styles.settingLabel, { color: colors.error }]}>
                        {t('screens.integrations.removeKey')}
                      </Text>
                    </View>
                    {removingKey && <ActivityIndicator size="small" color={colors.error} />}
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              {t('screens.integrations.footer')}
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(TMDB_API_SETTINGS_URL).catch(() => {})}
            >
              <Text style={[styles.hintLink, { color: colors.primary }]}>
                {t('screens.integrations.getKeyLink')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setConfirmClearVisible(true)}
                disabled={clearingCache}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                  <Text style={[styles.settingLabel, { color: colors.error }]}>
                    {t('screens.integrations.clearCache')}
                  </Text>
                </View>
                {clearingCache && <ActivityIndicator size="small" color={colors.error} />}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.attributionText, { color: colors.textSecondary }]}>
            {t('screens.integrations.attribution')}
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <ConfirmModal
        visible={confirmClearVisible}
        title={t('screens.integrations.clearCachePrompt')}
        message={t('screens.integrations.clearCacheHint')}
        buttons={[
          {
            label: t('common.delete'),
            destructive: true,
            onPress: () => void handleClearCache(),
          },
        ]}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmClearVisible(false)}
      />

      <ConfirmModal
        visible={confirmRemoveKeyVisible}
        title={t('screens.integrations.removeKeyPrompt')}
        message={t('screens.integrations.removeKeyHint')}
        buttons={[
          {
            label: t('common.remove'),
            destructive: true,
            onPress: () => void handleRemoveKey(),
          },
        ]}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmRemoveKeyVisible(false)}
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
  statusValue: { fontSize: 15, fontWeight: '600' },
  separator: { height: 1, marginLeft: 50 },
  fieldBlock: {
    paddingLeft: 50,
    paddingRight: 16,
    paddingVertical: 12,
    gap: spacing.xs,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveText: { fontSize: 15, fontWeight: '600' },
  apiKeyInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  hintLink: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginHorizontal: spacing.xs,
  },
  attributionText: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
