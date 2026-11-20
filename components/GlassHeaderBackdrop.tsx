/**
 * GlassHeaderBackdrop — Liquid Glass "navigation bar" material behind a screen
 * header. Mount it as the FIRST child of the header view: it is absolutely
 * positioned, runs edge-to-edge (a few points past both side edges so the glass
 * rim never reads as a boxed card) and up under the status bar, and ends at the
 * header's bottom edge with rounded bottom corners. The header's own content
 * and padding are untouched.
 *
 * `borderOverlap` extends it over a header's own bottom border (pass the
 * border width) so the straight line doesn't fight the rounded corners.
 *
 * Renders nothing when glass is off/unavailable, so callers can mount it
 * unconditionally.
 *
 * Key exports: GlassHeaderBackdrop
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiquidGlass } from '@/context/LiquidGlassContext';
import { GlassSurface } from '@/components/GlassSurface';
import { borderRadius } from '@/constants/spacing';

/** How far the glass runs past each side edge, hiding its rim off-screen. */
const EDGE_BLEED = 4;

interface GlassHeaderBackdropProps {
  /** Override the app-wide setting (e.g. off for the solid pinned header). */
  glass?: boolean;
  /** Width of the header's own bottom border to cover (default 0). */
  borderOverlap?: number;
  /**
   * Run up under the status bar (default true). Pass false in a modal sheet,
   * whose header already sits at the top of the sheet.
   */
  underStatusBar?: boolean;
}

export function GlassHeaderBackdrop({
  glass,
  borderOverlap = 0,
  underStatusBar = true,
}: GlassHeaderBackdropProps) {
  const { enabled } = useLiquidGlass();
  const insets = useSafeAreaInsets();
  if (!(glass ?? enabled)) return null;
  return (
    <GlassSurface
      glass
      pointerEvents="none"
      testID="glass-header-backdrop"
      style={[
        styles.backdrop,
        { top: underStatusBar ? -insets.top - EDGE_BLEED : 0, bottom: -borderOverlap },
        // A side inset (iPhone Duo's status island column / side tab bar) ends
        // the glass there with its rounded corner, as a panel beside the
        // island: iOS draws its own plate behind the island, and glass running
        // under it collides with that plate.
        insets.left > 0 && { left: insets.left },
        insets.right > 0 && { right: insets.right },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: -EDGE_BLEED,
    right: -EDGE_BLEED,
    borderBottomLeftRadius: borderRadius.xlarge,
    borderBottomRightRadius: borderRadius.xlarge,
    borderCurve: 'continuous',
  },
});
