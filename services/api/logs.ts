import { apiClient } from './client';
import { LogEntry, PeerLogEntry } from '../../types/api';

const API_VERSION = 'v2';

export const logsApi = {
  /**
   * Get application log
   * @param normal Include normal messages
   * @param info Include info messages
   * @param warning Include warning messages
   * @param critical Include critical messages
   * @param lastKnownId Last known log ID (for incremental updates)
   */
  async getLog(
    normal: boolean = true,
    info: boolean = true,
    warning: boolean = true,
    critical: boolean = true,
    lastKnownId?: number
  ): Promise<LogEntry[]> {
    const params: Record<string, any> = {
      normal: normal ? 1 : 0,
      info: info ? 1 : 0,
      warning: warning ? 1 : 0,
      critical: critical ? 1 : 0,
    };

    if (lastKnownId !== undefined) {
      params.last_known_id = lastKnownId;
    }

    const response = await apiClient.get(`/api/${API_VERSION}/log/main`, params);
    
    // Parse the response - qBittorrent returns log entries as an array
    if (Array.isArray(response)) {
      return response;
    }
    
    // Sometimes it returns an object with an array
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  },

  /**
   * Get peer log
   * @param lastKnownId Last known log ID (for incremental updates)
   */
  async getPeerLog(lastKnownId?: number): Promise<PeerLogEntry[]> {
    const params: Record<string, any> = {};
    if (lastKnownId !== undefined) {
      params.last_known_id = lastKnownId;
    }

    const response = await apiClient.get(`/api/${API_VERSION}/log/peers`, params);
    
    if (Array.isArray(response)) {
      return response;
    }
    
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  },
};

