import type { SearchCartItem } from '@/context/SearchCartContext';

export interface CartAddGroup {
  urls: string[];
  /** Tracker tag to apply to this group, or null for no extra tag. */
  tag: string | null;
}

/**
 * Split cart items into torrents/add batches (#217).
 *
 * torrents/add applies one `tags` value to every URL in the request, but a
 * cart can mix indexers — so when auto-tag-by-tracker is on, each indexer
 * needs its own request. Items with no resolvable indexer label collect into
 * a single untagged group. With the pref off, everything is one group, which
 * is also the single-request fast path.
 *
 * Group order follows first appearance in `items`, so a retry issues the same
 * requests in the same order.
 */
export function groupCartItemsForAdd(
  items: SearchCartItem[],
  autoTagByTracker: boolean,
): CartAddGroup[] {
  if (items.length === 0) return [];

  if (!autoTagByTracker) {
    return [{ urls: items.map((item) => item.fileUrl), tag: null }];
  }

  const order: string[] = [];
  const buckets = new Map<string, string[]>();

  for (const item of items) {
    const label = item.indexerLabel.trim();
    if (!buckets.has(label)) {
      order.push(label);
      buckets.set(label, []);
    }
    buckets.get(label)!.push(item.fileUrl);
  }

  return order.map((label) => ({
    urls: buckets.get(label)!,
    tag: label ? label : null,
  }));
}
