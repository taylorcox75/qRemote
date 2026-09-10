import { resolveConnectionSettings } from '@/utils/connection-settings';

describe('resolveConnectionSettings', () => {
  it('falls back to defaults when preferences are empty', () => {
    expect(resolveConnectionSettings({})).toEqual({
      connectionTimeout: 10000,
      retryAttempts: 3,
    });
  });

  it('preserves a legitimately saved retryAttempts of 0', () => {
    expect(resolveConnectionSettings({ connectionTimeout: 5000, retryAttempts: 0 })).toEqual({
      connectionTimeout: 5000,
      retryAttempts: 0,
    });
  });

  it('falls back to defaults for corrupt/invalid values', () => {
    expect(
      resolveConnectionSettings({
        connectionTimeout: 'abc' as unknown as number,
        retryAttempts: -1,
      }),
    ).toEqual({
      connectionTimeout: 10000,
      retryAttempts: 3,
    });
  });
});
