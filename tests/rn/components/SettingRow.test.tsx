import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SettingRow } from '@/components/SettingRow';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('SettingRow', () => {
  it('renders label only', async () => {
    await render(<SettingRow label="My Setting" />);
    expect(screen.getByText('My Setting')).toBeTruthy();
  });

  it('renders hint when provided', async () => {
    await render(<SettingRow label="My Setting" hint="Some hint" />);
    expect(screen.getByText('Some hint')).toBeTruthy();
  });

  it('renders icon when provided', async () => {
    const { toJSON } = await render(<SettingRow label="Icon row" icon="settings" iconColor="#f00" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders children in right slot', async () => {
    await render(
      <SettingRow label="Row">
        <Text>right-slot</Text>
      </SettingRow>
    );
    expect(screen.getByText('right-slot')).toBeTruthy();
  });
});
