/**
 * server-preferences.ts — decide which qBittorrent preference rows a server
 * actually supports, from the object `app/preferences` returned.
 *
 * `app/setPreferences` silently ignores keys a version doesn't know and still
 * answers 200, so a row for a newer key "saves" and then reverts on reload.
 * Instead of a version table, a row is shown only when its key is present in
 * the fetched preferences (qBittorrent reports every key it can set). A failed
 * fetch yields no keys, so map-valued settings such as `scan_dirs` can't be
 * rewritten from an empty placeholder.
 */

/** Keys present in a fetched `app/preferences` object; empty when the fetch failed. */
export function getPreferenceKeys(prefs: unknown): ReadonlySet<string> {
  if (typeof prefs !== 'object' || prefs === null || Array.isArray(prefs)) return new Set();
  return new Set(Object.keys(prefs));
}

export type ContentLayout = 'Original' | 'Subfolder' | 'NoSubfolder';

/**
 * Which key backs the default "Content layout" setting. qBit 4.3.2 replaced
 * the `create_subfolder_enabled` bool with the `torrent_content_layout` enum
 * (migrating true → Original, false → NoSubfolder).
 */
export function getContentLayoutKey(
  keys: ReadonlySet<string>,
): 'torrent_content_layout' | 'create_subfolder_enabled' | null {
  if (keys.has('torrent_content_layout')) return 'torrent_content_layout';
  if (keys.has('create_subfolder_enabled')) return 'create_subfolder_enabled';
  return null;
}

/** Read the content layout from either key; defaults to Original. */
export function readContentLayout(prefs: Record<string, unknown> | null): ContentLayout {
  const layout = prefs?.torrent_content_layout;
  if (layout === 'Original' || layout === 'Subfolder' || layout === 'NoSubfolder') return layout;
  if (prefs && typeof prefs.create_subfolder_enabled === 'boolean') {
    return prefs.create_subfolder_enabled ? 'Original' : 'NoSubfolder';
  }
  return 'Original';
}
