import { apiClient } from './client';
import { Category } from '../../types/api';

const API_VERSION = 'v2';

export const categoriesApi = {
  /**
   * Get all categories
   */
  async getAllCategories(): Promise<{ [name: string]: Category }> {
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/categories`);
    return response || {};
  },

  /**
   * Add new category
   */
  async addCategory(category: string, savePath?: string): Promise<void> {
    const params: Record<string, any> = { category };
    if (savePath) {
      params.savePath = savePath;
    }
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/createCategory`, params);
  },

  /**
   * Edit category
   */
  async editCategory(category: string, savePath: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/editCategory`, {
      category,
      savePath,
    });
  },

  /**
   * Remove categories
   */
  async removeCategories(categories: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/removeCategories`, {
      categories: categories.join('\n'),
    });
  },
};

