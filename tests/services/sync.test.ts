jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { syncApi } from '@/services/api/sync';
import { apiClient } from '@/services/api/client';

const mockGet = apiClient.get as jest.Mock;

describe('syncApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMainData', () => {
    it('omits rid param when 0 (default)', async () => {
      mockGet.mockResolvedValueOnce({ rid: 1, torrents: {} });
      await syncApi.getMainData();
      expect(mockGet).toHaveBeenCalledWith('/api/v2/sync/maindata', {});
    });

    it('includes rid param when > 0', async () => {
      mockGet.mockResolvedValueOnce({ rid: 2, torrents: {} });
      await syncApi.getMainData(5);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/sync/maindata', { rid: 5 });
    });

    it('injects hash key into each torrent', async () => {
      mockGet.mockResolvedValueOnce({
        rid: 1,
        torrents: {
          abc123: { name: 'Torrent A' },
          def456: { name: 'Torrent B' },
        },
      });
      const result = await syncApi.getMainData();
      expect(result.torrents!.abc123.hash).toBe('abc123');
      expect(result.torrents!.def456.hash).toBe('def456');
      expect(result.torrents!.abc123.name).toBe('Torrent A');
    });

    it('defaults torrents to {} when absent', async () => {
      mockGet.mockResolvedValueOnce({ rid: 1 });
      const result = await syncApi.getMainData();
      expect(result.torrents).toEqual({});
    });
  });

  describe('getTorrentPeers', () => {
    it('omits rid when 0 (default)', async () => {
      mockGet.mockResolvedValueOnce({ peers: {} });
      await syncApi.getTorrentPeers('abc123');
      expect(mockGet).toHaveBeenCalledWith('/api/v2/sync/torrentPeers', { hash: 'abc123' });
    });

    it('includes rid when > 0', async () => {
      mockGet.mockResolvedValueOnce({ peers: {} });
      await syncApi.getTorrentPeers('abc123', 3);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/sync/torrentPeers', { hash: 'abc123', rid: 3 });
    });
  });
});
