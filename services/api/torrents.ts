/**
 * torrents.ts — API wrapper for all qBittorrent /api/v2/torrents/* endpoints (CRUD, priorities, limits, trackers, files).
 *
 * Key exports: torrentsApi
 * Known issues: None currently tracked.
 */
import { AxiosError } from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
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
} from '@/types/api';

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
    hashes?: string[],
  ): Promise<TorrentInfo[]> {
    const params: Record<string, string | number | boolean> = {};

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
      return response as TorrentInfo[];
    }

    return [];
  },

  /**
   * Get torrent generic properties
   */
  async getTorrentProperties(hash: string): Promise<TorrentProperties> {
    return (await apiClient.get(`/api/${API_VERSION}/torrents/properties`, {
      hash,
    })) as TorrentProperties;
  },

  /**
   * Get torrent trackers
   */
  async getTorrentTrackers(hash: string): Promise<Tracker[]> {
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/trackers`, { hash });
    return Array.isArray(response) ? (response as Tracker[]) : [];
  },

  /**
   * Get torrent web seeds
   */
  async getTorrentWebSeeds(hash: string): Promise<WebSeed[]> {
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/webseeds`, { hash });
    return Array.isArray(response) ? (response as WebSeed[]) : [];
  },

  /**
   * Get torrent contents (files)
   */
  async getTorrentContents(hash: string, indexes?: number[]): Promise<TorrentFile[]> {
    const params: Record<string, string | number | boolean> = { hash };
    if (indexes && indexes.length > 0) {
      params.indexes = indexes.join('|');
    }
    const response = await apiClient.get(`/api/${API_VERSION}/torrents/files`, params);
    return Array.isArray(response) ? (response as TorrentFile[]) : [];
  },

  /**
   * Get torrent pieces' states
   */
  async getTorrentPiecesStates(hash: string): Promise<TorrentPieceState> {
    return (await apiClient.get(`/api/${API_VERSION}/torrents/pieceStates`, {
      hash,
    })) as TorrentPieceState;
  },

  /**
   * Get torrent pieces' hashes
   */
  async getTorrentPiecesHashes(hash: string): Promise<TorrentPieceHash> {
    return (await apiClient.get(`/api/${API_VERSION}/torrents/pieceHashes`, {
      hash,
    })) as TorrentPieceHash;
  },

  /**
   * Pause torrents.
   * Uses /torrents/stop on qBittorrent 5.x (WebAPI ≥ 2.11) and /torrents/pause on 4.x.
   */
  async pauseTorrents(hashes: string[]): Promise<void> {
    const hashString = hashes.join('|');
    const endpoint = apiClient.getApiFeatures().useStartStopEndpoints ? 'stop' : 'pause';
    try {
      await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/${endpoint}`, {
        hashes: hashString,
      });
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        console.error('Pause API error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: error.config?.url,
        });
      }
      throw error;
    }
  },

  /**
   * Resume torrents.
   * Uses /torrents/start on qBittorrent 5.x (WebAPI ≥ 2.11) and /torrents/resume on 4.x.
   */
  async resumeTorrents(hashes: string[]): Promise<void> {
    const hashString = hashes.join('|');
    const endpoint = apiClient.getApiFeatures().useStartStopEndpoints ? 'start' : 'resume';
    try {
      await apiClient.postUrlEncoded(`/api/${API_VERSION}/torrents/${endpoint}`, {
        hashes: hashString,
      });
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        console.error('Resume API error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: error.config?.url,
        });
      }
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
      stopped?: boolean;
      root_folder?: boolean;
      rename?: string;
      upLimit?: number;
      dlLimit?: number;
      ratioLimit?: number;
      seedingTimeLimit?: number;
      sequentialDownload?: boolean;
      firstLastPiecePrio?: boolean;
      autoTMM?: boolean;
      useDownloadPath?: boolean;
      downloadPath?: string;
    },
  ): Promise<void> {
    const formData = new FormData();

    // qBittorrent's API takes a single "urls" field with entries separated by
    // newlines — repeating the "urls" form field per URL (as this used to do)
    // only ever registers one of them server-side and silently drops the rest.
    formData.append('urls', Array.isArray(urls) ? urls.join('\n') : urls);

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
      if (options.stopped !== undefined) {
        // qBit 5.0 renamed this form field from "paused" to "stopped". An
        // unrecognised field is silently ignored by the server, so on a 4.x
        // server the "add stopped" toggle would look like it worked and the
        // torrent would start downloading anyway.
        const stoppedField = apiClient.getApiFeatures().useStoppedAddParam ? 'stopped' : 'paused';
        formData.append(stoppedField, String(options.stopped));
      }
      if (options.root_folder !== undefined) {
        if (apiClient.getApiFeatures().useContentLayoutAddParam) {
          // "root_folder" has been a no-op since qBit 4.3.2; the live parameter is
          // contentLayout. The switch is ON by default and has never done anything,
          // so ON must keep meaning "server default" (omit the field) — sending
          // 'Subfolder' or 'Original' here would silently change the layout of
          // every add for every existing user. Only OFF sends anything.
          if (!options.root_folder) formData.append('contentLayout', 'NoSubfolder');
        } else {
          // WebAPI < 2.7 (qBit ≤ 4.3.1) genuinely reads root_folder — unchanged.
          formData.append('root_folder', String(options.root_folder));
        }
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
      if (options.useDownloadPath !== undefined) {
        formData.append('useDownloadPath', String(options.useDownloadPath));
      }
      if (options.downloadPath) {
        formData.append('downloadPath', options.downloadPath);
      }
    }

    await apiClient.postFormData(`/api/${API_VERSION}/torrents/add`, formData);
  },

  /**
   * Add torrent file
   */
  async addTorrentFile(
    files:
      { uri: string; name: string; type?: string } | { uri: string; name: string; type?: string }[],
    options?: {
      savepath?: string;
      category?: string;
      tags?: string[];
      skip_checking?: boolean;
      stopped?: boolean;
      root_folder?: boolean;
      rename?: string;
      upLimit?: number;
      dlLimit?: number;
      ratioLimit?: number;
      seedingTimeLimit?: number;
      sequentialDownload?: boolean;
      firstLastPiecePrio?: boolean;
      autoTMM?: boolean;
      useDownloadPath?: boolean;
      downloadPath?: string;
    },
  ): Promise<void> {
    const fileList = Array.isArray(files) ? files : [files];

    // Files handed off via iOS "Open In Place" carry a security-scoped file://
    // URI whose access can lapse before we get around to uploading it (e.g. a
    // cold-launch race — see services/incoming-file.ts). Uploading a revoked
    // URI can hang at the native layer with no JS-visible rejection, leaving
    // the caller's spinner stuck forever. Fail fast instead: verify each file
    // is actually readable right before building the request.
    await Promise.all(
      fileList.map(async (file) => {
        if (!file.uri.startsWith('file://')) return;
        const info = await FileSystem.getInfoAsync(file.uri);
        if (!info.exists || info.size === 0) {
          throw new Error(`Couldn't read "${file.name}". Try selecting the file again.`);
        }
      }),
    );

    const formData = new FormData();

    // qBittorrent accepts multiple "torrents" file fields in a single
    // multipart request — append one per selected file.
    fileList.forEach((file) => {
      // @ts-expect-error React Native FormData accepts { uri, type, name } objects for file uploads
      formData.append('torrents', {
        uri: file.uri,
        type: file.type || 'application/x-bittorrent',
        name: file.name,
      });
    });

    if (options) {
      if (options.savepath) formData.append('savepath', options.savepath);
      if (options.category) formData.append('category', options.category);
      if (options.tags && options.tags.length > 0) {
        formData.append('tags', options.tags.join(','));
      }
      if (options.skip_checking !== undefined) {
        formData.append('skip_checking', String(options.skip_checking));
      }
      if (options.stopped !== undefined) {
        // qBit 5.0 renamed this form field from "paused" to "stopped". An
        // unrecognised field is silently ignored by the server, so on a 4.x
        // server the "add stopped" toggle would look like it worked and the
        // torrent would start downloading anyway.
        const stoppedField = apiClient.getApiFeatures().useStoppedAddParam ? 'stopped' : 'paused';
        formData.append(stoppedField, String(options.stopped));
      }
      if (options.root_folder !== undefined) {
        if (apiClient.getApiFeatures().useContentLayoutAddParam) {
          // "root_folder" has been a no-op since qBit 4.3.2; the live parameter is
          // contentLayout. The switch is ON by default and has never done anything,
          // so ON must keep meaning "server default" (omit the field) — sending
          // 'Subfolder' or 'Original' here would silently change the layout of
          // every add for every existing user. Only OFF sends anything.
          if (!options.root_folder) formData.append('contentLayout', 'NoSubfolder');
        } else {
          // WebAPI < 2.7 (qBit ≤ 4.3.1) genuinely reads root_folder — unchanged.
          formData.append('root_folder', String(options.root_folder));
        }
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
      if (options.useDownloadPath !== undefined) {
        formData.append('useDownloadPath', String(options.useDownloadPath));
      }
      if (options.downloadPath) {
        formData.append('downloadPath', options.downloadPath);
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
    return (response as { [hash: string]: number }) || {};
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
   * Set torrent share limits.
   *
   * Newer qBittorrent (5.x / WebAPI ≥ 2.11.0) REQUIRES inactiveSeedingTimeLimit,
   * shareLimitAction and shareLimitsMode — omitting them fails the request with
   * "Missing required parameters". They are not "leave unchanged" parameters
   * though: the server applies whatever it receives, and the sentinel values
   * ('Default', -2) mean "fall back to the global setting". Sending those blindly
   * wipes the torrent's own share-limit action, and if the global action is
   * "Remove" the server can delete a torrent the user only meant to re-limit.
   *
   * So callers must pass the torrent's CURRENT values (straight off `torrents/info`)
   * for everything they are not deliberately changing; the sentinels below are a
   * last resort for servers that don't report the field at all.
   */
  async setTorrentShareLimits(
    hashes: string[],
    limits: {
      ratioLimit?: number;
      seedingTimeLimit?: number;
      inactiveSeedingTimeLimit?: number;
      shareLimitAction?: string;
      shareLimitsMode?: string;
    } = {},
  ): Promise<void> {
    const params: Record<string, string | number | boolean> = {
      hashes: hashes.join('|'),
    };
    if (limits.ratioLimit !== undefined) {
      params.ratioLimit = limits.ratioLimit;
    }
    if (limits.seedingTimeLimit !== undefined) {
      params.seedingTimeLimit = limits.seedingTimeLimit;
    }
    if (apiClient.getApiFeatures().supportsInactiveSeedingLimit) {
      params.inactiveSeedingTimeLimit = limits.inactiveSeedingTimeLimit ?? -2;
      params.shareLimitAction = limits.shareLimitAction ?? 'Default';
      params.shareLimitsMode = limits.shareLimitsMode ?? 'Default';
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
    return (response as { [hash: string]: number }) || {};
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
