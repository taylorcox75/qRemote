jest.mock('@/services/storage', () => ({
  storageService: {
    saveServer: jest.fn(),
    getServers: jest.fn(),
    getServer: jest.fn(),
    deleteServer: jest.fn(),
    setCurrentServerId: jest.fn(),
    getCurrentServerId: jest.fn(),
    getCurrentServer: jest.fn(),
    setManualDisconnect: jest.fn(),
    getManualDisconnect: jest.fn(),
  },
}));

const mockIsolatedClient = { get: jest.fn() };

jest.mock('@/services/api/client', () => ({
  apiClient: {
    getServer: jest.fn(),
    setServer: jest.fn(),
    setApiVersion: jest.fn(),
    abortInFlight: jest.fn(),
    createIsolatedClient: jest.fn(() => mockIsolatedClient),
  },
}));

jest.mock('@/modules/insecure-cert-allowlist', () => ({
  setInsecureCertAllowedHosts: jest.fn(),
  isInsecureCertAllowlistAvailable: jest.fn(() => true),
}));

jest.mock('@/services/api/auth', () => ({
  authApi: {
    login: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('@/services/api/application', () => ({
  applicationApi: {
    getVersion: jest.fn(),
  },
}));

jest.mock('@/services/connectivity-log', () => ({
  clogInfo: jest.fn(),
  clogWarn: jest.fn(),
  clogError: jest.fn(),
}));

import { AxiosError } from 'axios';
import {
  ServerManager,
  isNetworkError,
  isConnectSuperseded,
  CONNECT_SUPERSEDED_MESSAGE,
} from '@/services/server-manager';
import { setInsecureCertAllowedHosts } from '@/modules/insecure-cert-allowlist';
import { storageService } from '@/services/storage';
import { apiClient } from '@/services/api/client';
import { authApi } from '@/services/api/auth';
import { applicationApi } from '@/services/api/application';
import type { ServerConfig } from '@/types/api';
import { QUI_KEY_MISSING_MESSAGE, QUI_KEY_REJECTED_MESSAGE } from '@/utils/quiProxy';

const mockStorage = storageService as jest.Mocked<typeof storageService>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockAuth = authApi as jest.Mocked<typeof authApi>;
const mockApp = applicationApi as jest.Mocked<typeof applicationApi>;

function makeServer(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    id: 's1',
    name: 'Test',
    host: 'example.com',
    port: 8080,
    username: 'admin',
    password: 'secret',
    useHttps: false,
    bypassAuth: false,
    ...overrides,
  };
}

describe('isNetworkError', () => {
  it('returns true for ECONNABORTED axios errors', () => {
    const err = new AxiosError('timeout');
    err.code = 'ECONNABORTED';
    expect(isNetworkError(err)).toBe(true);
  });

  it('returns true for 5xx axios errors', () => {
    const err = new AxiosError('server error');
    err.response = { status: 503 } as never;
    expect(isNetworkError(err)).toBe(true);
  });

  it('returns false for 4xx axios errors without network-ish message', () => {
    const err = new AxiosError('bad request');
    err.response = { status: 400 } as never;
    expect(isNetworkError(err)).toBe(false);
  });

  it('returns true for a plain Error with "Network" in message', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
  });

  it('returns false for a plain Error unrelated to network', () => {
    expect(isNetworkError(new Error('Authentication failed'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isNetworkError('a string')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('ServerManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // saveServer/deleteServer/getCurrentServer all sync the native
    // self-signed-cert allowlist off the full server list as a side effect;
    // default it so tests that don't care about that list don't have to stub it.
    mockStorage.getServers.mockResolvedValue([]);
    mockIsolatedClient.get.mockResolvedValue('v5.0.0');
  });

  describe('saveServer / getServers / getServer', () => {
    it('delegates to storageService', async () => {
      const server = makeServer();
      await ServerManager.saveServer(server);
      expect(mockStorage.saveServer).toHaveBeenCalledWith(server);

      mockStorage.getServers.mockResolvedValueOnce([server]);
      expect(await ServerManager.getServers()).toEqual([server]);

      mockStorage.getServer.mockResolvedValueOnce(server);
      expect(await ServerManager.getServer('s1')).toEqual(server);
    });
  });

  describe('deleteServer', () => {
    it('clears the api client when deleting the currently-connected server', async () => {
      mockApiClient.getServer.mockReturnValue(makeServer());
      await ServerManager.deleteServer('s1');
      expect(mockApiClient.setServer).toHaveBeenCalledWith(null);
      expect(mockStorage.setCurrentServerId).toHaveBeenCalledWith(null);
      expect(mockStorage.setManualDisconnect).toHaveBeenCalledWith(false);
      expect(mockStorage.deleteServer).toHaveBeenCalledWith('s1');
    });

    it('does not touch the api client when deleting a different server', async () => {
      mockApiClient.getServer.mockReturnValue(makeServer({ id: 'other' }));
      await ServerManager.deleteServer('s1');
      expect(mockApiClient.setServer).not.toHaveBeenCalled();
      expect(mockStorage.deleteServer).toHaveBeenCalledWith('s1');
    });
  });

  describe('exportServers', () => {
    it('strips secrets from every exported server', async () => {
      mockStorage.getServers.mockResolvedValueOnce([
        makeServer({
          basicAuthPassword: 'proxy-secret',
          apiKey: 'key-secret',
          useQuiProxy: true,
          quiProxyKey: 'qui-key-secret',
        }),
      ]);
      const exported = await ServerManager.exportServers();
      expect(exported.servers).toHaveLength(1);
      expect(exported.servers[0].password).toBe('');
      expect(exported.servers[0].basicAuthPassword).toBe('');
      expect(exported.servers[0].apiKey).toBe('');
      expect(exported.servers[0].quiProxyKey).toBe('');
      expect(JSON.stringify(exported)).not.toContain('qui-key-secret');
      expect(exported.servers[0]).toMatchObject({ id: 's1', host: 'example.com', port: 8080 });
    });
  });

  describe('importServers', () => {
    it('adds unknown servers with empty secrets', async () => {
      mockStorage.getServers.mockResolvedValueOnce([]);
      const imported = makeServer({ id: 'new', password: '' });
      const result = await ServerManager.importServers([imported]);
      expect(result).toEqual({ added: 1, updated: 0 });
      expect(mockStorage.saveServer).toHaveBeenCalledWith(imported);
    });

    it("preserves this device's stored secrets when updating an existing server", async () => {
      mockStorage.getServers.mockResolvedValueOnce([
        makeServer({
          id: 's1',
          password: 'kept-password',
          basicAuthPassword: 'kept-proxy',
          apiKey: 'kept-key',
          quiProxyKey: 'kept-qui-key',
        }),
      ]);
      const imported = makeServer({
        id: 's1',
        host: 'new-host.example.com',
        password: '',
        basicAuthPassword: '',
        apiKey: '',
        quiProxyKey: '',
      });
      const result = await ServerManager.importServers([imported]);
      expect(result).toEqual({ added: 0, updated: 1 });
      expect(mockStorage.saveServer).toHaveBeenCalledWith({
        ...imported,
        password: 'kept-password',
        basicAuthPassword: 'kept-proxy',
        apiKey: 'kept-key',
        quiProxyKey: 'kept-qui-key',
      });
    });

    it('counts a mixed import correctly', async () => {
      mockStorage.getServers.mockResolvedValueOnce([makeServer({ id: 'existing' })]);
      const result = await ServerManager.importServers([
        makeServer({ id: 'existing', password: '' }),
        makeServer({ id: 'brand-new', password: '' }),
      ]);
      expect(result).toEqual({ added: 1, updated: 1 });
      expect(mockStorage.saveServer).toHaveBeenCalledTimes(2);
    });
  });

  describe('connectToServer (primary only, no fallback)', () => {
    it('succeeds via authenticated login', async () => {
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockApp.getVersion.mockResolvedValueOnce({ version: '4.5', apiVersion: '2.9' });
      const result = await ServerManager.connectToServer(makeServer());
      expect(result).toBe(true);
      expect(mockStorage.setCurrentServerId).toHaveBeenCalledWith('s1');
      expect(mockStorage.setManualDisconnect).toHaveBeenCalledWith(false);
      expect(mockApiClient.setApiVersion).toHaveBeenCalledWith('2.9');
    });

    it('succeeds via bypassAuth without calling login', async () => {
      mockApp.getVersion.mockResolvedValueOnce({ version: '4.5', apiVersion: '2.9' });
      const result = await ServerManager.connectToServer(makeServer({ bypassAuth: true }));
      expect(result).toBe(true);
      expect(mockAuth.login).not.toHaveBeenCalled();
    });

    it('returns false when login Fails', async () => {
      mockAuth.login.mockResolvedValueOnce({ status: 'Fails' });
      const result = await ServerManager.connectToServer(makeServer());
      expect(result).toBe(false);
      expect(mockApiClient.setServer).toHaveBeenLastCalledWith(null);
    });

    it('throws a friendly auth error on 403 after login succeeds but version check fails', async () => {
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      const err = new AxiosError('forbidden');
      err.response = { status: 403 } as never;
      mockApp.getVersion.mockRejectedValueOnce(err);
      await expect(ServerManager.connectToServer(makeServer())).rejects.toThrow(
        'Authentication failed',
      );
    });

    it('rethrows network errors from the post-login version check', async () => {
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      const err = new AxiosError('timeout');
      err.code = 'ECONNABORTED';
      mockApp.getVersion.mockRejectedValueOnce(err);
      await expect(ServerManager.connectToServer(makeServer())).rejects.toThrow();
    });

    it('throws generic error for unrecognized post-login failure', async () => {
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockApp.getVersion.mockRejectedValueOnce(new Error('weird failure'));
      await expect(ServerManager.connectToServer(makeServer())).rejects.toThrow(
        'Failed to connect to server',
      );
    });

    it('propagates a network error from bypassAuth version check', async () => {
      const err = new AxiosError('timeout');
      err.code = 'ERR_NETWORK';
      mockApp.getVersion.mockRejectedValueOnce(err);
      await expect(
        ServerManager.connectToServer(makeServer({ bypassAuth: true })),
      ).rejects.toThrow();
    });

    it('throws generic error for non-network bypassAuth failure', async () => {
      mockApp.getVersion.mockRejectedValueOnce(new Error('boom'));
      await expect(ServerManager.connectToServer(makeServer({ bypassAuth: true }))).rejects.toThrow(
        'Failed to connect to server',
      );
    });

    it('succeeds via API key without calling login', async () => {
      mockApp.getVersion.mockResolvedValueOnce({ version: '5.2', apiVersion: '2.14' });
      const result = await ServerManager.connectToServer(
        makeServer({ useApiKey: true, apiKey: 'qbt_thekey' }),
      );
      expect(result).toBe(true);
      expect(mockAuth.login).not.toHaveBeenCalled();
      expect(mockStorage.setCurrentServerId).toHaveBeenCalledWith('s1');
      expect(mockApiClient.setApiVersion).toHaveBeenCalledWith('2.14');
    });

    it('surfaces a credentials error when an API key is rejected (401/403)', async () => {
      const err = new AxiosError('forbidden');
      err.response = { status: 401 } as never;
      mockApp.getVersion.mockRejectedValueOnce(err);
      await expect(
        ServerManager.connectToServer(makeServer({ useApiKey: true, apiKey: 'qbt_badkey' })),
      ).rejects.toThrow('Authentication failed');
    });

    it('rethrows network errors from the API-key version check', async () => {
      const err = new AxiosError('timeout');
      err.code = 'ERR_NETWORK';
      mockApp.getVersion.mockRejectedValueOnce(err);
      await expect(
        ServerManager.connectToServer(makeServer({ useApiKey: true, apiKey: 'qbt_thekey' })),
      ).rejects.toThrow();
    });
  });

  describe('connectToServer (qui proxy, #272)', () => {
    const quiServer = makeServer({
      useQuiProxy: true,
      quiProxyKey: 'quikey123',
      basePath: '/qui',
      username: '',
      password: '',
    });

    it('succeeds without calling login (qui login is a no-op; the key is the credential)', async () => {
      mockApp.getVersion.mockResolvedValueOnce({ version: '5.0', apiVersion: '2.11' });
      const result = await ServerManager.connectToServer(quiServer);
      expect(result).toBe(true);
      expect(mockAuth.login).not.toHaveBeenCalled();
      expect(mockStorage.setCurrentServerId).toHaveBeenCalledWith('s1');
      expect(mockApiClient.setApiVersion).toHaveBeenCalledWith('2.11');
    });

    it("surfaces qui's own key-rejection message instead of the generic credentials error", async () => {
      const err = Object.assign(new Error(QUI_KEY_REJECTED_MESSAGE), { status: 401 });
      mockApp.getVersion.mockRejectedValueOnce(err);
      await expect(ServerManager.connectToServer(quiServer)).rejects.toThrow(
        QUI_KEY_REJECTED_MESSAGE,
      );
    });

    it('fails fast with a clear message when the server has no key (e.g. freshly imported)', async () => {
      await expect(
        ServerManager.connectToServer({ ...quiServer, quiProxyKey: '' }),
      ).rejects.toThrow(QUI_KEY_MISSING_MESSAGE);
      expect(mockApp.getVersion).not.toHaveBeenCalled();
      expect(mockApiClient.setServer).toHaveBeenLastCalledWith(null);
    });

    it('does not fall back to a second endpoint when the key is rejected', async () => {
      const err = Object.assign(new Error(QUI_KEY_REJECTED_MESSAGE), { status: 401 });
      mockApp.getVersion.mockRejectedValueOnce(err);
      await expect(
        ServerManager.connectToServer({
          ...quiServer,
          useFallback: true,
          fallbackHost: 'lan.example.com',
        }),
      ).rejects.toThrow(QUI_KEY_REJECTED_MESSAGE);
      expect(mockApp.getVersion).toHaveBeenCalledTimes(1);
    });

    it('never puts the key in a connectivity log line', async () => {
      const { clogInfo, clogWarn, clogError } = jest.requireMock('@/services/connectivity-log');
      mockApp.getVersion.mockResolvedValueOnce({ version: '5.0', apiVersion: '2.11' });
      await ServerManager.connectToServer(quiServer);
      mockApp.getVersion.mockRejectedValueOnce(new Error(QUI_KEY_REJECTED_MESSAGE));
      await ServerManager.connectToServer(quiServer).catch(() => undefined);
      const logged = [clogInfo, clogWarn, clogError]
        .flatMap((fn) => fn.mock.calls)
        .map((call: unknown[]) => String(call[1]))
        .join('\n');
      expect(logged).not.toContain('quikey123');
    });
  });

  describe('connectToServer (with fallback)', () => {
    const serverWithFallback = makeServer({
      useFallback: true,
      fallbackHost: 'fallback.example.com',
      fallbackPort: 9090,
    });

    it('falls back when primary fails with a network error', async () => {
      const netErr = new AxiosError('timeout');
      netErr.code = 'ECONNABORTED';
      mockAuth.login.mockRejectedValueOnce(netErr);
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockApp.getVersion.mockResolvedValueOnce({ version: '4.5', apiVersion: '2.9' });

      const result = await ServerManager.connectToServer(serverWithFallback);
      expect(result).toBe(true);
      expect(mockAuth.login).toHaveBeenCalledTimes(2);
    });

    it('does not fall back on a non-network primary error', async () => {
      mockAuth.login.mockRejectedValueOnce(
        new Error('Authentication failed. Please check your credentials.'),
      );
      await expect(ServerManager.connectToServer(serverWithFallback)).rejects.toThrow(
        'Authentication failed',
      );
      expect(mockAuth.login).toHaveBeenCalledTimes(1);
    });

    it('throws the fallback error when both endpoints fail', async () => {
      const netErr = new AxiosError('timeout');
      netErr.code = 'ECONNABORTED';
      mockAuth.login.mockRejectedValueOnce(netErr);
      const netErr2 = new AxiosError('timeout2');
      netErr2.code = 'ECONNABORTED';
      mockAuth.login.mockRejectedValueOnce(netErr2);

      await expect(ServerManager.connectToServer(serverWithFallback)).rejects.toThrow();
      expect(mockAuth.login).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCurrentServer / disconnect / reconnect', () => {
    it('getCurrentServer delegates to storageService', async () => {
      mockStorage.getCurrentServer.mockResolvedValueOnce(makeServer());
      const result = await ServerManager.getCurrentServer();
      expect(result?.id).toBe('s1');
    });

    it('disconnect logs out and clears the api client but keeps the last server id', async () => {
      mockApiClient.getServer.mockReturnValue(makeServer());
      mockAuth.logout.mockResolvedValueOnce(undefined);
      await ServerManager.disconnect();
      expect(mockAuth.logout).toHaveBeenCalled();
      expect(mockApiClient.setServer).toHaveBeenCalledWith(null);
      expect(mockStorage.setCurrentServerId).not.toHaveBeenCalled();
    });

    it('disconnect records the manual disconnect so startup auto-connect skips it', async () => {
      mockApiClient.getServer.mockReturnValue(makeServer());
      mockAuth.logout.mockResolvedValueOnce(undefined);
      await ServerManager.disconnect();
      expect(mockStorage.setManualDisconnect).toHaveBeenCalledWith(true);
    });

    it('disconnect swallows logout errors', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockAuth.logout.mockRejectedValueOnce(new Error('logout failed'));
      await expect(ServerManager.disconnect()).resolves.toBeUndefined();
      expect(mockApiClient.setServer).toHaveBeenCalledWith(null);
    });

    it('disconnect skips logout for API-key servers (auth endpoints reject Bearer keys)', async () => {
      mockApiClient.getServer.mockReturnValue(
        makeServer({ useApiKey: true, apiKey: 'qbt_thekey' }),
      );
      await ServerManager.disconnect();
      expect(mockAuth.logout).not.toHaveBeenCalled();
      expect(mockApiClient.setServer).toHaveBeenCalledWith(null);
    });

    it('disconnect skips logout for qui proxy servers (qui owns the real session)', async () => {
      mockApiClient.getServer.mockReturnValue(makeServer({ useQuiProxy: true, quiProxyKey: 'k' }));
      await ServerManager.disconnect();
      expect(mockAuth.logout).not.toHaveBeenCalled();
      expect(mockApiClient.setServer).toHaveBeenCalledWith(null);
    });

    it('disconnect cancels in-flight requests instead of waiting out a hung logout (#254)', async () => {
      mockApiClient.getServer.mockReturnValue(makeServer());
      // A logout that never resolves — simulates an unreachable server. If
      // disconnect() awaited it directly (instead of firing it and calling
      // abortInFlight()), this test would hang.
      mockAuth.logout.mockReturnValueOnce(new Promise(() => {}));
      await ServerManager.disconnect();
      expect(mockApiClient.abortInFlight).toHaveBeenCalled();
      expect(mockApiClient.setServer).toHaveBeenCalledWith(null);
    });

    it('reconnect returns false when no current server', async () => {
      mockStorage.getCurrentServer.mockResolvedValueOnce(null);
      const result = await ServerManager.reconnect();
      expect(result).toBe(false);
    });

    it('reconnect connects to the current server', async () => {
      mockStorage.getCurrentServer.mockResolvedValueOnce(makeServer());
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockApp.getVersion.mockResolvedValueOnce({ version: '4.5', apiVersion: '2.9' });
      const result = await ServerManager.reconnect();
      expect(result).toBe(true);
    });
  });

  describe('testConnection (primary only)', () => {
    it('returns success on happy path', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockIsolatedClient.get.mockResolvedValueOnce('v4.5.0');
      const result = await ServerManager.testConnection(makeServer());
      expect(result.success).toBe(true);
      // Tested on an isolated client — the live session is never touched.
      expect(mockApiClient.setServer).not.toHaveBeenCalled();
      expect(mockApiClient.createIsolatedClient).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'example.com' }),
      );
      expect(mockAuth.login).toHaveBeenCalledWith('admin', 'secret', undefined, mockIsolatedClient);
    });

    it('skips login when bypassAuth is set', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockIsolatedClient.get.mockResolvedValueOnce('v4.5.0');
      const result = await ServerManager.testConnection(makeServer({ bypassAuth: true }));
      expect(result.success).toBe(true);
      expect(mockAuth.login).not.toHaveBeenCalled();
    });

    it('returns failure when login status is not Ok', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockAuth.login.mockResolvedValueOnce({ status: 'Fails' });
      const result = await ServerManager.testConnection(makeServer());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Authentication failed/);
    });

    it('returns auth failure message on 401/403', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      const err = new AxiosError('forbidden');
      err.response = { status: 401 } as never;
      mockAuth.login.mockRejectedValueOnce(err);
      const result = await ServerManager.testConnection(makeServer());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Authentication failed/);
    });

    it('returns network failure message on network error', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      const err = new AxiosError('timeout');
      err.code = 'ECONNABORTED';
      mockAuth.login.mockRejectedValueOnce(err);
      const result = await ServerManager.testConnection(makeServer());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Connection failed/);
    });

    it('returns raw message for other errors', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockAuth.login.mockRejectedValueOnce(new Error('weird'));
      const result = await ServerManager.testConnection(makeServer());
      expect(result.success).toBe(false);
      expect(result.error).toBe('weird');
    });

    it('rethrows AbortError/CanceledError', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      mockAuth.login.mockRejectedValueOnce(abortErr);
      await expect(ServerManager.testConnection(makeServer())).rejects.toThrow('aborted');
    });

    it('skips login when useApiKey is set', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockIsolatedClient.get.mockResolvedValueOnce('v5.2.0');
      const result = await ServerManager.testConnection(
        makeServer({ useApiKey: true, apiKey: 'qbt_thekey' }),
      );
      expect(result.success).toBe(true);
      expect(mockAuth.login).not.toHaveBeenCalled();
    });
  });

  describe('testConnection (qui proxy, #272)', () => {
    const quiServer = makeServer({
      useQuiProxy: true,
      quiProxyKey: 'quikey123',
      username: '',
      password: '',
    });

    it('skips login and succeeds on a version response', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockIsolatedClient.get.mockResolvedValueOnce('v5.0.0');
      const result = await ServerManager.testConnection(quiServer);
      expect(result.success).toBe(true);
      expect(mockAuth.login).not.toHaveBeenCalled();
    });

    it('reports qui\'s key rejection verbatim rather than "check your credentials"', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockIsolatedClient.get.mockRejectedValueOnce(
        Object.assign(new Error(QUI_KEY_REJECTED_MESSAGE), { status: 401 }),
      );
      const result = await ServerManager.testConnection(quiServer);
      expect(result).toEqual({ success: false, error: QUI_KEY_REJECTED_MESSAGE });
    });

    it('reports a missing key without making a request', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      const result = await ServerManager.testConnection({ ...quiServer, quiProxyKey: '' });
      expect(result).toEqual({ success: false, error: QUI_KEY_MISSING_MESSAGE });
      expect(mockIsolatedClient.get).not.toHaveBeenCalled();
    });
  });

  describe('testConnection (with fallback)', () => {
    const serverWithFallback = makeServer({
      useFallback: true,
      fallbackHost: 'fallback.example.com',
      fallbackPort: 9090,
    });

    it('succeeds when primary succeeds', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockIsolatedClient.get.mockResolvedValueOnce('v4.5.0');
      const result = await ServerManager.testConnection(serverWithFallback);
      expect(result.success).toBe(true);
      expect(result.primary?.success).toBe(true);
      // Only primary attempted since it succeeded first — actually implementation always tests both.
    });

    it('succeeds when primary fails but fallback succeeds', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockAuth.login.mockResolvedValueOnce({ status: 'Fails' });
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockIsolatedClient.get.mockResolvedValueOnce('v4.5.0');
      const result = await ServerManager.testConnection(serverWithFallback);
      expect(result.success).toBe(true);
      expect(result.fallback?.success).toBe(true);
    });

    it('fails when both endpoints fail, reporting fallback error preferentially', async () => {
      mockApiClient.getServer.mockReturnValue(null);
      mockAuth.login.mockResolvedValueOnce({ status: 'Fails' });
      mockAuth.login.mockResolvedValueOnce({ status: 'Fails' });
      const result = await ServerManager.testConnection(serverWithFallback);
      expect(result.success).toBe(false);
      expect(result.primary?.success).toBe(false);
      expect(result.fallback?.success).toBe(false);
    });
  });

  describe('stale connect attempts (#audit-4)', () => {
    function deferred<T>() {
      let resolve!: (v: T) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('a superseded attempt does not clear the client the newer connect set up', async () => {
      const staleLogin = deferred<{ status: 'Ok' | 'Fails' }>();
      mockAuth.login.mockReturnValueOnce(staleLogin.promise);
      const stale = ServerManager.connectToServer(makeServer({ id: 'A', host: 'a.example' }));

      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockApp.getVersion.mockResolvedValueOnce({ version: '5.0', apiVersion: '2.11' });
      await expect(
        ServerManager.connectToServer(makeServer({ id: 'B', host: 'b.example' })),
      ).resolves.toBe(true);

      mockApiClient.setServer.mockClear();
      staleLogin.reject(new Error('Request canceled.'));
      await expect(stale).rejects.toThrow(CONNECT_SUPERSEDED_MESSAGE);
      expect(mockApiClient.setServer).not.toHaveBeenCalled();
      expect(mockStorage.setCurrentServerId).toHaveBeenLastCalledWith('B');
    });

    it('a superseded attempt never tries its fallback endpoint', async () => {
      const staleLogin = deferred<{ status: 'Ok' | 'Fails' }>();
      mockAuth.login.mockReturnValueOnce(staleLogin.promise);
      const stale = ServerManager.connectToServer(
        makeServer({ id: 'A', useFallback: true, fallbackHost: 'lan.example' }),
      );
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockApp.getVersion.mockResolvedValueOnce({ version: '5.0', apiVersion: '2.11' });
      await ServerManager.connectToServer(makeServer({ id: 'B' }));

      const netErr = new AxiosError('timeout');
      netErr.code = 'ECONNABORTED';
      staleLogin.reject(netErr);
      await expect(stale).rejects.toThrow(CONNECT_SUPERSEDED_MESSAGE);
      expect(mockAuth.login).toHaveBeenCalledTimes(2);
      expect(mockApiClient.setServer).not.toHaveBeenCalledWith(
        expect.objectContaining({ host: 'lan.example' }),
      );
    });

    it('a connect that succeeds after a disconnect does not record itself as current', async () => {
      const version = deferred<{ version: string; apiVersion: string }>();
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      mockApp.getVersion.mockReturnValueOnce(version.promise);
      const stale = ServerManager.connectToServer(makeServer());
      await Promise.resolve();
      await Promise.resolve();

      mockApiClient.getServer.mockReturnValue(null);
      await ServerManager.disconnect();
      mockApiClient.setServer.mockClear();

      version.resolve({ version: '5.0', apiVersion: '2.11' });
      const error = await stale.catch((e: unknown) => e);
      expect(isConnectSuperseded(error)).toBe(true);
      expect(mockStorage.setCurrentServerId).not.toHaveBeenCalled();
      expect(mockApiClient.setApiVersion).not.toHaveBeenCalled();
      expect(mockApiClient.setServer).not.toHaveBeenCalled();
    });

    it('a canceled request on the current attempt is rethrown, not reported as a login failure', async () => {
      mockAuth.login.mockRejectedValueOnce(new Error('Request canceled.'));
      await expect(ServerManager.connectToServer(makeServer())).rejects.toThrow(
        'Request canceled.',
      );
      expect(mockApiClient.setServer).toHaveBeenLastCalledWith(null);
    });
  });

  describe('importServers keeps allowInsecureCert', () => {
    it("keeps this device's self-signed-certificate choice on update", async () => {
      mockStorage.getServers.mockResolvedValueOnce([makeServer({ allowInsecureCert: true })]);
      await ServerManager.importServers([makeServer({ host: 'moved.example' })]);
      expect(mockStorage.saveServer).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'moved.example', allowInsecureCert: true }),
      );
    });
  });

  describe('self-signed certificate allowlist', () => {
    const mockSetHosts = setInsecureCertAllowedHosts as jest.Mock;

    it('feeds bare hostnames (no path, port or trailing dot) to the native allowlist', async () => {
      mockStorage.getServers.mockResolvedValueOnce([
        makeServer({ host: 'https://NAS.example.com:8443/qbit', allowInsecureCert: true }),
        makeServer({
          id: 's2',
          host: '[fd00::1]:8080',
          allowInsecureCert: true,
          useFallback: true,
          fallbackHost: 'lan.example.',
        }),
        makeServer({ id: 's3', host: 'untrusted.example', allowInsecureCert: false }),
      ]);
      await ServerManager.getServers();
      expect(mockSetHosts).toHaveBeenLastCalledWith([
        'nas.example.com',
        'fd00::1',
        '[fd00::1]',
        'lan.example',
        'lan.example.',
      ]);
    });

    it('drops an unsaved server from the allowlist once its test finishes', async () => {
      mockStorage.getServers.mockResolvedValue([]);
      mockApp.getVersion.mockResolvedValue({ version: '5.0', apiVersion: '2.11' });
      mockAuth.login.mockResolvedValueOnce({ status: 'Ok' });
      await ServerManager.testConnection(
        makeServer({ host: 'selfsigned.example', allowInsecureCert: true }),
      );
      expect(mockSetHosts).toHaveBeenCalledWith(['selfsigned.example']);
      expect(mockSetHosts).toHaveBeenLastCalledWith([]);
    });
  });
});
