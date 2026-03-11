export interface ApiVersion {
  raw: string;
  major: number;
  minor: number;
  patch: number;
}

const FALLBACK: ApiVersion = { raw: '2.9.0', major: 2, minor: 9, patch: 0 };

export function parseApiVersion(raw: string): ApiVersion {
  const parts = raw.split('.').map(Number);
  if (parts.length < 2 || parts.some(isNaN)) {
    console.warn(`[ApiVersion] Could not parse API version "${raw}", using fallback 2.9.0`);
    return FALLBACK;
  }
  const [major, minor, patch = 0] = parts;
  return { raw, major, minor, patch };
}

export function apiAtLeast(
  current: ApiVersion,
  major: number,
  minor: number,
  patch = 0
): boolean {
  if (current.major !== major) return current.major > major;
  if (current.minor !== minor) return current.minor > minor;
  return current.patch >= patch;
}

/** `/torrents/files` response includes `index` field; `filePrio` should use it (API >= 2.8.2) */
export const API_HAS_INDEX_FILE_PRIO = (v: ApiVersion): boolean => apiAtLeast(v, 2, 8, 2);

/** `/torrents/info` accepts a `tag` query parameter (API >= 2.8.3) */
export const API_HAS_TAG_FILTER = (v: ApiVersion): boolean => apiAtLeast(v, 2, 8, 3);

/** `/torrents/add` accepts `ratioLimit` and `seedingTimeLimit` (API >= 2.8.1) */
export const API_HAS_ADD_RATIO_LIMITS = (v: ApiVersion): boolean => apiAtLeast(v, 2, 8, 1);

/** `/torrents/info` response includes `seeding_time` field (API >= 2.8.1) */
export const API_HAS_SEEDING_TIME = (v: ApiVersion): boolean => apiAtLeast(v, 2, 8, 1);

/** `/torrents/info` response includes `content_path` field (API >= 2.6.1) */
export const API_HAS_CONTENT_PATH = (v: ApiVersion): boolean => apiAtLeast(v, 2, 6, 1);

/** `/torrents/info` and `/torrents/properties` include `isPrivate` field (API >= 2.9.0) */
export const API_HAS_IS_PRIVATE = (v: ApiVersion): boolean => apiAtLeast(v, 2, 9, 0);

/** `setShareLimits` accepts `inactiveSeedingTimeLimit` param (API >= 2.9.0) */
export const API_HAS_INACTIVE_SEEDING_LIMIT = (v: ApiVersion): boolean => apiAtLeast(v, 2, 9, 0);
