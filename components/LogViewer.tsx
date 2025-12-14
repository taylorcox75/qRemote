import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { logStorage, StoredLogEntry } from '../services/log-storage';
import { spacing, borderRadius } from '../constants/spacing';
import { shadows } from '../constants/shadows';
import { typography } from '../constants/typography';

interface LogViewerProps {
  visible: boolean;
  onClose: () => void;
  onClear?: () => void;
  refreshTrigger?: number; // Trigger reload when this changes
}

export function LogViewer({ visible, onClose, onClear, refreshTrigger }: LogViewerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<StoredLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      // Small delay to ensure logs are stored before loading
      const timer = setTimeout(() => {
        loadLogs();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Don't clear logs when modal closes - keep them in storage
    }
  }, [visible, refreshTrigger]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const storedLogs = await logStorage.getLogs();
      console.log('Loaded logs from storage:', storedLogs.length);
      if (storedLogs && storedLogs.length > 0) {
        setLogs(storedLogs.sort((a, b) => b.id - a.id));
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await logStorage.clearLogs();
      // Clear logs from state immediately - don't reload
      setLogs([]);
      if (onClear) {
        onClear();
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
      // Even if there's an error, try to clear the UI
      setLogs([]);
    }
  };

  const getLogTypeColor = (type: number): string => {
    switch (type) {
      case 1:
        return colors.textSecondary; // Normal
      case 2:
        return '#FF9500'; // Warning
      case 4:
        return colors.error; // Critical
      default:
        return colors.primary; // Info
    }
  };

  const getLogTypeLabel = (type: number): string => {
    switch (type) {
      case 1:
        return 'Normal';
      case 2:
        return 'Warning';
      case 4:
        return 'Critical';
      default:
        return 'Info';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.surfaceOutline, backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.text }]}>Logs</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={handleClear}
                style={[styles.clearButton, { backgroundColor: colors.error }]}
                disabled={logs.length === 0}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Logs Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No logs available</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Logs are automatically cleared after 5 minutes or on app launch
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              {logs.map((log) => (
                <View key={log.id} style={[styles.logEntry, { borderLeftColor: getLogTypeColor(log.type) }]}>
                  <View style={styles.logHeader}>
                    <View style={[styles.logTypeBadge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.logTypeText, { color: colors.surface }]}>
                        {getLogTypeLabel(log.type)}
                      </Text>
                    </View>
                    <Text style={[styles.logTimestamp, { color: colors.textSecondary }]}>
                      {formatTimestamp(log.timestamp)}
                    </Text>
                  </View>
                  <Text style={[styles.logMessage, { color: colors.text }]}>{log.message}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 800,
    height: '90%',
    maxHeight: '90%',
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    ...shadows.card,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  title: {
    ...typography.h2,
    fontSize: 24,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.small,
  },
  clearButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.bodyMedium,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.bodyMedium,
    fontSize: 14,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  logEntry: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.small,
    borderLeftWidth: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  logTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.small,
  },
  logTypeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  logTimestamp: {
    ...typography.caption,
    fontSize: 12,
  },
  logMessage: {
    ...typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
});

