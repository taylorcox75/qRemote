import { apiClient } from './client';
import {
  TorrentInfo,
  TorrentProperties,
  Tracker,
  WebSeed,
  TorrentFile,
  TorrentPieceState,
  TorrentPieceHash,
  FilePriority,
} from '../../types/api';

const API_VERSION = 'v2';

export const torrentsApi = {
  /**
   * Get torrent list
   */
  async getTorrentList(
    filter?: string,
    category?: string,
    tag?: string,
    sort?: string,
    reverse?: boolean,
    limit?: number,
    offset?: number,
    hashes?: string[]
  ): Promise<TorrentInfo[]> {
    const params: Record<string, any> = {};

    if (filter) params.filter = filter;
    if (category) params.category = category;
    if (tag) params.tag = tag;
    if (sort) params.sort = sort;
    if (reverse !== undefined) params.reverse = reverse;
    if (limit !== undefined) params.limit = limit;
    if (offset !== undefined) params.offset = offset;
    if (hashes && hashes.length > 0) params.hashes = hashes.join('|');

    const response = await apiClient.get(`/api/${API_VERSION}/torrents/info`, params);
    
    if (Array.isArray(response)) {
      return response;
    }
    
    return [];
  },

  /**
   * Get torrent generic properties
   */
  async getTorrentProperties(hash: string): Promise<TorrentProperties> {
    return await apiClient.get(`/api/${API_VERSION}/torrents/properties`, { hash });
  },

  /**
   * Get torrent trackers
   */
  async getTorrentTrackers(hash: string): Promise<Tracker[]> {
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/trackers`, { hash });
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get torrent web seeds
   */
  async getTorrentWebSeeds(hash: string): Promise<WebSeed[]> {
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/webseeds`, { hash });
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get torrent contents (files)
   */
  async getTorrentContents(hash: string, indexes?: number[]): Promise<TorrentFile[]> {
    const params: Record<string, any> = { hash };
    if (indexes && indexes.length > 0) {
      params.indexes = indexes.join('|');
    }
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/files`, params);
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get torrent pieces' states
   */
  async getTorrentPiecesStates(hash: string): Promise<TorrentPieceState> {
    return await apiClient.get(`/api/${API_VERSION}/torrents/pieceStates`, { hash });
  },

  /**
   * Get torrent pieces' hashes
   */
  async getTorrentPiecesHashes(hash: string): Promise<TorrentPieceHash> {
    return await apiClient.get(`/api/${API_VERSION}/torrents/pieceHashes`, { hash });
  },

  /**
   * Pause torrents
   */
  async pauseTorrents(hashes: string[]): Promise<void> {
    const hashString = hashes.join('|');
    try {
      const response = await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/stop`, {
        hashes: hashString,
      });
      // console.log('Pause response:', response);
    } catch (error: any) {
      console.error('Pause API error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      throw error;
    }
  },

  /**
   * Resume torrents
   */
  async resumeTorrents(hashes: string[]): Promise<void> {
    const hashString = hashes.join('|');
    try {
      const response = await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/start`, {
        hashes: hashString,
      });
    } catch (error: any) {
      console.error('Resume API error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      throw error;
    }
  },

  /**
   * Delete torrents
   */
  async deleteTorrents(hashes: string[], deleteFiles: boolean = false): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/delete`, {
      hashes: hashes.join('|'),
      deleteFiles: deleteFiles ? 'true' : 'false',
    });
  },

  /**
   * Recheck torrents
   */
  async recheckTorrents(hashes: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/recheck`, {
      hashes: hashes.join('|'),
    });
  },

  /**
   * Reannounce torrents
   */
  async reannounceTorrents(hashes: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/reannounce`, {
      hashes: hashes.join('|'),
    });
  },

  /**
   * Add new torrent
   */
  async addTorrent(
    urls: string | string[],
    options?: {
      savepath?: string;
      cookie?: string;
      category?: string;
      tags?: string[];
      skip_checking?: boolean;
      paused?: boolean;
      root_folder?: boolean;
      rename?: string;
      upLimit?: number;
      dlLimit?: number;
      ratioLimit?: number;
      seedingTimeLimit?: number;
      sequentialDownload?: boolean;
      firstLastPiecePrio?: boolean;
      autoTMM?: boolean;
    }
  ): Promise<void> {
    const formData = new FormData();
    
    if (Array.isArray(urls)) {
      urls.forEach((url) => {
        formData.append('urls', url);
      });
    } else {
      formData.append('urls', urls);
    }

    if (options) {
      if (options.savepath) formData.append('savepath', options.savepath);
      if (options.cookie) formData.append('cookie', options.cookie);
      if (options.category) formData.append('category', options.category);
      if (options.tags && options.tags.length > 0) {
        formData.append('tags', options.tags.join(','));
      }
      if (options.skip_checking !== undefined) {
        formData.append('skip_checking', String(options.skip_checking));
      }
      if (options.paused !== undefined) {
        formData.append('paused', String(options.paused));
      }
      if (options.root_folder !== undefined) {
        formData.append('root_folder', String(options.root_folder));
      }
      if (options.rename) formData.append('rename', options.rename);
      if (options.upLimit !== undefined) {
        formData.append('upLimit', String(options.upLimit));
      }
      if (options.dlLimit !== undefined) {
        formData.append('dlLimit', String(options.dlLimit));
      }
      if (options.ratioLimit !== undefined) {
        formData.append('ratioLimit', String(options.ratioLimit));
      }
      if (options.seedingTimeLimit !== undefined) {
        formData.append('seedingTimeLimit', String(options.seedingTimeLimit));
      }
      if (options.sequentialDownload !== undefined) {
        formData.append('sequentialDownload', String(options.sequentialDownload));
      }
      if (options.firstLastPiecePrio !== undefined) {
        formData.append('firstLastPiecePrio', String(options.firstLastPiecePrio));
      }
      if (options.autoTMM !== undefined) {
        formData.append('autoTMM', String(options.autoTMM));
      }
    }

    await apiClient.postFormData(`/api/${API_VERSION}/torrents/add`, formData);
  },

  /**
   * Add torrent file
   */
  async addTorrentFile(
    file: { uri: string; name: string; type?: string },
    options?: {
      savepath?: string;
      category?: string;
      tags?: string[];
      skip_checking?: boolean;
      paused?: boolean;
      root_folder?: boolean;
      rename?: string;
      upLimit?: number;
      dlLimit?: number;
      ratioLimit?: number;
      seedingTimeLimit?: number;
      sequentialDownload?: boolean;
      firstLastPiecePrio?: boolean;
      autoTMM?: boolean;
    }
  ): Promise<void> {
    const formData = new FormData();
    
    // Add the torrent file
    formData.append('torrents', {
      uri: file.uri,
      type: file.type || 'application/x-bittorrent',
      name: file.name,
    } as any);

    if (options) {
      if (options.savepath) formData.append('savepath', options.savepath);
      if (options.category) formData.append('category', options.category);
      if (options.tags && options.tags.length > 0) {
        formData.append('tags', options.tags.join(','));
      }
      if (options.skip_checking !== undefined) {
        formData.append('skip_checking', String(options.skip_checking));
      }
      if (options.paused !== undefined) {
        formData.append('paused', String(options.paused));
      }
      if (options.root_folder !== undefined) {
        formData.append('root_folder', String(options.root_folder));
      }
      if (options.rename) formData.append('rename', options.rename);
      if (options.upLimit !== undefined) {
        formData.append('upLimit', String(options.upLimit));
      }
      if (options.dlLimit !== undefined) {
        formData.append('dlLimit', String(options.dlLimit));
      }
      if (options.ratioLimit !== undefined) {
        formData.append('ratioLimit', String(options.ratioLimit));
      }
      if (options.seedingTimeLimit !== undefined) {
        formData.append('seedingTimeLimit', String(options.seedingTimeLimit));
      }
      if (options.sequentialDownload !== undefined) {
        formData.append('sequentialDownload', String(options.sequentialDownload));
      }
      if (options.firstLastPiecePrio !== undefined) {
        formData.append('firstLastPiecePrio', String(options.firstLastPiecePrio));
      }
      if (options.autoTMM !== undefined) {
        formData.append('autoTMM', String(options.autoTMM));
      }
    }

    await apiClient.postFormData(`/api/${API_VERSION}/torrents/add`, formData);
  },

  /**
   * Add trackers to torrent
   */
  async addTrackers(hash: string, urls: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/addTrackers`, {
      hash,
      urls: urls.join('\n'),
    });
  },

  /**
   * Edit trackers
   */
  async editTrackers(hash: string, origUrl: string, newUrl: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/editTracker`, {
      hash,
      origUrl,
      newUrl,
    });
  },

  /**
   * Remove trackers
   */
  async removeTrackers(hash: string, urls: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/removeTrackers`, {
      hash,
      urls: urls.join('|'),
    });
  },

  /**
   * Add peers
   */
  async addPeers(hashes: string[], peers: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/addPeers`, {
      hashes: hashes.join('|'),
      peers: peers.join('|'),
    });
  },

  /**
   * Increase torrent priority
   */
  async increasePriority(hashes: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/increasePrio`, {
      hashes: hashes.join('|'),
    });
  },

  /**
   * Decrease torrent priority
   */
  async decreasePriority(hashes: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/decreasePrio`, {
      hashes: hashes.join('|'),
    });
  },

  /**
   * Set maximal torrent priority
   */
  async setMaximalPriority(hashes: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/topPrio`, {
      hashes: hashes.join('|'),
    });
  },

  /**
   * Set minimal torrent priority
   */
  async setMinimalPriority(hashes: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/bottomPrio`, {
      hashes: hashes.join('|'),
    });
  },

  /**
   * Set file priority
   */
  async setFilePriority(hash: string, ids: number[], priority: FilePriority): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/filePrio`, {
      hash,
      id: ids.join('|'),
      priority: String(priority),
    });
  },

  /**
   * Get torrent download limit
   */
  async getTorrentDownloadLimit(hashes: string[]): Promise<{ [hash: string]: number }> {
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/downloadLimit`, {
      hashes: hashes.join('|'),
    });
    return response || {};
  },

  /**
   * Set torrent download limit
   */
  async setTorrentDownloadLimit(hashes: string[], limit: number): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/setDownloadLimit`, {
      hashes: hashes.join('|'),
      limit,
    });
  },

  /**
   * Set torrent share limit
   */
  async setTorrentShareLimits(
    hashes: string[],
    ratioLimit?: number,
    seedingTimeLimit?: number
  ): Promise<void> {
    const params: Record<string, any> = {
      hashes: hashes.join('|'),
    };
    if (ratioLimit !== undefined) {
      params.ratioLimit = ratioLimit;
    }
    if (seedingTimeLimit !== undefined) {
      params.seedingTimeLimit = seedingTimeLimit;
    }
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/setShareLimits`, params);
  },

  /**
   * Get torrent upload limit
   */
  async getTorrentUploadLimit(hashes: string[]): Promise<{ [hash: string]: number }> {
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/uploadLimit`, {
      hashes: hashes.join('|'),
    });
    return response || {};
  },

  /**
   * Set torrent upload limit
   */
  async setTorrentUploadLimit(hashes: string[], limit: number): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/setUploadLimit`, {
      hashes: hashes.join('|'),
      limit,
    });
  },

  /**
   * Set torrent location
   */
  async setTorrentLocation(hashes: string[], location: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/setLocation`, {
      hashes: hashes.join('|'),
      location,
    });
  },

  /**
   * Set torrent name
   */
  async setTorrentName(hash: string, name: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/rename`, {
      hash,
      name,
    });
  },

  /**
   * Set torrent category
   */
  async setTorrentCategory(hashes: string[], category: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/setCategory`, {
      hashes: hashes.join('|'),
      category,
    });
  },

  /**
   * Add torrent tags
   */
  async addTorrentTags(hashes: string[], tags: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/addTags`, {
      hashes: hashes.join('|'),
      tags: tags.join(','),
    });
  },

  /**
   * Remove torrent tags
   */
  async removeTorrentTags(hashes: string[], tags: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/removeTags`, {
      hashes: hashes.join('|'),
      tags: tags.join(','),
    });
  },

  /**
   * Set automatic torrent management
   */
  async setAutomaticTorrentManagement(hashes: string[], enable: boolean): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/setAutoManagement`, {
      hashes: hashes.join('|'),
      enable: String(enable),
    });
  },

  /**
   * Toggle sequential download
   */
  async toggleSequentialDownload(hashes: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/toggleSequentialDownload`, {
      hashes: hashes.join('|'),
    });
  },

  /**
   * Set first/last piece priority
   */
  async setFirstLastPiecePriority(hashes: string[]): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/toggleFirstLastPiecePrio`, {
      hashes: hashes.join('|'),
    });
  },

  /**
   * Set force start
   */
  async setForceStart(hashes: string[], value: boolean): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/setForceStart`, {
      hashes: hashes.join('|'),
      value: String(value),
    });
  },

  /**
   * Set super seeding
   */
  async setSuperSeeding(hashes: string[], value: boolean): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/setSuperSeeding`, {
      hashes: hashes.join('|'),
      value: String(value),
    });
  },

  /**
   * Rename file
   */
  async renameFile(hash: string, oldPath: string, newPath: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/renameFile`, {
      hash,
      oldPath,
      newPath,
    });
  },

  /**
   * Rename folder
   */
  async renameFolder(hash: string, oldPath: string, newPath: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/renameFolder`, {
      hash,
      oldPath,
      newPath,
    });
  },
};

