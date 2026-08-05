import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { applicationApi } from '@/services/api/application';
import { APP_VERSION } from '@/utils/version';
import { ApplicationVersion, BuildInfo } from '@/types/api';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: IconName;
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { isConnected } = useServer();

  const [appVersion, setAppVersion] = useState<ApplicationVersion | null>(null);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [loadingAppInfo, setLoadingAppInfo] = useState(false);

  const loadAppInfo = async () => {
    try {
      setLoadingAppInfo(true);
      const [version, build] = await Promise.all([
        applicationApi.getVersion(),
        applicationApi.getBuildInfo(),
      ]);
      setAppVersion(version);
      setBuildInfo(build);
    } catch {
      // Ignore app info loading errors
    } finally {
      setLoadingAppInfo(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isConnected) {
        loadAppInfo();
      }
    }, [isConnected]),
  );

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
            {t('screens.settings.about')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* App Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.appInfo').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <InfoRow
                icon="information-circle-outline"
                label={t('screens.settings.appVersion')}
                value={APP_VERSION}
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <InfoRow
                icon="logo-react"
                label="React Native"
                value={
                  Platform.constants.reactNativeVersion
                    ? `${Platform.constants.reactNativeVersion.major}.${Platform.constants.reactNativeVersion.minor}.${Platform.constants.reactNativeVersion.patch}`
                    : 'N/A'
                }
                colors={colors}
              />
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <InfoRow
                icon="phone-portrait-outline"
                label={t('screens.settings.platform')}
                value={Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)}
                colors={colors}
              />
            </View>
          </View>

          {/* qBittorrent Server Info */}
          {isConnected && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t('screens.settings.qbittorrentServer').toUpperCase()}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {loadingAppInfo ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : (
                  <>
                    {appVersion && (
                      <>
                        <InfoRow
                          icon="information-circle-outline"
                          label="qBittorrent"
                          value={appVersion.version}
                          colors={colors}
                        />
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
                        <InfoRow
                          icon="code-slash-outline"
                          label="API Version"
                          value={appVersion.apiVersion}
                          colors={colors}
                        />
                      </>
                    )}
                    {buildInfo && (
                      <>
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
                        <InfoRow
                          icon="cube-outline"
                          label="Libtorrent"
                          value={buildInfo.libtorrent}
                          colors={colors}
                        />
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
                        <InfoRow
                          icon="hardware-chip-outline"
                          label="Architecture"
                          value={`${buildInfo.bitness}-bit`}
                          colors={colors}
                        />
                      </>
                    )}
                  </>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoLabel: { ...typography.secondary },
  infoValue: { ...typography.secondaryMedium },
  loadingState: { paddingVertical: spacing.xxl, alignItems: 'center' },
});
