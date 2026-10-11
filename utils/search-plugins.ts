/**
 * search-plugins.ts — Pure helpers for the Search tab's plugin chip row (#283).
 *
 * Users can pin their most-used search plugins so those chips sit at the front
 * of the row. Plugins are identified by their qBittorrent `name` id (the same
 * value the chips and `lastSearchPlugin` use), not the display `fullName`.
 */

/** The minimal plugin shape these helpers need — `SearchPlugin` satisfies it. */
export interface PinnablePlugin {
  name: string;
}

/**
 * Moves pinned plugins to the front of an already-sorted plugin list.
 *
 * Both halves keep the incoming relative order, so passing the usual
 * enabled-then-name sort keeps that order inside the pinned group and inside
 * the rest. Pinned names that aren't in `sortedPlugins` (uninstalled, or the
 * plugin list hasn't loaded) are ignored. Returns a new array.
 */
export function orderPluginsWithPins<T extends PinnablePlugin>(
  sortedPlugins: readonly T[],
  pinned: readonly string[] | undefined | null,
): T[] {
  if (!pinned || pinned.length === 0) return [...sortedPlugins];
  const pinnedSet = new Set(pinned);
  const pinnedPlugins: T[] = [];
  const rest: T[] = [];
  for (const plugin of sortedPlugins) {
    (pinnedSet.has(plugin.name) ? pinnedPlugins : rest).push(plugin);
  }
  return [...pinnedPlugins, ...rest];
}

/**
 * Drops pinned names that no longer match an installed plugin and removes
 * duplicates, keeping the first occurrence. Used before persisting a new pin
 * selection so uninstalled plugins don't accumulate in storage.
 */
export function prunePinnedPlugins(
  pinned: readonly string[] | undefined | null,
  installed: readonly PinnablePlugin[],
): string[] {
  if (!pinned || pinned.length === 0) return [];
  const installedNames = new Set(installed.map((p) => p.name));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of pinned) {
    if (!installedNames.has(name) || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

/**
 * The pinned list after tapping a plugin's icon: unpins it when it is pinned,
 * otherwise pins it (appended). Pins for plugins that are no longer installed
 * are dropped along the way, and a name that isn't installed can't be pinned.
 */
export function togglePinnedPlugin(
  pinned: readonly string[] | undefined | null,
  name: string,
  installed: readonly PinnablePlugin[],
): string[] {
  const current = prunePinnedPlugins(pinned, installed);
  if (current.includes(name)) return current.filter((pinnedName) => pinnedName !== name);
  if (!installed.some((plugin) => plugin.name === name)) return current;
  return [...current, name];
}
