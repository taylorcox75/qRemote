// ServersSettingsScreen.test.tsx — Settings → Servers
// (app/(tabs)/settings/servers.tsx): the saved-server list (connect,
// disconnect, edit, delete with confirmation), auto-connect, and the
// secret-free export / import of the server list.
import React from 'react';
import { render, fireEvent, waitFor, screen, within, act } from '@testing-library/react-native';
import ServersSettingsScreen from '@/app/(tabs)/settings/servers';
import { CONNECT_SUPERSEDED_MESSAGE } from '@/utils/error';
import { SERVER_EXPORT_KIND } from '@/utils/server-export';
import type { ServerConfig } from '@/types/api';
import { routerMock, toastMock, resetSharedMocks } from './helpers';

jest.mock('expo-router', () => require('./helpers').expoRouterMock);
jest.mock('react-i18next', () => require('./helpers').i18nMock);
jest.mock('@/context/ThemeContext', () => require('./helpers').themeContextMock);
jest.mock('@/context/ToastContext', () => require('./helpers').toastContextMock);
jest.mock('@/components/FocusAwareStatusBar', () => require('./helpers').statusBarMock);
jest.mock('@/components/ConfirmModal', () => require('./helpers').confirmModalMock);

const mockServerCtx = {
  currentServer: null as ServerConfig | null,
  isConnected: false,
  connectToServer: jest.fn(),
  disconnect: jest.fn(),
  forgetCurrentServer: jest.fn(),
};
jest.mock('@/context/ServerContext', () => ({ useServer: () => mockServerCtx }));

const mockManager = {
  getServers: jest.fn(),
  exportServers: jest.fn(),
  importServers: jest.fn(),
  deleteServer: jest.fn(),
};
jest.mock('@/services/server-manager', () => ({
  get ServerManager() {
    return mockManager;
  },
}));

let mockLocalPrefs: Record<string, unknown> = {};
const mockSavePreferences = jest.fn();
jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn(async () => ({ ...mockLocalPrefs })),
    savePreferences: (p: Record<string, unknown>) => mockSavePreferences(p),
  },
}));

const mockFs = {
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
};
jest.mock('expo-file-system/legacy', () => ({
  get cacheDirectory() {
    return mockFs.cacheDirectory;
  },
  writeAsStringAsync: (...a: unknown[]) => mockFs.writeAsStringAsync(...a),
  readAsStringAsync: (...a: unknown[]) => mockFs.readAsStringAsync(...a),
}));
const mockSharing = { isAvailableAsync: jest.fn(), shareAsync: jest.fn() };
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockSharing.isAvailableAsync(),
  shareAsync: (...a: unknown[]) => mockSharing.shareAsync(...a),
}));
const mockGetDocument = jest.fn();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...a: unknown[]) => mockGetDocument(...a),
}));

const S = (k: string) => `screens.settings.${k}`;

const HOME: ServerConfig = {
  id: 'home',
  name: 'Home',
  host: '192.168.1.2',
  port: 8080,
  username: 'admin',
  password: '',
} as ServerConfig;
const SEEDBOX: ServerConfig = {
  id: 'seed',
  name: 'Seedbox',
  host: 'seed.example.test',
  port: 0,
  username: 'u',
  password: '',
} as ServerConfig;

async function renderScreen() {
  await render(<ServersSettingsScreen />);
  await screen.findByText(S('autoConnectLastServer'));
}

/** Nearest ancestor of the server name that also holds its delete action. */
function rowFor(name: string) {
  let node = screen.getByText(name).parent;
  while (node && !within(node).queryByText('common.delete')) node = node.parent;
  if (!node) throw new Error(`No row for ${name}`);
  return node;
}

/** A synthetic single-finger touch at page x, for driving the row's PanResponder. */
function touchAt(x: number, ts: number) {
  return {
    nativeEvent: { touches: [{}], changedTouches: [{}] },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: ts,
      touchBank: [
        {
          touchActive: true,
          startPageX: 0,
          startPageY: 0,
          startTimeStamp: 0,
          currentPageX: x,
          currentPageY: 0,
          currentTimeStamp: ts,
          previousPageX: 0,
          previousPageY: 0,
          previousTimeStamp: 0,
        },
      ],
    },
  };
}

/** Drags the named row horizontally by dx and releases it. */
async function swipeRow(name: string, dx: number) {
  const pannable = rowFor(name).queryAll(
    (n) => typeof n.props.onMoveShouldSetResponder === 'function',
  )[0];
  await act(async () => {
    pannable.props.onStartShouldSetResponderCapture(touchAt(0, 0));
    pannable.props.onMoveShouldSetResponderCapture(touchAt(Math.sign(dx) * 15, 1));
    expect(pannable.props.onMoveShouldSetResponder(touchAt(Math.sign(dx) * 15, 1))).toBe(true);
    pannable.props.onResponderGrant(touchAt(0, 2));
    pannable.props.onResponderMove(touchAt(dx, 3));
    pannable.props.onResponderRelease(touchAt(dx, 4));
  });
}

beforeEach(() => {
  resetSharedMocks();
  mockServerCtx.currentServer = null;
  mockServerCtx.isConnected = false;
  mockServerCtx.connectToServer.mockReset().mockResolvedValue(true);
  mockServerCtx.disconnect.mockReset().mockResolvedValue(undefined);
  mockServerCtx.forgetCurrentServer.mockReset();
  mockManager.getServers.mockReset().mockResolvedValue([HOME, SEEDBOX]);
  mockManager.exportServers.mockReset();
  mockManager.importServers.mockReset();
  mockManager.deleteServer.mockReset().mockResolvedValue(undefined);
  mockLocalPrefs = {};
  mockSavePreferences.mockReset().mockResolvedValue(undefined);
  mockFs.writeAsStringAsync.mockReset().mockResolvedValue(undefined);
  mockFs.readAsStringAsync.mockReset();
  mockSharing.isAvailableAsync.mockReset().mockResolvedValue(true);
  mockSharing.shareAsync.mockReset().mockResolvedValue(undefined);
  mockGetDocument.mockReset();
});

describe('ServersSettingsScreen — list', () => {
  it('lists saved servers with their addresses', async () => {
    await renderScreen();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('192.168.1.2:8080')).toBeTruthy();
    // No port shown when it is unset or 0.
    expect(screen.getByText('seed.example.test')).toBeTruthy();
    expect(screen.getAllByText(S('connect'))).toHaveLength(2);
  });

  it('shows an empty state that leads to adding a server', async () => {
    mockManager.getServers.mockResolvedValue([]);
    await renderScreen();
    expect(screen.getAllByText(S('noServersConfigured')).length).toBeGreaterThan(0);
    const addButtons = screen.getAllByText(S('addServer'));
    await fireEvent.press(addButtons[addButtons.length - 1]);
    expect(routerMock.push).toHaveBeenCalledWith('/server/add');
  });

  it('reports a failure to load servers', async () => {
    mockManager.getServers.mockRejectedValue(new Error('x'));
    await renderScreen();
    expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToLoadServers', 'error');
  });

  it('navigates back, to add, and to edit a server', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('common.back'));
    expect(routerMock.back).toHaveBeenCalled();
    await fireEvent.press(screen.getAllByLabelText(S('addServer'))[0]);
    expect(routerMock.push).toHaveBeenCalledWith('/server/add');
    await fireEvent.press(screen.getByText('Seedbox'));
    expect(routerMock.push).toHaveBeenCalledWith('/server/seed');
  });

  it('reads and saves the auto-connect preference (on unless explicitly off)', async () => {
    await renderScreen();
    const sw = screen.getByRole('switch');
    await waitFor(() => expect(sw.props.value).toBe(true));
    await fireEvent(sw, 'valueChange', false);
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith({ autoConnectLastServer: false }),
    );
  });

  it('shows auto-connect off when it was turned off', async () => {
    mockLocalPrefs = { autoConnectLastServer: false };
    await renderScreen();
    await waitFor(() => expect(screen.getByRole('switch').props.value).toBe(false));
  });
});

describe('ServersSettingsScreen — connecting', () => {
  it('connects to a server and confirms', async () => {
    await renderScreen();
    await fireEvent.press(within(rowFor('Home')).getByText(S('connect')));
    await waitFor(() => expect(mockServerCtx.connectToServer).toHaveBeenCalledWith(HOME));
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.connectedTo:Home', 'success');
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('asks the user to check credentials when the login is refused', async () => {
    mockServerCtx.connectToServer.mockResolvedValue(false);
    await renderScreen();
    await fireEvent.press(within(rowFor('Home')).getByText(S('connect')));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.checkCredentials', 'error'),
    );
  });

  it('shows the connection error, but stays quiet for a superseded attempt', async () => {
    mockServerCtx.connectToServer.mockRejectedValueOnce(new Error('Boom'));
    await renderScreen();
    await fireEvent.press(within(rowFor('Home')).getByText(S('connect')));
    await waitFor(() => expect(toastMock.showToast).toHaveBeenCalledWith('Boom', 'error'));

    toastMock.showToast.mockClear();
    mockServerCtx.connectToServer.mockRejectedValueOnce(new Error(CONNECT_SUPERSEDED_MESSAGE));
    await fireEvent.press(within(rowFor('Home')).getByText(S('connect')));
    await waitFor(() => expect(mockServerCtx.connectToServer).toHaveBeenCalledTimes(2));
    expect(toastMock.showToast).not.toHaveBeenCalled();
  });

  it('offers Disconnect only for the live connection', async () => {
    mockServerCtx.currentServer = HOME;
    mockServerCtx.isConnected = true;
    await renderScreen();
    await fireEvent.press(within(rowFor('Home')).getByText(S('disconnect')));
    await waitFor(() => expect(mockServerCtx.disconnect).toHaveBeenCalled());
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.disconnected', 'info');
    expect(within(rowFor('Seedbox')).getByText(S('connect'))).toBeTruthy();
  });

  it('shows Connect for a remembered but disconnected server', async () => {
    mockServerCtx.currentServer = HOME;
    mockServerCtx.isConnected = false;
    await renderScreen();
    expect(screen.queryByText(S('disconnect'))).toBeNull();
  });
});

describe('ServersSettingsScreen — deleting', () => {
  async function requestDelete(name: string) {
    await fireEvent.press(within(rowFor(name)).getByText('common.delete'));
    await screen.findByText('confirm-title:server.deleteServer');
  }

  it('asks for confirmation and deletes nothing on cancel', async () => {
    await renderScreen();
    await requestDelete('Seedbox');
    expect(screen.getByText('confirm-message:server.deleteServerConfirm:Seedbox')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-cancel'));
    expect(screen.queryByText('confirm-title:server.deleteServer')).toBeNull();
    expect(mockManager.deleteServer).not.toHaveBeenCalled();
  });

  it('deletes another server, keeping the current connection', async () => {
    mockServerCtx.currentServer = HOME;
    mockServerCtx.isConnected = true;
    mockManager.getServers.mockResolvedValueOnce([HOME, SEEDBOX]).mockResolvedValue([HOME]);
    await renderScreen();
    await requestDelete('Seedbox');
    await fireEvent.press(screen.getByTestId('confirm-common.delete'));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('toast.serverDeleted:Seedbox', 'success'),
    );
    expect(mockManager.deleteServer).toHaveBeenCalledWith('seed');
    expect(mockServerCtx.disconnect).not.toHaveBeenCalled();
    expect(mockServerCtx.forgetCurrentServer).not.toHaveBeenCalled();
    expect(screen.queryByText('Seedbox')).toBeNull();
  });

  it('disconnects and forgets the server when the connected one is deleted', async () => {
    mockServerCtx.currentServer = HOME;
    mockServerCtx.isConnected = true;
    await renderScreen();
    await requestDelete('Home');
    await fireEvent.press(screen.getByTestId('confirm-common.delete'));
    await waitFor(() => expect(mockServerCtx.forgetCurrentServer).toHaveBeenCalled());
    expect(mockServerCtx.disconnect).toHaveBeenCalled();
  });

  it('forgets a remembered, disconnected current server without disconnecting', async () => {
    mockServerCtx.currentServer = HOME;
    await renderScreen();
    await requestDelete('Home');
    await fireEvent.press(screen.getByTestId('confirm-common.delete'));
    await waitFor(() => expect(mockServerCtx.forgetCurrentServer).toHaveBeenCalled());
    expect(mockServerCtx.disconnect).not.toHaveBeenCalled();
  });

  it('forgets the session once the last server is gone', async () => {
    mockServerCtx.currentServer = { ...HOME, id: 'gone' };
    mockServerCtx.isConnected = true;
    mockManager.getServers.mockResolvedValueOnce([SEEDBOX]).mockResolvedValue([]);
    await renderScreen();
    await requestDelete('Seedbox');
    await fireEvent.press(screen.getByTestId('confirm-common.delete'));
    await waitFor(() => expect(mockServerCtx.forgetCurrentServer).toHaveBeenCalled());
    expect(mockServerCtx.disconnect).toHaveBeenCalled();
  });

  it('forgets without disconnecting when the last server goes while offline', async () => {
    mockManager.getServers.mockResolvedValueOnce([SEEDBOX]).mockResolvedValue([]);
    await renderScreen();
    await requestDelete('Seedbox');
    await fireEvent.press(screen.getByTestId('confirm-common.delete'));
    await waitFor(() => expect(mockServerCtx.forgetCurrentServer).toHaveBeenCalled());
    expect(mockServerCtx.disconnect).not.toHaveBeenCalled();
  });

  it('reports a failed delete', async () => {
    mockManager.deleteServer.mockRejectedValue(new Error('x'));
    await renderScreen();
    await requestDelete('Seedbox');
    await fireEvent.press(screen.getByTestId('confirm-common.delete'));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToDeleteServer', 'error'),
    );
  });
});

describe('ServersSettingsScreen — export / import', () => {
  const EXPORT = {
    kind: SERVER_EXPORT_KIND,
    version: 1,
    exportedAt: '2026-11-15T10:00:00.000Z',
    servers: [{ id: 'home', name: 'Home', host: 'h', port: 1, username: 'u' }],
  };

  it('writes the export to a dated cache file and opens the share sheet', async () => {
    mockManager.exportServers.mockResolvedValue(EXPORT);
    await renderScreen();
    await fireEvent.press(screen.getByText(S('exportServers')));
    await waitFor(() => expect(mockSharing.shareAsync).toHaveBeenCalled());
    const [uri, body] = mockFs.writeAsStringAsync.mock.calls[0];
    expect(uri).toBe('file:///cache/qremote-servers-2026-11-15.json');
    expect(JSON.parse(body)).toEqual(EXPORT);
    expect(mockSharing.shareAsync).toHaveBeenCalledWith(uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: S('exportServers'),
    });
  });

  it('skips the share sheet when sharing is unavailable', async () => {
    mockManager.exportServers.mockResolvedValue(EXPORT);
    mockSharing.isAvailableAsync.mockResolvedValue(false);
    await renderScreen();
    await fireEvent.press(screen.getByText(S('exportServers')));
    await waitFor(() => expect(mockFs.writeAsStringAsync).toHaveBeenCalled());
    expect(mockSharing.shareAsync).not.toHaveBeenCalled();
  });

  it('says there is nothing to export for an empty list', async () => {
    mockManager.exportServers.mockResolvedValue({ ...EXPORT, servers: [] });
    await renderScreen();
    await fireEvent.press(screen.getByText(S('exportServers')));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith(S('noServersConfigured'), 'info'),
    );
    expect(mockFs.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('reports an export failure', async () => {
    mockManager.exportServers.mockResolvedValue(EXPORT);
    mockFs.writeAsStringAsync.mockRejectedValue(new Error('disk full'));
    await renderScreen();
    await fireEvent.press(screen.getByText(S('exportServers')));
    await waitFor(() => expect(toastMock.showToast).toHaveBeenCalledWith('disk full', 'error'));
  });

  it('imports a picked export file and reloads the list', async () => {
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x.json' }] });
    mockFs.readAsStringAsync.mockResolvedValue(JSON.stringify(EXPORT));
    mockManager.importServers.mockResolvedValue({ added: 1, updated: 2 });
    await renderScreen();
    await fireEvent.press(screen.getByText(S('importServers')));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('toast.serversImported:1,2', 'success'),
    );
    expect(mockGetDocument).toHaveBeenCalledWith(
      expect.objectContaining({ copyToCacheDirectory: true, multiple: false }),
    );
    expect(mockFs.readAsStringAsync).toHaveBeenCalledWith('file:///x.json');
    const imported = mockManager.importServers.mock.calls[0][0];
    expect(imported).toHaveLength(1);
    expect(imported[0]).toEqual(expect.objectContaining({ name: 'Home', password: '' }));
    expect(mockManager.getServers).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the picker is cancelled', async () => {
    mockGetDocument.mockResolvedValue({ canceled: true, assets: null });
    await renderScreen();
    await fireEvent.press(screen.getByText(S('importServers')));
    await waitFor(() => expect(mockGetDocument).toHaveBeenCalled());
    expect(mockFs.readAsStringAsync).not.toHaveBeenCalled();
    expect(toastMock.showToast).not.toHaveBeenCalled();
  });

  it('reports a file read failure', async () => {
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x.json' }] });
    mockFs.readAsStringAsync.mockRejectedValue(new Error('unreadable'));
    await renderScreen();
    await fireEvent.press(screen.getByText(S('importServers')));
    await waitFor(() => expect(toastMock.showToast).toHaveBeenCalledWith('unreadable', 'error'));
  });

  it('rejects a file that is not a server export', async () => {
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x.json' }] });
    mockFs.readAsStringAsync.mockResolvedValue('{"hello":1}');
    await renderScreen();
    await fireEvent.press(screen.getByText(S('importServers')));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.invalidServerImport', 'error'),
    );
    expect(mockManager.importServers).not.toHaveBeenCalled();
  });

  it('reports a failure while saving the imported servers', async () => {
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x.json' }] });
    mockFs.readAsStringAsync.mockResolvedValue(JSON.stringify(EXPORT));
    mockManager.importServers.mockRejectedValue(new Error('storage'));
    await renderScreen();
    await fireEvent.press(screen.getByText(S('importServers')));
    await waitFor(() => expect(toastMock.showToast).toHaveBeenCalledWith('storage', 'error'));
  });
});

describe('ServersSettingsScreen — swipe to reveal delete', () => {
  it('a long swipe opens the row, and the next tap closes it instead of editing', async () => {
    await renderScreen();
    await swipeRow('Home', -120);
    await fireEvent.press(screen.getByText('Home'));
    expect(routerMock.push).not.toHaveBeenCalled();
    // Closed again: a second tap edits.
    await fireEvent.press(screen.getByText('Home'));
    expect(routerMock.push).toHaveBeenCalledWith('/server/home');
  });

  it('a short swipe springs back and a tap still edits', async () => {
    await renderScreen();
    await swipeRow('Home', -20);
    await fireEvent.press(screen.getByText('Home'));
    expect(routerMock.push).toHaveBeenCalledWith('/server/home');
  });

  it('dragging an open row continues from its open offset', async () => {
    await renderScreen();
    await swipeRow('Home', -120);
    await swipeRow('Home', 100);
    await fireEvent.press(screen.getByText('Home'));
    expect(routerMock.push).toHaveBeenCalledWith('/server/home');
  });
});
