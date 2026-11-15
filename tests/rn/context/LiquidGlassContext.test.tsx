// LiquidGlassContext.test.tsx — the `liquidGlassEnabled` preference (default
// on), the queued save, availability gating, the latched native tab bar, and
// the iOS Reduce Transparency / Increase Contrast fallback to solid surfaces.
import React from 'react';
import { AccessibilityInfo, Appearance } from 'react-native';
import { render, waitFor, act } from '@testing-library/react-native';
import { LiquidGlassProvider, useLiquidGlass } from '@/context/LiquidGlassContext';

const mockSupport = { available: true, GlassView: null as unknown };
let mockThemeMode = 'dark';
let mockStored: Record<string, unknown> | Error = {};
const mockGetPreferences = jest.fn();
const mockUpdatePreferences = jest.fn(async (_patch: Record<string, unknown>) => undefined);

jest.mock('@/utils/liquidGlass', () => ({
  ...jest.requireActual('@/utils/liquidGlass'),
  getLiquidGlassSupport: () => mockSupport,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ themeMode: mockThemeMode }),
}));

jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: () => mockGetPreferences(),
    updatePreferences: (patch: Record<string, unknown>) => mockUpdatePreferences(patch),
  },
}));

type Ctx = ReturnType<typeof useLiquidGlass>;
let latest: Ctx;
function Probe({ onRender }: { onRender: (ctx: Ctx) => void }) {
  onRender(useLiquidGlass());
  return null;
}
const captureLatest = (ctx: Ctx) => {
  latest = ctx;
};

const handlers: Record<string, (on: boolean) => void> = {};
const removers: jest.Mock[] = [];
let reduceTransparency = false;
let darkerColors = false;
let setColorScheme: jest.SpyInstance;

beforeEach(() => {
  mockSupport.available = true;
  mockThemeMode = 'dark';
  mockStored = {};
  reduceTransparency = false;
  darkerColors = false;
  removers.length = 0;
  for (const k of Object.keys(handlers)) delete handlers[k];
  mockGetPreferences.mockReset();
  mockGetPreferences.mockImplementation(async () => {
    if (mockStored instanceof Error) throw mockStored;
    return mockStored;
  });
  mockUpdatePreferences.mockClear();
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockImplementation(async () => reduceTransparency);
  jest
    .spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled')
    .mockImplementation(async () => darkerColors);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
    event: string,
    handler: (on: boolean) => void,
  ) => {
    handlers[event] = handler;
    const remove = jest.fn();
    removers.push(remove);
    return { remove };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
  setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

async function mount() {
  const result = await render(
    <LiquidGlassProvider>
      <Probe onRender={captureLatest} />
    </LiquidGlassProvider>,
  );
  await waitFor(() => expect(latest.loaded).toBe(true));
  return result;
}

describe('LiquidGlassContext', () => {
  it('reads as fully off outside the provider', async () => {
    await render(<Probe onRender={captureLatest} />);
    expect(latest).toMatchObject({
      available: false,
      preference: false,
      enabled: false,
      tabBarGlass: false,
      loaded: true,
    });
  });

  it('defaults on when the stored preferences have no liquidGlassEnabled key', async () => {
    await mount();
    expect(latest).toMatchObject({
      available: true,
      preference: true,
      enabled: true,
      tabBarGlass: true,
    });
    expect(setColorScheme).toHaveBeenCalledWith('dark');
  });

  it('honors a stored false: no glass and the JS tab bar', async () => {
    mockStored = { liquidGlassEnabled: false };
    await mount();
    expect(latest).toMatchObject({ preference: false, enabled: false, tabBarGlass: false });
    expect(setColorScheme).not.toHaveBeenCalled();
  });

  it('falls back to the default when reading preferences fails', async () => {
    mockStored = new Error('storage broke');
    await mount();
    expect(latest.tabBarGlass).toBe(true);
  });

  it('leaves the window scheme unspecified for theme mode "system"', async () => {
    mockThemeMode = 'system';
    await mount();
    expect(setColorScheme).toHaveBeenCalledWith('unspecified');
  });

  it('is off without reading anything where glass is unavailable', async () => {
    mockSupport.available = false;
    await mount();
    expect(latest).toMatchObject({ available: false, enabled: false, tabBarGlass: false });
    expect(mockGetPreferences).not.toHaveBeenCalled();
    expect(Object.keys(handlers)).toHaveLength(0);
  });

  it('saves the toggle through the queued updatePreferences, keeping the tab bar latched', async () => {
    await mount();
    await act(async () => {
      await latest.setPreference(false);
    });
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ liquidGlassEnabled: false });
    expect(latest).toMatchObject({ preference: false, enabled: false, tabBarGlass: true });

    await act(async () => {
      await latest.setPreference(true);
    });
    expect(latest.enabled).toBe(true);
  });

  it('draws solid surfaces when Reduce Transparency is already on', async () => {
    reduceTransparency = true;
    await mount();
    await waitFor(() => expect(latest.enabled).toBe(false));
    expect(latest.preference).toBe(true);
  });

  it('draws solid surfaces when Increase Contrast is already on', async () => {
    darkerColors = true;
    await mount();
    await waitFor(() => expect(latest.enabled).toBe(false));
  });

  it('follows live Reduce Transparency / Increase Contrast changes', async () => {
    await mount();
    expect(latest.enabled).toBe(true);

    await act(async () => handlers.reduceTransparencyChanged(true));
    expect(latest.enabled).toBe(false);
    await act(async () => handlers.reduceTransparencyChanged(false));
    expect(latest.enabled).toBe(true);

    await act(async () => handlers.darkerSystemColorsChanged(true));
    expect(latest.enabled).toBe(false);
    // The tab bar is never swapped by an accessibility change.
    expect(latest.tabBarGlass).toBe(true);
  });

  it('removes its accessibility listeners on unmount', async () => {
    const { unmount } = await mount();
    expect(removers).toHaveLength(2);
    await act(async () => unmount());
    removers.forEach((remove) => expect(remove).toHaveBeenCalled());
  });
});
