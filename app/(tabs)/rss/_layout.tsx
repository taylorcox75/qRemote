import { Stack } from 'expo-router';
import { useGlassStackContentStyle } from '@/context/LiquidGlassContext';

/**
 * Stack under the RSS tab so feed list -> articles/rules/rule editor
 * keeps the bottom tab bar visible (same pattern as (torrents)/).
 */
export default function RssLayout() {
  const contentStyle = useGlassStackContentStyle(true);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        contentStyle,
      }}
    />
  );
}
