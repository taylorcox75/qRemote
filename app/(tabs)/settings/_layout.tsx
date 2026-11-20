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

// A render error in this tab shows a retry screen inside the tab instead of
// taking down the whole app (tabs mount eagerly under native tabs — #334).
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
