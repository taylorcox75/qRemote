// GlassHeaderBackdrop.test.tsx — the header's glass material: renders nothing
// with glass off, follows the app-wide setting unless `glass` overrides it,
// and bleeds up under the status bar / over the header's bottom border.
// GlassSurface is stubbed so these tests pin only the backdrop's own contract.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { GlassHeaderBackdrop } from '@/components/GlassHeaderBackdrop';

let mockEnabled = false;

jest.mock('@/context/LiquidGlassContext', () => ({
  useLiquidGlass: () => ({ enabled: mockEnabled }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/components/GlassSurface', () => ({
  GlassSurface: (props: Record<string, unknown>) => {
    const { View: RNView } = require('react-native');
    return <RNView {...props} testID={props.testID as string} />;
  },
}));

const backdrop = () => screen.queryByTestId('glass-header-backdrop');

beforeEach(() => {
  mockEnabled = false;
});

describe('GlassHeaderBackdrop', () => {
  it('renders nothing while glass is off', async () => {
    await render(<GlassHeaderBackdrop />);
    expect(backdrop()).toBeNull();
  });

  it('follows the app-wide setting when on', async () => {
    mockEnabled = true;
    await render(<GlassHeaderBackdrop />);
    const node = backdrop();
    expect(node).not.toBeNull();
    expect(node?.props.glass).toBe(true);
    expect(node?.props.pointerEvents).toBe('none');
  });

  it('lets the glass prop override the app-wide setting both ways', async () => {
    mockEnabled = true;
    const { rerender } = await render(<GlassHeaderBackdrop glass={false} />);
    expect(backdrop()).toBeNull();
    mockEnabled = false;
    await rerender(<GlassHeaderBackdrop glass />);
    expect(backdrop()).not.toBeNull();
  });

  it('runs edge-to-edge, up under the status bar, and over the bottom border', async () => {
    mockEnabled = true;
    await render(
      <View>
        <GlassHeaderBackdrop borderOverlap={1} />
      </View>,
    );
    expect(StyleSheet.flatten(backdrop()?.props.style)).toMatchObject({
      position: 'absolute',
      left: -4,
      right: -4,
      top: -47 - 4,
      bottom: -1,
    });
  });

  it('ends flush with the header bottom by default', async () => {
    mockEnabled = true;
    await render(<GlassHeaderBackdrop />);
    expect(StyleSheet.flatten(backdrop()?.props.style).bottom).toBe(-0);
  });
});
