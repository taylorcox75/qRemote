import { buildGlobalShareLimitPatch, rememberLimitValue } from '@/utils/global-share-limits';

describe('buildGlobalShareLimitPatch', () => {
  it('sends the ratio flag and value together when enabling', () => {
    expect(buildGlobalShareLimitPatch('ratio', true, 2.5)).toEqual({
      max_ratio_enabled: true,
      max_ratio: 2.5,
    });
  });

  it('keeps an explicit ratio of 0 when enabling', () => {
    expect(buildGlobalShareLimitPatch('ratio', true, 0)).toEqual({
      max_ratio_enabled: true,
      max_ratio: 0,
    });
  });

  it('sends -1 alongside a disabled ratio flag', () => {
    expect(buildGlobalShareLimitPatch('ratio', false, 3)).toEqual({
      max_ratio_enabled: false,
      max_ratio: -1,
    });
  });

  it('sends the seeding-time flag and whole minutes together', () => {
    expect(buildGlobalShareLimitPatch('seedingTime', true, 90.6)).toEqual({
      max_seeding_time_enabled: true,
      max_seeding_time: 91,
    });
  });

  it('sends -1 alongside a disabled seeding-time flag', () => {
    expect(buildGlobalShareLimitPatch('seedingTime', false, 1440)).toEqual({
      max_seeding_time_enabled: false,
      max_seeding_time: -1,
    });
  });

  it('never produces a patch with only one half of the pair', () => {
    for (const kind of ['ratio', 'seedingTime'] as const) {
      for (const enabled of [true, false]) {
        expect(Object.keys(buildGlobalShareLimitPatch(kind, enabled, 1))).toHaveLength(2);
      }
    }
  });
});

describe('rememberLimitValue', () => {
  it('takes a non-negative server value', () => {
    expect(rememberLimitValue(1.5, null)).toBe(1.5);
    expect(rememberLimitValue(0, 2)).toBe(0);
  });

  it('keeps the previous value when the server reports a disabled limit (-1)', () => {
    expect(rememberLimitValue(-1, 2)).toBe(2);
    expect(rememberLimitValue(-1, null)).toBeNull();
  });

  it('keeps the previous value for a missing or non-numeric reading', () => {
    expect(rememberLimitValue(undefined, 30)).toBe(30);
    expect(rememberLimitValue('2', 30)).toBe(30);
    expect(rememberLimitValue(NaN, null)).toBeNull();
  });
});
