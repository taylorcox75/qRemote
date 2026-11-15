/**
 * GlassSurface — a View that becomes an iOS 26 Liquid Glass surface when glass
 * is on and the running binary/OS supports it (see utils/liquidGlass.ts and
 * context/LiquidGlassContext.tsx). With glass off it keeps exactly the given
 * props (a GlassView with effect 'none' where glass is supported, else a plain
 * View), so callers keep today's look and children never remount on a toggle.
 *
 * `glass` defaults to the app-wide setting (`useLiquidGlass().enabled`); pass
 * `false` to force a plain View (e.g. the Torrents solid pinned header).
 *
 * With glass on, any backgroundColor (and shadow) in `style` is dropped (an
 * opaque background would hide the material), and the glass follows the app theme's
 * light/dark mode rather than the system's. `tintColor` tints the material
 * (theme colours only — e.g. a toast's status colour); `popover` applies a
 * translucent `colors.surface` tint for menus, popovers and sheets.
 *
 * Key exports: GlassSurface
 */
import React from 'react';
import { ColorValue, StyleSheet, View, ViewProps, type ViewInstance } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useLiquidGlass } from '@/context/LiquidGlassContext';
import { getLiquidGlassSupport, shouldUseLiquidGlass } from '@/utils/liquidGlass';
import { withAlpha } from '@/utils/color';

interface GlassSurfaceProps extends ViewProps {
  /** Override the app-wide setting for this surface. */
  glass?: boolean;
  /** Pressable glass (subtle highlight on touch). */
  interactive?: boolean;
  /** Optional theme colour to tint the material with. */
  tintColor?: ColorValue;
  /**
   * Floating menu / popover / sheet: tints the material with a translucent
   * `colors.surface` (unless `tintColor` is given) so text stays readable over
   * saturated content scrolling underneath.
   */
  popover?: boolean;
  /** Forwarded to the underlying View / GlassView (React 19 ref-as-prop). */
  ref?: React.Ref<ViewInstance>;
}

export function GlassSurface({
  glass,
  interactive,
  tintColor,
  popover,
  style,
  children,
  ref,
  ...rest
}: GlassSurfaceProps) {
  const { isDark, colors } = useTheme();
  const { enabled } = useLiquidGlass();
  const support = getLiquidGlassSupport();
  const GlassView = support.GlassView;
  // No glass in this binary/OS: that can't change while the app runs, so a
  // plain View here never swaps element type under the children.
  if (!GlassView) {
    return (
      <View ref={ref} style={style} {...rest}>
        {children}
      </View>
    );
  }
  // Glass is supported: always render a GlassView and only toggle its effect
  // ('none' = no material, original style kept), so flipping the setting or
  // Reduce Transparency never remounts the children (focus, switches, etc.).
  const on = shouldUseLiquidGlass(glass ?? enabled, support);
  return (
    <GlassView
      {...rest}
      ref={ref}
      style={on ? [style, styles.clearBackground] : style}
      glassEffectStyle={on ? 'regular' : 'none'}
      colorScheme={isDark ? 'dark' : 'light'}
      isInteractive={on && interactive === true}
      tintColor={
        on
          ? (tintColor ?? (popover ? withAlpha(colors.surface, POPOVER_TINT_ALPHA) : undefined))
          : undefined
      }
    >
      {children}
    </GlassView>
  );
}

/** Opacity of the `colors.surface` tint on popover glass. */
const POPOVER_TINT_ALPHA = 0.55;

const styles = StyleSheet.create({
  // No opaque fill to hide the material, and no shadow: RN can't rasterize a
  // shadow efficiently without a solid background.
  clearBackground: { backgroundColor: 'transparent', shadowOpacity: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

interface GlassWrapProps extends GlassSurfaceProps {
  /** When false (or glass unavailable) the wrapper draws nothing. */
  enabled: boolean;
}

/**
 * Wraps `children` in a GlassSurface for controls such as a TouchableOpacity
 * that can't themselves become a GlassView. The wrapper is always rendered (so
 * toggling `enabled` never remounts the children); when off it gets no style,
 * tint or interaction, leaving a layout-neutral wrapper around the
 * self-sized child.
 */
export function GlassWrap({
  enabled,
  children,
  style,
  tintColor,
  interactive,
  ...surfaceProps
}: GlassWrapProps) {
  return (
    <GlassSurface
      {...surfaceProps}
      glass={enabled}
      style={enabled ? style : undefined}
      tintColor={enabled ? tintColor : undefined}
      interactive={enabled && interactive === true}
    >
      {children}
    </GlassSurface>
  );
}

/**
 * Absolute-fill glass material for a container that can't itself become a
 * GlassView (a TouchableOpacity card). Mount it as the first child, make the
 * container's background transparent while glass is on, and let the
 * container's `overflow: 'hidden'` + radius shape it. Renders nothing when
 * glass is off.
 */
export function GlassFill({ tintColor }: { tintColor?: ColorValue }) {
  const { enabled } = useLiquidGlass();
  if (!enabled) return null;
  return <GlassSurface glass pointerEvents="none" tintColor={tintColor} style={styles.fill} />;
}
