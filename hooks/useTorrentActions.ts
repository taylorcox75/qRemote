import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TorrentInfo } from '@/types/api';
import { torrentsApi } from '@/services/api/torrents';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';
import { useTransfer } from '@/context/TransferContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api/client';
import * as Clipboard from 'expo-clipboard';

export interface ActionMenuItem {
  label: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
}

export function useTorrentActions(torrent: TorrentInfo | null) {
  const { isConnected, currentServer, reconnect } = useServer();
  const { sync } = useTorrents();
  const { transferInfo, toggleAlternativeSpeedLimits, refresh: refreshTransfer } = useTransfer();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [dlLimitModalVisible, setDlLimitModalVisible] = useState(false);

  const ensureConnection = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !currentServer) {
      showToast(t('toast.notConnected'), 'error');
      return false;
    }
    if (!apiClient.getServer()) {
      const reconnected = await reconnect();
      if (!reconnected) {
        showToast(t('toast.lostConnection'), 'error');
        return false;
      }
    }
    return true;
  }, [isConnected, currentServer, reconnect, showToast, t]);

  const handlePauseResume = useCallback(async () => {
    if (!torrent) return;
    if (!(await ensureConnection())) return;

    const isPaused =
      torrent.state === 'pausedDL' ||
      torrent.state === 'pausedUP' ||
      torrent.state === 'stoppedDL' ||
      torrent.state === 'stoppedUP';

    setLoading(true);
    try {
      if (isPaused) {
        await torrentsApi.resumeTorrents([torrent.hash]);
      } else {
        await torrentsApi.pauseTorrents([torrent.hash]);
      }
      sync().catch(() => {});
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      showToast(msg || (isPaused ? t('errors.failedToResume') : t('errors.failedToPause')), 'error');
    } finally {
      setLoading(false);
    }
  }, [torrent, ensureConnection, sync, showToast, t]);

  const handleForceStart = useCallback(async () => {
    if (!torrent) return;
    if (!(await ensureConnection())) return;

    setLoading(true);
    try {
      await torrentsApi.setForceStart([torrent.hash], true);
      sync().catch(() => {});
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      showToast(msg || t('errors.generic'), 'error');
    } finally {
      setLoading(false);
    }
  }, [torrent, ensureConnection, sync, showToast, t]);

  const handleVerifyData = useCallback(async () => {
    if (!torrent) return;
    try {
      await torrentsApi.recheckTorrents([torrent.hash]);
      showToast(t('toast.verificationStarted'), 'success');
      sync().catch(() => {});
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      showToast(msg || t('errors.failedToVerify'), 'error');
    }
  }, [torrent, sync, showToast, t]);

  const handleReannounce = useCallback(async () => {
    if (!torrent) return;
    try {
      await torrentsApi.reannounceTorrents([torrent.hash]);
      showToast(t('toast.reannounceSent'), 'success');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      showToast(msg || t('errors.failedToConnect'), 'error');
    }
  }, [torrent, showToast, t]);

  const handleCopyMagnet = useCallback(async () => {
    if (!torrent) return;
    try {
      if (torrent.magnet_uri) {
        await Clipboard.setStringAsync(torrent.magnet_uri);
        showToast(t('toast.magnetCopied'), 'success');
      } else {
        showToast(t('toast.noMagnetAvailable'), 'error');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      showToast(msg || t('errors.generic'), 'error');
    }
  }, [torrent, showToast, t]);

  const handleDelete = useCallback(() => {
    if (!torrent) return;
    Alert.alert(
      t('common.delete'),
      `Delete "${torrent.name}"?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Torrent Only',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], false);
              sync().catch(() => {});
              showToast(t('toast.torrentDeleted'), 'success');
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : '';
              showToast(msg || t('errors.failedToDelete'), 'error');
            }
          },
        },
        {
          text: 'With Files',
          style: 'destructive',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], true);
              sync().catch(() => {});
              showToast(t('toast.torrentDeleted'), 'success');
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : '';
              showToast(msg || t('errors.failedToDelete'), 'error');
            }
          },
        },
      ],
    );
  }, [torrent, sync, showToast, t]);

  const handleMaxPriority = useCallback(async () => {
    if (!torrent) return;
    if (!(await ensureConnection())) return;

    setLoading(true);
    try {
      await torrentsApi.setMaximalPriority([torrent.hash]);
      sync().catch(() => {});
      showToast(t('toast.prioritySetMax'), 'success');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      showToast(msg || t('errors.generic'), 'error');
    } finally {
      setLoading(false);
    }
  }, [torrent, ensureConnection, sync, showToast, t]);

  const handleSetDownloadLimit = useCallback((value: string) => {
    if (!torrent) return;
    (async () => {
      try {
        setLoading(true);
        const limitKB = parseFloat(value) || 0;
        const limitBytes = limitKB * 1024;
        await torrentsApi.setTorrentDownloadLimit([torrent.hash], limitBytes);
        sync().catch(() => {});
        showToast(
          `Download limit set to ${limitKB === 0 ? 'unlimited' : `${limitKB} KB/s`}`,
          'success',
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '';
        showToast(msg || t('errors.generic'), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [torrent, sync, showToast, t]);

  const handleToggleGlobalSpeedLimit = useCallback(async () => {
    if (!(await ensureConnection())) return;

    setLoading(true);
    try {
      await toggleAlternativeSpeedLimits();
      await refreshTransfer();
      const isEnabled = transferInfo?.use_alt_speed_limits;
      showToast(
        t('toast.speedLimitToggled', {
          status: !isEnabled ? t('common.enabled') : t('common.disabled'),
        }),
        'success',
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      showToast(msg || t('errors.generic'), 'error');
    } finally {
      setLoading(false);
    }
  }, [ensureConnection, toggleAlternativeSpeedLimits, refreshTransfer, transferInfo, showToast, t]);

  const isPaused = torrent
    ? torrent.state === 'pausedDL' ||
      torrent.state === 'pausedUP' ||
      torrent.state === 'stoppedDL' ||
      torrent.state === 'stoppedUP'
    : false;

  const actionMenuItems: ActionMenuItem[] = useMemo(() => {
    if (!torrent) return [];
    return [
      {
        label: isPaused ? t('actions.resume') : t('actions.pause'),
        icon: isPaused ? 'play' : 'pause',
        onPress: handlePauseResume,
      },
      {
        label: t('actions.forceStart'),
        icon: 'flash',
        onPress: handleForceStart,
      },
      {
        label: `Global Speed Limit (${transferInfo?.use_alt_speed_limits ? 'ON' : 'OFF'})`,
        icon: 'speedometer',
        onPress: handleToggleGlobalSpeedLimit,
      },
      {
        label: t('actions.maxPriority'),
        icon: 'flag',
        onPress: handleMaxPriority,
      },
      {
        label: t('actions.setDlLimit'),
        icon: 'download',
        onPress: () => setDlLimitModalVisible(true),
      },
      {
        label: t('actions.verifyData'),
        icon: 'checkmark-circle',
        onPress: handleVerifyData,
      },
      {
        label: t('actions.reannounce'),
        icon: 'refresh',
        onPress: handleReannounce,
      },
      {
        label: t('actions.copyMagnetLink'),
        icon: 'link',
        onPress: handleCopyMagnet,
      },
      {
        label: t('common.delete'),
        icon: 'trash',
        onPress: handleDelete,
        destructive: true,
      },
    ];
  }, [
    torrent,
    isPaused,
    transferInfo?.use_alt_speed_limits,
    handlePauseResume,
    handleForceStart,
    handleToggleGlobalSpeedLimit,
    handleMaxPriority,
    handleVerifyData,
    handleReannounce,
    handleCopyMagnet,
    handleDelete,
    t,
  ]);

  return {
    loading,
    actionMenuItems,
    handlePauseResume,
    handleForceStart,
    handleVerifyData,
    handleReannounce,
    handleCopyMagnet,
    handleDelete,
    handleMaxPriority,
    handleSetDownloadLimit,
    handleToggleGlobalSpeedLimit,
    dlLimitModalVisible,
    setDlLimitModalVisible,
    dlLimitDefaultValue: torrent && torrent.dl_limit > 0 ? String(torrent.dl_limit / 1024) : '0',
  };
}
