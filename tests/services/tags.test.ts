jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    postUrlEncoded: jest.fn(),
  },
}));

import { tagsApi } from '@/services/api/tags';
import { apiClient } from '@/services/api/client';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.postUrlEncoded as jest.Mock;

describe('tagsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAllTags returns array response', async () => {
    mockGet.mockResolvedValueOnce(['a', 'b']);
    const result = await tagsApi.getAllTags();
    expect(result).toEqual(['a', 'b']);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/tags');
  });

  it('getAllTags returns [] for non-array response', async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await tagsApi.getAllTags();
    expect(result).toEqual([]);
  });

  it('createTags joins with comma', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await tagsApi.createTags(['a', 'b']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/createTags', { tags: 'a,b' });
  });

  it('deleteTags joins with comma', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await tagsApi.deleteTags(['a', 'b']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/deleteTags', { tags: 'a,b' });
  });
});
