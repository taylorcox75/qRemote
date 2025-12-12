import { ServerConfig } from '../types/api';
import { storageService } from './storage';
import { apiClient } from './api/client';
import { authApi } from './api/auth';

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

      // Attempt login
      const loginResult = await authApi.login(server.username, server.password);
      
      if (loginResult.status === 'Ok') {
        // Save as current server
        await storageService.setCurrentServerId(server.id);
        return true;
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

