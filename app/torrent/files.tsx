import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useServer } from '../../context/ServerContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { torrentsApi } from '../../services/api/torrents';
import { TorrentFile, FilePriority } from '../../types/api';
import { spacing, borderRadius } from '../../constants/spacing';
import { shadows } from '../../constants/shadows';

interface FileTreeItem {
  type: 'file' | 'folder';
  name: string;
  path: string;
  depth: number;
  file?: TorrentFile;
  fileIndices?: number[]; // For folders, track all file indices
  fileCount?: number;
  size?: number;
  allSelected?: boolean;
  someSelected?: boolean;
}

export default function TorrentFilesScreen() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const router = useRouter();
  const { isConnected } = useServer();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();

  const [files, setFiles] = useState<TorrentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuFile, setMenuFile] = useState<TorrentFile | null>(null);

  useEffect(() => {
    if (hash && isConnected) {
      loadFiles();
    }
  }, [hash, isConnected]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const filesData = await torrentsApi.getTorrentContents(hash);
      setFiles(filesData);
      
      // Collapse all folders by default on initial load
      if (collapsedFolders.size === 0) {
        const folders = new Set<string>();
        filesData.forEach(file => {
          const parts = file.name.split('/');
          for (let i = 0; i < parts.length - 1; i++) {
            folders.add(parts.slice(0, i + 1).join('/'));
          }
        });
        setCollapsedFolders(folders);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load files', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getPriorityLabel = (priority: FilePriority): string => {
    switch (priority) {
      case 0:
        return 'Skip';
      case 1:
        return 'Normal';
      case 6:
        return 'High';
      case 7:
        return 'Maximum';
      default:
        return 'Normal';
    }
  };

  const getPriorityColor = (priority: FilePriority): string => {
    switch (priority) {
      case 0:
        return colors.textSecondary;
      case 1:
        return colors.primary;
      case 6:
        return colors.warning;
      case 7:
        return colors.error;
      default:
        return colors.primary;
    }
  };

  const handleSelectAll = async () => {
    if (updating) return;
    try {
      setUpdating(true);
      const allIndices = files.map(f => f.index);
      await torrentsApi.setFilePriority(hash, allIndices, 1);
      await loadFiles();
      showToast('All files selected for download', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to select all files', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeselectAll = async () => {
    if (updating) return;
    try {
      setUpdating(true);
      const allIndices = files.map(f => f.index);
      await torrentsApi.setFilePriority(hash, allIndices, 0);
      await loadFiles();
      showToast('All files deselected', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to deselect all files', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleFileToggle = async (file: TorrentFile) => {
    if (updating) return;
    try {
      setUpdating(true);
      const newPriority: FilePriority = file.priority === 0 ? 1 : 0;
      await torrentsApi.setFilePriority(hash, [file.index], newPriority);
      await loadFiles();
    } catch (error: any) {
      showToast(error.message || 'Failed to update file', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleFolderToggle = async (folderPath: string, fileIndices: number[]) => {
    if (updating) return;
    try {
      setUpdating(true);
      // Check if all files in folder are selected
      const folderFiles = files.filter(f => fileIndices.includes(f.index));
      const allSelected = folderFiles.every(f => f.priority > 0);
      const newPriority: FilePriority = allSelected ? 0 : 1;
      
      await torrentsApi.setFilePriority(hash, fileIndices, newPriority);
      await loadFiles();
    } catch (error: any) {
      showToast(error.message || 'Failed to update folder', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleFolderExpand = (folderPath: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const showPriorityMenu = (file: TorrentFile) => {
    setMenuFile(file);
    setMenuVisible(true);
  };

  const handleSetPriority = async (priority: FilePriority) => {
    if (!menuFile || updating) return;
    setMenuVisible(false);
    
    try {
      setUpdating(true);
      await torrentsApi.setFilePriority(hash, [menuFile.index], priority);
      await loadFiles();
      showToast(`Priority set to ${getPriorityLabel(priority)}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to set priority', 'error');
    } finally {
      setUpdating(false);
      setMenuFile(null);
    }
  };

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) {
      return 'videocam';
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
      return 'musical-notes';
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
      return 'image';
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
      return 'document-text';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'archive';
    }
    
    return 'document';
  };

  // Build tree structure and flatten for display
  const displayItems = useMemo(() => {
    const items: Array<FileTreeItem & { id: string }> = [];
    const folderMap = new Map<string, { files: TorrentFile[], indices: number[], size: number }>();

    // Group files by folder and track indices
    files.forEach(file => {
      const parts = file.name.split('/');
      
      // Track folders and their file indices
      for (let i = 0; i < parts.length - 1; i++) {
        const folderPath = parts.slice(0, i + 1).join('/');
        if (!folderMap.has(folderPath)) {
          folderMap.set(folderPath, { files: [], indices: [], size: 0 });
        }
        const folder = folderMap.get(folderPath)!;
        if (!folder.indices.includes(file.index)) {
          folder.files.push(file);
          folder.indices.push(file.index);
          folder.size += file.size;
        }
      }
    });

    // Build display list with proper hierarchy
    const addedFolders = new Set<string>();
    
    files.forEach(file => {
      const parts = file.name.split('/');
      const fileName = parts[parts.length - 1];
      const depth = parts.length - 1;

      // Add parent folders first (only direct parent for this file)
      for (let i = 0; i < depth; i++) {
        const folderPath = parts.slice(0, i + 1).join('/');
        const folderName = parts[i];
        
        if (!addedFolders.has(folderPath)) {
          addedFolders.add(folderPath);
          
          // Check if parent is collapsed
          const parentPath = parts.slice(0, i).join('/');
          if (i > 0 && collapsedFolders.has(parentPath)) {
            continue; // Skip if parent is collapsed
          }
          
          const folderData = folderMap.get(folderPath)!;
          const allSelected = folderData.files.every(f => f.priority > 0);
          const someSelected = folderData.files.some(f => f.priority > 0);
          
          items.push({
            id: `folder-${folderPath}`,
            type: 'folder',
            name: folderName,
            path: folderPath,
            depth: i,
            fileCount: folderData.files.length,
            size: folderData.size,
            fileIndices: folderData.indices,
            allSelected,
            someSelected,
          });
        }
      }

      // Add file if parent folders are expanded
      let parentCollapsed = false;
      for (let i = 0; i < depth; i++) {
        const folderPath = parts.slice(0, i + 1).join('/');
        if (collapsedFolders.has(folderPath)) {
          parentCollapsed = true;
          break;
        }
      }

      if (!parentCollapsed) {
        items.push({
          id: `file-${file.index}`,
          type: 'file',
          name: fileName,
          path: file.name,
          depth,
          file,
        });
      }
    });

    return items;
  }, [files, collapsedFolders]);

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

  if (loading && files.length === 0) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Files</Text>
          <View style={styles.placeholder} />
        </View>

        {files.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="folder-open-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No files found</Text>
          </View>
        ) : (
          <>
            {/* Bulk Actions Header */}
            <View style={[styles.bulkActionsHeader, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceOutline }]}>
              <TouchableOpacity
                style={[styles.bulkActionButton, { backgroundColor: colors.primary }]}
                onPress={handleSelectAll}
                disabled={updating}
              >
                <Ionicons name="checkbox-outline" size={18} color="#FFFFFF" />
                <Text style={styles.bulkActionText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkActionButton, { backgroundColor: colors.error }]}
                onPress={handleDeselectAll}
                disabled={updating}
              >
                <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.bulkActionText}>Deselect All</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <Text style={[styles.fileCount, { color: colors.textSecondary }]}>
                {files.filter(f => f.priority > 0).length} / {files.length}
              </Text>
            </View>

            <FlatList
              data={displayItems}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const indent = item.depth * 12;

                if (item.type === 'folder') {
                  const isCollapsed = collapsedFolders.has(item.path);
                  return (
                    <View style={[styles.folderRow, { marginLeft: indent, backgroundColor: colors.surface }]}>
                      <TouchableOpacity
                        style={styles.folderCheckbox}
                        onPress={() => handleFolderToggle(item.path, item.fileIndices!)}
                        disabled={updating}
                      >
                        <Ionicons
                          name={item.allSelected ? 'checkbox' : item.someSelected ? 'remove-outline' : 'square-outline'}
                          size={24}
                          color={item.allSelected || item.someSelected ? colors.primary : colors.textSecondary}
                        />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.folderContent}
                        onPress={() => handleFolderExpand(item.path)}
                      >
                        <Ionicons 
                          name={isCollapsed ? 'chevron-forward' : 'chevron-down'} 
                          size={20} 
                          color={colors.text} 
                        />
                        <Ionicons name="folder" size={20} color={colors.primary} style={{ marginLeft: 8 }} />
                        <View style={styles.folderInfo}>
                          <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[styles.folderMeta, { color: colors.textSecondary }]}>
                            {item.fileCount} files • {formatSize(item.size || 0)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }

                // File row
                const file = item.file!;
                return (
                  <View style={[styles.fileRow, { marginLeft: indent }]}>
                    <TouchableOpacity
                      style={styles.fileCheckbox}
                      onPress={() => handleFileToggle(file)}
                      disabled={updating}
                    >
                      <Ionicons
                        name={file.priority === 0 ? 'square-outline' : 'checkbox'}
                        size={24}
                        color={file.priority === 0 ? colors.textSecondary : colors.primary}
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.fileCard, { backgroundColor: colors.surface }]}
                      onPress={() => showPriorityMenu(file)}
                      disabled={updating}
                    >
                      <View style={styles.fileHeader}>
                        <Ionicons 
                          name={getFileIcon(item.name) as any} 
                          size={20} 
                          color={getPriorityColor(file.priority)} 
                        />
                        <View style={styles.fileInfo}>
                          <Text 
                            style={[
                              styles.fileName, 
                              { color: file.priority === 0 ? colors.textSecondary : colors.text }
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <View style={styles.fileMetadata}>
                            <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                              {formatSize(file.size)}
                            </Text>
                            <Text style={styles.fileSeparator}>•</Text>
                            <Text style={[styles.fileProgress, { color: colors.textSecondary }]}>
                              {(file.progress * 100).toFixed(1)}%
                            </Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.fileFooter}>
                        <View style={[styles.progressBar, { backgroundColor: colors.surfaceOutline }]}>
                          <View 
                            style={[
                              styles.progressFill, 
                              { 
                                width: `${file.progress * 100}%`,
                                backgroundColor: getPriorityColor(file.priority)
                              }
                            ]} 
                          />
                        </View>
                        <View style={[styles.priorityBadge, { backgroundColor: isDark ? colors.surfaceOutline : getPriorityColor(file.priority) + '20' }]}>
                          <Text style={[styles.priorityText, { color: isDark ? colors.text : getPriorityColor(file.priority) }]}>
                            {getPriorityLabel(file.priority)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </>
        )}

        {updating && (
          <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* Custom Priority Menu Modal */}
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          >
            <View
              style={[
                styles.menuContainer,
                {
                  backgroundColor: colors.surface,
                  shadowColor: colors.text,
                },
              ]}
            >
              <Text style={[styles.menuTitle, { color: colors.text }]}>Set Priority</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {menuFile?.name.split('/').pop()}
              </Text>
              
              <TouchableOpacity
                style={[styles.menuOption, { borderBottomColor: colors.surfaceOutline }]}
                onPress={() => handleSetPriority(0)}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                <Text style={[styles.menuOptionText, { color: colors.text }]}>Skip (Don't Download)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.menuOption, { borderBottomColor: colors.surfaceOutline }]}
                onPress={() => handleSetPriority(1)}
              >
                <Ionicons name="play-circle" size={20} color={colors.primary} />
                <Text style={[styles.menuOptionText, { color: colors.text }]}>Normal Priority</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.menuOption, { borderBottomColor: colors.surfaceOutline }]}
                onPress={() => handleSetPriority(6)}
              >
                <Ionicons name="arrow-up-circle" size={20} color={colors.warning} />
                <Text style={[styles.menuOptionText, { color: colors.text }]}>High Priority</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.menuOption, { borderBottomWidth: 0 }]}
                onPress={() => handleSetPriority(7)}
              >
                <Ionicons name="flash-circle" size={20} color={colors.error} />
                <Text style={[styles.menuOptionText, { color: colors.text }]}>Maximum Priority</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: spacing.md,
  },
  bulkActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    gap: spacing.sm,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.medium,
  },
  bulkActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  fileCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    borderRadius: borderRadius.medium,
    ...shadows.small,
  },
  folderCheckbox: {
    padding: 8,
    paddingRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  folderInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  folderName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  folderMeta: {
    fontSize: 11,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  fileCheckbox: {
    padding: 8,
    paddingRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileCard: {
    flex: 1,
    borderRadius: borderRadius.medium,
    padding: spacing.sm,
    ...shadows.small,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  fileInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 3,
  },
  fileMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileSize: {
    fontSize: 11,
  },
  fileSeparator: {
    marginHorizontal: 4,
    color: '#8E8E93',
    fontSize: 11,
  },
  fileProgress: {
    fontSize: 11,
  },
  fileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  priorityBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.small,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  menuContainer: {
    width: '100%',
    maxWidth: 320,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    ...shadows.large,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  menuSubtitle: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    gap: spacing.md,
  },
  menuOptionText: {
    fontSize: 15,
    flex: 1,
  },
});
