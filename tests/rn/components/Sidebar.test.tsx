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
jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));
jest.mock('@/services/api/categories', () => ({
  categoriesApi: { addCategory: jest.fn(), editCategory: jest.fn(), removeCategories: jest.fn() },
}));
jest.mock('@/services/api/tags', () => ({
  tagsApi: { createTags: jest.fn(), deleteTags: jest.fn() },
}));

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
    listFilter: { status: 'all', category: null, tags: [], tracker: null },
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

  it('does not render the collapse chevron on regular (iPad)', async () => {
    await render(<Sidebar />);
    expect(screen.queryByLabelText('sidebar.collapse')).toBeNull();
  });

  it('hides the server header entirely on regular when there is no current server', async () => {
    jest.mocked(useServer).mockReturnValue({
      currentServer: null,
      isConnected: false,
    } as unknown as ReturnType<typeof useServer>);
    await render(<Sidebar />);
    expect(screen.queryByText('Home Server')).toBeNull();
    expect(screen.queryByLabelText('sidebar.collapse')).toBeNull();
  });

  it('renders the collapse chevron on mac', async () => {
    mockShell({ idiom: 'mac' });
    await render(<Sidebar />);
    expect(screen.getByLabelText('sidebar.collapse')).toBeTruthy();
  });

  it('keeps the traffic-light row (with collapse) visible on mac even without a current server', async () => {
    mockShell({ idiom: 'mac' });
    jest.mocked(useServer).mockReturnValue({
      currentServer: null,
      isConnected: false,
    } as unknown as ReturnType<typeof useServer>);
    await render(<Sidebar />);
    expect(screen.getByLabelText('sidebar.collapse')).toBeTruthy();
  });

  it('calls toggleSidebar when the mac chevron is pressed', async () => {
    const toggleSidebar = jest.fn();
    mockShell({ idiom: 'mac', toggleSidebar });
    await render(<Sidebar />);
    fireEvent.press(screen.getByLabelText('sidebar.collapse'));
    expect(toggleSidebar).toHaveBeenCalledTimes(1);
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

  it('renders Pogona status filter rows', async () => {
    await render(<Sidebar />);
    expect(screen.getByText('sidebar.status.all')).toBeTruthy();
    expect(screen.getByText('sidebar.status.downloading')).toBeTruthy();
    expect(screen.getByText('sidebar.status.seeding')).toBeTruthy();
    expect(screen.getByText('sidebar.status.running')).toBeTruthy();
    expect(screen.getByText('sidebar.status.stalled')).toBeTruthy();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('selecting a status filter updates listFilter and navigates to the torrents tab', async () => {
    const setListFilter = jest.fn();
    mockShell({ setListFilter });
    await render(<Sidebar />);
    fireEvent.press(screen.getByText('sidebar.status.downloading'));
    expect(setListFilter).toHaveBeenCalledWith({
      status: 'downloading',
      category: null,
      tags: [],
      tracker: null,
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
    expect(setListFilter).toHaveBeenCalledWith({
      status: 'all',
      category: 'movies',
      tags: [],
      tracker: null,
    });
  });

  it('pressing the already-active category clears it', async () => {
    const setListFilter = jest.fn();
    mockShell({
      setListFilter,
      listFilter: { status: 'all', category: 'movies', tags: [], tracker: null },
    });
    await render(<Sidebar />);
    fireEvent.press(screen.getByText('movies'));
    expect(setListFilter).toHaveBeenCalledWith({
      status: 'all',
      category: null,
      tags: [],
      tracker: null,
    });
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
    expect(setListFilter).toHaveBeenCalledWith({
      status: 'all',
      category: null,
      tags: ['linux'],
      tracker: null,
    });
  });

  it('collapsing the destinations section hides its rows', async () => {
    await render(<Sidebar />);
    expect(screen.getByText('screens.transfer.title')).toBeTruthy();
    fireEvent.press(screen.getByText('sidebar.sections.destinations'));
    await waitFor(() => expect(screen.queryByText('screens.transfer.title')).toBeNull());
  });
});
