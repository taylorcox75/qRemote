import { apiClient } from './client';
import { MainData, TorrentInfo } from '../../types/api';

const API_VERSION = 'v2';

export const syncApi = {
  /**
   * Get main data (torrents, categories, tags, server state)
   * @param rid Response ID for incremental updates (0 for full update)
   */
  async getMainData(rid: number = 0): Promise<MainData> {
    const params: Record<string, any> = {};
    if (rid > 0) {
      params.rid = rid;
    }

    const response = await apiClient.get(`/api/${API_VERSION}/sync/maindata`, params);
    
    // console.log('Raw API response:', {
    //   has_torrents: !!response.torrents,
    //   torrents_type: typeof response.torrents,
    //   torrents_is_array: Array.isArray(response.torrents),
    //   torrents_keys: response.torrents ? Object.keys(response.torrents).length : 0,
    //   full_update: response.full_update,
    //   rid: response.rid,
    // });
    
    // Parse torrents if they exist
    if (response.torrents) {
      // qBittorrent returns torrents as an object with hash keys
      // The key IS the hash, but the torrent object may not have a hash property
      const torrents: { [hash: string]: TorrentInfo } = {};
      Object.keys(response.torrents).forEach((hashKey) => {
        const torrent: any = { ...response.torrents[hashKey] };
        // Set hash property from the key (qBittorrent uses the hash as the object key)
        torrent.hash = hashKey;
        torrents[hashKey] = torrent as TorrentInfo;
      });
      response.torrents = torrents;
    } else {
      // Ensure torrents is an empty object if not present
      response.torrents = {};
    }

    return response as MainData;
  },

  /**
   * Get torrent peers data
   * @param hash Torrent hash
   * @param rid Response ID for incremental updates
   */
  async getTorrentPeers(hash: string, rid: number = 0): Promise<any> {
    const params: Record<string, any> = {
      hash,
    };
    if (rid > 0) {
      params.rid = rid;
    }

    return await apiClient.get(`/api/${API_VERSION}/sync/torrentPeers`, params);
  },
};

