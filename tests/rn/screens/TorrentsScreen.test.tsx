// TorrentsScreen.test.tsx — covers the not-connected panel vs. skeleton
// branching in app/(tabs)/(torrents)/index.tsx (#252).
//
// QuickConnectPanel and SkeletonTorrentCard are replaced with minimal stubs
// so these tests assert on the SCREEN's branching logic (which one mounts,
// and what props reach the panel) rather than on QuickConnectPanel's own
// internal rendering, which is a separate, already-working component.
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

const baseServer: ServerConfig = {
  id: 's1',
  name: 'My Server',
  host: '192.168.1.10',
  username: 'admin',
  password: 'pw',
};

const baseTorrentsState = {
  torrents: [],
  categories: [],
  tags: [],
  isLoading: false,
  error: null as string | null,
  refresh: jest.fn(),
  isRecoveringFromBackground: false,
  initialLoadComplete: true,
};

const baseServerState = {
  isConnected: false,
  isLoading: false,
  isConnecting: false,
  isReconnecting: false,
  connectToServer: jest.fn(),
};

describe('TorrentsScreen — not-connected panel vs. skeleton (#252)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServers.mockResolvedValue([baseServer]);
    mockUseTorrents.mockReturnValue({ ...baseTorrentsState });
  });

  it('keeps the panel mounted through a user-initiated connect and shows the tapped row as connecting', async () => {
    let resolveConnect!: (value: boolean) => void;
    const state = {
      ...baseServerState,
      connectToServer: jest.fn(() => {
        // Flip isLoading the moment the connect call fires, mirroring
        // connectMutation.isPending going true in the real ServerContext.
        state.isLoading = true;
        return new Promise<boolean>((resolve) => {
          resolveConnect = resolve;
        });
      }),
    };
    mockUseServer.mockImplementation(() => state);

    await render(<TorrentsScreen />);

    await waitFor(() => expect(screen.getByTestId('connect-s1')).toBeTruthy());
    expect(screen.getByTestId('quick-connect-panel')).toBeTruthy();
    expect(screen.queryByTestId('skeleton-torrent-card')).toBeNull();

    fireEvent.press(screen.getByTestId('connect-s1'));

    // The panel must stay mounted and reflect the tapped server as
    // connecting — not unmount into the skeleton branch (the #252 blink).
    await waitFor(() => expect(screen.getByTestId('connecting-id').props.children).toBe('s1'));
    expect(screen.getByTestId('quick-connect-panel')).toBeTruthy();
    expect(screen.queryByTestId('skeleton-torrent-card')).toBeNull();

    await waitFor(() => resolveConnect(true));
  });

  it('still shows the skeleton (not the panel) during an automatic reconnect on an established session', async () => {
    mockUseServer.mockReturnValue({
      ...baseServerState,
      isConnected: true,
      isReconnecting: true,
    });
    mockUseTorrents.mockReturnValue({ ...baseTorrentsState, initialLoadComplete: true });

    await render(<TorrentsScreen />);

    await waitFor(() =>
      expect(screen.getAllByTestId('skeleton-torrent-card').length).toBeGreaterThan(0),
    );
    expect(screen.queryByTestId('quick-connect-panel')).toBeNull();
  });

  it('still shows the skeleton (not the panel) on a cold launch before any tap', async () => {
    mockUseServer.mockReturnValue({
      ...baseServerState,
      isConnected: false,
      isLoading: true,
      isConnecting: true,
    });
    mockUseTorrents.mockReturnValue({ ...baseTorrentsState, initialLoadComplete: false });

    await render(<TorrentsScreen />);

    await waitFor(() =>
      expect(screen.getAllByTestId('skeleton-torrent-card').length).toBeGreaterThan(0),
    );
    expect(screen.queryByTestId('quick-connect-panel')).toBeNull();
  });
});
