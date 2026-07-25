/**
 * rules.tsx — RSS auto-download rule list.
 *
 * Lists qBittorrent RSS rules (useRssRules), with per-row enable toggle,
 * and a long-press ActionMenu for rename / view-matching-articles / delete.
 * Add/edit itself lives in rule.tsx (this screen only navigates there).
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
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { EmptyState } from '@/components/EmptyState';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';
import { InputModal } from '@/components/InputModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useServer } from '@/context/ServerContext';
import { useRssRules } from '@/hooks/useRssRules';
import { rssApi } from '@/services/api/rss';
import { RssRule } from '@/types/api';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { getErrorMessage } from '@/utils/error';
import { haptics } from '@/utils/haptics';

export default function RssRulesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const { isConnected } = useServer();
  const { ruleList, isLoading, refresh, setRule, renameRule, removeRule } = useRssRules();

  const [refreshing, setRefreshing] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);

  // Long-press action menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeRuleName, setActiveRuleName] = useState<string | null>(null);

  // Rename
  const [renameVisible, setRenameVisible] = useState(false);

  // Delete
  const [deleteVisible, setDeleteVisible] = useState(false);

  // Matching articles preview
  const [articlesVisible, setArticlesVisible] = useState(false);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesMessage, setArticlesMessage] = useState('');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleToggleEnabled = useCallback(
    async (name: string, rule: RssRule) => {
      setBusyName(name);
      try {
        await setRule(name, { ...rule, enabled: !rule.enabled });
        haptics.light();
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      } finally {
        setBusyName(null);
      }
    },
    [setRule, showToast],
  );

  const openMenu = useCallback((name: string) => {
    setActiveRuleName(name);
    setMenuVisible(true);
  }, []);

  const handleRename = useCallback(
    async (newName: string) => {
      const oldName = activeRuleName;
      setRenameVisible(false);
      if (!oldName) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return;
      try {
        await renameRule(oldName, trimmed);
        haptics.success();
        showToast(t('screens.rss.ruleRenamedToast'), 'success');
      } catch (err: unknown) {
        haptics.error();
        showToast(getErrorMessage(err), 'error');
      }
    },
    [activeRuleName, renameRule, showToast, t],
  );

  const handleViewMatchingArticles = useCallback(
    async (name: string) => {
      setArticlesVisible(true);
      setArticlesLoading(true);
      setArticlesMessage('');
      try {
        const result = await rssApi.getMatchingArticles(name);
        const titles = Object.values(result).flat();
        setArticlesMessage(
          titles.length > 0 ? titles.join('\n') : t('screens.rss.noMatchingArticles'),
        );
      } catch (err: unknown) {
        setArticlesMessage(getErrorMessage(err));
      } finally {
        setArticlesLoading(false);
      }
    },
    [t],
  );

  const handleDelete = useCallback(async () => {
    const name = activeRuleName;
    setDeleteVisible(false);
    if (!name) return;
    try {
      await removeRule(name);
      haptics.success();
      showToast(t('screens.rss.ruleDeletedToast'), 'success');
    } catch (err: unknown) {
      haptics.error();
      showToast(getErrorMessage(err), 'error');
    }
  }, [activeRuleName, removeRule, showToast, t]);

  const menuItems: ActionMenuItemDef[] = activeRuleName
    ? [
        {
          label: t('screens.rss.rename'),
          icon: 'text-outline',
          onPress: () => setRenameVisible(true),
        },
        {
          label: t('screens.rss.viewMatchingArticles'),
          icon: 'list-outline',
          onPress: () => void handleViewMatchingArticles(activeRuleName),
        },
        {
          label: t('common.delete'),
          icon: 'trash-outline',
          onPress: () => setDeleteVisible(true),
          destructive: true,
        },
      ]
    : [];

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={[]}
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('screens.rss.rulesTitle')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/rss/rule')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>{t('screens.rss.addRule')}</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !isConnected ? (
            <EmptyState subtitle={t('toast.notConnected')} />
          ) : ruleList.length === 0 ? (
            <EmptyState
              icon="funnel-outline"
              title={t('screens.rss.noRulesTitle')}
              subtitle={t('screens.rss.noRulesSubtitle')}
            />
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {ruleList.map(({ name, rule }, index) => (
                <RuleRow
                  key={name}
                  name={name}
                  rule={rule}
                  isBusy={busyName === name}
                  isLast={index === ruleList.length - 1}
                  onToggle={() => handleToggleEnabled(name, rule)}
                  onPress={() => router.push({ pathname: '/rss/rule', params: { name } })}
                  onLongPress={() => openMenu(name)}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <ActionMenu visible={menuVisible} onClose={() => setMenuVisible(false)} items={menuItems} />

      <InputModal
        visible={renameVisible}
        title={t('screens.rss.renamePrompt')}
        message={t('screens.rss.renameHint')}
        defaultValue={activeRuleName ?? ''}
        onCancel={() => setRenameVisible(false)}
        onConfirm={(value) => void handleRename(value)}
      />

      <ConfirmModal
        visible={deleteVisible}
        title={t('alerts.deleteRule')}
        message={t('alerts.deleteRuleMessage')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setDeleteVisible(false)}
        buttons={[
          {
            label: t('common.delete'),
            destructive: true,
            onPress: () => void handleDelete(),
          },
        ]}
      />

      <ConfirmModal
        visible={articlesVisible}
        title={t('screens.rss.matchingArticlesTitle')}
        message={articlesLoading ? t('common.loading') : articlesMessage}
        cancelLabel={t('common.close')}
        onCancel={() => setArticlesVisible(false)}
        buttons={[]}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────── RuleRow ───────

interface RuleRowProps {
  name: string;
  rule: RssRule;
  isBusy: boolean;
  isLast: boolean;
  onToggle: () => void;
  onPress: () => void;
  onLongPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function RuleRow({
  name,
  rule,
  isBusy,
  isLast,
  onToggle,
  onPress,
  onLongPress,
  colors,
}: RuleRowProps) {
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        <View style={styles.rowBody}>
          <Text style={[styles.ruleName, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          {!!rule.mustContain && (
            <Text style={[styles.ruleMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {rule.mustContain}
            </Text>
          )}
        </View>
        <View style={styles.rowActions}>
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Switch
              value={rule.enabled}
              onValueChange={onToggle}
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
            />
          )}
        </View>
      </TouchableOpacity>
      {!isLast && <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />}
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
  ruleName: {
    ...typography.bodySemibold,
  },
  ruleMeta: {
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
