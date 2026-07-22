const copyAsync = jest.fn();
const makeDirectoryAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  copyAsync: (...args: unknown[]) => copyAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => makeDirectoryAsync(...args),
}));

import { persistIncomingTorrentFile } from '@/services/incoming-file';

describe('persistIncomingTorrentFile', () => {
  beforeEach(() => {
    copyAsync.mockReset().mockResolvedValue(undefined);
    makeDirectoryAsync.mockReset().mockResolvedValue(undefined);
  });

  it('copies an iOS file:// URI into the cache directory and returns the new uri', async () => {
    const result = await persistIncomingTorrentFile({
      uri: 'file:///private/var/mobile/Inbox/ubuntu.torrent',
      name: 'ubuntu.torrent',
    });

    expect(makeDirectoryAsync).toHaveBeenCalledWith('file:///cache/incoming-torrents/', {
      intermediates: true,
    });
    expect(copyAsync).toHaveBeenCalledTimes(1);
    const [{ from, to }] = copyAsync.mock.calls[0];
    expect(from).toBe('file:///private/var/mobile/Inbox/ubuntu.torrent');
    expect(to).toMatch(/^file:\/\/\/cache\/incoming-torrents\/\d+-ubuntu\.torrent$/);
    expect(result.name).toBe('ubuntu.torrent');
    expect(result.uri).toBe(to);
  });

  it('sanitizes unsafe characters in the destination file name', async () => {
    const result = await persistIncomingTorrentFile({
      uri: 'file:///Inbox/My Movie Pack!.torrent',
      name: 'My Movie Pack!.torrent',
    });

    expect(result.uri).toMatch(/^file:\/\/\/cache\/incoming-torrents\/\d+-My_Movie_Pack_\.torrent$/);
  });

  it('returns the original file unchanged for non-file:// URIs', async () => {
    const file = { uri: 'content://some/provider/1', name: 'download.torrent' };
    const result = await persistIncomingTorrentFile(file);

    expect(result).toBe(file);
    expect(copyAsync).not.toHaveBeenCalled();
  });

  it('falls back to the original file if the copy fails', async () => {
    copyAsync.mockRejectedValue(new Error('disk full'));

    const file = { uri: 'file:///Inbox/ubuntu.torrent', name: 'ubuntu.torrent' };
    const result = await persistIncomingTorrentFile(file);

    expect(result).toBe(file);
  });
});
