import { extractTorrentFile, isTorrentFileUrl } from '../../utils/torrent-file';

describe('isTorrentFileUrl', () => {
  it('accepts file:// URLs ending in .torrent', () => {
    expect(isTorrentFileUrl('file:///private/var/mobile/Inbox/ubuntu-24.04.torrent')).toBe(true);
  });

  it('accepts file:// URLs with uppercase extension', () => {
    expect(isTorrentFileUrl('file:///Inbox/UBUNTU.TORRENT')).toBe(true);
  });

  it('accepts file:// URLs with percent-encoded names', () => {
    expect(isTorrentFileUrl('file:///Inbox/My%20Movie%20Pack.torrent')).toBe(true);
  });

  it('rejects file:// URLs with other extensions', () => {
    expect(isTorrentFileUrl('file:///Inbox/document.pdf')).toBe(false);
  });

  it('rejects content:// URIs', () => {
    expect(
      isTorrentFileUrl('content://com.android.providers.downloads.documents/document/1234'),
    ).toBe(false);
  });

  it('rejects magnet links, http URLs, and app deep links', () => {
    expect(isTorrentFileUrl('magnet:?xt=urn:btih:abc123')).toBe(false);
    expect(isTorrentFileUrl('https://example.com/file.torrent')).toBe(false);
    expect(isTorrentFileUrl('qRemote://torrents')).toBe(false);
  });

  it('rejects empty and null values', () => {
    expect(isTorrentFileUrl('')).toBe(false);
    expect(isTorrentFileUrl(null)).toBe(false);
    expect(isTorrentFileUrl(undefined)).toBe(false);
  });
});

describe('extractTorrentFile', () => {
  it('extracts uri and decoded file name from a file:// URL', () => {
    const result = extractTorrentFile('file:///private/var/mobile/Inbox/My%20Movie%20Pack.torrent');
    expect(result).toEqual({
      uri: 'file:///private/var/mobile/Inbox/My%20Movie%20Pack.torrent',
      name: 'My Movie Pack.torrent',
    });
  });

  it('strips query strings and fragments from the name', () => {
    const result = extractTorrentFile('file:///Inbox/ubuntu.torrent?foo=bar#frag');
    expect(result?.name).toBe('ubuntu.torrent');
  });

  it('trims surrounding whitespace from the URL', () => {
    const result = extractTorrentFile('  file:///Inbox/ubuntu.torrent  ');
    expect(result?.uri).toBe('file:///Inbox/ubuntu.torrent');
  });

  it('returns null for non-torrent URLs', () => {
    expect(extractTorrentFile('file:///Inbox/document.pdf')).toBeNull();
    expect(extractTorrentFile('magnet:?xt=urn:btih:abc123')).toBeNull();
    expect(extractTorrentFile('https://example.com/file.torrent')).toBeNull();
    expect(extractTorrentFile(null)).toBeNull();
    expect(extractTorrentFile('')).toBeNull();
  });

  it('falls back to the raw segment when percent-decoding fails (safeDecode catch)', () => {
    // "%zz" is an invalid escape sequence for decodeURIComponent
    const result = extractTorrentFile('file:///Inbox/bad%zzname.torrent');
    expect(result?.name).toBe('bad%zzname.torrent');
  });
});
