import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { torrentsApi } from '../../services/api/torrents';
import { Tracker } from '../../types/api';
import { spacing, borderRadius } from '../../constants/spacing';
import { shadows } from '../../constants/shadows';
import { buttonStyles, buttonText } from '../../constants/buttons';
import { typography } from '../../constants/typography';

export default function ManageTrackersScreen() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTracker, setAddingTracker] = useState(false);
  const [newTrackerUrl, setNewTrackerUrl] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [editingTracker, setEditingTracker] = useState<Tracker | null>(null);
  const [editTrackerUrl, setEditTrackerUrl] = useState('');
  const [reannouncing, setReannouncing] = useState(false);

  useEffect(() => {
    fetchTrackers();
  }, []);

  const fetchTrackers = async () => {
    if (!hash) return;
    try {
      setLoading(true);
      const trackersData = await torrentsApi.getTorrentTrackers(hash);
      // Filter out DHT, PEX, LSD entries
      const realTrackers = trackersData.filter(
        t => t.url && !t.url.includes('**') && !t.url.includes('DHT') && 
             !t.url.includes('PEX') && !t.url.includes('LSD')
      );
      setTrackers(realTrackers);
    } catch (error: any) {
      showToast(error.message || 'Failed to fetch trackers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTracker = async (tracker: Tracker) => {
    try {
      await torrentsApi.removeTrackers(hash!, [tracker.url]);
      fetchTrackers();
      showToast('Tracker removed', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to remove tracker', 'error');
    }
  };

  const handleAddTracker = async () => {
    if (!newTrackerUrl.trim()) {
      showToast('Please enter a tracker URL', 'error');
      return;
    }

    try {
      setAddingTracker(true);
      await torrentsApi.addTrackers(hash!, [newTrackerUrl.trim()]);
      setNewTrackerUrl('');
      setShowAddInput(false);
      fetchTrackers();
      showToast('Tracker added', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to add tracker', 'error');
    } finally {
      setAddingTracker(false);
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 2: return 'Working';
      case 3: return 'Updating';
      case 0: return 'Disabled';
      default: return 'Not contacted';
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 2: return colors.success;
      case 3: return colors.primary;
      case 0: return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const handleCopyTracker = async (tracker: Tracker) => {
    await Clipboard.setStringAsync(tracker.url);
    showToast('Tracker URL copied to clipboard', 'success');
  };

  const handleEditTracker = (tracker: Tracker) => {
    setEditingTracker(tracker);
    setEditTrackerUrl(tracker.url);
  };

  const handleSaveEditedTracker = async () => {
    if (!editTrackerUrl.trim() || !editingTracker) {
      showToast('Please enter a tracker URL', 'error');
      return;
    }

    try {
      setAddingTracker(true);
      // Remove old tracker
      await torrentsApi.removeTrackers(hash!, [editingTracker.url]);
      // Add new tracker
      await torrentsApi.addTrackers(hash!, [editTrackerUrl.trim()]);
      setEditingTracker(null);
      setEditTrackerUrl('');
      fetchTrackers();
      showToast('Tracker updated', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update tracker', 'error');
    } finally {
      setAddingTracker(false);
    }
  };

  const showTrackerMenu = (tracker: Tracker) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Copy URL', 'Edit', 'Delete'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleCopyTracker(tracker);
          } else if (buttonIndex === 2) {
            handleEditTracker(tracker);
          } else if (buttonIndex === 3) {
            handleRemoveTracker(tracker);
          }
        }
      );
    } else {
      // On Android, show menu options inline or use a different approach
      // For now, just handle actions directly without confirmation dialog
      handleEditTracker(tracker);
    }
  };

  const handleReannounceAll = async () => {
    if (!hash) return;
    try {
      setReannouncing(true);
      await torrentsApi.reannounceTorrents([hash]);
      showToast('Tracker reannounce sent', 'success');
      fetchTrackers();
    } catch (error: any) {
      showToast(error.message || 'Failed to reannounce', 'error');
    } finally {
      setReannouncing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceOutline }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text 
          style={[styles.headerTitle, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          Manage Trackers
        </Text>
        <TouchableOpacity
          style={[styles.reannounceButton, { 
            backgroundColor: reannouncing ? colors.primary : 'transparent',
            borderColor: reannouncing ? colors.primary : colors.textSecondary,
          }]}
          onPress={handleReannounceAll}
          disabled={reannouncing}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {reannouncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="megaphone" size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Add New Tracker - At Top */}
          {showAddInput ? (
            <View style={[styles.addTrackerCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.addTrackerLabel, { color: colors.text }]}>
                New Tracker URL
              </Text>
              <TextInput
                style={[styles.addTrackerInput, { 
                  backgroundColor: colors.background, 
                  color: colors.text,
                  borderColor: colors.surfaceOutline 
                }]}
                value={newTrackerUrl}
                onChangeText={setNewTrackerUrl}
                placeholder="https://tracker.example.com/announce"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <View style={styles.addTrackerButtons}>
                <TouchableOpacity
                  style={[styles.addTrackerButton, { backgroundColor: colors.background }]}
                  onPress={() => {
                    setShowAddInput(false);
                    setNewTrackerUrl('');
                  }}
                >
                  <Text 
                    style={[styles.addTrackerButtonText, { color: colors.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addTrackerButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddTracker}
                  disabled={addingTracker}
                >
                  {addingTracker ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text 
                      style={[styles.addTrackerButtonText, { color: '#FFFFFF' }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      Add
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddInput(true)}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text 
                style={styles.addButtonText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Add New Tracker
              </Text>
            </TouchableOpacity>
          )}

          {/* Edit Tracker */}
          {editingTracker && (
            <View style={[styles.addTrackerCard, { backgroundColor: colors.surface, marginTop: 12 }]}>
              <Text style={[styles.addTrackerLabel, { color: colors.text }]}>
                Edit Tracker URL
              </Text>
              <TextInput
                style={[styles.addTrackerInput, { 
                  backgroundColor: colors.background, 
                  color: colors.text,
                  borderColor: colors.surfaceOutline 
                }]}
                value={editTrackerUrl}
                onChangeText={setEditTrackerUrl}
                placeholder="https://tracker.example.com/announce"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <View style={styles.addTrackerButtons}>
                <TouchableOpacity
                  style={[styles.addTrackerButton, { backgroundColor: colors.background }]}
                  onPress={() => {
                    setEditingTracker(null);
                    setEditTrackerUrl('');
                  }}
                >
                  <Text 
                    style={[styles.addTrackerButtonText, { color: colors.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addTrackerButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveEditedTracker}
                  disabled={addingTracker}
                >
                  {addingTracker ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text 
                      style={[styles.addTrackerButtonText, { color: '#FFFFFF' }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Trackers List */}
          {trackers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="globe-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No trackers</Text>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 8, marginLeft: 4 }]}>
                Existing Trackers ({trackers.length})
              </Text>
              {trackers.map((tracker, index) => (
                <View 
                  key={index} 
                  style={[styles.trackerRow, { backgroundColor: colors.surface }]}
                >
                  <View style={styles.trackerInfo}>
                    <Text style={[styles.trackerUrl, { color: colors.text }]} numberOfLines={2}>
                      {tracker.url}
                    </Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(tracker.status) }]} />
                      <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                        {getStatusText(tracker.status)}
                      </Text>
                    </View>
                    {tracker.msg && (
                      <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={1}>
                        {tracker.msg}
                      </Text>
                    )}
                  </View>
                  <View style={styles.trackerActions}>
                    <TouchableOpacity
                      style={styles.trackerActionButton}
                      onPress={() => handleCopyTracker(tracker)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="copy-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.trackerActionButton}
                      onPress={() => handleEditTracker(tracker)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="create-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.trackerActionButton}
                      onPress={() => handleRemoveTracker(tracker)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h4,
  },
  reannounceButton: {
    ...buttonStyles.icon,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    ...typography.body,
    marginTop: spacing.md,
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  trackerInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  trackerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trackerActionButton: {
    padding: spacing.xs,
  },
  trackerUrl: {
    ...typography.smallMedium,
    marginBottom: spacing.xs + 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs + 2,
  },
  statusText: {
    ...typography.caption,
  },
  errorText: {
    ...typography.label,
    marginTop: spacing.xs,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    ...buttonStyles.primary,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButtonText: {
    ...buttonText.primary,
  },
  sectionTitle: {
    ...typography.label,
  },
  addTrackerCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.medium,
    marginTop: spacing.sm,
    ...shadows.card,
  },
  addTrackerLabel: {
    ...typography.smallSemibold,
    marginBottom: spacing.sm,
  },
  addTrackerInput: {
    borderWidth: 0.5,
    borderRadius: borderRadius.small,
    padding: spacing.md,
    ...typography.small,
    marginBottom: spacing.md,
  },
  addTrackerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addTrackerButton: {
    ...buttonStyles.primary,
    flex: 1,
  },
  addTrackerButtonText: {
    ...buttonText.primary,
  },
});

