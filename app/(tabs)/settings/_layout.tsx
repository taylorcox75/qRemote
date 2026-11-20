import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useGlassStackContentStyle } from '@/context/LiquidGlassContext';
import { PaneLayout, SettingsSplitContext } from '@/context/PaneLayoutContext';
import { useTheme } from '@/context/ThemeContext';
import { useTabBarSide } from '@/hooks/useReadableLayout';
import { SPLIT_LIST_WIDTH, SPLIT_VIEW_MIN_WIDTH } from '@/constants/spacing';
import { SettingsHub } from './index';

/** The Stack, reading its insets from inside its pane. */
function SettingsStack() {
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

/**
 * Settings tab. On wide windows (iPhone Duo unfolded, iPad) the menu stays in
 * a left column and the chosen section opens on the right, like iPad
 * Settings; narrow windows push as before. The Stack keeps its place in the
 * tree either way, so folding/unfolding never loses its history.
 */
export default function SettingsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const tabBarSide = useTabBarSide();
  const { colors } = useTheme();

  const split = width - insets.left - insets.right >= SPLIT_VIEW_MIN_WIDTH;
  const listWidth = SPLIT_LIST_WIDTH + insets.left;

  const menuPane = useMemo(
    () => (split ? { width: listWidth, insets: { ...insets, right: 0 }, tabBarSide } : null),
    [split, listWidth, insets, tabBarSide],
  );
  const contentPane = useMemo(
    () => (split ? { width: width - listWidth, insets: { ...insets, left: 0 }, tabBarSide } : null),
    [split, width, listWidth, insets, tabBarSide],
  );
  const splitValue = useMemo(() => ({ active: split, pathname }), [split, pathname]);

  return (
    <SettingsSplitContext.Provider value={splitValue}>
      <View style={[styles.row, { backgroundColor: colors.background }]}>
        {split && menuPane && (
          <Animated.View
            entering={FadeInRight.springify().damping(18).stiffness(140)}
            style={[styles.menu, { width: listWidth, borderRightColor: colors.surfaceOutline }]}
          >
            <PaneLayout pane={menuPane}>
              <SettingsHub />
            </PaneLayout>
          </Animated.View>
        )}
        <View style={styles.fill}>
          <PaneLayout pane={contentPane}>
            <SettingsStack />
          </PaneLayout>
        </View>
      </View>
    </SettingsSplitContext.Provider>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  fill: { flex: 1 },
  menu: { borderRightWidth: StyleSheet.hairlineWidth },
});

// A render error in this tab shows a retry screen inside the tab instead of
// taking down the whole app (tabs mount eagerly under native tabs — #334).
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
