const TORRENT_EXTENSION = '.torrent';
const FALLBACK_FILE_NAME = 'download.torrent';

export interface IncomingTorrentFile {
  uri: string;
  name: string;
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getFileName = (url: string): string => {
  const withoutQuery = url.split(/[?#]/)[0];
  const lastSegment = withoutQuery.split('/').filter(Boolean).pop() || '';
  return safeDecode(lastSegment).trim();
};

/**
 * Check whether an incoming URL points to a .torrent file opened from another app.
 * iOS delivers `file://` URLs via document types.
 */
export const isTorrentFileUrl = (value?: string | null): boolean => {
  if (!value) return false;
  const raw = value.trim();
  const lower = raw.toLowerCase();
  if (!lower.startsWith('file://')) return false;
  return getFileName(raw).toLowerCase().endsWith(TORRENT_EXTENSION);
};

/**
 * Extract a torrent file reference (upload URI + display name) from an incoming URL.
 * Returns null when the URL is not a torrent file.
 */
export const extractTorrentFile = (incomingUrl?: string | null): IncomingTorrentFile | null => {
  if (!incomingUrl) return null;

  const raw = incomingUrl.trim();
  if (!isTorrentFileUrl(raw)) return null;

  let name = getFileName(raw);
  if (!name.toLowerCase().endsWith(TORRENT_EXTENSION)) {
    name = name ? `${name}${TORRENT_EXTENSION}` : FALLBACK_FILE_NAME;
  }

  return { uri: raw, name };
};
