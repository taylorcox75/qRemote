import React from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import { ActionMenu, ActionMenuItemDef } from '@/components/ActionMenu';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
    fireEvent.press(screen.getByText('Pause'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(items[0].onPress).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(items[0].onPress).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('applies destructive styling path for destructive items without crashing', async () => {
    await render(<ActionMenu visible onClose={jest.fn()} items={items} />);
    expect(screen.getByText('Delete')).toBeTruthy();
  });
});
