/**
 * SettingsSidebar.tsx - source list for the regular/iPad and mac settings
 * split, matching Pogona's Mac preferences categories (compact 13pt rows,
 * muted capsule selection). Compact (iPhone) never mounts this.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePathname, useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useShell } from '@/context/ShellContext';
import { desktopMetrics } from '@/constants/desktop';
import { hexToRgba } from '@/utils/color';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Dest {
  key: string;
  labelKey: string;
  icon: IoniconName;
  route: string;
}

const PRIMARY: Dest[] = [
  {
    key: 'general',
    labelKey: 'screens.settings.connection',
    icon: 'pulse-outline',
    route: '/settings',
  },
  {
    key: 'servers',
    labelKey: 'screens.settings.servers',
    icon: 'server-outline',
    route: '/settings/servers',
  },
  {
    key: 'appearance',
    labelKey: 'screens.settings.appearance',
    icon: 'color-palette-outline',
    route: '/settings/appearance',
  },
  {
    key: 'server-settings',
    labelKey: 'screens.settings.serverSettings',
    icon: 'options-outline',
    route: '/settings/torrent-defaults',
  },
  {
    key: 'connection',
    labelKey: 'screens.settings.connectionSettings',
    icon: 'git-network-outline',
    route: '/settings/connection',
  },
  { key: 'rss', labelKey: 'screens.settings.rss', icon: 'logo-rss', route: '/settings/rss' },
  {
    key: 'plugins',
    labelKey: 'screens.search.pluginsTitle',
    icon: 'extension-puzzle-outline',
    route: '/search/plugins',
  },
  {
    key: 'integrations',
    labelKey: 'screens.settings.integrations',
    icon: 'film-outline',
    route: '/settings/integrations',
  },
  {
    key: 'advanced',
    labelKey: 'screens.settings.advanced',
    icon: 'construct-outline',
    route: '/settings/advanced',
  },
];

const SECONDARY: Dest[] = [
  {
    key: 'whats-new',
    labelKey: 'screens.settings.whatsNew',
    icon: 'sparkles-outline',
    route: '/settings/whats-new',
  },
  {
    key: 'about',
    labelKey: 'screens.settings.about',
    icon: 'information-circle-outline',
    route: '/settings/about',
  },
];

function isActive(pathname: string, dest: Dest): boolean {
  if (dest.route === '/settings') {
    return pathname === '/settings' || pathname === '/settings/';
  }
  return pathname === dest.route || pathname.startsWith(`${dest.route}/`);
}

function Row({ dest }: { dest: Dest }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { idiom } = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const metrics = desktopMetrics(idiom);
  const active = isActive(pathname, dest);

  return (
    <Pressable
      onPress={() => router.navigate(dest.route)}
      style={[
        styles.row,
        {
          height: metrics.sidebarRowHeight,
          borderRadius: metrics.selectionRadius,
          backgroundColor: active ? hexToRgba(colors.text, 0.1) : 'transparent',
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Ionicons
        name={dest.icon}
        size={metrics.sidebarIconSize}
        color={colors.textSecondary}
        style={styles.icon}
      />
      <Text
        style={[styles.label, { fontSize: metrics.sidebarFontSize, color: colors.text }]}
        numberOfLines={1}
      >
        {t(dest.labelKey)}
      </Text>
    </Pressable>
  );
}

export function SettingsSidebar() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { idiom } = useShell();
  const metrics = desktopMetrics(idiom);

  return (
    <View
      style={[styles.container, { width: metrics.sidebarWidth, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.title, { color: colors.text, fontSize: idiom === 'mac' ? 13 : 17 }]}>
        {t('screens.settings.title')}
      </Text>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {PRIMARY.map((dest) => (
          <Row key={dest.key} dest={dest} />
        ))}
        <View style={[styles.divider, { backgroundColor: hexToRgba(colors.text, 0.08) }]} />
        {SECONDARY.map((dest) => (
          <Row key={dest.key} dest={dest} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
  },
  title: {
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  scroll: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 1,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    flex: 1,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    marginHorizontal: 8,
  },
});
