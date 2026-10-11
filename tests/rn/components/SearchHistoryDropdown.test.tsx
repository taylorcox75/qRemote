import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SearchHistoryDropdown } from '@/components/SearchHistoryDropdown';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors, isDark: false }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const entries = [
  { query: 'pinned one', pinned: true },
  { query: 'ubuntu', pinned: false },
  { query: 'debian', pinned: false },
];

type Props = React.ComponentProps<typeof SearchHistoryDropdown>;

async function renderDropdown(overrides: Partial<Props> = {}) {
  const props: Props = {
    entries,
    onSelect: jest.fn(),
    onTogglePin: jest.fn(),
    onRemove: jest.fn(),
    onClearRecent: jest.fn(),
    ...overrides,
  };
  await render(<SearchHistoryDropdown {...props} />);
  return props;
}

describe('SearchHistoryDropdown', () => {
  it('lists every entry under the title', async () => {
    await renderDropdown();
    expect(screen.getByText('screens.torrents.recentSearches')).toBeTruthy();
    expect(screen.getByText('pinned one')).toBeTruthy();
    expect(screen.getByText('ubuntu')).toBeTruthy();
    expect(screen.getByText('debian')).toBeTruthy();
  });

  it('selects the tapped query', async () => {
    const props = await renderDropdown();
    await fireEvent.press(screen.getByText('ubuntu'));
    expect(props.onSelect).toHaveBeenCalledWith('ubuntu');
  });

  it('pins a recent entry and unpins a pinned one', async () => {
    const props = await renderDropdown();
    const pins = screen.getAllByLabelText('screens.torrents.pinSearch');
    expect(pins).toHaveLength(2);
    await fireEvent.press(pins[0]);
    expect(props.onTogglePin).toHaveBeenCalledWith('ubuntu');

    await fireEvent.press(screen.getByLabelText('screens.torrents.unpinSearch'));
    expect(props.onTogglePin).toHaveBeenCalledWith('pinned one');
  });

  it('removes an entry', async () => {
    const props = await renderDropdown();
    const removes = screen.getAllByLabelText('screens.torrents.removeSearch');
    expect(removes).toHaveLength(3);
    await fireEvent.press(removes[2]);
    expect(props.onRemove).toHaveBeenCalledWith('debian');
  });

  it('clears recent entries from the footer', async () => {
    const props = await renderDropdown();
    await fireEvent.press(screen.getByLabelText('screens.torrents.clearRecentSearches'));
    expect(props.onClearRecent).toHaveBeenCalledTimes(1);
  });

  it('hides the clear footer when only pinned entries remain', async () => {
    await renderDropdown({ entries: [{ query: 'pinned one', pinned: true }] });
    expect(screen.queryByLabelText('screens.torrents.clearRecentSearches')).toBeNull();
  });

  it('explains how searches get saved when there are no entries yet', async () => {
    await renderDropdown({ entries: [] });
    expect(screen.getByText('screens.torrents.recentSearches')).toBeTruthy();
    expect(screen.getByText('screens.torrents.noRecentSearches')).toBeTruthy();
    expect(screen.queryByText('screens.torrents.clearRecentSearches')).toBeNull();
  });

  it('shows no empty-state text once there are entries', async () => {
    await renderDropdown();
    expect(screen.queryByText('screens.torrents.noRecentSearches')).toBeNull();
  });
});
