import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Sidebar } from '@/components/shell/Sidebar';
import { useShell } from '@/context/ShellContext';
import { useTorrents } from '@/context/TorrentContext';
import { useServer } from '@/context/ServerContext';
import { useRouter, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { TorrentInfo, Category, ServerConfig } from '@/types/api';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@/services/api/application', () => ({
  applicationApi: { getPreferences: jest.fn() },
}));

jest.mock('@/context/ShellContext', () => ({ useShell: jest.fn() }));
jest.mock('@/context/TorrentContext', () => ({ useTorrents: jest.fn() }));
jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));

function torrent(overrides: Partial<TorrentInfo>): TorrentInfo {
  return {
    hash: 'h',
    state: 'downloading',
    progress: 0,
    dlspeed: 0,
    upspeed: 0,
    category: '',
    tags: '',
    ...overrides,
  } as TorrentInfo;
}

const TORRENTS: TorrentInfo[] = [
  torrent({
    hash: 'h1',
    state: 'downloading',
    progress: 0.4,
    dlspeed: 100,
    upspeed: 0,
    category: 'movies',
    tags: 'linux,iso',
  }),
  torrent({
    hash: 'h2',
    state: 'pausedUP',
    progress: 1,
    dlspeed: 0,
    upspeed: 0,
    category: '',
    tags: '',
  }),
  torrent({
    hash: 'h3',
    state: 'uploading',
    progress: 1,
    dlspeed: 0,
    upspeed: 50,
    category: 'movies',
    tags: 'iso',
  }),
];

const CATEGORIES: { [name: string]: Category } = {
  movies: { name: 'movies', savePath: '/downloads/movies' },
};

const SERVER: ServerConfig = {
  id: 's1',
  name: 'Home Server',
} as unknown as ServerConfig;

const navigate = jest.fn();

function mockShell(overrides?: Partial<ReturnType<typeof useShell>>) {
  jest.mocked(useShell).mockReturnValue({
    idiom: 'regular',
    selectedHash: null,
    setSelectedHash: jest.fn(),
    listFilter: { status: 'all', category: null, tags: [] },
    setListFilter: jest.fn(),
    sidebarCollapsed: false,
    toggleSidebar: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useShell>);
}

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useRouter).mockReturnValue({ navigate } as unknown as ReturnType<typeof useRouter>);
    jest.mocked(usePathname).mockReturnValue('/');
    jest.mocked(useQuery).mockReturnValue({
      data: { rss_processing_enabled: false },
    } as unknown as ReturnType<typeof useQuery>);
    jest.mocked(useTorrents).mockReturnValue({
      torrents: TORRENTS,
      categories: CATEGORIES,
      tags: ['linux', 'iso'],
      serverState: null,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      sync: jest.fn(),
      isRecoveringFromBackground: false,
      initialLoadComplete: true,
    } as unknown as ReturnType<typeof useTorrents>);
    jest.mocked(useServer).mockReturnValue({
      currentServer: SERVER,
      isConnected: true,
    } as unknown as ReturnType<typeof useServer>);
    mockShell();
  });

  it('renders the server header', async () => {
    await render(<Sidebar />);
    expect(screen.getByText('Home Server')).toBeTruthy();
  });

  it('renders the always-shown destinations', async () => {
    await render(<Sidebar />);
    expect(screen.getByText('screens.torrents.tabTitle')).toBeTruthy();
    expect(screen.getByText('screens.transfer.title')).toBeTruthy();
    expect(screen.getByText('screens.search.tabTitle')).toBeTruthy();
    expect(screen.getByText('screens.settings.title')).toBeTruthy();
  });

  it('hides RSS when not connected or rss_processing_enabled is off', async () => {
    await render(<Sidebar />);
    expect(screen.queryByText('screens.rss.feedsTitle')).toBeNull();
  });

  it('shows RSS when connected and rss_processing_enabled is on', async () => {
    jest.mocked(useQuery).mockReturnValue({
      data: { rss_processing_enabled: true },
    } as unknown as ReturnType<typeof useQuery>);
    await render(<Sidebar />);
    expect(screen.getByText('screens.rss.feedsTitle')).toBeTruthy();
  });

  it('navigates to a destination route on press', async () => {
    await render(<Sidebar />);
    fireEvent.press(screen.getByText('screens.transfer.title'));
    expect(navigate).toHaveBeenCalledWith('/(tabs)/transfer');
  });

  it('renders status filter rows with counts matching matchesStatusFilter', async () => {
    await render(<Sidebar />);
    // all=3, active=2 (h1 dlspeed>0, h3 upspeed>0), completed=2 (h2, h3 at
    // progress 1), paused=1 (h2 pausedUP), stuck=0, downloading=1, uploading=1.
    // Categories/tags contribute additional '1'/'2' badges, so these assert
    // at-least rather than exact counts; stuck's '0' is asserted exactly
    // since nothing else in the tree renders a bare "0".
    expect(screen.getAllByText('3')).toHaveLength(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('0')).toHaveLength(1);
  });

  it('selecting a status filter updates listFilter and navigates to the torrents tab', async () => {
    const setListFilter = jest.fn();
    mockShell({ setListFilter });
    await render(<Sidebar />);
    fireEvent.press(screen.getByText('filters.downloading'));
    expect(setListFilter).toHaveBeenCalledWith({
      status: 'downloading',
      category: null,
      tags: [],
    });
    expect(navigate).toHaveBeenCalledWith('/(tabs)/(torrents)');
  });

  it('renders categories with counts, including Uncategorized', async () => {
    await render(<Sidebar />);
    expect(screen.getByText('movies')).toBeTruthy();
    expect(screen.getByText('filters.uncategorized')).toBeTruthy();
    expect(screen.getByText('filters.allCategories')).toBeTruthy();
  });

  it('selecting a category sets it in listFilter', async () => {
    const setListFilter = jest.fn();
    mockShell({ setListFilter });
    await render(<Sidebar />);
    fireEvent.press(screen.getByText('movies'));
    expect(setListFilter).toHaveBeenCalledWith({ status: 'all', category: 'movies', tags: [] });
  });

  it('pressing the already-active category clears it', async () => {
    const setListFilter = jest.fn();
    mockShell({ setListFilter, listFilter: { status: 'all', category: 'movies', tags: [] } });
    await render(<Sidebar />);
    fireEvent.press(screen.getByText('movies'));
    expect(setListFilter).toHaveBeenCalledWith({ status: 'all', category: null, tags: [] });
  });

  it('renders tags with counts, including Untagged', async () => {
    await render(<Sidebar />);
    expect(screen.getByText('linux')).toBeTruthy();
    expect(screen.getByText('iso')).toBeTruthy();
    expect(screen.getByText('filters.untagged')).toBeTruthy();
  });

  it('toggling a tag adds it to listFilter.tags', async () => {
    const setListFilter = jest.fn();
    mockShell({ setListFilter });
    await render(<Sidebar />);
    fireEvent.press(screen.getByText('linux'));
    expect(setListFilter).toHaveBeenCalledWith({ status: 'all', category: null, tags: ['linux'] });
  });

  it('collapsing the destinations section hides its rows', async () => {
    await render(<Sidebar />);
    expect(screen.getByText('screens.transfer.title')).toBeTruthy();
    fireEvent.press(screen.getByText('sidebar.sections.destinations'));
    await waitFor(() => expect(screen.queryByText('screens.transfer.title')).toBeNull());
  });
});
