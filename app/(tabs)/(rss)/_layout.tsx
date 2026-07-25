import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

/**
 * Stack under the RSS tab so feed list -> articles/rules/rule editor
 * keeps the bottom tab bar visible (same pattern as (torrents)/).
 */
export default function RssLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
