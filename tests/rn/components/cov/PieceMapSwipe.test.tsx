import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PieceMap } from '@/components/PieceMap';
import { SwipeActionsPanel, SWIPE_ACTION_WIDTH } from '@/components/SwipeActionsPanel';
import { mockColors } from '../theme-mock';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
// RNGH 3's RectButton drives presses through a native gesture Jest can't emit;
// a plain touchable with the same onPress contract stands in for it.
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const { TouchableOpacity } = jest.requireActual('react-native');
  return {
    ...actual,
    RectButton: ({
      onPress,
      children,
      style,
    }: {
      onPress: () => void;
      children: React.ReactNode;
      style: object;
    }) => jest.requireActual('react').createElement(TouchableOpacity, { onPress, style }, children),
  };
});

function bars(root: ReturnType<typeof screen.getByTestId>) {
  return (root.children as unknown as { props: { style: object } }[]).map((c) =>
    StyleSheet.flatten(c.props.style),
  ) as { backgroundColor: string; opacity: number }[];
}

describe('PieceMap', () => {
  const renderMap = (props: React.ComponentProps<typeof PieceMap>) =>
    render(
      <View testID="host">
        <PieceMap {...props} />
      </View>,
    );

  it('renders nothing for empty or missing states', async () => {
    await renderMap({ states: null });
    expect(screen.getByTestId('host').children).toHaveLength(0);
    await renderMap({ states: [] });
    expect(screen.getByTestId('host').children).toHaveLength(0);
  });

  it('colors one bar per piece by state', async () => {
    await renderMap({ states: [0, 1, 2] });
    const row = screen.getByTestId('host').children[0] as ReturnType<typeof screen.getByTestId>;
    const b = bars(row);
    expect(b.map((x) => x.backgroundColor)).toEqual([
      mockColors.surfaceOutline,
      mockColors.primary,
      mockColors.success,
    ]);
    expect(b[0].opacity).toBe(0.45);
    expect(b[2].opacity).toBe(1);
  });

  it('accepts a sparse object, ordering numeric keys and skipping bad ones', async () => {
    await renderMap({ states: { '2': 2, '0': 0, x: 1, '1': 1 } });
    const row = screen.getByTestId('host').children[0] as ReturnType<typeof screen.getByTestId>;
    expect(bars(row).map((x) => x.backgroundColor)).toEqual([
      mockColors.surfaceOutline,
      mockColors.primary,
      mockColors.success,
    ]);
  });

  it('downsamples to maxBars, keeping the hottest state per bucket', async () => {
    await renderMap({ states: [0, 0, 0, 1, 2, 0, 0, 0], maxBars: 4 });
    const row = screen.getByTestId('host').children[0] as ReturnType<typeof screen.getByTestId>;
    expect(bars(row).map((x) => x.backgroundColor)).toEqual([
      mockColors.surfaceOutline,
      mockColors.primary,
      mockColors.success,
      mockColors.surfaceOutline,
    ]);
  });
});

describe('SwipeActionsPanel', () => {
  const progress = { value: 1 } as unknown as Parameters<typeof SwipeActionsPanel>[0]['progress'];

  it('renders each action and runs its handler on press', async () => {
    const pause = jest.fn();
    const remove = jest.fn();
    await render(
      <SwipeActionsPanel
        progress={progress}
        side="right"
        radius={12}
        actions={[
          { key: 'pause', icon: 'pause', label: 'Pause', color: '#111', onPress: pause },
          { key: 'delete', icon: 'trash', label: 'Delete', color: '#f00', onPress: remove },
        ]}
      />,
    );
    expect(screen.getByText('Pause')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('sizes the panel to the number of actions on the left side', async () => {
    await render(
      <View testID="host">
        <SwipeActionsPanel
          progress={progress}
          side="left"
          radius={8}
          actions={[{ key: 'a', icon: 'play', label: 'Resume', color: '#0f0', onPress: jest.fn() }]}
        />
      </View>,
    );
    const panel = screen.getByTestId('host').children[0] as unknown as { props: { style: object } };
    expect(StyleSheet.flatten(panel.props.style)).toMatchObject({ width: SWIPE_ACTION_WIDTH });
  });
});
