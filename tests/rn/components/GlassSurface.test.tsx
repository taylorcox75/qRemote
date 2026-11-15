import React from 'react';
import { Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { GlassSurface } from '@/components/GlassSurface';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors, isDark: true }),
}));

const mockSupport: { available: boolean; GlassView: unknown } = {
  available: false,
  GlassView: null,
};

jest.mock('@/utils/liquidGlass', () => ({
  getLiquidGlassSupport: () => mockSupport,
  shouldUseLiquidGlass: (enabled: boolean | undefined, support: typeof mockSupport) =>
    enabled === true && support.available && support.GlassView !== null,
}));

function FakeGlassView(props: Record<string, unknown>) {
  return <View testID="fake-glass" {...props} />;
}

describe('GlassSurface', () => {
  beforeEach(() => {
    mockSupport.available = false;
    mockSupport.GlassView = null;
  });

  it('renders a plain View with the given style when glass is off', async () => {
    mockSupport.available = true;
    mockSupport.GlassView = FakeGlassView;
    await render(
      <GlassSurface testID="surface" style={{ backgroundColor: 'red' }}>
        <Text>child</Text>
      </GlassSurface>,
    );
    expect(screen.queryByTestId('fake-glass')).toBeNull();
    expect(screen.getByTestId('surface')).toHaveStyle({ backgroundColor: 'red' });
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('falls back to a plain View when glass is requested but unsupported', async () => {
    await render(<GlassSurface glass testID="surface" style={{ backgroundColor: 'red' }} />);
    expect(screen.queryByTestId('fake-glass')).toBeNull();
    expect(screen.getByTestId('surface')).toHaveStyle({ backgroundColor: 'red' });
  });

  it('renders GlassView with a cleared background and the theme scheme when supported', async () => {
    mockSupport.available = true;
    mockSupport.GlassView = FakeGlassView;
    await render(
      <GlassSurface glass style={{ backgroundColor: 'red', borderRadius: 8 }}>
        <Text>child</Text>
      </GlassSurface>,
    );
    const glass = screen.getByTestId('fake-glass');
    expect(glass).toHaveStyle({ backgroundColor: 'transparent', borderRadius: 8 });
    expect(glass.props.colorScheme).toBe('dark');
    expect(glass.props.glassEffectStyle).toBe('regular');
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('tints popover glass with a translucent surface colour unless a tint is given', async () => {
    mockSupport.available = true;
    mockSupport.GlassView = FakeGlassView;
    await render(
      <>
        <GlassSurface glass popover testID="popover" />
        <GlassSurface glass popover tintColor="#ff0000" testID="tinted" />
        <GlassSurface glass testID="plain" />
      </>,
    );
    // FakeGlassView spreads the caller's props, so the given testIDs win.
    const popover = screen.getByTestId('popover');
    const tinted = screen.getByTestId('tinted');
    const plain = screen.getByTestId('plain');
    expect(popover.props.tintColor).toBe('rgba(17, 17, 17, 0.55)');
    expect(tinted.props.tintColor).toBe('#ff0000');
    expect(plain.props.tintColor).toBeUndefined();
  });

  it('applies no tint while glass is off', async () => {
    mockSupport.available = true;
    mockSupport.GlassView = FakeGlassView;
    await render(<GlassSurface glass={false} popover />);
    expect(screen.getByTestId('fake-glass').props.tintColor).toBeUndefined();
  });
});
