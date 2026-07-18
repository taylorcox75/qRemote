jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { haptics, setHapticsEnabled } from '@/utils/haptics';

describe('haptics', () => {
  const mockPlatform = Platform as unknown as { OS: string };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = 'ios';
    setHapticsEnabled(true);
  });

  it('light triggers impactAsync with Light style on iOS when enabled', () => {
    haptics.light();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('medium triggers impactAsync with Medium style', () => {
    haptics.medium();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('heavy triggers impactAsync with Heavy style', () => {
    haptics.heavy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  it('success triggers notificationAsync with Success type', () => {
    haptics.success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('error triggers notificationAsync with Error type', () => {
    haptics.error();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it('warning triggers notificationAsync with Warning type', () => {
    haptics.warning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
  });

  it('selection triggers selectionAsync', () => {
    haptics.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('does nothing on non-iOS platforms', () => {
    mockPlatform.OS = 'android';
    haptics.light();
    haptics.success();
    haptics.selection();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('does nothing when haptics are disabled via setHapticsEnabled(false)', () => {
    setHapticsEnabled(false);
    haptics.light();
    haptics.success();
    haptics.selection();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('resumes firing once re-enabled', () => {
    setHapticsEnabled(false);
    setHapticsEnabled(true);
    haptics.light();
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });
});
