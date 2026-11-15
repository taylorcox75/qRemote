// TorrentsScreen.header.test.tsx — header popovers vs. list scrolling, and
// bulk selection across a server switch, in app/(tabs)/(torrents)/index.tsx.
// Mocks mirror TorrentsScreen.test.tsx; TorrentCard is stubbed so a minimal
// torrent object is enough to mount the FlatList.
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import TorrentsScreen from '@/app/(tabs)/(torrents)/index';
import { ServerConfig } from '@/types/api';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useIsFocused: () => true,
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    // Real useFocusEffect re-runs on every focus; for these tests a single
    // run on mount is enough to populate the state the panel reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
}));

// The real ReanimatedSwipeable needs Reanimated's UI runtime, which Jest
// doesn't have; these tests never swipe, so render the row as-is.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../components/theme-mock').mockColors, isDark: false }),
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn(), setToastTopOffset: jest.fn() }),
}));

const mockUseTorrents = jest.fn();
jest.mock('@/context/TorrentContext', () => ({
  useTorrents: () => mockUseTorrents(),
}));

const mockUseServer = jest.fn();
jest.mock('@/context/ServerContext', () => ({
  useServer: () => mockUseServer(),
}));

jest.mock('@/hooks/useTorrentActions', () => ({
  useTorrentActions: () => ({
    loading: false,
    actionMenuItems: [],
    dlLimitModalVisible: false,
    setDlLimitModalVisible: jest.fn(),
    handleSetDownloadLimit: jest.fn(),
    dlLimitDefaultValue: '0',
    ulLimitModalVisible: false,
    setUlLimitModalVisible: jest.fn(),
    handleSetUploadLimit: jest.fn(),
    ulLimitDefaultValue: '0',
    deleteConfirmVisible: false,
    setDeleteConfirmVisible: jest.fn(),
    handleConfirmDelete: jest.fn(),
  }),
}));

jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn().mockResolvedValue({}),
    savePreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/api/application', () => ({
  applicationApi: { getPreferences: jest.fn().mockResolvedValue({}) },
}));

jest.mock('@/services/api/client', () => ({
  apiClient: { getApiFeatures: jest.fn().mockReturnValue({}) },
}));

const mockGetServers = jest.fn();
jest.mock('@/services/server-manager', () => ({
  ServerManager: { getServers: (...args: unknown[]) => mockGetServers(...args) },
}));

// Stub out QuickConnectPanel so we can assert on the exact props the screen
// passes it (savedServers, connectingId) without depending on its own markup.
jest.mock('@/components/QuickConnectPanel', () => {
  const RN = require('react-native');
  return {
    QuickConnectPanel: (props: {
      savedServers: ServerConfig[];
      connectingId: string | null;
      onConnect: (server: ServerConfig) => void;
    }) => (
      <RN.View testID="quick-connect-panel">
        <RN.Text testID="connecting-id">{props.connectingId ?? 'none'}</RN.Text>
        {props.savedServers.map((s) => (
          <RN.TouchableOpacity
            key={s.id}
            testID={`connect-${s.id}`}
            onPress={() => props.onConnect(s)}
          >
            <RN.Text>{s.name}</RN.Text>
          </RN.TouchableOpacity>
        ))}
      </RN.View>
    ),
  };
});

// Stub out SkeletonTorrentCard so the skeleton branch is trivially detectable.
jest.mock('@/components/SkeletonLoader', () => {
  const RN = require('react-native');
  return {
    SkeletonTorrentCard: () => <RN.View testID="skeleton-torrent-card" />,
  };
});

jest.mock('@/components/TorrentCard', () => {
  const RN = require('react-native');
  return { TorrentCard: () => <RN.View testID="torrent-card" /> };
});

jest.mock('@/components/ServerIconBadge', () => ({ ServerIconBadge: () => null }));

const serverA: ServerConfig = { id: 'a', name: 'A', host: 'a.local', username: 'u', password: 'p' };
const serverB: ServerConfig = { id: 'b', name: 'B', host: 'b.local', username: 'u', password: 'p' };

const torrent = {
  hash: 'h1',
  name: 'Ubuntu',
  state: 'downloading',
  progress: 0.5,
  size: 100,
  added_on: 1,
  dlspeed: 0,
  upspeed: 0,
  ratio: 0,
  eta: 0,
  category: '',
  tags: '',
};

const connectedServer = (server: ServerConfig) => ({
  isConnected: true,
  isLoading: false,
  isConnecting: false,
  isReconnecting: false,
  connectToServer: jest.fn(),
  currentServer: server,
});

describe('TorrentsScreen — header popovers and server switch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServers.mockResolvedValue([serverA, serverB]);
    mockUseTorrents.mockReturnValue({
      torrents: [torrent],
      categories: [],
      tags: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      isRecoveringFromBackground: false,
      initialLoadComplete: true,
    });
  });

  it('closes an open sort menu when the list starts scrolling', async () => {
    mockUseServer.mockReturnValue(connectedServer(serverA));
    await render(<TorrentsScreen />);

    fireEvent.press(await screen.findByTestId('torrents-sort-button'));
    await waitFor(() => expect(screen.getByTestId('torrents-sort-menu')).toBeTruthy());

    fireEvent(screen.getByTestId('torrents-list'), 'scrollBeginDrag', {
      nativeEvent: { contentOffset: { y: 0 } },
    });
    await waitFor(() => expect(screen.queryByTestId('torrents-sort-menu')).toBeNull());
  });

  it('leaves select mode when a different server connects, but not on a same-server reconnect', async () => {
    let server = connectedServer(serverA);
    mockUseServer.mockImplementation(() => server);
    const view = await render(<TorrentsScreen />);

    fireEvent.press(await screen.findByLabelText('screens.torrents.selectMode'));
    await waitFor(() => expect(screen.queryByLabelText('screens.torrents.selectMode')).toBeNull());

    // Drop and restore the same server — selection survives.
    server = { ...connectedServer(serverA), isConnected: false };
    await view.rerender(<TorrentsScreen />);
    server = connectedServer(serverA);
    await view.rerender(<TorrentsScreen />);
    expect(screen.queryByLabelText('screens.torrents.selectMode')).toBeNull();

    // Switch to another server — selection is cleared.
    server = connectedServer(serverB);
    await view.rerender(<TorrentsScreen />);
    await waitFor(() => expect(screen.getByLabelText('screens.torrents.selectMode')).toBeTruthy());
  });

  it('pins the header in-flow when the solid pinned header setting is on', async () => {
    const { storageService } = require('@/services/storage');
    const { StyleSheet } = require('react-native');
    const listPaddingTop = () =>
      StyleSheet.flatten(screen.getByTestId('torrents-list').props.contentContainerStyle)
        .paddingTop;
    mockUseServer.mockReturnValue(connectedServer(serverA));

    // Off (default): the overlay header reserves its measured height (136).
    await render(<TorrentsScreen />);
    await waitFor(() => expect(listPaddingTop()).toBe(136));
    screen.unmount();

    // On: the header is in-flow, so the list only needs the small gap.
    storageService.getPreferences.mockResolvedValue({ solidPinnedHeader: true });
    await render(<TorrentsScreen />);
    await waitFor(() => expect(listPaddingTop()).toBeLessThan(136));
    storageService.getPreferences.mockResolvedValue({});
  });
});
