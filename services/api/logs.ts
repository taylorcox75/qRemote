import { apiClient } from './client';
import { LogEntry, PeerLogEntry } from '@/types/api';

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
    const params: Record<string, string | number | boolean> = {
      normal: normal ? 1 : 0,
      info: info ? 1 : 0,
      warning: warning ? 1 : 0,
      critical: critical ? 1 : 0,
    };

    if (lastKnownId !== undefined) {
      params.last_known_id = lastKnownId;
    }

    const response = await apiClient.get(`/api/${API_VERSION}/log/main`, params);
    
    if (Array.isArray(response)) {
      return response as LogEntry[];
    }
    
    const obj = response as Record<string, unknown>;
    if (obj && Array.isArray(obj.data)) {
      return obj.data as LogEntry[];
    }
    
    return [];
  },

  /**
   * Get peer log
   * @param lastKnownId Last known log ID (for incremental updates)
   */
  async getPeerLog(lastKnownId?: number): Promise<PeerLogEntry[]> {
    const params: Record<string, string | number | boolean> = {};
    if (lastKnownId !== undefined) {
      params.last_known_id = lastKnownId;
    }

    const response = await apiClient.get(`/api/${API_VERSION}/log/peers`, params);
    
    if (Array.isArray(response)) {
      return response as PeerLogEntry[];
    }
    
    const obj = response as Record<string, unknown>;
    if (obj && Array.isArray(obj.data)) {
      return obj.data as PeerLogEntry[];
    }
    
    return [];
  },
};
