/**
 * search.ts — API wrapper for qBittorrent /api/v2/search/* endpoints.
 *
 * Available from qBittorrent v4.1.4 / WebAPI v2.1.1.
 * Requires Python to be installed on the qBittorrent host.
 *
 * Key exports: searchApi
 */
import { apiClient } from './client';
import {
  SearchJob,
  SearchJobStatus,
  SearchPlugin,
  SearchResultsResponse,
} from '@/types/api';

const API_VERSION = 'v2';

export const searchApi = {
  /**
   * Start a search job.
   *
   * @param pattern — term to search for
   * @param plugins — list of plugin names, or the literal strings "all" / "enabled"
   * @param category — category id supported by the selected plugin(s), or "all"
   * @returns { id } — the new job id
   * @throws when the server's concurrent-search limit is reached (HTTP 409)
   */
  async start(
    pattern: string,
    plugins: string | string[],
    category: string,
  ): Promise<SearchJob> {
    const pluginsParam = Array.isArray(plugins) ? plugins.join('|') : plugins;
    return (await apiClient.postUrlEncoded(`/api/${API_VERSION}/search/start`, {
      pattern,
      plugins: pluginsParam,
      category,
    })) as SearchJob;
  },

  /**
   * Stop a running search.
   *
   * @throws HTTP 404 when the job does not exist on the server
   */
  async stop(id: number): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/search/stop`, { id });
  },

  /**
   * Get the status of a single job, or all jobs when id is omitted.
   */
  async getStatus(id?: number): Promise<SearchJobStatus[]> {
    const params: Record<string, string | number | boolean> = {};
    if (id !== undefined) params.id = id;
    const response = await apiClient.get(
      `/api/${API_VERSION}/search/status`,
      params,
    );
    return Array.isArray(response) ? (response as SearchJobStatus[]) : [];
  },

  /**
   * Get paginated results for a given job.
   *
   * @throws HTTP 404 when the job does not exist, HTTP 409 when the offset is invalid
   */
  async getResults(
    id: number,
    limit?: number,
    offset?: number,
  ): Promise<SearchResultsResponse> {
    const params: Record<string, string | number | boolean> = { id };
    if (limit !== undefined) params.limit = limit;
    if (offset !== undefined) params.offset = offset;
    return (await apiClient.get(
      `/api/${API_VERSION}/search/results`,
      params,
    )) as SearchResultsResponse;
  },

  /**
   * Delete a search job server-side. Idempotent in practice — callers may
   * swallow 404s from a job that has already been removed.
   */
  async deleteSearch(id: number): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/search/delete`, { id });
  },

  /**
   * Retrieve details of all installed search plugins.
   */
  async getPlugins(): Promise<SearchPlugin[]> {
    const response = await apiClient.get(`/api/${API_VERSION}/search/plugins`);
    return Array.isArray(response) ? (response as SearchPlugin[]) : [];
  },

  /**
   * Install one or more plugins from URLs or filepaths.
   */
  async installPlugin(sources: string | string[]): Promise<void> {
    const sourcesParam = Array.isArray(sources) ? sources.join('|') : sources;
    await apiClient.postUrlEncoded(
      `/api/${API_VERSION}/search/installPlugin`,
      { sources: sourcesParam },
    );
  },

  /**
   * Uninstall one or more plugins by name.
   */
  async uninstallPlugin(names: string | string[]): Promise<void> {
    const namesParam = Array.isArray(names) ? names.join('|') : names;
    await apiClient.postUrlEncoded(
      `/api/${API_VERSION}/search/uninstallPlugin`,
      { names: namesParam },
    );
  },

  /**
   * Enable or disable one or more plugins.
   */
  async enablePlugin(
    names: string | string[],
    enable: boolean,
  ): Promise<void> {
    const namesParam = Array.isArray(names) ? names.join('|') : names;
    await apiClient.postUrlEncoded(
      `/api/${API_VERSION}/search/enablePlugin`,
      { names: namesParam, enable: enable ? 'true' : 'false' },
    );
  },

  /**
   * Trigger an auto-update of all installed plugins.
   */
  async updatePlugins(): Promise<void> {
    await apiClient.postUrlEncoded(
      `/api/${API_VERSION}/search/updatePlugins`,
      {},
    );
  },

  /**
   * Download a .torrent file or magnet using a specific plugin's context.
   *
   * Available from qBittorrent v5.0.0 / WebAPI v2.11. Useful when a plugin's
   * result URL needs plugin-side fetching (cookies, login, etc.). For typical
   * magnet/.torrent URLs, prefer torrentsApi.addTorrent directly.
   */
  async downloadTorrent(url: string, plugin: string): Promise<void> {
    await apiClient.postUrlEncoded(
      `/api/${API_VERSION}/search/downloadTorrent`,
      { url, plugin },
    );
  },
};
