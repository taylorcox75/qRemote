import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { ServerManager } from '@/services/server-manager';
import { storageService } from '@/services/storage';
import { ServerConfig } from '@/types/api';
import { AppPreferences } from '@/types/preferences';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { buttonStyles, buttonText } from '@/constants/buttons';

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
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderGrant: () => {
        translateX.setOffset(isSwipeOpen.current ? -80 : 0);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const baseValue = isSwipeOpen.current ? -80 : 0;
        const newValue = baseValue + gestureState.dx;
        translateX.setValue(Math.max(Math.min(newValue, 0), -80));
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        const baseValue = isSwipeOpen.current ? -80 : 0;
        const finalValue = baseValue + gestureState.dx;
        if (finalValue < -40) {
          isSwipeOpen.current = true;
          Animated.spring(translateX, { toValue: -80, useNativeDriver: true, tension: 50, friction: 7 }).start();
        } else {
          isSwipeOpen.current = false;
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7 }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    isSwipeOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7 }).start(() => onDelete());
  };

  const handlePress = () => {
    if (isSwipeOpen.current) {
      isSwipeOpen.current = false;
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7 }).start();
    } else {
      onPress();
    }
  };

  const serverAddress = `${server.host}${server.port != null && server.port > 0 ? `:${server.port}` : ''}`;
  const isConnectedToThis = currentServer?.id === server.id;

  return (
    <View>
      <View style={styles.swipeableContainer}>
        <View style={[styles.swipeableAction, { backgroundColor: colors.error }]}>
          <TouchableOpacity style={styles.swipeableActionButton} onPress={handleDelete}>
            <Ionicons name="trash" size={24} color="#FFFFFF" />
            <Text style={styles.swipeableActionText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
        <Animated.View
          style={[styles.swipeableContent, { transform: [{ translateX }], backgroundColor: colors.surface }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity style={styles.listItem} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.listItemContent}>
              <View style={styles.listItemLeft}>
                <Ionicons name="server-outline" size={20} color={colors.primary} />
                <View style={styles.listItemText}>
                  <Text style={[styles.listItemTitle, { color: colors.text }]}>{server.name}</Text>
                  <Text style={[styles.listItemSubtitle, { color: colors.textSecondary }]}>{serverAddress}</Text>
                </View>
              </View>
              <View style={styles.listItemRight}>
                {isConnectedToThis ? (
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: colors.error }]}
                    onPress={(e) => { e.stopPropagation(); onDisconnect(); }}
                  >
                    <Text style={styles.smallButtonText} numberOfLines={1} adjustsFontSizeToFit>
                      {t('screens.settings.disconnect')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: colors.success }]}
                    onPress={(e) => { e.stopPropagation(); onConnect(); }}
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
      {!isLast && <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />}
    </View>
  );
}

export default function ServersSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { currentServer, isConnected, connectToServer, disconnect } = useServer();
  const { showToast } = useToast();

  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoConnectLastServer, setAutoConnectLastServer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadServers();
      loadPreferences();
    }, [])
  );

  const loadServers = useCallback(async () => {
    try {
      setLoading(true);
      const serverList = await ServerManager.getServers();
      setServers(serverList);
    } catch {
      showToast(t('errors.failedToLoadServers'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await storageService.getPreferences();
      setAutoConnectLastServer(prefs.autoConnectLastServer !== false);
    } catch {
      // Use defaults
    }
  };

  const savePreference = async (key: keyof AppPreferences, value: any) => {
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, [key]: value });
    } catch {
      // Ignore save errors
    }
  };

  const handleAddServer = () => router.push('/server/add');

  const handleEditServer = (server: ServerConfig) => router.push(`/server/${server.id}`);

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
      const isDeletingCurrentServer = currentServer?.id === server.id;
      await ServerManager.deleteServer(server.id);
      await loadServers();
      if (isDeletingCurrentServer && isConnected) {
        await disconnect();
      } else {
        const remainingServers = await ServerManager.getServers();
        if (remainingServers.length === 0 && isConnected) {
          await disconnect();
        }
      }
      showToast(t('toast.serverDeleted', { name: server.name }), 'success');
    } catch {
      showToast(t('errors.failedToDeleteServer'), 'error');
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('screens.settings.servers')}</Text>
          <TouchableOpacity onPress={handleAddServer} style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="add" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Auto-connect */}
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
            </View>
          </View>

          {/* Server List */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary, marginBottom: 0 }]}>{t('screens.settings.servers').toUpperCase()}</Text>
              <TouchableOpacity onPress={handleAddServer}>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, marginTop: spacing.sm }]}>
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

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  separator: { height: 1, marginLeft: 50 },
  listItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  listItemContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  listItemText: { flex: 1 },
  listItemTitle: { ...typography.bodyMedium },
  listItemSubtitle: { ...typography.small, marginTop: 1 },
  listItemRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  smallButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { fontSize: 15 },
  primaryButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  swipeableContainer: { position: 'relative', overflow: 'hidden' },
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
  swipeableActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  swipeableContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
