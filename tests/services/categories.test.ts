jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    postUrlEncoded: jest.fn(),
  },
}));

import { categoriesApi } from '@/services/api/categories';
import { apiClient } from '@/services/api/client';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.postUrlEncoded as jest.Mock;

describe('categoriesApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAllCategories returns the categories map', async () => {
    mockGet.mockResolvedValueOnce({ Movies: { name: 'Movies', savePath: '/m' } });
    const result = await categoriesApi.getAllCategories();
    expect(result).toEqual({ Movies: { name: 'Movies', savePath: '/m' } });
    expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/categories');
  });

  it('getAllCategories returns {} when response is falsy', async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await categoriesApi.getAllCategories();
    expect(result).toEqual({});
  });

  it('addCategory without savePath', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await categoriesApi.addCategory('Movies');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/createCategory', { category: 'Movies' });
  });

  it('addCategory with savePath', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await categoriesApi.addCategory('Movies', '/m');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/createCategory', {
      category: 'Movies',
      savePath: '/m',
    });
  });

  it('editCategory', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await categoriesApi.editCategory('Movies', '/new');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/editCategory', {
      category: 'Movies',
      savePath: '/new',
    });
  });

  it('removeCategories joins with newline', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await categoriesApi.removeCategories(['Movies', 'TV']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/removeCategories', {
      categories: 'Movies\nTV',
    });
  });
});
