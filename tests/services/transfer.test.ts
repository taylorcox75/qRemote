jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    postUrlEncoded: jest.fn(),
  },
}));

import { transferApi } from '@/services/api/transfer';
import { apiClient } from '@/services/api/client';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.postUrlEncoded as jest.Mock;

describe('transferApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getGlobalTransferInfo', async () => {
    mockGet.mockResolvedValueOnce({ dl_info_speed: 100 });
    const result = await transferApi.getGlobalTransferInfo();
    expect(result).toEqual({ dl_info_speed: 100 });
    expect(mockGet).toHaveBeenCalledWith('/api/v2/transfer/info');
  });

  it('getAlternativeSpeedLimitsState true when response is 1', async () => {
    mockGet.mockResolvedValueOnce(1);
    const result = await transferApi.getAlternativeSpeedLimitsState();
    expect(result).toBe(true);
  });

  it('getAlternativeSpeedLimitsState false when response is 0', async () => {
    mockGet.mockResolvedValueOnce(0);
    const result = await transferApi.getAlternativeSpeedLimitsState();
    expect(result).toBe(false);
  });

  it('toggleAlternativeSpeedLimits', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await transferApi.toggleAlternativeSpeedLimits();
    expect(mockPost).toHaveBeenCalledWith('/api/v2/transfer/toggleSpeedLimitsMode', {});
  });

  it('getGlobalDownloadLimit', async () => {
    mockGet.mockResolvedValueOnce(1000);
    const result = await transferApi.getGlobalDownloadLimit();
    expect(result).toBe(1000);
  });

  it('setGlobalDownloadLimit', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await transferApi.setGlobalDownloadLimit(500);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/transfer/setDownloadLimit', { limit: 500 });
  });

  it('getGlobalUploadLimit', async () => {
    mockGet.mockResolvedValueOnce(2000);
    const result = await transferApi.getGlobalUploadLimit();
    expect(result).toBe(2000);
  });

  it('setGlobalUploadLimit', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await transferApi.setGlobalUploadLimit(700);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/transfer/setUploadLimit', { limit: 700 });
  });

  it('banPeers joins with pipe', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await transferApi.banPeers(['1.2.3.4:80', '5.6.7.8:81']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/transfer/banPeers', {
      peers: '1.2.3.4:80|5.6.7.8:81',
    });
  });
});
