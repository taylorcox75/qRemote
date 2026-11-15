import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useGlassStackTopInset } from '@/context/LiquidGlassContext';

export default function SettingsLayout() {
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
