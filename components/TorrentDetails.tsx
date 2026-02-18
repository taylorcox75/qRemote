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
import { Ionicons } from '@expo/vector-icons';
import { torrentsApi } from '../services/api/torrents';
import { syncApi } from '../services/api/sync';
import { categoriesApi } from '../services/api/categories';
import { tagsApi } from '../services/api/tags';
import { useTorrents } from '../context/TorrentContext';
import { useServer } from '../context/ServerContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useTransfer } from '../context/TransferContext';
import { apiClient } from '../services/api/client';
import {
  TorrentInfo,
  TorrentProperties,
  Tracker,
  TorrentFile,
  FilePriority,
} from '../types/api';
import { formatDate } from '../utils/format';

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
  const [loading, setLoading] = useState(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [optimisticPriority, setOptimisticPriority] = useState<number>(torrent.priority);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitType, setLimitType] = useState<'download' | 'upload' | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [peersModalVisible, setPeersModalVisible] = useState(false);
  const [peersData, setPeersData] = useState<Array<{ ip: string; progress: number; client?: string }>>([]);
  const [peersLoading, setPeersLoading] = useState(false);
  
  // Display queue position (1 = top, higher = lower)
  const getQueueDisplay = () => {
    const priority = optimisticPriority;
    const totalTorrents = torrents.length;
    
    // Priority -1 or 0 typically means "not queued" (forced/active)
    if (priority <= 0) return 'Not Queued';
    
    // Show position out of total
    return `#${priority} of ${totalTorrents}`;
  };

  useEffect(() => {
    setOptimisticPriority(torrent.priority);
  }, [torrent.priority]);

  const handlePause = async () => {
    if (!isConnected || !currentServer) {
      showToast('Not connected to a server. Please connect to a server first.', 'error');
      return;
    }
    setActiveButton('pause');
    try {
      setLoading(true);
      // Ensure server is set in API client
      if (!apiClient.getServer()) {
        // Server was cleared, try to reconnect
        const reconnected = await reconnect();
        if (!reconnected) {
          showToast('Lost connection to server. Please reconnect.', 'error');
          return;
        }
      }
      await torrentsApi.pauseTorrents([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: any) {
      console.error('Pause error:', error);
      showToast(error.message || 'Failed to pause torrent', 'error');
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleResume = async () => {
    if (!isConnected || !currentServer) {
      showToast('Not connected to a server. Please connect to a server first.', 'error');
      return;
    }
    setActiveButton('resume');
    try {
      setLoading(true);
      // Ensure server is set in API client
      if (!apiClient.getServer()) {
        // Server was cleared, try to reconnect
        const reconnected = await reconnect();
        if (!reconnected) {
          showToast('Lost connection to server. Please reconnect.', 'error');
          return;
        }
      }
      await torrentsApi.resumeTorrents([torrent.hash]);
      // Wait 1 second for the server to process the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh the global torrent list and detail view
      await sync();
      onRefresh();
    } catch (error: any) {
      console.error('Resume error:', error);
      showToast(error.message || 'Failed to resume torrent', 'error');
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Torrent',
      `Delete "${torrent.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Torrent Only',
          onPress: async () => {
            setActiveButton('delete');
            try {
              setLoading(true);
              await torrentsApi.deleteTorrents([torrent.hash], false);
              showToast('Torrent deleted', 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to delete torrent', 'error');
              setActiveButton(null);
            } finally {
              setLoading(false);
            }
          },
        },
        {
          text: 'With Files',
          style: 'destructive',
          onPress: async () => {
            setActiveButton('delete');
            try {
              setLoading(true);
              await torrentsApi.deleteTorrents([torrent.hash], true);
              showToast('Torrent deleted', 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to delete torrent', 'error');
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
      showToast('Recheck started', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to recheck torrent', 'error');
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
      showToast('Reannounce sent', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to reannounce torrent', 'error');
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
    } catch (error: any) {
      showToast(error.message || 'Failed to change priority', 'error');
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
    } catch (error: any) {
      showToast(error.message || 'Failed to change priority', 'error');
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
    } catch (error: any) {
      showToast(error.message || 'Failed to change priority', 'error');
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
    } catch (error: any) {
      showToast(error.message || 'Failed to change priority', 'error');
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
    } catch (error: any) {
      showToast(error.message || 'Failed to set force start', 'error');
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
    } catch (error: any) {
      showToast(error.message || 'Failed to set super seeding', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSequential = async () => {
    try {
      setLoading(true);
      await torrentsApi.toggleSequentialDownload([torrent.hash]);
      onRefresh();
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle sequential download', 'error');
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
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle alternative speed limits', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetCategory = () => {
    setActiveButton('category');
    const categoryOptions = ['None', ...Object.keys(categories)];
    Alert.alert(
      'Set Category',
      'Select a category',
      [
        ...categoryOptions.map((cat) => ({
          text: cat,
          onPress: async () => {
            try {
              setLoading(true);
              await torrentsApi.setTorrentCategory(
                [torrent.hash],
                cat === 'None' ? '' : cat
              );
              // Wait 1 second for the server to process the request
              await new Promise(resolve => setTimeout(resolve, 1000));
              // Refresh the global torrent list and detail view
              await sync();
              onRefresh();
            } catch (error: any) {
              showToast(error.message || 'Failed to set category', 'error');
              setActiveButton(null);
            } finally {
              setLoading(false);
              setActiveButton(null);
            }
          },
        })),
        {
          text: 'Add New Category',
          onPress: () => {
            setActiveButton(null);
            Alert.prompt(
              'Add New Category',
              'Enter category name',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Add',
                  onPress: async (categoryName: string | undefined) => {
                    if (!categoryName || !categoryName.trim()) {
                      showToast('Please enter a valid category name', 'error');
                      return;
                    }
                    try {
                      setLoading(true);
                      setActiveButton('category');
                      // Create the category first
                      await categoriesApi.addCategory(categoryName.trim(), '');
                      // Then set it on the torrent
                      await torrentsApi.setTorrentCategory([torrent.hash], categoryName.trim());
                      // Wait 1 second for the server to process the request
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      // Refresh the global torrent list and detail view
                      await sync();
                      onRefresh();
                    } catch (error: any) {
                      showToast(error.message || 'Failed to add category', 'error');
                    } finally {
                      setLoading(false);
                      setActiveButton(null);
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        },
        {
          text: 'Cancel',
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
    Alert.prompt(
      'Set Share Limits',
      'Enter ratio limit (e.g., 2.0) or leave empty',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setActiveButton(null) },
        {
          text: 'Set',
          onPress: async (ratioValue: string | undefined) => {
            try {
              setLoading(true);
              const ratioLimit = ratioValue && ratioValue.trim() ? parseFloat(ratioValue) : undefined;
              await torrentsApi.setTorrentShareLimits([torrent.hash], ratioLimit);
              await new Promise(resolve => setTimeout(resolve, 1000));
              await sync();
              onRefresh();
            } catch (error: any) {
              showToast(error.message || 'Failed to set share limits', 'error');
            } finally {
              setLoading(false);
              setActiveButton(null);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleSetLocation = () => {
    setActiveButton('location');
    Alert.prompt(
      'Set Location',
      'Enter new save path',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setActiveButton(null) },
        {
          text: 'Set',
          onPress: async (location: string | undefined) => {
            if (!location || !location.trim()) {
              showToast('Please enter a valid path', 'error');
              setActiveButton(null);
              return;
            }
            try {
              setLoading(true);
              await torrentsApi.setTorrentLocation([torrent.hash], location.trim());
              await new Promise(resolve => setTimeout(resolve, 1000));
              await sync();
              onRefresh();
            } catch (error: any) {
              showToast(error.message || 'Failed to set location', 'error');
            } finally {
              setLoading(false);
              setActiveButton(null);
            }
          },
        },
      ],
      'plain-text',
      properties?.save_path || torrent.save_path || ''
    );
  };

  const handleSetName = () => {
    setActiveButton('rename');
    Alert.prompt(
      'Rename Torrent',
      'Enter new name',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setActiveButton(null) },
        {
          text: 'Rename',
          onPress: async (name: string | undefined) => {
            if (!name || !name.trim()) {
              showToast('Please enter a valid name', 'error');
              setActiveButton(null);
              return;
            }
            try {
              setLoading(true);
              await torrentsApi.setTorrentName(torrent.hash, name.trim());
              await new Promise(resolve => setTimeout(resolve, 1000));
              await sync();
              onRefresh();
            } catch (error: any) {
              showToast(error.message || 'Failed to rename torrent', 'error');
            } finally {
              setLoading(false);
              setActiveButton(null);
            }
          },
        },
      ],
      'plain-text',
      torrent.name
    );
  };

  const handleEditTrackers = () => {
    router.push(`/torrent/manage-trackers?hash=${torrent.hash}`);
  };

  const handleRemoveTracker = async (tracker: Tracker) => {
    try {
      setLoading(true);
      await torrentsApi.removeTrackers(torrent.hash, [tracker.url]);
      onRefresh();
      showToast('Tracker removed', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to remove tracker', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPeerDetails = async () => {
    setPeersModalVisible(true);
    setPeersLoading(true);
    setPeersData([]);
    try {
      const data = await syncApi.getTorrentPeers(torrent.hash, 0);
      const peersObj = data?.peers ?? {};
      const list = Object.entries(peersObj).map(([addr, p]: [string, any]) => ({
        ip: addr,
        progress: typeof p?.progress === 'number' ? p.progress : 0,
        client: p?.client || '',
      }));
      list.sort((a, b) => b.progress - a.progress);
      setPeersData(list);
    } catch (error: any) {
      showToast(error.message || 'Failed to load peer details', 'error');
      setPeersModalVisible(false);
    } finally {
      setPeersLoading(false);
    }
  };

  const handleAddPeers = () => {
    Alert.prompt(
      'Add Peers',
      'Enter peer addresses (IP:Port, one per line)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async (peersText: string | undefined) => {
            if (!peersText || !peersText.trim()) {
              showToast('Please enter peer addresses', 'error');
              return;
            }
            try {
              setLoading(true);
              const peers = peersText.split('\n').map((p: string) => p.trim()).filter((p: string) => p);
              await torrentsApi.addPeers([torrent.hash], peers);
              showToast('Peers added', 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to add peers', 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
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
      showToast('Please enter a valid number', 'error');
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
    } catch (error: any) {
      showToast(error.message || `Failed to set ${limitType} limit`, 'error');
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

  if (activeTab === 'overview') {
    return (
      <View style={styles.container}>
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
                Set {limitType === 'download' ? 'Download' : 'Upload'} Limit
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Enter limit in KB/s (0 for unlimited)
              </Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.surfaceOutline, color: colors.text }]}
                placeholder="Enter KB/s"
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
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                  onPress={handleLimitSubmit}
                >
                  <Text style={styles.modalButtonText}>Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.statsGrid}>
            <StatCard
              icon="speedometer"
              label="Download"
              value={formatSpeed(torrent.dlspeed)}
              color={colors.primary}
            />
            <StatCard
              icon="cloud-upload"
              label="Upload"
              value={formatSpeed(torrent.upspeed)}
              color={colors.success}
            />
          </View>
        </View>
        {/* Quick Actions */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitleSmall, { color: colors.text }]}>Quick Actions</Text>
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
                  <Text style={styles.actionButtonText}>Resume</Text>
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
                  <Text style={styles.actionButtonText}>Pause</Text>
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
                <Text style={styles.actionButtonText}>Delete</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'recheck' ? colors.primary : '#6B6B6B' }]}
              onPress={handleRecheck}
              disabled={loading}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>Recheck</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'reannounce' ? colors.primary : '#6B6B6B' }]}
              onPress={handleReannounce}
              disabled={loading}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={[styles.actionButtonText]}>Re- Announce</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: (torrent.force_start || activeButton === 'forceStart') ? colors.primary : '#6B6B6B' }]}
              onPress={() => handleSetForceStart(!torrent.force_start)}
              disabled={loading}
            >
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>Force Start</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: torrent.super_seeding ? colors.primary : '#6B6B6B' }]}
              onPress={() => handleSetSuperSeeding(!torrent.super_seeding)}
              disabled={loading}
            >
              <Ionicons name="rocket" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>Super Seed</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: transferInfo?.use_alt_speed_limits ? colors.primary : '#6B6B6B' }]}
              onPress={handleToggleAltSpeed}
              disabled={loading}
            >
              <Ionicons name="speedometer" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>Alt Speed</Text>
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
                  {torrent.category || 'Category'}
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
                <Text style={[styles.actionButtonText, { color: colors.text }]}>Max Priority</Text>
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
                <Text style={styles.actionButtonText}>Min Priority</Text>
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
                <Text style={styles.actionButtonText}>Rename</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'location' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetLocation}
              disabled={loading}
            >
              <Ionicons name="folder-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>Location</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'ulLimit' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetUploadLimit}
              disabled={loading}
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>UL Limit</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'dlLimit' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetDownloadLimit}
              disabled={loading}
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>DL Limit</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonCard, { backgroundColor: activeButton === 'shareLimit' ? colors.primary : '#6B6B6B' }]}
              onPress={handleSetShareLimits}
              disabled={loading}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color="#FFFFFF" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>Share Limit</Text>
              </View>
            </TouchableOpacity>
            {/* <View style={styles.actionButtonCard} /> */}
          </View>
          <View style={[styles.queueInfoRow, { borderTopColor: colors.surfaceOutline }]}>
            <Text style={[styles.queueInfoLabel, { color: colors.textSecondary }]}>Queue Position:</Text>
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
              label="Ratio"
              value={torrent.ratio.toFixed(2)}
              color={colors.textSecondary}
            />
            <View style={styles.statCardWithInfo}>
              <StatCard
                icon="people"
                label="Seeds"
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
                label="Peers"
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
              label="Upload Ratio"
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
                <Text style={[styles.peersModalTitle, { color: colors.text }]}>Connected Peers</Text>
                <TouchableOpacity onPress={() => setPeersModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {peersLoading ? (
                <View style={styles.peersModalBody}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.peersModalLoadingText, { color: colors.textSecondary }]}>
                    Loading peer details…
                  </Text>
                </View>
              ) : peersData.length === 0 ? (
                <View style={styles.peersModalBody}>
                  <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.peersModalEmptyText, { color: colors.textSecondary }]}>
                    No connected peers
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>General Information</Text>
          </View>
          <InfoRow icon="stats-chart" label="State" value={torrent.state} />
          <InfoRow icon="pie-chart" label="Progress" value={`${(torrent.progress * 100).toFixed(1)}%`} />
          <InfoRow icon="disc" label="Size" value={formatSize(torrent.total_size)} />
          <InfoRow icon="download" label="Downloaded" value={formatSize(torrent.downloaded)} />
          <InfoRow icon="cloud-done" label="Uploaded" value={formatSize(torrent.uploaded)} />
          <InfoRow icon="swap-horizontal" label="Ratio" value={torrent.ratio.toFixed(2)} />
          <InfoRow icon="time" label="Last Seen Complete" value={formatDate(torrent.seen_complete)} />
          <View style={[styles.categorySection, { borderBottomColor: colors.surfaceOutline }]}>
            <Text style={[styles.actionButtonTextLong, { color: colors.textSecondary}]}>Category:</Text>
            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                const categoryOptions = ['None', ...Object.keys(categories)];
                Alert.alert(
                  'Set Category',
                  'Select a category',
                  categoryOptions.map((cat) => ({
                    text: cat,
                    onPress: async () => {
                      try {
                        setLoading(true);
                        await torrentsApi.setTorrentCategory(
                          [torrent.hash],
                          cat === 'None' ? '' : cat
                        );
                        onRefresh();
                      } catch (error: any) {
                        showToast(error.message || 'Failed to set category', 'error');
                      } finally {
                        setLoading(false);
                      }
                    },
                  }))
                );
              }}
            >
              <Text style={styles.categoryButtonText}>
                {torrent.category || 'None'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.tagsSection, { borderBottomColor: colors.surfaceOutline }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Tags:</Text>
            <View style={styles.tagsContainer}>
              {torrent.tags
                ? torrent.tags.split(',').map((tag, idx) => (
                    <View key={idx} style={[styles.tag, { backgroundColor: colors.background }]}>
                      <Text style={[styles.tagText, { color: colors.textSecondary }]}>{tag.trim()}</Text>
                    </View>
                  ))
                : null}
            </View>
            <TouchableOpacity
              style={[styles.addTagButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                const availableTags = tags.filter(
                  (t) => !torrent.tags || !torrent.tags.split(',').includes(t)
                );
                if (availableTags.length === 0) {
                  showToast('All tags are already assigned', 'info');
                  return;
                }
                Alert.alert(
                  'Add Tag',
                  'Select a tag to add',
                  availableTags.map((tag) => ({
                    text: tag,
                    onPress: async () => {
                      try {
                        setLoading(true);
                        await torrentsApi.addTorrentTags([torrent.hash], [tag]);
                        onRefresh();
                      } catch (error: any) {
                        showToast(error.message || 'Failed to add tag', 'error');
                      } finally {
                        setLoading(false);
                      }
                    },
                  }))
                );
              }}
            >
              <Text style={styles.addTagButtonText}>+ Add Tag</Text>
            </TouchableOpacity>
            {torrent.tags && (
              <TouchableOpacity
                style={[styles.removeTagButton, { backgroundColor: colors.error }]}
                onPress={() => {
                  const currentTags = torrent.tags.split(',');
                  Alert.alert(
                    'Remove Tag',
                    'Select a tag to remove',
                    currentTags.map((tag) => ({
                      text: tag.trim(),
                      onPress: async () => {
                        try {
                          setLoading(true);
                          await torrentsApi.removeTorrentTags([torrent.hash], [tag.trim()]);
                          onRefresh();
                        } catch (error: any) {
                          showToast(error.message || 'Failed to remove tag', 'error');
                        } finally {
                          setLoading(false);
                        }
                      },
                    }))
                  );
                }}
              >
                <Text style={styles.removeTagButtonText}>Remove Tag</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {properties && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Torrent Details</Text>
            </View>
            <InfoRow icon="key" label="Hash" value={properties.hash.substring(0, 16) + '...'} />
            <InfoRow icon="folder" label="Save Path" value={properties.save_path} />
            <InfoRow icon="calendar" label="Creation Date" value={formatDate(properties.creation_date)} />
            <InfoRow icon="chatbubble" label="Comment" value={properties.comment || 'N/A'} />
            <InfoRow icon="person" label="Created By" value={properties.created_by || 'N/A'} />
            <InfoRow icon="grid" label="Pieces" value={`${properties.pieces_have} / ${properties.pieces_num}`} />
            <InfoRow icon="cube" label="Piece Size" value={formatSize(properties.piece_size)} />
          </View>
        )}

        {/* Transfer Info */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Transfer Statistics</Text>
          </View>
          {torrent.eta > 0 && torrent.eta < 8640000 && (
            <InfoRow icon="time" label="ETA" value={formatTime(torrent.eta)} />
          )}
          <InfoRow icon="time-outline" label="Time Active" value={formatTime(torrent.time_active)} />
          <InfoRow icon="hourglass" label="Seeding Time" value={formatTime(torrent.seeding_time)} />
        </View>

        {properties && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="speedometer" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Speed Limits</Text>
            </View>
            <InfoRow icon="download-outline" label="Download Limit" value={torrent.dl_limit > 0 ? formatSpeed(torrent.dl_limit) : 'Unlimited'} />
            <InfoRow icon="cloud-upload-outline" label="Upload Limit" value={torrent.up_limit > 0 ? formatSpeed(torrent.up_limit) : 'Unlimited'} />
            <InfoRow icon="swap-horizontal-outline" label="Ratio Limit" value={torrent.ratio_limit >= 0 ? torrent.ratio_limit.toFixed(2) : 'Unlimited'} />
            <InfoRow icon="hourglass-outline" label="Seeding Time Limit" value={torrent.seeding_time_limit >= 0 ? formatTime(torrent.seeding_time_limit) : 'Unlimited'} />
          </View>
        )}

      </View>
    );
  }

  if (activeTab === 'trackers') {
    return (
      <View style={styles.container}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeaderWithButton}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Trackers ({trackers.length})</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleEditTrackers}
              disabled={loading}
            >
              <Ionicons name="pencil" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.addButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          {trackers.map((tracker, index) => (
            <View key={index} style={[styles.trackerItem, { backgroundColor: colors.background }]}>
              <Text style={[styles.trackerUrl, { color: colors.text }]}>{tracker.url}</Text>
              <Text style={[styles.trackerStatus, { color: colors.textSecondary }]}>
                Status: {tracker.status === 2 ? 'Working' : tracker.status === 3 ? 'Updating' : tracker.status === 0 ? 'Disabled' : 'Not contacted'}
              </Text>
              {tracker.msg && <Text style={[styles.trackerMsg, { color: colors.error }]}>{tracker.msg}</Text>}
              <TouchableOpacity
                style={[styles.removeButton, { backgroundColor: colors.error }]}
                onPress={() => handleRemoveTracker(tracker)}
                disabled={loading}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleAddPeers}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>Add Peers</Text>
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
    } catch (error: any) {
      showToast(error.message || 'Failed to set file priority', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFile = (file: TorrentFile) => {
    Alert.prompt(
      'Rename File',
      'Enter new name',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rename',
          onPress: async (newName: string | undefined) => {
            if (!newName || !newName.trim()) {
              showToast('Please enter a valid name', 'error');
              return;
            }
            try {
              setLoading(true);
              await torrentsApi.renameFile(torrent.hash, file.name, newName.trim());
              onRefresh();
            } catch (error: any) {
              showToast(error.message || 'Failed to rename file', 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
      file.name.split('/').pop()
    );
  };

  const getPriorityLabel = (priority: FilePriority): string => {
    switch (priority) {
      case 0:
        return 'Do not download';
      case 1:
        return 'Normal';
      case 2:
        return 'High';
      case 3:
        return 'Mixed';
      case 4:
        return 'Mixed';
      case 5:
        return 'Mixed';
      case 6:
        return 'Mixed';
      case 7:
        return 'Maximum';
      default:
        return 'Normal';
    }
  };

  if (activeTab === 'files') {
    return (
      <View style={styles.container}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Files ({files.length})</Text>
          {files.map((file) => (
            <View key={file.index} style={[styles.fileItem, { backgroundColor: colors.background }]}>
              <View style={styles.fileHeader}>
                <Text style={[styles.fileName, { color: colors.text }]}>{file.name}</Text>
                <TouchableOpacity
                  style={[styles.renameButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleRenameFile(file)}
                  disabled={loading}
                >
                  <Text style={styles.renameButtonText}>Rename</Text>
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
                  Priority: {getPriorityLabel(file.priority)}
                </Text>
                <View style={styles.priorityButtons}>
                  <TouchableOpacity
                    style={[styles.priorityButton, { backgroundColor: colors.background }, file.priority === 0 && { backgroundColor: colors.primary }]}
                    onPress={() => handleSetFilePriority(file.index, 0)}
                    disabled={loading}
                  >
                    <Text style={[styles.priorityButtonText, { color: file.priority === 0 ? '#FFFFFF' : colors.text }]}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityButton, { backgroundColor: colors.background }, file.priority === 1 && { backgroundColor: colors.primary }]}
                    onPress={() => handleSetFilePriority(file.index, 1)}
                    disabled={loading}
                  >
                    <Text style={[styles.priorityButtonText, { color: file.priority === 1 ? '#FFFFFF' : colors.text }]}>Normal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priorityButton, { backgroundColor: colors.background }, file.priority === 7 && { backgroundColor: colors.primary }]}
                    onPress={() => handleSetFilePriority(file.index, 7)}
                    disabled={loading}
                  >
                    <Text style={[styles.priorityButtonText, { color: file.priority === 7 ? '#FFFFFF' : colors.text }]}>Max</Text>
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

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.background }]}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon?: string; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.surfaceOutline }]}>
      {icon && <Ionicons name={icon as any} size={16} color={colors.textSecondary} style={styles.infoIcon} />}
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}:</Text>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ToggleRow({ icon, label, value, onPress, disabled }: { icon: string; label: string; value: boolean; onPress: () => void; disabled: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.toggleRow, { backgroundColor: colors.background }]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.toggleLeft}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
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

