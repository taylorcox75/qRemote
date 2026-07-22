import * as FileSystem from 'expo-file-system/legacy';
import type { IncomingTorrentFile } from '@/utils/torrent-file';

const INCOMING_TORRENTS_DIR = `${FileSystem.cacheDirectory}incoming-torrents/`;

const sanitizeFileName = (name: string): string => name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'download.torrent';

/**
 * Copy an incoming .torrent file into the app's own cache directory.
 *
 * iOS delivers "Open In Place" file:// URLs (LSSupportsOpeningDocumentsInPlace)
 * as security-scoped resources tied to the handoff from the source app. If
 * dispatch is delayed — e.g. waiting on navigation readiness after a cold
 * launch — that access can lapse before the file is ever read. Copying
 * immediately, before any further delay, gives us a stable app-owned URI to
 * upload from instead.
 */
export async function persistIncomingTorrentFile(file: IncomingTorrentFile): Promise<IncomingTorrentFile> {
  if (!file.uri.startsWith('file://')) {
    return file;
  }

  try {
    await FileSystem.makeDirectoryAsync(INCOMING_TORRENTS_DIR, { intermediates: true });
    const destUri = `${INCOMING_TORRENTS_DIR}${Date.now()}-${sanitizeFileName(file.name)}`;
    await FileSystem.copyAsync({ from: file.uri, to: destUri });
    return { uri: destUri, name: file.name };
  } catch {
    return file;
  }
}
