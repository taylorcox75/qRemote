import React, { useState, useCallback, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { InputModal } from '@/components/InputModal';
import { PathAutocompleteInput, isWindowsStylePath } from '@/components/PathAutocompleteInput';
import { storageService } from '@/services/storage';
import { applicationApi } from '@/services/api/application';
import { apiClient } from '@/services/api/client';
import { categoriesApi } from '@/services/api/categories';
import { torrentsApi } from '@/services/api/torrents';
import { tagsApi } from '@/services/api/tags';
import { AppPreferences, SortField, DEFAULT_PREFERENCES } from '@/types/preferences';
import { ApplicationPreferences, ScanDirOverride, Category } from '@/types/api';
import { getPauseOnAddPreferenceKey } from '@/utils/apiVersion';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

export default function TorrentDefaultsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { isConnected } = useServer();
  const { tags } = useTorrents();
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [defaultCategoryColor, setDefaultCategoryColor] = useState(
    DEFAULT_PREFERENCES.defaultCategoryColor,
  );
  const [defaultTagColor, setDefaultTagColor] = useState(DEFAULT_PREFERENCES.defaultTagColor);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const [defaultSortBy, setDefaultSortBy] = useState<
    'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'added_on'
  >('added_on');
  const [defaultSortDirection, setDefaultSortDirection] = useState<'asc' | 'desc'>('desc');
  const [defaultFilter, setDefaultFilter] = useState<string>('all');
  const [pauseOnAdd, setPauseOnAdd] = useState(false);
  const [defaultSavePath, setDefaultSavePath] = useState('');
  const [autoCategorizeByTracker, setAutoCategorizeByTracker] = useState(false);
  const [defaultPriority, setDefaultPriority] = useState<number>(0);

  // Saving Management — genuine qBittorrent server preferences, server is the sole source of truth
  const [autoTmmEnabled, setAutoTmmEnabled] = useState(false);
  const [torrentChangedTmmEnabled, setTorrentChangedTmmEnabled] = useState(false);
  const [savePathChangedTmmEnabled, setSavePathChangedTmmEnabled] = useState(false);
  const [categoryChangedTmmEnabled, setCategoryChangedTmmEnabled] = useState(false);
  const [useCategoryPathsInManualMode, setUseCategoryPathsInManualMode] = useState(false);
  const [contentLayout, setContentLayout] = useState<'Original' | 'Subfolder' | 'NoSubfolder'>(
    'Original',
  );
  const [tempPathEnabled, setTempPathEnabled] = useState(false);
  const [tempPath, setTempPath] = useState('');
  const [preallocateAll, setPreallocateAll] = useState(false);
  const [incompleteFilesExt, setIncompleteFilesExt] = useState(false);
  const [useUnwantedFolder, setUseUnwantedFolder] = useState(false);
  const [exportDir, setExportDir] = useState('');
  const [exportDirFin, setExportDirFin] = useState('');

  // Add Torrent / Duplicate Torrents
  const [addToTopOfQueue, setAddToTopOfQueue] = useState(false);
  const [torrentStopCondition, setTorrentStopCondition] = useState<
    'None' | 'MetadataReceived' | 'FilesChecked'
  >('None');
  const [mergeTrackers, setMergeTrackers] = useState(false);
  const [autoDeleteMode, setAutoDeleteMode] = useState(0);

  // Automatic Import
  const [scanDirs, setScanDirs] = useState<Record<string, ScanDirOverride>>({});
  const [excludedFileNamesEnabled, setExcludedFileNamesEnabled] = useState(false);
  const [excludedFileNames, setExcludedFileNames] = useState('');

  const [sortByPickerVisible, setSortByPickerVisible] = useState(false);
  const [filterPickerVisible, setFilterPickerVisible] = useState(false);
  const [savePathModalVisible, setSavePathModalVisible] = useState(false);
  const [defaultTmmPickerVisible, setDefaultTmmPickerVisible] = useState(false);
  const [categoryChangedPickerVisible, setCategoryChangedPickerVisible] = useState(false);
  const [savePathChangedPickerVisible, setSavePathChangedPickerVisible] = useState(false);
  const [categorySavePathChangedPickerVisible, setCategorySavePathChangedPickerVisible] =
    useState(false);
  const [contentLayoutPickerVisible, setContentLayoutPickerVisible] = useState(false);
  const [tempPathModalVisible, setTempPathModalVisible] = useState(false);
  const [exportDirModalVisible, setExportDirModalVisible] = useState(false);
  const [exportDirFinModalVisible, setExportDirFinModalVisible] = useState(false);
  const [stopConditionPickerVisible, setStopConditionPickerVisible] = useState(false);
  const [autoDeleteModePickerVisible, setAutoDeleteModePickerVisible] = useState(false);

  const [showAddMonitoredFolder, setShowAddMonitoredFolder] = useState(false);
  const [newMonitoredFolderPath, setNewMonitoredFolderPath] = useState('');
  const [overridePickerFolder, setOverridePickerFolder] = useState<string | null>(null);
  const [otherPathModalFolder, setOtherPathModalFolder] = useState<string | null>(null);

  const [categoryName, setCategoryName] = useState('');
  const [categorySavePath, setCategorySavePath] = useState('');
  const [tagName, setTagName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategorySavePath, setEditCategorySavePath] = useState('');
  const categoryEditInFlightRef = useRef(false);

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

  const tmmModeOptions: OptionPickerItem[] = [
    { label: t('screens.settings.tmmModeManual'), value: 'false', icon: 'hand-left-outline' },
    { label: t('screens.settings.tmmModeAutomatic'), value: 'true', icon: 'sync-outline' },
  ];

  const categoryChangedOptions: OptionPickerItem[] = [
    { label: t('screens.settings.switchToManualMode'), value: 'false', icon: 'hand-left-outline' },
    { label: t('screens.settings.relocateTorrent'), value: 'true', icon: 'move-outline' },
  ];

  const savePathChangedOptions: OptionPickerItem[] = [
    {
      label: t('screens.settings.switchAffectedToManualMode'),
      value: 'false',
      icon: 'hand-left-outline',
    },
    { label: t('screens.settings.relocateAffectedTorrents'), value: 'true', icon: 'move-outline' },
  ];

  const stopConditionOptions: OptionPickerItem[] = [
    { label: t('screens.settings.stopConditionNone'), value: 'None', icon: 'close-circle-outline' },
    {
      label: t('screens.settings.stopConditionMetadataReceived'),
      value: 'MetadataReceived',
      icon: 'information-circle-outline',
    },
    {
      label: t('screens.settings.stopConditionFilesChecked'),
      value: 'FilesChecked',
      icon: 'checkmark-done-outline',
    },
  ];

  const monitoredFolderOverrideOptions: OptionPickerItem[] = [
    {
      label: t('screens.settings.monitoredFolderOverrideWatch'),
      value: 'watch',
      icon: 'eye-outline',
    },
    {
      label: t('screens.settings.monitoredFolderOverrideDefault'),
      value: 'default',
      icon: 'folder-outline',
    },
    {
      label: t('screens.settings.monitoredFolderOverrideOther'),
      value: 'other',
      icon: 'ellipsis-horizontal-outline',
    },
  ];

  const contentLayoutOptions: OptionPickerItem[] = [
    {
      label: t('screens.settings.contentLayoutOriginal'),
      value: 'Original',
      icon: 'document-outline',
    },
    {
      label: t('screens.settings.contentLayoutSubfolder'),
      value: 'Subfolder',
      icon: 'folder-outline',
    },
    {
      label: t('screens.settings.contentLayoutNoSubfolder'),
      value: 'NoSubfolder',
      icon: 'documents-outline',
    },
  ];

  // qBittorrent auto_delete_mode: 0 = Never, 1 = If Added, 2 = Always
  const autoDeleteModeOptions: OptionPickerItem[] = [
    { label: t('screens.settings.autoDeleteModeNever'), value: '0', icon: 'close-circle-outline' },
    {
      label: t('screens.settings.autoDeleteModeIfAdded'),
      value: '1',
      icon: 'add-circle-outline',
    },
    {
      label: t('screens.settings.autoDeleteModeAlways'),
      value: '2',
      icon: 'checkmark-circle-outline',
    },
  ];

  const loadCategories = async () => {
    try {
      // The torrent list's rid-based sync only reports categories *added*
      // since the last request, not ones edited on the server (e.g. a save
      // path changed via qBittorrent's WebUI or Radarr) — fetch the
      // canonical list directly instead of trusting that stale snapshot.
      const allCategories = await categoriesApi.getAllCategories();
      setCategories(allCategories);
    } catch {
      // Not connected / failed to load — leave previous state
    }
  };

  const loadPreferences = async () => {
    try {
      const [prefs, serverPrefs] = await Promise.all([
        storageService.getPreferences(),
        applicationApi.getPreferences().catch(() => null),
      ]);
      setDefaultSortBy(prefs.defaultSortBy || 'added_on');
      setDefaultSortDirection(prefs.defaultSortDirection || 'desc');
      setDefaultFilter(prefs.defaultFilter || 'all');
      setDefaultCategoryColor(
        prefs.defaultCategoryColor || DEFAULT_PREFERENCES.defaultCategoryColor,
      );
      setDefaultTagColor(prefs.defaultTagColor || DEFAULT_PREFERENCES.defaultTagColor);
      setCategoryColors(prefs.categoryColors || {});
      setTagColors(prefs.tagColors || {});
      // Server is source of truth for pauseOnAdd — local pref is just a cache
      const pauseOnAddKey = getPauseOnAddPreferenceKey(apiClient.getApiFeatures());
      const serverPauseOnAdd = serverPrefs
        ? !!(serverPrefs as Record<string, unknown>)[pauseOnAddKey]
        : prefs.pauseOnAdd === true;
      setPauseOnAdd(serverPauseOnAdd);
      // Keep local cache in sync with what we just read
      if (serverPrefs && prefs.pauseOnAdd !== serverPauseOnAdd) {
        await storageService.savePreferences({ ...prefs, pauseOnAdd: serverPauseOnAdd });
      }
      setDefaultSavePath(prefs.defaultSavePath || '');
      setAutoCategorizeByTracker(prefs.autoCategorizeByTracker || false);
      setDefaultPriority(Number(prefs.defaultPriority) || 0);

      // Saving Management fields come straight off the same serverPrefs fetch above
      const sp = serverPrefs as Record<string, unknown> | null;
      setAutoTmmEnabled(!!sp?.auto_tmm_enabled);
      setTorrentChangedTmmEnabled(!!sp?.torrent_changed_tmm_enabled);
      setSavePathChangedTmmEnabled(!!sp?.save_path_changed_tmm_enabled);
      setCategoryChangedTmmEnabled(!!sp?.category_changed_tmm_enabled);
      setUseCategoryPathsInManualMode(!!sp?.use_category_paths_in_manual_mode);
      setContentLayout(
        (sp?.torrent_content_layout as 'Original' | 'Subfolder' | 'NoSubfolder') || 'Original',
      );
      setTempPathEnabled(!!sp?.temp_path_enabled);
      setTempPath((sp?.temp_path as string) || '');
      setPreallocateAll(!!sp?.preallocate_all);
      setIncompleteFilesExt(!!sp?.incomplete_files_ext);
      setUseUnwantedFolder(!!sp?.use_unwanted_folder);
      setExportDir((sp?.export_dir as string) || '');
      setExportDirFin((sp?.export_dir_fin as string) || '');

      setAddToTopOfQueue(!!sp?.add_to_top_of_queue);
      setTorrentStopCondition(
        (sp?.torrent_stop_condition as 'None' | 'MetadataReceived' | 'FilesChecked') || 'None',
      );
      setMergeTrackers(!!sp?.merge_trackers);
      setAutoDeleteMode(Number(sp?.auto_delete_mode) || 0);

      setScanDirs((sp?.scan_dirs as Record<string, ScanDirOverride>) || {});
      setExcludedFileNamesEnabled(!!sp?.excluded_file_names_enabled);
      setExcludedFileNames((sp?.excluded_file_names as string) || '');
    } catch {
      // Use defaults
    }
  };

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

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
      if (isConnected) {
        loadDefaultSavePath();
        loadCategories();
      }
    }, [isConnected]),
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
      await loadCategories();
      showToast(t('toast.categoryAdded', { name: categoryToAdd }), 'success');
    } catch {
      showToast(t('errors.failedToAddCategory'), 'error');
    }
  };

  const openEditCategory = (name: string, category: Category) => {
    setEditingCategory(name);
    setEditCategoryName(name);
    setEditCategorySavePath(category.savePath || '');
  };

  const closeEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryName('');
    setEditCategorySavePath('');
  };

  const handleSaveCategoryEdit = async () => {
    const originalName = editingCategory;
    if (!originalName || categoryEditInFlightRef.current) return;
    const newName = editCategoryName.trim();
    const newSavePath = editCategorySavePath.trim();
    if (!newName) {
      showToast(t('errors.enterCategoryName'), 'error');
      return;
    }
    categoryEditInFlightRef.current = true;
    try {
      if (newName === originalName) {
        await categoriesApi.editCategory(originalName, newSavePath);
      } else {
        // qBittorrent has no rename endpoint — recreate under the new name,
        // move any torrents currently in the old category over, then remove it.
        const torrentsInCategory = await torrentsApi.getTorrentList(undefined, originalName);
        await categoriesApi.addCategory(newName, newSavePath || undefined);
        try {
          if (torrentsInCategory.length > 0) {
            await torrentsApi.setTorrentCategory(
              torrentsInCategory.map((torrent) => torrent.hash),
              newName,
            );
          }
          await categoriesApi.removeCategories([originalName]);
        } catch (renameErr) {
          // Don't leave an orphan category behind after a partial rename.
          try {
            await categoriesApi.removeCategories([newName]);
          } catch {
            // Best-effort cleanup
          }
          throw renameErr;
        }

        // Migrate any custom sticker color keyed by the old category name.
        try {
          const prefs = await storageService.getPreferences();
          const colorsMap = { ...(prefs.categoryColors || {}) };
          if (Object.prototype.hasOwnProperty.call(colorsMap, originalName)) {
            colorsMap[newName] = colorsMap[originalName];
            delete colorsMap[originalName];
            await storageService.savePreferences({ ...prefs, categoryColors: colorsMap });
            setCategoryColors(colorsMap);
          }
        } catch {
          // Color map is local-only; don't fail the rename if it can't migrate.
        }
      }
      await loadCategories();
      closeEditCategory();
      showToast(t('toast.categoryUpdated', { name: newName }), 'success');
    } catch {
      showToast(t('errors.failedToUpdateCategory'), 'error');
    } finally {
      categoryEditInFlightRef.current = false;
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
            {t('screens.settings.serverSettings')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Sorting & Filtering */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.sortingFiltering').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="swap-vertical-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.defaultSortBy')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setSortByPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {sortByOptions.find((opt) => opt.value === defaultSortBy)?.label ||
                      t('sort.dateAdded')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="swap-vertical-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.defaultSortDirection')}
                  </Text>
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
                    {defaultSortDirection === 'asc'
                      ? t('screens.settings.ascending')
                      : t('screens.settings.descending')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="funnel-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.defaultFilter')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setFilterPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {filterOptions.find((opt) => opt.value === defaultFilter)?.label ||
                      defaultFilter}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Categories (only when connected) */}
          {isConnected && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text
                  style={[styles.sectionHeader, { color: colors.textSecondary, marginBottom: 0 }]}
                >
                  {t('screens.settings.categories').toUpperCase()}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddCategory(!showAddCategory)}
                  accessibilityLabel={
                    showAddCategory ? t('common.cancel') : t('screens.settings.addCategory')
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showAddCategory ? 'close-circle' : 'add-circle'}
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <Text
                style={[
                  styles.emptyTextSmall,
                  {
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                {t('screens.settings.categoriesEditHint')}
              </Text>
              <View
                style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.sm }]}
              >
                {showAddCategory && (
                  <View style={styles.addForm}>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.surfaceOutline,
                          color: colors.text,
                        },
                      ]}
                      placeholder={t('screens.settings.categoryName')}
                      placeholderTextColor={colors.textSecondary}
                      value={categoryName}
                      onChangeText={setCategoryName}
                    />
                    <PathAutocompleteInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.surfaceOutline,
                          color: colors.text,
                        },
                      ]}
                      placeholder={t('screens.settings.savePathOptional')}
                      placeholderTextColor={colors.textSecondary}
                      value={categorySavePath}
                      onChangeText={setCategorySavePath}
                    />
                    <TouchableOpacity
                      style={[styles.formButton, { backgroundColor: colors.primary }]}
                      onPress={handleAddCategory}
                    >
                      <Text style={styles.formButtonText}>{t('screens.settings.addCategory')}</Text>
                    </TouchableOpacity>
                    <View
                      style={[
                        styles.separator,
                        { backgroundColor: colors.surfaceOutline, marginTop: 16, marginLeft: 0 },
                      ]}
                    />
                  </View>
                )}
                {Object.keys(categories).length === 0 && !showAddCategory ? (
                  <View style={styles.emptyStateSmall}>
                    <Ionicons
                      name="folder-outline"
                      size={32}
                      color={colors.textSecondary}
                      style={{ marginBottom: 8 }}
                    />
                    <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>
                      {t('screens.settings.noCategories')}
                    </Text>
                    <Text
                      style={[
                        styles.emptyTextSmall,
                        { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
                      ]}
                    >
                      {t('screens.settings.noCategoriesHint')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tagsWrap}>
                    {Object.entries(categories).map(([name, category]) => {
                      const confirmDeleteCategory = () => {
                        Alert.alert(
                          t('alerts.deleteCategory', { name }),
                          t('alerts.deleteCategoryMessage'),
                          [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                              text: t('common.delete'),
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await categoriesApi.removeCategories([name]);
                                  await loadCategories();
                                  showToast(t('toast.categoryDeleted', { name }), 'success');
                                } catch {
                                  showToast(t('errors.failedToDeleteCategory'), 'error');
                                }
                              },
                            },
                          ],
                        );
                      };
                      const chipColor = categoryColors[name] ?? defaultCategoryColor;
                      return (
                        <TouchableOpacity
                          key={name}
                          style={[
                            styles.tagChip,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.surfaceOutline,
                            },
                          ]}
                          onPress={() => openEditCategory(name, category)}
                          onLongPress={confirmDeleteCategory}
                        >
                          <Ionicons name="folder-outline" size={14} color={chipColor} />
                          <Text style={[styles.tagChipText, { color: colors.text }]}>{name}</Text>
                          <TouchableOpacity
                            onPress={confirmDeleteCategory}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            accessibilityLabel={t('common.delete')}
                          >
                            <Ionicons name="close" size={14} color={colors.error} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Tags (only when connected) */}
          {isConnected && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text
                  style={[styles.sectionHeader, { color: colors.textSecondary, marginBottom: 0 }]}
                >
                  {t('screens.settings.tags').toUpperCase()}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddTag(!showAddTag)}
                  accessibilityLabel={
                    showAddTag ? t('common.cancel') : t('screens.settings.createTag')
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showAddTag ? 'close-circle' : 'add-circle'}
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <View
                style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.sm }]}
              >
                {showAddTag && (
                  <View style={styles.addForm}>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.surfaceOutline,
                          color: colors.text,
                        },
                      ]}
                      placeholder={t('screens.settings.tagName')}
                      placeholderTextColor={colors.textSecondary}
                      value={tagName}
                      onChangeText={setTagName}
                    />
                    <TouchableOpacity
                      style={[styles.formButton, { backgroundColor: colors.primary }]}
                      onPress={handleAddTag}
                    >
                      <Text style={styles.formButtonText}>{t('screens.settings.createTag')}</Text>
                    </TouchableOpacity>
                    <View
                      style={[
                        styles.separator,
                        { backgroundColor: colors.surfaceOutline, marginTop: 16, marginLeft: 0 },
                      ]}
                    />
                  </View>
                )}
                {tags.length === 0 && !showAddTag ? (
                  <View style={styles.emptyStateSmall}>
                    <Ionicons
                      name="pricetag-outline"
                      size={32}
                      color={colors.textSecondary}
                      style={{ marginBottom: 8 }}
                    />
                    <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>
                      {t('screens.settings.noTags')}
                    </Text>
                    <Text
                      style={[
                        styles.emptyTextSmall,
                        { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
                      ]}
                    >
                      {t('screens.settings.noTagsHint')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tagsWrap}>
                    {tags.map((tag) => {
                      const confirmDeleteTag = () => {
                        Alert.alert(t('alerts.deleteTag', { tag }), t('alerts.deleteTagMessage'), [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('common.delete'),
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await tagsApi.deleteTags([tag]);
                                showToast(t('toast.tagDeleted', { tag }), 'success');
                              } catch {
                                showToast(t('errors.failedToDeleteTag'), 'error');
                              }
                            },
                          },
                        ]);
                      };
                      const chipColor = tagColors[tag] ?? defaultTagColor;
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagChip,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.surfaceOutline,
                            },
                          ]}
                          onLongPress={confirmDeleteTag}
                        >
                          <Ionicons name="pricetag-outline" size={14} color={chipColor} />
                          <Text style={[styles.tagChipText, { color: colors.text }]}>{tag}</Text>
                          <TouchableOpacity
                            onPress={confirmDeleteTag}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            accessibilityLabel={t('common.delete')}
                          >
                            <Ionicons name="close" size={14} color={colors.error} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Torrent Behavior (app-specific extras, not part of the qBittorrent Downloads tab) */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.torrentBehavior').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="pause-circle-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.pauseOnAdd')}
                  </Text>
                </View>
                <Switch
                  value={pauseOnAdd}
                  onValueChange={async (value) => {
                    setPauseOnAdd(value); // optimistic UI update
                    try {
                      // Write to server — this is the source of truth
                      const pauseOnAddKey = getPauseOnAddPreferenceKey(apiClient.getApiFeatures());
                      await applicationApi.setPreferences({ [pauseOnAddKey]: value });
                      // Also update local cache
                      await savePreference('pauseOnAdd', value);
                    } catch {
                      // Roll back UI if server write fails
                      setPauseOnAdd(!value);
                    }
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="pricetag-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.autoCategorizeByTracker')}
                  </Text>
                </View>
                <Switch
                  value={autoCategorizeByTracker}
                  onValueChange={(value) => {
                    setAutoCategorizeByTracker(value);
                    savePreference('autoCategorizeByTracker', value);
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="layers-outline" size={22} color={colors.primary} />
                  <View style={styles.settingTextGroup}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.firstLastPiecePriority')}
                    </Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                      {t('screens.settings.firstLastPiecePriorityHint')}
                    </Text>
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

          {/* Add Torrent (only when connected — real server preferences) */}
          {isConnected && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.addTorrentSection').toUpperCase()}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="albums-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.contentLayout')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setContentLayoutPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, { color: colors.text }]}>
                      {contentLayoutOptions.find((opt) => opt.value === contentLayout)?.label}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="arrow-up-circle-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.addToTopOfQueue')}
                    </Text>
                  </View>
                  <Switch
                    value={addToTopOfQueue}
                    onValueChange={(value) => {
                      const prev = addToTopOfQueue;
                      setServerPreference(
                        'add_to_top_of_queue',
                        value,
                        () => setAddToTopOfQueue(value),
                        () => setAddToTopOfQueue(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="stop-circle-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.torrentStopCondition')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setStopConditionPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, { color: colors.text }]}>
                      {
                        stopConditionOptions.find((opt) => opt.value === torrentStopCondition)
                          ?.label
                      }
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text
                style={[
                  styles.sectionHeader,
                  { color: colors.textSecondary, marginTop: spacing.md },
                ]}
              >
                {t('screens.settings.duplicateTorrents').toUpperCase()}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="git-merge-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.mergeTrackers')}
                    </Text>
                  </View>
                  <Switch
                    value={mergeTrackers}
                    onValueChange={(value) => {
                      const prev = mergeTrackers;
                      setServerPreference(
                        'merge_trackers',
                        value,
                        () => setMergeTrackers(value),
                        () => setMergeTrackers(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="trash-outline" size={22} color={colors.primary} />
                    <View style={styles.settingTextGroup}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.deleteTorrentFilesAfterAdding')}
                      </Text>
                      <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                        {t('screens.settings.deleteTorrentFilesAfterAddingHint')}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setAutoDeleteModePickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, { color: colors.text }]}>
                      {
                        autoDeleteModeOptions.find((opt) => opt.value === String(autoDeleteMode))
                          ?.label
                      }
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Files (only when connected — real server preferences) */}
          {isConnected && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.filesSection').toUpperCase()}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="server-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.preallocateDiskSpace')}
                    </Text>
                  </View>
                  <Switch
                    value={preallocateAll}
                    onValueChange={(value) => {
                      const prev = preallocateAll;
                      setServerPreference(
                        'preallocate_all',
                        value,
                        () => setPreallocateAll(value),
                        () => setPreallocateAll(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="document-outline" size={22} color={colors.primary} />
                    <View style={styles.settingTextGroup}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.appendIncompleteExtension')}
                      </Text>
                      <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                        {t('screens.settings.appendIncompleteExtensionHint')}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={incompleteFilesExt}
                    onValueChange={(value) => {
                      const prev = incompleteFilesExt;
                      setServerPreference(
                        'incomplete_files_ext',
                        value,
                        () => setIncompleteFilesExt(value),
                        () => setIncompleteFilesExt(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="file-tray-outline" size={22} color={colors.primary} />
                    <View style={styles.settingTextGroup}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.useUnwantedFolder')}
                      </Text>
                      <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                        {t('screens.settings.useUnwantedFolderHint')}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={useUnwantedFolder}
                    onValueChange={(value) => {
                      const prev = useUnwantedFolder;
                      setServerPreference(
                        'use_unwanted_folder',
                        value,
                        () => setUseUnwantedFolder(value),
                        () => setUseUnwantedFolder(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Save Locations (only when connected — real server preferences) */}
          {isConnected && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.saveLocations').toUpperCase()}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="settings-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.defaultTmmMode')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setDefaultTmmPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, { color: colors.text }]}>
                      {autoTmmEnabled
                        ? t('screens.settings.tmmModeAutomatic')
                        : t('screens.settings.tmmModeManual')}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="pricetags-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.whenCategoryChanged')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setCategoryChangedPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, { color: colors.text }]}>
                      {torrentChangedTmmEnabled
                        ? t('screens.settings.relocateShort')
                        : t('screens.settings.manualModeShort')}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="folder-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.whenSavePathChanged')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setSavePathChangedPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, { color: colors.text }]}>
                      {savePathChangedTmmEnabled
                        ? t('screens.settings.relocateShort')
                        : t('screens.settings.manualModeShort')}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="pricetag-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.whenCategorySavePathChanged')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setCategorySavePathChangedPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, { color: colors.text }]}>
                      {categoryChangedTmmEnabled
                        ? t('screens.settings.relocateShort')
                        : t('screens.settings.manualModeShort')}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="git-branch-outline" size={22} color={colors.primary} />
                    <View style={styles.settingTextGroup}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.useCategoryPathsInManualMode')}
                      </Text>
                      <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                        {t('screens.settings.useCategoryPathsInManualModeHint')}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={useCategoryPathsInManualMode}
                    onValueChange={(value) => {
                      const prev = useCategoryPathsInManualMode;
                      setServerPreference(
                        'use_category_paths_in_manual_mode',
                        value,
                        () => setUseCategoryPathsInManualMode(value),
                        () => setUseCategoryPathsInManualMode(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="folder-outline" size={22} color={colors.primary} />
                    <View style={styles.settingTextGroup}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.defaultSavePath')}
                      </Text>
                      {defaultSavePath ? (
                        <Text
                          style={[styles.settingHint, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {defaultSavePath}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSavePathModalVisible(true)}
                    accessibilityLabel={t('common.edit')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.keepIncompleteIn')}
                    </Text>
                  </View>
                  <Switch
                    value={tempPathEnabled}
                    onValueChange={(value) => {
                      const prev = tempPathEnabled;
                      setServerPreference(
                        'temp_path_enabled',
                        value,
                        () => setTempPathEnabled(value),
                        () => setTempPathEnabled(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.nestedSettingRow}>
                  <View style={styles.settingLeft}>
                    <Text
                      style={[styles.settingHint, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {tempPath || t('screens.settings.pathNotSet')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setTempPathModalVisible(true)}
                    accessibilityLabel={t('common.edit')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="copy-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.copyTorrentFilesTo')}
                    </Text>
                  </View>
                  <Switch
                    value={!!exportDir}
                    onValueChange={(value) => {
                      if (value) {
                        setExportDirModalVisible(true);
                        return;
                      }
                      const prev = exportDir;
                      setServerPreference(
                        'export_dir',
                        '',
                        () => setExportDir(''),
                        () => setExportDir(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.nestedSettingRow}>
                  <View style={styles.settingLeft}>
                    <Text
                      style={[styles.settingHint, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {exportDir || t('screens.settings.pathNotSet')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setExportDirModalVisible(true)}
                    accessibilityLabel={t('common.edit')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="copy-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.copyTorrentFilesForFinishedTo')}
                    </Text>
                  </View>
                  <Switch
                    value={!!exportDirFin}
                    onValueChange={(value) => {
                      if (value) {
                        setExportDirFinModalVisible(true);
                        return;
                      }
                      const prev = exportDirFin;
                      setServerPreference(
                        'export_dir_fin',
                        '',
                        () => setExportDirFin(''),
                        () => setExportDirFin(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.nestedSettingRow}>
                  <View style={styles.settingLeft}>
                    <Text
                      style={[styles.settingHint, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {exportDirFin || t('screens.settings.pathNotSet')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setExportDirFinModalVisible(true)}
                    accessibilityLabel={t('common.edit')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Automatic Import (only when connected — real server preferences) */}
          {isConnected && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.automaticImport').toUpperCase()}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {Object.keys(scanDirs).length === 0 ? (
                  <View style={styles.emptyStateSmall}>
                    <Ionicons
                      name="eye-outline"
                      size={32}
                      color={colors.textSecondary}
                      style={{ marginBottom: 8 }}
                    />
                    <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>
                      {t('screens.settings.noMonitoredFolders')}
                    </Text>
                  </View>
                ) : (
                  Object.entries(scanDirs).map(([folder, override], index) => {
                    const overrideLabel =
                      override === 0
                        ? t('screens.settings.monitoredFolderOverrideWatch')
                        : override === 1
                          ? t('screens.settings.monitoredFolderOverrideDefault')
                          : (override as string);
                    return (
                      <View key={folder}>
                        <View style={styles.settingRow}>
                          <View style={styles.settingLeft}>
                            <Ionicons name="eye-outline" size={22} color={colors.primary} />
                            <Text
                              style={[styles.settingLabel, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {folder}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              const next = { ...scanDirs };
                              delete next[folder];
                              setServerPreference(
                                'scan_dirs',
                                next,
                                () => setScanDirs(next),
                                () => setScanDirs(scanDirs),
                              );
                            }}
                            accessibilityLabel={t('common.delete')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.nestedSettingRow}>
                          <View style={styles.settingLeft}>
                            <Text
                              style={[styles.settingHint, { color: colors.textSecondary }]}
                              numberOfLines={1}
                            >
                              {overrideLabel}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setOverridePickerFolder(folder)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                        {index < Object.keys(scanDirs).length - 1 && (
                          <View
                            style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                          />
                        )}
                      </View>
                    );
                  })
                )}
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                {showAddMonitoredFolder ? (
                  <View style={styles.addForm}>
                    <PathAutocompleteInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.surfaceOutline,
                          color: colors.text,
                        },
                      ]}
                      placeholder={t('screens.settings.monitoredFolderPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={newMonitoredFolderPath}
                      onChangeText={setNewMonitoredFolderPath}
                    />
                    <TouchableOpacity
                      style={[styles.formButton, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        const path = newMonitoredFolderPath.trim();
                        if (!path) return;
                        const next: Record<string, ScanDirOverride> = { ...scanDirs, [path]: 1 };
                        setNewMonitoredFolderPath('');
                        setShowAddMonitoredFolder(false);
                        setServerPreference(
                          'scan_dirs',
                          next,
                          () => setScanDirs(next),
                          () => setScanDirs(scanDirs),
                        );
                      }}
                    >
                      <Text style={styles.formButtonText}>
                        {t('screens.settings.addMonitoredFolder')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => setShowAddMonitoredFolder(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.settingLeft}>
                      <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                      <Text style={[styles.settingLabel, { color: colors.primary }]}>
                        {t('screens.settings.addMonitoredFolder')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <View
                style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.sm }]}
              >
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="funnel-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.excludedFileNames')}
                    </Text>
                  </View>
                  <Switch
                    value={excludedFileNamesEnabled}
                    onValueChange={(value) => {
                      const prev = excludedFileNamesEnabled;
                      setServerPreference(
                        'excluded_file_names_enabled',
                        value,
                        () => setExcludedFileNamesEnabled(value),
                        () => setExcludedFileNamesEnabled(prev),
                      );
                    }}
                    trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                    ios_backgroundColor={colors.surfaceOutline}
                  />
                </View>
                {excludedFileNamesEnabled && (
                  <>
                    <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    <View style={{ padding: spacing.md }}>
                      <TextInput
                        style={[
                          styles.formInput,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.surfaceOutline,
                            color: colors.text,
                            minHeight: 100,
                            textAlignVertical: 'top',
                          },
                        ]}
                        multiline
                        placeholder={t('screens.settings.excludedFileNamesPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        value={excludedFileNames}
                        onChangeText={setExcludedFileNames}
                        onBlur={() => {
                          const prev = excludedFileNames;
                          setServerPreference(
                            'excluded_file_names',
                            excludedFileNames,
                            () => {},
                            () => setExcludedFileNames(prev),
                          );
                        }}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Advanced (Email Notifications + Automation) — kept off the main screen */}
          {isConnected && (
            <View style={styles.section}>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => router.push('/settings/server-settings-advanced')}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons name="construct-outline" size={22} color={colors.primary} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {t('screens.settings.advancedServerSettings')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

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
      <OptionPicker
        visible={defaultTmmPickerVisible}
        title={t('screens.settings.defaultTmmMode')}
        options={tmmModeOptions}
        selectedValue={autoTmmEnabled ? 'true' : 'false'}
        onSelect={(value) => {
          const next = value === 'true';
          const prev = autoTmmEnabled;
          setDefaultTmmPickerVisible(false);
          setServerPreference(
            'auto_tmm_enabled',
            next,
            () => setAutoTmmEnabled(next),
            () => setAutoTmmEnabled(prev),
          );
        }}
        onClose={() => setDefaultTmmPickerVisible(false)}
      />
      <OptionPicker
        visible={categoryChangedPickerVisible}
        title={t('screens.settings.whenCategoryChanged')}
        options={categoryChangedOptions}
        selectedValue={torrentChangedTmmEnabled ? 'true' : 'false'}
        onSelect={(value) => {
          const next = value === 'true';
          const prev = torrentChangedTmmEnabled;
          setCategoryChangedPickerVisible(false);
          setServerPreference(
            'torrent_changed_tmm_enabled',
            next,
            () => setTorrentChangedTmmEnabled(next),
            () => setTorrentChangedTmmEnabled(prev),
          );
        }}
        onClose={() => setCategoryChangedPickerVisible(false)}
      />
      <OptionPicker
        visible={savePathChangedPickerVisible}
        title={t('screens.settings.whenSavePathChanged')}
        options={savePathChangedOptions}
        selectedValue={savePathChangedTmmEnabled ? 'true' : 'false'}
        onSelect={(value) => {
          const next = value === 'true';
          const prev = savePathChangedTmmEnabled;
          setSavePathChangedPickerVisible(false);
          setServerPreference(
            'save_path_changed_tmm_enabled',
            next,
            () => setSavePathChangedTmmEnabled(next),
            () => setSavePathChangedTmmEnabled(prev),
          );
        }}
        onClose={() => setSavePathChangedPickerVisible(false)}
      />
      <OptionPicker
        visible={categorySavePathChangedPickerVisible}
        title={t('screens.settings.whenCategorySavePathChanged')}
        options={savePathChangedOptions}
        selectedValue={categoryChangedTmmEnabled ? 'true' : 'false'}
        onSelect={(value) => {
          const next = value === 'true';
          const prev = categoryChangedTmmEnabled;
          setCategorySavePathChangedPickerVisible(false);
          setServerPreference(
            'category_changed_tmm_enabled',
            next,
            () => setCategoryChangedTmmEnabled(next),
            () => setCategoryChangedTmmEnabled(prev),
          );
        }}
        onClose={() => setCategorySavePathChangedPickerVisible(false)}
      />
      <OptionPicker
        visible={contentLayoutPickerVisible}
        title={t('screens.settings.contentLayout')}
        options={contentLayoutOptions}
        selectedValue={contentLayout}
        onSelect={(value) => {
          const layout = value as 'Original' | 'Subfolder' | 'NoSubfolder';
          const prev = contentLayout;
          setContentLayoutPickerVisible(false);
          setServerPreference(
            'torrent_content_layout',
            layout,
            () => setContentLayout(layout),
            () => setContentLayout(prev),
          );
        }}
        onClose={() => setContentLayoutPickerVisible(false)}
      />
      <OptionPicker
        visible={stopConditionPickerVisible}
        title={t('screens.settings.torrentStopCondition')}
        options={stopConditionOptions}
        selectedValue={torrentStopCondition}
        onSelect={(value) => {
          const condition = value as 'None' | 'MetadataReceived' | 'FilesChecked';
          const prev = torrentStopCondition;
          setStopConditionPickerVisible(false);
          setServerPreference(
            'torrent_stop_condition',
            condition,
            () => setTorrentStopCondition(condition),
            () => setTorrentStopCondition(prev),
          );
        }}
        onClose={() => setStopConditionPickerVisible(false)}
      />
      <OptionPicker
        visible={autoDeleteModePickerVisible}
        title={t('screens.settings.deleteTorrentFilesAfterAdding')}
        options={autoDeleteModeOptions}
        selectedValue={String(autoDeleteMode)}
        onSelect={(value) => {
          const next = Number(value);
          const prev = autoDeleteMode;
          setAutoDeleteModePickerVisible(false);
          setServerPreference(
            'auto_delete_mode',
            next,
            () => setAutoDeleteMode(next),
            () => setAutoDeleteMode(prev),
          );
        }}
        onClose={() => setAutoDeleteModePickerVisible(false)}
      />
      <OptionPicker
        visible={overridePickerFolder !== null}
        title={t('screens.settings.monitoredFolderOverrideWatch')}
        options={monitoredFolderOverrideOptions}
        selectedValue={
          overridePickerFolder !== null
            ? scanDirs[overridePickerFolder] === 0
              ? 'watch'
              : scanDirs[overridePickerFolder] === 1
                ? 'default'
                : 'other'
            : undefined
        }
        onSelect={(value) => {
          const folder = overridePickerFolder;
          if (!folder) return;
          setOverridePickerFolder(null);
          if (value === 'other') {
            setOtherPathModalFolder(folder);
            return;
          }
          const next: Record<string, ScanDirOverride> = {
            ...scanDirs,
            [folder]: value === 'watch' ? 0 : 1,
          };
          setServerPreference(
            'scan_dirs',
            next,
            () => setScanDirs(next),
            () => setScanDirs(scanDirs),
          );
        }}
        onClose={() => setOverridePickerFolder(null)}
      />
      <InputModal
        visible={otherPathModalFolder !== null}
        title={t('screens.settings.monitoredFolderOverrideOther')}
        pathAutocomplete
        message={t('screens.settings.monitoredFolderPlaceholder')}
        placeholder={t('screens.settings.monitoredFolderPlaceholder')}
        defaultValue=""
        keyboardType="default"
        onCancel={() => setOtherPathModalFolder(null)}
        onConfirm={(otherPath: string) => {
          const folder = otherPathModalFolder;
          setOtherPathModalFolder(null);
          if (!folder) return;
          const next: Record<string, ScanDirOverride> = { ...scanDirs, [folder]: otherPath };
          setServerPreference(
            'scan_dirs',
            next,
            () => setScanDirs(next),
            () => setScanDirs(scanDirs),
          );
        }}
      />
      <InputModal
        visible={savePathModalVisible}
        title={t('screens.settings.defaultSavePathTitle')}
        pathAutocomplete
        message={t('screens.settings.defaultSavePathMessage')}
        placeholder={t('screens.settings.defaultSavePathPlaceholder')}
        defaultValue={defaultSavePath}
        keyboardType="default"
        onCancel={() => setSavePathModalVisible(false)}
        onConfirm={async (path: string) => {
          setSavePathModalVisible(false);
          if (isConnected) {
            try {
              await applicationApi.setPreferences({ save_path: path });
              setDefaultSavePath(path);
              await savePreference('defaultSavePath', path);
              showToast(t('toast.savePathUpdated'), 'success');
            } catch {
              showToast(t('errors.failedToUpdateSavePath'), 'error');
            }
          } else {
            setDefaultSavePath(path);
            await savePreference('defaultSavePath', path);
            showToast(t('toast.savePathSavedLocally'), 'info');
          }
        }}
      />
      <InputModal
        visible={tempPathModalVisible}
        title={t('screens.settings.keepIncompleteInPathTitle')}
        pathAutocomplete
        message={t('screens.settings.keepIncompleteInPathMessage')}
        placeholder={t('screens.settings.keepIncompleteInPathPlaceholder')}
        defaultValue={tempPath}
        keyboardType="default"
        onCancel={() => setTempPathModalVisible(false)}
        onConfirm={async (path: string) => {
          const prev = tempPath;
          setTempPathModalVisible(false);
          await setServerPreference(
            'temp_path',
            path,
            () => setTempPath(path),
            () => setTempPath(prev),
          );
        }}
      />
      <InputModal
        visible={exportDirModalVisible}
        title={t('screens.settings.copyTorrentFilesToTitle')}
        pathAutocomplete
        message={t('screens.settings.copyTorrentFilesToMessage')}
        placeholder={t('screens.settings.copyTorrentFilesToPlaceholder')}
        defaultValue={exportDir}
        keyboardType="default"
        onCancel={() => setExportDirModalVisible(false)}
        onConfirm={async (path: string) => {
          const prev = exportDir;
          setExportDirModalVisible(false);
          await setServerPreference(
            'export_dir',
            path,
            () => setExportDir(path),
            () => setExportDir(prev),
          );
        }}
      />
      <InputModal
        visible={exportDirFinModalVisible}
        title={t('screens.settings.copyTorrentFilesForFinishedToTitle')}
        pathAutocomplete
        message={t('screens.settings.copyTorrentFilesForFinishedToMessage')}
        placeholder={t('screens.settings.copyTorrentFilesForFinishedToPlaceholder')}
        defaultValue={exportDirFin}
        keyboardType="default"
        onCancel={() => setExportDirFinModalVisible(false)}
        onConfirm={async (path: string) => {
          const prev = exportDirFin;
          setExportDirFinModalVisible(false);
          await setServerPreference(
            'export_dir_fin',
            path,
            () => setExportDirFin(path),
            () => setExportDirFin(prev),
          );
        }}
      />
      <Modal
        visible={editingCategory !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEditCategory}
      >
        <View style={[modalStyles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View
            style={[
              modalStyles.modal,
              shadows.medium,
              { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
            ]}
          >
            <Text style={[modalStyles.title, { color: colors.text }]}>
              {t('screens.settings.editCategory')}
            </Text>
            <Text style={[modalStyles.fieldLabel, { color: colors.textSecondary }]}>
              {t('screens.settings.categoryNameLabel')}
            </Text>
            <TextInput
              style={[
                modalStyles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.surfaceOutline,
                  color: colors.text,
                },
              ]}
              value={editCategoryName}
              onChangeText={setEditCategoryName}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[modalStyles.fieldLabel, { color: colors.textSecondary }]}>
              {t('screens.settings.categorySavePathLabel')}
            </Text>
            <PathAutocompleteInput
              style={[
                modalStyles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.surfaceOutline,
                  color: colors.text,
                },
              ]}
              value={editCategorySavePath}
              onChangeText={setEditCategorySavePath}
              placeholder={
                // Illustrative only — the field's actual value never gets set
                // to this string; an empty save path really is sent as "".
                (() => {
                  const base =
                    defaultSavePath || t('screens.settings.categorySavePathPlaceholderDefault');
                  const sep = isWindowsStylePath(base) ? '\\' : '/';
                  return `${base}${sep}${editCategoryName || editingCategory} ${t('screens.settings.categorySavePathPlaceholderSuffix')}`;
                })()
              }
              placeholderTextColor={colors.textSecondary}
            />
            <View style={modalStyles.buttons}>
              <TouchableOpacity
                style={[modalStyles.button, { backgroundColor: colors.surfaceOutline }]}
                onPress={closeEditCategory}
              >
                <Text style={[modalStyles.buttonText, { color: colors.text }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.button, { backgroundColor: colors.primary }]}
                onPress={handleSaveCategoryEdit}
              >
                <Text style={[modalStyles.buttonText, { color: colors.onAccent }]}>
                  {t('common.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  nestedSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 50,
    paddingRight: 16,
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
  settingHint: { fontSize: 12, marginTop: 1 },
  settingTextGroup: { flexShrink: 1 },
  separator: { height: 1, marginLeft: 50 },
  pickerButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pickerText: { fontSize: 16, fontWeight: '500' },
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  tagChipText: { ...typography.smallMedium },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    borderRadius: borderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    width: '80%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.medium,
    padding: spacing.sm,
    fontSize: 16,
    marginBottom: spacing.md,
    minHeight: 44,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
