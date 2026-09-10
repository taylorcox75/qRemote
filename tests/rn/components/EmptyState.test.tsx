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
      <EmptyState title="Empty" actionLabel="Retry" actionIcon="refresh" onAction={onAction} />,
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

// EmptyState reads Platform.isMacCatalyst into a module-level const (same
// pattern as components/SettingRow.tsx), so exercising the mac layout needs
// a fresh module graph with Platform.isMacCatalyst already true at require
// time - a per-test Platform mock after the fact wouldn't be observed.
describe('EmptyState on Mac Catalyst', () => {
  beforeEach(() => {
    jest.resetModules();
    // Mock only the Platform submodule (not the whole 'react-native' package)
    // so the jest-expo preset's own native-module mocks (DevMenu, etc.) stay
    // intact - spreading jest.requireActual('react-native') eagerly evaluates
    // every lazy getter on the module (FlatList included), which reaches
    // real native modules the preset never wired up for tests.
    jest.doMock('react-native/Libraries/Utilities/Platform', () => {
      const ActualPlatform = jest.requireActual('react-native/Libraries/Utilities/Platform');
      return { ...ActualPlatform, OS: 'ios', isPad: false, isMacCatalyst: true };
    });
    jest.doMock('@/context/ThemeContext', () => ({
      useTheme: () => ({ colors: require('./theme-mock').mockColors }),
    }));
  });

  afterEach(() => {
    jest.dontMock('react-native/Libraries/Utilities/Platform');
    jest.dontMock('@/context/ThemeContext');
  });

  it('renders the denser mac layout with title colored as textSecondary', async () => {
    // Re-require only the component (EmptyState has no hooks of its own, so a
    // freshly evaluated React/react-native module graph underneath it is
    // safe to render with the outer testing-library instance). Re-requiring
    // '@testing-library/react-native' itself here would re-run its top-level
    // afterEach/beforeAll/afterAll registration from inside this `it`, which
    // jest-circus rejects ("Hooks cannot be defined inside tests").
    const { EmptyState: MacEmptyState } = require('@/components/EmptyState');
    await render(<MacEmptyState title="Mac Empty" subtitle="Mac subtitle" icon="alert" />);
    expect(screen.getByText('Mac Empty')).toBeTruthy();
    expect(screen.getByText('Mac subtitle')).toBeTruthy();
  });
});
