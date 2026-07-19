jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.3' },
  },
}));

describe('APP_VERSION / getAppVersion', () => {
  it('reads the version from Constants.expoConfig', () => {
    jest.isolateModules(() => {
      const { APP_VERSION, getAppVersion } = require('@/utils/version');
      expect(APP_VERSION).toBe('1.2.3');
      expect(getAppVersion()).toBe('1.2.3');
    });
  });

  it('falls back to "N/A" when expoConfig is missing', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {},
    }));
    jest.isolateModules(() => {
      const { APP_VERSION, getAppVersion } = require('@/utils/version');
      expect(APP_VERSION).toBe('N/A');
      expect(getAppVersion()).toBe('N/A');
    });
    jest.dontMock('expo-constants');
  });
});
