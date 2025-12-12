import { apiClient } from './client';
import { GlobalTransferInfo } from '../../types/api';

const API_VERSION = 'v2';

export const transferApi = {
  /**
   * Get global transfer info
   */
  async getGlobalTransferInfo(): Promise<GlobalTransferInfo> {
    return await apiClient.get(`/api/${API_VERSION}/transfer/info`);
  },

  /**
   * Get alternative speed limits state
   */
  async getAlternativeSpeedLimitsState(): Promise<boolean> {
    const response = await apiClient.get(`/api/${API_VERSION}/transfer/speedLimitsMode`);
    return response === 1;
  },

  /**
   * Toggle alternative speed limits
   */
  async toggleAlternativeSpeedLimits(): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/transfer/toggleSpeedLimitsMode`, {});
  },

  /**
   * Get global download limit
   */
  async getGlobalDownloadLimit(): Promise<number> {
    return await apiClient.get(`/api/${API_VERSION}/transfer/downloadLimit`);
  },

  /**
   * Set global download limit (0 = unlimited)
   */
  async setGlobalDownloadLimit(limit: number): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/transfer/setDownloadLimit`, {
      limit,
    });
  },

  /**
   * Get global upload limit
   */
  async getGlobalUploadLimit(): Promise<number> {
    return await apiClient.get(`/api/${API_VERSION}/transfer/uploadLimit`);
  },

  /**
   * Set global upload limit (0 = unlimited)
   */
  async setGlobalUploadLimit(limit: number): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/transfer/setUploadLimit`, {
      limit,
    });
  },

  /**
   * Ban peers
   */
  async banPeers(peers: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/transfer/banPeers`, {
      peers: peers.join('|'),
    });
  },
};

