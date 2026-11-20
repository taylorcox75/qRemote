/**
 * useReadableLayout — horizontal layout for wide and resizable windows (the
 * iPhone Duo's inner screen, iPad): side safe-area insets and a capped,
 * centered content column. Everything is derived from the live insets and
 * `useWindowDimensions`, so folding / unfolding re-lays the screen out, and a
 * regular iPhone in portrait (no side insets, narrower than READABLE_MAX_WIDTH)
 * gets exactly the styles it had before.
 *
 * Screens inside a tab Stack (Torrents, RSS, Settings) are already padded by
 * the side insets through the Stack's `contentStyle` (useGlassStackContentStyle);
 * the flat tabs (Search, Transfer) put `safeAreaStyle` on their root view.
 * Either way `contentStyle(base)` then centers scroll content in the readable
 * column, and `contentWidth` is the width that column ends up.
 *
 * useTabBarInset is the bottom space the glass tab bar covers on a tab screen:
 * LiquidGlassContext's `tabBarInset` while the bar is at the bottom, only the
 * home-indicator inset while it is a side rail (the rail is already in the
 * side insets), 0 with the JS tab bar.
 *
 * Key exports: useReadableLayout, useTabBarInset, ReadableLayout
 */
import { useCallback } from 'react';
import { StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiquidGlass } from '@/context/LiquidGlassContext';
import { usePaneLayout } from '@/context/PaneLayoutContext';
import { READABLE_MAX_WIDTH } from '@/constants/spacing';
import {
  addHorizontalPadding,
  getReadableGutter,
  getTabBarSide,
  horizontalInsetStyle,
  type TabBarSide,
} from '@/utils/glass-layout';

export interface ReadableLayout {
  /** Left/right safe-area insets of this screen (status island, side tab bar). */
  safeLeft: number;
  safeRight: number;
  /** Extra padding on each side that centers content in the readable column. */
  gutter: number;
  /** Width of the content column after the side insets and gutters. */
  contentWidth: number;
  /** Root-view padding for the side insets (flat tab screens only; undefined when 0). */
  safeAreaStyle: ViewStyle | undefined;
  /**
   * A scroll view's content style with the readable gutter added. Content is
   * not inset by the side safe area: like a list under the bottom glass tab
   * bar on iPhone, it scrolls beneath the Duo's side tab bar and the status
   * island's plate (see useTabBarInset for the end-of-list clearance).
   */
  contentStyle: (base?: StyleProp<ViewStyle>) => StyleProp<ViewStyle>;
  /** Minimum top padding for scroll content to clear the status island (0 if none). */
  islandTop: number;
  /** Padding that keeps a full-width header's controls inside the safe area. */
  sidePaddingStyle: ViewStyle | undefined;
}

export function useReadableLayout(): ReadableLayout {
  const { width: windowWidth } = useWindowDimensions();
  // Inside a split-view pane, measure against the pane, not the window.
  const pane = usePaneLayout();
  const width = pane?.width ?? windowWidth;
  const { left, right } = useSafeAreaInsets();
  const available = Math.max(0, width - left - right);
  const gutter = getReadableGutter(available, READABLE_MAX_WIDTH);
  // Measured from the screen top; callers whose content starts below an
  // in-flow header subtract that header's height.
  const islandTop =
    left > 0 || right > 0
      ? windowWidth >= 600
        ? STATUS_ISLAND_CLEARANCE_WIDE
        : STATUS_ISLAND_CLEARANCE
      : 0;
  const contentStyle = useCallback(
    (base?: StyleProp<ViewStyle>) => addHorizontalPadding(base, gutter, gutter),
    [gutter],
  );
  return {
    safeLeft: left,
    safeRight: right,
    gutter,
    contentWidth: available - gutter * 2,
    islandTop,
    safeAreaStyle: horizontalInsetStyle(left, right),
    sidePaddingStyle: horizontalInsetStyle(left, right),
    contentStyle,
  };
}

/** Which edge the glass tab bar is on for this tab screen ('bottom' without it). */
export function useTabBarSide(): TabBarSide {
  const { tabBarGlass, windowInsets } = useLiquidGlass();
  const { left, right } = useSafeAreaInsets();
  const pane = usePaneLayout();
  if (pane) return pane.tabBarSide;
  return tabBarGlass ? getTabBarSide({ left, right }, windowInsets) : 'bottom';
}

/** Bottom space the glass tab bar covers on this tab screen (0 with the JS tab bar). */
/**
 * How far down the iPhone Duo's status island reaches (camera, clock, Wi-Fi
 * stacked in the top-right column). With a side inset present, scroll content
 * starts at least this far down so nothing sits under the island at rest; it
 * only passes beneath it while scrolling.
 */
export const STATUS_ISLAND_CLEARANCE = 170;
/** Unfolded, the island is a single row (no camera above the clock). */
export const STATUS_ISLAND_CLEARANCE_WIDE = 110;

/** Raise a content style's top padding to at least `min` (no-op for 0). */
export function withMinTopPadding(style: StyleProp<ViewStyle>, min: number): StyleProp<ViewStyle> {
  if (min <= 0) return style;
  const flat = StyleSheet.flatten(style) ?? {};
  const top = Number(flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0);
  return top >= min ? style : [style, { paddingTop: min }];
}

/** Height a side glass tab bar rail covers at the bottom of the screen (5 tabs + margin). */
export const SIDE_RAIL_CLEARANCE = 290;

export function useTabBarInset(): number {
  const { tabBarInset, windowInsets } = useLiquidGlass();
  const side = useTabBarSide();
  if (tabBarInset <= 0) return 0;
  // A side rail sits over the bottom of the content column, so a list needs
  // enough end padding to scroll its last row up past it.
  return side === 'bottom' ? tabBarInset : windowInsets.bottom + SIDE_RAIL_CLEARANCE;
}
