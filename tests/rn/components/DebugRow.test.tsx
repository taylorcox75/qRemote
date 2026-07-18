import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { DebugRow } from '@/components/DebugRow';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('DebugRow', () => {
  it('renders label and value', async () => {
    await render(<DebugRow label="Host" value="192.168.1.1" />);
    expect(screen.getByText('Host')).toBeTruthy();
    expect(screen.getByText('192.168.1.1')).toBeTruthy();
  });

  it('renders with selectable and numberOfLines props', async () => {
    await render(<DebugRow label="Token" value="abc123" selectable numberOfLines={1} />);
    expect(screen.getByText('abc123')).toBeTruthy();
  });

  it('renders empty value without crashing', async () => {
    const { toJSON } = await render(<DebugRow label="Empty" value="" />);
    expect(toJSON()).toBeTruthy();
  });
});
