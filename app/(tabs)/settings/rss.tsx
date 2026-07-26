import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { applicationApi } from '@/services/api/application';
import { getErrorMessage } from '@/utils/error';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

type BoolPrefKey =
  'rss_processing_enabled' | 'rss_auto_downloading_enabled' | 'rss_download_repack_proper_episodes';

export default function RssSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const { isConnected } = useServer();
  const { showToast } = useToast();

  const [prefs, setPrefs] = useState({
    rss_processing_enabled: false,
    rss_auto_downloading_enabled: false,
    rss_download_repack_proper_episodes: false,
  });
  const [saving, setSaving] = useState<BoolPrefKey | null>(null);

  // rss_smart_episode_filters is a server-side string preference (one regex
  // pattern per line), not a boolean — edited inline and saved explicitly
  // rather than per-keystroke.
  const [filtersText, setFiltersText] = useState('');
  const [savedFiltersText, setSavedFiltersText] = useState('');
  const [savingFilters, setSavingFilters] = useState(false);
  const filtersDirty = filtersText !== savedFiltersText;

  // Integer preferences, edited as text and committed on blur (not
  // per-keystroke) to avoid a setPreferences round-trip on every digit typed.
  const [refreshIntervalText, setRefreshIntervalText] = useState('');
  const [fetchDelayText, setFetchDelayText] = useState('');
  const [maxArticlesText, setMaxArticlesText] = useState('');
  const savedNumbersRef = React.useRef({
    rss_refresh_interval: '',
    rss_fetch_delay: '',
    rss_max_articles_per_feed: '',
  });

  useFocusEffect(
    useCallback(() => {
      if (!isConnected) return;
      applicationApi
        .getPreferences()
        .then((p) => {
          setPrefs({
            rss_processing_enabled: p.rss_processing_enabled === true,
            rss_auto_downloading_enabled: p.rss_auto_downloading_enabled === true,
            rss_download_repack_proper_episodes: p.rss_download_repack_proper_episodes === true,
          });
          const filters =
            typeof p.rss_smart_episode_filters === 'string' ? p.rss_smart_episode_filters : '';
          setFiltersText(filters);
          setSavedFiltersText(filters);

          const refreshInterval =
            typeof p.rss_refresh_interval === 'number' ? String(p.rss_refresh_interval) : '';
          const fetchDelay = typeof p.rss_fetch_delay === 'number' ? String(p.rss_fetch_delay) : '';
          const maxArticles =
            typeof p.rss_max_articles_per_feed === 'number'
              ? String(p.rss_max_articles_per_feed)
              : '';
          setRefreshIntervalText(refreshInterval);
          setFetchDelayText(fetchDelay);
          setMaxArticlesText(maxArticles);
          savedNumbersRef.current = {
            rss_refresh_interval: refreshInterval,
            rss_fetch_delay: fetchDelay,
            rss_max_articles_per_feed: maxArticles,
          };
        })
        .catch(() => {});
    }, [isConnected]),
  );

  const handleToggle = async (key: BoolPrefKey, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaving(key);
    try {
      await applicationApi.setPreferences({ [key]: value });
      if (key === 'rss_processing_enabled') {
        queryClient.invalidateQueries({ queryKey: ['application', 'preferences'] });
      }
    } catch (error) {
      setPrefs((prev) => ({ ...prev, [key]: !value }));
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveFilters = async () => {
    setSavingFilters(true);
    try {
      await applicationApi.setPreferences({ rss_smart_episode_filters: filtersText });
      setSavedFiltersText(filtersText);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSavingFilters(false);
    }
  };

  const handleNumberBlur = async (
    key: 'rss_refresh_interval' | 'rss_fetch_delay' | 'rss_max_articles_per_feed',
    text: string,
    setText: (v: string) => void,
  ) => {
    const parsed = parseInt(text, 10);
    if (isNaN(parsed) || parsed < 0) {
      setText(savedNumbersRef.current[key]);
      return;
    }
    const normalized = String(parsed);
    setText(normalized);
    if (normalized === savedNumbersRef.current[key]) return;
    try {
      await applicationApi.setPreferences({ [key]: parsed });
      savedNumbersRef.current[key] = normalized;
    } catch (error) {
      setText(savedNumbersRef.current[key]);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const disabled = !isConnected;

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
            {t('screens.settings.rss')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* RSS Reader */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.qbittorrentServer').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <ToggleRow
                icon="logo-rss"
                label={t('screens.settings.rssProcessingEnabled')}
                hint={t('screens.settings.rssProcessingEnabledHint')}
                value={prefs.rss_processing_enabled}
                disabled={disabled || saving !== null}
                colors={colors}
                onToggle={(v) => void handleToggle('rss_processing_enabled', v)}
              />
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <ToggleRow
                icon="download-outline"
                label={t('screens.settings.rssAutoDownloading')}
                hint={t('screens.settings.rssAutoDownloadingHint')}
                value={prefs.rss_auto_downloading_enabled}
                disabled={disabled || saving !== null}
                colors={colors}
                onToggle={(v) => void handleToggle('rss_auto_downloading_enabled', v)}
              />
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <TouchableOpacity
                style={styles.nestedNavRow}
                onPress={() => router.push('/settings/rss-rules')}
                activeOpacity={0.7}
              >
                <Text style={[styles.navLabel, { color: colors.text }]}>
                  {t('screens.settings.rssAutoDownloadRules')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <NumberRow
                label={t('screens.settings.rssRefreshInterval')}
                unit={t('screens.settings.rssMinutes')}
                value={refreshIntervalText}
                disabled={disabled}
                colors={colors}
                onChangeText={setRefreshIntervalText}
                onBlur={() =>
                  void handleNumberBlur(
                    'rss_refresh_interval',
                    refreshIntervalText,
                    setRefreshIntervalText,
                  )
                }
              />
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <NumberRow
                label={t('screens.settings.rssFetchDelay')}
                unit={t('screens.settings.rssSeconds')}
                value={fetchDelayText}
                disabled={disabled}
                colors={colors}
                onChangeText={setFetchDelayText}
                onBlur={() =>
                  void handleNumberBlur('rss_fetch_delay', fetchDelayText, setFetchDelayText)
                }
              />
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <NumberRow
                label={t('screens.settings.rssMaxArticlesPerFeed')}
                value={maxArticlesText}
                disabled={disabled}
                colors={colors}
                onChangeText={setMaxArticlesText}
                onBlur={() =>
                  void handleNumberBlur(
                    'rss_max_articles_per_feed',
                    maxArticlesText,
                    setMaxArticlesText,
                  )
                }
              />
            </View>
          </View>

          {/* RSS Smart Episode Filter */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.rssSmartFilter').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <ToggleRow
                icon="film-outline"
                label={t('screens.settings.rssDownloadRepackProper')}
                value={prefs.rss_download_repack_proper_episodes}
                disabled={disabled || saving !== null}
                colors={colors}
                onToggle={(v) => void handleToggle('rss_download_repack_proper_episodes', v)}
              />
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.filtersBlock}>
                <View style={styles.filtersLabelRow}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.rssSmartFilterFiltersLabel')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => void handleSaveFilters()}
                    disabled={!filtersDirty || savingFilters || disabled}
                    style={{ opacity: !filtersDirty || savingFilters || disabled ? 0.4 : 1 }}
                  >
                    {savingFilters ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={[styles.saveText, { color: colors.primary }]}>
                        {t('common.save')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                  {t('screens.settings.rssSmartFilterFiltersHint')}
                </Text>
                <TextInput
                  style={[
                    styles.filtersInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.surfaceOutline,
                    },
                  ]}
                  value={filtersText}
                  onChangeText={setFiltersText}
                  placeholder={t('screens.settings.rssSmartFilterFiltersPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  editable={!disabled}
                  multiline
                  numberOfLines={6}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
  );
}

interface ToggleRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  value: boolean;
  disabled: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  onToggle: (v: boolean) => void;
}

function ToggleRow({ icon, label, hint, value, disabled, colors, onToggle }: ToggleRowProps) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={22} color={colors.primary} />
        <View style={styles.settingTextBlock}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
          {!!hint && (
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{hint}</Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
        ios_backgroundColor={colors.surfaceOutline}
      />
    </View>
  );
}

interface NumberRowProps {
  label: string;
  unit?: string;
  value: string;
  disabled: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  onChangeText: (v: string) => void;
  onBlur: () => void;
}

function NumberRow({ label, unit, value, disabled, colors, onChangeText, onBlur }: NumberRowProps) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={styles.settingTextBlock}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        </View>
      </View>
      <View style={styles.numberInputRow}>
        <TextInput
          style={[styles.numberInput, { borderColor: colors.surfaceOutline, color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          editable={!disabled}
          keyboardType="number-pad"
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={[styles.numberUnit, { color: colors.textSecondary }]}>{unit ?? ''}</Text>
      </View>
    </View>
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
  separator: { height: 1, marginLeft: 50 },
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
  settingTextBlock: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  settingHint: { fontSize: 12, marginTop: 1 },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  numberInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    minWidth: 60,
    fontSize: 15,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  numberUnit: {
    fontSize: 13,
    minWidth: 24,
  },
  filtersBlock: {
    paddingLeft: 50,
    paddingRight: 16,
    paddingVertical: 12,
    gap: spacing.xs,
  },
  filtersLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
  },
  filtersInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    marginTop: spacing.xs,
    minHeight: 120,
  },
  nestedNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 50,
    paddingRight: 16,
    paddingVertical: 14,
  },
  navLabel: { fontSize: 16, fontWeight: '500' },
});
