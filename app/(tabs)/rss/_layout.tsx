import { Stack } from 'expo-router';
import { useGlassStackContentStyle } from '@/context/LiquidGlassContext';

/**
 * Stack under the RSS tab so feed list -> articles/rules/rule editor
 * keeps the bottom tab bar visible (same pattern as (torrents)/).
 */
export default function RssLayout() {
  const contentStyle = useGlassStackContentStyle();

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

// A render error in this tab shows a retry screen inside the tab instead of
// taking down the whole app (tabs mount eagerly under native tabs — #334).
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
