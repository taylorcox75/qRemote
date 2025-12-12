import { apiClient } from './client';
import { LoginResponse } from '../../types/api';

const API_VERSION = 'v2';

export const authApi = {
  /**
   * Login to qBittorrent WebUI
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      // Clear any existing cookies before login
      apiClient.clearCookies();
      
      const response = await apiClient.postUrlEncoded(`/api/${API_VERSION}/auth/login`, {
        username,
        password,
      });
      
      // Check if cookies were set after login
      const cookies = apiClient.getCookies();
      
      // qBittorrent returns 'Ok.' on success, 'Fails.' on failure
      // Handle both string and trimmed string responses
      const responseStr = typeof response === 'string' ? response.trim() : String(response).trim();
      if (responseStr === 'Ok.' || responseStr === 'Ok') {
        return { status: 'Ok' };
      }
      return { status: 'Fails' };
    } catch (error: any) {
      // Re-throw network/connection errors as-is
      if (error.message?.includes('timeout') || error.message?.includes('Connection') || error.message?.includes('Network')) {
        throw error;
      }
      // For other errors, return Fails status
      return { status: 'Fails' };
    }
  },

  /**
   * Logout from qBittorrent WebUI
   */
  async logout(): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/auth/logout`, {});
    apiClient.clearCookies();
  },
};

