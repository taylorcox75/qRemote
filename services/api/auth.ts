import { AxiosError } from 'axios';
import { apiClient } from './client';
import { LoginResponse } from '@/types/api';
import { clogInfo, clogWarn, clogError, clogDebug } from '@/services/connectivity-log';
import { isLoginBodyOk, isLoginSuccess } from '@/utils/login-response';

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
      
      const responsePreview = typeof response === 'string' ? response.substring(0, 50) : 'non-string response';
      console.log('[Auth] Login response:', responsePreview);
      console.log('[Auth] Cookies received:', cookies ? 'Yes (' + cookies.length + ' chars)' : 'No');

      clogDebug('AUTH', `Response: "${responsePreview}" | Cookies: ${cookies ? 'Yes (' + cookies.length + ' chars)' : 'No'}`);
      
      // Success/failure interpretation is shared with the connection
      // diagnostic — see utils/login-response.ts for the version matrix.
      const responseStr = typeof response === 'string' ? response.trim() : String(response).trim();
      const hasCookie = !!cookies && cookies.length > 0;

      if (isLoginSuccess({ body: responseStr, hasSessionCookie: hasCookie })) {
        const via = isLoginBodyOk(responseStr) ? 'body "Ok."' : 'session cookie';
        console.log(`[Auth] Login successful via ${via}`);
        clogInfo('AUTH', `Login successful via ${via}`);
        return { status: 'Ok' };
      }

      console.warn('[Auth] Login failed with response:', responseStr, 'cookies:', hasCookie);
      clogWarn('AUTH', `Login failed — body: "${responseStr}", cookies: ${hasCookie}`);
      return { status: 'Fails' };
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError')) {
        throw error;
      }
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      const axiosErr = error instanceof AxiosError ? error : undefined;
      const statusHint = axiosErr?.response?.status ? ` (HTTP ${axiosErr.response.status})` : '';
      console.warn('[Auth] Login error:', message, statusHint);
      clogError('AUTH', `Login error: ${message}${statusHint}`);
      
      if (message.includes('timeout') || message.includes('Connection') || message.includes('Network')) {
        throw error;
      }
      
      if (axiosErr?.response?.status === 403) {
        throw new Error('Authentication failed. Please check your username and password.');
      }
      
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

