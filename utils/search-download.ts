/**
 * search-download.ts — how a Search result's URL gets added through the search
 * plugin that produced it (#284).
 *
 * Some plugins (LimeTorrents, …) return an HTML description page as a result's
 * link and can only turn it into a torrent through their own `download_torrent()`,
 * which pulls the magnet out of the page. Handing that URL to a plain
 * `torrents/add` makes qBittorrent download the HTML, fail to parse it and still
 * answer 200 — the app reports success and nothing ever appears. Two endpoints
 * let the plugin do the fetching:
 *   - `torrents/add` with `downloader=<plugin>` (WebAPI ≥ 2.13.1) — keeps every
 *     other add option (save path, category, tags, stopped, …);
 *   - `search/downloadTorrent` (WebAPI ≥ 2.11.0) — applies qBittorrent's DEFAULT
 *     add options only.
 * qBittorrent 4.x has neither, so it stays on a plain add.
 */
import type { SearchResult } from '@/types/api';
import type { ApiFeatures } from '@/utils/apiVersion';
import { isMagnetLink } from '@/utils/magnet';

const AGGREGATOR_ENGINE = /jackett|prowlarr/i;
const API_KEY_PARAM = /[?&](?:jackett_)?apikey=/i;

/**
 * Whether this result came from an aggregator plugin (Jackett/Prowlarr, which
 * proxy many trackers behind one plugin). Judged per result — by the plugin's
 * name, or by the apikey those links embed in their query string, which also
 * catches an aggregator plugin that goes by another name. It deliberately does
 * NOT infer it from every result sharing one site: a search with a single
 * ordinary plugin enabled looks exactly like that.
 */
export function isAggregatorResult(result: Pick<SearchResult, 'fileUrl' | 'engineName'>): boolean {
  return (
    AGGREGATOR_ENGINE.test(result.engineName ?? '') || API_KEY_PARAM.test(result.fileUrl ?? '')
  );
}

/**
 * The search plugin that should fetch this result's URL, or `undefined` when the
 * URL can simply be added as it is.
 *
 * Only non-magnet URLs need a plugin (a magnet is self-contained). Aggregator
 * results (`isAggregatorResult`) are the exception: their download links carry
 * their own apikey and often answer with a redirect straight to a magnet URI,
 * which qBittorrent core follows fine through `torrents/add` while the Python
 * search plugins choke on the non-HTTP redirect.
 */
export function getResultDownloader(
  result: Pick<SearchResult, 'fileUrl' | 'engineName'>,
): string | undefined {
  if (!result.engineName) return undefined;
  if (!result.fileUrl || isMagnetLink(result.fileUrl)) return undefined;
  if (isAggregatorResult(result)) return undefined;
  return result.engineName;
}

export type PluginUrlAddPlan =
  /** `torrents/add` with `downloader` — every add option still applies. */
  | 'addWithDownloader'
  /** `search/downloadTorrent` — the plugin fetches it, qBittorrent's default add options apply. */
  | 'searchDownloadTorrent'
  /** `torrents/add` with the URL as it is. */
  | 'plainAdd';

/** Which endpoint adds a URL that `getResultDownloader` named a plugin for, on this server. */
export function planPluginUrlAdd(
  downloader: string | undefined,
  features: Pick<ApiFeatures, 'supportsFetchMetadataDownloader' | 'supportsSearchDownloadTorrent'>,
): PluginUrlAddPlan {
  if (!downloader) return 'plainAdd';
  if (features.supportsFetchMetadataDownloader) return 'addWithDownloader';
  if (features.supportsSearchDownloadTorrent) return 'searchDownloadTorrent';
  return 'plainAdd';
}

/** The URL an add dialog was pre-filled with from Search, and the plugin that must fetch it. */
export interface PrefilledPlugin {
  url: string;
  plugin: string;
}

/**
 * The plugin to use for what an add dialog is about to submit, or `undefined` for
 * a plain add. It only applies when the submitted URLs are exactly the pre-filled
 * one: once the user edits that URL or adds more, the plugin no longer
 * necessarily fetches what they typed, so falling back to a plain add is the
 * only safe choice.
 */
export function getPrefilledDownloader(
  urls: string[],
  prefilled: PrefilledPlugin | null | undefined,
): string | undefined {
  if (!prefilled || urls.length !== 1) return undefined;
  return urls[0].trim() === prefilled.url.trim() ? prefilled.plugin : undefined;
}
