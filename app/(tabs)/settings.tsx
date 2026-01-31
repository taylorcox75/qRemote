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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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

export default function SettingsScreen() {
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
  
  // Persistent Sort/Filter Preferences
  const [defaultSortBy, setDefaultSortBy] = useState<'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'added_on'>('added_on');
  const [defaultSortDirection, setDefaultSortDirection] = useState<'asc' | 'desc'>('desc');
  const [defaultFilter, setDefaultFilter] = useState<string>('all');
  
  // Picker states
  const [sortByPickerVisible, setSortByPickerVisible] = useState(false);
  const [filterPickerVisible, setFilterPickerVisible] = useState(false);
  
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
      showToast('Failed to load servers', 'error');
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
      const interval = prefs.autoRefreshInterval || 1000;
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
      setDefaultPriority(prefs.defaultPriority || 0);
      
      // Notifications & Feedback
      setToastDuration(prefs.toastDuration || 3000);
      setHapticFeedback(prefs.hapticFeedback !== false); // default true
      
      // Server Management
      setAutoConnectLastServer(prefs.autoConnectLastServer || false);
      setConnectionTimeout(prefs.connectionTimeout || 10000);
      
      // Advanced Settings
      setApiTimeout(prefs.apiTimeout || 30000);
      setRetryAttempts(prefs.retryAttempts || 3);
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
      showToast('Application shutdown initiated', 'success');
    } catch (error) {
      showToast('Failed to shutdown application', 'error');
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
        showToast('File system not available', 'error');
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
        showToast('Sharing not available', 'error');
      }
    } catch (error: any) {
      console.error('Export settings error:', error);
      showToast(error.message || 'Failed to export settings', 'error');
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
        showToast('Invalid settings file format', 'error');
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

      showToast('Settings imported successfully', 'success');
    } catch (error: any) {
      console.error('Import settings error:', error);
      if (error.message?.includes('JSON')) {
        showToast('Failed to parse settings file. Please check the file format.', 'error');
      } else {
        showToast(error.message || 'Failed to import settings', 'error');
      }
    }
  };

  // Picker options
  const sortByOptions: OptionPickerItem[] = [
    { label: 'Name', value: 'name', icon: 'text-outline' },
    { label: 'Size', value: 'size', icon: 'disc-outline' },
    { label: 'Progress', value: 'progress', icon: 'pie-chart-outline' },
    { label: 'Download Speed', value: 'dlspeed', icon: 'download-outline' },
    { label: 'Upload Speed', value: 'upspeed', icon: 'arrow-up-outline' },
    { label: 'Added Date', value: 'added_on', icon: 'calendar-outline' },
  ];

  const filterOptions: OptionPickerItem[] = [
    { label: 'All', value: 'all', icon: 'grid-outline' },
    { label: 'Active', value: 'active', icon: 'pulse' },
    { label: 'Done', value: 'completed', icon: 'checkmark-circle' },
    { label: 'Paused', value: 'paused', icon: 'pause-circle' },
    { label: 'Stuck', value: 'stuck', icon: 'warning' },
    { label: 'DL', value: 'downloading', icon: 'arrow-down' },
    { label: 'UL', value: 'uploading', icon: 'arrow-up' },
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
        showToast(`Connected to ${server.name}`, 'success');
      } else {
        showToast('Failed to connect. Please check your credentials.', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to connect', 'error');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    showToast('Disconnected from server', 'info');
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
      showToast(`Server "${server.name}" deleted`, 'success');
    } catch (error) {
      showToast('Failed to delete server', 'error');
    }
  };
        
    

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      showToast('Please enter a category name', 'error');
      return;
    }
    const categoryToAdd = categoryName.trim();
    try {
      await categoriesApi.addCategory(categoryToAdd, categorySavePath.trim() || undefined);
      setCategoryName('');
      setCategorySavePath('');
      setShowAddCategory(false);
      showToast(`Category "${categoryToAdd}" added`, 'success');
    } catch (error) {
      showToast('Failed to add category', 'error');
    }
  };

  const handleAddTag = async () => {
    if (!tagName.trim()) {
      showToast('Please enter a tag name', 'error');
      return;
    }
    const tagToAdd = tagName.trim();
    try {
      await tagsApi.createTags([tagToAdd]);
      setTagName('');
      setShowAddTag(false);
      showToast(`Tag "${tagToAdd}" created`, 'success');
    } catch (error) {
      showToast('Failed to create tag', 'error');
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
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>CONNECTION</Text>
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
                    Disconnect
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Servers */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>SERVERS</Text>
            <TouchableOpacity onPress={handleAddServer}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {servers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="server-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No servers configured</Text>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleAddServer}>
                  <Text style={styles.primaryButtonText}>Add Server</Text>
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

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push('/settings/theme')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="color-palette-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Theme & Colors</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Customize theme and color settings
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
                <Text style={[styles.settingLabel, { color: colors.text }]}>Compact Card View</Text>
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
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Refresh Interval</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>Milliseconds</Text>
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
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>CATEGORIES</Text>
              <TouchableOpacity onPress={() => setShowAddCategory(!showAddCategory)}>
                <Ionicons name={showAddCategory ? 'close-circle' : 'add-circle'} size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {showAddCategory && (
                <View style={styles.addForm}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                    placeholder="Category name"
                    placeholderTextColor={colors.textSecondary}
                    value={categoryName}
                    onChangeText={setCategoryName}
                  />
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                    placeholder="Save path (optional)"
                    placeholderTextColor={colors.textSecondary}
                    value={categorySavePath}
                    onChangeText={setCategorySavePath}
                  />
                  <TouchableOpacity style={[styles.formButton, { backgroundColor: colors.primary }]} onPress={handleAddCategory}>
                    <Text style={styles.formButtonText}>Add Category</Text>
                  </TouchableOpacity>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline, marginTop: 16, marginLeft: 0 }]} />
                </View>
              )}
              {Object.keys(categories).length === 0 && !showAddCategory ? (
                <View style={styles.emptyStateSmall}>
                  <Ionicons name="folder-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>No categories</Text>
                  <Text style={[styles.emptyTextSmall, { color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>Create your first category to organize torrents</Text>
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
                              showToast(`Category "${name}" deleted`, 'success');
                            } catch (error) {
                              showToast('Failed to delete category', 'error');
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
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>TAGS</Text>
              <TouchableOpacity onPress={() => setShowAddTag(!showAddTag)}>
                <Ionicons name={showAddTag ? 'close-circle' : 'add-circle'} size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {showAddTag && (
                <View style={styles.addForm}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                    placeholder="Tag name"
                    placeholderTextColor={colors.textSecondary}
                    value={tagName}
                    onChangeText={setTagName}
                  />
                  <TouchableOpacity style={[styles.formButton, { backgroundColor: colors.primary }]} onPress={handleAddTag}>
                    <Text style={styles.formButtonText}>Create Tag</Text>
                  </TouchableOpacity>
                  <View style={[styles.separator, { backgroundColor: colors.background  , marginTop: 16, marginLeft: 0 }]} />
                </View>
              )}
              {tags.length === 0 && !showAddTag ? (
                <View style={styles.emptyStateSmall}>
                  <Ionicons name="pricetag-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>No tags</Text>
                  <Text style={[styles.emptyTextSmall, { color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>Add tags to label and filter your torrents</Text>
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
                          showToast(`Tag "${tag}" deleted`, 'success');
                        } catch (error) {
                          showToast('Failed to delete tag', 'error');
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

        {/* Application Info */}
        {isConnected && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>APPLICATION</Text>
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

        {/* Persistent Sort/Filter Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>TORRENT LIST</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="swap-vertical-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Default Sort By</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setSortByPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerText, { color: colors.text }]}>
                  {defaultSortBy === 'name' ? 'Name' : defaultSortBy === 'size' ? 'Size' : defaultSortBy === 'progress' ? 'Progress' : defaultSortBy === 'dlspeed' ? 'Download Speed' : defaultSortBy === 'upspeed' ? 'Upload Speed' : 'Added Date'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="swap-vertical-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Default Sort Direction</Text>
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
                  {defaultSortDirection === 'asc' ? 'Ascending' : 'Descending'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="funnel-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Default Filter</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setFilterPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerText, { color: colors.text }]}>
                  {filterOptions.find(opt => opt.value === defaultFilter)?.label || defaultFilter.charAt(0).toUpperCase() + defaultFilter.slice(1)}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Default Torrent Behaviors */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>TORRENT BEHAVIOR</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="pause-circle-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Pause on Add</Text>
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
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Default Save Path</Text>
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
                <Text style={[styles.settingLabel, { color: colors.text }]}>Auto-categorize by Tracker</Text>
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

        {/* Notifications & Feedback */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>NOTIFICATIONS & FEEDBACK</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="timer-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Notification Duration</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>Milliseconds</Text>
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
                <Text style={[styles.settingLabel, { color: colors.text }]}>Haptic Feedback</Text>
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
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>SERVER MANAGEMENT</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="flash-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Auto-connect to Last Server</Text>
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
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Connection Timeout</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>Milliseconds</Text>
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
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>ADVANCED</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>API Timeout</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>Milliseconds</Text>
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
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Retry Attempts</Text>
                  <Text style={[styles.settingHint, { color: colors.textSecondary }]}>Number of retries</Text>
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
                <Text style={[styles.settingLabel, { color: colors.text }]}>Debug Mode</Text>
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
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>BACKUP & RESTORE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.settingRow} onPress={exportSettings}>
              <View style={styles.settingLeft}>
                <Ionicons name="download-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Export Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <TouchableOpacity style={styles.settingRow} onPress={importSettings}>
              <View style={styles.settingLeft}>
                <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Import Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <InfoRow icon="information-circle-outline" label="App Version" value={APP_VERSION} colors={colors} />
            <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
            <InfoRow icon="logo-react" label="React Native" value={Platform.constants.reactNativeVersion?.major + '.' + Platform.constants.reactNativeVersion?.minor + '.' + Platform.constants.reactNativeVersion?.patch || 'N/A'} colors={colors} />
            <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
            <InfoRow icon="phone-portrait-outline" label="Platform" value={Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)} colors={colors} />
            {buildInfo && (
              <>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <InfoRow icon="code-working-outline" label="Build Info" value={`${buildInfo.qt} / ${buildInfo.libtorrent}`} colors={colors} />
              </>
            )}
          </View>
        </View>

        {/* Danger Zone */}
        {isConnected && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.error }]}>DANGER ZONE</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity style={styles.dangerRow} onPress={handleShutdown}>
                <View style={styles.dangerLeft}>
                  <Ionicons name="power-outline" size={22} color={colors.error} />
                  <View>
                    <Text style={[styles.dangerLabel, { color: colors.error }]}>Shutdown qBittorrent</Text>
                    <Text style={[styles.dangerHint, { color: colors.textSecondary }]}>Stop the application</Text>
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
        title="Sort By"
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
        title="Default Filter"
        options={filterOptions}
        selectedValue={defaultFilter}
        onSelect={(value) => {
          setDefaultFilter(value);
          savePreference('defaultFilter', value);
          setFilterPickerVisible(false);
        }}
        onClose={() => setFilterPickerVisible(false)}
      />

      {/* Default Save Path Modal */}
      <InputModal
        visible={savePathModalVisible}
        title="Default Save Path"
        message="Enter default save path for new torrents"
        placeholder="/path/to/downloads"
        defaultValue={defaultSavePath}
        keyboardType="default"
        onCancel={() => setSavePathModalVisible(false)}
        onConfirm={(path: string) => {
          setDefaultSavePath(path);
          savePreference('defaultSavePath', path);
          setSavePathModalVisible(false);
        }}
      />

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
            <Text style={styles.swipeableActionText}>Delete</Text>
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
                    accessibilityLabel={`Disconnect from ${server.name}`}
                  >
                    <Text 
                      style={styles.smallButtonText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      Disconnect
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
                    <Text style={styles.smallButtonText}>Connect</Text>
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
});

// Color Setting Row Component

