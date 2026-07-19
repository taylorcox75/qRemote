import React from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import { Toast } from '@/components/Toast';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock.tsx').default
);

describe('Toast', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the message', async () => {
    await render(<Toast message="Hello world" />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it.each(['success', 'error', 'warning', 'info'] as const)(
    'renders %s type with its icon/color',
    async (type) => {
      const { toJSON } = await render(<Toast message="msg" type={type} />);
      expect(toJSON()).toBeTruthy();
    }
  );

  it('calls onHide when the toast body is pressed', async () => {
    jest.useFakeTimers();
    const onHide = jest.fn();
    await render(<Toast message="Press me" onHide={onHide} duration={9999} />);
    fireEvent.press(screen.getByText('Press me'));
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onHide).toHaveBeenCalled();
  });

  it('calls onHide when the close icon is pressed', async () => {
    jest.useFakeTimers();
    const onHide = jest.fn();
    await render(<Toast message="Closeable" onHide={onHide} duration={9999} />);
    fireEvent.press(screen.getByLabelText('common.close'));
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onHide).toHaveBeenCalled();
  });

  it('auto-hides after duration elapses', async () => {
    jest.useFakeTimers();
    const onHide = jest.fn();
    await render(<Toast message="Auto" onHide={onHide} duration={1000} />);
    act(() => {
      jest.advanceTimersByTime(1000 + 300);
    });
    expect(onHide).toHaveBeenCalled();
  });
});
