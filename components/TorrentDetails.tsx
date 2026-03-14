/**
 * TorrentDetails.tsx — Tabbed torrent detail view with overview, trackers, and files sections.
 *
 * Key exports: TorrentDetails
 * Known issues: Alert.prompt used in 6 places (iOS-only, Task 1.5 replaces with InputModal);
 *   2,085 lines — decomposition into sub-components is a future candidate.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { torrentsApi } from '@/services/api/torrents';
import { syncApi } from '@/services/api/sync';
import { categoriesApi } from '@/services/api/categories';
import { tagsApi } from '@/services/api/tags';
import { useTorrents } from '@/context/TorrentContext';
import { useServer } from '@/context/ServerContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useTransfer } from '@/context/TransferContext';
import { apiClient } from '@/services/api/client';
import {
  TorrentInfo,
  TorrentProperties,
  Tracker,
  TorrentFile,
  FilePriority,
} from '@/types/api';
import { formatDate } from '@/utils/format';
import { InputModal } from './InputModal';
import { TagsModal } from './TagsModal';
import { getErrorMessage } from '@/utils/error';

interface TorrentDetailsProps {
  torrent: TorrentInfo;
  properties: TorrentProperties | null;
  trackers: Tracker[];
  files: TorrentFile[];
  activeTab: 'overview' | 'trackers' | 'files';
  onRefresh: () => void;
}

export function TorrentDetails({
  torrent,
  properties,
  trackers,
  files,
  activeTab,
  onRefresh,
}: TorrentDetailsProps) {
  const router = useRouter();
  const { categories, tags, sync, torrents } = useTorrents();
  const { isConnected, currentServer, reconnect } = useServer();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { transferInfo, toggleAlternativeSpeedLimits } = useTransfer();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [optimisticPriority, setOptimisticPriority] = useState<number>(torrent.priority);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitType, setLimitType] = useState<'download' | 'upload' | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [peersModalVisible, setPeersModalVisible] = useState(false);
  const [peersData, setPeersData] = useState<Array<{ ip: string; progress: number; client?: string }>>([]);
  const [peersLoading, setPeersLoading] = useState(false);
  const [inputModalVisible, setInputModalVisible] = useState(false);
  const [inputModalConfig, setInputModalConfig] = useState<{
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    keyboardType?: 'default' | 'numeric';
    multiline?: boolean;
    allowEmpty?: boolean;
    onConfirm: (value: string) => void;
  }>({ title: '', onConfirm: () => {} });
  const [tagsModalVisible, setTagsModalVisible] = useState(false);
  
  // Display queue position (1 = top, higher = lower)
  const getQueueDisplay = () => {
    const priority = optimisticPriority;
    const totalTorrents = torrents.length;
    
    // Priority -1 or 0 typically means "not queued" (forced/active)
    if (priority <= 0) return t('torrentDetail.notQueued');
    
    return `#${priority} / ${totalTorrents}`;
  };

  useEffect(() => {
    setOptimisticPriority(torrent.priority);
  }, [torrent.priority]);

  const handlePause = async () => {
    if (!isConnected || !currentServer) {
      showToast(t('toast.notConnected'), 'error');
      return;
    }
    setActiveButton('pause');
    try {
      setLoading(true);
      if (!apiClient.getServer()) {
        const reconnected = await reconnect();
        if (!reconnected) {
          showToast(t('toast.lostConnection'), 'error');
          return;
        }
      }
      await torrentsApi.pauseTorrents([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      console.error('Pause error:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleResume = async () => {
    if (!isConnected || !currentServer) {
      showToast(t('toast.notConnected'), 'error');
      return;
    }
    setActiveButton('resume');
    try {
      setLoading(true);
      if (!apiClient.getServer()) {
        const reconnected = await reconnect();
        if (!reconnected) {
          showToast(t('toast.lostConnection'), 'error');
          return;
        }
      }
      await torrentsApi.resumeTorrents([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      console.error('Resume error:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('torrentDetail.deleteTorrent'),
      t('torrentDetail.deleteConfirm', { name: torrent.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('torrentDetail.torrentOnly'),
          onPress: async () => {
            setActiveButton('delete');
            try {
              setLoading(true);
              await torrentsApi.deleteTorrents([torrent.hash], false);
              showToast(t('torrentDetail.torrentDeleted'), 'success');
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
              setActiveButton(null);
            } finally {
              setLoading(false);
            }
          },
        },
        {
          text: t('torrentDetail.withFiles'),
          style: 'destructive',
          onPress: async () => {
            setActiveButton('delete');
            try {
              setLoading(true);
              await torrentsApi.deleteTorrents([torrent.hash], true);
              showToast(t('torrentDetail.torrentDeleted'), 'success');
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
              setActiveButton(null);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRecheck = async () => {
    setActiveButton('recheck');
    try {
      setLoading(true);
      await torrentsApi.recheckTorrents([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
      showToast(t('torrentDetail.recheckStarted'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setActiveButton(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReannounce = async () => {
    setActiveButton('reannounce');
    try {
      setLoading(true);
      await torrentsApi.reannounceTorrents([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
      showToast(t('toast.reannounceSent'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleIncreasePriority = async () => {
    try {
      setLoading(true);
      // Increase priority = move up in queue = lower number
      const nextPriority = Math.max(1, optimisticPriority - 1);
      setOptimisticPriority(nextPriority);
      await torrentsApi.increasePriority([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setOptimisticPriority(torrent.priority);
    } finally {
      setLoading(false);
    }
  };

  const handleDecreasePriority = async () => {
    try {
      setLoading(true);
      // Decrease priority = move down in queue = higher number
      const nextPriority = Math.min(torrents.length, optimisticPriority + 1);
      setOptimisticPriority(nextPriority);
      await torrentsApi.decreasePriority([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 500));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setOptimisticPriority(torrent.priority);
    } finally {
      setLoading(false);
    }
  };

  const handleSetMaxPriority = async () => {
    setActiveButton('maxPriority');
    try {
      setLoading(true);
      // Set to top of queue (priority 1)
      setOptimisticPriority(1);
      await torrentsApi.setMaximalPriority([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 500));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setOptimisticPriority(torrent.priority);
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleSetMinPriority = async () => {
    setActiveButton('minPriority');
    try {
      setLoading(true);
      // For minimal priority, we don't know the exact number until after the API call
      // Set a reasonable optimistic value
      setOptimisticPriority(Math.max(2, torrents.length));
      await torrentsApi.setMinimalPriority([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setOptimisticPriority(torrent.priority);
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleSetForceStart = async (value: boolean) => {
    setActiveButton('forceStart');
    try {
      setLoading(true);
      await torrentsApi.setForceStart([torrent.hash], value);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleSetSuperSeeding = async (value: boolean) => {
    try {
      setLoading(true);
      await torrentsApi.setSuperSeeding([torrent.hash], value);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSequential = async () => {
    try {
      setLoading(true);
      await torrentsApi.toggleSequentialDownload([torrent.hash]);
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAltSpeed = async () => {
    try {
      setLoading(true);
      await toggleAlternativeSpeedLimits();
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetCategory = () => {
    setActiveButton('category');
    const categoryOptions = [t('common.none'), ...Object.keys(categories)];
    Alert.alert(
      t('torrentDetail.setCategory'),
      t('torrentDetail.selectCategory'),
      [
        ...categoryOptions.map((cat) => ({
          text: cat,
          onPress: async () => {
            try {
              setLoading(true);
              await torrentsApi.setTorrentCategory(
                [torrent.hash],
                cat === t('common.none') ? '' : cat
              );
              await new Promise(resolve => setTimeout(resolve, 1000));
              await sync();
              onRefresh();
            } catch (error: unknown) {
              showToast(getErrorMessage(error), 'error');
              setActiveButton(null);
            } finally {
              setLoading(false);
              setActiveButton(null);
            }
          },
        })),
        {
          text: t('torrentDetail.addNewCategory'),
          onPress: () => {
            setActiveButton(null);
            setInputModalConfig({
              title: t('torrentDetail.addNewCategory'),
              message: t('torrentDetail.enterCategoryName'),
              onConfirm: async (categoryName: string) => {
                setInputModalVisible(false);
                if (!categoryName) {
                  showToast(t('errors.validCategoryName'), 'error');
                  return;
                }
                try {
                  setLoading(true);
                  setActiveButton('category');
                  await categoriesApi.addCategory(categoryName, '');
                  await torrentsApi.setTorrentCategory([torrent.hash], categoryName);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  await sync();
                  onRefresh();
                } catch (error: unknown) {
                  showToast(getErrorMessage(error), 'error');
                } finally {
                  setLoading(false);
                  setActiveButton(null);
                }
              },
            });
            setInputModalVisible(true);
          },
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => {
            setActiveButton(null);
          },
        },
      ]
    );
  };

  const handleSetDownloadLimit = () => {
    setActiveButton('dlLimit');
    setLimitType('download');
    setLimitInput(torrent.dl_limit > 0 ? (torrent.dl_limit / 1024).toFixed(0) : '0');
    setLimitModalVisible(true);
  };

  const handleSetUploadLimit = () => {
    setActiveButton('ulLimit');
    setLimitType('upload');
    setLimitInput(torrent.up_limit > 0 ? (torrent.up_limit / 1024).toFixed(0) : '0');
    setLimitModalVisible(true);
  };

  const handleSetShareLimits = () => {
    setActiveButton('shareLimit');
    setInputModalConfig({
      title: t('torrentDetail.setShareLimits'),
      message: t('torrentDetail.enterRatioLimit'),
      keyboardType: 'numeric',
      allowEmpty: true,
      onConfirm: async (ratioValue: string) => {
        setInputModalVisible(false);
        try {
          setLoading(true);
          const ratioLimit = ratioValue ? parseFloat(ratioValue) : undefined;
          await torrentsApi.setTorrentShareLimits([torrent.hash], ratioLimit);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await sync();
          onRefresh();
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setLoading(false);
          setActiveButton(null);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleSetLocation = () => {
    setActiveButton('location');
    setInputModalConfig({
      title: t('torrentDetail.moveTo'),
      message: t('torrentDetail.enterNewSavePath'),
      defaultValue: properties?.save_path || torrent.save_path || '',
      onConfirm: async (location: string) => {
        setInputModalVisible(false);
        if (!location) {
          showToast(t('errors.validPath'), 'error');
          setActiveButton(null);
          return;
        }
        try {
          setLoading(true);
          await torrentsApi.setTorrentLocation([torrent.hash], location);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await sync();
          onRefresh();
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setLoading(false);
          setActiveButton(null);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleSetName = () => {
    setActiveButton('rename');
    setInputModalConfig({
      title: t('torrentDetail.renameTorrent'),
      message: t('torrentDetail.enterNewName'),
      defaultValue: torrent.name,
      onConfirm: async (name: string) => {
        setInputModalVisible(false);
        if (!name) {
          showToast(t('errors.validName'), 'error');
          setActiveButton(null);
          return;
        }
        try {
          setLoading(true);
          await torrentsApi.setTorrentName(torrent.hash, name);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await sync();
          onRefresh();
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setLoading(false);
          setActiveButton(null);
        }
      },
    });
    setInputModalVisible(true);
  };

  const handleEditTrackers = () => {
    router.push(`/torrent/manage-trackers?hash=${torrent.hash}`);
  };

  const handleRemoveTracker = async (tracker: Tracker) => {
    try {
      setLoading(true);
      await torrentsApi.removeTrackers(torrent.hash, [tracker.url]);
      onRefresh();
      showToast(t('screens.trackers.trackerRemoved'), 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPeerDetails = async () => {
    setPeersModalVisible(true);
    setPeersLoading(true);
    setPeersData([]);
    try {
      const data = await syncApi.getTorrentPeers(torrent.hash, 0) as { peers?: Record<string, { progress?: number; client?: string }> };
      const peersObj = data?.peers ?? {};
      const list = Object.entries(peersObj).map(([addr, p]) => ({
        ip: addr,
        progress: typeof p?.progress === 'number' ? p.progress : 0,
        client: p?.client || '',
      }));
      list.sort((a, b) => b.progress - a.progress);
      setPeersData(list);
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setPeersModalVisible(false);
    } finally {
      setPeersLoading(false);
    }
  };

  const handleAddPeers = () => {
    setInputModalConfig({
      title: t('torrentDetail.addPeers'),
      message: t('torrentDetail.enterPeerAddresses'),
      multiline: true,
      onConfirm: async (peersText: string) => {
        setInputModalVisible(false);
        if (!peersText) {
          showToast(t('errors.enterPeerAddresses'), 'error');
          return;
        }
        try {
          setLoading(true);
          const peers = peersText.split('\n').map((p: string) => p.trim()).filter((p: string) => p);
          await torrentsApi.addPeers([torrent.hash], peers);
          showToast(t('toast.peersAdded'), 'success');
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytes: number): string => {
    if (bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 0) return '∞';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getMBPerSecond = (kbPerSecond: string): string => {
    const num = parseFloat(kbPerSecond);
    if (isNaN(num) || num === 0) return '0 MB/s';
    const mbPerSecond = num / 1024;
    return `${mbPerSecond.toFixed(2)} MB/s`;
  };

  const handleLimitSubmit = async () => {
    if (!limitType) return;
    
    const limit = parseFloat(limitInput);
    if (isNaN(limit) || limit < 0) {
      showToast(t('errors.validNumber'), 'error');
      return;
    }
    
    try {
      setLoading(true);
      setLimitModalVisible(false);
      const limitInBytes = limit * 1024; // Convert KB/s to bytes/s
      
      if (limitType === 'download') {
        await torrentsApi.setTorrentDownloadLimit([torrent.hash], limitInBytes);
      } else {
        await torrentsApi.setTorrentUploadLimit([torrent.hash], limitInBytes);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await sync();
      onRefresh();
      
      setLimitInput('');
      setLimitType(null);
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleLimitCancel = () => {
    setLimitModalVisible(false);
    setLimitInput('');
    setLimitType(null);
    setActiveButton(null);
  };

  // Check if torrent is paused or stopped (not actively downloading/uploading)
  const isPaused =
    torrent.state === 'pausedDL' || 
    torrent.state === 'pausedUP' || 
    torrent.state === 'stoppedDL' || 
    torrent.state === 'stoppedUP';

  const renderInputModal = () => (
    <InputModal
      visible={inputModalVisible}
      title={inputModalConfig.title}
      message={inputModalConfig.message}
      placeholder={inputModalConfig.placeholder}
      defaultValue={inputModalConfig.defaultValue}
      keyboardType={inputModalConfig.keyboardType}
      multiline={inputModalConfig.multiline}
      allowEmpty={inputModalConfig.allowEmpty}
      onCancel={() => {
        setInputModalVisible(false);
        setActiveButton(null);
      }}
      onConfirm={inputModalConfig.onConfirm}
    />
  );

  if (activeTab === 'overview') {
    return (
      <View style={styles.container}>
        {renderInputModal()}
        {/* Speed Limit Modal */}
        <Modal
          visible={limitModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={handleLimitCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {limitType === 'download' ? t('torrentDetail.setDownloadLimit') : t('torrentDetail.setUploadLimit')}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {t('screens.torrents.enterLimitKbs')}
              </Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                placeholder={t('placeholders.enterKbs')}
                placeholderTextColor={colors.textSecondary}
                value={limitInput}
                onChangeText={setLimitInput}
                keyboardType="numeric"
                autoFocus
              />
              {limitInput && parseFloat(limitInput) > 0 && (
                <Text style={[styles.modalEquivalent, { color: colors.primary }]}>
                  = {getMBPerSecond(limitInput)}
                </Text>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.background }]}
                  onPress={handleLimitCancel}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                  onPress={handleLimitSubmit}
                >
                  <Text style={styles.modalButtonText}>{t('torrentDetail.set')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.statsGrid}>
            <StatCard
              icon="speedometer"
              label={t('torrentDetail.downloaded')}
              value={formatSpeed(torrent.dlspeed)}
              color={colors.stateDownloading}
            />
            <StatCard
              icon="cloud-upload"
              label={t('torrentDetail.uploaded')}
              value={formatSpeed(torrent.upspeed)}
              color={colors.stateUploadOnly}
            />
          </View>
        </View>
        {/* Quick Actions */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitleSmall, { color: colors.text }]}>{t('torrentDetail.quickActions')}</Text>
          </View>
          <View style={styles.actionsGrid}>
            {isPaused ? (
              <TouchableOpacity
                style={[styles.actionButtonCard, { backgroundColor: activeButton === 'resume' ? colors.primary : '#6B6B6B' }]}
                onPress={handleResume}
                disabled={loading}
              >
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.actionButtonText}>{t('torrentDetail.resume')}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButtonCard, { backgroundColor: activeButton === 'pause' ? colors.primary : '#6B6B6B' }]}
                onPress={handlePause}
                disabled={loading}
              >
                <Ionicons name="pause" size={18} color="#FFFFFF" />
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.actionButtonText}>{t('torrentDetail.pause')}</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'delete' ? colors.primary : '#6B6B6B' }]}
              onPress={handleDelete}
              disabled={loading}
            >
              <Ionicons name="trash" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('common.delete')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'recheck' ? colors.primary : '#6B6B6B' }]}
              onPress={handleRecheck}
              disabled={loading}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.recheck')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'reannounce' ? colors.primary : '#6B6B6B' }]}
              onPress={handleReannounce}
              disabled={loading}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={[styles.actionButtonText]}>{t('torrentDetail.reannounce')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: (torrent.force_start || activeButton === 'forceStart') ? colors.primary : '#6B6B6B' }]}
              onPress={() => handleSetForceStart(!torrent.force_start)}
              disabled={loading}
            >
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.forceStart')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: torrent.super_seeding ? colors.primary : '#6B6B6B' }]}
              onPress={() => handleSetSuperSeeding(!torrent.super_seeding)}
              disabled={loading}
            >
              <Ionicons name="rocket" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.superSeeding')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: transferInfo?.use_alt_speed_limits ? colors.primary : '#6B6B6B' }]}
              onPress={handleToggleAltSpeed}
              disabled={loading}
            >
              <Ionicons name="speedometer" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.altSpeed')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: (torrent.category || activeButton === 'category') ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetCategory}
              disabled={loading}
            >
              <Ionicons name="pricetag" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>
                  {torrent.category || t('torrentDetail.category')}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButtonCard,
                { backgroundColor: (optimisticPriority === 1 || activeButton === 'maxPriority') ? colors.primary : '#6B6B6B' },
              ]}
              onPress={handleSetMaxPriority}
              disabled={loading}
            >
              <Ionicons name="arrow-up-circle" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={[styles.actionButtonText, { color: colors.text }]}>{t('torrentDetail.maximum')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButtonCard,
                { backgroundColor: (optimisticPriority === torrents.length || activeButton === 'minPriority') ? colors.primary : '#6B6B6B' },
              ]}
              onPress={handleSetMinPriority}
              disabled={loading}
            >
              <Ionicons name="arrow-down-circle" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.minimum')}</Text>
              </View>
            </TouchableOpacity>
            {/* Row 3 */}
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'rename' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetName}
              disabled={loading}
            >
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.rename')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'location' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetLocation}
              disabled={loading}
            >
              <Ionicons name="folder-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.moveTo')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'ulLimit' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetUploadLimit}
              disabled={loading}
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.ulLimit')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'dlLimit' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetDownloadLimit}
              disabled={loading}
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.dlLimit')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'shareLimit' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetShareLimits}
              disabled={loading}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>{t('torrentDetail.shareLimit')}</Text>
              </View>
            </TouchableOpacity>
            {/* <View style={styles.actionButtonCard} /> */}
          </View>
          <View style={[styles.queueInfoRow, { borderTopColor: colors.surfaceOutline }]}>
            <Text style={[styles.queueInfoLabel, { color: colors.textSecondary }]}>{t('torrentDetail.queuePosition')}</Text>
            <View style={styles.queueInfoRight}>
              <Text style={[styles.queueInfoValue, { color: colors.text }]}>
                {getQueueDisplay()}
              </Text>
              <View style={styles.queueButtons}>
                <TouchableOpacity
                  style={[
                    styles.queueButton,
                    { backgroundColor: (loading || optimisticPriority === 1) ? colors.textSecondary : colors.primary }
                  ]}
                  onPress={handleIncreasePriority}
                  disabled={loading || optimisticPriority === 1}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.queueButton,
                    { backgroundColor: (loading || optimisticPriority === torrents.length) ? colors.textSecondary : colors.primary }
                  ]}
                  onPress={handleDecreasePriority}
                  disabled={loading || optimisticPriority === torrents.length}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Stats - 2x3 Grid */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.statsGrid}>
            <StatCard
              icon="swap-horizontal"
              label={t('torrentDetail.ratio')}
              value={torrent.ratio.toFixed(2)}
              color={colors.textSecondary}
            />
            <View style={styles.statCardWithInfo}>
              <StatCard
                icon="people"
                label={t('torrentDetail.seeds')}
                value={`${torrent.num_seeds}/${torrent.num_complete}`}
                color={colors.textSecondary}
              />
              <TouchableOpacity
                style={[styles.peersInfoButton, { backgroundColor: colors.primary }]}
                onPress={handleOpenPeerDetails}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="information-circle" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.statCardWithInfo}>
              <StatCard
                icon="people-outline"
                label={t('torrentDetail.peers')}
                value={`${torrent.num_leechs}/${torrent.num_incomplete}`}
                color={colors.textSecondary}
              />
              <TouchableOpacity
                style={[styles.peersInfoButton, { backgroundColor: colors.primary }]}
                onPress={handleOpenPeerDetails}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="information-circle" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <StatCard
              icon="cloud-done"
              label={t('torrentDetail.uploadRatio')}
              value={torrent.ratio.toFixed(2)}
              color={colors.success}
            />
          </View>
        </View>

        {/* Peer Details Modal */}
        <Modal
          visible={peersModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setPeersModalVisible(false)}
        >
          <View style={styles.peersModalOverlay}>
            <View style={[styles.peersModalContent, { backgroundColor: colors.surface }]}>
              <View style={[styles.peersModalHeader, { borderBottomColor: colors.surfaceOutline }]}>
                <Text style={[styles.peersModalTitle, { color: colors.text }]}>{t('torrentDetail.connectedPeers')}</Text>
                <TouchableOpacity onPress={() => setPeersModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {peersLoading ? (
                <View style={styles.peersModalBody}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.peersModalLoadingText, { color: colors.textSecondary }]}>
                    {t('torrentDetail.loadingPeers')}
                  </Text>
                </View>
              ) : peersData.length === 0 ? (
                <View style={styles.peersModalBody}>
                  <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.peersModalEmptyText, { color: colors.textSecondary }]}>
                    {t('torrentDetail.noConnectedPeers')}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.peersModalScroll} contentContainerStyle={styles.peersModalScrollContent}>
                  {peersData.map((p, idx) => (
                    <View
                      key={`${p.ip}-${idx}`}
                      style={[styles.peerRow, { borderBottomColor: colors.surfaceOutline }]}
                    >
                      <Text style={[styles.peerProgress, { color: colors.text }]}>
                        {(p.progress * 100).toFixed(1)}%
                      </Text>
                      <View style={styles.peerInfo}>
                        <Text style={[styles.peerIp, { color: colors.text }]} numberOfLines={1}>
                          {p.ip}
                        </Text>
                        {p.client ? (
                          <Text style={[styles.peerClient, { color: colors.textSecondary }]} numberOfLines={1}>
                            {p.client}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* General Info */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('torrentDetail.generalInformation')}</Text>
          </View>
          <InfoRow icon="stats-chart" label={t('torrentDetail.state')} value={torrent.state} />
          <InfoRow icon="pie-chart" label={t('torrentDetail.progress')} value={`${(torrent.progress * 100).toFixed(1)}%`} />
          <InfoRow icon="disc" label={t('torrentDetail.size')} value={formatSize(torrent.total_size)} />
          <InfoRow icon="download" label={t('torrentDetail.downloaded')} value={formatSize(torrent.downloaded)} />
          <InfoRow icon="cloud-done" label={t('torrentDetail.uploaded')} value={formatSize(torrent.uploaded)} />
          <InfoRow icon="swap-horizontal" label={t('torrentDetail.ratio')} value={torrent.ratio.toFixed(2)} />
          <InfoRow icon="time" label={t('torrentDetail.lastSeenComplete')} value={formatDate(torrent.seen_complete)} />
          <View style={[styles.categorySection, { borderBottomColor: colors.surfaceOutline }]}>
            <Text style={[styles.actionButtonTextLong, { color: colors.textSecondary}]}>{t('torrentDetail.categoryColon')}</Text>
            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                const categoryOptions = [t('common.none'), ...Object.keys(categories)];
                Alert.alert(
                  t('torrentDetail.setCategory'),
                  t('torrentDetail.selectCategory'),
                  categoryOptions.map((cat) => ({
                    text: cat,
                    onPress: async () => {
                      try {
                        setLoading(true);
                        await torrentsApi.setTorrentCategory(
                          [torrent.hash],
                          cat === t('common.none') ? '' : cat
                        );
                        onRefresh();
                      } catch (error: unknown) {
                        showToast(getErrorMessage(error), 'error');
                      } finally {
                        setLoading(false);
                      }
                    },
                  }))
                );
              }}
            >
              <Text style={styles.categoryButtonText}>
                {torrent.category || t('common.none')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.tagsSection, { borderBottomColor: colors.surfaceOutline }]}>
            <View style={styles.tagsSectionHeader}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('torrentDetail.tagsLabel')}</Text>
              <TouchableOpacity
                style={[styles.manageTagsButton, { backgroundColor: colors.primary }]}
                onPress={() => setTagsModalVisible(true)}
              >
                <Ionicons name="pricetag" size={12} color="#FFFFFF" />
                <Text style={styles.manageTagsButtonText}>{t('torrentDetail.manageTags')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tagsContainer}>
              {torrent.tags
                ? torrent.tags.split(',').map((tag, idx) => (
                    <View key={idx} style={[styles.tag, { backgroundColor: colors.background }]}>
                      <Text style={[styles.tagText, { color: colors.textSecondary }]}>{tag.trim()}</Text>
                    </View>
                  ))
                : <Text style={[styles.tagText, { color: colors.textSecondary }]}>{t('common.none')}</Text>}
            </View>
          </View>
          <TagsModal
            visible={tagsModalVisible}
            currentTagsCsv={torrent.tags || ''}
            allServerTags={tags}
            loading={loading}
            onAddTag={async (tag) => {
              try {
                setLoading(true);
                await torrentsApi.addTorrentTags([torrent.hash], [tag]);
                onRefresh();
              } catch (error: unknown) {
                showToast(getErrorMessage(error), 'error');
              } finally {
                setLoading(false);
              }
            }}
            onRemoveTag={async (tag) => {
              try {
                setLoading(true);
                await torrentsApi.removeTorrentTags([torrent.hash], [tag]);
                onRefresh();
              } catch (error: unknown) {
                showToast(getErrorMessage(error), 'error');
              } finally {
                setLoading(false);
              }
            }}
            onCreateTag={async (tag) => {
              try {
                setLoading(true);
                await tagsApi.createTags([tag]);
                await torrentsApi.addTorrentTags([torrent.hash], [tag]);
                onRefresh();
              } catch (error: unknown) {
                showToast(getErrorMessage(error), 'error');
              } finally {
                setLoading(false);
              }
            }}
            onClose={() => setTagsModalVisible(false)}
          />
        </View>

        {properties && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('torrentDetail.torrentDetailsSection')}</Text>
            </View>
            <InfoRow icon="key" label={t('torrentDetail.hash')} value={properties.hash.substring(0, 16) + '...'} />
            <InfoRow icon="folder" label={t('torrentDetail.savePath')} value={properties.save_path} />
            <InfoRow icon="calendar" label={t('torrentDetail.creationDate')} value={formatDate(properties.creation_date)} />
            <InfoRow icon="chatbubble" label={t('torrentDetail.comment')} value={properties.comment || t('torrentDetail.na')} />
            <InfoRow icon="person" label={t('torrentDetail.createdBy')} value={properties.created_by || t('torrentDetail.na')} />
            <InfoRow icon="grid" label={t('torrentDetail.pieces')} value={`${properties.pieces_have} / ${properties.pieces_num}`} />
            <InfoRow icon="cube" label={t('torrentDetail.pieceSize')} value={formatSize(properties.piece_size)} />
          </View>
        )}

        {/* Transfer Info */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('torrentDetail.transferStatistics')}</Text>
          </View>
          {torrent.eta > 0 && torrent.eta < 8640000 && (
            <InfoRow icon="time" label={t('torrentDetail.eta')} value={formatTime(torrent.eta)} />
          )}
          <InfoRow icon="time-outline" label={t('torrentDetail.timeActive')} value={formatTime(torrent.time_active)} />
          <InfoRow icon="hourglass" label={t('torrentDetail.seedingTime')} value={formatTime(torrent.seeding_time)} />
        </View>

        {properties && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="speedometer" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('torrentDetail.speedLimitsSection')}</Text>
            </View>
            <InfoRow icon="download-outline" label={t('torrentDetail.downloadLimit')} value={torrent.dl_limit > 0 ? formatSpeed(torrent.dl_limit) : t('common.unlimited')} />
            <InfoRow icon="cloud-upload-outline" label={t('torrentDetail.uploadLimit')} value={torrent.up_limit > 0 ? formatSpeed(torrent.up_limit) : t('common.unlimited')} />
            <InfoRow icon="swap-horizontal-outline" label={t('torrentDetail.ratioLimit')} value={torrent.ratio_limit >= 0 ? torrent.ratio_limit.toFixed(2) : t('common.unlimited')} />
            <InfoRow icon="hourglass-outline" label={t('torrentDetail.seedingTimeLimit')} value={torrent.seeding_time_limit >= 0 ? formatTime(torrent.seeding_time_limit) : t('common.unlimited')} />
          </View>
        )}

      </View>
    );
  }

  if (activeTab === 'trackers') {
    return (
      <View style={styles.container}>
        {renderInputModal()}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeaderWithButton}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('torrentDetail.trackersTab', { count: trackers.length })}</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleEditTrackers}
              disabled={loading}
            >
              <Ionicons name="pencil" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.addButtonText}>{t('torrentDetail.edit')}</Text>
            </TouchableOpacity>
          </View>
          {trackers.map((tracker, index) => (
            <View key={index} style={[styles.trackerItem, { backgroundColor: colors.background }]}>
              <Text style={[styles.trackerUrl, { color: colors.text }]}>{tracker.url}</Text>
              <Text style={[styles.trackerStatus, { color: colors.textSecondary }]}>
                {t('torrentDetail.trackerStatusLabel', { status: tracker.status === 2 ? t('screens.trackers.working') : tracker.status === 3 ? t('screens.trackers.updating') : tracker.status === 0 ? t('screens.trackers.disabled') : t('screens.trackers.notContacted') })}
              </Text>
              {tracker.msg && <Text style={[styles.trackerMsg, { color: colors.error }]}>{tracker.msg}</Text>}
              <TouchableOpacity
                style={[styles.removeButton, { backgroundColor: colors.error }]}
                onPress={() => handleRemoveTracker(tracker)}
                disabled={loading}
              >
                <Text style={styles.removeButtonText}>{t('common.remove')}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleAddPeers}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>{t('torrentDetail.addPeers')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleSetFilePriority = async (fileIndex: number, priority: FilePriority) => {
    try {
      setLoading(true);
      await torrentsApi.setFilePriority(torrent.hash, [fileIndex], priority);
      await new Promise(resolve => setTimeout(resolve, 500));
      await sync();
      onRefresh();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFile = (file: TorrentFile) => {
    setInputModalConfig({
      title: t('torrentDetail.renameFile'),
      message: t('torrentDetail.enterNewName'),
      defaultValue: file.name.split('/').pop(),
      onConfirm: async (newName: string) => {
        setInputModalVisible(false);
        if (!newName) {
          showToast(t('errors.validName'), 'error');
          return;
        }
        try {
          setLoading(true);
          await torrentsApi.renameFile(torrent.hash, file.name, newName);
          onRefresh();
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'error');
        } finally {
          setLoading(false);
        }
      },
    });
    setInputModalVisible(true);
  };

  const getPriorityLabel = (priority: FilePriority): string => {
    switch (priority) {
      case 0:
        return t('torrentDetail.doNotDownload');
      case 1:
        return t('torrentDetail.normal');
      case 2:
        return t('torrentDetail.high');
      case 3:
      case 4:
      case 5:
      case 6:
        return t('torrentDetail.mixed');
      case 7:
        return t('torrentDetail.maximum');
      default:
        return t('torrentDetail.normal');
    }
  };

  if (activeTab === 'files') {
    return (
      <View style={styles.container}>
        {renderInputModal()}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('torrentDetail.filesTab', { count: files.length })}</Text>
          {files.map((file) => (
            <View key={file.index} style={[styles.fileItem, { backgroundColor: colors.background }]}>
              <View style={styles.fileHeader}>
                <Text style={[styles.fileName, { color: colors.text }]}>{file.name}</Text>
                <TouchableOpacity
                  style={[styles.renameButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleRenameFile(file)}
                  disabled={loading}
                >
                  <Text style={styles.renameButtonText}>{t('actions.rename')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.fileInfo}>
                <Text style={[styles.fileSize, { color: colors.textSecondary }]}>{formatSize(file.size)}</Text>
                <Text style={[styles.fileProgress, { color: colors.primary }]}>
                  {(file.progress * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={[styles.fileActions, { borderTopColor: colors.surfaceOutline }]}>
                <Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>
                  {t('torrentDetail.filePriority', { priority: getPriorityLabel(file.priority) })}
                </Text>
                <View style={styles.priorityButtons}>
                  <TouchableOpacity
                    style={[styles.priorityButton, { backgroundColor: colors.background }, file.priority === 0 && { backgroundColor: colors.primary }]}
                    onPress={() => handleSetFilePriority(file.index, 0)}
                    disabled={loading}
                  >
                    <Text style={[styles.priorityButtonText, { color: file.priority === 0 ? '#FFFFFF' : colors.text }]}>{t('common.skip')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityButton, { backgroundColor: colors.background }, file.priority === 1 && { backgroundColor: colors.primary }]}
                    onPress={() => handleSetFilePriority(file.index, 1)}
                    disabled={loading}
                  >
                    <Text style={[styles.priorityButtonText, { color: file.priority === 1 ? '#FFFFFF' : colors.text }]}>{t('common.normal')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityButton, { backgroundColor: colors.background }, file.priority === 7 && { backgroundColor: colors.primary }]}
                    onPress={() => handleSetFilePriority(file.index, 7)}
                    disabled={loading}
                  >
                    <Text style={[styles.priorityButtonText, { color: file.priority === 7 ? '#FFFFFF' : colors.text }]}>{t('common.max')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return null;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function StatCard({ icon, label, value, color }: { icon: IconName; label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.background }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon?: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.surfaceOutline }]}>
      {icon && <Ionicons name={icon} size={16} color={colors.textSecondary} style={styles.infoIcon} />}
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}:</Text>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ToggleRow({ icon, label, value, onPress, disabled }: { icon: IconName; label: string; value: boolean; onPress: () => void; disabled: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.toggleRow, { backgroundColor: colors.background }]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.toggleLeft}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <View style={[styles.toggleSwitch, { backgroundColor: value ? colors.success : colors.background }]}>
        <View style={[styles.toggleThumb, { backgroundColor: '#FFFFFF', transform: [{ translateX: value ? 18 : 0 }] }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    padding: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000000',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionsSingleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'nowrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  resumeButton: {
    backgroundColor: '#34C759',
  },
  pauseButton: {
    backgroundColor: '#FF9500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  secondaryButton: {
    backgroundColor: '#007AFF',
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
    width: 120,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  trackerItem: {
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    marginBottom: 8,
  },
  trackerUrl: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  trackerStatus: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  trackerMsg: {
    fontSize: 12,
    color: '#FF3B30',
  },
  fileItem: {
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    marginBottom: 8,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  fileInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fileSize: {
    fontSize: 12,
    color: '#8E8E93',
  },
  fileProgress: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    padding: 10,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  statCardWithInfo: {
    flex: 1,
    minWidth: '30%',
    position: 'relative',
  },
  peersInfoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
    borderRadius: 12,
  },
  peersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  peersModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  peersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  peersModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  peersModalBody: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  peersModalLoadingText: {
    fontSize: 14,
  },
  peersModalEmptyText: {
    fontSize: 14,
  },
  peersModalScroll: {
    maxHeight: 400,
  },
  peersModalScrollContent: {
    paddingBottom: 24,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 16,
  },
  peerProgress: {
    fontSize: 16,
    fontWeight: '600',
    width: 52,
  },
  peerInfo: {
    flex: 1,
    minWidth: 0,
  },
  peerIp: {
    fontSize: 14,
    fontWeight: '500',
  },
  peerClient: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    rowGap: 10,
    minHeight: 140,
  },
  actionButtonCard: {
    width: '18.4%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  queueInfoRow: {
    // marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 25,
  },
  queueInfoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  queueInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  queueInfoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  queueButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  queueButton: {
    width: 28,
    height: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 6,
    width: '100%',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 10,
    includeFontPadding: true,
    },
  actionButtonTextLong: {
    fontSize: 9,
    lineHeight: 11,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionsColumn: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderWithButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleSmall: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoIcon: {
    marginRight: 8,
  },
  advancedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  advancedCard: {
    flex: 1,
    minWidth: '30%',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
  },
  advancedCardText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toggleSection: {
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 16,
    padding: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 16,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  advancedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  advancedButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 120,
  },
  advancedButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeButton: {
    backgroundColor: '#34C759',
  },
  fileActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  priorityLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#007AFF',
  },
  priorityButtonText: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '500',
  },
  renameButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  renameButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  categorySection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  categoryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 8,
  },
  categoryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tagsSection: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tagsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manageTagsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  manageTagsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  tag: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  addTagButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  addTagButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  removeTagButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  removeTagButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 0,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  modalEquivalent: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    // paddingVertical: 10,
    // paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#E5E5EA',
  },
  modalButtonConfirm: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalDescription: {
    fontSize: 8,
    marginBottom: 18,
    lineHeight: 12,
  },
  modalCancelButton: {
    backgroundColor: '#E5E5EA',
  },
  modalSaveButton: {
    backgroundColor: '#007AFF',
  },
});

