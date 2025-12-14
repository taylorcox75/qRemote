import { ServerConfig } from '../types/api';
import { storageService } from './storage';
import { apiClient } from './api/client';
import { authApi } from './api/auth';
import { applicationApi } from './api/application';

export class ServerManager {
  /**
   * Add or update a server
   */
  static async saveServer(server: ServerConfig): Promise<void> {
    await storageService.saveServer(server);
  }

  /**
   * Get all saved servers
   */
  static async getServers(): Promise<ServerConfig[]> {
    return await storageService.getServers();
  }

  /**
   * Get server by ID
   */
  static async getServer(id: string): Promise<ServerConfig | null> {
    return await storageService.getServer(id);
  }

  /**
   * Delete a server
   */
  static async deleteServer(id: string): Promise<void> {
    const currentServer = apiClient.getServer();
    if (currentServer?.id === id) {
      // Disconnect from this server
      apiClient.setServer(null);
      await storageService.setCurrentServerId(null);
    }
    await storageService.deleteServer(id);
  }

  /**
   * Connect to a server (set as current and authenticate)
   */
  static async connectToServer(server: ServerConfig): Promise<boolean> {
    try {
      // Set server in API client
      apiClient.setServer(server);

      // Skip authentication if bypassAuth is enabled
      if (server.bypassAuth) {
        // For bypass auth, still verify the connection works by making a test API call
        try {
          await applicationApi.getVersion();
          // Connection verified, save as current server
          await storageService.setCurrentServerId(server.id);
          return true;
        } catch (error: any) {
          // Connection test failed, clear server
          apiClient.setServer(null);
          // Re-throw network/connection errors so they can be handled by the caller
          if (error.message?.includes('timeout') || error.message?.includes('Connection') || error.message?.includes('Network')) {
            throw error;
          }
          throw new Error('Failed to connect to server. Please check your settings.');
        }
      }

      // Attempt login
      const loginResult = await authApi.login(server.username, server.password);
      
      if (loginResult.status === 'Ok') {
        // Verify connection by making a test API call
        try {
          await applicationApi.getVersion();
          // Connection verified, save as current server
          await storageService.setCurrentServerId(server.id);
          return true;
        } catch (error: any) {
          // Connection test failed, clear server
          apiClient.setServer(null);
          // Re-throw network/connection errors so they can be handled by the caller
          if (error.message?.includes('timeout') || error.message?.includes('Connection') || error.message?.includes('Network')) {
            throw error;
          }
          // Authentication error means login didn't actually work
          if (error.message?.includes('Authentication') || error.response?.status === 403) {
            throw new Error('Authentication failed. Please check your credentials.');
          }
          throw new Error('Failed to connect to server. Please check your settings.');
        }
      }
      
      // Login failed, clear server
      apiClient.setServer(null);
      return false;
    } catch (error: any) {
      apiClient.setServer(null);
      // Re-throw network/connection errors so they can be handled by the caller
      if (error.message?.includes('timeout') || error.message?.includes('Connection') || error.message?.includes('Network')) {
        throw error;
      }
      // Re-throw if it's already a formatted error message
      if (error.message && (error.message.includes('Failed to connect') || error.message.includes('Authentication failed'))) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Get current connected server
   */
  static async getCurrentServer(): Promise<ServerConfig | null> {
    return await storageService.getCurrentServer();
  }

  /**
   * Disconnect from current server
   */
  static async disconnect(): Promise<void> {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore logout errors
    }
    apiClient.setServer(null);
    await storageService.setCurrentServerId(null);
  }

  /**
   * Reconnect to current server (if one is set)
   */
  static async reconnect(): Promise<boolean> {
    const currentServer = await storageService.getCurrentServer();
    if (!currentServer) {
      return false;
    }
    return await this.connectToServer(currentServer);
  }
}

