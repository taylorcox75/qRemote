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
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { InputModal } from '@/components/InputModal';
import { storageService } from '@/services/storage';
import { applicationApi } from '@/services/api/application';
import { categoriesApi } from '@/services/api/categories';
import { tagsApi } from '@/services/api/tags';
import { AppPreferences, SortField } from '@/types/preferences';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

export default function TorrentDefaultsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { isConnected } = useServer();
  const { categories, tags } = useTorrents();
  const { showToast } = useToast();

  const [defaultSortBy, setDefaultSortBy] = useState<'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'added_on'>('added_on');
  const [defaultSortDirection, setDefaultSortDirection] = useState<'asc' | 'desc'>('desc');
  const [defaultFilter, setDefaultFilter] = useState<string>('all');
  const [pauseOnAdd, setPauseOnAdd] = useState(false);
  const [defaultSavePath, setDefaultSavePath] = useState('');
  const [autoCategorizeByTracker, setAutoCategorizeByTracker] = useState(false);
  const [defaultPriority, setDefaultPriority] = useState<number>(0);

  const [sortByPickerVisible, setSortByPickerVisible] = useState(false);
  const [filterPickerVisible, setFilterPickerVisible] = useState(false);
  const [savePathModalVisible, setSavePathModalVisible] = useState(false);

  const [categoryName, setCategoryName] = useState('');
  const [categorySavePath, setCategorySavePath] = useState('');
  const [tagName, setTagName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);

  const sortByOptions: OptionPickerItem[] = [
    { label: t('sort.name'), value: 'name', icon: 'text-outline' },
    { label: t('sort.size'), value: 'size', icon: 'disc-outline' },
    { label: t('sort.progress'), value: 'progress', icon: 'pie-chart-outline' },
    { label: t('sort.ulRatio'), value: 'ratio', icon: 'swap-horizontal-outline' },
    { label: t('sort.dlSpeed'), value: 'dlspeed', icon: 'download-outline' },
    { label: t('sort.ulSpeed'), value: 'upspeed', icon: 'arrow-up-outline' },
    { label: t('sort.dateAdded'), value: 'added_on', icon: 'calendar-outline' },
  ];

  const filterOptions: OptionPickerItem[] = [
    { label: t('filters.all'), value: 'all', icon: 'grid-outline' },
    { label: t('filters.active'), value: 'active', icon: 'pulse' },
    { label: t('filters.completed'), value: 'completed', icon: 'checkmark-circle' },
    { label: t('filters.paused'), value: 'paused', icon: 'pause-circle' },
    { label: t('filters.stuck'), value: 'stuck', icon: 'warning' },
    { label: t('filters.downloading'), value: 'downloading', icon: 'arrow-down' },
    { label: t('filters.uploading'), value: 'uploading', icon: 'arrow-up' },
  ];

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
      if (isConnected) {
        loadDefaultSavePath();
      }
    }, [isConnected])
  );

  const loadPreferences = async () => {
    try {
      const prefs = await storageService.getPreferences();
      setDefaultSortBy(prefs.defaultSortBy || 'added_on');
      setDefaultSortDirection(prefs.defaultSortDirection || 'desc');
      setDefaultFilter(prefs.defaultFilter || 'all');
      setPauseOnAdd(prefs.pauseOnAdd || false);
      setDefaultSavePath(prefs.defaultSavePath || '');
      setAutoCategorizeByTracker(prefs.autoCategorizeByTracker || false);
      setDefaultPriority(Number(prefs.defaultPriority) || 0);
    } catch {
      // Use defaults
    }
  };

  const loadDefaultSavePath = async () => {
    try {
      const serverPath = await applicationApi.getDefaultSavePath();
      if (serverPath) {
        setDefaultSavePath(serverPath);
        const prefs = await storageService.getPreferences();
        prefs.defaultSavePath = serverPath;
        await storageService.savePreferences(prefs);
      }
    } catch {
      // Ignore if not connected or API error
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

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      showToast(t('errors.enterCategoryName'), 'error');
      return;
    }
    const categoryToAdd = categoryName.trim();
    try {
      await categoriesApi.addCategory(categoryToAdd, categorySavePath.trim() || undefined);
      setCategoryName('');
      setCategorySavePath('');
      setShowAddCategory(false);
      showToast(t('toast.categoryAdded', { name: categoryToAdd }), 'success');
    } catch {
      showToast(t('errors.failedToAddCategory'), 'error');
    }
  };

  const handleAddTag = async () => {
    if (!tagName.trim()) {
      showToast(t('errors.enterTagName'), 'error');
      return;
    }
    const tagToAdd = tagName.trim();
    try {
      await tagsApi.createTags([tagToAdd]);
      setTagName('');
      setShowAddTag(false);
      showToast(t('toast.tagCreated', { name: tagToAdd }), 'success');
    } catch {
      showToast(t('errors.failedToCreateTag'), 'error');
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('screens.settings.torrentList')}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Sorting & Filtering */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.torrentList').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="swap-vertical-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.defaultSortBy')}</Text>
                </View>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setSortByPickerVisible(true)} activeOpacity={0.7}>
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {sortByOptions.find(opt => opt.value === defaultSortBy)?.label || t('sort.dateAdded')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="swap-vertical-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.defaultSortDirection')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    const dir = defaultSortDirection === 'asc' ? 'desc' : 'asc';
                    setDefaultSortDirection(dir);
                    savePreference('defaultSortDirection', dir);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={defaultSortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={[styles.pickerText, { color: colors.text, marginLeft: 8 }]}>
                    {defaultSortDirection === 'asc' ? t('screens.settings.ascending') : t('screens.settings.descending')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="funnel-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.defaultFilter')}</Text>
                </View>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setFilterPickerVisible(true)} activeOpacity={0.7}>
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {filterOptions.find(opt => opt.value === defaultFilter)?.label || defaultFilter}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Torrent Behavior */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.torrentBehavior').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="pause-circle-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.pauseOnAdd')}</Text>
                </View>
                <Switch
                  value={pauseOnAdd}
                  onValueChange={(value) => { setPauseOnAdd(value); savePreference('pauseOnAdd', value); }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="folder-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.defaultSavePath')}</Text>
                    {defaultSavePath ? <Text style={[styles.settingHint, { color: colors.textSecondary }]} numberOfLines={1}>{defaultSavePath}</Text> : null}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSavePathModalVisible(true)}>
                  <Ionicons name="create-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="pricetag-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.autoCategorizeByTracker')}</Text>
                </View>
                <Switch
                  value={autoCategorizeByTracker}
                  onValueChange={(value) => { setAutoCategorizeByTracker(value); savePreference('autoCategorizeByTracker', value); }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="layers-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.firstLastPiecePriority')}</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.firstLastPiecePriorityHint')}</Text>
                  </View>
                </View>
                <Switch
                  value={defaultPriority > 0}
                  onValueChange={(value) => {
                    const newVal = value ? 1 : 0;
                    setDefaultPriority(newVal);
                    savePreference('defaultPriority', newVal);
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
            </View>
          </View>

          {/* Categories (only when connected) */}
          {isConnected && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeader, { color: colors.textSecondary, marginBottom: 0 }]}>{t('screens.settings.categories').toUpperCase()}</Text>
                <TouchableOpacity onPress={() => setShowAddCategory(!showAddCategory)}>
                  <Ionicons name={showAddCategory ? 'close-circle' : 'add-circle'} size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.sm }]}>
                {showAddCategory && (
                  <View style={styles.addForm}>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                      placeholder={t('screens.settings.categoryName')}
                      placeholderTextColor={colors.textSecondary}
                      value={categoryName}
                      onChangeText={setCategoryName}
                    />
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                      placeholder={t('screens.settings.savePathOptional')}
                      placeholderTextColor={colors.textSecondary}
                      value={categorySavePath}
                      onChangeText={setCategorySavePath}
                    />
                    <TouchableOpacity style={[styles.formButton, { backgroundColor: colors.primary }]} onPress={handleAddCategory}>
                      <Text style={styles.formButtonText}>{t('screens.settings.addCategory')}</Text>
                    </TouchableOpacity>
                    <View style={[styles.separator, { backgroundColor: colors.surfaceOutline, marginTop: 16, marginLeft: 0 }]} />
                  </View>
                )}
                {Object.keys(categories).length === 0 && !showAddCategory ? (
                  <View style={styles.emptyStateSmall}>
                    <Ionicons name="folder-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                    <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>{t('screens.settings.noCategories')}</Text>
                    <Text style={[styles.emptyTextSmall, { color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>{t('screens.settings.noCategoriesHint')}</Text>
                  </View>
                ) : (
                  Object.entries(categories).map(([name, category], index) => (
                    <View key={name}>
                      <View style={styles.listItem}>
                        <View style={styles.listItemContent}>
                          <View style={styles.listItemLeft}>
                            <Ionicons name="folder-outline" size={20} color={colors.primary} />
                            <View style={styles.listItemText}>
                              <Text style={[styles.listItemTitle, { color: colors.text }]}>{name}</Text>
                              {category.savePath && (
                                <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                                  {category.savePath}
                                </Text>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={async () => {
                              try {
                                await categoriesApi.removeCategories([name]);
                                showToast(t('toast.categoryDeleted', { name }), 'success');
                              } catch {
                                showToast(t('errors.failedToDeleteCategory'), 'error');
                              }
                            }}
                          >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {index < Object.keys(categories).length - 1 && <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />}
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* Tags (only when connected) */}
          {isConnected && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeader, { color: colors.textSecondary, marginBottom: 0 }]}>{t('screens.settings.tags').toUpperCase()}</Text>
                <TouchableOpacity onPress={() => setShowAddTag(!showAddTag)}>
                  <Ionicons name={showAddTag ? 'close-circle' : 'add-circle'} size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.sm }]}>
                {showAddTag && (
                  <View style={styles.addForm}>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                      placeholder={t('screens.settings.tagName')}
                      placeholderTextColor={colors.textSecondary}
                      value={tagName}
                      onChangeText={setTagName}
                    />
                    <TouchableOpacity style={[styles.formButton, { backgroundColor: colors.primary }]} onPress={handleAddTag}>
                      <Text style={styles.formButtonText}>{t('screens.settings.createTag')}</Text>
                    </TouchableOpacity>
                    <View style={[styles.separator, { backgroundColor: colors.surfaceOutline, marginTop: 16, marginLeft: 0 }]} />
                  </View>
                )}
                {tags.length === 0 && !showAddTag ? (
                  <View style={styles.emptyStateSmall}>
                    <Ionicons name="pricetag-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                    <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>{t('screens.settings.noTags')}</Text>
                    <Text style={[styles.emptyTextSmall, { color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>{t('screens.settings.noTagsHint')}</Text>
                  </View>
                ) : (
                  <View style={styles.tagsWrap}>
                    {tags.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.tagChip, { backgroundColor: colors.background, borderColor: colors.surfaceOutline }]}
                        onLongPress={async () => {
                          try {
                            await tagsApi.deleteTags([tag]);
                            showToast(t('toast.tagDeleted', { tag }), 'success');
                          } catch {
                            showToast(t('errors.failedToDeleteTag'), 'error');
                          }
                        }}
                      >
                        <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
                        <Text style={[styles.tagChipText, { color: colors.text }]}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      <OptionPicker
        visible={sortByPickerVisible}
        title={t('screens.settings.sortBy')}
        options={sortByOptions}
        selectedValue={defaultSortBy}
        onSelect={(value) => {
          const sortField = value as SortField;
          setDefaultSortBy(sortField);
          savePreference('defaultSortBy', sortField);
          setSortByPickerVisible(false);
        }}
        onClose={() => setSortByPickerVisible(false)}
      />
      <OptionPicker
        visible={filterPickerVisible}
        title={t('screens.settings.defaultFilter')}
        options={filterOptions}
        selectedValue={defaultFilter}
        onSelect={(value) => {
          setDefaultFilter(value);
          savePreference('defaultFilter', value);
          setFilterPickerVisible(false);
        }}
        onClose={() => setFilterPickerVisible(false)}
      />
      <InputModal
        visible={savePathModalVisible}
        title={t('screens.settings.defaultSavePathTitle')}
        message={t('screens.settings.defaultSavePathMessage')}
        placeholder={t('screens.settings.defaultSavePathPlaceholder')}
        defaultValue={defaultSavePath}
        keyboardType="default"
        onCancel={() => setSavePathModalVisible(false)}
        onConfirm={async (path: string) => {
          setDefaultSavePath(path);
          savePreference('defaultSavePath', path);
          setSavePathModalVisible(false);
          if (isConnected) {
            try {
              await applicationApi.setPreferences({ save_path: path });
              showToast(t('toast.savePathUpdated'), 'success');
            } catch {
              showToast(t('errors.failedToUpdateSavePath'), 'error');
            }
          } else {
            showToast(t('toast.savePathSavedLocally'), 'info');
          }
        }}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: spacing.xs,
    marginRight: spacing.xs,
  },
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
  pickerButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pickerText: { fontSize: 16, fontWeight: '500' },
  listItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  listItemContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  listItemText: { flex: 1 },
  listItemTitle: { ...typography.bodyMedium },
  listItemSubtitle: { ...typography.small, marginTop: 1 },
  emptyStateSmall: { alignItems: 'center', paddingVertical: 20 },
  emptyTextSmall: { fontSize: 14 },
  addForm: { padding: 16, gap: 10 },
  formInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.secondary,
  },
  formButton: {
    alignItems: 'center',
    borderRadius: borderRadius.small,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  formButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
  },
  tagChipText: { ...typography.smallMedium },
});
