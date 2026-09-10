export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface ApiFeatures {
  /**
   * Use /torrents/stop and /torrents/start (qBit 5.0+ / WebAPI ≥ 2.11.0).
   * When false, use /torrents/pause and /torrents/resume (v4.x).
   */
  useStartStopEndpoints: boolean;
  /** torrents/info response includes ratio_limit and seeding_time_limit fields (WebAPI ≥ 2.8.0 / qBit 4.3.x). */
  hasRatioLimitFields: boolean;
  /** torrents/info response includes content_path field (WebAPI ≥ 2.11.0 / qBit 5.0). */
  hasContentPath: boolean;
  /** setShareLimits / add torrent accept inactiveSeedingTimeLimit parameter (WebAPI ≥ 2.11.0). */
  supportsInactiveSeedingLimit: boolean;
  /** app/getCookies and app/setCookies endpoints exist (WebAPI ≥ 2.11.0). */
  supportsSetCookies: boolean;
  /** search/downloadTorrent endpoint exists (WebAPI ≥ 2.11.0 / qBit 5.0). */
  supportsSearchDownloadTorrent: boolean;
  /**
   * app/preferences uses the "add_stopped_enabled" key (qBit 5.0+ / WebAPI ≥ 2.11.0).
   * When false, use the legacy "start_paused_enabled" key (v4.x).
   */
  useAddStoppedEnabledPreference: boolean;
  /**
   * torrents/add takes the "stopped" form field (qBit 5.0+ / WebAPI ≥ 2.11.0).
   * When false, use the legacy "paused" field (v4.x). Distinct from
   * useAddStoppedEnabledPreference, which covers the app/preferences KEY of the
   * same name — these are two separate renames that happen to share a version
   * boundary, and only the preference one was handled previously.
   */
  useStoppedAddParam: boolean;
  /**
   * torrents/add takes "contentLayout" (Original/Subfolder/NoSubfolder) — WebAPI ≥ 2.7.0 /
   * qBit 4.3.2. The wiki still documents "root_folder", but qBittorrent's
   * torrentscontroller.cpp has not read that field since 4.3.x (verified against
   * release-4.6.0 and release-5.0.0) — it is silently dropped with HTTP 200.
   */
  useContentLayoutAddParam: boolean;
  /** app/getDirectoryContent endpoint exists, for path autocomplete (WebAPI ≥ 2.11.0 / qBit 5.0). */
  supportsGetDirectoryContent: boolean;
  /** search/results includes a pubDate field per result, for sort-by-date (WebAPI ≥ 2.11.0 / qBit 5.0). */
  supportsSearchPubDate: boolean;
  /**
   * torrents/properties response includes a private-tracker field — confirmed
   * against source, not the wiki, which documents a field named "isPrivate"
   * that doesn't actually exist at any version. The real keys are "is_private"
   * (WebAPI ≥ 2.9.0 / qBit 4.6+, always torrent->isPrivate()) and "private"
   * (WebAPI ≥ 2.11.0 / qBit 5.0+, same value but null until metadata arrives).
   * This flag covers the older, always-present "is_private" key.
   */
  hasIsPrivate: boolean;
  /**
   * app/preferences' proxy_type is a string enum ("None"/"HTTP"/"SOCKS5"/"SOCKS4")
   * and proxy_bittorrent/proxy_rss/proxy_misc/proxy_hostname_lookup exist
   * (WebAPI ≥ 2.9.0 / qBit 4.6.0+, confirmed against qBittorrent source, not the
   * wiki — the wiki's app/preferences page never documents this rename or I2P).
   * Below this, proxy_type is an integer (-1/1/2/3/4/5, with 3/4 meaning "with
   * authentication" since proxy_auth_enabled isn't settable pre-4.6) and the
   * single proxy_torrents_only flag stands in for the three granular toggles.
   */
  hasModernProxyFields: boolean;
  /** I2P settings (i2p_enabled etc.) exist in app/preferences (WebAPI ≥ 2.11.0 / qBit 5.0). */
  supportsI2p: boolean;
}

export function parseApiVersion(raw: string): ParsedVersion | null {
  const parts = raw.trim().split('.');
  if (parts.length < 2) return null;
  const [major, minor, patch = '0'] = parts;
  const ma = parseInt(major, 10);
  const mi = parseInt(minor, 10);
  const pa = parseInt(patch, 10);
  if (isNaN(ma) || isNaN(mi) || isNaN(pa)) return null;
  return { major: ma, minor: mi, patch: pa };
}

function gte(v: ParsedVersion, major: number, minor: number, patch = 0): boolean {
  if (v.major !== major) return v.major > major;
  if (v.minor !== minor) return v.minor > minor;
  return v.patch >= patch;
}

// When version is unknown/unparseable, assume the latest feature set so v5
// servers continue to work and detection failures don't silently downgrade behavior.
const V5_FEATURES: ApiFeatures = {
  useStartStopEndpoints: true,
  hasRatioLimitFields: true,
  hasContentPath: true,
  supportsInactiveSeedingLimit: true,
  supportsSetCookies: true,
  supportsSearchDownloadTorrent: true,
  useAddStoppedEnabledPreference: true,
  useStoppedAddParam: true,
  useContentLayoutAddParam: true,
  supportsGetDirectoryContent: true,
  supportsSearchPubDate: true,
  hasIsPrivate: true,
  hasModernProxyFields: true,
  supportsI2p: true,
};

export function getApiFeatures(apiVersion: string | null): ApiFeatures {
  if (!apiVersion) return { ...V5_FEATURES };
  const v = parseApiVersion(apiVersion);
  if (!v) return { ...V5_FEATURES };

  const isV5 = gte(v, 2, 11);
  return {
    useStartStopEndpoints: isV5,
    hasRatioLimitFields: gte(v, 2, 8),
    hasContentPath: isV5,
    supportsInactiveSeedingLimit: isV5,
    supportsSetCookies: isV5,
    supportsSearchDownloadTorrent: isV5,
    useAddStoppedEnabledPreference: isV5,
    useStoppedAddParam: isV5,
    useContentLayoutAddParam: gte(v, 2, 7),
    supportsGetDirectoryContent: isV5,
    supportsSearchPubDate: isV5,
    hasIsPrivate: gte(v, 2, 9),
    hasModernProxyFields: gte(v, 2, 9),
    supportsI2p: isV5,
  };
}

/** Preference key for "start torrents in a stopped/paused state" — renamed in qBit 5.0. */
export function getPauseOnAddPreferenceKey(
  features: ApiFeatures,
): 'add_stopped_enabled' | 'start_paused_enabled' {
  return features.useAddStoppedEnabledPreference ? 'add_stopped_enabled' : 'start_paused_enabled';
}
