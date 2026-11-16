import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { applicationApi } from '@/services/api/application';
import { useLiquidGlass } from '@/context/LiquidGlassContext';
import { resolveRssTabVisible } from '@/utils/rss-tab';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected, isConnecting, isReconnecting, connectedAt } = useServer();
  const [nativeRssTab, setNativeRssTab] = useState(false);
  const preferencesQuery = useQuery({
    queryKey: ['application', 'preferences'],
    queryFn: () => applicationApi.getPreferences(),
    enabled: isConnected,
    staleTime: 30_000,
  });
  const showRssTab = isConnected && preferencesQuery.data?.rss_processing_enabled === true;
  // Glass tab bar only: the same gating, held steady through transient states
  // (see utils/rss-tab.ts) — toggling a native tab remounts every tab. A
  // preferences result fetched before this connection began belongs to the
  // previous connection (maybe another server), so it counts as unknown.
  const rssKnownForThisConnection =
    preferencesQuery.data !== undefined &&
    connectedAt !== null &&
    preferencesQuery.dataUpdatedAt >= connectedAt.getTime();
  const nextNativeRssTab = resolveRssTabVisible(nativeRssTab, {
    isConnected,
    isTransitioning: isConnecting || isReconnecting,
    rssEnabled: rssKnownForThisConnection
      ? preferencesQuery.data?.rss_processing_enabled === true
      : undefined,
  });
  if (nextNativeRssTab !== nativeRssTab) {
    // Render-time state adjustment (React's "storing information from previous
    // renders" pattern), so the held value never lags a render behind.
    setNativeRssTab(nextNativeRssTab);
  }
  // Liquid Glass: the system glass tab bar (expo-router NativeTabs). Latched at
  // launch — see LiquidGlassContext — because swapping navigators remounts every
  // tab. Where glass is unavailable or turned off, the JS tab bar below is used
  // exactly as before.
  const { tabBarGlass, tabBarInset, loaded: glassPrefLoaded } = useLiquidGlass();

  // Where glass is available, wait the few ms it takes to read the setting so
  // launch never mounts the JS tab bar and then swaps navigators. (Always
  // loaded where glass is unavailable — no wait there.)
  if (!glassPrefLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (tabBarGlass) {
    // Every tab scene paints the theme background from its first frame, so a
    // tab switch never flashes the native container's default (white). Scenes
    // run to the bottom of the screen, under the floating glass bar. Screens
    // whose content scrolls under it (Torrents and Settings lists) pad their
    // own content; every other screen keeps a band above the bar so nothing
    // sits beneath it: the stacks via useGlassStackContentStyle, the flat tabs
    // (Transfer, Search) via the scene padding below. The status-bar inset (the
    // JS layout wrapper's paddingTop) goes inside the screen view so a glass
    // header can run up under the status bar: here for the tabs without a
    // Stack, and per stack screen for the others (a native stack clips its
    // screens, so padding the scene would cut the glass off).
    //
    // `disableAutomaticContentInsets`: react-native-screens would otherwise
    // switch whichever scroll view happens to be first in a tab's view tree to
    // automatic inset adjustment, adding the tab bar inset a second time on
    // some screens and not others.
    const stackSceneStyle = { backgroundColor: colors.background };
    const flatSceneStyle = {
      ...stackSceneStyle,
      paddingTop: insets.top,
      paddingBottom: tabBarInset,
    };
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <NativeTabs tintColor={colors.primary} minimizeBehavior="never">
          <NativeTabs.Trigger
            name="(torrents)"
            contentStyle={stackSceneStyle}
            disableScrollToTop
            disableAutomaticContentInsets
          >
            <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet', selected: 'list.bullet' }} />
            <NativeTabs.Trigger.Label>{t('screens.torrents.tabTitle')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="transfer"
            contentStyle={flatSceneStyle}
            disableScrollToTop
            disableAutomaticContentInsets
          >
            <NativeTabs.Trigger.Icon sf="speedometer" />
            <NativeTabs.Trigger.Label>{t('screens.transfer.title')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="search"
            contentStyle={flatSceneStyle}
            disableScrollToTop
            disableAutomaticContentInsets
          >
            <NativeTabs.Trigger.Icon sf="magnifyingglass" />
            <NativeTabs.Trigger.Label>{t('screens.search.tabTitle')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          {/* Same gating as the JS tab bar (connected AND rss_processing_enabled),
              held through transient states (nativeRssTab above). Toggling
              `hidden` changes expo-router's tabConfigurationKey, which is the
              native tab view's key, so every tab's screens remount (navigation
              state survives). Accepted because it only happens on a real change
              — connect, server switch, manual disconnect, RSS toggled — which
              already ends the session's search jobs and clears selection; the
              installed NativeTabs / react-native-screens have no way to hide a
              tab without re-keying. */}
          <NativeTabs.Trigger
            name="rss"
            hidden={!nativeRssTab}
            contentStyle={stackSceneStyle}
            disableScrollToTop
            disableAutomaticContentInsets
          >
            <NativeTabs.Trigger.Icon sf="dot.radiowaves.up.forward" />
            <NativeTabs.Trigger.Label>{t('screens.rss.feedsTitle')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="settings"
            contentStyle={stackSceneStyle}
            disableScrollToTop
            disableAutomaticContentInsets
          >
            <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
            <NativeTabs.Trigger.Label>{t('screens.settings.title')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </View>
    );
  }

  // Use paddingTop from insets instead of wrapping Tabs in SafeAreaView.
  // SafeAreaView around the tab navigator can break after dismissing a root
  // stack modal (e.g. Add/Edit Server), pushing the tab bar off-screen so
  // main tabs look like full-screen settings pages.
  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        backgroundColor: colors.background,
      }}
    >
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 0.18,
            borderTopColor: colors.surfaceOutline,
          },
        }}
      >
        <Tabs.Screen
          name="(torrents)"
          options={{
            title: t('screens.torrents.tabTitle'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'list' : 'list-outline'}
                size={24}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="transfer"
          options={{
            title: t('screens.transfer.title'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'speedometer' : 'speedometer-outline'}
                size={24}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: t('screens.search.tabTitle'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'search' : 'search-outline'}
                size={24}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="rss"
          options={{
            title: t('screens.rss.feedsTitle'),
            href: showRssTab ? undefined : null,
            tabBarIcon: ({ color }) => (
              <Ionicons name="logo-rss" size={24} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('screens.settings.title'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                size={24}
                color={color as string}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
