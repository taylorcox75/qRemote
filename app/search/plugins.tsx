/**
 * plugins.tsx — qBittorrent search plugin management.
 *
 * Lists installed plugins with enable toggles, supports uninstall, install
 * from URL via InputModal, and triggers update-all.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { InputModal } from '@/components/InputModal';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useServer } from '@/context/ServerContext';
import { searchApi } from '@/services/api/search';
import { SearchPlugin } from '@/types/api';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';

export default function PluginsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const { isConnected } = useServer();
  const queryClient = useQueryClient();

  const [installModalVisible, setInstallModalVisible] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const pluginsQuery = useQuery<SearchPlugin[]>({
    queryKey: ['search', 'plugins'],
    queryFn: () => searchApi.getPlugins(),
    enabled: isConnected,
    retry: 1,
  });

  // Refetch on focus so newly-added plugins from another device show up.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['search', 'plugins'] });
    }, [queryClient]),
  );

  const refresh = useCallback(
    async () => {
      await queryClient.invalidateQueries({ queryKey: ['search', 'plugins'] });
    },
    [queryClient],
  );

  const handleToggleEnabled = useCallback(
    async (plugin: SearchPlugin) => {
      setBusyName(plugin.name);
      try {
        await searchApi.enablePlugin(plugin.name, !plugin.enabled);
        haptics.light();
        await refresh();
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      } finally {
        setBusyName(null);
      }
    },
    [refresh, showToast],
  );

  const handleUninstall = useCallback(
    (plugin: SearchPlugin) => {
      Alert.alert(
        t('screens.search.uninstallTitle'),
        t('screens.search.uninstallConfirm', { name: plugin.fullName }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              setBusyName(plugin.name);
              try {
                await searchApi.uninstallPlugin(plugin.name);
                haptics.success();
                showToast(t('screens.search.uninstalledToast'), 'success');
                await refresh();
              } catch (err: unknown) {
                haptics.error();
                showToast(getErrorMessage(err), 'error');
              } finally {
                setBusyName(null);
              }
            },
          },
        ],
      );
    },
    [refresh, showToast, t],
  );

  const handleInstall = useCallback(
    async (value: string) => {
      setInstallModalVisible(false);
      const source = value.trim();
      if (!source) return;
      try {
        await searchApi.installPlugin(source);
        haptics.success();
        showToast(t('screens.search.installedToast'), 'success');
        await refresh();
        // qBT installs plugins asynchronously — the immediate refresh above
        // often races the server, so refresh again shortly after (mirrors
        // handleUpdateAll's workaround for the same underlying behavior).
        setTimeout(() => {
          void refresh();
        }, 2000);
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      }
    },
    [refresh, showToast, t],
  );

  const handleUpdateAll = useCallback(async () => {
    setUpdating(true);
    try {
      await searchApi.updatePlugins();
      haptics.success();
      showToast(t('screens.search.updateStartedToast'), 'success');
      // Refresh shortly after — qBT processes the update asynchronously.
      setTimeout(() => {
        void refresh();
      }, 2000);
    } catch (err: unknown) {
      haptics.error();
      showToast(getErrorMessage(err), 'error');
    } finally {
      setUpdating(false);
    }
  }, [refresh, showToast, t]);

  const plugins = pluginsQuery.data ?? [];

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
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
            {t('screens.search.pluginsTitle')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => setInstallModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {t('screens.search.installPlugin')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.surfaceOutline,
                  opacity: updating ? 0.5 : 1,
                },
              ]}
              onPress={handleUpdateAll}
              disabled={updating}
              activeOpacity={0.7}
            >
              {updating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh" size={18} color={colors.primary} />
              )}
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {t('screens.search.updateAll')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Plugin list */}
          {pluginsQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !isConnected ? (
            <EmptyState subtitle={t('toast.notConnected')} />
          ) : plugins.length === 0 ? (
            <EmptyState
              icon="extension-puzzle-outline"
              iconSize={56}
              title={t('screens.search.noPluginsTitle')}
              subtitle={t('screens.search.noPluginsSubtitle')}
            />
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {plugins.map((plugin, index) => (
                <PluginRow
                  key={plugin.name}
                  plugin={plugin}
                  isBusy={busyName === plugin.name}
                  isLast={index === plugins.length - 1}
                  onToggle={() => handleToggleEnabled(plugin)}
                  onUninstall={() => handleUninstall(plugin)}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <InputModal
        visible={installModalVisible}
        title={t('screens.search.installPluginPrompt')}
        message={t('screens.search.installPluginHint')}
        placeholder={t('screens.search.installPluginPlaceholder')}
        onCancel={() => setInstallModalVisible(false)}
        onConfirm={(value) => void handleInstall(value)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────── PluginRow ───────

interface PluginRowProps {
  plugin: SearchPlugin;
  isBusy: boolean;
  isLast: boolean;
  onToggle: () => void;
  onUninstall: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function PluginRow({
  plugin,
  isBusy,
  isLast,
  onToggle,
  onUninstall,
  colors,
}: PluginRowProps) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.row}>
        <View style={styles.rowBody}>
          <Text style={[styles.pluginName, { color: colors.text }]}>
            {plugin.fullName}
          </Text>
          <Text style={[styles.pluginMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            v{plugin.version || '?'} · {plugin.name}
          </Text>
        </View>
        <View style={styles.rowActions}>
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Switch
              value={plugin.enabled}
              onValueChange={onToggle}
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
            />
          )}
          <TouchableOpacity
            onPress={onUninstall}
            disabled={isBusy}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.iconButton, isBusy && { opacity: 0.4 }]}
            activeOpacity={0.6}
            accessibilityLabel={t('common.delete')}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      {!isLast && (
        <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
      )}
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h4,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    borderWidth: 0.5,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconButton: {
    padding: 4,
  },
  pluginName: {
    ...typography.bodySemibold,
  },
  pluginMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  separator: {
    height: 0.5,
    marginLeft: spacing.lg,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
});
