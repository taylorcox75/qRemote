import { apiClient } from './client';

const API_VERSION = 'v2';

/** Tags API — added in qBittorrent 4.4.0 (API 2.3.0). Older v4 servers return 404. */
export const tagsApi = {
  /**
   * Get all tags. Returns [] on servers that don't support the tags API (< 4.4.0).
   */
  async getAllTags(): Promise<string[]> {
    try {
      const response = await apiClient.get(`/api/${API_VERSION}/torrents/tags`);
      if (Array.isArray(response)) {
        return response;
      }
      return [];
    } catch (error: any) {
      if (error.response?.status === 404 || error.message?.includes('Endpoint not found')) {
        return [];
      }
      throw error;
    }
  },

  /**
   * Create tags. Silently no-ops on servers that don't support the tags API (< 4.4.0).
   */
  async createTags(tags: string[]): Promise<void> {
    try {
      await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/createTags`, {
        tags: tags.join(','),
      });
    } catch (error: any) {
      if (error.response?.status === 404 || error.message?.includes('Endpoint not found')) {
        return;
      }
      throw error;
    }
  },

  /**
   * Delete tags. Silently no-ops on servers that don't support the tags API (< 4.4.0).
   */
  async deleteTags(tags: string[]): Promise<void> {
    try {
      await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/deleteTags`, {
        tags: tags.join(','),
      });
    } catch (error: any) {
      if (error.response?.status === 404 || error.message?.includes('Endpoint not found')) {
        return;
      }
      throw error;
    }
  },
};
