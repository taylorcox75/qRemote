import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

/**
 * Stack under the Torrents tab so list → detail → files/trackers
 * keeps the bottom tab bar visible (same pattern as settings/).
 */
export default function TorrentsLayout() {
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
