import React from 'react';
import { TextInput } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { DesktopToolbar, DesktopToolbarProps } from '@/components/shell/DesktopToolbar';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function baseProps(overrides?: Partial<DesktopToolbarProps>): DesktopToolbarProps {
  return {
    idiom: 'regular',
    title: 'filters.all',
    resultCount: 3,
    searchQuery: '',
    onSearchChange: jest.fn(),
    onClearSearch: jest.fn(),
    sortBy: 'added_on',
    sortDirection: 'desc',
    onSortPress: jest.fn(),
    onAddPress: jest.fn(),
    selectMode: false,
    onToggleSelectMode: jest.fn(),
    searchInputRef: { current: null } as React.RefObject<TextInput | null>,
    sidebarCollapsed: false,
    onToggleSidebar: jest.fn(),
    ...overrides,
  };
}

describe('DesktopToolbar', () => {
  it('renders the title and result count', async () => {
    await render(<DesktopToolbar {...baseProps()} />);
    expect(screen.getByText('filters.all')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders the search input with the current query', async () => {
    await render(<DesktopToolbar {...baseProps({ searchQuery: 'ubuntu' })} />);
    expect(screen.getByDisplayValue('ubuntu')).toBeTruthy();
  });

  it('calls onSearchChange as the user types', async () => {
    const onSearchChange = jest.fn();
    await render(<DesktopToolbar {...baseProps({ onSearchChange })} />);
    fireEvent.changeText(screen.getByPlaceholderText('placeholders.searchTorrents'), 'debian');
    expect(onSearchChange).toHaveBeenCalledWith('debian');
  });

  it('hides the clear-search button when the query is empty', async () => {
    await render(<DesktopToolbar {...baseProps({ searchQuery: '' })} />);
    expect(screen.queryByLabelText('common.clearSearch')).toBeNull();
  });

  it('shows the clear-search button and calls onClearSearch when the query is non-empty', async () => {
    const onClearSearch = jest.fn();
    await render(<DesktopToolbar {...baseProps({ searchQuery: 'ubuntu', onClearSearch })} />);
    fireEvent.press(screen.getByLabelText('common.clearSearch'));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('calls onSortPress when the sort control is pressed', async () => {
    const onSortPress = jest.fn();
    await render(<DesktopToolbar {...baseProps({ onSortPress })} />);
    fireEvent.press(screen.getByLabelText('screens.settings.sortBy'));
    expect(onSortPress).toHaveBeenCalledTimes(1);
  });

  it('shows the active sort label as text on mac', async () => {
    await render(<DesktopToolbar {...baseProps({ idiom: 'mac', sortBy: 'name' })} />);
    expect(screen.getByText('sort.name')).toBeTruthy();
  });

  it('does not show the sort label as text on regular', async () => {
    await render(<DesktopToolbar {...baseProps({ idiom: 'regular', sortBy: 'name' })} />);
    expect(screen.queryByText('sort.name')).toBeNull();
  });

  it('calls onToggleSelectMode when the select-mode button is pressed', async () => {
    const onToggleSelectMode = jest.fn();
    await render(<DesktopToolbar {...baseProps({ onToggleSelectMode })} />);
    fireEvent.press(screen.getByLabelText('screens.torrents.selectMode'));
    expect(onToggleSelectMode).toHaveBeenCalledTimes(1);
  });

  it('labels the select-mode button as Close once select mode is active', async () => {
    await render(<DesktopToolbar {...baseProps({ selectMode: true })} />);
    expect(screen.getByLabelText('common.close')).toBeTruthy();
    expect(screen.queryByLabelText('screens.torrents.selectMode')).toBeNull();
  });

  it('renders the add button and calls onAddPress when not in select mode', async () => {
    const onAddPress = jest.fn();
    await render(<DesktopToolbar {...baseProps({ selectMode: false, onAddPress })} />);
    fireEvent.press(screen.getByLabelText('screens.torrents.addTorrent'));
    expect(onAddPress).toHaveBeenCalledTimes(1);
  });

  it('hides the add button while in select mode', async () => {
    await render(<DesktopToolbar {...baseProps({ selectMode: true })} />);
    expect(screen.queryByLabelText('screens.torrents.addTorrent')).toBeNull();
  });

  it('renders the sidebar-collapse chevron on regular and calls onToggleSidebar', async () => {
    const onToggleSidebar = jest.fn();
    await render(<DesktopToolbar {...baseProps({ idiom: 'regular', onToggleSidebar })} />);
    fireEvent.press(screen.getByLabelText('sidebar.collapse'));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('labels the sidebar chevron as Expand when the sidebar is collapsed', async () => {
    await render(<DesktopToolbar {...baseProps({ idiom: 'regular', sidebarCollapsed: true })} />);
    expect(screen.getByLabelText('sidebar.expand')).toBeTruthy();
  });

  it('does not render the sidebar-collapse chevron on mac (Sidebar.tsx has its own)', async () => {
    await render(<DesktopToolbar {...baseProps({ idiom: 'mac' })} />);
    expect(screen.queryByLabelText('sidebar.collapse')).toBeNull();
    expect(screen.queryByLabelText('sidebar.expand')).toBeNull();
  });
});
