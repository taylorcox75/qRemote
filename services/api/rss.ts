/**
 * rss.ts — API wrapper for qBittorrent /api/v2/rss/* endpoints.
 *
 * Available since early WebAPI v2 — no ApiFeatures gating needed.
 *
 * Key exports: rssApi
 */
import { apiClient } from './client';
import {
  RssItemsResponse,
  RssMatchingArticlesResponse,
  RssRule,
  RssRulesResponse,
} from '@/types/api';

const API_VERSION = 'v2';

export const rssApi = {
  /**
   * Create a new folder in the RSS item tree.
   *
   * @throws HTTP 409 when a folder already exists at that path
   */
  async addFolder(path: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/addFolder`, { path });
  },

  /**
   * Add a new feed at the given parent folder path (empty string = root).
   *
   * @throws HTTP 400 for an invalid feed URL, HTTP 409 when it already exists
   */
  async addFeed(url: string, path: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/addFeed`, { url, path });
  },

  /**
   * Remove a feed or folder (and, for a folder, everything nested inside it).
   */
  async removeItem(path: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/removeItem`, { path });
  },

  /**
   * Move (or rename) an item. Used for both: rename keeps the same parent and
   * changes only the last path segment; move keeps the last segment and
   * changes the parent.
   */
  async moveItem(itemPath: string, destPath: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/moveItem`, {
      itemPath,
      destPath,
    });
  },

  /**
   * Get the full folder/feed tree. withData=true also includes each feed's
   * articles (default true — the app always needs article data to render).
   */
  async getAllItems(withData = true): Promise<RssItemsResponse> {
    const response = await apiClient.get(`/api/${API_VERSION}/rss/items`, { withData });
    return (response as RssItemsResponse) || {};
  },

  /**
   * Mark a single article as read, or the entire feed when articleId is omitted.
   */
  async markAsRead(itemPath: string, articleId?: string): Promise<void> {
    const params: Record<string, string> = { itemPath };
    if (articleId !== undefined) params.articleId = articleId;
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/markAsRead`, params);
  },

  /**
   * Trigger an immediate refresh of a single feed.
   */
  async refreshItem(itemPath: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/refreshItem`, { itemPath });
  },

  /**
   * Create or update an auto-downloading rule.
   */
  async setRule(ruleName: string, ruleDef: RssRule): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/setRule`, {
      ruleName,
      ruleDef: JSON.stringify(ruleDef),
    });
  },

  /**
   * Rename an existing rule.
   */
  async renameRule(ruleName: string, newRuleName: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/renameRule`, {
      ruleName,
      newRuleName,
    });
  },

  /**
   * Delete a rule.
   */
  async removeRule(ruleName: string): Promise<void> {
    await apiClient.postUrlEncoded(`/api/${API_VERSION}/rss/removeRule`, { ruleName });
  },

  /**
   * Get all auto-downloading rules, keyed by rule name.
   */
  async getAllRules(): Promise<RssRulesResponse> {
    const response = await apiClient.get(`/api/${API_VERSION}/rss/rules`);
    return (response as RssRulesResponse) || {};
  },

  /**
   * Get articles across all affected feeds that currently match a rule,
   * keyed by feed URL. Useful for previewing a rule before saving it live.
   */
  async getMatchingArticles(ruleName: string): Promise<RssMatchingArticlesResponse> {
    const response = await apiClient.get(`/api/${API_VERSION}/rss/matchingArticles`, {
      ruleName,
    });
    return (response as RssMatchingArticlesResponse) || {};
  },
};
