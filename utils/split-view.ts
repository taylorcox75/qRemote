/**
 * split-view.ts — whether the Torrents tab shows the list and a torrent's
 * detail side by side (#Duo phase 2). Pure so the rules are tested apart from
 * the layout.
 *
 * Split only on the list itself: once something is pushed (files, trackers,
 * or a detail opened the narrow way) the stack takes the full width again, so
 * a pushed screen never squeezes into the list column.
 */
import { SPLIT_LIST_WIDTH, SPLIT_VIEW_MIN_WIDTH } from '@/constants/spacing';

export interface SplitLayout {
  split: boolean;
  /** Width of the list column including its left inset (0 when not split). */
  listWidth: number;
}

export function getSplitLayout(
  windowWidth: number,
  insets: { left: number; right: number },
  pathname: string,
): SplitLayout {
  const available = windowWidth - insets.left - insets.right;
  // Only a screen pushed inside the Torrents stack takes the full width. Other
  // tabs' routes (this layout stays mounted under them) must not count, or
  // switching back to Torrents renders one narrow frame before the route updates.
  const onList = !pathname.startsWith('/torrent/');
  if (!onList || available < SPLIT_VIEW_MIN_WIDTH) return { split: false, listWidth: 0 };
  return { split: true, listWidth: SPLIT_LIST_WIDTH + insets.left };
}
