import { parseApiVersion } from '@/utils/apiVersion';
import { formatSpeed } from '@/utils/format';

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
 * Live converted hint under an add-dialogue KiB/s limit field (e.g. "1.2 MiB/s"),
 * matching the list/detail limit dialogs' `computeHint`. Null — no hint — for
 * empty, invalid or 0 (unlimited) input.
 */
export function formatKibLimitHint(text: string): string | null {
  const bytes = parseKibLimitInput(text);
  return bytes !== undefined && bytes > 0 ? formatSpeed(bytes) : null;
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

/** Pre-per-server device-wide download-path keys, plus how many servers are saved. */
export interface LegacyDownloadPath {
  lastUseDownloadPath?: boolean;
  lastDownloadPath?: string;
  serverCount: number;
}

/**
 * Initial "Use another download path" state for the connected server: the
 * user's last choice on that server, else — for an upgrading user with exactly
 * one saved server, so it can only be that server's — their legacy device-wide
 * `lastUseDownloadPath` / `lastDownloadPath`, else the server's own temp-path
 * setting. Never another server's value.
 */
export function getDownloadPathPrefill(
  saved: SavedDownloadPath | undefined,
  server: { temp_path_enabled?: boolean; temp_path?: string } | null,
  legacy?: LegacyDownloadPath,
): SavedDownloadPath {
  if (saved) {
    return { useDownloadPath: !!saved.useDownloadPath, downloadPath: saved.downloadPath || '' };
  }
  const legacyPath = legacy?.lastDownloadPath?.trim();
  if (legacy && legacy.serverCount === 1 && legacy.lastUseDownloadPath === true && legacyPath) {
    return { useDownloadPath: true, downloadPath: legacy.lastDownloadPath as string };
  }
  return {
    useDownloadPath: !!server?.temp_path_enabled,
    downloadPath: server?.temp_path || '',
  };
}

/** Add-dialogue options that are prefilled from stored / server defaults but user-editable. */
export type PrefillableAddField =
  'savePath' | 'useDownloadPath' | 'downloadPath' | 'tmmMode' | 'stopped' | 'firstLastPiecePrio';

/** Values to prefill; a missing key means "leave the field as it is". */
export interface AddOptionPrefill {
  savePath?: string;
  useDownloadPath?: boolean;
  downloadPath?: string;
  tmmMode?: 'automatic' | 'manual';
  stopped?: boolean;
  firstLastPiecePrio?: boolean;
}

/**
 * The add dialogue's prefill from the app's own preferences (null when they
 * failed to load) and the connected server's `app/preferences` (null when that
 * failed; `defaultSavePath` is then the `app/defaultSavePath` result, or — when
 * that failed too — the locally saved Default save path; see resolveDefaultSavePath).
 */
export function buildAddOptionPrefill(input: {
  localPrefs: { pauseOnAdd?: boolean; defaultPriority?: number | string } | null;
  savedDownloadPath: SavedDownloadPath | undefined;
  legacyDownloadPath?: LegacyDownloadPath;
  serverPrefs: {
    save_path?: string;
    auto_tmm_enabled?: boolean;
    temp_path_enabled?: boolean;
    temp_path?: string;
  } | null;
  defaultSavePath: unknown;
}): AddOptionPrefill {
  const { localPrefs, savedDownloadPath, legacyDownloadPath, serverPrefs, defaultSavePath } = input;
  const prefill: AddOptionPrefill = {
    savePath: typeof defaultSavePath === 'string' ? defaultSavePath : '',
    ...getDownloadPathPrefill(savedDownloadPath, serverPrefs, legacyDownloadPath),
  };
  if (localPrefs) {
    prefill.stopped = !!localPrefs.pauseOnAdd;
    prefill.firstLastPiecePrio = Number(localPrefs.defaultPriority) > 0;
  }
  if (serverPrefs) {
    prefill.tmmMode = serverPrefs.auto_tmm_enabled ? 'automatic' : 'manual';
    if (serverPrefs.auto_tmm_enabled) prefill.useDownloadPath = false;
  }
  return prefill;
}

/**
 * Drop every field the user has already edited, so a late or repeated prefill
 * never overwrites what they typed or toggled.
 */
export function withoutTouchedFields(
  prefill: AddOptionPrefill,
  touched: ReadonlySet<PrefillableAddField>,
): AddOptionPrefill {
  const out: AddOptionPrefill = {};
  for (const key of Object.keys(prefill) as PrefillableAddField[]) {
    if (!touched.has(key)) (out as Record<string, unknown>)[key] = prefill[key];
  }
  return out;
}

/**
 * The add dialogue's save-path prefill: the server's `save_path`, else
 * `app/defaultSavePath`, and only when both requests failed the Default save
 * path saved locally in Settings → Server Settings while disconnected (that
 * screen promises the path is kept locally).
 */
export function resolveDefaultSavePath(input: {
  serverSavePath: string | undefined | null;
  serverPrefsLoaded: boolean;
  defaultSavePathResult: unknown;
  localDefaultSavePath: string | undefined;
}): string {
  if (input.serverPrefsLoaded) return input.serverSavePath || '';
  if (typeof input.defaultSavePathResult === 'string') return input.defaultSavePathResult;
  return input.localDefaultSavePath || '';
}
