/**
 * useGlassTabScreenLayout — lets a tab screen's content scroll under the iOS 26
 * floating glass chrome, the way system apps do (HIG: content peeks through
 * under bars; glass stays on the functional layer).
 *
 * Only while the system glass tab bar is in use (`tabBarGlass`): the tab scene
 * then runs to the bottom of the screen, under the floating tab bar, and a
 * screen's header (or whole top chrome) floats over its scroll content. The
 * scroll content is padded by the header height and the tab bar inset so the
 * first and last rows can scroll fully clear of the glass.
 *
 * With the JS tab bar (no glass, iOS < 26, glass turned off, old binary)
 * everything here is inert: the header stays in the flow, no padding is added,
 * and screens render exactly as before.
 *
 * While glass materials are off for the session (Reduce Transparency, Increase
 * Contrast, or the setting switched off before the restart that drops the
 * glass tab bar) a floating header gets the theme background, so it still
 * reads as today's solid header.
 *
 * Key exports: useGlassTabScreenLayout, GlassTabScreenLayout
 */
import { useCallback, useState } from 'react';
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useLiquidGlass } from '@/context/LiquidGlassContext';
import { useTheme } from '@/context/ThemeContext';
import { addContentPadding } from '@/utils/glass-layout';

/**
 * First-frame guess at a floating header's height, before it is measured: the
 * standard 40pt-button header with vertical padding and a 1pt border. Replaced
 * by the last measured height, so later screens start at the real value.
 */
let lastHeaderHeight = 57;

export interface GlassTabScreenLayout {
  /** The header floats over the content (glass tab bar in use). */
  floating: boolean;
  /** Merge into the header (top chrome) view's style. */
  headerStyle: StyleProp<ViewStyle>;
  /** Put on the header (top chrome) view: measures it while floating. */
  onHeaderLayout: ((e: LayoutChangeEvent) => void) | undefined;
  /** Space the floating header covers at the top (0 when not floating). */
  topInset: number;
  /** Space the glass tab bar covers at the bottom (0 without it). */
  bottomInset: number;
  /** A scroll view's content style with the glass insets added to its padding. */
  contentStyle: (base?: StyleProp<ViewStyle>) => StyleProp<ViewStyle>;
  /** For a scroll view's `scrollIndicatorInsets` (undefined when inert). */
  scrollIndicatorInsets: { top: number; bottom: number } | undefined;
  /** Padding for a non-scrolling body (loading / empty state) under the same chrome. */
  bodyStyle: StyleProp<ViewStyle>;
}

export function useGlassTabScreenLayout(
  options: { floatingHeader?: boolean } = {},
): GlassTabScreenLayout {
  const { floatingHeader = true } = options;
  const { tabBarGlass, enabled, tabBarInset } = useLiquidGlass();
  const { colors } = useTheme();
  const [headerHeight, setHeaderHeight] = useState(lastHeaderHeight);
  const floating = tabBarGlass && floatingHeader;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const height = Math.round(e.nativeEvent.layout.height);
    if (height <= 0) return;
    lastHeaderHeight = height;
    setHeaderHeight(height);
  }, []);

  const topInset = floating ? headerHeight : 0;
  const bottomInset = tabBarInset;

  const contentStyle = useCallback(
    (base?: StyleProp<ViewStyle>) => addContentPadding(base, topInset, bottomInset),
    [topInset, bottomInset],
  );

  const inert = topInset === 0 && bottomInset === 0;

  return {
    floating,
    headerStyle: floating
      ? [styles.floatingHeader, !enabled && { backgroundColor: colors.background }]
      : undefined,
    onHeaderLayout: floating ? onLayout : undefined,
    topInset,
    bottomInset,
    contentStyle,
    scrollIndicatorInsets: inert ? undefined : { top: topInset, bottom: bottomInset },
    bodyStyle: inert ? undefined : { paddingTop: topInset, paddingBottom: bottomInset },
  };
}

const styles = StyleSheet.create({
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
