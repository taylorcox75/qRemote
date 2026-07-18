jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { logsApi } from '@/services/api/logs';
import { apiClient } from '@/services/api/client';

const mockGet = apiClient.get as jest.Mock;

describe('logsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLog', () => {
    it('uses default params and returns array response', async () => {
      mockGet.mockResolvedValueOnce([{ id: 1, message: 'hi', timestamp: 1, type: 1 }]);
      const result = await logsApi.getLog();
      expect(result).toEqual([{ id: 1, message: 'hi', timestamp: 1, type: 1 }]);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/log/main', {
        normal: 1,
        info: 1,
        warning: 1,
        critical: 1,
      });
    });

    it('encodes false flags as 0 and includes last_known_id', async () => {
      mockGet.mockResolvedValueOnce([]);
      await logsApi.getLog(false, false, false, false, 5);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/log/main', {
        normal: 0,
        info: 0,
        warning: 0,
        critical: 0,
        last_known_id: 5,
      });
    });

    it('extracts .data when response is a wrapped object', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ id: 2 }] });
      const result = await logsApi.getLog();
      expect(result).toEqual([{ id: 2 }]);
    });

    it('returns [] for unrecognized response shape', async () => {
      mockGet.mockResolvedValueOnce({ foo: 'bar' });
      const result = await logsApi.getLog();
      expect(result).toEqual([]);
    });

    it('returns [] for null response', async () => {
      mockGet.mockResolvedValueOnce(null);
      const result = await logsApi.getLog();
      expect(result).toEqual([]);
    });
  });

  describe('getPeerLog', () => {
    it('omits last_known_id when undefined', async () => {
      mockGet.mockResolvedValueOnce([{ ip: '1.2.3.4' }]);
      const result = await logsApi.getPeerLog();
      expect(result).toEqual([{ ip: '1.2.3.4' }]);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/log/peers', {});
    });

    it('includes last_known_id when provided', async () => {
      mockGet.mockResolvedValueOnce([]);
      await logsApi.getPeerLog(10);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/log/peers', { last_known_id: 10 });
    });

    it('extracts .data when response is a wrapped object', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ ip: '1.1.1.1' }] });
      const result = await logsApi.getPeerLog();
      expect(result).toEqual([{ ip: '1.1.1.1' }]);
    });

    it('returns [] for unrecognized response shape', async () => {
      mockGet.mockResolvedValueOnce(42);
      const result = await logsApi.getPeerLog();
      expect(result).toEqual([]);
    });
  });
});
