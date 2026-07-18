import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTorrentActions } from '@/hooks/useTorrentActions';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';
import { useTransfer } from '@/context/TransferContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api/client';
import { torrentsApi } from '@/services/api/torrents';
import { TorrentInfo } from '@/types/api';

jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/context/TorrentContext', () => ({ useTorrents: jest.fn() }));
jest.mock('@/context/TransferContext', () => ({ useTransfer: jest.fn() }));
jest.mock('@/context/ToastContext', () => ({ useToast: jest.fn() }));
jest.mock('@/services/api/client', () => ({
  apiClient: { getServer: jest.fn() },
}));
jest.mock('@/services/api/torrents', () => ({
  torrentsApi: {
    resumeTorrents: jest.fn(),
    pauseTorrents: jest.fn(),
    setForceStart: jest.fn(),
    recheckTorrents: jest.fn(),
    reannounceTorrents: jest.fn(),
    deleteTorrents: jest.fn(),
    setMaximalPriority: jest.fn(),
    setTorrentDownloadLimit: jest.fn(),
  },
}));
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: any) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));

const baseTorrent: TorrentInfo = {
  hash: 'abc123',
  name: 'Test Torrent',
  state: 'downloading',
  dl_limit: 0,
  magnet_uri: 'magnet:?xt=urn:btih:abc123',
} as TorrentInfo;

describe('useTorrentActions', () => {
  let showToast: jest.Mock;
  let sync: jest.Mock;
  let reconnect: jest.Mock;
  let toggleAlternativeSpeedLimits: jest.Mock;
  let refreshTransfer: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    showToast = jest.fn();
    sync = jest.fn().mockResolvedValue(undefined);
    reconnect = jest.fn().mockResolvedValue(true);
    toggleAlternativeSpeedLimits = jest.fn().mockResolvedValue(undefined);
    refreshTransfer = jest.fn().mockResolvedValue(undefined);

    jest.mocked(useServer).mockReturnValue({
      isConnected: true,
      currentServer: { id: '1' },
      reconnect,
    } as any);
    jest.mocked(useTorrents).mockReturnValue({ sync } as any);
    jest.mocked(useTransfer).mockReturnValue({
      transferInfo: { use_alt_speed_limits: false },
      toggleAlternativeSpeedLimits,
      refresh: refreshTransfer,
    } as any);
    jest.mocked(useToast).mockReturnValue({ showToast } as any);
    jest.mocked(apiClient.getServer).mockReturnValue({ id: '1' } as any);
  });

  it('returns empty action menu items when torrent is null', async () => {
    const { result } = await renderHook(() => useTorrentActions(null));
    expect(result.current.actionMenuItems).toEqual([]);
    expect(result.current.dlLimitDefaultValue).toBe('0');
  });

  it('computes dlLimitDefaultValue from dl_limit', async () => {
    const { result } = await renderHook(() =>
      useTorrentActions({ ...baseTorrent, dl_limit: 2048 } as TorrentInfo),
    );
    expect(result.current.dlLimitDefaultValue).toBe('2');
  });

  it('builds 9 action menu items for a non-paused torrent', async () => {
    const { result } = await renderHook(() => useTorrentActions(baseTorrent));
    expect(result.current.actionMenuItems).toHaveLength(9);
    expect(result.current.actionMenuItems[0].label).toBe('actions.pause');
  });

  it('shows resume label when torrent is paused', async () => {
    const { result } = await renderHook(() =>
      useTorrentActions({ ...baseTorrent, state: 'pausedDL' } as TorrentInfo),
    );
    expect(result.current.actionMenuItems[0].label).toBe('actions.resume');
  });

  describe('handlePauseResume', () => {
    it('pauses a running torrent', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handlePauseResume();
      });
      expect(torrentsApi.pauseTorrents).toHaveBeenCalledWith(['abc123']);
      expect(sync).toHaveBeenCalled();
    });

    it('resumes a paused torrent', async () => {
      const { result } = await renderHook(() =>
        useTorrentActions({ ...baseTorrent, state: 'stoppedDL' } as TorrentInfo),
      );
      await act(async () => {
        await result.current.handlePauseResume();
      });
      expect(torrentsApi.resumeTorrents).toHaveBeenCalledWith(['abc123']);
    });

    it('shows a toast when not connected', async () => {
      jest.mocked(useServer).mockReturnValue({
        isConnected: false,
        currentServer: null,
        reconnect,
      } as any);
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handlePauseResume();
      });
      expect(showToast).toHaveBeenCalledWith('toast.notConnected', 'error');
      expect(torrentsApi.pauseTorrents).not.toHaveBeenCalled();
    });

    it('reconnects when apiClient has no server bound', async () => {
      jest.mocked(apiClient.getServer).mockReturnValue(null as any);
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handlePauseResume();
      });
      expect(reconnect).toHaveBeenCalled();
      expect(torrentsApi.pauseTorrents).toHaveBeenCalled();
    });

    it('shows toast when reconnect fails', async () => {
      jest.mocked(apiClient.getServer).mockReturnValue(null as any);
      reconnect.mockResolvedValue(false);
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handlePauseResume();
      });
      expect(showToast).toHaveBeenCalledWith('toast.lostConnection', 'error');
      expect(torrentsApi.pauseTorrents).not.toHaveBeenCalled();
    });

    it('shows an error toast on failure', async () => {
      jest.mocked(torrentsApi.pauseTorrents).mockRejectedValue(new Error('boom'));
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handlePauseResume();
      });
      expect(showToast).toHaveBeenCalledWith('boom', 'error');
    });

    it('does nothing when torrent is null', async () => {
      const { result } = await renderHook(() => useTorrentActions(null));
      await act(async () => {
        await result.current.handlePauseResume();
      });
      expect(torrentsApi.pauseTorrents).not.toHaveBeenCalled();
    });
  });

  describe('handleForceStart', () => {
    it('sets force start and syncs', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleForceStart();
      });
      expect(torrentsApi.setForceStart).toHaveBeenCalledWith(['abc123'], true);
      expect(sync).toHaveBeenCalled();
    });

    it('shows generic error toast on failure', async () => {
      jest.mocked(torrentsApi.setForceStart).mockRejectedValue(new Error('nope'));
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleForceStart();
      });
      expect(showToast).toHaveBeenCalledWith('nope', 'error');
    });
  });

  describe('handleVerifyData', () => {
    it('rechecks torrent and shows success toast', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleVerifyData();
      });
      expect(torrentsApi.recheckTorrents).toHaveBeenCalledWith(['abc123']);
      expect(showToast).toHaveBeenCalledWith('toast.verificationStarted', 'success');
    });

    it('shows error toast on failure', async () => {
      jest.mocked(torrentsApi.recheckTorrents).mockRejectedValue(new Error('recheck fail'));
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleVerifyData();
      });
      expect(showToast).toHaveBeenCalledWith('recheck fail', 'error');
    });
  });

  describe('handleReannounce', () => {
    it('reannounces and shows success toast', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleReannounce();
      });
      expect(torrentsApi.reannounceTorrents).toHaveBeenCalledWith(['abc123']);
      expect(showToast).toHaveBeenCalledWith('toast.reannounceSent', 'success');
    });

    it('shows error toast on failure', async () => {
      jest.mocked(torrentsApi.reannounceTorrents).mockRejectedValue(new Error('fail'));
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleReannounce();
      });
      expect(showToast).toHaveBeenCalledWith('fail', 'error');
    });
  });

  describe('handleCopyMagnet', () => {
    it('copies magnet link when available', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleCopyMagnet();
      });
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(baseTorrent.magnet_uri);
      expect(showToast).toHaveBeenCalledWith('toast.magnetCopied', 'success');
    });

    it('shows error toast when magnet is missing', async () => {
      const { result } = await renderHook(() =>
        useTorrentActions({ ...baseTorrent, magnet_uri: '' } as TorrentInfo),
      );
      await act(async () => {
        await result.current.handleCopyMagnet();
      });
      expect(showToast).toHaveBeenCalledWith('toast.noMagnetAvailable', 'error');
    });

    it('shows error toast on clipboard failure', async () => {
      jest.mocked(Clipboard.setStringAsync).mockRejectedValue(new Error('clip fail'));
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleCopyMagnet();
      });
      expect(showToast).toHaveBeenCalledWith('clip fail', 'error');
    });
  });

  describe('handleDelete', () => {
    it('opens an Alert with delete options and handles torrent-only delete', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        const torrentOnly = buttons?.find((b) => b.text === 'alerts.torrentOnly');
        torrentOnly?.onPress?.();
      });
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        result.current.handleDelete();
      });
      expect(torrentsApi.deleteTorrents).toHaveBeenCalledWith(['abc123'], false);
      expect(showToast).toHaveBeenCalledWith('toast.torrentDeleted', 'success');
      alertSpy.mockRestore();
    });

    it('handles delete with files', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        const withFiles = buttons?.find((b) => b.text === 'alerts.withFiles');
        withFiles?.onPress?.();
      });
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        result.current.handleDelete();
      });
      expect(torrentsApi.deleteTorrents).toHaveBeenCalledWith(['abc123'], true);
      alertSpy.mockRestore();
    });

    it('shows error toast when delete fails', async () => {
      jest.mocked(torrentsApi.deleteTorrents).mockRejectedValue(new Error('del fail'));
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        const torrentOnly = buttons?.find((b) => b.text === 'alerts.torrentOnly');
        torrentOnly?.onPress?.();
      });
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        result.current.handleDelete();
      });
      expect(showToast).toHaveBeenCalledWith('del fail', 'error');
      alertSpy.mockRestore();
    });

    it('does nothing when torrent is null', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { result } = await renderHook(() => useTorrentActions(null));
      result.current.handleDelete();
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('handleMaxPriority', () => {
    it('sets max priority and shows success toast', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleMaxPriority();
      });
      expect(torrentsApi.setMaximalPriority).toHaveBeenCalledWith(['abc123']);
      expect(showToast).toHaveBeenCalledWith('toast.prioritySetMax', 'success');
    });

    it('shows error toast on failure', async () => {
      jest.mocked(torrentsApi.setMaximalPriority).mockRejectedValue(new Error('prio fail'));
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleMaxPriority();
      });
      expect(showToast).toHaveBeenCalledWith('prio fail', 'error');
    });
  });

  describe('handleSetDownloadLimit', () => {
    it('sets a positive limit in bytes and shows toast', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        result.current.handleSetDownloadLimit('100');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(torrentsApi.setTorrentDownloadLimit).toHaveBeenCalledWith(['abc123'], 100 * 1024);
    });

    it('treats unparsable/zero value as unlimited', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        result.current.handleSetDownloadLimit('abc');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(torrentsApi.setTorrentDownloadLimit).toHaveBeenCalledWith(['abc123'], 0);
    });

    it('does nothing when torrent is null', async () => {
      const { result } = await renderHook(() => useTorrentActions(null));
      await act(async () => {
        result.current.handleSetDownloadLimit('100');
      });
      expect(torrentsApi.setTorrentDownloadLimit).not.toHaveBeenCalled();
    });

    it('shows error toast on failure', async () => {
      jest.mocked(torrentsApi.setTorrentDownloadLimit).mockRejectedValue(new Error('limit fail'));
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        result.current.handleSetDownloadLimit('50');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(showToast).toHaveBeenCalledWith('limit fail', 'error');
    });
  });

  describe('handleToggleGlobalSpeedLimit', () => {
    it('toggles and refreshes transfer info', async () => {
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleToggleGlobalSpeedLimit();
      });
      expect(toggleAlternativeSpeedLimits).toHaveBeenCalled();
      expect(refreshTransfer).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalled();
    });

    it('shows error toast on failure', async () => {
      toggleAlternativeSpeedLimits.mockRejectedValue(new Error('toggle fail'));
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleToggleGlobalSpeedLimit();
      });
      expect(showToast).toHaveBeenCalledWith('toggle fail', 'error');
    });

    it('shows toast when not connected', async () => {
      jest.mocked(useServer).mockReturnValue({
        isConnected: false,
        currentServer: null,
        reconnect,
      } as any);
      const { result } = await renderHook(() => useTorrentActions(baseTorrent));
      await act(async () => {
        await result.current.handleToggleGlobalSpeedLimit();
      });
      expect(toggleAlternativeSpeedLimits).not.toHaveBeenCalled();
    });
  });

  it('exposes dlLimitModalVisible state and setter', async () => {
    const { result } = await renderHook(() => useTorrentActions(baseTorrent));
    expect(result.current.dlLimitModalVisible).toBe(false);
    await act(async () => {
      result.current.setDlLimitModalVisible(true);
    });
    expect(result.current.dlLimitModalVisible).toBe(true);
  });
});
