import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      surfaceOutline: '#ccc',
      error: '#f00',
      primary: '#00f',
      text: '#000',
    },
  }),
}));

describe('ActionMenu', () => {
  const items: ActionMenuItemDef[] = [
    { label: 'Pause', icon: 'pause', onPress: jest.fn() },
    { label: 'Delete', icon: 'trash', onPress: jest.fn(), destructive: true },
  ];

  afterEach(() => {
    jest.clearAllMocks();
    Object.assign(mockInsets, { top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('does not crash and renders nothing when not visible', async () => {
    await render(<ActionMenu visible={false} onClose={jest.fn()} items={items} />);
    expect(screen.queryByText('Pause')).toBeNull();
  });

  it('renders all item labels when visible', async () => {
    await render(<ActionMenu visible onClose={jest.fn()} items={items} />);
    expect(screen.getByText('Pause')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('renders with an empty items list', async () => {
    await render(<ActionMenu visible onClose={jest.fn()} items={[]} />);
    expect(screen.queryByText('Pause')).toBeNull();
  });

  it('calls onClose when an item is pressed', async () => {
    const onClose = jest.fn();
    await render(<ActionMenu visible onClose={onClose} items={items} />);
    fireEvent.press(screen.getByText('Pause'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls item onPress after delay when item pressed', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    await render(<ActionMenu visible onClose={onClose} items={items} />);
    await fireEvent.press(screen.getByText('Pause'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(items[0].onPress).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    expect(items[0].onPress).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('applies destructive styling path for destructive items without crashing', async () => {
    await render(<ActionMenu visible onClose={jest.fn()} items={items} />);
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('does not render the anchored popover in default (sheet) mode', async () => {
    await render(<ActionMenu visible onClose={jest.fn()} items={items} />);
    expect(screen.queryByTestId('action-menu-popover')).toBeNull();
  });

  describe('anchored popover mode', () => {
    const SCREEN = { width: 390, height: 844, scale: 2, fontScale: 1 };

    beforeEach(() => {
      jest.spyOn(Dimensions, 'get').mockReturnValue(SCREEN);
    });

    afterEach(() => {
      (Dimensions.get as jest.Mock).mockRestore();
    });

    // RNTL 14 fireEvent is async — the setPopoverHeight state update only
    // lands after awaiting it.
    const layoutPopover = async (height: number) => {
      await fireEvent(screen.getByTestId('action-menu-popover'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 230, height } },
      });
    };

    const popoverStyle = () =>
      StyleSheet.flatten(screen.getByTestId('action-menu-popover').props.style);

    it('renders the popover container and all item labels', async () => {
      await render(
        <ActionMenu visible onClose={jest.fn()} items={items} anchor={{ x: 100, y: 200 }} />
      );
      expect(screen.getByTestId('action-menu-popover')).toBeTruthy();
      expect(screen.getByText('Pause')).toBeTruthy();
      expect(screen.getByText('Delete')).toBeTruthy();
    });

    it('renders nothing when not visible even with an anchor', async () => {
      await render(
        <ActionMenu
          visible={false}
          onClose={jest.fn()}
          items={items}
          anchor={{ x: 100, y: 200 }}
        />
      );
      expect(screen.queryByTestId('action-menu-popover')).toBeNull();
    });

    it('is 230pt wide, themed, and hidden until measured', async () => {
      await render(
        <ActionMenu visible onClose={jest.fn()} items={items} anchor={{ x: 100, y: 200 }} />
      );
      const style = popoverStyle();
      expect(style.width).toBe(230);
      expect(style.backgroundColor).toBe('#fff');
      expect(style.borderColor).toBe('#ccc');
      expect(style.borderWidth).toBe(StyleSheet.hairlineWidth);
      expect(style.opacity).toBe(0);

      await layoutPopover(120);
      expect(popoverStyle().opacity).toBe(1);
    });

    it('positions just below the anchor when there is room', async () => {
      await render(
        <ActionMenu visible onClose={jest.fn()} items={items} anchor={{ x: 100, y: 200 }} />
      );
      await layoutPopover(120);
      const style = popoverStyle();
      expect(style.left).toBe(100);
      // anchor.y + 4pt gap
      expect(style.top).toBe(204);
    });

    it('clamps horizontally so the popover stays on screen', async () => {
      await render(
        <ActionMenu visible onClose={jest.fn()} items={items} anchor={{ x: 350, y: 200 }} />
      );
      await layoutPopover(120);
      // screen 390 - margin 8 - width 230 = 152
      expect(popoverStyle().left).toBe(152);
    });

    it('clamps to the left margin for far-left anchors', async () => {
      await render(
        <ActionMenu visible onClose={jest.fn()} items={items} anchor={{ x: -40, y: 200 }} />
      );
      await layoutPopover(120);
      expect(popoverStyle().left).toBe(8);
    });

    it('clamps vertically using the measured height near the bottom edge', async () => {
      await render(
        <ActionMenu visible onClose={jest.fn()} items={items} anchor={{ x: 100, y: 800 }} />
      );
      await layoutPopover(300);
      // screen 844 - margin 8 - height 300 = 536
      expect(popoverStyle().top).toBe(536);
    });

    it('respects safe-area insets when clamping', async () => {
      Object.assign(mockInsets, { top: 59, bottom: 34, left: 0, right: 0 });
      await render(
        <ActionMenu visible onClose={jest.fn()} items={items} anchor={{ x: 100, y: 10 }} />
      );
      await layoutPopover(120);
      const style = popoverStyle();
      // top inset 59 + margin 8 = 67
      expect(style.top).toBe(67);
      // maxHeight = 844 - 59 - 34 - 2*8 = 735, so tall menus scroll
      expect(style.maxHeight).toBe(735);
    });

    it('closes then fires the item action after the delay, as in sheet mode', async () => {
      jest.useFakeTimers();
      const onClose = jest.fn();
      await render(
        <ActionMenu visible onClose={onClose} items={items} anchor={{ x: 100, y: 200 }} />
      );
      await fireEvent.press(screen.getByText('Pause'));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(items[0].onPress).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(150);
      });
      expect(items[0].onPress).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });
});
