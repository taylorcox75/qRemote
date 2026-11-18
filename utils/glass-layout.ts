/**
 * glass-layout.ts — pure helpers for laying a tab screen out under the iOS 26
 * floating glass chrome (hooks/useGlassTabScreenLayout.ts).
 *
 * With the glass tab bar, a screen's content runs the full height of the
 * screen: the header floats over the top of it and the tab bar over the bottom.
 * Scroll content is padded by both so its first and last rows can still scroll
 * fully clear of the glass. The padding is ADDED to whatever the content style
 * already sets, so each screen keeps its own spacing.
 *
 * Wide windows (the iPhone Duo's inner screen, iPad) add two horizontal
 * concerns, both driven only by real insets / window width so a regular
 * iPhone in portrait (no side insets, narrower than the cap) is untouched:
 * - side safe-area insets — the Duo's status-bar island sits at the top-right
 *   and its glass tab bar can become a side rail; `getTabBarSide` reads which
 *   edge the rail is on by comparing a tab screen's insets with the window's.
 * - readable width — `getReadableGutter` centers content in a column of at most
 *   READABLE_MAX_WIDTH, and `addHorizontalPadding` adds that gutter to a scroll
 *   content style the same additive way `addContentPadding` does vertically.
 *
 * Key exports: addContentPadding, addHorizontalPadding, getReadableGutter,
 *   getTabBarSide, horizontalInsetStyle, SIDE_TAB_BAR_MIN_INSET
 */
import type { StyleProp, ViewStyle } from 'react-native';

/** StyleSheet.flatten without importing react-native at runtime (pure util). */
function flatten(style: StyleProp<ViewStyle>): ViewStyle {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<ViewStyle>((acc, item) => ({ ...acc, ...flatten(item) }), {});
  }
  return typeof style === 'object' ? (style as ViewStyle) : {};
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * `base` with `top` / `bottom` added to its vertical padding. Returns `base`
 * itself when there is nothing to add, so screens without glass chrome render
 * exactly the style they had.
 */
export function addContentPadding(
  base: StyleProp<ViewStyle>,
  top: number,
  bottom: number,
): StyleProp<ViewStyle> {
  if (top <= 0 && bottom <= 0) return base;
  const flat = flatten(base);
  const extra: { paddingTop?: number; paddingBottom?: number } = {};
  if (top > 0) {
    const existing =
      numeric(flat.paddingTop) ?? numeric(flat.paddingVertical) ?? numeric(flat.padding) ?? 0;
    extra.paddingTop = existing + top;
  }
  if (bottom > 0) {
    const existing =
      numeric(flat.paddingBottom) ?? numeric(flat.paddingVertical) ?? numeric(flat.padding) ?? 0;
    extra.paddingBottom = existing + bottom;
  }
  return base ? [base, extra] : extra;
}

/**
 * `base` with `left` / `right` added to its horizontal padding (same additive
 * rules as addContentPadding). Returns `base` itself when there is nothing to
 * add.
 */
export function addHorizontalPadding(
  base: StyleProp<ViewStyle>,
  left: number,
  right: number,
): StyleProp<ViewStyle> {
  if (left <= 0 && right <= 0) return base;
  const flat = flatten(base);
  const extra: { paddingLeft?: number; paddingRight?: number } = {};
  if (left > 0) {
    const existing =
      numeric(flat.paddingLeft) ??
      numeric(flat.paddingStart) ??
      numeric(flat.paddingHorizontal) ??
      numeric(flat.padding) ??
      0;
    extra.paddingLeft = existing + left;
  }
  if (right > 0) {
    const existing =
      numeric(flat.paddingRight) ??
      numeric(flat.paddingEnd) ??
      numeric(flat.paddingHorizontal) ??
      numeric(flat.padding) ??
      0;
    extra.paddingRight = existing + right;
  }
  return base ? [base, extra] : extra;
}

/**
 * Padding for each side that centers content in a column of at most
 * `maxWidth` within `availableWidth` (the width left after the side safe-area
 * insets). 0 whenever the space is already no wider than the cap.
 */
export function getReadableGutter(availableWidth: number, maxWidth: number): number {
  if (!(availableWidth > maxWidth) || !(maxWidth > 0)) return 0;
  return Math.floor((availableWidth - maxWidth) / 2);
}

/** `{ paddingLeft, paddingRight }` for the non-zero side insets, else undefined. */
export function horizontalInsetStyle(
  left: number,
  right: number,
): { paddingLeft?: number; paddingRight?: number } | undefined {
  if (left <= 0 && right <= 0) return undefined;
  return {
    ...(left > 0 && { paddingLeft: left }),
    ...(right > 0 && { paddingRight: right }),
  };
}

/**
 * How much more side inset a tab screen must have than the window before it is
 * read as the glass tab bar running down that side (a rail is ~50pt+; a
 * rounding difference or the status island, present in both, is not).
 */
export const SIDE_TAB_BAR_MIN_INSET = 24;

export type TabBarSide = 'bottom' | 'left' | 'right';

/**
 * Which edge the system glass tab bar is on. UIKit adds the tab bar to the
 * safe area of the screens it hosts, so a side rail (iPhone Duo inner screen)
 * shows up as a tab screen's left/right inset exceeding the window's own.
 * Anything else — including the JS tab bar, where both are the same — reads as
 * the usual bottom bar.
 */
export function getTabBarSide(
  screen: { left: number; right: number },
  window: { left: number; right: number },
): TabBarSide {
  const extraRight = screen.right - window.right;
  const extraLeft = screen.left - window.left;
  if (extraRight >= SIDE_TAB_BAR_MIN_INSET && extraRight >= extraLeft) return 'right';
  if (extraLeft >= SIDE_TAB_BAR_MIN_INSET) return 'left';
  return 'bottom';
}
