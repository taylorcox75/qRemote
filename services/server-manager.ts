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
          // Check error codes/types first, then fall back to message string matching
          const isNetworkError = error.code === 'ECONNABORTED' || 
                                 error.code === 'ERR_NETWORK' || 
                                 error.code === 'ETIMEDOUT' ||
                                 error.response?.status >= 500 ||
                                 error.message?.includes('timeout') || 
                                 error.message?.includes('Connection') || 
                                 error.message?.includes('Network');
          if (isNetworkError) {
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
          // Check error codes/types first, then fall back to message string matching
          const isNetworkError = error.code === 'ECONNABORTED' || 
                                 error.code === 'ERR_NETWORK' || 
                                 error.code === 'ETIMEDOUT' ||
                                 error.response?.status >= 500 ||
                                 error.message?.includes('timeout') || 
                                 error.message?.includes('Connection') || 
                                 error.message?.includes('Network');
          if (isNetworkError) {
            throw error;
          }
          // Authentication error means login didn't actually work
          // Check status code first, then fall back to message string matching
          if (error.response?.status === 403 || error.response?.status === 401 || error.message?.includes('Authentication')) {
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
      // Check error codes/types first, then fall back to message string matching
      const isNetworkError = error.code === 'ECONNABORTED' || 
                             error.code === 'ERR_NETWORK' || 
                             error.code === 'ETIMEDOUT' ||
                             error.response?.status >= 500 ||
                             error.message?.includes('timeout') || 
                             error.message?.includes('Connection') || 
                             error.message?.includes('Network');
      if (isNetworkError) {
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

  /**
   * Test connection to a server without saving it
   * Returns a result object with success status and error message if failed
   */
  static async testConnection(server: ServerConfig, signal?: AbortSignal): Promise<{ success: boolean; error?: string }> {
    const previousServer = apiClient.getServer();
    
    try {
      // Set server temporarily for testing
      apiClient.setServer(server);

      try {
        if (!server.bypassAuth) {
          // Attempt login with abort signal
          const loginResult = await authApi.login(server.username, server.password, signal);
          if (loginResult.status !== 'Ok') {
            return { success: false, error: 'Authentication failed. Please check your username and password.' };
          }
        }

        // Check if aborted
        if (signal?.aborted) {
          throw new Error('Test cancelled');
        }

        // Verify connection by making a test API call with abort signal
        await applicationApi.getVersion(signal);
        
        return { success: true };
      } catch (error: any) {
        // Handle cancellation - check for axios cancel errors
        if (error.name === 'AbortError' || 
            error.name === 'CanceledError' || 
            error.code === 'ERR_CANCELED' ||
            error.message === 'Test cancelled' ||
            error.message?.includes('cancel')) {
          throw error;
        }
        
        // Provide more specific error messages
        // Check status codes first, then error codes, then fall back to message string matching
        if (error.response?.status === 403 || error.response?.status === 401 || error.message?.includes('Authentication')) {
          return { success: false, error: 'Authentication failed. Please check your credentials.' };
        } else if (error.code === 'ECONNABORTED' || 
                   error.code === 'ERR_NETWORK' || 
                   error.code === 'ETIMEDOUT' ||
                   error.response?.status >= 500 ||
                   error.message?.includes('timeout') || 
                   error.message?.includes('Connection') || 
                   error.message?.includes('Network')) {
          return { success: false, error: 'Connection failed. Please check your server address and network connection.' };
        } else {
          return { success: false, error: error.message || 'Connection test failed. Please check your settings.' };
        }
      } finally {
        // Restore previous server state
        apiClient.setServer(previousServer);
      }
    } catch (error: any) {
      // Ensure cleanup even if outer try fails
      apiClient.setServer(previousServer);
      // Re-throw cancellation errors
      if (error.name === 'AbortError' || 
          error.name === 'CanceledError' || 
          error.code === 'ERR_CANCELED' ||
          error.message === 'Test cancelled' ||
          error.message?.includes('cancel')) {
        throw error;
      }
      return { success: false, error: error.message || 'Connection test failed. Please check your settings.' };
    }
  }
}

