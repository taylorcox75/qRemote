const mockAsyncStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] ?? null)),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
}));

const mockSecureStore: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore[key] = value;
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore[key] ?? null)),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockSecureStore[key];
    return Promise.resolve();
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService } from '@/services/storage';
import type { ServerConfig } from '@/types/api';

function makeServer(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    id: 's1',
    name: 'Test',
    host: 'https://example.com/',
    port: 8080,
    username: 'admin',
    password: 'secret',
    useHttps: true,
    bypassAuth: false,
    ...overrides,
  };
}

describe('storageService', () => {
  beforeEach(() => {
    Object.keys(mockAsyncStorage).forEach((k) => delete mockAsyncStorage[k]);
    Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
    jest.clearAllMocks();
  });

  describe('saveServer / getServers', () => {
    it('saves a new server and strips protocol from host', async () => {
      await storageService.saveServer(makeServer());
      const servers = await storageService.getServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].host).toBe('example.com');
      expect(servers[0].password).toBe('secret');
    });

    it('does not persist password in AsyncStorage', async () => {
      await storageService.saveServer(makeServer());
      const raw = JSON.parse(mockAsyncStorage['servers']);
      expect(raw[0].password).toBe('');
      expect(raw[0].basicAuthPassword).toBe('');
    });

    it('stores password securely via SecureStore', async () => {
      await storageService.saveServer(makeServer());
      expect(mockSecureStore['server_password_s1']).toBe('secret');
    });

    it('updates existing server instead of duplicating', async () => {
      await storageService.saveServer(makeServer({ name: 'First' }));
      await storageService.saveServer(makeServer({ name: 'Second' }));
      const servers = await storageService.getServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Second');
    });

    it('omits port when 0 or negative', async () => {
      await storageService.saveServer(makeServer({ port: 0 }));
      const servers = await storageService.getServers();
      expect(servers[0].port).toBeUndefined();
    });

    it('persists basicAuth fields separately, storing password in SecureStore', async () => {
      await storageService.saveServer(
        makeServer({ useBasicAuth: true, basicAuthUsername: 'proxyuser', basicAuthPassword: 'proxypass' })
      );
      const servers = await storageService.getServers();
      expect(servers[0].useBasicAuth).toBe(true);
      expect(servers[0].basicAuthUsername).toBe('proxyuser');
      expect(servers[0].basicAuthPassword).toBe('proxypass');
      const raw = JSON.parse(mockAsyncStorage['servers']);
      expect(raw[0].basicAuthPassword).toBe('');
    });

    it('getServers returns [] when nothing stored', async () => {
      const servers = await storageService.getServers();
      expect(servers).toEqual([]);
    });

    it('getServers returns [] and swallows errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      const servers = await storageService.getServers();
      expect(servers).toEqual([]);
    });

    it('saveServer rethrows on failure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
      await expect(storageService.saveServer(makeServer())).rejects.toThrow('disk full');
    });
  });

  describe('getServer', () => {
    it('returns matching server', async () => {
      await storageService.saveServer(makeServer());
      const server = await storageService.getServer('s1');
      expect(server?.id).toBe('s1');
    });

    it('returns null when not found', async () => {
      const server = await storageService.getServer('missing');
      expect(server).toBeNull();
    });
  });

  describe('deleteServer', () => {
    it('removes server from list and secure store', async () => {
      await storageService.saveServer(makeServer());
      await storageService.deleteServer('s1');
      const servers = await storageService.getServers();
      expect(servers).toEqual([]);
      expect(mockSecureStore['server_password_s1']).toBeUndefined();
    });

    it('clears currentServerId when deleting the current server', async () => {
      await storageService.saveServer(makeServer());
      await storageService.setCurrentServerId('s1');
      await storageService.deleteServer('s1');
      const currentId = await storageService.getCurrentServerId();
      expect(currentId).toBeNull();
    });

    it('leaves currentServerId untouched when deleting a different server', async () => {
      await storageService.saveServer(makeServer());
      await storageService.saveServer(makeServer({ id: 's2' }));
      await storageService.setCurrentServerId('s1');
      await storageService.deleteServer('s2');
      const currentId = await storageService.getCurrentServerId();
      expect(currentId).toBe('s1');
    });
  });

  describe('current server id', () => {
    it('sets and gets current server id', async () => {
      await storageService.setCurrentServerId('s1');
      expect(await storageService.getCurrentServerId()).toBe('s1');
    });

    it('removes the key when set to null', async () => {
      await storageService.setCurrentServerId('s1');
      await storageService.setCurrentServerId(null);
      expect(await storageService.getCurrentServerId()).toBeNull();
    });

    it('getCurrentServer resolves the full server object', async () => {
      await storageService.saveServer(makeServer());
      await storageService.setCurrentServerId('s1');
      const server = await storageService.getCurrentServer();
      expect(server?.id).toBe('s1');
    });

    it('getCurrentServer returns null when no current id is set', async () => {
      const server = await storageService.getCurrentServer();
      expect(server).toBeNull();
    });
  });

  describe('preferences', () => {
    it('saves and retrieves preferences', async () => {
      await storageService.savePreferences({ theme: 'dark' } as never);
      const prefs = await storageService.getPreferences();
      expect(prefs).toEqual({ theme: 'dark' });
    });

    it('returns {} when nothing stored', async () => {
      const prefs = await storageService.getPreferences();
      expect(prefs).toEqual({});
    });

    it('returns {} and swallows errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      const prefs = await storageService.getPreferences();
      expect(prefs).toEqual({});
    });
  });
});
