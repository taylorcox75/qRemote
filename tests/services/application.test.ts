jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    postUrlEncoded: jest.fn(),
  },
}));

import { AxiosError } from 'axios';
import { applicationApi } from '@/services/api/application';
import { apiClient } from '@/services/api/client';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.postUrlEncoded as jest.Mock;

describe('applicationApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getVersion combines version and apiVersion calls', async () => {
    mockGet.mockResolvedValueOnce('v4.5.0').mockResolvedValueOnce('2.9.0');
    const result = await applicationApi.getVersion();
    expect(result).toEqual({ version: 'v4.5.0', apiVersion: '2.9.0' });
    expect(mockGet).toHaveBeenNthCalledWith(1, '/api/v2/app/version', undefined, undefined);
    expect(mockGet).toHaveBeenNthCalledWith(2, '/api/v2/app/webapiVersion', undefined, undefined);
  });

  it('getBuildInfo returns build info', async () => {
    mockGet.mockResolvedValueOnce({ qt: '5.15' });
    const result = await applicationApi.getBuildInfo();
    expect(result).toEqual({ qt: '5.15' });
    expect(mockGet).toHaveBeenCalledWith('/api/v2/app/buildInfo');
  });

  it('shutdown posts to shutdown endpoint', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await applicationApi.shutdown();
    expect(mockPost).toHaveBeenCalledWith('/api/v2/app/shutdown', {});
  });

  it('getPreferences returns preferences', async () => {
    mockGet.mockResolvedValueOnce({ locale: 'en' });
    const result = await applicationApi.getPreferences();
    expect(result).toEqual({ locale: 'en' });
  });

  it('setPreferences posts JSON-encoded preferences', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await applicationApi.setPreferences({ locale: 'en' } as never);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/app/setPreferences', {
      json: JSON.stringify({ locale: 'en' }),
    });
  });

  it('getDefaultSavePath returns path string', async () => {
    mockGet.mockResolvedValueOnce('/downloads');
    const result = await applicationApi.getDefaultSavePath();
    expect(result).toBe('/downloads');
  });

  describe('getCookies', () => {
    it('returns cookies object on success', async () => {
      mockGet.mockResolvedValueOnce({ 'example.com': 'a=b' });
      const result = await applicationApi.getCookies();
      expect(result).toEqual({ 'example.com': 'a=b' });
    });

    it('returns empty object on 404 (qBittorrent 4.x)', async () => {
      const err = new AxiosError('Not Found');
      err.response = { status: 404 } as never;
      mockGet.mockRejectedValueOnce(err);
      const result = await applicationApi.getCookies();
      expect(result).toEqual({});
    });

    it('rethrows non-404 errors', async () => {
      const err = new AxiosError('Server Error');
      err.response = { status: 500 } as never;
      mockGet.mockRejectedValueOnce(err);
      await expect(applicationApi.getCookies()).rejects.toThrow(err);
    });

    it('rethrows non-axios errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('boom'));
      await expect(applicationApi.getCookies()).rejects.toThrow('boom');
    });
  });

  describe('setCookies', () => {
    it('posts JSON-encoded cookies', async () => {
      mockPost.mockResolvedValueOnce(undefined);
      await applicationApi.setCookies({ 'example.com': 'a=b' });
      expect(mockPost).toHaveBeenCalledWith('/api/v2/app/setCookies', {
        json: JSON.stringify({ 'example.com': 'a=b' }),
      });
    });

    it('silently swallows 404 (qBittorrent 4.x)', async () => {
      const err = new AxiosError('Not Found');
      err.response = { status: 404 } as never;
      mockPost.mockRejectedValueOnce(err);
      await expect(applicationApi.setCookies({})).resolves.toBeUndefined();
    });

    it('rethrows non-404 errors', async () => {
      const err = new AxiosError('Server Error');
      err.response = { status: 500 } as never;
      mockPost.mockRejectedValueOnce(err);
      await expect(applicationApi.setCookies({})).rejects.toThrow(err);
    });
  });
});
