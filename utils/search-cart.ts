import type { SearchCartItem } from '@/context/SearchCartContext';

export interface CartAddGroup {
  urls: string[];
  /** Tracker tag to apply to this group, or null for no extra tag. */
  tag: string | null;
  /**
   * Search plugin that must fetch this group's URLs (#284), set only when the
   * group's items came with one. torrents/add takes a single `downloader` per
   * request, so items with different (or no) plugins never share a group.
   */
  downloader?: string;
}

/**
 * Split cart items into torrents/add batches (#217).
 *
 * torrents/add applies one `tags` value and one `downloader` to every URL in
 * the request, but a cart can mix indexers and plugin-resolved links — so each
 * distinct (indexer when auto-tag-by-tracker is on, plugin) pair needs its own
 * request. Items with no resolvable indexer label collect into a single
 * untagged group. With the pref off and no plugins involved, everything is one
 * group, which is also the single-request fast path.
 *
 * Group order follows first appearance in `items`, so a retry issues the same
 * requests in the same order.
 */
export function groupCartItemsForAdd(
  items: SearchCartItem[],
  autoTagByTracker: boolean,
): CartAddGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, CartAddGroup>();

  for (const item of items) {
    const label = autoTagByTracker ? item.indexerLabel.trim() : '';
    const downloader = item.downloader || undefined;
    const key = `${label}\u0000${downloader ?? ''}`;
    let group = buckets.get(key);
    if (!group) {
      group = { urls: [], tag: label ? label : null };
      if (downloader) group.downloader = downloader;
      buckets.set(key, group);
      order.push(key);
    }
    group.urls.push(item.fileUrl);
  }

  return order.map((key) => buckets.get(key)!);
}
