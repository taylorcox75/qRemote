import { apiClient } from './client';
import { LoginResponse } from '../../types/api';
import { clogInfo, clogWarn, clogError, clogDebug } from '../connectivity-log';

const API_VERSION = 'v2';

export const authApi = {
  /**
   * Login to qBittorrent WebUI
   * Compatible with qBittorrent 4.x and 5.x
   */
  async login(username: string, password: string, signal?: AbortSignal): Promise<LoginResponse> {
    try {
      // Clear any existing cookies before login
      apiClient.clearCookies();
      clogInfo('AUTH', `Login attempt for user "${username}"`);
      
      const response = await apiClient.postUrlEncoded(`/api/${API_VERSION}/auth/login`, {
        username,
        password,
      }, signal);
      
      // Check if cookies were set after login
      const cookies = apiClient.getCookies();
      const csrfToken = apiClient.getCsrfToken();
      
      // Log for debugging (helps diagnose qBittorrent 5.x issues)
      const responsePreview = typeof response === 'string' ? response.substring(0, 50) : 'non-string response';
      console.log('[Auth] Login response:', responsePreview);
      console.log('[Auth] Cookies received:', cookies ? 'Yes (' + cookies.length + ' chars)' : 'No');
      console.log('[Auth] CSRF token received:', csrfToken ? 'Yes' : 'No');

      clogDebug('AUTH', `Response: "${responsePreview}" | Cookies: ${cookies ? 'Yes (' + cookies.length + ' chars)' : 'No'} | CSRF: ${csrfToken ? 'Yes' : 'No'}`);
      
      // qBittorrent returns 'Ok.' on success, 'Fails.' on failure
      // Handle both string and trimmed string responses
      const responseStr = typeof response === 'string' ? response.trim() : String(response).trim();
      
      if (responseStr === 'Ok.' || responseStr === 'Ok') {
        // Successful login - verify we have session cookies
        if (!cookies || cookies.length === 0) {
          console.warn('[Auth] Warning: Login succeeded but no cookies received. This may cause issues with qBittorrent 5.x');
          clogWarn('AUTH', 'Login succeeded but no session cookies received — may cause issues with qBittorrent 5.x');
        }
        clogInfo('AUTH', 'Login successful');
        return { status: 'Ok' };
      }
      
      console.warn('[Auth] Login failed with response:', responseStr);
      clogWarn('AUTH', `Login failed — server responded: "${responseStr}"`);
      return { status: 'Fails' };
    } catch (error: any) {
      // Re-throw abort errors immediately
      if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        throw error;
      }
      
      // Log error details for debugging (warn, not error, to avoid scary stack traces)
      const statusHint = error.response?.status ? ` (HTTP ${error.response.status})` : '';
      console.warn('[Auth] Login error:', error.message, statusHint);
      clogError('AUTH', `Login error: ${error.message}${statusHint}`);
      
      // Re-throw network/connection errors as-is
      if (error.message?.includes('timeout') || error.message?.includes('Connection') || error.message?.includes('Network')) {
        throw error;
      }
      
      // For authentication errors, provide better error messages
      if (error.response?.status === 403) {
        throw new Error('Authentication failed. Please check your username and password.');
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

