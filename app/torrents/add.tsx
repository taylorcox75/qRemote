import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { MultiSelectPicker, MultiSelectPickerItem } from '@/components/MultiSelectPicker';
import { InputModal } from '@/components/InputModal';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';
import { torrentsApi } from '@/services/api/torrents';
import { categoriesApi } from '@/services/api/categories';
import { tagsApi } from '@/services/api/tags';
import { storageService } from '@/services/storage';
import { DEFAULT_PREFERENCES, AddTorrentDialogField } from '@/types/preferences';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

type AddTorrentOptions = Parameters<typeof torrentsApi.addTorrent>[1];
type AddTorrentFileOptions = Parameters<typeof torrentsApi.addTorrentFile>[1];

export default function AddTorrentFullScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { isConnected } = useServer();
  const { categories, tags } = useTorrents();

  const [fieldVisibility, setFieldVisibility] = useState<Record<AddTorrentDialogField, boolean>>(
    DEFAULT_PREFERENCES.addTorrentDialogueFields
  );

  // Source
  const [torrentUrl, setTorrentUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);

  // Options
  const [savePath, setSavePath] = useState('');
  const [category, setCategory] = useState<string>('');
  const [tagValues, setTagValues] = useState<string[]>([]);
  const [rename, setRename] = useState('');
  const [stopped, setStopped] = useState(false);
  const [skipChecking, setSkipChecking] = useState(false);
  const [rootFolder, setRootFolder] = useState(true);
  const [autoTMM, setAutoTMM] = useState(false);
  const [sequentialDownload, setSequentialDownload] = useState(false);
  const [firstLastPiecePrio, setFirstLastPiecePrio] = useState(false);
  const [dlLimit, setDlLimit] = useState('');
  const [upLimit, setUpLimit] = useState('');
  const [ratioLimit, setRatioLimit] = useState('');
  const [seedingTimeLimit, setSeedingTimeLimit] = useState('');
  const [cookie, setCookie] = useState('');

  const [adding, setAdding] = useState(false);

  // Pickers/modals
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [tagsPickerVisible, setTagsPickerVisible] = useState(false);

  const [createCategoryNameVisible, setCreateCategoryNameVisible] = useState(false);
  const [createCategoryPathVisible, setCreateCategoryPathVisible] = useState(false);
  const [pendingNewCategoryName, setPendingNewCategoryName] = useState('');
  const [pendingNewCategoryPath, setPendingNewCategoryPath] = useState('');

  const [createTagVisible, setCreateTagVisible] = useState(false);
  const [pendingNewTagName, setPendingNewTagName] = useState('');

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const prefs = await storageService.getPreferences();
          const stored = (prefs.addTorrentDialogueFields as Partial<typeof fieldVisibility>) || {};
          const normalized = { ...DEFAULT_PREFERENCES.addTorrentDialogueFields, ...stored, source: true };
          setFieldVisibility(normalized);
          if (stored.source === false) {
            await storageService.savePreferences({ ...prefs, addTorrentDialogueFields: normalized });
          }
          setSavePath(prefs.defaultSavePath || '');
          setStopped(!!prefs.pauseOnAdd);
        } catch {
          setFieldVisibility(DEFAULT_PREFERENCES.addTorrentDialogueFields);
        }
      };
      load();
    }, [])
  );

  const categoryOptions: OptionPickerItem[] = useMemo(() => {
    const items: OptionPickerItem[] = [
      { label: t('screens.addTorrent.none'), value: '', icon: 'remove-circle-outline' },
      ...Object.keys(categories)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ label: name, value: name, icon: 'folder-outline' as const })),
      { label: t('screens.addTorrent.createNewCategory'), value: '__create__', icon: 'add-circle-outline' },
    ];
    return items;
  }, [categories, t]);

  const tagOptions: MultiSelectPickerItem[] = useMemo(() => {
    return (tags || [])
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ label: tag, value: tag, icon: 'pricetag-outline' }));
  }, [tags]);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-bittorrent', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file?.uri) return;
      setSelectedFile({ uri: file.uri, name: file.name || 'torrent.torrent', mimeType: file.mimeType });
      setTorrentUrl('');
    } catch {
      showToast(t('errors.failedToPickFile'), 'error');
    }
  }, [showToast, t]);

  const applyCategorySavePath = useCallback(
    (newCategory: string) => {
      const newPath = newCategory ? (categories?.[newCategory]?.savePath || '') : '';
      if (newPath) {
        setSavePath(newPath);
      }
    },
    [categories]
  );

  const buildOptions = (): AddTorrentOptions & AddTorrentFileOptions => {
    const opts: Record<string, unknown> = {};

    if (fieldVisibility.savePath && savePath.trim()) opts.savepath = savePath.trim();
    if (fieldVisibility.category && category) opts.category = category;
    if (fieldVisibility.tags && tagValues.length > 0) opts.tags = tagValues;
    if (fieldVisibility.rename && rename.trim()) opts.rename = rename.trim();
    if (fieldVisibility.stopped) opts.stopped = stopped;
    if (fieldVisibility.skipChecking) opts.skip_checking = skipChecking;
    if (fieldVisibility.rootFolder) opts.root_folder = rootFolder;
    if (fieldVisibility.autoTMM) opts.autoTMM = autoTMM;
    if (fieldVisibility.sequentialDownload) opts.sequentialDownload = sequentialDownload;
    if (fieldVisibility.firstLastPiecePrio) opts.firstLastPiecePrio = firstLastPiecePrio;

    if (fieldVisibility.dlLimit && dlLimit.trim()) {
      const n = Number(dlLimit);
      if (!Number.isNaN(n)) opts.dlLimit = n;
    }
    if (fieldVisibility.upLimit && upLimit.trim()) {
      const n = Number(upLimit);
      if (!Number.isNaN(n)) opts.upLimit = n;
    }
    if (fieldVisibility.ratioLimit && ratioLimit.trim()) {
      const n = Number(ratioLimit);
      if (!Number.isNaN(n)) opts.ratioLimit = n;
    }
    if (fieldVisibility.seedingTimeLimit && seedingTimeLimit.trim()) {
      const n = Number(seedingTimeLimit);
      if (!Number.isNaN(n)) opts.seedingTimeLimit = n;
    }
    if (fieldVisibility.cookie && cookie.trim()) opts.cookie = cookie.trim();

    return opts as AddTorrentOptions & AddTorrentFileOptions;
  };

  const handleSubmit = useCallback(async () => {
    if (!isConnected) {
      showToast(t('toast.notConnected'), 'error');
      return;
    }
    const sourceOk = (!!torrentUrl.trim() || !!selectedFile) && fieldVisibility.source;
    if (!sourceOk) {
      showToast(t('errors.enterUrlOrMagnet'), 'error');
      return;
    }

    setAdding(true);
    try {
      const opts = buildOptions();
      if (selectedFile) {
        await torrentsApi.addTorrentFile(
          { uri: selectedFile.uri, name: selectedFile.name, type: selectedFile.mimeType },
          opts
        );
      } else {
        await torrentsApi.addTorrent(torrentUrl.trim(), opts);
      }
      showToast(t('toast.torrentAdded'), 'success');
      router.back();
    } catch {
      showToast(t('errors.failedToAdd'), 'error');
    } finally {
      setAdding(false);
    }
  }, [buildOptions, fieldVisibility.source, isConnected, router, selectedFile, showToast, t, torrentUrl]);

  const selectedTagsLabel = useMemo(() => {
    if (!tagValues.length) return t('screens.addTorrent.none');
    if (tagValues.length === 1) return tagValues[0];
    return t('screens.addTorrent.selectedCount', { count: tagValues.length });
  }, [t, tagValues]);

  const showField = (field: AddTorrentDialogField) => fieldVisibility[field] === true;

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('screens.torrents.addTorrent')}</Text>
          <View style={styles.headerButton} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            {showField('source') && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                  {t('screens.addTorrent.source').toUpperCase()}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  <View style={styles.block}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.torrents.urlOrMagnet')}</Text>
                    <TextInput
                      style={[
                        styles.textArea,
                        { backgroundColor: colors.background, color: colors.text, borderColor: colors.surfaceOutline },
                      ]}
                      value={torrentUrl}
                      onChangeText={(text) => {
                        setTorrentUrl(text);
                        if (text.trim() && selectedFile) setSelectedFile(null);
                      }}
                      placeholder={t('placeholders.magnetLink')}
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={3}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textAlignVertical="top"
                      editable={!selectedFile}
                    />
                  </View>

                  <View style={[styles.separatorFull, { backgroundColor: colors.surfaceOutline }]} />

                  <View style={styles.block}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.addTorrent.torrentFile')}</Text>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        {
                          backgroundColor: selectedFile ? colors.success : colors.background,
                          borderColor: selectedFile ? colors.success : colors.surfaceOutline,
                          opacity: torrentUrl.trim() ? 0.6 : 1,
                        },
                      ]}
                      onPress={handlePickFile}
                      activeOpacity={0.7}
                      disabled={!!torrentUrl.trim()}
                    >
                      <Ionicons
                        name={selectedFile ? 'checkmark-circle' : 'document'}
                        size={20}
                        color={selectedFile ? '#FFFFFF' : colors.text}
                      />
                      <Text
                        style={[
                          styles.pickerText,
                          {
                            color: selectedFile ? '#FFFFFF' : colors.text,
                            fontWeight: selectedFile ? '600' : '400',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {selectedFile ? selectedFile.name : t('screens.torrents.selectTorrentFile')}
                      </Text>
                      {selectedFile && (
                        <TouchableOpacity
                          onPress={() => setSelectedFile(null)}
                          style={styles.clearIconButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {(showField('category') || showField('savePath') || showField('tags')) && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                  {t('screens.addTorrent.destination').toUpperCase()}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  {showField('category') && (
                    <>
                      <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                          <Ionicons name="folder-open-outline" size={22} color={colors.primary} />
                          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.addTorrent.category')}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.pickerInline}
                          onPress={() => setCategoryPickerVisible(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.pickerInlineText, { color: colors.text }]}>
                            {category || t('screens.addTorrent.none')}
                          </Text>
                          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('savePath') && (
                    <>
                      <View style={styles.block}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.addTorrent.savePath')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            { backgroundColor: colors.background, color: colors.text, borderColor: colors.surfaceOutline },
                          ]}
                          value={savePath}
                          onChangeText={setSavePath}
                          placeholder={t('screens.addTorrent.savePathPlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                      {showField('tags') && <View style={[styles.separatorFull, { backgroundColor: colors.surfaceOutline }]} />}
                    </>
                  )}

                  {showField('tags') && (
                    <View style={styles.settingRow}>
                      <View style={styles.settingLeft}>
                        <Ionicons name="pricetag-outline" size={22} color={colors.primary} />
                        <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.addTorrent.tags')}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <TouchableOpacity onPress={() => setCreateTagVisible(true)} activeOpacity={0.7}>
                          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.pickerInline}
                          onPress={() => setTagsPickerVisible(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.pickerInlineText, { color: colors.text }]}>{selectedTagsLabel}</Text>
                          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {(showField('rename') ||
              showField('stopped') ||
              showField('skipChecking') ||
              showField('rootFolder') ||
              showField('autoTMM') ||
              showField('sequentialDownload') ||
              showField('firstLastPiecePrio')) && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                  {t('screens.addTorrent.options').toUpperCase()}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  {showField('rename') && (
                    <>
                      <View style={styles.block}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.addTorrent.rename')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            { backgroundColor: colors.background, color: colors.text, borderColor: colors.surfaceOutline },
                          ]}
                          value={rename}
                          onChangeText={setRename}
                          placeholder={t('screens.addTorrent.renamePlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View style={[styles.separatorFull, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('stopped') && (
                    <>
                      <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                          <Ionicons name="pause-circle-outline" size={22} color={colors.primary} />
                          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.addTorrent.startPaused')}</Text>
                        </View>
                        <Switch
                          value={stopped}
                          onValueChange={setStopped}
                          trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                          ios_backgroundColor={colors.surfaceOutline}
                        />
                      </View>
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('skipChecking') && (
                    <>
                      <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                          <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
                          <Text style={[styles.settingLabel, { color: colors.text }]}>
                            {t('screens.addTorrent.skipChecking')}
                          </Text>
                        </View>
                        <Switch
                          value={skipChecking}
                          onValueChange={setSkipChecking}
                          trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                          ios_backgroundColor={colors.surfaceOutline}
                        />
                      </View>
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('rootFolder') && (
                    <>
                      <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                          <Ionicons name="folder-outline" size={22} color={colors.primary} />
                          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.addTorrent.createRootFolder')}</Text>
                        </View>
                        <Switch
                          value={rootFolder}
                          onValueChange={setRootFolder}
                          trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                          ios_backgroundColor={colors.surfaceOutline}
                        />
                      </View>
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('autoTMM') && (
                    <>
                      <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                          <Ionicons name="sync-outline" size={22} color={colors.primary} />
                          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.addTorrent.autoTMM')}</Text>
                        </View>
                        <Switch
                          value={autoTMM}
                          onValueChange={setAutoTMM}
                          trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                          ios_backgroundColor={colors.surfaceOutline}
                        />
                      </View>
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('sequentialDownload') && (
                    <>
                      <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                          <Ionicons name="swap-vertical-outline" size={22} color={colors.primary} />
                          <Text style={[styles.settingLabel, { color: colors.text }]}>
                            {t('screens.addTorrent.sequentialDownload')}
                          </Text>
                        </View>
                        <Switch
                          value={sequentialDownload}
                          onValueChange={setSequentialDownload}
                          trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                          ios_backgroundColor={colors.surfaceOutline}
                        />
                      </View>
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('firstLastPiecePrio') && (
                    <View style={styles.settingRow}>
                      <View style={styles.settingLeft}>
                        <Ionicons name="layers-outline" size={22} color={colors.primary} />
                        <Text style={[styles.settingLabel, { color: colors.text }]}>
                          {t('screens.addTorrent.firstLastPiecePriority')}
                        </Text>
                      </View>
                      <Switch
                        value={firstLastPiecePrio}
                        onValueChange={setFirstLastPiecePrio}
                        trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                        ios_backgroundColor={colors.surfaceOutline}
                      />
                    </View>
                  )}
                </View>
              </View>
            )}

            {(showField('dlLimit') ||
              showField('upLimit') ||
              showField('ratioLimit') ||
              showField('seedingTimeLimit') ||
              showField('cookie')) && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                  {t('screens.addTorrent.limits').toUpperCase()}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  {showField('dlLimit') && (
                    <>
                      <View style={styles.block}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.addTorrent.dlLimit')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            { backgroundColor: colors.background, color: colors.text, borderColor: colors.surfaceOutline },
                          ]}
                          value={dlLimit}
                          onChangeText={setDlLimit}
                          keyboardType="numeric"
                          placeholder={t('screens.addTorrent.numberPlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View style={[styles.separatorFull, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('upLimit') && (
                    <>
                      <View style={styles.block}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.addTorrent.upLimit')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            { backgroundColor: colors.background, color: colors.text, borderColor: colors.surfaceOutline },
                          ]}
                          value={upLimit}
                          onChangeText={setUpLimit}
                          keyboardType="numeric"
                          placeholder={t('screens.addTorrent.numberPlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View style={[styles.separatorFull, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('ratioLimit') && (
                    <>
                      <View style={styles.block}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.addTorrent.ratioLimit')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            { backgroundColor: colors.background, color: colors.text, borderColor: colors.surfaceOutline },
                          ]}
                          value={ratioLimit}
                          onChangeText={setRatioLimit}
                          keyboardType="numeric"
                          placeholder={t('screens.addTorrent.numberPlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View style={[styles.separatorFull, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('seedingTimeLimit') && (
                    <>
                      <View style={styles.block}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.addTorrent.seedingTimeLimit')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            { backgroundColor: colors.background, color: colors.text, borderColor: colors.surfaceOutline },
                          ]}
                          value={seedingTimeLimit}
                          onChangeText={setSeedingTimeLimit}
                          keyboardType="numeric"
                          placeholder={t('screens.addTorrent.numberPlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View style={[styles.separatorFull, { backgroundColor: colors.surfaceOutline }]} />
                    </>
                  )}

                  {showField('cookie') && (
                    <View style={styles.block}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>{t('screens.addTorrent.cookie')}</Text>
                      <TextInput
                        style={[
                          styles.input,
                          { backgroundColor: colors.background, color: colors.text, borderColor: colors.surfaceOutline },
                        ]}
                        value={cookie}
                        onChangeText={setCookie}
                        placeholder={t('screens.addTorrent.cookiePlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  adding && { opacity: 0.6 },
                ]}
                onPress={handleSubmit}
                disabled={adding}
                activeOpacity={0.8}
              >
                {adding ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t('common.add')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <OptionPicker
        visible={categoryPickerVisible}
        title={t('screens.addTorrent.category')}
        options={categoryOptions}
        selectedValue={category}
        onSelect={(value) => {
          if (value === '__create__') {
            setCategoryPickerVisible(false);
            setPendingNewCategoryName('');
            setPendingNewCategoryPath('');
            setCreateCategoryNameVisible(true);
            return;
          }
          setCategory(value);
          setCategoryPickerVisible(false);
          applyCategorySavePath(value);
        }}
        onClose={() => setCategoryPickerVisible(false)}
      />

      <MultiSelectPicker
        visible={tagsPickerVisible}
        title={t('screens.addTorrent.tags')}
        options={tagOptions}
        selectedValues={tagValues}
        onChange={setTagValues}
        onClose={() => setTagsPickerVisible(false)}
      />

      <InputModal
        visible={createCategoryNameVisible}
        title={t('screens.addTorrent.createNewCategory')}
        message={t('screens.addTorrent.enterCategoryName')}
        placeholder={t('screens.settings.categoryName')}
        defaultValue={pendingNewCategoryName}
        keyboardType="default"
        onCancel={() => setCreateCategoryNameVisible(false)}
        onConfirm={(value) => {
          const name = value.trim();
          if (!name) {
            showToast(t('errors.enterCategoryName'), 'error');
            return;
          }
          setPendingNewCategoryName(name);
          setCreateCategoryNameVisible(false);
          setCreateCategoryPathVisible(true);
        }}
      />
      <InputModal
        visible={createCategoryPathVisible}
        title={t('screens.addTorrent.createNewCategory')}
        message={t('screens.addTorrent.enterCategorySavePathOptional')}
        placeholder={t('screens.settings.savePathOptional')}
        defaultValue={pendingNewCategoryPath}
        keyboardType="default"
        allowEmpty
        onCancel={() => setCreateCategoryPathVisible(false)}
        onConfirm={async (value) => {
          const path = value.trim();
          setCreateCategoryPathVisible(false);
          try {
            await categoriesApi.addCategory(pendingNewCategoryName, path || undefined);
            setCategory(pendingNewCategoryName);
            if (path) setSavePath(path);
            showToast(t('toast.categoryAdded', { name: pendingNewCategoryName }), 'success');
          } catch {
            showToast(t('errors.failedToAddCategory'), 'error');
          }
        }}
      />

      <InputModal
        visible={createTagVisible}
        title={t('screens.addTorrent.createNewTag')}
        message={t('screens.addTorrent.enterTagName')}
        placeholder={t('screens.settings.tagName')}
        defaultValue={pendingNewTagName}
        keyboardType="default"
        onCancel={() => setCreateTagVisible(false)}
        onConfirm={async (value) => {
          const name = value.trim();
          if (!name) {
            showToast(t('errors.enterTagName'), 'error');
            return;
          }
          setCreateTagVisible(false);
          try {
            await tagsApi.createTags([name]);
            setTagValues((prev) => (prev.includes(name) ? prev : [...prev, name]));
            showToast(t('toast.tagCreated', { name }), 'success');
          } catch {
            showToast(t('errors.failedToCreateTag'), 'error');
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
  card: { borderRadius: borderRadius.medium, overflow: 'hidden', ...shadows.card },
  separator: { height: 1, marginLeft: 50 },
  separatorFull: { height: 1, marginLeft: 0 },

  block: { padding: 16, gap: 8 },
  label: { ...typography.secondary, fontSize: 12 },
  input: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.secondary,
  },
  textArea: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: 86,
    ...typography.secondary,
  },

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  pickerText: { ...typography.bodyMedium, flex: 1 },
  clearIconButton: { marginLeft: spacing.xs },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: spacing.md },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  pickerInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: 220 },
  pickerInlineText: { fontSize: 15, fontWeight: '500' },

  primaryButton: {
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

