/**
 * save-paths.ts — Derives the set of save-path strings already in use by
 * qBittorrent from data already synced into TorrentContext, so a picker can
 * offer them without any extra API call or a WebAPI version gate (#180).
 */
import { TorrentInfo, Category } from '@/types/api';

/**
 * Collects every non-empty save path already known to the client — each
 * torrent's actual `save_path` plus each category's configured `savePath` —
 * deduped and sorted for display.
 */
export function getKnownSavePaths(
  torrents: TorrentInfo[],
  categories: Record<string, Category>,
): string[] {
  const paths = new Set<string>();
  for (const torrent of torrents) {
    const trimmed = torrent.save_path?.trim();
    if (trimmed) paths.add(trimmed);
  }
  for (const category of Object.values(categories)) {
    const trimmed = category.savePath?.trim();
    if (trimmed) paths.add(trimmed);
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}
