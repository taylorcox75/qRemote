import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ServerConfig } from '../types/api';

const STORAGE_KEYS = {
  SERVERS: 'servers',
  CURRENT_SERVER_ID: 'current_server_id',
  PREFERENCES: 'preferences',
} as const;

const stripProtocol = (host: string): string =>
  (host || '').replace(/^(https?:\/\/)/i, '');

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
      }));
      
      await AsyncStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(serversWithoutPasswords));
      
      // Store password securely
      await SecureStore.setItemAsync(`server_password_${server.id}`, server.password);
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
      const serversWithPasswords = await Promise.all(
        servers.map(async (server) => {
          const password = await SecureStore.getItemAsync(`server_password_${server.id}`) || '';
          return { ...server, password, host: stripProtocol(server.host || '') };
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
    
    await AsyncStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(filtered.map(s => ({ ...s, password: '' }))));
    
    // Remove password from SecureStore
    await SecureStore.deleteItemAsync(`server_password_${id}`);
    
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
  async savePreferences(preferences: Record<string, any>): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
  },

  /**
   * Get preferences
   */
  async getPreferences(): Promise<Record<string, any>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      return {};
    }
  },
};

