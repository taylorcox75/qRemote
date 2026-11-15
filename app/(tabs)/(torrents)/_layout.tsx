import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useGlassStackTopInset } from '@/context/LiquidGlassContext';

/**
 * Stack under the Torrents tab so list → detail → files/trackers
 * keeps the bottom tab bar visible (same pattern as settings/).
 */
export default function TorrentsLayout() {
  const { colors } = useTheme();
  const glassTopInset = useGlassStackTopInset();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        contentStyle:
          glassTopInset === undefined
            ? { backgroundColor: colors.background }
            : { backgroundColor: colors.background, paddingTop: glassTopInset },
      }}
    />
  );
}
