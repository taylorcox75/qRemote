import { apiClient } from './client';

const API_VERSION = 'v2';

export const tagsApi = {
  /**
   * Get all tags
   */
  async getAllTags(): Promise<string[]> {
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/tags`);
    if (Array.isArray(response)) {
      return response;
    }
    return [];
  },

  /**
   * Create tags
   */
  async createTags(tags: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/createTags`, {
      tags: tags.join(','),
    });
  },

  /**
   * Delete tags
   */
  async deleteTags(tags: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/deleteTags`, {
      tags: tags.join(','),
    });
  },
};

