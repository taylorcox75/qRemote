import type { StyleProp, ViewStyle } from 'react-native';
import { addContentPadding } from '@/utils/glass-layout';

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
