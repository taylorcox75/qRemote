jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    postUrlEncoded: jest.fn(),
  },
}));

import { searchApi } from '@/services/api/search';
import { apiClient } from '@/services/api/client';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.postUrlEncoded as jest.Mock;

describe('searchApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('start joins array plugins with pipe', async () => {
    mockPost.mockResolvedValueOnce({ id: 1 });
    const result = await searchApi.start('ubuntu', ['plugin1', 'plugin2'], 'all');
    expect(result).toEqual({ id: 1 });
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/start', {
      pattern: 'ubuntu',
      plugins: 'plugin1|plugin2',
      category: 'all',
    });
  });

  it('start passes through string plugins unchanged', async () => {
    mockPost.mockResolvedValueOnce({ id: 2 });
    await searchApi.start('ubuntu', 'enabled', 'all');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/start', {
      pattern: 'ubuntu',
      plugins: 'enabled',
      category: 'all',
    });
  });

  it('stop posts id', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.stop(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/stop', { id: 1 });
  });

  it('getStatus with id', async () => {
    mockGet.mockResolvedValueOnce([{ id: 1, status: 'Running' }]);
    const result = await searchApi.getStatus(1);
    expect(result).toEqual([{ id: 1, status: 'Running' }]);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/search/status', { id: 1 });
  });

  it('getStatus without id', async () => {
    mockGet.mockResolvedValueOnce([]);
    await searchApi.getStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/v2/search/status', {});
  });

  it('getStatus returns [] for non-array response', async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await searchApi.getStatus();
    expect(result).toEqual([]);
  });

  it('getResults with limit and offset', async () => {
    mockGet.mockResolvedValueOnce({ results: [], status: 'Running', total: 0 });
    await searchApi.getResults(1, 10, 20);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/search/results', { id: 1, limit: 10, offset: 20 });
  });

  it('getResults without limit/offset', async () => {
    mockGet.mockResolvedValueOnce({ results: [], status: 'Running', total: 0 });
    await searchApi.getResults(1);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/search/results', { id: 1 });
  });

  it('deleteSearch posts id', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.deleteSearch(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/delete', { id: 1 });
  });

  it('getPlugins returns array response', async () => {
    mockGet.mockResolvedValueOnce([{ name: 'plugin1' }]);
    const result = await searchApi.getPlugins();
    expect(result).toEqual([{ name: 'plugin1' }]);
  });

  it('getPlugins returns [] for non-array response', async () => {
    mockGet.mockResolvedValueOnce(undefined);
    const result = await searchApi.getPlugins();
    expect(result).toEqual([]);
  });

  it('installPlugin with array sources', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.installPlugin(['url1', 'url2']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/installPlugin', { sources: 'url1|url2' });
  });

  it('installPlugin with string source', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.installPlugin('url1');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/installPlugin', { sources: 'url1' });
  });

  it('uninstallPlugin with array names', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.uninstallPlugin(['a', 'b']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/uninstallPlugin', { names: 'a|b' });
  });

  it('enablePlugin true', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.enablePlugin(['a'], true);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/enablePlugin', { names: 'a', enable: 'true' });
  });

  it('enablePlugin false', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.enablePlugin('a', false);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/enablePlugin', { names: 'a', enable: 'false' });
  });

  it('updatePlugins', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.updatePlugins();
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/updatePlugins', {});
  });

  it('downloadTorrent', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await searchApi.downloadTorrent('magnet:?xt=urn', 'plugin1');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/search/downloadTorrent', {
      torrentUrl: 'magnet:?xt=urn',
      pluginName: 'plugin1',
    });
  });
});
