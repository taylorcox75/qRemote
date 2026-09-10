import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { StatusBadge } from '@/components/StatusBadge';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('StatusBadge', () => {
  it('renders the label', async () => {
    await render(<StatusBadge label="Downloading" tint="#0af" />);
    expect(screen.getByText('Downloading')).toBeTruthy();
  });

  it('applies the tint to the label color', async () => {
    await render(<StatusBadge label="Seeding" tint="#00ff00" />);
    const label = screen.getByText('Seeding');
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ color: '#00ff00' });
  });

  it('fills the badge at 0.14 alpha and borders it at 0.22 alpha of the tint', async () => {
    await render(<StatusBadge label="Paused" tint="#ff0000" />);
    const label = screen.getByText('Paused');
    const badge = label.parent;
    expect(StyleSheet.flatten(badge?.props.style)).toMatchObject({
      backgroundColor: 'rgba(255, 0, 0, 0.14)',
      borderColor: 'rgba(255, 0, 0, 0.22)',
      borderWidth: 1,
    });
  });

  it('merges a custom style onto the badge', async () => {
    await render(<StatusBadge label="Error" tint="#ff0000" style={{ marginLeft: 8 }} />);
    const label = screen.getByText('Error');
    const badge = label.parent;
    expect(StyleSheet.flatten(badge?.props.style)).toMatchObject({ marginLeft: 8 });
  });

  it('limits the label to a single line', async () => {
    await render(<StatusBadge label="Stalled Downloading" tint="#0af" />);
    const label = screen.getByText('Stalled Downloading');
    expect(label.props.numberOfLines).toBe(1);
  });
});
