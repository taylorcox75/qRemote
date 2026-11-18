/**
 * rss.ts — Pure helpers for qBittorrent's RSS item tree, which is a nested
 * object keyed by name where a feed node (has a `url` key) can sit alongside
 * folder nodes (plain nested objects) at any depth. Paths are joined with
 * `\` per qBittorrent's own convention (addFolder/addFeed/moveItem params).
 *
 * Key exports: isRssFeed, flattenRssTree, joinRssPath, parentRssPath, rssPathBaseName, getRssFeedDisplayName, toSearchQuery, sortArticlesByDateDesc
 */
import { RssArticle, RssFeed, RssItemsResponse, RssTreeNode } from '@/types/api';

/** A plain (non-array) object — the only shape a tree, folder or feed node can be. */
export function isRssObject(node: unknown): node is Record<string, unknown> {
  return !!node && typeof node === 'object' && !Array.isArray(node);
}

export function isRssFeed(node: RssTreeNode): node is RssFeed {
  return isRssObject(node) && typeof node.url === 'string';
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

/**
 * The name to show for a feed. qBittorrent keys the tree by the item name (the
 * path), so a name the user chose — a rename (#273) — always wins. A feed that
 * was never named has the URL as its name (`rss/addFeed` falls back to the URL
 * for an empty path), and there the feed's own title reads far better.
 */
export function getRssFeedDisplayName(path: string, feed: Pick<RssFeed, 'url' | 'title'>): string {
  const name = rssPathBaseName(path);
  if (name && name.trim() !== (feed.url ?? '').trim()) return name;
  return feed.title || feed.url;
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
    // A non-object here (a text body, null, an array) would make Object.entries
    // yield characters and recurse forever (#334-class crash at connect).
    if (!isRssObject(node)) return;
    for (const [name, child] of Object.entries(node)) {
      const path = joinRssPath(parentPath, name);
      if (isRssFeed(child)) {
        feeds.push({ path, feed: child });
      } else if (isRssObject(child)) {
        folders.push(path);
        walk(child as RssItemsResponse, path);
      }
    }
  };

  walk(tree, '');
  return { folders, feeds };
}

/**
 * Turns a media title (e.g. from a Plex Watchlist article) into a minimal
 * search query, the way Sonarr/Radarr build release-search terms:
 * "Title (YYYY)" -> "Title YYYY" — the year is kept (it helps narrow
 * matches) but unwrapped from parens/brackets, since indexers essentially
 * never index the year with the parens still on it. Any other
 * parenthetical/bracketed qualifier (e.g. "(Remastered)", "[Extended Cut]")
 * is stripped entirely, then whitespace is collapsed.
 */
export function toSearchQuery(title: string): string {
  return title
    .replace(/[([](\d{4})[)\]]/g, '$1')
    .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseArticleTime(raw?: string): number | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/**
 * Sorts RSS articles newest first. Articles with a missing or unparseable
 * `date` sort last, keeping their original relative order (Array.sort is
 * stable) rather than shuffling a feed that has no dates at all. Returns a
 * new array — the input often comes straight off cached query data.
 */
export function sortArticlesByDateDesc(articles: RssArticle[]): RssArticle[] {
  return [...articles].sort((a, b) => {
    const timeA = parseArticleTime(a.date);
    const timeB = parseArticleTime(b.date);
    if (timeA === null && timeB === null) return 0;
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    return timeB - timeA;
  });
}
