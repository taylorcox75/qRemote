// RootLayout.test.tsx — app/_layout.tsx: cold-start preference application,
// the crash ErrorBoundary, and deep-link handling (magnet links and incoming
// .torrent files, warm and cold launch, de-duplication, queueing until the
// root navigator is ready, and the two cold-launch URL sources).
import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RootLayout, { ErrorBoundary, unstable_settings } from '@/app/_layout';

jest.mock('@/i18n', () => ({}));

const mockReplace = jest.fn();
let mockNavKey: string | undefined = 'root-key';
jest.mock('expo-router', () => {
  const RN = require('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => (
    <RN.View testID="root-stack">{children}</RN.View>
  );
  Stack.Screen = ({ name }: { name: string }) => <RN.Text>{`screen:${name}`}</RN.Text>;
  const router = { replace: (...a: unknown[]) => mockReplace(...a) };
  return {
    Stack,
    useRouter: () => router,
    useRootNavigationState: () => ({ key: mockNavKey }),
  };
});

const mockGetLinkingURL = jest.fn();
jest.mock('expo-linking', () => ({ getLinkingURL: () => mockGetLinkingURL() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ colors: require('../../components/theme-mock').mockColors }),
}));
const mockShowToast = jest.fn();
jest.mock('@/context/ToastContext', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock('@/context/LiquidGlassContext', () => ({
  LiquidGlassProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/ServerContext', () => ({
  ServerProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/ApiVersionContext', () => ({
  ApiVersionProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/TorrentContext', () => ({
  TorrentProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/TransferContext', () => ({
  TransferProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/SearchCartContext', () => ({
  SearchCartProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/services/query-client', () => {
  const { QueryClient } = require('@tanstack/react-query');
  return { queryClient: new QueryClient() };
});

const mockGetPreferences = jest.fn();
jest.mock('@/services/storage', () => ({
  storageService: { getPreferences: () => mockGetPreferences() },
}));
const mockUpdateSettings = jest.fn();
jest.mock('@/services/api/client', () => ({
  apiClient: { updateSettings: (...a: unknown[]) => mockUpdateSettings(...a) },
}));
const mockSetHaptics = jest.fn();
jest.mock('@/utils/haptics', () => ({
  setHapticsEnabled: (...a: unknown[]) => mockSetHaptics(...a),
}));
const mockSetDebugMode = jest.fn();
const mockClogWarn = jest.fn();
jest.mock('@/services/connectivity-log', () => ({
  setDebugMode: (...a: unknown[]) => mockSetDebugMode(...a),
  clogInfo: jest.fn(),
  clogWarn: (...a: unknown[]) => mockClogWarn(...a),
}));
const mockPersist = jest.fn();
jest.mock('@/services/incoming-file', () => ({
  persistIncomingTorrentFile: (...a: unknown[]) => mockPersist(...a),
}));
jest.mock('@/utils/afterInteractions', () => ({
  runAfterInteractions: (cb: () => void) => cb(),
}));

const MAGNET = 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Example';
const FILE_URL = 'file:///private/var/mobile/Inbox/Example%20File.torrent';

let urlListener: ((e: { url: string }) => void) | null;
const mockRemove = jest.fn();
let initialUrl: Promise<string | null>;

beforeEach(() => {
  jest.clearAllMocks();
  mockNavKey = 'root-key';
  urlListener = null;
  initialUrl = Promise.resolve(null);
  mockGetLinkingURL.mockReturnValue(null);
  mockGetPreferences.mockResolvedValue({ hapticFeedback: false, debugMode: true });
  mockPersist.mockImplementation(async (file: { uri: string; name: string }) => ({
    uri: 'file:///cache/incoming-torrents/copy.torrent',
    name: file.name,
  }));
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((
    _type: string,
    cb: (e: { url: string }) => void,
  ) => {
    urlListener = cb;
    return { remove: mockRemove };
  }) as unknown as typeof Linking.addEventListener);
  jest.spyOn(Linking, 'getInitialURL').mockImplementation(() => initialUrl);
});

afterEach(() => jest.restoreAllMocks());

const emitUrl = async (url: string) => {
  await act(async () => {
    urlListener!({ url });
  });
};

describe('RootLayout', () => {
  it('anchors the root stack on (tabs) and registers the modal routes', async () => {
    expect(unstable_settings.anchor).toBe('(tabs)');
    await render(<RootLayout />);
    expect(screen.getByText('screen:(tabs)')).toBeTruthy();
    expect(screen.getByText('screen:server/add')).toBeTruthy();
    expect(screen.getByText('screen:server/[id]')).toBeTruthy();
  });

  it('applies stored haptics, debug and connection settings at cold start', async () => {
    mockGetPreferences.mockResolvedValue({
      hapticFeedback: false,
      debugMode: true,
      connectionTimeout: 15000,
      retryAttempts: 0,
    });
    await render(<RootLayout />);
    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled());
    expect(mockSetHaptics).toHaveBeenCalledWith(false);
    expect(mockSetDebugMode).toHaveBeenCalledWith(true);
    expect(mockUpdateSettings.mock.calls[0][0]).toEqual(
      expect.objectContaining({ retryAttempts: 0 }),
    );
  });

  it('keeps module defaults when preferences cannot be read', async () => {
    mockGetPreferences.mockRejectedValue(new Error('storage unavailable'));
    await render(<RootLayout />);
    await waitFor(() => expect(mockGetPreferences).toHaveBeenCalled());
    expect(mockSetHaptics).not.toHaveBeenCalled();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('routes a warm magnet link to the torrents list and ignores an immediate duplicate', async () => {
    await render(<RootLayout />);
    await emitUrl(MAGNET);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { magnet: MAGNET } });
    await emitUrl(MAGNET);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('copies an incoming .torrent into the cache and routes the copy', async () => {
    await render(<RootLayout />);
    await emitUrl(FILE_URL);
    expect(mockPersist).toHaveBeenCalledWith({ uri: FILE_URL, name: 'Example File.torrent' });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/',
      params: {
        torrentFileUri: 'file:///cache/incoming-torrents/copy.torrent',
        torrentFileName: 'Example File.torrent',
      },
    });
    // The same file again within the de-dupe window is ignored.
    await emitUrl(FILE_URL);
    expect(mockPersist).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast and logs when an incoming .torrent cannot be read', async () => {
    mockPersist.mockResolvedValue(null);
    await render(<RootLayout />);
    await emitUrl(FILE_URL);
    expect(mockShowToast).toHaveBeenCalledWith('errors.couldNotReadTorrentFile', 'error');
    expect(mockClogWarn).toHaveBeenCalledWith('LINK', expect.stringContaining(FILE_URL));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('ignores URLs that are neither magnets nor .torrent files', async () => {
    await render(<RootLayout />);
    await emitUrl('qremote://settings');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
  });

  it('dispatches the cold-launch RN initial URL', async () => {
    initialUrl = Promise.resolve(MAGNET);
    await render(<RootLayout />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { magnet: MAGNET } }),
    );
  });

  it('falls back silently to the expo-linking URL when the RN URL cannot be read', async () => {
    const expoUrl = 'file:///private/var/mobile/Inbox/Fallback.torrent';
    initialUrl = Promise.resolve(FILE_URL);
    mockGetLinkingURL.mockReturnValue(expoUrl);
    mockPersist.mockImplementation(async (file: { uri: string; name: string }) =>
      file.uri === FILE_URL ? null : { uri: 'file:///cache/fallback.torrent', name: file.name },
    );
    await render(<RootLayout />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/',
        params: {
          torrentFileUri: 'file:///cache/fallback.torrent',
          torrentFileName: 'Fallback.torrent',
        },
      }),
    );
    // The first source failed, but its toast was suppressed because a
    // distinct fallback existed.
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('uses the expo-linking URL when RN reports no initial URL (or fails)', async () => {
    initialUrl = Promise.reject(new Error('not available'));
    mockGetLinkingURL.mockReturnValue(MAGNET);
    await render(<RootLayout />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { magnet: MAGNET } }),
    );
  });

  it('queues a deep link until the root navigator is ready, then dispatches it', async () => {
    mockNavKey = undefined;
    const view = await render(<RootLayout />);
    await emitUrl(MAGNET);
    expect(mockReplace).not.toHaveBeenCalled();

    mockNavKey = 'ready';
    await view.rerender(<RootLayout />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { magnet: MAGNET } }),
    );
  });

  it('queues an incoming .torrent until the root navigator is ready', async () => {
    mockNavKey = undefined;
    const view = await render(<RootLayout />);
    await emitUrl(FILE_URL);
    expect(mockPersist).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    mockNavKey = 'ready';
    await view.rerender(<RootLayout />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ torrentFileName: 'Example File.torrent' }),
        }),
      ),
    );
  });

  it('removes the Linking subscription on unmount', async () => {
    const view = await render(<RootLayout />);
    await view.unmount();
    expect(mockRemove).toHaveBeenCalled();
  });
});

describe('ErrorBoundary', () => {
  it('shows the error message and retries on tap', async () => {
    const retry = jest.fn();
    await render(<ErrorBoundary error={new Error('Render exploded')} retry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Render exploded')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(retry).toHaveBeenCalled();
  });

  it('omits the message line when the error has none', async () => {
    await render(<ErrorBoundary error={new Error('')} retry={jest.fn()} />);
    expect(screen.getByText('Try Again')).toBeTruthy();
    expect(screen.queryByText('Render exploded')).toBeNull();
  });
});
