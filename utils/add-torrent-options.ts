import { parseApiVersion } from '@/utils/apiVersion';

/** Last "Use another download path" choice on the add dialogue, for one server. */
export interface SavedDownloadPath {
  useDownloadPath: boolean;
  downloadPath: string;
}

/**
 * Parse an add-dialogue speed limit typed in KiB/s into the bytes/s that
 * `torrents/add`'s `dlLimit` / `upLimit` take (every qBittorrent version reads
 * them as bytes/s). Empty, non-numeric or negative input → undefined (not sent).
 * 0 stays 0 (unlimited).
 */
export function parseKibLimitInput(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 1024);
}

/**
 * Whether `torrents/add` still reads the `cookie` field. qBittorrent 5.0.x
 * (WebAPI 2.11.2) does; 5.1.0 (WebAPI 2.11.4) removed it and silently ignores
 * it. Unknown version → true (5.0 feature set, sending an ignored field is harmless).
 */
export function supportsAddTorrentCookie(apiVersion: string | null): boolean {
  const v = apiVersion ? parseApiVersion(apiVersion) : null;
  if (!v) return true;
  if (v.major !== 2) return v.major < 2;
  if (v.minor !== 11) return v.minor < 11;
  return v.patch < 4;
}

/**
 * The `useDownloadPath` / `downloadPath` add options. Only in manual TMM with
 * the field shown (automatic TMM and a hidden field leave it to the server).
 * Toggle off sends `useDownloadPath=false`, so a server with
 * `temp_path_enabled` doesn't use its temp path anyway; toggle on with an empty
 * path sends nothing (the server's default applies). qBit < 4.4 ignores both.
 */
export function buildDownloadPathOptions(input: {
  fieldVisible: boolean;
  manualTmm: boolean;
  useDownloadPath: boolean;
  downloadPath: string;
}): { useDownloadPath?: boolean; downloadPath?: string } {
  if (!input.fieldVisible || !input.manualTmm) return {};
  if (!input.useDownloadPath) return { useDownloadPath: false };
  const path = input.downloadPath.trim();
  return path ? { useDownloadPath: true, downloadPath: path } : {};
}

/**
 * Initial "Use another download path" state for the connected server: the
 * user's last choice on that server, else the server's own temp-path setting.
 * Never another server's value.
 */
export function getDownloadPathPrefill(
  saved: SavedDownloadPath | undefined,
  server: { temp_path_enabled?: boolean; temp_path?: string } | null,
): SavedDownloadPath {
  if (saved) {
    return { useDownloadPath: !!saved.useDownloadPath, downloadPath: saved.downloadPath || '' };
  }
  return {
    useDownloadPath: !!server?.temp_path_enabled,
    downloadPath: server?.temp_path || '',
  };
}
