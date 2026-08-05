/**
 * settings/index.tsx — Top-level settings navigation hub.
 *
 * Key exports: SettingsScreen (default)
 * Displays connection status and navigation rows to sub-screens.
 * Sub-screens live alongside this file under app/(tabs)/settings/ so the
 * bottom tab bar stays visible while browsing settings.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useServer } from '@/context/ServerContext';
import { useToast } from '@/context/ToastContext';
import { useTheme, ThemeColors } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { ServerManager } from '@/services/server-manager';
import { APP_VERSION } from '@/utils/version';
import { getErrorMessage } from '@/utils/error';
import { hasFallback } from '@/utils/server';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { colorThemeManager } from '@/services/color-theme-manager';

const APP_STORE_URL = 'https://apps.apple.com/us/app/qremote-for-qbittorrent/id6756276747';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface NavRowProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  isLast?: boolean;
  iconColor?: string;
}

function NavRow({ icon, label, onPress, colors, isLast, iconColor }: NavRowProps) {
  return (
    <>
      <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.navLeft}>
          <Ionicons name={icon} size={22} color={iconColor || colors.primary} />
          <Text style={[styles.navLabel, { color: colors.text }]}>{label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      {!isLast && <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />}
    </>
  );
}

interface ExternalRowProps {
  icon: IconName;
  label?: string;
  onPress: () => void;
  colors: ThemeColors;
  isLast?: boolean;
  trailing?: 'open' | 'stars';
  description?: string;
}

function ExternalRow({
  icon,
  label,
  onPress,
  colors,
  isLast,
  trailing = 'open',
  description,
}: ExternalRowProps) {
  return (
    <>
      <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.navLeft}>
          <Ionicons name={icon} size={22} color={colors.primary} />
          <View style={styles.navTextGroup}>
            {label ? <Text style={[styles.navLabel, { color: colors.text }]}>{label}</Text> : null}
            {description ? (
              <Text style={[styles.navDescription, { color: colors.textSecondary }]}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>
        {trailing === 'stars' ? (
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Ionicons key={i} name="star-outline" size={14} color={colors.primary} />
            ))}
          </View>
        ) : (
          <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
      {!isLast && <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />}
    </>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentServer, isConnected, activeEndpoint, disconnect, connectToServer, isLoading } =
    useServer();
  const { showToast } = useToast();
  const { isDark, colors } = useTheme();
  const [hasServers, setHasServers] = useState(false);
  const disconnectBadgeBackground = colorThemeManager.hexToRgba(
    colorThemeManager.rgbaToHex(colors.error),
    0.18,
  );
  const connectBadgeBackground = colorThemeManager.hexToRgba(
    colorThemeManager.rgbaToHex(colors.success),
    0.18,
  );

  const [pulseAnim] = useState(() => new Animated.Value(1));

  useFocusEffect(
    useCallback(() => {
      ServerManager.getServers()
        .then((servers) => setHasServers(servers.length > 0))
        .catch(() => setHasServers(false));
    }, []),
  );

  useEffect(() => {
    if (isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnected, pulseAnim]);

  const handleDisconnect = async () => {
    // Swallowing a rejection here would leave the row showing "connected" with
    // no explanation. The success path needs no toast -- the connection row
    // updates itself -- but a failure has to surface.
    try {
      await disconnect();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleConnect = async () => {
    if (!currentServer || isLoading) return;
    try {
      const success = await connectToServer(currentServer);
      if (success) {
        showToast(t('toast.connectedTo', { name: currentServer.name }), 'success');
      } else {
        showToast(t('toast.failedToConnect'), 'error');
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleRate = useCallback(() => {
    // This is an explicit "rate us" button, not a soft in-context ask, so it
    // must go straight to the App Store review page. StoreReview.requestReview()
    // is throttled by iOS to ~3 prompts/year and resolves silently with no
    // dialog once that's exhausted -- it would make this button appear to do
    // nothing on repeat taps (#212).
    Linking.openURL(`${APP_STORE_URL}?action=write-review`).catch(() => {});
  }, []);

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Connection Status Card */}
        {hasServers && currentServer ? (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.connection').toUpperCase()}
            </Text>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              onPress={isConnected ? handleDisconnect : handleConnect}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              <View style={styles.connectionRow}>
                <View style={styles.connectionTitleRow}>
                  <Animated.View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: isConnected ? colors.success : colors.error,
                        transform: [{ scale: isConnected ? pulseAnim : 1 }],
                      },
                    ]}
                  />
                  <View style={styles.connectionTextGroup}>
                    <Text style={[styles.connectionTitle, { color: colors.text }]}>
                      {currentServer.name}
                    </Text>
                    <Text style={[styles.connectionSubtitle, { color: colors.textSecondary }]}>
                      {currentServer.host}
                      {currentServer.port != null && currentServer.port > 0
                        ? `:${currentServer.port}`
                        : ''}
                    </Text>
                    {isConnected && hasFallback(currentServer) && activeEndpoint && (
                      <Text style={[styles.connectionSubtitle, { color: colors.textSecondary }]}>
                        {activeEndpoint === 'fallback'
                          ? t('server.connectedViaFallback')
                          : t('server.connectedViaPrimary')}
                      </Text>
                    )}
                  </View>
                </View>
                {isConnected ? (
                  <View
                    style={[
                      styles.actionBadge,
                      {
                        backgroundColor: disconnectBadgeBackground,
                        borderColor: colors.error,
                      },
                    ]}
                  >
                    <Text style={[styles.actionBadgeText, { color: colors.text }]}>
                      {t('screens.settings.disconnect')}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.actionBadge,
                      {
                        backgroundColor: connectBadgeBackground,
                        borderColor: colors.success,
                      },
                    ]}
                  >
                    <Text style={[styles.actionBadgeText, { color: colors.text }]}>
                      {t('screens.settings.connect')}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        ) : !hasServers ? (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.connection').toUpperCase()}
            </Text>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/server/add')}
              activeOpacity={0.7}
            >
              <View style={styles.connectionRow}>
                <View style={styles.connectionTitleRow}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                  <View style={styles.connectionTextGroup}>
                    <Text style={[styles.connectionTitle, { color: colors.text }]}>
                      {t('screens.settings.addServer')}
                    </Text>
                    <Text style={[styles.connectionSubtitle, { color: colors.textSecondary }]}>
                      {t('screens.settings.noServersConfigured')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Navigation Rows */}
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <NavRow
              icon="server-outline"
              label={t('screens.settings.servers')}
              onPress={() => router.push('/settings/servers')}
              colors={colors}
            />
            <NavRow
              icon="color-palette-outline"
              label={t('screens.settings.appearance')}
              onPress={() => router.push('/settings/appearance')}
              colors={colors}
            />
            <NavRow
              icon="options-outline"
              label={t('screens.settings.serverSettings')}
              onPress={() => router.push('/settings/torrent-defaults')}
              colors={colors}
            />
            <NavRow
              icon="logo-rss"
              label={t('screens.settings.rss')}
              onPress={() => router.push('/settings/rss')}
              colors={colors}
            />
            <NavRow
              icon="extension-puzzle-outline"
              label={t('screens.search.pluginsTitle')}
              onPress={() => router.push('/search/plugins')}
              colors={colors}
            />
            <NavRow
              icon="construct-outline"
              label={t('screens.settings.advanced')}
              onPress={() => router.push('/settings/advanced')}
              colors={colors}
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <NavRow
              icon="sparkles-outline"
              label={t('screens.settings.whatsNew')}
              onPress={() => router.push('/settings/whats-new')}
              colors={colors}
            />
            <NavRow
              icon="information-circle-outline"
              label={t('screens.settings.about')}
              onPress={() => router.push('/settings/about')}
              colors={colors}
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            {t('screens.settings.community').toUpperCase()}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <ExternalRow
              icon="logo-github"
              label={t('screens.settings.sourceCode')}
              onPress={() => Linking.openURL('https://github.com/taylorcox75/qremote')}
              colors={colors}
            />
            <ExternalRow
              icon="bug-outline"
              label={t('screens.settings.reportIssue')}
              onPress={() => Linking.openURL('https://github.com/taylorcox75/qRemote/issues')}
              colors={colors}
            />
            <ExternalRow
              icon="beer-outline"
              label={t('screens.settings.buyMeBeer')}
              onPress={() =>
                Linking.openURL(
                  'https://www.paypal.com/donate/?business=E9XLGFHN963HN&no_recurring=0&currency_code=USD',
                )
              }
              colors={colors}
            />
            <ExternalRow
              description={t('screens.settings.rateAppHint')}
              onPress={handleRate}
              colors={colors}
              trailing="stars"
              icon="thumbs-up-outline"
              isLast
            />
          </View>
        </View>

        {/* App Version */}
        <Text style={[styles.versionText, { color: colors.textSecondary }]}>
          qRemote v{APP_VERSION}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
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
    gap: spacing.md,
  },
  connectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  connectionTextGroup: {
    flex: 1,
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
  },
  actionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.small,
    borderWidth: 1,
  },
  actionBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: spacing.md,
  },
  navTextGroup: {
    flex: 1,
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  navDescription: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  separator: {
    height: 1,
    marginLeft: 50,
  },
  versionText: {
    textAlign: 'center',
    marginTop: spacing.xxl,
    ...typography.caption,
  },
});
