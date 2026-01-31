import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useServer } from '../../context/ServerContext';
import { useTorrents } from '../../context/TorrentContext';
import { useTheme } from '../../context/ThemeContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { logsApi } from '../../services/api/logs';
import { LogEntry, PeerLogEntry } from '../../types/api';

export default function LogsScreen() {
  const { isConnected, currentServer, isLoading: serverIsLoading } = useServer();
  const { initialLoadComplete } = useTorrents();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'app' | 'peer'>('app');
  const [appLogs, setAppLogs] = useState<LogEntry[]>([]);
  const [peerLogs, setPeerLogs] = useState<PeerLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastAppLogId, setLastAppLogId] = useState<number | undefined>(undefined);
  const [lastPeerLogId, setLastPeerLogId] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    normal: true,
    info: true,
    warning: true,
    critical: true,
  });

  useEffect(() => {
    if (isConnected) {
      loadLogs();
    }
  }, [isConnected, activeTab, filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      if (activeTab === 'app') {
        const logs = await logsApi.getLog(
          filters.normal,
          filters.info,
          filters.warning,
          filters.critical,
          lastAppLogId
        );
        if (logs.length > 0) {
          setAppLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLogs = logs.filter((l) => !existingIds.has(l.id));
            return [...prev, ...newLogs].sort((a, b) => b.id - a.id);
          });
          setLastAppLogId(logs[0]?.id);
        }
      } else {
        const logs = await logsApi.getPeerLog(lastPeerLogId);
        if (logs.length > 0) {
          setPeerLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLogs = logs.filter((l) => !existingIds.has(l.id));
            return [...prev, ...newLogs].sort((a, b) => b.id - a.id);
          });
          setLastPeerLogId(logs[0]?.id);
        }
      }
    } catch (error) {
      // Ignore log loading errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'app') {
      setAppLogs([]);
      setLastAppLogId(undefined);
    } else {
      setPeerLogs([]);
      setLastPeerLogId(undefined);
    }
    await loadLogs();
  };

  const getLogTypeColor = (type: number): string => {
    switch (type) {
      case 1:
        return '#007AFF'; // Normal
      case 2:
        return '#FF9500'; // Warning
      case 4:
        return '#FF3B30'; // Critical
      default:
        return '#8E8E93';
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
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Filter logs based on search query
  const filteredAppLogs = useMemo(() => {
    if (!searchQuery.trim()) return appLogs;
    const query = searchQuery.toLowerCase();
    return appLogs.filter(log => 
      log.message.toLowerCase().includes(query)
    );
  }, [appLogs, searchQuery]);

  const filteredPeerLogs = useMemo(() => {
    if (!searchQuery.trim()) return peerLogs;
    const query = searchQuery.toLowerCase();
    return peerLogs.filter(log => 
      log.ip.toLowerCase().includes(query) ||
      log.client.toLowerCase().includes(query)
    );
  }, [peerLogs, searchQuery]);

  // Only show "Not Connected" screen if no server is configured (check FIRST)
  if (!isConnected && !currentServer && !serverIsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Text style={[styles.message, { color: colors.text }]}>Not connected to a server</Text>
        <Text style={[styles.subMessage, { color: colors.textSecondary }]}>
          Go to Settings to connect to a qBittorrent server
        </Text>
      </View>
    );
  }

  // Show loading screen during initial app launch (server connecting or first data fetch)
  if (!initialLoadComplete && (serverIsLoading || !isConnected)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.subMessage, { color: colors.textSecondary, marginTop: 16 }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceOutline }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'app' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('app')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'app' ? colors.primary : colors.textSecondary },
              activeTab === 'app' && { fontWeight: '600' },
            ]}
          >
            Application Logs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'peer' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('peer')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'peer' ? colors.primary : colors.textSecondary },
              activeTab === 'peer' && { fontWeight: '600' },
            ]}
          >
            Peer Logs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.background }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search logs..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {activeTab === 'app' && (
        <View style={[styles.filters, { backgroundColor: colors.surface }]}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Filter:</Text>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: filters.normal ? colors.primary : colors.background },
            ]}
            onPress={() => setFilters({ ...filters, normal: !filters.normal })}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: filters.normal ? '#FFFFFF' : colors.text },
              ]}
            >
              Normal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: filters.info ? colors.primary : colors.background },
            ]}
            onPress={() => setFilters({ ...filters, info: !filters.info })}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: filters.info ? '#FFFFFF' : colors.text },
              ]}
            >
              Info
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: filters.warning ? colors.warning : colors.background },
            ]}
            onPress={() => setFilters({ ...filters, warning: !filters.warning })}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: filters.warning ? '#FFFFFF' : colors.text },
              ]}
            >
              Warning
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: filters.critical ? colors.error : colors.background },
            ]}
            onPress={() =>
              setFilters({ ...filters, critical: !filters.critical })
            }
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: filters.critical ? '#FFFFFF' : colors.text },
              ]}
            >
              Critical
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {loading && appLogs.length === 0 && peerLogs.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : activeTab === 'app' ? (
          filteredAppLogs.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {searchQuery ? 'No logs match your search' : 'No logs available'}
              </Text>
            </View>
          ) : (
            filteredAppLogs.map((log) => (
              <View key={log.id} style={[styles.logItem, { backgroundColor: colors.surface }]}>
                <View style={styles.logHeader}>
                  <View
                    style={[
                      styles.logTypeBadge,
                      { backgroundColor: getLogTypeColor(log.type) },
                    ]}
                  >
                    <Text style={styles.logTypeText}>
                      {getLogTypeLabel(log.type)}
                    </Text>
                  </View>
                  <Text style={[styles.logTimestamp, { color: colors.textSecondary }]}>
                    {formatTimestamp(log.timestamp)}
                  </Text>
                </View>
                <Text style={[styles.logMessage, { color: colors.text }]}>{log.message}</Text>
              </View>
            ))
          )
        ) : filteredPeerLogs.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {searchQuery ? 'No peer logs match your search' : 'No peer logs available'}
            </Text>
          </View>
        ) : (
          filteredPeerLogs.map((log) => (
            <View key={log.id} style={[styles.logItem, { backgroundColor: colors.surface }]}>
              <View style={styles.logHeader}>
                <Text style={[styles.logIp, { color: colors.text }]}>{log.ip}:{log.port}</Text>
                <Text style={[styles.logTimestamp, { color: colors.textSecondary }]}>
                  {formatTimestamp(log.id)}
                </Text>
              </View>
              <Text style={[styles.logMessage, { color: colors.text }]}>Client: {log.client}</Text>
              <Text style={[styles.logMessage, { color: colors.text }]}>Connection: {log.connection}</Text>
              <Text style={[styles.logMessage, { color: colors.text }]}>Flags: {log.flags}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: '#8E8E93',
  },
  subMessage: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  searchContainer: {
    padding: 12,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filters: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 12,
    paddingTop: 4,
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  logItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 8,
    borderRadius: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 16,
  },
  logTypeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  logTimestamp: {
    fontSize: 11,
    color: '#8E8E93',
  },
  logMessage: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  logIp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
});

