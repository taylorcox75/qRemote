import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { EmptyState } from '@/components/EmptyState';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('EmptyState', () => {
  it('renders with no props (all optional)', async () => {
    const { toJSON } = await render(<EmptyState />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders title and subtitle', async () => {
    await render(<EmptyState title="Nothing here" subtitle="Try again later" icon="alert" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByText('Try again later')).toBeTruthy();
  });

  it('renders action button and fires onAction', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState title="Empty" actionLabel="Retry" actionIcon="refresh" onAction={onAction} />
    );
    fireEvent.press(screen.getByText('Retry'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button without onAction', async () => {
    await render(<EmptyState title="Empty" actionLabel="Retry" />);
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('renders compact layout', async () => {
    await render(<EmptyState title="Compact" subtitle="sub" compact />);
    expect(screen.getByText('Compact')).toBeTruthy();
  });

  it('applies custom iconColor and iconSize', async () => {
    await render(<EmptyState icon="warning" iconColor="#f00" iconSize={20} title="Warn" />);
    expect(screen.getByText('Warn')).toBeTruthy();
  });
});
