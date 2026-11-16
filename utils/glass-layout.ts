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
 * Key exports: addContentPadding
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
