import { apiClient } from './client';
import {
  ApplicationVersion,
  BuildInfo,
  ApplicationPreferences,
} from '../../types/api';

const API_VERSION = 'v2';

export const applicationApi = {
  /**
   * Get application version
   */
  async getVersion(): Promise<ApplicationVersion> {
    const version = await apiClient.get(`/api/${API_VERSION}/app/version`);
    const apiVersion = await apiClient.get(`/api/${API_VERSION}/app/webapiVersion`);
    return {
      version: version as string,
      apiVersion: apiVersion as string,
    };
  },

  /**
   * Get build info
   */
  async getBuildInfo(): Promise<BuildInfo> {
    return await apiClient.get(`/api/${API_VERSION}/app/buildInfo`);
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
    return await apiClient.get(`/api/${API_VERSION}/app/preferences`);
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
    return await apiClient.get(`/api/${API_VERSION}/app/defaultSavePath`);
  },
};

