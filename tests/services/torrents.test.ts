jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    postUrlEncoded: jest.fn(),
    postFormData: jest.fn(),
    getApiFeatures: jest.fn(() => ({ useStartStopEndpoints: false })),
  },
}));

const mockGetInfoAsync = jest.fn();
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
}));

import { AxiosError } from 'axios';
import { torrentsApi } from '@/services/api/torrents';
import { apiClient } from '@/services/api/client';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.postUrlEncoded as jest.Mock;
const mockPostFormData = apiClient.postFormData as jest.Mock;
const mockGetApiFeatures = apiClient.getApiFeatures as jest.Mock;

describe('torrentsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApiFeatures.mockReturnValue({ useStartStopEndpoints: false });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1234 });
  });

  describe('getTorrentList', () => {
    it('sends only provided params', async () => {
      mockGet.mockResolvedValueOnce([{ hash: 'a' }]);
      const result = await torrentsApi.getTorrentList('downloading');
      expect(result).toEqual([{ hash: 'a' }]);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/info', { filter: 'downloading' });
    });

    it('sends all params when provided, joining hashes with pipe', async () => {
      mockGet.mockResolvedValueOnce([]);
      await torrentsApi.getTorrentList('all', 'Movies', 'tag1', 'name', true, 10, 0, ['h1', 'h2']);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/info', {
        filter: 'all',
        category: 'Movies',
        tag: 'tag1',
        sort: 'name',
        reverse: true,
        limit: 10,
        offset: 0,
        hashes: 'h1|h2',
      });
    });

    it('returns [] for non-array response', async () => {
      mockGet.mockResolvedValueOnce(null);
      const result = await torrentsApi.getTorrentList();
      expect(result).toEqual([]);
    });
  });

  it('getTorrentProperties', async () => {
    mockGet.mockResolvedValueOnce({ name: 'X' });
    const result = await torrentsApi.getTorrentProperties('h1');
    expect(result).toEqual({ name: 'X' });
    expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/properties', { hash: 'h1' });
  });

  describe('getTorrentTrackers', () => {
    it('returns array', async () => {
      mockGet.mockResolvedValueOnce([{ url: 'x' }]);
      const result = await torrentsApi.getTorrentTrackers('h1');
      expect(result).toEqual([{ url: 'x' }]);
    });
    it('returns [] for non-array', async () => {
      mockGet.mockResolvedValueOnce(null);
      expect(await torrentsApi.getTorrentTrackers('h1')).toEqual([]);
    });
  });

  describe('getTorrentWebSeeds', () => {
    it('returns array', async () => {
      mockGet.mockResolvedValueOnce([{ url: 'x' }]);
      expect(await torrentsApi.getTorrentWebSeeds('h1')).toEqual([{ url: 'x' }]);
    });
    it('returns [] for non-array', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      expect(await torrentsApi.getTorrentWebSeeds('h1')).toEqual([]);
    });
  });

  describe('getTorrentContents', () => {
    it('without indexes', async () => {
      mockGet.mockResolvedValueOnce([{ name: 'f' }]);
      const result = await torrentsApi.getTorrentContents('h1');
      expect(result).toEqual([{ name: 'f' }]);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/files', { hash: 'h1' });
    });
    it('with indexes joined by pipe', async () => {
      mockGet.mockResolvedValueOnce([]);
      await torrentsApi.getTorrentContents('h1', [0, 1]);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/files', {
        hash: 'h1',
        indexes: '0|1',
      });
    });
    it('returns [] for non-array', async () => {
      mockGet.mockResolvedValueOnce(null);
      expect(await torrentsApi.getTorrentContents('h1')).toEqual([]);
    });
  });

  it('getTorrentPiecesStates', async () => {
    mockGet.mockResolvedValueOnce([2, 2, 1]);
    const result = await torrentsApi.getTorrentPiecesStates('h1');
    expect(result).toEqual([2, 2, 1]);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/pieceStates', { hash: 'h1' });
  });

  it('getTorrentPiecesHashes', async () => {
    mockGet.mockResolvedValueOnce(['abc']);
    const result = await torrentsApi.getTorrentPiecesHashes('h1');
    expect(result).toEqual(['abc']);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/pieceHashes', { hash: 'h1' });
  });

  describe('pauseTorrents', () => {
    it('uses pause endpoint on 4.x', async () => {
      mockGetApiFeatures.mockReturnValue({ useStartStopEndpoints: false });
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.pauseTorrents(['h1', 'h2']);
      expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/pause', { hashes: 'h1|h2' });
    });

    it('uses stop endpoint on 5.x', async () => {
      mockGetApiFeatures.mockReturnValue({ useStartStopEndpoints: true });
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.pauseTorrents(['h1']);
      expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/stop', { hashes: 'h1' });
    });

    it('logs and rethrows AxiosError', async () => {
      const err = new AxiosError('fail');
      err.response = { status: 500, data: 'oops' } as never;
      mockPost.mockRejectedValueOnce(err);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(torrentsApi.pauseTorrents(['h1'])).rejects.toThrow(err);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('rethrows non-axios errors without logging extra info', async () => {
      mockPost.mockRejectedValueOnce(new Error('plain'));
      await expect(torrentsApi.pauseTorrents(['h1'])).rejects.toThrow('plain');
    });
  });

  describe('resumeTorrents', () => {
    it('uses resume endpoint on 4.x', async () => {
      mockGetApiFeatures.mockReturnValue({ useStartStopEndpoints: false });
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.resumeTorrents(['h1']);
      expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/resume', { hashes: 'h1' });
    });

    it('uses start endpoint on 5.x', async () => {
      mockGetApiFeatures.mockReturnValue({ useStartStopEndpoints: true });
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.resumeTorrents(['h1']);
      expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/start', { hashes: 'h1' });
    });

    it('logs and rethrows AxiosError', async () => {
      const err = new AxiosError('fail');
      err.response = { status: 500, data: 'oops' } as never;
      mockPost.mockRejectedValueOnce(err);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(torrentsApi.resumeTorrents(['h1'])).rejects.toThrow(err);
      consoleSpy.mockRestore();
    });
  });

  it('deleteTorrents with deleteFiles true', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.deleteTorrents(['h1', 'h2'], true);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/delete', {
      hashes: 'h1|h2',
      deleteFiles: 'true',
    });
  });

  it('deleteTorrents defaults deleteFiles to false', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.deleteTorrents(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/delete', {
      hashes: 'h1',
      deleteFiles: 'false',
    });
  });

  it('recheckTorrents', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.recheckTorrents(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/recheck', { hashes: 'h1' });
  });

  it('reannounceTorrents', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.reannounceTorrents(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/reannounce', { hashes: 'h1' });
  });

  describe('addTorrent', () => {
    it('handles a single url string with no options', async () => {
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrent('magnet:?xt=1');
      expect(mockPostFormData).toHaveBeenCalledWith('/api/v2/torrents/add', expect.any(FormData));
    });

    it('handles an array of urls and full options', async () => {
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrent(['magnet:1', 'magnet:2'], {
        savepath: '/dl',
        cookie: 'c=1',
        category: 'Movies',
        tags: ['a', 'b'],
        skip_checking: true,
        stopped: false,
        root_folder: true,
        rename: 'newname',
        upLimit: 100,
        dlLimit: 200,
        ratioLimit: 1.5,
        seedingTimeLimit: 60,
        sequentialDownload: true,
        firstLastPiecePrio: true,
        autoTMM: false,
      });
      const formData = mockPostFormData.mock.calls[0][1] as FormData;
      expect(formData).toBeInstanceOf(FormData);
    });

    it('sends neither contentLayout nor root_folder when the toggle is ON (server default)', async () => {
      mockGetApiFeatures.mockReturnValue({ useContentLayoutAddParam: true });
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrent('magnet:?xt=1', { root_folder: true });
      const formData = mockPostFormData.mock.calls[0][1] as FormData;
      expect(formData.get('contentLayout')).toBeNull();
      expect(formData.get('root_folder')).toBeNull();
    });

    it('sends contentLayout=NoSubfolder when the toggle is OFF', async () => {
      mockGetApiFeatures.mockReturnValue({ useContentLayoutAddParam: true });
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrent('magnet:?xt=1', { root_folder: false });
      const formData = mockPostFormData.mock.calls[0][1] as FormData;
      expect(formData.get('contentLayout')).toBe('NoSubfolder');
      expect(formData.get('root_folder')).toBeNull();
    });

    it('appends useDownloadPath and downloadPath when provided', async () => {
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrent('magnet:?xt=1', {
        savepath: '/dl',
        useDownloadPath: true,
        downloadPath: '/dl/incomplete',
      });
      const formData = mockPostFormData.mock.calls[0][1] as FormData;
      expect(formData.get('useDownloadPath')).toBe('true');
      expect(formData.get('downloadPath')).toBe('/dl/incomplete');
    });

    it('omits downloadPath when useDownloadPath is false and no path given', async () => {
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrent('magnet:?xt=1', {
        savepath: '/dl',
        useDownloadPath: false,
      });
      const formData = mockPostFormData.mock.calls[0][1] as FormData;
      expect(formData.get('useDownloadPath')).toBe('false');
      expect(formData.get('downloadPath')).toBeNull();
    });
  });

  describe('addTorrentFile', () => {
    it('handles file with no options', async () => {
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrentFile({ uri: 'file:///a.torrent', name: 'a.torrent' });
      expect(mockPostFormData).toHaveBeenCalledWith('/api/v2/torrents/add', expect.any(FormData));
    });

    it('handles file with type and full options', async () => {
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrentFile(
        { uri: 'file:///a.torrent', name: 'a.torrent', type: 'application/x-bittorrent' },
        {
          savepath: '/dl',
          category: 'Movies',
          tags: ['a'],
          skip_checking: true,
          stopped: true,
          root_folder: false,
          rename: 'n',
          upLimit: 1,
          dlLimit: 2,
          ratioLimit: 1,
          seedingTimeLimit: 1,
          sequentialDownload: false,
          firstLastPiecePrio: false,
          autoTMM: true,
        },
      );
      expect(mockPostFormData).toHaveBeenCalledWith('/api/v2/torrents/add', expect.any(FormData));
    });

    it('appends useDownloadPath and downloadPath when provided', async () => {
      mockPostFormData.mockResolvedValueOnce(undefined);
      await torrentsApi.addTorrentFile(
        { uri: 'file:///a.torrent', name: 'a.torrent' },
        { savepath: '/dl', useDownloadPath: true, downloadPath: '/dl/incomplete' },
      );
      const formData = mockPostFormData.mock.calls[0][1] as FormData;
      expect(formData.get('useDownloadPath')).toBe('true');
      expect(formData.get('downloadPath')).toBe('/dl/incomplete');
    });

    it('rejects without ever calling postFormData when the source file is unreadable', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });
      await expect(
        torrentsApi.addTorrentFile({ uri: 'file:///a.torrent', name: 'a.torrent' }),
      ).rejects.toThrow(/couldn't read/i);
      expect(mockPostFormData).not.toHaveBeenCalled();
    });

    it('rejects when the source file is empty (security-scoped access lapsed)', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });
      await expect(
        torrentsApi.addTorrentFile({ uri: 'file:///a.torrent', name: 'a.torrent' }),
      ).rejects.toThrow(/couldn't read/i);
      expect(mockPostFormData).not.toHaveBeenCalled();
    });
  });

  it('addTrackers joins with newline', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.addTrackers('h1', ['url1', 'url2']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/addTrackers', {
      hash: 'h1',
      urls: 'url1\nurl2',
    });
  });

  it('editTrackers', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.editTrackers('h1', 'old', 'new');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/editTracker', {
      hash: 'h1',
      origUrl: 'old',
      newUrl: 'new',
    });
  });

  it('removeTrackers joins with pipe', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.removeTrackers('h1', ['url1', 'url2']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/removeTrackers', {
      hash: 'h1',
      urls: 'url1|url2',
    });
  });

  it('addPeers', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.addPeers(['h1', 'h2'], ['1.2.3.4:80']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/addPeers', {
      hashes: 'h1|h2',
      peers: '1.2.3.4:80',
    });
  });

  it('increasePriority', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.increasePriority(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/increasePrio', { hashes: 'h1' });
  });

  it('decreasePriority', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.decreasePriority(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/decreasePrio', { hashes: 'h1' });
  });

  it('setMaximalPriority', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setMaximalPriority(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/topPrio', { hashes: 'h1' });
  });

  it('setMinimalPriority', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setMinimalPriority(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/bottomPrio', { hashes: 'h1' });
  });

  it('setFilePriority', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setFilePriority('h1', [0, 1], 7 as never);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/filePrio', {
      hash: 'h1',
      id: '0|1',
      priority: '7',
    });
  });

  describe('getTorrentDownloadLimit', () => {
    it('returns map', async () => {
      mockGet.mockResolvedValueOnce({ h1: 100 });
      const result = await torrentsApi.getTorrentDownloadLimit(['h1']);
      expect(result).toEqual({ h1: 100 });
      expect(mockGet).toHaveBeenCalledWith('/api/v2/torrents/downloadLimit', { hashes: 'h1' });
    });
    it('returns {} when response falsy', async () => {
      mockGet.mockResolvedValueOnce(null);
      expect(await torrentsApi.getTorrentDownloadLimit(['h1'])).toEqual({});
    });
  });

  it('setTorrentDownloadLimit', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setTorrentDownloadLimit(['h1'], 100);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setDownloadLimit', {
      hashes: 'h1',
      limit: 100,
    });
  });

  describe('setTorrentShareLimits', () => {
    it('sends only provided limits', async () => {
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.setTorrentShareLimits(['h1']);
      expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setShareLimits', { hashes: 'h1' });
    });
    it('sends both limits when provided', async () => {
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.setTorrentShareLimits(['h1'], { ratioLimit: 2, seedingTimeLimit: 60 });
      expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setShareLimits', {
        hashes: 'h1',
        ratioLimit: 2,
        seedingTimeLimit: 60,
      });
    });

    it('includes inactiveSeedingTimeLimit/shareLimitAction/shareLimitsMode on 5.x (required by qBittorrent 5.1+)', async () => {
      mockGetApiFeatures.mockReturnValue({ supportsInactiveSeedingLimit: true });
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.setTorrentShareLimits(['h1'], { ratioLimit: 2, seedingTimeLimit: 60 });
      expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setShareLimits', {
        hashes: 'h1',
        ratioLimit: 2,
        seedingTimeLimit: 60,
        inactiveSeedingTimeLimit: -2,
        shareLimitAction: 'Default',
        shareLimitsMode: 'Default',
      });
    });

    // Regression guard: 'Default' means "use the global setting", not "leave
    // unchanged". Hardcoding it wiped the torrent's own share-limit action, and
    // with a global action of "Remove torrent" the server deleted the torrent.
    it('round-trips the current share limit action/mode instead of resetting them to Default', async () => {
      mockGetApiFeatures.mockReturnValue({ supportsInactiveSeedingLimit: true });
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.setTorrentShareLimits(['h1'], {
        ratioLimit: 2,
        seedingTimeLimit: 60,
        inactiveSeedingTimeLimit: 1440,
        shareLimitAction: 'Remove',
        shareLimitsMode: 'MatchAll',
      });
      expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setShareLimits', {
        hashes: 'h1',
        ratioLimit: 2,
        seedingTimeLimit: 60,
        inactiveSeedingTimeLimit: 1440,
        shareLimitAction: 'Remove',
        shareLimitsMode: 'MatchAll',
      });
    });

    it('uses provided inactiveSeedingTimeLimit on 5.x instead of the -2 default', async () => {
      mockGetApiFeatures.mockReturnValue({ supportsInactiveSeedingLimit: true });
      mockPost.mockResolvedValueOnce(undefined);
      await torrentsApi.setTorrentShareLimits(['h1'], {
        ratioLimit: 2,
        seedingTimeLimit: 60,
        inactiveSeedingTimeLimit: 30,
      });
      expect(mockPost).toHaveBeenCalledWith(
        '/api/v2/torrents/setShareLimits',
        expect.objectContaining({ inactiveSeedingTimeLimit: 30 }),
      );
    });
  });

  describe('getTorrentUploadLimit', () => {
    it('returns map', async () => {
      mockGet.mockResolvedValueOnce({ h1: 50 });
      expect(await torrentsApi.getTorrentUploadLimit(['h1'])).toEqual({ h1: 50 });
    });
    it('returns {} when response falsy', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      expect(await torrentsApi.getTorrentUploadLimit(['h1'])).toEqual({});
    });
  });

  it('setTorrentUploadLimit', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setTorrentUploadLimit(['h1'], 300);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setUploadLimit', {
      hashes: 'h1',
      limit: 300,
    });
  });

  it('setTorrentLocation', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setTorrentLocation(['h1'], '/new/path');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setLocation', {
      hashes: 'h1',
      location: '/new/path',
    });
  });

  it('setTorrentName', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setTorrentName('h1', 'New Name');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/rename', {
      hash: 'h1',
      name: 'New Name',
    });
  });

  it('setTorrentCategory', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setTorrentCategory(['h1'], 'Movies');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setCategory', {
      hashes: 'h1',
      category: 'Movies',
    });
  });

  it('addTorrentTags', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.addTorrentTags(['h1'], ['a', 'b']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/addTags', {
      hashes: 'h1',
      tags: 'a,b',
    });
  });

  it('removeTorrentTags', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.removeTorrentTags(['h1'], ['a']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/removeTags', {
      hashes: 'h1',
      tags: 'a',
    });
  });

  it('setAutomaticTorrentManagement', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setAutomaticTorrentManagement(['h1'], true);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setAutoManagement', {
      hashes: 'h1',
      enable: 'true',
    });
  });

  it('toggleSequentialDownload', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.toggleSequentialDownload(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/toggleSequentialDownload', {
      hashes: 'h1',
    });
  });

  it('setFirstLastPiecePriority', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setFirstLastPiecePriority(['h1']);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/toggleFirstLastPiecePrio', {
      hashes: 'h1',
    });
  });

  it('setForceStart', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setForceStart(['h1'], true);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setForceStart', {
      hashes: 'h1',
      value: 'true',
    });
  });

  it('setSuperSeeding', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.setSuperSeeding(['h1'], false);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/setSuperSeeding', {
      hashes: 'h1',
      value: 'false',
    });
  });

  it('renameFile', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.renameFile('h1', 'old.txt', 'new.txt');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/renameFile', {
      hash: 'h1',
      oldPath: 'old.txt',
      newPath: 'new.txt',
    });
  });

  it('renameFolder', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await torrentsApi.renameFolder('h1', 'old', 'new');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/torrents/renameFolder', {
      hash: 'h1',
      oldPath: 'old',
      newPath: 'new',
    });
  });
});
