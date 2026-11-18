/**
 * LiquidGlassContext — whether iOS 26 Liquid Glass is drawn, from the
 * `liquidGlassEnabled` preference (Settings → Appearance → "Liquid Glass",
 * default on). Glass only ever changes the material; the layout is the same
 * with it on or off.
 *
 * - `available` — this binary/OS can draw glass (utils/liquidGlass.ts: iOS 26+
 *   with the ExpoGlassEffect native module). Fixed for the process lifetime.
 * - `preference` — the stored setting (what the Settings switch shows).
 * - `enabled` — glass materials are drawn right now: available, preference on,
 *   and neither iOS "Reduce Transparency" nor "Increase Contrast" is on. All
 *   three are followed live; a change only swaps materials (GlassView ⇄ solid
 *   View) and never touches the navigator.
 * - `tabBarGlass` — the system glass tab bar (expo-router NativeTabs) is used.
 *   Latched from available && preference at the first preference load: the two
 *   tab bars are different navigators, so switching takes an app restart and
 *   the current tab bar stays until then. The system tab bar handles the
 *   accessibility settings natively.
 * - `loaded` — the preference has been read. Where glass is available the tab
 *   layout waits for it (a few ms) so a launch never mounts one navigator and
 *   then swaps to the other.
 *
 * While the glass tab bar is in use, the app window's interface style is pinned
 * to the app theme (`Appearance.setColorScheme`) so UIKit chrome — the system
 * tab bar above all — follows a manual Light/Dark choice instead of the system
 * appearance. Theme mode "System" leaves it unspecified (they agree, and
 * overriding would stop ThemeContext's useColorScheme from seeing OS changes).
 * Without the glass tab bar this is never called.
 *
 * Outside the provider (e.g. component tests) everything reads as off.
 *
 * - `tabBarInset` — how far the floating glass tab bar reaches up from the bottom
 *   of a tab screen (home-indicator inset + the bar), or 0 with the JS tab bar.
 *   Tab scenes are not padded for the glass bar, so content scrolls under it;
 *   each screen pads its scroll content and bottom-anchored overlays by this
 *   (hooks/useGlassTabScreenLayout.ts).
 *
 * Key exports: LiquidGlassProvider, useLiquidGlass, useGlassStackTopInset,
 *   useGlassStackContentStyle, GLASS_TAB_BAR_HEIGHT
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Appearance, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { storageService } from '@/services/storage';
import { DEFAULT_PREFERENCES } from '@/types/preferences';
import { getLiquidGlassSupport, isGlassAllowedByAccessibility } from '@/utils/liquidGlass';
import { horizontalInsetStyle } from '@/utils/glass-layout';

/** Height of the tab bar above the home-indicator inset (UITabBar's 49pt). */
export const GLASS_TAB_BAR_HEIGHT = 49;

interface LiquidGlassContextValue {
  /** Liquid Glass can be drawn in this binary on this OS. */
  available: boolean;
  /** The stored `liquidGlassEnabled` setting. */
  preference: boolean;
  /** Glass materials are drawn right now. */
  enabled: boolean;
  /** The system glass tab bar is used (fixed for the session). */
  tabBarGlass: boolean;
  /** The stored preference has been read. */
  loaded: boolean;
  /**
   * Bottom space the glass tab bar covers on a tab screen when the bar is at
   * the bottom (0 without it). Tab screens read it through useTabBarInset
   * (hooks/useReadableLayout.ts), which drops it when the bar is a side rail.
   */
  tabBarInset: number;
  /**
   * The window's own safe-area insets, read above the tab navigator. Inside a
   * native tab the screen's insets also include the glass tab bar, so comparing
   * the two tells which edge that bar is on (utils/glass-layout.ts getTabBarSide).
   */
  windowInsets: WindowInsets;
  setPreference: (value: boolean) => Promise<void>;
}

export interface WindowInsets {
  left: number;
  right: number;
  bottom: number;
}

const NO_WINDOW_INSETS: WindowInsets = { left: 0, right: 0, bottom: 0 };

const OFF: LiquidGlassContextValue = {
  available: false,
  preference: false,
  enabled: false,
  tabBarGlass: false,
  loaded: true,
  tabBarInset: 0,
  windowInsets: NO_WINDOW_INSETS,
  setPreference: async () => undefined,
};

const LiquidGlassContext = createContext<LiquidGlassContextValue>(OFF);

const DEFAULT_ON = DEFAULT_PREFERENCES.liquidGlassEnabled !== false;

export function LiquidGlassProvider({ children }: { children: React.ReactNode }) {
  const available = getLiquidGlassSupport().available;
  const [preference, setPreferenceState] = useState(DEFAULT_ON);
  const [loaded, setLoaded] = useState(!available);
  const [tabBarGlass, setTabBarGlass] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [increaseContrast, setIncreaseContrast] = useState(false);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    storageService
      .getPreferences()
      .then((prefs) => {
        if (cancelled) return;
        const on = prefs.liquidGlassEnabled ?? DEFAULT_ON;
        setPreferenceState(on);
        setTabBarGlass(on);
      })
      .catch(() => {
        if (!cancelled) setTabBarGlass(DEFAULT_ON);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [available]);

  // iOS accessibility: Reduce Transparency / Increase Contrast (RN exposes the
  // latter as "darker system colors"). Read once, then follow live changes.
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((on) => {
        if (!cancelled) setReduceTransparency(on);
      })
      // If the setting can't be read, keep the default and rely on the live listener below.
      .catch(() => undefined);
    AccessibilityInfo.isDarkerSystemColorsEnabled()
      .then((on) => {
        if (!cancelled) setIncreaseContrast(on);
      })
      // If the setting can't be read, keep the default and rely on the live listener below.
      .catch(() => undefined);
    const subs = [
      AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency),
      AccessibilityInfo.addEventListener('darkerSystemColorsChanged', setIncreaseContrast),
    ];
    return () => {
      cancelled = true;
      subs.forEach((sub) => sub?.remove());
    };
  }, [available]);

  const { themeMode } = useTheme();
  useEffect(() => {
    if (!tabBarGlass) return;
    Appearance.setColorScheme(themeMode === 'system' ? 'unspecified' : themeMode);
  }, [tabBarGlass, themeMode]);

  const setPreference = useCallback(async (value: boolean) => {
    await storageService.updatePreferences({ liquidGlassEnabled: value });
    setPreferenceState(value);
  }, []);

  // Read here, above the tab navigator: each native tab screen has its own
  // SafeAreaProvider, so the window's home-indicator inset is only known here.
  const windowSafeArea = useSafeAreaInsets();
  const windowBottomInset = windowSafeArea.bottom;
  const tabBarInset = tabBarGlass ? windowBottomInset + GLASS_TAB_BAR_HEIGHT : 0;
  const windowLeft = windowSafeArea.left;
  const windowRight = windowSafeArea.right;
  const windowInsets = useMemo<WindowInsets>(
    () => ({ left: windowLeft, right: windowRight, bottom: windowBottomInset }),
    [windowLeft, windowRight, windowBottomInset],
  );

  const enabled =
    available &&
    preference &&
    isGlassAllowedByAccessibility({ reduceTransparency, increaseContrast });

  const value = useMemo<LiquidGlassContextValue>(
    () => ({
      available,
      preference,
      enabled,
      tabBarGlass,
      loaded,
      tabBarInset,
      windowInsets,
      setPreference,
    }),
    [available, preference, enabled, tabBarGlass, loaded, tabBarInset, windowInsets, setPreference],
  );

  return <LiquidGlassContext.Provider value={value}>{children}</LiquidGlassContext.Provider>;
}

export function useLiquidGlass(): LiquidGlassContextValue {
  return useContext(LiquidGlassContext);
}

/**
 * Status-bar inset for the Stack inside a tab while the glass tab bar is used.
 * A native stack clips its screens to its own bounds, so if the tab scene were
 * padded below the status bar, a screen's glass header could never reach up
 * under it. The inset is applied inside each stack screen instead
 * (`contentStyle.paddingTop`), where the header's GlassHeaderBackdrop can extend
 * into it. Undefined with the JS tab bar (its wrapper pads the top as before).
 */
export function useGlassStackTopInset(): number | undefined {
  const { tabBarGlass } = useLiquidGlass();
  const insets = useSafeAreaInsets();
  return tabBarGlass ? insets.top : undefined;
}

/**
 * `contentStyle` for the Stack inside a tab: the theme background and the
 * status-bar inset (useGlassStackTopInset). No bottom band: every tab screen
 * runs under the floating glass tab bar and insets its own content
 * (hooks/useGlassTabScreenLayout.ts). With the JS tab bar it is just the
 * background, as before.
 *
 * Plus the screen's left/right safe-area insets, in both tab bar modes, so
 * every stack screen (header buttons included) clears the iPhone Duo's
 * top-right status island and a side glass tab bar rail (UIKit adds the rail
 * to the tab screen's safe area, which this reads from inside the tab). Both
 * are 0 on a regular iPhone in portrait, which then gets no padding keys at all.
 */
export function useGlassStackContentStyle(): ViewStyle {
  const { colors } = useTheme();
  const topInset = useGlassStackTopInset();
  const { left, right } = useSafeAreaInsets();
  return {
    backgroundColor: colors.background,
    ...(topInset !== undefined && { paddingTop: topInset }),
    ...horizontalInsetStyle(left, right),
  };
}
