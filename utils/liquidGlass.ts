/**
 * liquidGlass.ts — decides whether iOS 26 Liquid Glass (`expo-glass-effect`)
 * can actually be used in the running binary, for the `liquidGlassEnabled`
 * preference (Settings → Appearance → "Liquid Glass", default on).
 *
 * Three ways it can be missing, all of which must fall back to today's look:
 * - not iOS, or iOS < 26 (the native module reports `isLiquidGlassAvailable`
 *   false);
 * - an iOS 26 beta without the glass API (`isGlassEffectAPIAvailable` false —
 *   expo/expo#40911, rendering GlassView there can crash);
 * - an older binary that received this JS by OTA update and has no
 *   `ExpoGlassEffect` native module at all. `expo-glass-effect`'s iOS entry
 *   calls `requireNativeView` at import time, so the package is only
 *   `require`d after `requireOptionalNativeModule` confirmed the native side
 *   exists, and every step is inside a try/catch (same idea as
 *   `modules/insecure-cert-allowlist`'s `isInsecureCertAllowlistAvailable`).
 *
 * Key exports: getLiquidGlassSupport, resolveLiquidGlassSupport, shouldUseLiquidGlass,
 *   isGlassAllowedByAccessibility
 */
import type { ComponentType } from 'react';
import type { GlassViewProps } from 'expo-glass-effect';

export interface LiquidGlassSupport {
  available: boolean;
  GlassView: ComponentType<GlassViewProps> | null;
}

export const NO_LIQUID_GLASS: LiquidGlassSupport = Object.freeze({
  available: false,
  GlassView: null,
});

/** The subset of `expo-glass-effect` this app relies on. */
export interface GlassEffectModule {
  GlassView?: ComponentType<GlassViewProps>;
  isLiquidGlassAvailable?: () => boolean;
  isGlassEffectAPIAvailable?: () => boolean;
}

export interface LiquidGlassDeps {
  platformOS: () => string;
  /** True when the `ExpoGlassEffect` native module is linked into this binary. */
  hasNativeModule: () => boolean;
  /** Loads `expo-glass-effect`. Only called once `hasNativeModule` is true. */
  loadModule: () => GlassEffectModule;
}

export function resolveLiquidGlassSupport(deps: LiquidGlassDeps): LiquidGlassSupport {
  try {
    if (deps.platformOS() !== 'ios') return NO_LIQUID_GLASS;
    if (!deps.hasNativeModule()) return NO_LIQUID_GLASS;
    const mod = deps.loadModule();
    if (!mod || typeof mod.isLiquidGlassAvailable !== 'function') return NO_LIQUID_GLASS;
    if (!mod.isLiquidGlassAvailable()) return NO_LIQUID_GLASS;
    // Treat a missing check as "not available" rather than guessing.
    if (typeof mod.isGlassEffectAPIAvailable !== 'function') return NO_LIQUID_GLASS;
    if (!mod.isGlassEffectAPIAvailable()) return NO_LIQUID_GLASS;
    if (!mod.GlassView) return NO_LIQUID_GLASS;
    return { available: true, GlassView: mod.GlassView };
  } catch {
    return NO_LIQUID_GLASS;
  }
}

// Runtime requires, not static imports: the native side can't appear or
// disappear while the app runs, and a static import of expo-glass-effect would
// run its import-time `requireNativeView` outside any try/catch.
const runtimeDeps: LiquidGlassDeps = {
  platformOS: () => (require('react-native') as typeof import('react-native')).Platform.OS,
  hasNativeModule: () => {
    const { requireOptionalNativeModule } = require('expo-modules-core') as {
      requireOptionalNativeModule: (name: string) => unknown;
    };
    return requireOptionalNativeModule('ExpoGlassEffect') != null;
  },
  loadModule: () => require('expo-glass-effect') as GlassEffectModule,
};

let cached: LiquidGlassSupport | null = null;

/** Cached for the life of the process — availability can't change at runtime. */
export function getLiquidGlassSupport(): LiquidGlassSupport {
  if (cached === null) cached = resolveLiquidGlassSupport(runtimeDeps);
  return cached;
}

/** Glass is drawn only when the user opted in AND the binary/OS supports it. */
export function shouldUseLiquidGlass(
  enabled: boolean | undefined,
  support: LiquidGlassSupport = getLiquidGlassSupport(),
): boolean {
  return enabled === true && support.available && support.GlassView !== null;
}

export interface GlassAccessibilityState {
  /** iOS Settings → Accessibility → Display → Reduce Transparency. */
  reduceTransparency: boolean;
  /** iOS Increase Contrast (RN: `isDarkerSystemColorsEnabled`). */
  increaseContrast: boolean;
}

/**
 * Translucent glass is dropped (solid, today's surfaces) whenever the user has
 * asked iOS for less transparency or more contrast.
 */
export function isGlassAllowedByAccessibility(state: GlassAccessibilityState): boolean {
  return !state.reduceTransparency && !state.increaseContrast;
}
