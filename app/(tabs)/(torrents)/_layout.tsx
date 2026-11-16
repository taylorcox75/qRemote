import { Stack } from 'expo-router';
import { useGlassStackContentStyle } from '@/context/LiquidGlassContext';

/**
 * Stack under the Torrents tab so list → detail → files/trackers
 * keeps the bottom tab bar visible (same pattern as settings/).
 */
export default function TorrentsLayout() {
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
