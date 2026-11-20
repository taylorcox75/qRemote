// useReadableLayout.test.ts — wide-window layout: side safe-area insets, the
// readable column (a no-op on a regular iPhone) and the glass tab bar's bottom
// inset, which drops to the home-indicator inset when the bar is a side rail.
import { renderHook } from '@testing-library/react-native';
import { useReadableLayout, useTabBarInset, useTabBarSide } from '@/hooks/useReadableLayout';
import { READABLE_MAX_WIDTH } from '@/constants/spacing';

let mockWidth = 393;
let mockInsets = { top: 59, bottom: 34, left: 0, right: 0 };
let mockGlass = {
  tabBarGlass: false,
  tabBarInset: 0,
  windowInsets: { left: 0, right: 0, bottom: 34 },
};

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 852, scale: 3, fontScale: 1 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@/context/LiquidGlassContext', () => ({
  useLiquidGlass: () => mockGlass,
}));

beforeEach(() => {
  mockWidth = 393;
  mockInsets = { top: 59, bottom: 34, left: 0, right: 0 };
  mockGlass = {
    tabBarGlass: false,
    tabBarInset: 0,
    windowInsets: { left: 0, right: 0, bottom: 34 },
  };
});

describe('useReadableLayout', () => {
  it('changes nothing on a regular iPhone in portrait', async () => {
    const { result } = await renderHook(() => useReadableLayout());
    const base = { paddingHorizontal: 16 };
    expect(result.current.gutter).toBe(0);
    expect(result.current.contentWidth).toBe(393);
    expect(result.current.safeAreaStyle).toBeUndefined();
    expect(result.current.contentStyle(base)).toBe(base);
  });

  it('clears side insets and centers content on a wide window', async () => {
    mockWidth = 1100;
    mockInsets = { top: 24, bottom: 20, left: 0, right: 60 };
    const { result } = await renderHook(() => useReadableLayout());
    const gutter = Math.floor((1100 - 60 - READABLE_MAX_WIDTH) / 2);
    expect(result.current.safeRight).toBe(60);
    expect(result.current.safeAreaStyle).toEqual({ paddingRight: 60 });
    expect(result.current.gutter).toBe(gutter);
    expect(result.current.contentWidth).toBe(1100 - 60 - gutter * 2);
    expect(result.current.sidePaddingStyle).toEqual({ paddingRight: 60, minHeight: 110 });
    // Content clears the side inset plus the gutter; the container stays full width.
    expect(result.current.contentStyle(undefined)).toEqual({
      paddingLeft: gutter,
      paddingRight: 60 + gutter,
    });
  });
});

describe('useTabBarInset', () => {
  it('is 0 with the JS tab bar', async () => {
    const { result } = await renderHook(() => useTabBarInset());
    expect(result.current).toBe(0);
  });

  it('is the full bar inset while the glass bar is at the bottom', async () => {
    mockGlass = { ...mockGlass, tabBarGlass: true, tabBarInset: 83 };
    const { result } = await renderHook(() => ({ inset: useTabBarInset(), side: useTabBarSide() }));
    expect(result.current).toEqual({ inset: 83, side: 'bottom' });
  });

  it('drops to the home-indicator inset when the bar is a side rail', async () => {
    mockGlass = {
      tabBarGlass: true,
      tabBarInset: 69,
      windowInsets: { left: 0, right: 54, bottom: 20 },
    };
    mockInsets = { top: 24, bottom: 20, left: 0, right: 54 + 76 };
    const { result } = await renderHook(() => ({ inset: useTabBarInset(), side: useTabBarSide() }));
    expect(result.current).toEqual({ inset: 20, side: 'right' });
  });
});
