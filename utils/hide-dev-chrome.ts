import { Platform } from 'react-native';

/**
 * Expo Dev Client paints a floating Tools gear and (on Mac Catalyst) a
 * Home / Updates / Settings tab strip into the window chrome. Hide both
 * as soon as JS boots. Native Info.plist + SceneDelegate cover the next
 * cold launch; this covers the current session via UserDefaults.
 */
export function hideDevChrome(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core') as {
      requireOptionalNativeModule: (name: string) => {
        setPreferencesAsync?: (settings: Record<string, boolean>) => Promise<unknown>;
      } | null;
    };
    const prefs = requireOptionalNativeModule('DevMenuPreferences');
    void prefs?.setPreferencesAsync?.({
      showFloatingActionButton: false,
      showsAtLaunch: false,
    });
  } catch {
    // Tests / release builds have no DevMenu native module.
  }

  if (!(Platform.OS === 'ios' && (Platform.isMacCatalyst ?? false))) return;
}
