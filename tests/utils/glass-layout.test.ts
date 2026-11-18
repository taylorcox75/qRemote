import type { StyleProp, ViewStyle } from 'react-native';
import {
  addContentPadding,
  addHorizontalPadding,
  getReadableGutter,
  getTabBarSide,
  horizontalInsetStyle,
  SIDE_TAB_BAR_MIN_INSET,
} from '@/utils/glass-layout';

const flat = (style: StyleProp<ViewStyle>): ViewStyle =>
  Array.isArray(style)
    ? Object.assign({}, ...style.map((s) => flat(s)))
    : ((style ?? {}) as ViewStyle);

describe('addContentPadding', () => {
  it('returns the base style untouched when there is nothing to add', () => {
    const base = { paddingBottom: 8 };
    expect(addContentPadding(base, 0, 0)).toBe(base);
    expect(addContentPadding(undefined, 0, 0)).toBeUndefined();
  });

  it('adds to explicit top/bottom padding', () => {
    const out = flat(addContentPadding({ paddingTop: 4, paddingBottom: 8 }, 50, 83));
    expect(out).toMatchObject({ paddingTop: 54, paddingBottom: 91 });
  });

  it('falls back to paddingVertical, then padding', () => {
    expect(flat(addContentPadding({ paddingVertical: 6 }, 10, 20))).toMatchObject({
      paddingTop: 16,
      paddingBottom: 26,
    });
    expect(flat(addContentPadding([{ padding: 2 }], 10, 0))).toMatchObject({
      paddingTop: 12,
      padding: 2,
    });
  });

  it('works without a base style and only touches the sides it adds', () => {
    expect(addContentPadding(undefined, 0, 83)).toEqual({ paddingBottom: 83 });
  });
});

describe('addHorizontalPadding', () => {
  it('returns the base style untouched when there is nothing to add', () => {
    const base = { paddingHorizontal: 16 };
    expect(addHorizontalPadding(base, 0, 0)).toBe(base);
    expect(addHorizontalPadding(undefined, 0, 0)).toBeUndefined();
  });

  it('adds to explicit left/right padding', () => {
    expect(flat(addHorizontalPadding({ paddingLeft: 4, paddingRight: 8 }, 10, 20))).toMatchObject({
      paddingLeft: 14,
      paddingRight: 28,
    });
  });

  it('falls back to start/end, then paddingHorizontal, then padding', () => {
    expect(flat(addHorizontalPadding({ paddingStart: 3, paddingEnd: 5 }, 10, 10))).toMatchObject({
      paddingLeft: 13,
      paddingRight: 15,
    });
    expect(flat(addHorizontalPadding({ paddingHorizontal: 16 }, 100, 100))).toMatchObject({
      paddingLeft: 116,
      paddingRight: 116,
    });
    expect(flat(addHorizontalPadding([{ padding: 2 }, false], 0, 30))).toMatchObject({
      paddingRight: 32,
      padding: 2,
    });
  });

  it('builds a style from nothing', () => {
    expect(addHorizontalPadding(undefined, 5, 0)).toEqual({ paddingLeft: 5 });
  });
});

describe('getReadableGutter', () => {
  it('is 0 at or below the max width (every regular iPhone)', () => {
    expect(getReadableGutter(393, 800)).toBe(0);
    expect(getReadableGutter(800, 800)).toBe(0);
  });

  it('centers the column on wider windows, rounding down', () => {
    expect(getReadableGutter(1000, 800)).toBe(100);
    expect(getReadableGutter(1001, 800)).toBe(100);
  });

  it('ignores a non-positive cap or bad width', () => {
    expect(getReadableGutter(1000, 0)).toBe(0);
    expect(getReadableGutter(Number.NaN, 800)).toBe(0);
  });
});

describe('horizontalInsetStyle', () => {
  it('is undefined with no side insets', () => {
    expect(horizontalInsetStyle(0, 0)).toBeUndefined();
  });

  it('sets only the non-zero sides', () => {
    expect(horizontalInsetStyle(0, 62)).toEqual({ paddingRight: 62 });
    expect(horizontalInsetStyle(20, 20)).toEqual({ paddingLeft: 20, paddingRight: 20 });
  });
});

describe('getTabBarSide', () => {
  const none = { left: 0, right: 0 };

  it('reads the bar as at the bottom when the screen and window agree', () => {
    expect(getTabBarSide(none, none)).toBe('bottom');
    // The status island is in both, so it never reads as a rail.
    expect(getTabBarSide({ left: 0, right: 54 }, { left: 0, right: 54 })).toBe('bottom');
  });

  it('ignores differences smaller than a rail', () => {
    expect(getTabBarSide({ left: 0, right: SIDE_TAB_BAR_MIN_INSET - 1 }, none)).toBe('bottom');
  });

  it('finds a rail on the right or left', () => {
    expect(getTabBarSide({ left: 0, right: 54 + 80 }, { left: 0, right: 54 })).toBe('right');
    expect(getTabBarSide({ left: 80, right: 0 }, none)).toBe('left');
  });

  it('prefers the side with the larger extra inset', () => {
    expect(getTabBarSide({ left: 90, right: 30 }, none)).toBe('left');
    expect(getTabBarSide({ left: 30, right: 90 }, none)).toBe('right');
  });
});
