import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_STORAGE_KEY = 'app_logs';
const LOG_TIMESTAMP_KEY = 'app_logs_timestamp';
const LOG_AUTO_DELETE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export interface StoredLogEntry {
  id: number;
  message: string;
  timestamp: number;
  type: number;
  storedAt: number; // When this log was stored locally
}

export const logStorage = {
  /**
   * Store logs locally
   */
  async storeLogs(logs: Array<{ id: number; message: string; timestamp: number; type: number }>): Promise<void> {
    try {
      const now = Date.now();
      const logsWithTimestamp: StoredLogEntry[] = logs.map(log => ({
        ...log,
        storedAt: now,
      }));
      
      await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logsWithTimestamp));
      await AsyncStorage.setItem(LOG_TIMESTAMP_KEY, now.toString());
    } catch (error) {
      console.error('Failed to store logs:', error);
    }
  },

  /**
   * Get stored logs
   */
  async getLogs(): Promise<StoredLogEntry[]> {
    try {
      const logsJson = await AsyncStorage.getItem(LOG_STORAGE_KEY);
      if (!logsJson) return [];
      
      const logs: StoredLogEntry[] = JSON.parse(logsJson);
      
      // Check if logs should be auto-deleted (older than 5 minutes)
      const timestampJson = await AsyncStorage.getItem(LOG_TIMESTAMP_KEY);
      if (timestampJson) {
        const storedTimestamp = parseInt(timestampJson, 10);
        const now = Date.now();
        if (now - storedTimestamp > LOG_AUTO_DELETE_DURATION) {
          // Auto-delete old logs
          await this.clearLogs();
          return [];
        }
      }
      
      return logs;
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  },

  /**
   * Clear all stored logs
   */
  async clearLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LOG_STORAGE_KEY);
      await AsyncStorage.removeItem(LOG_TIMESTAMP_KEY);
      // Verify logs are actually cleared
      const remainingLogs = await AsyncStorage.getItem(LOG_STORAGE_KEY);
      if (remainingLogs) {
        console.warn('Logs were not fully cleared, retrying...');
        await AsyncStorage.removeItem(LOG_STORAGE_KEY);
        await AsyncStorage.removeItem(LOG_TIMESTAMP_KEY);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw error; // Re-throw so caller knows it failed
    }
  },

  /**
   * Check and auto-delete logs on app launch or after 5 minutes
   */
  async autoDeleteIfNeeded(): Promise<void> {
    try {
      const timestampJson = await AsyncStorage.getItem(LOG_TIMESTAMP_KEY);
      if (!timestampJson) return;
      
      const storedTimestamp = parseInt(timestampJson, 10);
      const now = Date.now();
      
      if (now - storedTimestamp > LOG_AUTO_DELETE_DURATION) {
        await this.clearLogs();
      }
    } catch (error) {
      console.error('Failed to auto-delete logs:', error);
    }
  },

  /**
   * Set up auto-deletion timer for 5 minutes
   */
  setupAutoDeleteTimer(): () => void {
    const timer = setTimeout(async () => {
      await this.clearLogs();
    }, LOG_AUTO_DELETE_DURATION);
    
    // Return cleanup function
    return () => clearTimeout(timer);
  },
};

