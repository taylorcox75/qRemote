/**
 * rule.tsx — RSS auto-download rule add/edit form.
 *
 * No `name` param → creating a new rule (defaults per qBittorrent's RssRule
 * shape). `name` present → editing; the rule name field stays editable, and
 * on save a changed name triggers renameRule() before setRule() (setRule
 * alone does not rename — see hooks/useRssRules.ts).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { SettingRow } from '@/components/SettingRow';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { MultiSelectPicker, MultiSelectPickerItem } from '@/components/MultiSelectPicker';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useServer } from '@/context/ServerContext';
import { useRssRules } from '@/hooks/useRssRules';
import { useRssFeeds } from '@/hooks/useRssFeeds';
import { categoriesApi } from '@/services/api/categories';
import { RssRule } from '@/types/api';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';

const DEFAULT_RULE: RssRule = {
  enabled: true,
  mustContain: '',
  mustNotContain: '',
  useRegex: false,
  episodeFilter: '',
  smartFilter: false,
  previouslyMatchedEpisodes: [],
  affectedFeeds: [],
  ignoreDays: 0,
  lastMatch: '',
  addPaused: null,
  assignedCategory: '',
  savePath: '',
  torrentContentLayout: null,
};

type AddPausedOption = 'default' | 'yes' | 'no';

function addPausedToOption(value: boolean | null): AddPausedOption {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'default';
}

function optionToAddPaused(option: AddPausedOption): boolean | null {
  if (option === 'yes') return true;
  if (option === 'no') return false;
  return null;
}

export default function RssRuleEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const { isConnected } = useServer();
  const { rules, setRule, renameRule } = useRssRules();
  const { feeds } = useRssFeeds();
  const params = useLocalSearchParams<{ name?: string }>();
  const originalName = typeof params.name === 'string' ? params.name : undefined;
  const isEditing = !!originalName;
  const existingRule = originalName ? rules[originalName] : undefined;

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => categoriesApi.getAllCategories(),
    enabled: isConnected,
    staleTime: 10_000,
  });

  const [ruleName, setRuleName] = useState(originalName ?? '');
  const [enabled, setEnabled] = useState(DEFAULT_RULE.enabled);
  const [mustContain, setMustContain] = useState(DEFAULT_RULE.mustContain);
  const [mustNotContain, setMustNotContain] = useState(DEFAULT_RULE.mustNotContain);
  const [useRegex, setUseRegex] = useState(DEFAULT_RULE.useRegex);
  const [episodeFilter, setEpisodeFilter] = useState(DEFAULT_RULE.episodeFilter);
  const [smartFilter, setSmartFilter] = useState(DEFAULT_RULE.smartFilter);
  const [affectedFeeds, setAffectedFeeds] = useState<string[]>(DEFAULT_RULE.affectedFeeds);
  const [ignoreDaysText, setIgnoreDaysText] = useState(String(DEFAULT_RULE.ignoreDays));
  const [addPaused, setAddPaused] = useState<AddPausedOption>(
    addPausedToOption(DEFAULT_RULE.addPaused),
  );
  const [assignedCategory, setAssignedCategory] = useState(DEFAULT_RULE.assignedCategory);
  const [savePath, setSavePath] = useState(DEFAULT_RULE.savePath);
  const [contentLayout, setContentLayout] = useState(DEFAULT_RULE.torrentContentLayout ?? '');
  const [saving, setSaving] = useState(false);

  // Server-managed fields we don't expose an editor for, but must round-trip
  // unchanged on save.
  const [previouslyMatchedEpisodes, setPreviouslyMatchedEpisodes] = useState<string[]>(
    DEFAULT_RULE.previouslyMatchedEpisodes,
  );
  const [lastMatch, setLastMatch] = useState(DEFAULT_RULE.lastMatch);

  // Hydrate form state once the existing rule loads (edit mode).
  useEffect(() => {
    if (!existingRule) return;
    setEnabled(existingRule.enabled);
    setMustContain(existingRule.mustContain);
    setMustNotContain(existingRule.mustNotContain);
    setUseRegex(existingRule.useRegex);
    setEpisodeFilter(existingRule.episodeFilter);
    setSmartFilter(existingRule.smartFilter);
    setAffectedFeeds(existingRule.affectedFeeds);
    setIgnoreDaysText(String(existingRule.ignoreDays));
    setAddPaused(addPausedToOption(existingRule.addPaused));
    setAssignedCategory(existingRule.assignedCategory);
    setSavePath(existingRule.savePath);
    setContentLayout(existingRule.torrentContentLayout ?? '');
    setPreviouslyMatchedEpisodes(existingRule.previouslyMatchedEpisodes);
    setLastMatch(existingRule.lastMatch);
  }, [existingRule]);

  const [feedsPickerVisible, setFeedsPickerVisible] = useState(false);
  const [addPausedPickerVisible, setAddPausedPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [contentLayoutPickerVisible, setContentLayoutPickerVisible] = useState(false);

  const feedOptions: MultiSelectPickerItem[] = useMemo(
    () => feeds.map((f) => ({ label: f.feed.title || f.feed.url, value: f.feed.url })),
    [feeds],
  );

  const addPausedOptions: OptionPickerItem[] = useMemo(
    () => [
      { label: t('screens.rss.addPausedDefault'), value: 'default' },
      { label: t('screens.rss.addPausedYes'), value: 'yes' },
      { label: t('screens.rss.addPausedNo'), value: 'no' },
    ],
    [t],
  );

  const categoryOptions: OptionPickerItem[] = useMemo(
    () => [
      { label: t('screens.rss.noCategoryOption'), value: '' },
      ...Object.keys(categoriesQuery.data ?? {})
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ label: name, value: name })),
    ],
    [categoriesQuery.data, t],
  );

  const contentLayoutOptions: OptionPickerItem[] = useMemo(
    () => [
      { label: t('screens.rss.contentLayoutOriginal'), value: 'Original' },
      { label: t('screens.rss.contentLayoutSubfolder'), value: 'Subfolder' },
      { label: t('screens.rss.contentLayoutNoSubfolder'), value: 'NoSubfolder' },
    ],
    [t],
  );

  const addPausedLabel =
    addPausedOptions.find((o) => o.value === addPaused)?.label ?? t('screens.rss.addPausedDefault');
  const categoryLabel =
    categoryOptions.find((o) => o.value === assignedCategory)?.label ??
    t('screens.rss.noCategoryOption');
  const contentLayoutLabel =
    contentLayoutOptions.find((o) => o.value === contentLayout)?.label ?? t('common.none');

  const handleSave = async () => {
    const trimmedName = ruleName.trim();
    if (!trimmedName) {
      haptics.error();
      showToast(t('screens.rss.ruleNameRequiredError'), 'error');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && originalName && trimmedName !== originalName) {
        await renameRule(originalName, trimmedName);
      }

      const ruleDef: RssRule = {
        enabled,
        mustContain,
        mustNotContain,
        useRegex,
        episodeFilter,
        smartFilter,
        previouslyMatchedEpisodes,
        affectedFeeds,
        ignoreDays: parseInt(ignoreDaysText, 10) || 0,
        lastMatch,
        addPaused: optionToAddPaused(addPaused),
        assignedCategory,
        savePath,
        torrentContentLayout: contentLayout || null,
      };
      await setRule(trimmedName, ruleDef);

      haptics.success();
      showToast(t('screens.rss.ruleSavedToast'), 'success');
      router.back();
    } catch (err: unknown) {
      haptics.error();
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {isEditing ? originalName : t('screens.rss.addRule')}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.headerButton}
            activeOpacity={0.7}
            disabled={saving}
            accessibilityLabel={t('common.save')}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.saveText, { color: colors.primary }]}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.surfaceOutline,
                  },
                ]}
                value={ruleName}
                onChangeText={setRuleName}
                placeholder={t('screens.rss.ruleNamePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <SettingRow icon="power-outline" label={t('screens.rss.enabled')}>
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow
                label={t('screens.rss.mustContain')}
                hint={t('screens.rss.mustContainHint')}
              >
                <TextInput
                  style={[
                    styles.rowInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.surfaceOutline,
                    },
                  ]}
                  value={mustContain}
                  onChangeText={setMustContain}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow
                label={t('screens.rss.mustNotContain')}
                hint={t('screens.rss.mustNotContainHint')}
              >
                <TextInput
                  style={[
                    styles.rowInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.surfaceOutline,
                    },
                  ]}
                  value={mustNotContain}
                  onChangeText={setMustNotContain}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow label={t('screens.rss.useRegex')}>
                <Switch
                  value={useRegex}
                  onValueChange={setUseRegex}
                  trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow
                label={t('screens.rss.episodeFilter')}
                hint={t('screens.rss.episodeFilterHint')}
              >
                <TextInput
                  style={[
                    styles.rowInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.surfaceOutline,
                    },
                  ]}
                  value={episodeFilter}
                  onChangeText={setEpisodeFilter}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow label={t('screens.rss.smartFilter')}>
                <Switch
                  value={smartFilter}
                  onValueChange={setSmartFilter}
                  trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow
                icon="newspaper-outline"
                label={t('screens.rss.affectedFeeds')}
                hint={t('screens.rss.affectedFeedsHint')}
              >
                <TouchableOpacity
                  style={styles.pickerInline}
                  onPress={() => setFeedsPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerInlineText, { color: colors.text }]} numberOfLines={1}>
                    {affectedFeeds.length > 0
                      ? t('screens.addTorrent.selectedCount', { count: affectedFeeds.length })
                      : t('common.none')}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow
                label={t('screens.rss.ignoreDays')}
                hint={t('screens.rss.ignoreDaysHint')}
              >
                <TextInput
                  style={[
                    styles.numberInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.surfaceOutline,
                    },
                  ]}
                  value={ignoreDaysText}
                  onChangeText={setIgnoreDaysText}
                  keyboardType="number-pad"
                />
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow icon="pause-circle-outline" label={t('screens.rss.addPaused')}>
                <TouchableOpacity
                  style={styles.pickerInline}
                  onPress={() => setAddPausedPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerInlineText, { color: colors.text }]} numberOfLines={1}>
                    {addPausedLabel}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow icon="folder-open-outline" label={t('screens.rss.assignedCategory')}>
                <TouchableOpacity
                  style={styles.pickerInline}
                  onPress={() => setCategoryPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerInlineText, { color: colors.text }]} numberOfLines={1}>
                    {categoryLabel}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow label={t('screens.rss.savePath')} hint={t('screens.rss.savePathHint')}>
                <TextInput
                  style={[
                    styles.rowInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.surfaceOutline,
                    },
                  ]}
                  value={savePath}
                  onChangeText={setSavePath}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </SettingRow>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />

              <SettingRow icon="layers-outline" label={t('screens.rss.contentLayout')}>
                <TouchableOpacity
                  style={styles.pickerInline}
                  onPress={() => setContentLayoutPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerInlineText, { color: colors.text }]} numberOfLines={1}>
                    {contentLayoutLabel}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </SettingRow>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <MultiSelectPicker
        visible={feedsPickerVisible}
        title={t('screens.rss.affectedFeeds')}
        options={feedOptions}
        selectedValues={affectedFeeds}
        onChange={setAffectedFeeds}
        onClose={() => setFeedsPickerVisible(false)}
      />

      <OptionPicker
        visible={addPausedPickerVisible}
        title={t('screens.rss.addPaused')}
        options={addPausedOptions}
        selectedValue={addPaused}
        onSelect={(value) => setAddPaused(value as AddPausedOption)}
        onClose={() => setAddPausedPickerVisible(false)}
      />

      <OptionPicker
        visible={categoryPickerVisible}
        title={t('screens.rss.assignedCategory')}
        options={categoryOptions}
        selectedValue={assignedCategory}
        onSelect={setAssignedCategory}
        onClose={() => setCategoryPickerVisible(false)}
      />

      <OptionPicker
        visible={contentLayoutPickerVisible}
        title={t('screens.rss.contentLayout')}
        options={contentLayoutOptions}
        selectedValue={contentLayout}
        onSelect={setContentLayout}
        onClose={() => setContentLayoutPickerVisible(false)}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  headerButton: {
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h4,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  nameInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 18,
    fontWeight: '600',
  },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    ...shadows.card,
  },
  separator: {
    height: 0.5,
    marginLeft: spacing.lg,
  },
  rowInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    minWidth: 120,
    maxWidth: 180,
    fontSize: 15,
    textAlign: 'right',
  },
  numberInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    minWidth: 70,
    fontSize: 15,
    textAlign: 'right',
  },
  pickerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 200,
  },
  pickerInlineText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
