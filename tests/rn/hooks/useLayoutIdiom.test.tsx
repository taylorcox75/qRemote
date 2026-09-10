import { renderHook } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Platform } from 'react-native';
import { getLayoutIdiom, useLayoutIdiom } from '@/hooks/useLayoutIdiom';

describe('getLayoutIdiom', () => {
  it('returns compact for an iPhone width', () => {
    expect(getLayoutIdiom(390, false, false)).toBe('compact');
  });

  it('returns regular for a full-width iPad', () => {
    expect(getLayoutIdiom(744, true, false)).toBe('regular');
  });

  it('returns compact for an iPad slide-over width', () => {
    expect(getLayoutIdiom(320, true, false)).toBe('compact');
  });

  it('returns regular for a large iPad width', () => {
    expect(getLayoutIdiom(1024, true, false)).toBe('regular');
  });

  it('returns mac for any width when isMacCatalyst is true', () => {
    expect(getLayoutIdiom(100, false, true)).toBe('mac');
    expect(getLayoutIdiom(2000, false, true)).toBe('mac');
    expect(getLayoutIdiom(390, true, true)).toBe('mac');
  });

  it('never returns regular for an iPhone, even in landscape width', () => {
    expect(getLayoutIdiom(926, false, false)).toBe('compact');
  });
});

describe('useLayoutIdiom', () => {
  const originalIsPad = Platform.OS === 'ios' ? Platform.isPad : undefined;
  const originalIsMacCatalyst = Platform.OS === 'ios' ? Platform.isMacCatalyst : undefined;

  afterEach(() => {
    Object.defineProperty(Platform, 'isPad', {
      value: originalIsPad,
      configurable: true,
    });
    Object.defineProperty(Platform, 'isMacCatalyst', {
      value: originalIsMacCatalyst,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  function mockDimensions(width: number) {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width,
      height: 800,
      scale: 2,
      fontScale: 1,
    });
  }

  it('returns compact on an iPhone-sized window', async () => {
    mockDimensions(390);
    Object.defineProperty(Platform, 'isPad', { value: false, configurable: true });
    Object.defineProperty(Platform, 'isMacCatalyst', { value: false, configurable: true });

    const { result } = await renderHook(() => useLayoutIdiom());

    expect(result.current).toBe('compact');
  });

  it('returns regular on an iPad-sized window', async () => {
    mockDimensions(1024);
    Object.defineProperty(Platform, 'isPad', { value: true, configurable: true });
    Object.defineProperty(Platform, 'isMacCatalyst', { value: false, configurable: true });

    const { result } = await renderHook(() => useLayoutIdiom());

    expect(result.current).toBe('regular');
  });

  it('returns mac when running under Mac Catalyst', async () => {
    mockDimensions(1200);
    Object.defineProperty(Platform, 'isPad', { value: false, configurable: true });
    Object.defineProperty(Platform, 'isMacCatalyst', { value: true, configurable: true });

    const { result } = await renderHook(() => useLayoutIdiom());

    expect(result.current).toBe('mac');
  });
});
