import { AxiosError } from 'axios';
import { apiClient } from './client';
import {
  ApplicationVersion,
  BuildInfo,
  ApplicationPreferences,
} from '@/types/api';

const API_VERSION = 'v2';

export const applicationApi = {
  /**
   * Get application version
   */
  async getVersion(signal?: AbortSignal): Promise<ApplicationVersion> {
    const version = await apiClient.get(`/api/${API_VERSION}/app/version`, undefined, signal);
    const apiVersion = await apiClient.get(`/api/${API_VERSION}/app/webapiVersion`, undefined, signal);
    return {
      version: version as string,
      apiVersion: apiVersion as string,
    };
  },

  /**
   * Get build info
   */
  async getBuildInfo(): Promise<BuildInfo> {
    return await apiClient.get(`/api/${API_VERSION}/app/buildInfo`) as BuildInfo;
  },

  /**
   * Shutdown application
   */
  async shutdown(): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/app/shutdown`, {});
  },

  /**
   * Get application preferences
   */
  async getPreferences(): Promise<ApplicationPreferences> {
    return await apiClient.get(`/api/${API_VERSION}/app/preferences`) as ApplicationPreferences;
  },

  /**
   * Set application preferences
   */
  async setPreferences(preferences: ApplicationPreferences): Promise<void> {
    const json = JSON.stringify(preferences);
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/app/setPreferences`, {
      json,
    });
  },

  /**
   * Get default save path
   */
  async getDefaultSavePath(): Promise<string> {
    return await apiClient.get(`/api/${API_VERSION}/app/defaultSavePath`) as string;
  },

  /**
   * List directory entries on the server for path autocomplete (qBittorrent 5.0+
   * / WebAPI >= 2.11). Without withMetadata, qBittorrent returns absolute paths
   * (not basenames) — callers should strip to the final segment before display.
   * Throws if dirPath isn't an absolute, existing directory — callers should
   * treat failures as "no suggestions" rather than surfacing an error.
   */
  async getDirectoryContent(
    dirPath: string,
    mode: 'all' | 'dirs' | 'files' = 'dirs',
  ): Promise<string[]> {
    const response = await apiClient.get(`/api/${API_VERSION}/app/getDirectoryContent`, {
      dirPath,
      mode,
    });
    return Array.isArray(response) ? (response as string[]) : [];
  },

  /**
   * Get cookies (qBittorrent 5.0+)
   * Returns empty object on qBittorrent 4.x (404 error)
   */
  async getCookies(): Promise<{ [domain: string]: string }> {
    try {
      return await apiClient.get(`/api/${API_VERSION}/app/getCookies`) as { [domain: string]: string };
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return {};
      }
      throw error;
    }
  },

  /**
   * Set cookies (qBittorrent 5.0+)
   * Silently fails on qBittorrent 4.x
   */
  async setCookies(cookies: { [domain: string]: string }): Promise<void> {
    try {
      const json = JSON.stringify(cookies);
      await apiClient.postUrlEncoded(`/api/${API_VERSION}/app/setCookies`, {
        json,
      });
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        console.warn('[Application API] setCookies not supported (qBittorrent 4.x?)');
        return;
      }
      throw error;
    }
  },
};

