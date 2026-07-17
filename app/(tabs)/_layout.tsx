import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
      edges={['top']}
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
          name="index"
          options={{
            title: 'Torrents',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="transfer"
          options={{
            title: 'Transfer',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'speedometer' : 'speedometer-outline'} size={24} color={color} />
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
          name="settings"
          options={{
            title: 'Settings',
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
    </SafeAreaView>
  );
}

