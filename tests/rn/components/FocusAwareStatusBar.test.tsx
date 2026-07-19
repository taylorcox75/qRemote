import React from 'react';
import { render } from '@testing-library/react-native';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';

const mockUseIsFocused = jest.fn();
jest.mock('expo-router', () => ({
  useIsFocused: () => mockUseIsFocused(),
}));

jest.mock('expo-status-bar', () => {
  const { Text } = require('react-native');
  return {
    StatusBar: ({ style }: { style: string }) => <Text testID="status-bar">{style}</Text>,
  };
});

describe('FocusAwareStatusBar', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders StatusBar when focused (light-content)', async () => {
    mockUseIsFocused.mockReturnValue(true);
    const { getByTestId } = await render(<FocusAwareStatusBar barStyle="light-content" />);
    expect(getByTestId('status-bar').props.children).toBe('light');
  });

  it('renders StatusBar when focused (dark-content)', async () => {
    mockUseIsFocused.mockReturnValue(true);
    const { getByTestId } = await render(<FocusAwareStatusBar barStyle="dark-content" />);
    expect(getByTestId('status-bar').props.children).toBe('dark');
  });

  it('renders StatusBar for default barStyle', async () => {
    mockUseIsFocused.mockReturnValue(true);
    const { getByTestId } = await render(<FocusAwareStatusBar barStyle="default" />);
    expect(getByTestId('status-bar').props.children).toBe('dark');
  });

  it('renders nothing when not focused', async () => {
    mockUseIsFocused.mockReturnValue(false);
    const { toJSON } = await render(<FocusAwareStatusBar barStyle="light-content" />);
    expect(toJSON()).toBeNull();
  });
});
