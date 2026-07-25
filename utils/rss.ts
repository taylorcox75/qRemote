/**
 * rss.ts — Pure helpers for qBittorrent's RSS item tree, which is a nested
 * object keyed by name where a feed node (has a `url` key) can sit alongside
 * folder nodes (plain nested objects) at any depth. Paths are joined with
 * `\` per qBittorrent's own convention (addFolder/addFeed/moveItem params).
 *
 * Key exports: isRssFeed, flattenRssTree, joinRssPath, parentRssPath, rssPathBaseName
 */
import { RssFeed, RssItemsResponse, RssTreeNode } from '@/types/api';

export function isRssFeed(node: RssTreeNode): node is RssFeed {
  return typeof (node as RssFeed).url === 'string';
}

export function joinRssPath(parent: string, name: string): string {
  return parent ? `${parent}\\${name}` : name;
}

export function parentRssPath(path: string): string {
  const idx = path.lastIndexOf('\\');
  return idx === -1 ? '' : path.slice(0, idx);
}

export function rssPathBaseName(path: string): string {
  const idx = path.lastIndexOf('\\');
  return idx === -1 ? path : path.slice(idx + 1);
}

export interface FlattenedRssTree {
  folders: string[];
  feeds: { path: string; feed: RssFeed }[];
}

/**
 * Walks the tree depth-first, collecting every folder path and every feed
 * (with its full path) found at any depth. Root-level items have no parent
 * prefix — their path is just their own name.
 */
export function flattenRssTree(tree: RssItemsResponse): FlattenedRssTree {
  const folders: string[] = [];
  const feeds: { path: string; feed: RssFeed }[] = [];

  const walk = (node: RssItemsResponse, parentPath: string) => {
    for (const [name, child] of Object.entries(node)) {
      const path = joinRssPath(parentPath, name);
      if (isRssFeed(child)) {
        feeds.push({ path, feed: child });
      } else {
        folders.push(path);
        walk(child as RssItemsResponse, path);
      }
    }
  };

  walk(tree, '');
  return { folders, feeds };
}
