import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { applicationApi } from '@/services/api/application';
import { useShell } from '@/context/ShellContext';
import { SplitLayout } from '@/components/shell/SplitLayout';
import { Sidebar } from '@/components/shell/Sidebar';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected } = useServer();
  const { idiom, sidebarCollapsed } = useShell();
  // True iPhones are never anything but 'compact' (see useLayoutIdiom), so
  // they always take the bare-tabs branch below and this stays a no-op for
  // them. iPad and Mac Catalyst are the only device classes whose idiom can
  // change at runtime (Split View / Stage Manager resize, or just 'mac'
  // being constant), so they always mount through SplitLayout -- including
  // while idiom is momentarily 'compact' on a narrow iPad Split View pane --
  // so <Tabs> keeps the same ancestor chain across every idiom change and is
  // never torn down and remounted by a live resize.
  const isShellHost =
    Platform.OS === 'ios' && (Platform.isPad || (Platform.isMacCatalyst ?? false));
  const preferencesQuery = useQuery({
    queryKey: ['application', 'preferences'],
    queryFn: () => applicationApi.getPreferences(),
    enabled: isConnected,
    staleTime: 30_000,
  });
  const showRssTab = isConnected && preferencesQuery.data?.rss_processing_enabled === true;

  // On a true iPhone (isShellHost false, idiom always 'compact') this tree
  // stays exactly as it always has been: no sidebar, no split layout, the
  // tab bar visible. Everything below this line is unconditional for that
  // path - the hidden tab bar only ever applies on 'regular'/'mac' idiom.
  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle:
          idiom === 'compact'
            ? {
                backgroundColor: colors.surface,
                borderTopWidth: 0.18,
                borderTopColor: colors.surfaceOutline,
              }
            : { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="(torrents)"
        options={{
          title: t('screens.torrents.tabTitle'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={color} />
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
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('screens.search.tabTitle'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rss"
        options={{
          title: t('screens.rss.feedsTitle'),
          href: showRssTab ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="logo-rss" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('screens.settings.title'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );

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
      {isShellHost ? (
        <SplitLayout
          sidebar={<Sidebar />}
          sidebarCollapsed={sidebarCollapsed || idiom === 'compact'}
        >
          {tabs}
        </SplitLayout>
      ) : (
        tabs
      )}
    </View>
  );
}
