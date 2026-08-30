jest.mock('@/modules/ui-sounds', () => ({
  playUiSound: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { Platform } from 'react-native';
import { playUiSound } from '@/modules/ui-sounds';
import { sounds, setSoundEffectsEnabled, setSoundEffectActions } from '@/utils/sounds';
import { DEFAULT_PREFERENCES } from '@/types/preferences';

describe('sounds', () => {
  const mockPlatform = Platform as unknown as { OS: string };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = 'ios';
    setSoundEffectsEnabled(false);
    setSoundEffectActions({ ...DEFAULT_PREFERENCES.soundEffectActions });
  });

  it('does nothing when sound effects are disabled', () => {
    sounds.reannounce();
    sounds.actionError();
    sounds.pauseResume();
    sounds.forceStart();
    sounds.verifyData();
    expect(playUiSound).not.toHaveBeenCalled();
  });

  it('plays each action’s assigned sound once enabled', () => {
    setSoundEffectsEnabled(true);
    sounds.reannounce();
    sounds.pauseResume();
    sounds.forceStart();
    sounds.verifyData();
    sounds.actionError();
    expect(playUiSound).toHaveBeenCalledWith('reannounce');
    expect(playUiSound).toHaveBeenCalledWith('tap');
    expect(playUiSound).toHaveBeenCalledWith('success');
    expect(playUiSound).toHaveBeenCalledWith('error');
    expect(playUiSound).toHaveBeenCalledTimes(5);
  });

  it('respects a per-action override to a different sound', () => {
    setSoundEffectsEnabled(true);
    setSoundEffectActions({ ...DEFAULT_PREFERENCES.soundEffectActions, pauseResume: 'success' });
    sounds.pauseResume();
    expect(playUiSound).toHaveBeenCalledWith('success');
  });

  it('does nothing for an action assigned "none"', () => {
    setSoundEffectsEnabled(true);
    setSoundEffectActions({ ...DEFAULT_PREFERENCES.soundEffectActions, reannounce: 'none' });
    sounds.reannounce();
    expect(playUiSound).not.toHaveBeenCalled();
  });

  it('does nothing on non-iOS platforms even when enabled', () => {
    setSoundEffectsEnabled(true);
    mockPlatform.OS = 'android';
    sounds.reannounce();
    sounds.pauseResume();
    expect(playUiSound).not.toHaveBeenCalled();
  });
});
