/**
 * index.ts - JS entry point for the MacCommands local native module.
 *
 * Bridges qRemote's Mac Catalyst app menu (File > New Transfer; View >
 * Refresh/Find/Toggle Sidebar; a top-level Transfer menu; app menu >
 * Preferences - see PogonaApp.swift in the Pogona repo for the reference
 * menu layout this mirrors) to JS. The native side
 * (ios/MacMenuRegistry.swift, driven from the generated AppDelegate via the
 * withAppDelegate step in plugins/withMacCatalyst.js) owns the actual
 * UIMenuBuilder calls; this file only exposes that as plain functions plus
 * an event subscription for fired commands.
 *
 * Every export is a safe no-op when the native module is unavailable (jest,
 * or a plain iOS/iPadOS build where MacCommands still links but
 * isMacIdiom() is simply always false) so callers never need to guard on
 * Platform.isMacCatalyst before calling in - see hooks/useMacCommands.ts.
 */
export type MacCommandId =
  | 'newTransfer'
  | 'refresh'
  | 'toggleAltSpeed'
  | 'resume'
  | 'pause'
  | 'delete'
  | 'recheck'
  | 'reannounce'
  | 'queueTop'
  | 'queueUp'
  | 'queueDown'
  | 'queueBottom'
  | 'resumeAll'
  | 'pauseAll'
  | 'find'
  | 'toggleSidebar'
  | 'preferences';

export const MAC_COMMAND_IDS: MacCommandId[] = [
  'newTransfer',
  'refresh',
  'toggleAltSpeed',
  'resume',
  'pause',
  'delete',
  'recheck',
  'reannounce',
  'queueTop',
  'queueUp',
  'queueDown',
  'queueBottom',
  'resumeAll',
  'pauseAll',
  'find',
  'toggleSidebar',
  'preferences',
];

export interface MacCommandEvent {
  id: MacCommandId;
}

export interface MacCommandSubscription {
  remove(): void;
}

type MenuTitleKey = MacCommandId | 'transferMenu';

interface MacCommandsNativeModule {
  isMacIdiom(): boolean;
  setEnabledCommands(ids: MacCommandId[]): void;
  setMenuTitles(titles: Partial<Record<MenuTitleKey, string>>): void;
  setWindowMinSize(width: number, height: number): void;
  addListener(
    eventName: 'onCommand',
    listener: (event: MacCommandEvent) => void,
  ): MacCommandSubscription;
}

// Deliberately `require`d rather than statically imported - see
// modules/insecure-cert-allowlist/index.ts for why: expo-modules-core ships
// untranspiled TS/ESM source that plain ts-jest (the `node` Jest project)
// can't parse. A runtime require keeps that failure containable here.
let nativeModule: MacCommandsNativeModule | null = null;
try {
  const { requireNativeModule } = require('expo-modules-core') as {
    requireNativeModule: (name: string) => MacCommandsNativeModule;
  };
  nativeModule = requireNativeModule('MacCommands');
} catch {
  // Not available (e.g. the `node` Jest project, or jest-expo mocking
  // native modules generically without knowing this one). Every export
  // below already falls back to a safe no-op / false, so this is never
  // surfaced to a caller as an error.
  nativeModule = null;
}

/**
 * True only under Mac Catalyst (native: UIDevice.current.userInterfaceIdiom
 * == .mac). False on iPhone, iPad, and whenever the native module isn't
 * available (jest, or a plain-iOS build).
 */
export function isMacIdiom(): boolean {
  return nativeModule?.isMacIdiom() ?? false;
}

/** Replace the set of commands the app menu currently accepts; everything else shows disabled. */
export function setEnabledCommands(ids: MacCommandId[]): void {
  nativeModule?.setEnabledCommands(ids);
}

/** Override one or more menu item titles from their English fallback (used for i18n - see hooks/useMacCommands.ts). */
export function setMenuTitles(
  titles: Partial<Record<MacCommandId | 'transferMenu', string>>,
): void {
  nativeModule?.setMenuTitles(titles);
}

/** Set the Mac window's minimum content size in points. */
export function setWindowMinSize(width: number, height: number): void {
  nativeModule?.setWindowMinSize(width, height);
}

/** Subscribe to fired app-menu commands. No-ops to a subscription whose remove() does nothing when native is unavailable. */
export function addCommandListener(cb: (event: MacCommandEvent) => void): MacCommandSubscription {
  if (!nativeModule) {
    return { remove() {} };
  }
  return nativeModule.addListener('onCommand', cb);
}
