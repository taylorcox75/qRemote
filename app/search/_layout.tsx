import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function SearchLayout() {
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
