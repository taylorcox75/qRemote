/**
 * index.ts — JS entry point for the UiSounds local native module.
 *
 * Plays short bundled tones through iOS System Sound Services
 * (AudioServicesPlaySystemSound — see ios/UiSoundsModule.swift). That API is
 * deliberately preferred over expo-audio here: it respects the ringer/silent
 * switch automatically and never takes over or ducks the audio session, which
 * matters for a UI sound effect that shouldn't interrupt music/podcasts.
 */
export type UiSoundName = 'tap' | 'reannounce' | 'success' | 'error';

interface UiSoundsNativeModule {
  play(name: UiSoundName): void;
}

// Deliberately `require`d rather than statically imported — see
// modules/insecure-cert-allowlist/index.ts for why: expo-modules-core ships
// untranspiled TS/ESM source that plain ts-jest (the `node` Jest project)
// can't parse. A runtime require keeps that failure containable here.
let nativeModule: UiSoundsNativeModule | null = null;
try {
  const { requireNativeModule } = require('expo-modules-core') as {
    requireNativeModule: (name: string) => UiSoundsNativeModule;
  };
  nativeModule = requireNativeModule('UiSounds');
} catch {
  // Not available (e.g. the `node` Jest project, or jest-expo mocking native
  // modules generically without knowing this one). Safe to no-op — the sound
  // this feeds is a non-essential UI accent.
  nativeModule = null;
}

/** Play a bundled short UI tone. No-ops if the native module isn't available. */
export function playUiSound(name: UiSoundName): void {
  nativeModule?.play(name);
}
