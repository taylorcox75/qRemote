import { apiClient } from './client';
import { MainData, TorrentInfo } from '@/types/api';

const API_VERSION = 'v2';

export const syncApi = {
  /**
   * Get main data (torrents, categories, tags, server state)
   * @param rid Response ID for incremental updates (0 for full update)
   */
  async getMainData(rid: number = 0): Promise<MainData> {
    const params: Record<string, string | number | boolean> = {};
    if (rid > 0) {
      params.rid = rid;
    }

    const response = await apiClient.get(`/api/${API_VERSION}/sync/maindata`, params) as MainData;
    
    if (response.torrents) {
      const torrents: { [hash: string]: TorrentInfo } = {};
      Object.keys(response.torrents).forEach((hashKey) => {
        const torrent: Partial<TorrentInfo> & { hash?: string } = { ...response.torrents![hashKey] };
        torrent.hash = hashKey;
        torrents[hashKey] = torrent as TorrentInfo;
      });
      response.torrents = torrents;
    } else {
      response.torrents = {};
    }

    return response;
  },

  /**
   * Get torrent peers data
   * @param hash Torrent hash
   * @param rid Response ID for incremental updates
   */
  async getTorrentPeers(hash: string, rid: number = 0): Promise<unknown> {
    const params: Record<string, string | number | boolean> = {
      hash,
    };
    if (rid > 0) {
      params.rid = rid;
    }

    return await apiClient.get(`/api/${API_VERSION}/sync/torrentPeers`, params);
  },
};
