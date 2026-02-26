import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { getStoredLanguage, setStoredLanguage } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useServer } from '../../context/ServerContext';
import { useTorrents } from '../../context/TorrentContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { OptionPicker, OptionPickerItem } from '../../components/OptionPicker';
import { InputModal } from '../../components/InputModal';
import { colorThemeManager } from '../../services/color-theme-manager';
import { ServerManager } from '../../services/server-manager';
import { ServerConfig } from '../../types/api';
import { storageService } from '../../services/storage';
import { categoriesApi } from '../../services/api/categories';
import { tagsApi } from '../../services/api/tags';
import { applicationApi } from '../../services/api/application';
import Constants from 'expo-constants';
import { ApplicationVersion, BuildInfo } from '../../types/api';
import { APP_VERSION } from '../../utils/version';
import { shadows } from '../../constants/shadows';
import { spacing, borderRadius } from '../../constants/spacing';
import { buttonStyles, buttonText } from '../../constants/buttons';
import { typography } from '../../constants/typography';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatReleaseDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const month = MONTH_NAMES[m - 1];
  return month ? `${month} ${d}, ${y}` : isoDate;
}

const CHANGELOG = [
  {
    version: '2.0.2',
    date: '2026-02-26',
    changes: [
      'Fixed default save path updates not being applied on the qBittorrent server',
    ],
  },
  {
    version: '2.0.1',
    date: '2026-02-19',
    changes: [
      'Fixed transfer stats (free disk space, queued size, avg queue time) disappearing after switching server',
      'What\'s New popup updated with v2.0.0 and v1.1.3 release notes',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-02-18',
    changes: [
      'Export logs with connectivity logging and debug panel export button',
      'Applied Apple developer NSAllowsArbitraryLoads flag',
      'Info button for torrent seed percent/leech',
      'Sorting by ratio',
      'Language translation support',
    ],
  },
  {
    version: '1.1.3',
    date: '2026-02-06',
    changes: [
      'Bugfix: hostname handling',
      'Fix protocol prefix handling and add community links',
      'General bugfix and cleanup',
    ],
  },
  {
    version: '1.1.2',
    date: '2026-02-05',
    changes: [
      'Backwards compatibility improvements for existing server configs',
      'Fixed basePath persistence for reverse proxy users',
      'Normalized host format on load to prevent double-protocol issues on upgrade',
      'Include basePath in settings export and import',
      'Defensive theme loading for legacy preference formats',
      'Coerce numeric preferences (timeouts, intervals) for robustness',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-02-02',
    changes: [
      'Fixed protocol prefix handling - no more double http:// issues',
      'Simplified server configuration with helpful tooltips',
      'Added cancel button during connection testing',
      'Removed confusing Base Path field',
      'Added What\'s New section',
      'Improved UX with cleaner placeholders and info icons',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-02-01',
    changes: [
      'Fixed hostname handling and connection issues',
      'Improved loading screen experience',
      'Better background app restoration',
    ],
  },
  {
    version: '1.0.6',
    date: '2024-12-16',
    changes: [
      'Fixed popup and Android localhost issues',
      'General stability improvements',
    ],
  },
  {
    version: '1.0.5',
    date: '2024-12-14',
    changes: [
      'Major UI cleanup and enhancements',
      'Improved add server form robustness',
      'Added credential toggle for local networks',
      'Fixed Android server configuration issues',
    ],
  },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { currentServer, isConnected, connectToServer, disconnect } = useServer();
  const { categories, tags } = useTorrents();
  const { isDark, toggleTheme, colors, reloadCustomColors } = useTheme();
  const { showToast } = useToast();
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState('');
  const [categorySavePath, setCategorySavePath] = useState('');
  const [tagName, setTagName] = useState('');
  const [appVersion, setAppVersion] = useState<ApplicationVersion | null>(null);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [loadingAppInfo, setLoadingAppInfo] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('1000');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [cardViewMode, setCardViewMode] = useState<'compact' | 'expanded'>('compact');
  const [savePathModalVisible, setSavePathModalVisible] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  
  // Persistent Sort/Filter Preferences
  const [defaultSortBy, setDefaultSortBy] = useState<'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'added_on'>('added_on');
  const [defaultSortDirection, setDefaultSortDirection] = useState<'asc' | 'desc'>('desc');
  const [defaultFilter, setDefaultFilter] = useState<string>('all');
  
  // Picker states
  const [sortByPickerVisible, setSortByPickerVisible] = useState(false);
  const [filterPickerVisible, setFilterPickerVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  
  // Default Torrent Behaviors
  const [pauseOnAdd, setPauseOnAdd] = useState(false);
  const [defaultSavePath, setDefaultSavePath] = useState('');
  const [autoCategorizeByTracker, setAutoCategorizeByTracker] = useState(false);
  const [defaultPriority, setDefaultPriority] = useState<number>(0);
  
  // Notifications & Feedback
  const [toastDuration, setToastDuration] = useState<number>(3000);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  
  // Server Management
  const [autoConnectLastServer, setAutoConnectLastServer] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState<number>(10000);
  
  // Advanced Settings
  const [apiTimeout, setApiTimeout] = useState<number>(30000);
  const [retryAttempts, setRetryAttempts] = useState<number>(3);
  const [debugMode, setDebugMode] = useState(false);
  
  // Pulse animation for connection status
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnected]);

  useFocusEffect(
    useCallback(() => {
      loadServers();
      loadPreferences();
      if (isConnected) {
        loadAppInfo();
        loadDefaultSavePath();
      }
    }, [isConnected])
  );

  const loadServers = useCallback(async () => {
    try {
      setLoading(true);
      const serverList = await ServerManager.getServers();
      setServers(serverList);
    } catch (error) {
      showToast(t('errors.failedToLoadServers'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAppInfo = async () => {
    try {
      setLoadingAppInfo(true);
      const [version, build] = await Promise.all([
        applicationApi.getVersion(),
        applicationApi.getBuildInfo(),
      ]);
      setAppVersion(version);
      setBuildInfo(build);
    } catch (error) {
      // Ignore app info loading errors
    } finally {
      setLoadingAppInfo(false);
    }
  };

  const loadDefaultSavePath = async () => {
    try {
      const serverPath = await applicationApi.getDefaultSavePath();
      if (serverPath) {
        setDefaultSavePath(serverPath);
        // Update preferences with server path
        const prefs = await storageService.getPreferences();
        prefs.defaultSavePath = serverPath;
        await storageService.savePreferences(prefs);
      }
    } catch (error) {
      // Ignore if not connected or API error
    }
  };

  const loadPreferences = async () => {
    try {
      const prefs = await storageService.getPreferences();
      const interval = Number(prefs.autoRefreshInterval) || 1000;
      setAutoRefreshInterval(interval.toString());
      const viewMode = prefs.cardViewMode || 'compact';
      setCardViewMode(viewMode);
      
      // Persistent Sort/Filter
      setDefaultSortBy(prefs.defaultSortBy || 'added_on');
      setDefaultSortDirection(prefs.defaultSortDirection || 'desc');
      setDefaultFilter(prefs.defaultFilter || 'all');
      
      // Default Torrent Behaviors
      setPauseOnAdd(prefs.pauseOnAdd || false);
      setDefaultSavePath(prefs.defaultSavePath || '');
      setAutoCategorizeByTracker(prefs.autoCategorizeByTracker || false);
      setDefaultPriority(Number(prefs.defaultPriority) || 0);
      
      // Notifications & Feedback
      setToastDuration(Number(prefs.toastDuration) || 3000);
      setHapticFeedback(prefs.hapticFeedback !== false); // default true
      
      // Server Management
      setAutoConnectLastServer(prefs.autoConnectLastServer || false);
      setConnectionTimeout(Number(prefs.connectionTimeout) || 10000);
      
      // Advanced Settings
      setApiTimeout(Number(prefs.apiTimeout) || 30000);
      setRetryAttempts(Number(prefs.retryAttempts) || 3);
      setDebugMode(prefs.debugMode || false);
    } catch (error) {
      setAutoRefreshInterval('1000');
      setCardViewMode('compact');
    }
  };

  const saveAutoRefreshInterval = async (interval: string) => {
    try {
      const prefs = await storageService.getPreferences();
      prefs.autoRefreshInterval = parseInt(interval, 10);
      await storageService.savePreferences(prefs);
    } catch (error) {
      // Ignore save errors
    }
  };

  const saveCardViewMode = async (mode: 'compact' | 'expanded') => {
    try {
      const prefs = await storageService.getPreferences();
      prefs.cardViewMode = mode;
      await storageService.savePreferences(prefs);
      setCardViewMode(mode);
    } catch (error) {
      // Ignore save errors
    }
  };

  const handleShutdown = async () => {
    try {
      await applicationApi.shutdown();
      showToast(t('toast.shutdownInitiated'), 'success');
    } catch (error) {
      showToast(t('errors.failedToShutdown'), 'error');
    }
  };

  // Helper functions for saving preferences
  const savePreference = async (key: string, value: any) => {
    try {
      const prefs = await storageService.getPreferences();
      prefs[key] = value;
      await storageService.savePreferences(prefs);
    } catch (error) {
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
          // Note: passwords are not exported for security
        })),
        exportDate: new Date().toISOString(),
        appVersion: APP_VERSION
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Use documentDirectory which is more accessible for sharing
      const docDir = FileSystem.documentDirectory;
      if (!docDir) {
        showToast(t('errors.fileSystemNotAvailable'), 'error');
        return;
      }
      
      const fileName = `qremote-settings.json`;
      const fileUri = `${docDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonString);
      
      if (await Sharing.isAvailableAsync()) {
        // Share with proper options to trigger system save dialogs
        // On iOS, UTI helps show "Save to Files"
        // On Android, MIME type helps show file managers
        const shareOptions: any = {
          mimeType: 'application/json',
          dialogTitle: 'Save Settings',
        };
        
        // UTI is iOS-specific - helps iOS show "Save to Files" option
        if (Platform.OS === 'ios') {
          shareOptions.UTI = 'public.json';
        }
        
        await Sharing.shareAsync(fileUri, shareOptions);
      } else {
        showToast(t('errors.sharingNotAvailable'), 'error');
      }
    } catch (error: any) {
      console.error('Export settings error:', error);
      showToast(error.message || t('errors.failedToExportSettings'), 'error');
    }
  };

  const importSettings = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      const importData = JSON.parse(fileContent);

      // Validate the import data structure
      if (!importData.preferences || !importData.servers) {
        showToast(t('errors.invalidSettingsFormat'), 'error');
        return;
      }

      // Import preferences
      await storageService.savePreferences(importData.preferences);

      // Import servers (without passwords - they need to be re-entered)
      const existingServers = await ServerManager.getServers();
      const existingServerIds = new Set(existingServers.map(s => s.id));

      for (const serverData of importData.servers) {
        if (!existingServerIds.has(serverData.id)) {
          // Create new server config (passwords will need to be re-entered)
          await ServerManager.saveServer({
            ...serverData,
            password: '', // Passwords are not imported for security
          });
        }
      }

      // Reload preferences and servers
      await loadPreferences();
      await loadServers();

      showToast(t('toast.settingsImported'), 'success');
    } catch (error: any) {
      console.error('Import settings error:', error);
      if (error.message?.includes('JSON')) {
        showToast(t('errors.failedToParseSettings'), 'error');
      } else {
        showToast(error.message || t('errors.failedToImportSettings'), 'error');
      }
    }
  };

  // Picker options
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

  const languageOptions: OptionPickerItem[] = [
    { label: 'English', value: 'en', icon: 'language-outline' },
    { label: 'Español', value: 'es', icon: 'language-outline' },
    { label: '中文', value: 'zh', icon: 'language-outline' },
    { label: 'Français', value: 'fr', icon: 'language-outline' },
    { label: 'Deutsch', value: 'de', icon: 'language-outline' },
  ];


  const handleAddServer = () => {
    router.push('/server/add');
  };

  const handleEditServer = (server: ServerConfig) => {
    router.push(`/server/${server.id}`);
  };


  const handleConnect = async (server: ServerConfig) => {
    try {
      const success = await connectToServer(server);
      if (success) {
        showToast(t('toast.connectedTo', { name: server.name }), 'success');
      } else {
        showToast(t('errors.checkCredentials'), 'error');
      }
    } catch (error: any) {
      showToast(error.message || t('errors.failedToConnect'), 'error');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    showToast(t('toast.disconnected'), 'info');
  };

  const handleDeleteServer = async (server: ServerConfig) => {
    try {
      // Check if we're deleting the currently connected server
      const isDeletingCurrentServer = currentServer?.id === server.id;
      
      await ServerManager.deleteServer(server.id);
      await loadServers();
      
      // Disconnect if we deleted the currently connected server
      if (isDeletingCurrentServer && isConnected) {
        await disconnect();
      } else {
        // If no servers remain, disconnect
        const remainingServers = await ServerManager.getServers();
        if (remainingServers.length === 0 && isConnected) {
          await disconnect();
        }
      }
      showToast(t('toast.serverDeleted', { name: server.name }), 'success');
    } catch (error) {
      showToast(t('errors.failedToDeleteServer'), 'error');
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
    } catch (error) {
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
    } catch (error) {
      showToast(t('errors.failedToCreateTag'), 'error');
    }
  };

  if (loading) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Connection Status */}
        {currentServer && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.connection').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.connectionRow}>
                <View style={styles.connectionInfo}>
                  <View style={styles.connectionTitleRow}>
                    <Animated.View 
                      style={[
                        styles.statusDot, 
                        { 
                          backgroundColor: isConnected ? colors.success : colors.error,
                          transform: [{ scale: isConnected ? pulseAnim : 1 }],
                        }
                      ]} 
                    />
                    <Text style={[styles.connectionTitle, { color: colors.text }]}>{currentServer.name}</Text>
                  </View>
                  <Text style={[styles.connectionSubtitle, { color: colors.textSecondary }]}>
                    {currentServer.host}{currentServer.port != null && currentServer.port > 0 ? `:${currentServer.port}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.disconnectButton, { backgroundColor: colors.error + '90' }]}
                  onPress={handleDisconnect}
                >
                  <Text 
                    style={[styles.disconnectText, { color: 'white' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t('screens.settings.disconnect')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Servers */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.servers').toUpperCase()}</Text>
            <TouchableOpacity onPress={handleAddServer}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {servers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="server-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('screens.settings.noServersConfigured')}</Text>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleAddServer}>
                  <Text style={styles.primaryButtonText}>{t('screens.settings.addServer')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              servers.map((server, index) => (
                <SwipeableServerItem
                  key={server.id}
                  server={server}
                  currentServer={currentServer}
                  colors={colors}
                  onPress={() => handleEditServer(server)}
                  onConnect={() => handleConnect(server)}
                  onDisconnect={() => disconnect()}
                  onDelete={() => handleDeleteServer(server)}
                  isLast={index === servers.length - 1}
                />
              ))
            )}
          </View>
        </View>

        {/* App / Language */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.app').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="language-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.language')}</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setLanguagePickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerText, { color: colors.text }]}>
                  {languageOptions.find((opt) => opt.value === ((i18n.language || 'en').startsWith('zh') ? 'zh' : (i18n.language || 'en')))?.label || 'English'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Torrent List Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.torrentList').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="swap-vertical-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.defaultSortBy')}</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setSortByPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerText, { color: colors.text }]}>
                  {sortByOptions.find(opt => opt.value === defaultSortBy)?.label || t('sort.dateAdded')}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
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
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="funnel-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.defaultFilter')}</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setFilterPickerVisible(true)}
                activeOpacity={0.7}
              >
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
                onValueChange={(value) => {
                  setPauseOnAdd(value);
                  savePreference('pauseOnAdd', value);
                }}
                trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                ios_backgroundColor={colors.surfaceOutline}
              />
            </View>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="folder-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.defaultSavePath')}</Text>
                  {defaultSavePath && <Text style={[styles.settingHint, { color: colors.textSecondary }]} numberOfLines={1}>{defaultSavePath}</Text>}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSavePathModalVisible(true)}
              >
                <Ionicons name="create-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="pricetag-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.autoCategorizeByTracker')}</Text>
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
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.appearance').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push('/settings/theme')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="color-palette-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.themeAndColors')}</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    {t('screens.settings.themeDescription')}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons 
                  name={cardViewMode === 'compact' ? 'list-outline' : 'albums-outline'} 
                  size={22} 
                  color={colors.primary} 
                />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.compactCardView')}</Text>
              </View>
              <Switch
                value={cardViewMode === 'compact'}
                onValueChange={(value) => saveCardViewMode(value ? 'compact' : 'expanded')}
                trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                ios_backgroundColor={colors.surfaceOutline}
              />
            </View>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="refresh-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.refreshInterval')}</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.milliseconds')}</Text>
                </View>
              </View>
              <TextInput
                style={[styles.settingInput, { backgroundColor: 'transparent', borderColor: colors.textSecondary, borderWidth: .5, color: colors.text }]}
                value={autoRefreshInterval}
                onChangeText={setAutoRefreshInterval}
                onBlur={() => saveAutoRefreshInterval(autoRefreshInterval)}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        </View>

        {/* Categories */}
        {isConnected && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.categories').toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setShowAddCategory(!showAddCategory)}>
                <Ionicons name={showAddCategory ? 'close-circle' : 'add-circle'} size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
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
                            } catch (error) {
                              showToast(t('errors.failedToDeleteCategory'), 'error');
                            }
                          }}
                        >
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {index < Object.keys(categories).length - 1 && <View style={[styles.separator, { backgroundColor: colors.background }]} />}
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Tags */}
        {isConnected && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.tags').toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setShowAddTag(!showAddTag)}>
                <Ionicons name={showAddTag ? 'close-circle' : 'add-circle'} size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
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
                  <View style={[styles.separator, { backgroundColor: colors.background  , marginTop: 16, marginLeft: 0 }]} />
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
                        } catch (error) {
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

        {/* Notifications & Feedback */}
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
                style={[styles.settingInput, { backgroundColor: 'transparent', borderColor: colors.textSecondary, borderWidth: 0.5, color: colors.text, width: 80 }]}
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
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.hapticFeedback')}</Text>
              </View>
              <Switch
                value={hapticFeedback}
                onValueChange={(value) => {
                  setHapticFeedback(value);
                  savePreference('hapticFeedback', value);
                }}
                trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                ios_backgroundColor={colors.surfaceOutline}
              />
            </View>
          </View>
        </View>

        {/* Server Management Enhancements */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.serverManagement').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="flash-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.autoConnectLastServer')}</Text>
              </View>
              <Switch
                value={autoConnectLastServer}
                onValueChange={(value) => {
                  setAutoConnectLastServer(value);
                  savePreference('autoConnectLastServer', value);
                }}
                trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                ios_backgroundColor={colors.surfaceOutline}
              />
            </View>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="timer-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.connectionTimeout')}</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.milliseconds')}</Text>
                </View>
              </View>
              <TextInput
                style={[styles.settingInput, { backgroundColor: 'transparent', borderColor: colors.textSecondary, borderWidth: 0.5, color: colors.text, width: 80 }]}
                value={connectionTimeout.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  if (!isNaN(num) && num >= 1000 && num <= 60000) {
                    setConnectionTimeout(num);
                    savePreference('connectionTimeout', num);
                  }
                }}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        </View>

        {/* Advanced Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.advanced').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.apiTimeout')}</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.milliseconds')}</Text>
                </View>
              </View>
              <TextInput
                style={[styles.settingInput, { backgroundColor: 'transparent', borderColor: colors.textSecondary, borderWidth: 0.5, color: colors.text, width: 80 }]}
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
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="repeat-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.retryAttempts')}</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('screens.settings.retryAttemptsHint')}</Text>
                </View>
              </View>
              <TextInput
                style={[styles.settingInput, { backgroundColor: 'transparent', borderColor: colors.textSecondary, borderWidth: 0.5, color: colors.text, width: 80 }]}
                value={retryAttempts.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  if (!isNaN(num) && num >= 0 && num <= 10) {
                    setRetryAttempts(num);
                    savePreference('retryAttempts', num);
                  }
                }}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="bug-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.debugMode')}</Text>
              </View>
              <Switch
                value={debugMode}
                onValueChange={(value) => {
                  setDebugMode(value);
                  savePreference('debugMode', value);
                }}
                trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                ios_backgroundColor={colors.surfaceOutline}
              />
            </View>
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
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <TouchableOpacity style={styles.settingRow} onPress={importSettings}>
              <View style={styles.settingLeft}>
                <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.importSettings')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Application Info - qBittorrent Server */}
        {isConnected && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.qbittorrentServer').toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {loadingAppInfo ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <>
                  {appVersion && (
                    <>
                      <InfoRow icon="information-circle-outline" label="qBittorrent" value={appVersion.version} colors={colors} />
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                      <InfoRow icon="code-slash-outline" label="API Version" value={appVersion.apiVersion} colors={colors} />
                    </>
                  )}
                  {buildInfo && (
                    <>
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                      <InfoRow icon="cube-outline" label="Libtorrent" value={buildInfo.libtorrent} colors={colors} />
                      <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                      <InfoRow icon="hardware-chip-outline" label="Architecture" value={`${buildInfo.bitness}-bit`} colors={colors} />
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        {/* About qRemote - Community Links */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.community').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => Linking.openURL('https://github.com/taylorcox75/qremote')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="logo-github" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.sourceCode')}</Text>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => Linking.openURL('https://github.com/taylorcox75/qRemote/issues')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="bug-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.reportIssue')}</Text>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => Linking.openURL('https://www.paypal.com/donate/?business=E9XLGFHN963HN&no_recurring=0&currency_code=USD')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="beer-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.buyMeBeer')}</Text>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('screens.settings.appInfo').toUpperCase()}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <InfoRow icon="information-circle-outline" label={t('screens.settings.appVersion')} value={APP_VERSION} colors={colors} />
            <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => setShowWhatsNew(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('screens.settings.whatsNew')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
            <InfoRow icon="logo-react" label="React Native" value={Platform.constants.reactNativeVersion?.major + '.' + Platform.constants.reactNativeVersion?.minor + '.' + Platform.constants.reactNativeVersion?.patch || 'N/A'} colors={colors} />
            <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
            <InfoRow icon="phone-portrait-outline" label={t('screens.settings.platform')} value={Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)} colors={colors} />
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

      {/* Option Pickers */}
      <OptionPicker
        visible={sortByPickerVisible}
        title={t('screens.settings.sortBy')}
        options={sortByOptions}
        selectedValue={defaultSortBy}
        onSelect={(value) => {
          setDefaultSortBy(value as any);
          savePreference('defaultSortBy', value);
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
        visible={languagePickerVisible}
        title={t('screens.settings.language')}
        options={languageOptions}
        selectedValue={(i18n.language || 'en').startsWith('zh') ? 'zh' : (i18n.language || 'en')}
        onSelect={async (value) => {
          await setStoredLanguage(value);
          await i18n.changeLanguage(value);
          setLanguagePickerVisible(false);
        }}
        onClose={() => setLanguagePickerVisible(false)}
      />

      {/* Default Save Path Modal */}
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
            } catch (error) {
              showToast(t('errors.failedToUpdateSavePath'), 'error');
            }
          } else {
            showToast(t('toast.savePathSavedLocally'), 'info');
          }
        }}
      />

      {/* What's New Modal */}
      <Modal
        visible={showWhatsNew}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWhatsNew(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.surfaceOutline }]}>
            <View style={styles.modalTitleContainer}>
              <Ionicons name="sparkles" size={28} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('screens.settings.whatsNew')}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowWhatsNew(false)} style={styles.modalCloseButton}>
              <Ionicons name="close" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.changelogScroll} contentContainerStyle={styles.changelogContent}>
            {CHANGELOG.map((release, index) => (
              <View key={release.version} style={styles.changelogRelease}>
                <View style={styles.releaseHeader}>
                  <Text style={[styles.releaseVersion, { color: colors.primary }]}>v{release.version}</Text>
                  <Text style={[styles.releaseDate, { color: colors.textSecondary }]}>{formatReleaseDate(release.date)}</Text>
                </View>
                <View style={[styles.changesList, { backgroundColor: colors.surface }]}>
                  {release.changes.map((change, changeIndex) => (
                    <View key={changeIndex} style={styles.changeItem}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} style={styles.changeIcon} />
                      <Text style={[styles.changeText, { color: colors.text }]}>{change}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

    </>
  );
}

function SwipeableServerItem({
  server,
  currentServer,
  colors,
  onPress,
  onConnect,
  onDisconnect,
  onDelete,
  isLast,
}: {
  server: ServerConfig;
  currentServer: ServerConfig | null;
  colors: any;
  onPress: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const translateX = useRef(new Animated.Value(0)).current;
  const isSwipeOpen = useRef(false);
  
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        translateX.setOffset(isSwipeOpen.current ? -80 : 0);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const baseValue = isSwipeOpen.current ? -80 : 0;
        const newValue = baseValue + gestureState.dx;
        // Only allow swiping left (negative values)
        translateX.setValue(Math.max(Math.min(newValue, 0), -80));
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        const baseValue = isSwipeOpen.current ? -80 : 0;
        const finalValue = baseValue + gestureState.dx;
        if (finalValue < -40) {
          // Swipe left enough to reveal delete
          isSwipeOpen.current = true;
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start();
        } else {
          // Snap back
          isSwipeOpen.current = false;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    isSwipeOpen.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start(() => {
      onDelete();
    });
  };

  const handlePress = () => {
    if (isSwipeOpen.current) {
      // If swiped open, close it
      isSwipeOpen.current = false;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      onPress();
    }
  };

  const serverAddress = `${server.host}${server.port != null && server.port > 0 ? `:${server.port}` : ''}`;
  const isConnected = currentServer?.id === server.id;

  return (
    <View>
      <View style={styles.swipeableContainer}>
        {/* Delete button background */}
        <View style={[styles.swipeableAction, { backgroundColor: colors.error }]}>
          <TouchableOpacity 
            style={styles.swipeableActionButton} 
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete server ${server.name}`}
            accessibilityHint="Swipe left or tap to delete this server"
          >
            <Ionicons name="trash" size={24} color="#FFFFFF" />
            <Text style={styles.swipeableActionText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
        {/* Main content */}
        <Animated.View
          style={[
            styles.swipeableContent,
            {
              transform: [{ translateX }],
              backgroundColor: colors.surface,
            },
          ]}
          {...panResponder.panHandlers}
          accessibilityRole="button"
          accessibilityLabel={`Server ${server.name} at ${serverAddress}${isConnected ? ', currently connected' : ''}`}
          accessibilityHint="Swipe left to delete, tap to edit"
        >
          <TouchableOpacity style={styles.listItem} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.listItemContent}>
              <View style={styles.listItemLeft}>
                <Ionicons name="server-outline" size={20} color={colors.primary} />
                <View style={styles.listItemText}>
                  <Text style={[styles.listItemTitle, { color: colors.text }]}>{server.name}</Text>
                  <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>
                    {serverAddress}
                  </Text>
                </View>
              </View>
              <View style={styles.listItemRight}>
                {isConnected ? (
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: colors.error }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      onDisconnect();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('screens.settings.disconnect') + ' ' + server.name}
                  >
                    <Text 
                      style={styles.smallButtonText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t('screens.settings.disconnect')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: colors.success }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      onConnect();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Connect to ${server.name}`}
                  >
                    <Text style={styles.smallButtonText}>{t('screens.settings.connect')}</Text>
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
      {!isLast && <View style={[styles.separator, { backgroundColor: colors.background }]} />}
    </View>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    marginRight: spacing.xs,
  },
  card: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    ...shadows.card,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectionTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  connectionSubtitle: {
    ...typography.small,
    marginTop: 2,
    marginLeft: 18,
  },
  disconnectButton: {
    ...buttonStyles.small,
    paddingVertical: spacing.xs + 2,
  },
  disconnectText: {
    ...buttonText.small,
  },
  listItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    ...typography.bodyMedium,
  },
  listItemSubtitle: {
    ...typography.small,
    marginTop: 1,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  separator: {
    height: 1,
    marginLeft: 50,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.small,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
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
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  settingHint: {
    fontSize: 12,
    marginTop: 1,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingInput: {
    borderWidth: .25,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 15,
    width: 80,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  emptyStateSmall: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTextSmall: {
    fontSize: 14,
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  addForm: {
    padding: 16,
    gap: 10,
  },
  formInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.secondary,
  },
  formButton: {
    ...buttonStyles.primary,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  formButtonText: {
    ...buttonText.primary,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.small,
    borderWidth: 0.5,
  },
  tagChipText: {
    ...typography.smallMedium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: {
    ...typography.secondary,
  },
  infoValue: {
    ...typography.secondaryMedium,
  },
  loadingState: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  dangerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dangerLabel: {
    ...typography.bodyMedium,
  },
  dangerHint: {
    ...typography.caption,
    marginTop: 1,
  },
  swipeableContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeableAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeableActionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    gap: 4,
  },
  swipeableActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  swipeableContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  colorPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  changelogScroll: {
    flex: 1,
  },
  changelogContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  changelogRelease: {
    marginBottom: spacing.xxl,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  releaseVersion: {
    fontSize: 20,
    fontWeight: '700',
  },
  releaseDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  changesList: {
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    gap: spacing.sm,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  changeIcon: {
    marginTop: 2,
  },
  changeText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});

// Color Setting Row Component

