/**
 * rss-rule.ts — builds the `ruleDef` sent to `rss/setRule` from the rule the
 * server returned plus the fields the app's rule editor edits.
 *
 * `rss/setRule` replaces the whole rule, so anything the app doesn't know
 * about (`priority`, `torrentParams`, future keys) must be carried over from
 * the fetched rule or it is reset.
 *
 * qBittorrent 4.6+ (`rss_autodownloadrule.cpp` `fromJsonObject`) reads the
 * add options from `torrentParams` when that key is present and then ignores
 * the legacy flat `savePath` / `assignedCategory` / `addPaused` /
 * `torrentContentLayout` fields entirely. So when the fetched rule carries
 * `torrentParams`, the app's edits to those four are also written into it
 * (keys from `addtorrentparams.cpp`: `save_path`, `category`, `stopped`,
 * `content_layout`). Older servers have no `torrentParams` and read only the
 * flat fields, which are always sent.
 */
import { RssRule } from '@/types/api';

/** The fields the rule editor owns. */
export type RssRuleEdits = Pick<
  RssRule,
  | 'enabled'
  | 'mustContain'
  | 'mustNotContain'
  | 'useRegex'
  | 'episodeFilter'
  | 'smartFilter'
  | 'previouslyMatchedEpisodes'
  | 'affectedFeeds'
  | 'ignoreDays'
  | 'lastMatch'
  | 'addPaused'
  | 'assignedCategory'
  | 'savePath'
  | 'torrentContentLayout'
>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Set `key` to `value`, or remove it when `value` is null (server default). */
function setOrDelete(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value === null || value === undefined) delete target[key];
  else target[key] = value;
}

/**
 * Merge the editor's fields over the fetched rule. `existing` is undefined
 * when creating a new rule. Only add options the user actually changed are
 * written into `torrentParams`, so values the server normalised are left as
 * they were.
 */
export function buildRssRuleDef(existing: RssRule | undefined, edits: RssRuleEdits): RssRule {
  const ruleDef: RssRule = { ...(existing ?? {}), ...edits };

  if (!existing || !isPlainObject(existing.torrentParams)) {
    return ruleDef;
  }

  const params: Record<string, unknown> = { ...existing.torrentParams };

  if (edits.savePath !== existing.savePath) {
    params.save_path = edits.savePath;
    // Mirrors the legacy-field parse: an explicit save path turns Automatic
    // Torrent Management off; clearing it goes back to the server default.
    setOrDelete(params, 'use_auto_tmm', edits.savePath ? false : null);
  }
  if (edits.assignedCategory !== existing.assignedCategory) {
    params.category = edits.assignedCategory;
  }
  if (edits.addPaused !== existing.addPaused) {
    setOrDelete(params, 'stopped', edits.addPaused);
  }
  if ((edits.torrentContentLayout || null) !== (existing.torrentContentLayout || null)) {
    setOrDelete(params, 'content_layout', edits.torrentContentLayout || null);
  }

  ruleDef.torrentParams = params;
  return ruleDef;
}
