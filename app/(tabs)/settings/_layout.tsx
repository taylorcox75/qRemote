import { Stack } from 'expo-router';
import { useGlassStackContentStyle } from '@/context/LiquidGlassContext';

export default function SettingsLayout() {
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
