/**
 * settings.tsx — Top-level settings navigation hub.
 *
 * Key exports: SettingsScreen (default)
 * Displays connection status and navigation rows to sub-screens.
 * Sub-screens live in app/settings/*.tsx.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useServer } from '@/context/ServerContext';
import { useTheme, ThemeColors } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { APP_VERSION } from '@/utils/version';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { colorThemeManager } from '@/services/color-theme-manager';

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

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentServer, isConnected, disconnect } = useServer();
  const { isDark, colors } = useTheme();
  const disconnectBadgeBackground = colorThemeManager.hexToRgba(
    colorThemeManager.rgbaToHex(colors.error),
    0.18
  );

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnected]);

  const handleDisconnect = async () => {
    await disconnect();
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Connection Status Card */}
        {currentServer && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.connection').toUpperCase()}
            </Text>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              onPress={isConnected ? handleDisconnect : undefined}
              activeOpacity={isConnected ? 0.7 : 1}
            >
              <View style={styles.connectionRow}>
                <View style={styles.connectionInfo}>
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
                    <Text style={[styles.connectionTitle, { color: colors.text }]}>{currentServer.name}</Text>
                  </View>
                  <Text style={[styles.connectionSubtitle, { color: colors.textSecondary }]}>
                    {currentServer.host}
                    {currentServer.port != null && currentServer.port > 0 ? `:${currentServer.port}` : ''}
                  </Text>
                </View>
                {isConnected && (
                  <View
                    style={[
                      styles.disconnectBadge,
                      {
                        backgroundColor: disconnectBadgeBackground,
                        borderColor: colors.error,
                      },
                    ]}
                  >
                    <Text style={[styles.disconnectText, { color: colors.text }]}>
                      {t('screens.settings.disconnect')}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

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
              label={t('screens.settings.torrentList')}
              onPress={() => router.push('/settings/torrent-defaults')}
              colors={colors}
            />
            <NavRow
              icon="notifications-outline"
              label={t('screens.settings.notificationsFeedback')}
              onPress={() => router.push('/settings/notifications')}
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
    marginLeft: 20,
  },
  disconnectBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.small,
    borderWidth: 1,
  },
  disconnectText: {
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
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '500',
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
