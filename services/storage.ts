import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ServerConfig } from '@/types/api';
import { AppPreferences } from '@/types/preferences';

const STORAGE_KEYS = {
  SERVERS: 'servers',
  CURRENT_SERVER_ID: 'current_server_id',
  PREFERENCES: 'preferences',
} as const;

const stripProtocol = (host: string): string =>
  (host || '').replace(/^(https?:\/\/)/i, '').replace(/\/+$/, '');

export const storageService = {
  /**
   * Save server configuration
   * Password is stored securely in SecureStore
   */
  async saveServer(server: ServerConfig): Promise<void> {
    try {
      const servers = await this.getServers();
      const existingIndex = servers.findIndex((s) => s.id === server.id);
      
      let updatedServers: ServerConfig[];
      if (existingIndex >= 0) {
        updatedServers = [...servers];
        updatedServers[existingIndex] = server;
      } else {
        updatedServers = [...servers, server];
      }

      // Store server config without password
      const serversWithoutPasswords = updatedServers.map(s => ({
        id: s.id,
        name: s.name,
        host: stripProtocol(s.host || ''),
        port: (s.port && s.port > 0) ? s.port : undefined,
        basePath: s.basePath || '/',
        username: s.username,
        password: '', // Don't store password in AsyncStorage
        useHttps: s.useHttps || false,
        bypassAuth: s.bypassAuth || false,
        // Fallback endpoint (optional). Only persisted when a fallback host
        // is configured; absent fields naturally mean fallback is disabled.
        useFallback: s.useFallback || false,
        fallbackHost: stripProtocol(s.fallbackHost || ''),
        fallbackPort: (s.fallbackPort && s.fallbackPort > 0) ? s.fallbackPort : undefined,
        fallbackUseHttps: s.fallbackUseHttps || false,
        fallbackBasePath: s.fallbackBasePath || undefined,
        // Proxy Basic Auth (password stored separately in SecureStore)
        useBasicAuth: s.useBasicAuth || false,
        basicAuthUsername: s.basicAuthUsername || '',
        basicAuthPassword: '', // Don't store password in AsyncStorage
      }));
      
      await AsyncStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(serversWithoutPasswords));
      
      // Store passwords securely
      await SecureStore.setItemAsync(`server_password_${server.id}`, server.password);
      await SecureStore.setItemAsync(`server_basic_auth_password_${server.id}`, server.basicAuthPassword ?? '');
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get all servers
   */
  async getServers(): Promise<ServerConfig[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SERVERS);
      if (!data) return [];

      const servers: Omit<ServerConfig, 'password'>[] = JSON.parse(data);
      
      // Retrieve passwords from SecureStore, normalize host (strip protocol from legacy data)
      // Each secret is read in its own try/catch: SecureStore throws (rather than
      // resolving null) when an item can't be decrypted — e.g. after a device
      // restore or a keychain migration. Letting that reject would take down the
      // whole Promise.all and drop the caller into the outer catch, so a single
      // unreadable password would make *every* saved server disappear from the UI.
      // Degrading to an empty password keeps the server listed; the connect
      // attempt then fails with a credential error the user can actually act on.
      const readSecret = async (key: string): Promise<string> => {
        try {
          return (await SecureStore.getItemAsync(key)) || '';
        } catch {
          return '';
        }
      };

      const serversWithPasswords = await Promise.all(
        servers.map(async (server) => {
          const password = await readSecret(`server_password_${server.id}`);
          const basicAuthPassword = await readSecret(`server_basic_auth_password_${server.id}`);
          return {
            ...server,
            password,
            basicAuthPassword,
            host: stripProtocol(server.host || ''),
            fallbackHost: server.fallbackHost ? stripProtocol(server.fallbackHost) : server.fallbackHost,
          };
        })
      );

      return serversWithPasswords;
    } catch (error) {
      return [];
    }
  },

  /**
   * Get server by ID
   */
  async getServer(id: string): Promise<ServerConfig | null> {
    const servers = await this.getServers();
    return servers.find((s) => s.id === id) || null;
  },

  /**
   * Delete server
   */
  async deleteServer(id: string): Promise<void> {
    const servers = await this.getServers();
    const filtered = servers.filter((s) => s.id !== id);
    
    // getServers() rehydrates BOTH secrets from SecureStore, so every field that
    // holds a credential has to be blanked again before this goes back into
    // AsyncStorage — see saveServer above, which does the same. Missing
    // basicAuthPassword here leaked the proxy password of every surviving server
    // into unencrypted storage on each delete.
    await AsyncStorage.setItem(
      STORAGE_KEYS.SERVERS,
      JSON.stringify(filtered.map(s => ({ ...s, password: '', basicAuthPassword: '' })))
    );
    
    // Remove passwords from SecureStore
    await SecureStore.deleteItemAsync(`server_password_${id}`);
    await SecureStore.deleteItemAsync(`server_basic_auth_password_${id}`);
    
    // If this was the current server, clear it
    const currentId = await this.getCurrentServerId();
    if (currentId === id) {
      await this.setCurrentServerId(null);
    }
  },

  /**
   * Set current server ID
   */
  async setCurrentServerId(id: string | null): Promise<void> {
    if (id) {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_SERVER_ID, id);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_SERVER_ID);
    }
  },

  /**
   * Get current server ID
   */
  async getCurrentServerId(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_SERVER_ID);
  },

  /**
   * Get current server
   */
  async getCurrentServer(): Promise<ServerConfig | null> {
    const id = await this.getCurrentServerId();
    if (!id) return null;
    return await this.getServer(id);
  },

  /**
   * Save preferences
   */
  async savePreferences(preferences: Partial<AppPreferences>): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
  },

  /**
   * Get preferences
   */
  async getPreferences(): Promise<Partial<AppPreferences>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      return data ? (JSON.parse(data) as Partial<AppPreferences>) : {};
    } catch (error) {
      return {};
    }
  },
};

