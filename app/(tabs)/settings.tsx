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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useServer } from '../../context/ServerContext';
import { useTorrents } from '../../context/TorrentContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { ColorPicker } from '../../components/ColorPicker';
import { colorThemeManager, ColorTheme } from '../../services/color-theme-manager';
import { ServerManager } from '../../services/server-manager';
import { ServerConfig } from '../../types/api';
import { storageService } from '../../services/storage';
import { categoriesApi } from '../../services/api/categories';
import { tagsApi } from '../../services/api/tags';
import { applicationApi } from '../../services/api/application';
import { ApplicationVersion, BuildInfo } from '../../types/api';
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
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('1500');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [cardViewMode, setCardViewMode] = useState<'compact' | 'expanded'>('compact');
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorPickerKey, setColorPickerKey] = useState<keyof ColorTheme | null>(null);
  
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

  const loadPreferences = async () => {
    try {
      const prefs = await storageService.getPreferences();
      const interval = prefs.autoRefreshInterval || 1500;
      setAutoRefreshInterval(interval.toString());
      const viewMode = prefs.cardViewMode || 'compact';
      setCardViewMode(viewMode);
    } catch (error) {
      setAutoRefreshInterval('1500');
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
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={colors.primary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: 'white' + '100', true: 'colors.success '}}
                ios_backgroundColor= {colors.surfaceOutline}
                thumbColor={isDark ? 'white' : 'white'}              />
            </View>
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
                trackColor={{ false: 'white' + '100', true: 'colors.success '}}
                ios_backgroundColor={colors.surfaceOutline}
                thumbColor={cardViewMode === 'compact' ? 'white' : 'white'}
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

        {/* Color Customization */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>COLOR THEME</Text>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await colorThemeManager.resetCustomColors(isDark);
                  await reloadCustomColors();
                  showToast('Colors reset to defaults', 'success');
                } catch (error) {
                  showToast('Failed to reset colors', 'error');
                }
              }}
            >
              <Ionicons name="refresh" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <ColorSettingRow
              label="Primary"
              color={colors.primary}
              onPress={() => {
                setColorPickerKey('primary');
                setColorPickerVisible(true);
              }}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Error"
              color={colors.error}
              onPress={() => {
                setColorPickerKey('error');
                setColorPickerVisible(true);
              }}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Success"
              color={colors.success}
              onPress={() => {
                setColorPickerKey('success');
                setColorPickerVisible(true);
              }}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Warning"
              color={colors.warning}
              onPress={() => {
                setColorPickerKey('warning');
                setColorPickerVisible(true);
              }}
              colors={colors}
            />
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
                  <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>No categories</Text>
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
                  <Text style={[styles.emptyTextSmall, { color: colors.textSecondary }]}>No tags</Text>
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

      {/* Color Picker Modal */}
      {colorPickerKey && (
        <ColorPicker
          visible={colorPickerVisible}
          currentColor={colors[colorPickerKey]}
          onColorChange={async (newColor) => {
            try {
              const custom = await colorThemeManager.getCustomColors(isDark);
              const updatedCustom: ColorTheme = {
                ...custom,
                [colorPickerKey]: newColor,
              };
              await colorThemeManager.saveCustomColors(isDark, updatedCustom);
              await reloadCustomColors();
              showToast(`${colorPickerKey} color updated`, 'success');
            } catch (error) {
              showToast('Failed to save color', 'error');
            }
          }}
          onClose={() => {
            setColorPickerVisible(false);
            setColorPickerKey(null);
          }}
        />
      )}
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
  settingHint: {
    fontSize: 12,
    marginTop: 1,
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
function ColorSettingRow({
  label,
  color,
  onPress,
  colors,
}: {
  label: string;
  color: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingLeft}>
        <Ionicons name="color-palette" size={22} color={colors.primary} />
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <View style={styles.colorPickerButton}>
        <View style={[styles.colorPreview, { backgroundColor: color }]} />
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

