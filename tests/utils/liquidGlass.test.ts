import {
  GlassEffectModule,
  LiquidGlassDeps,
  NO_LIQUID_GLASS,
  getLiquidGlassSupport,
  isGlassAllowedByAccessibility,
  resolveLiquidGlassSupport,
  shouldUseLiquidGlass,
} from '@/utils/liquidGlass';
import { DEFAULT_PREFERENCES } from '@/types/preferences';

const FakeGlassView = (() => null) as unknown as NonNullable<GlassEffectModule['GlassView']>;

function deps(overrides: Partial<LiquidGlassDeps> = {}, mod: GlassEffectModule = {}) {
  const loadModule = jest.fn(() => ({
    GlassView: FakeGlassView,
    isLiquidGlassAvailable: () => true,
    isGlassEffectAPIAvailable: () => true,
    ...mod,
  }));
  return {
    platformOS: () => 'ios',
    hasNativeModule: () => true,
    loadModule,
    ...overrides,
  };
}

describe('resolveLiquidGlassSupport', () => {
  it('is available on iOS 26 with the native module linked', () => {
    expect(resolveLiquidGlassSupport(deps())).toEqual({
      available: true,
      GlassView: FakeGlassView,
    });
  });

  it('is unavailable off iOS', () => {
    expect(resolveLiquidGlassSupport(deps({ platformOS: () => 'android' }))).toBe(NO_LIQUID_GLASS);
  });

  it('never loads the package when the native module is missing (old binary via OTA)', () => {
    const d = deps({ hasNativeModule: () => false });
    expect(resolveLiquidGlassSupport(d)).toBe(NO_LIQUID_GLASS);
    expect(d.loadModule).not.toHaveBeenCalled();
  });

  it('is unavailable before iOS 26', () => {
    expect(resolveLiquidGlassSupport(deps({}, { isLiquidGlassAvailable: () => false }))).toBe(
      NO_LIQUID_GLASS,
    );
  });

  it('is unavailable on iOS 26 betas without the glass API', () => {
    expect(resolveLiquidGlassSupport(deps({}, { isGlassEffectAPIAvailable: () => false }))).toBe(
      NO_LIQUID_GLASS,
    );
  });

  it('is unavailable when the module lacks an expected export', () => {
    expect(resolveLiquidGlassSupport(deps({}, { isGlassEffectAPIAvailable: undefined }))).toBe(
      NO_LIQUID_GLASS,
    );
    expect(resolveLiquidGlassSupport(deps({}, { isLiquidGlassAvailable: undefined }))).toBe(
      NO_LIQUID_GLASS,
    );
    expect(resolveLiquidGlassSupport(deps({}, { GlassView: undefined }))).toBe(NO_LIQUID_GLASS);
  });

  it('swallows throws from any step', () => {
    const boom = () => {
      throw new Error('native view not found');
    };
    expect(resolveLiquidGlassSupport(deps({ platformOS: boom }))).toBe(NO_LIQUID_GLASS);
    expect(resolveLiquidGlassSupport(deps({ hasNativeModule: boom }))).toBe(NO_LIQUID_GLASS);
    expect(resolveLiquidGlassSupport(deps({ loadModule: boom }))).toBe(NO_LIQUID_GLASS);
    expect(resolveLiquidGlassSupport(deps({}, { isLiquidGlassAvailable: boom }))).toBe(
      NO_LIQUID_GLASS,
    );
  });
});

describe('shouldUseLiquidGlass', () => {
  const supported = { available: true, GlassView: FakeGlassView };

  it('requires both the preference and support', () => {
    expect(shouldUseLiquidGlass(true, supported)).toBe(true);
    expect(shouldUseLiquidGlass(false, supported)).toBe(false);
    expect(shouldUseLiquidGlass(undefined, supported)).toBe(false);
    expect(shouldUseLiquidGlass(true, NO_LIQUID_GLASS)).toBe(false);
  });
});

describe('getLiquidGlassSupport', () => {
  it('falls back safely where react-native / native modules are absent (node)', () => {
    expect(getLiquidGlassSupport()).toBe(NO_LIQUID_GLASS);
    expect(shouldUseLiquidGlass(true)).toBe(false);
  });
});

describe('isGlassAllowedByAccessibility', () => {
  it('allows glass only when neither Reduce Transparency nor Increase Contrast is on', () => {
    expect(
      isGlassAllowedByAccessibility({ reduceTransparency: false, increaseContrast: false }),
    ).toBe(true);
    expect(
      isGlassAllowedByAccessibility({ reduceTransparency: true, increaseContrast: false }),
    ).toBe(false);
    expect(
      isGlassAllowedByAccessibility({ reduceTransparency: false, increaseContrast: true }),
    ).toBe(false);
    expect(
      isGlassAllowedByAccessibility({ reduceTransparency: true, increaseContrast: true }),
    ).toBe(false);
  });
});

describe('liquidGlassEnabled preference', () => {
  it('defaults on', () => {
    expect(DEFAULT_PREFERENCES.liquidGlassEnabled).toBe(true);
  });

  it('has replaced the old liquidGlassPreview key', () => {
    expect(DEFAULT_PREFERENCES).not.toHaveProperty('liquidGlassPreview');
  });
});
