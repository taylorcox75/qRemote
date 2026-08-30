/**
 * Sound-effect utilities for iOS (#231).
 * Mirrors utils/haptics.ts: module-level state set from preferences, with
 * per-action calls that no-op unless sound effects are enabled. Each action
 * plays whichever sound the user assigned it in Settings (or none).
 */
import { Platform } from 'react-native';
import { playUiSound } from '@/modules/ui-sounds';
import { SoundActionKey, SoundEffectChoice, DEFAULT_PREFERENCES } from '@/types/preferences';

let enabled = false;
let actionSounds: Record<SoundActionKey, SoundEffectChoice> = {
  ...DEFAULT_PREFERENCES.soundEffectActions,
};

export function setSoundEffectsEnabled(next: boolean) {
  enabled = next;
}

export function setSoundEffectActions(next: Record<SoundActionKey, SoundEffectChoice>) {
  actionSounds = next;
}

function play(action: SoundActionKey) {
  if (Platform.OS !== 'ios' || !enabled) return;
  const choice = actionSounds[action];
  if (choice === 'none') return;
  playUiSound(choice);
}

export const sounds = {
  /** Reannounce to trackers — the flagship request in #231. */
  reannounce: () => play('reannounce'),

  /** Torrent paused or resumed. */
  pauseResume: () => play('pauseResume'),

  /** Torrent force-started. */
  forceStart: () => play('forceStart'),

  /** Force recheck / verify data started. */
  verifyData: () => play('verifyData'),

  /** A torrent action failed. */
  actionError: () => play('actionError'),
};
