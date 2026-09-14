import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useShell } from '@/context/ShellContext';
import { SettingsSidebar } from '@/components/shell/SettingsSidebar';
import { hexToRgba } from '@/utils/color';

export default function SettingsLayout() {
  const { colors } = useTheme();
  const { idiom } = useShell();

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );

  if (idiom === 'compact') {
    return stack;
  }

  return (
    <View style={[styles.row, { backgroundColor: colors.background }]}>
      <SettingsSidebar />
      <View
        style={[
          styles.detail,
          { borderLeftColor: hexToRgba(colors.text, 0.08), backgroundColor: colors.background },
        ]}
      >
        {stack}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  detail: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
});
