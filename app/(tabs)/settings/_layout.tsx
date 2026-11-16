import { Stack } from 'expo-router';
import { useGlassStackContentStyle } from '@/context/LiquidGlassContext';

export default function SettingsLayout() {
  const contentStyle = useGlassStackContentStyle(true);
  // The list screen runs under the floating glass tab bar and insets its own
  // content; pushed screens keep the band above the bar.
  const indexContentStyle = useGlassStackContentStyle(false);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        contentStyle,
      }}
    >
      <Stack.Screen name="index" options={{ contentStyle: indexContentStyle }} />
    </Stack>
  );
}
