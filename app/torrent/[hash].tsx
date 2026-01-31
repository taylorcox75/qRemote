import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useServer } from '../../context/ServerContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { TorrentCard } from '../../components/TorrentCard';
import { torrentsApi } from '../../services/api/torrents';
import {
  TorrentProperties,
  Tracker,
  TorrentFile,
  TorrentInfo,
} from '../../types/api';
import { formatDate } from '../../utils/format';

const { width } = Dimensions.get('window');

export default function TorrentDetail() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { isConnected, isLoading } = useServer();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  
  useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
    });
  }, [navigation]);
  const [torrent, setTorrent] = useState<TorrentInfo | null>(null);
  const [properties, setProperties] = useState<TorrentProperties | null>(null);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [files, setFiles] = useState<TorrentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null);

  useEffect(() => {
    if (hash && isConnected) {
      loadTorrentData();
    }
  }, [hash, isConnected]);

  const loadTorrentData = async () => {
    try {
      setLoading(true);
      const [torrentList, props, trackersData, filesData] = await Promise.all([
        torrentsApi.getTorrentList(undefined, undefined, undefined, undefined, undefined, undefined, undefined, [hash]),
        torrentsApi.getTorrentProperties(hash),
        torrentsApi.getTorrentTrackers(hash),
        torrentsApi.getTorrentContents(hash),
      ]);

      if (torrentList.length > 0) {
        setTorrent(torrentList[0]);
      }
      setProperties(props);
      setTrackers(trackersData);
      setFiles(filesData);
      
      // Return the new torrent data so polling can check it
      return torrentList.length > 0 ? torrentList[0] : null;
    } catch (error: any) {
      showToast(error.message || 'Failed to load torrent details', 'error');
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTorrentData();
  };

  const silentRefresh = async () => {
    // Refresh without showing the pull-down animation
    try {
      const [torrentList, props, trackersData, filesData] = await Promise.all([
        torrentsApi.getTorrentList(undefined, undefined, undefined, undefined, undefined, undefined, undefined, [hash]),
        torrentsApi.getTorrentProperties(hash),
        torrentsApi.getTorrentTrackers(hash),
        torrentsApi.getTorrentContents(hash),
      ]);

      if (torrentList.length > 0) {
        setTorrent(torrentList[0]);
      }
      setProperties(props);
      setTrackers(trackersData);
      setFiles(filesData);
    } catch (error: any) {
      // Silent failure - don't alert user
      console.error('Silent refresh error:', error);
    }
  };

  // Show loading spinner while restoring connection (prevents flash on app launch/resume)
  if (isLoading && !isConnected) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  // Only show "Not Connected" when truly disconnected (not during initial load)
  if (!isConnected) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.text }]}>Not connected to a server</Text>
        </View>
      </>
    );
  }

  if (loading && !torrent) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!torrent) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.text }]}>Torrent not found</Text>
        </View>
      </>
    );
  }

  const getStateColor = (state: string, progress: number): string => {
    // If torrent is 100% complete and stalled UP, show as green (Seeding)
    if (state === 'stalledUP' && progress >= 1) {
      return colors.success;
    }
    
    // Show gray for stoppedUP (it's paused/stopped, not actively seeding)
    if (state === 'stoppedUP') {
      return colors.surfaceOutline;
    }
    
    // Show error color for stalledDL
    if (state === 'stalledDL') {
      return colors.error;
    }
    
    // Show blue color for forcedMetaDL
    if (state === 'forcedMetaDL') {
      return colors.primary;
    }
    
    if (state === 'metaDL') return colors.warning
    if (state.includes('stalled')) return colors.error
    if (state.includes('downloading') || state.includes('forcedDL')) return colors.primary
    if (state.includes('uploading') || state.includes('forcedUP')) return colors.success
    if (state.includes('paused') || state.includes('stopped')) return colors.surfaceOutline
    if (state.includes('error')) return '#FF3B30';
    return '#8E8E93';
  };

  const getStateLabel = (state: string, progress: number): string => {
    // If torrent is 100% complete and stalled UP, show as "Seeding"
    if (state === 'stalledUP' && progress >= 1) {
      return 'Seeding';
    }
    
    // Show "Paused" for stoppedUP state (it's stopped/paused, not actively seeding)
    if (state === 'stoppedUP') {
      return 'Paused';
    }
    
    // Show "Forced Meta" for forcedMetaDL state
    if (state === 'forcedMetaDL') {
      return 'Forced Meta';
    }
    
    if (state.includes('downloading')) return 'Downloading';
    if (state.includes('uploading')) return 'Uploading';
    if (state.includes('paused')) return 'Paused';
    if (state.includes('stopped')) return 'Stopped';
    if (state.includes('stalled')) return 'Stalled';
    if (state.includes('error')) return 'Error';
    if (state.includes('queued')) return 'Queued';
    if (state.includes('checking')) return 'Checking';
    return state;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 0) return '∞';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const progress = (torrent.progress || 0) * 100;
  // Use optimistic state for immediate visual feedback
  const actualIsPaused = torrent.state.includes('paused') || torrent.state.includes('stopped');
  const isPaused = optimisticPaused !== null ? optimisticPaused : actualIsPaused;
  
  // Update state color and label based on optimistic or actual state
  let stateColor = getStateColor(torrent.state, torrent.progress);
  let stateLabel = getStateLabel(torrent.state, torrent.progress);
  
  if (optimisticPaused !== null) {
    if (optimisticPaused) {
      // User just paused - show as paused
      stateColor = colors.surfaceOutline;
      stateLabel = 'Paused';
    } else {
      // User just resumed - show as downloading/uploading
      if (torrent.progress >= 1) {
        stateColor = colors.success;
        stateLabel = 'Seeding';
      } else {
        stateColor = colors.primary;
        stateLabel = 'Downloading';
      }
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    return `${formatSize(bytesPerSecond)}/s`;
  };

  const handlePauseResume = async () => {
    if (actionLoading) return;
    
    // Determine current paused state from actual torrent data
    const currentlyPaused = torrent.state.includes('paused') || torrent.state.includes('stopped');
    const expectedNewState = !currentlyPaused; // What we expect after the action
    
    // Optimistically update the UI immediately
    setOptimisticPaused(expectedNewState);
    setActionLoading(true);
    
    try {
      if (currentlyPaused) {
        await torrentsApi.resumeTorrents([torrent.hash]);
      } else {
        await torrentsApi.pauseTorrents([torrent.hash]);
      }
      
      // Poll until state changes or timeout (max 3 seconds)
      let attempts = 0;
      const maxAttempts = 6; // 6 attempts * 500ms = 3 seconds max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const freshTorrent = await loadTorrentData();
        
        // Check if the state has actually changed
        if (freshTorrent) {
          const newIsPaused = freshTorrent.state.includes('paused') || freshTorrent.state.includes('stopped');
          if (newIsPaused === expectedNewState) {
            // State has changed successfully!
            break;
          }
        }
        attempts++;
      }
      
      setOptimisticPaused(null);
      setActionLoading(false);
    } catch (error: any) {
      // Revert optimistic update on error
      setOptimisticPaused(null);
      showToast(error.message || 'Failed to update torrent', 'error');
      setActionLoading(false);
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
            try {
              await torrentsApi.deleteTorrents([torrent.hash], false);
              showToast('Torrent deleted', 'success');
              router.back();
            } catch (error: any) {
              showToast(error.message || 'Failed to delete torrent', 'error');
            }
          },
        },
        {
          text: 'With Files',
          style: 'destructive',
          onPress: async () => {
            try {
              await torrentsApi.deleteTorrents([torrent.hash], true);
              showToast('Torrent deleted', 'success');
              router.back();
            } catch (error: any) {
              showToast(error.message || 'Failed to delete torrent', 'error');
            }
          },
        },
      ]
    );
  };

  const handleRecheck = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.recheckTorrents([torrent.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to recheck torrent', 'error');
      setActionLoading(false);
    }
  };

  const handleReannounce = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.reannounceTorrents([torrent.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to reannounce torrent', 'error');
      setActionLoading(false);
    }
  };

  const handleForceStart = async () => {
    try {
      setActionLoading(true);
      const isForceStarted = torrent?.force_start || false;
      await torrentsApi.setForceStart([torrent.hash], !isForceStarted);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast(`Force start ${!isForceStarted ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle force start', 'error');
      setActionLoading(false);
    }
  };

  const handleSuperSeeding = async () => {
    try {
      setActionLoading(true);
      const isSuperSeeding = torrent?.super_seeding || false;
      await torrentsApi.setSuperSeeding([torrent.hash], !isSuperSeeding);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast(`Super seeding ${!isSuperSeeding ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle super seeding', 'error');
      setActionLoading(false);
    }
  };

  const handleSequentialDownload = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.toggleSequentialDownload([torrent.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast('Sequential download toggled', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle sequential download', 'error');
      setActionLoading(false);
    }
  };

  const handleFirstLastPiecePriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.setFirstLastPiecePriority([torrent.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast('First/Last piece priority set', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set priority', 'error');
      setActionLoading(false);
    }
  };

  const handleAutomaticManagement = async () => {
    try {
      setActionLoading(true);
      const isAutoManaged = torrent?.auto_tmm || false;
      await torrentsApi.setAutomaticTorrentManagement([torrent.hash], !isAutoManaged);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast(`Automatic management ${!isAutoManaged ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to toggle automatic management', 'error');
      setActionLoading(false);
    }
  };

  const handleIncreasePriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.increasePriority([torrent.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to increase priority', 'error');
      setActionLoading(false);
    }
  };

  const handleDecreasePriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.decreasePriority([torrent.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to decrease priority', 'error');
      setActionLoading(false);
    }
  };

  const handleMaxPriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.setMaximalPriority([torrent.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast('Priority set to maximum', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set priority', 'error');
      setActionLoading(false);
    }
  };

  const handleMinPriority = async () => {
    try {
      setActionLoading(true);
      await torrentsApi.setMinimalPriority([torrent.hash]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await loadTorrentData();
      setActionLoading(false);
      showToast('Priority set to minimum', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set priority', 'error');
      setActionLoading(false);
    }
  };

  const handleSetDownloadLimit = () => {
    Alert.prompt(
      'Set Download Limit',
      'Enter limit in bytes (0 for unlimited)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: async (value: string | undefined) => {
            if (value === undefined || value === null) return;
            try {
              setActionLoading(true);
              const limit = parseInt(value) || 0;
              await torrentsApi.setTorrentDownloadLimit([torrent.hash], limit);
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadTorrentData();
              showToast(`Download limit set to ${limit === 0 ? 'unlimited' : formatSpeed(limit)}`, 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to set download limit', 'error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text',
      properties?.dl_limit?.toString() || '0'
    );
  };

  const handleSetUploadLimit = () => {
    Alert.prompt(
      'Set Upload Limit',
      'Enter limit in bytes (0 for unlimited)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: async (value: string | undefined) => {
            if (value === undefined || value === null) return;
            try {
              setActionLoading(true);
              const limit = parseInt(value) || 0;
              await torrentsApi.setTorrentUploadLimit([torrent.hash], limit);
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadTorrentData();
              showToast(`Upload limit set to ${limit === 0 ? 'unlimited' : formatSpeed(limit)}`, 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to set upload limit', 'error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text',
      properties?.up_limit?.toString() || '0'
    );
  };

  const handleEditTrackers = () => {
    router.push(`/torrent/manage-trackers?hash=${hash}`);
  };

  const handleAddTrackers_OLD = () => {
    Alert.prompt(
      'Add Trackers',
      'Enter tracker URLs (one per line)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async (value: string | undefined) => {
            if (!value || value.trim() === '') return;
            try {
              setActionLoading(true);
              const urls = value.split('\n').filter((url: string) => url.trim() !== '');
              await torrentsApi.addTrackers(torrent.hash, urls);
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadTorrentData();
              showToast(`Added ${urls.length} tracker(s)`, 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to add trackers', 'error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleSetCategory = () => {
    Alert.prompt(
      'Set Category',
      'Enter category name',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: async (value: string | undefined) => {
            if (value === undefined || value === null) return;
            try {
              setActionLoading(true);
              await torrentsApi.setTorrentCategory([torrent.hash], value.trim() || '');
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadTorrentData();
              showToast(`Category set to ${value.trim() || 'None'}`, 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to set category', 'error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text',
      torrent.category || ''
    );
  };

  const handleAddTags = () => {
    Alert.prompt(
      'Add Tags',
      'Enter tags (comma-separated)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async (value: string | undefined) => {
            if (!value || value.trim() === '') return;
            try {
              setActionLoading(true);
              const tags = value.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag !== '');
              await torrentsApi.addTorrentTags([torrent.hash], tags);
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadTorrentData();
              showToast(`Added ${tags.length} tag(s)`, 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to add tags', 'error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleRemoveTags = () => {
    Alert.prompt(
      'Remove Tags',
      'Enter tags to remove (comma-separated)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async (value: string | undefined) => {
            if (!value || value.trim() === '') return;
            try {
              setActionLoading(true);
              const tags = value.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag !== '');
              await torrentsApi.removeTorrentTags([torrent.hash], tags);
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadTorrentData();
              showToast(`Removed ${tags.length} tag(s)`, 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to remove tags', 'error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleSetLocation = () => {
    Alert.prompt(
      'Set Location',
      'Enter new save path',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: async (value: string | undefined) => {
            if (!value || value.trim() === '') return;
            try {
              setActionLoading(true);
              await torrentsApi.setTorrentLocation([torrent.hash], value.trim());
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadTorrentData();
              showToast('Location updated', 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to set location', 'error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text',
      properties?.save_path || ''
    );
  };

  const handleRenameTorrent = () => {
    Alert.prompt(
      'Rename Torrent',
      'Enter new name',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rename',
          onPress: async (value: string | undefined) => {
            if (!value || value.trim() === '') return;
            try {
              setActionLoading(true);
              await torrentsApi.setTorrentName(torrent.hash, value.trim());
              await new Promise(resolve => setTimeout(resolve, 500));
              await loadTorrentData();
              showToast('Torrent renamed', 'success');
            } catch (error: any) {
              showToast(error.message || 'Failed to rename torrent', 'error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text',
      torrent.name
    );
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {/* Top Card - Using TorrentCard component in expanded view mode */}
          <TorrentCard 
            torrent={torrent}
            viewMode="expanded"
            onPress={() => {}} 
          />

          {/* Quick Tools Section - Moved to top */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Tools</Text>
            <View style={styles.quickToolsGrid}>
          <TouchableOpacity
                style={[styles.quickToolButton, { backgroundColor: colors.primary, opacity: 0.75 }]}
                onPress={handlePauseResume}
                disabled={actionLoading}
          >
            <Ionicons
                  name={isPaused ? 'play' : 'pause'} 
              size={20}
                  color="#FFFFFF" 
            />
                <Text style={styles.quickToolText}>
                  {isPaused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
                style={[styles.quickToolButton, { backgroundColor: '#FF3B30', opacity: 0.75 }]}
                onPress={handleDelete}
                disabled={actionLoading}
          >
                <Ionicons name="trash" size={20} color="#FFFFFF" />
                <Text style={styles.quickToolText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickToolButton, { backgroundColor: colors.primary, opacity: 0.75 }]}
                onPress={handleRecheck}
                disabled={actionLoading}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.quickToolText}>Recheck</Text>
          </TouchableOpacity>
          <TouchableOpacity
                style={[styles.quickToolButton, { backgroundColor: colors.primary, opacity: 0.75 }]}
                onPress={handleReannounce}
                disabled={actionLoading}
          >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.quickToolText}>Reannounce</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickToolButton, { backgroundColor: '#5856D6', opacity: 0.75 }]}
                onPress={() => router.push(`/torrent/files?hash=${hash}`)}
                disabled={actionLoading}
              >
                <Ionicons name="folder-open" size={20} color="#FFFFFF" />
                <Text style={styles.quickToolText}>Files</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* General Info Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>General Info</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Size</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatSize(torrent.total_size > 0 ? torrent.total_size : torrent.size)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Downloaded</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatSize(torrent.downloaded)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Uploaded</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatSize(torrent.uploaded)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Ratio</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {torrent.ratio ? torrent.ratio.toFixed(2) : '0.00'}
                </Text>
              </View>
              {properties && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Save Path</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
                      {properties.save_path}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Category</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {torrent.category || 'None'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Tags</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {torrent.tags || 'None'}
              </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Details Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Seeds</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {torrent.num_seeds || 0} / {torrent.num_complete || 0}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Peers</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {torrent.num_leechs || 0} / {torrent.num_incomplete || 0}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Availability</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {torrent.availability ? torrent.availability.toFixed(2) : '0.00'}
                </Text>
              </View>
              {properties && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Created</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {formatDate(properties.creation_date)}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Added</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {formatDate(torrent.added_on)}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Completed</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {formatDate(torrent.completion_on)}
                    </Text>
                  </View>
                </>
              )}
          </View>
        </View>

          {/* Stats Section */}
          {properties && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Stats</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Total Downloaded</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {formatSize(properties.total_downloaded)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Total Uploaded</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {formatSize(properties.total_uploaded)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Download Limit</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {properties.dl_limit > 0 ? formatSpeed(properties.dl_limit) : 'Unlimited'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Upload Limit</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {properties.up_limit > 0 ? formatSpeed(properties.up_limit) : 'Unlimited'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Share Ratio</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {properties.share_ratio ? properties.share_ratio.toFixed(2) : '0.00'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Advanced Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Advanced</Text>
            <View style={styles.advancedToolsGrid}>
              {/* Priority Controls */}
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: colors.primary, opacity: 0.75 }]}
                onPress={handleForceStart}
                disabled={actionLoading}
              >
                <Ionicons name="flash" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>
                  {torrent?.force_start ? 'Force Start ON' : 'Force Start'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: colors.primary, opacity: 0.75 }]}
                onPress={handleSuperSeeding}
                disabled={actionLoading}
              >
                <Ionicons name="rocket" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>
                  {torrent?.super_seeding ? 'Super Seed ON' : 'Super Seed'}
            </Text>
          </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: colors.primary, opacity: 0.75 }]}
                onPress={handleSequentialDownload}
                disabled={actionLoading}
              >
                <Ionicons name="list" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Sequential DL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: colors.primary, opacity: 0.75 }]}
                onPress={handleFirstLastPiecePriority}
                disabled={actionLoading}
              >
                <Ionicons name="star" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>First/Last Priority</Text>
              </TouchableOpacity>
        

              {/* Priority */}
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#34C759', opacity: 0.75 }]}
                onPress={handleIncreasePriority}
                disabled={actionLoading}
              >
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>↑ Priority</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#FF9500', opacity: 0.75 }]}
                onPress={handleDecreasePriority}
                disabled={actionLoading}
              >
                <Ionicons name="arrow-down" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>↓ Priority</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#34C759', opacity: 0.75 }]}
                onPress={handleMaxPriority}
                disabled={actionLoading}
              >
                <Ionicons name="arrow-up-circle" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Max Priority</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#FF9500', opacity: 0.75 }]}
                onPress={handleMinPriority}
                disabled={actionLoading}
              >
                <Ionicons name="arrow-down-circle" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Min Priority</Text>
              </TouchableOpacity>

              {/* Limits */}
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#5856D6', opacity: 0.75 }]}
                onPress={handleSetDownloadLimit}
                disabled={actionLoading}
              >
                <Ionicons name="download" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>DL Limit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#5856D6', opacity: 0.75 }]}
                onPress={handleSetUploadLimit}
                disabled={actionLoading}
              >
                <Ionicons name="arrow-up-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>UL Limit</Text>
              </TouchableOpacity>

              {/* Trackers & Metadata */}
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#AF52DE', opacity: 0.75 }]}
                onPress={handleEditTrackers}
                disabled={actionLoading}
              >
                <Ionicons name="create" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Edit Trackers</Text>
              </TouchableOpacity>

              {/* Category & Tags */}
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#5AC8FA', opacity: 0.75 }]}
                onPress={handleSetCategory}
                disabled={actionLoading}
              >
                <Ionicons name="folder" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Set Category</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#5AC8FA', opacity: 0.75 }]}
                onPress={handleAddTags}
                disabled={actionLoading}
              >
                <Ionicons name="pricetag" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Add Tags</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#5AC8FA', opacity: 0.75 }]}
                onPress={handleRemoveTags}
                disabled={actionLoading}
              >
                <Ionicons name="pricetag-outline" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Remove Tags</Text>
              </TouchableOpacity>

              {/* Location & Rename */}
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#8E8E93', opacity: 0.75 }]}
                onPress={handleSetLocation}
                disabled={actionLoading}
              >
                <Ionicons name="folder-open" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Set Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedToolButton, { backgroundColor: '#8E8E93', opacity: 0.75 }]}
                onPress={handleRenameTorrent}
                disabled={actionLoading}
              >
                <Ionicons name="create" size={18} color="#FFFFFF" />
                <Text style={styles.advancedToolText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 0.2,
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 6,
    paddingBottom: 12,
    gap: 6,
  },
  topCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  stateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 16,
  },
  playPauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoGrid: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  quickToolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  quickToolButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  quickToolText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  advancedToolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  advancedToolButton: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  advancedToolText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    // paddingBottom: 100,
    // marginBottom: 100,
    maxHeight: '30%',

    // padding: 20,
    paddingTop: 200,
  },
  modalContent: {
    width: '90%',
    borderRadius: 16,
    padding: 12,
    // paddingBottom: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    fontSize: 14,
    // marginBottom: 16,
    // lineHeight: 20,
  },
  trackersInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    // fontSize: 14,
    minHeight: 150,
    // maxHeight: 400,
    marginBottom: 16,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'red',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'red',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  modalSaveButton: {
    // Primary color applied inline
  },
});

