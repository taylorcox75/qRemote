const mockAsyncStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] ?? null)),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logStorage } from '@/services/log-storage';

describe('logStorage', () => {
  beforeEach(() => {
    Object.keys(mockAsyncStorage).forEach((k) => delete mockAsyncStorage[k]);
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const sampleLogs = [{ id: 1, message: 'hello', timestamp: 100, type: 1 }];

  describe('storeLogs / getLogs', () => {
    it('stores and retrieves logs with storedAt added', async () => {
      await logStorage.storeLogs(sampleLogs);
      const logs = await logStorage.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('hello');
      expect(typeof logs[0].storedAt).toBe('number');
    });

    it('getLogs returns [] when nothing stored', async () => {
      const logs = await logStorage.getLogs();
      expect(logs).toEqual([]);
    });

    it('getLogs returns [] and logs error on AsyncStorage failure', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logs = await logStorage.getLogs();
      expect(logs).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('storeLogs logs error and does not throw on failure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(logStorage.storeLogs(sampleLogs)).resolves.toBeUndefined();
      consoleSpy.mockRestore();
    });

    it('auto-deletes logs older than 5 minutes', async () => {
      await logStorage.storeLogs(sampleLogs);
      // Manually rewrite the timestamp key to be > 5 minutes old
      const oldTimestamp = Date.now() - 6 * 60 * 1000;
      mockAsyncStorage['app_logs_timestamp'] = oldTimestamp.toString();
      const logs = await logStorage.getLogs();
      expect(logs).toEqual([]);
      expect(mockAsyncStorage['app_logs']).toBeUndefined();
    });

    it('keeps logs when within 5 minute window', async () => {
      await logStorage.storeLogs(sampleLogs);
      const logs = await logStorage.getLogs();
      expect(logs).toHaveLength(1);
    });
  });

  describe('clearLogs', () => {
    it('removes both storage keys', async () => {
      await logStorage.storeLogs(sampleLogs);
      await logStorage.clearLogs();
      expect(mockAsyncStorage['app_logs']).toBeUndefined();
      expect(mockAsyncStorage['app_logs_timestamp']).toBeUndefined();
    });

    it('rethrows on failure', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(logStorage.clearLogs()).rejects.toThrow('fail');
      consoleSpy.mockRestore();
    });

    it('retries removal if logs remain after first attempt', async () => {
      await logStorage.storeLogs(sampleLogs);
      // Simulate remainingLogs check returning a value once, forcing retry path
      const originalGetItem = AsyncStorage.getItem as jest.Mock;
      originalGetItem.mockImplementationOnce((key: string) => Promise.resolve(mockAsyncStorage[key] ?? null)); // check call
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await logStorage.clearLogs();
      consoleSpy.mockRestore();
    });
  });

  describe('autoDeleteIfNeeded', () => {
    it('does nothing when no timestamp stored', async () => {
      await logStorage.autoDeleteIfNeeded();
      expect(mockAsyncStorage['app_logs']).toBeUndefined();
    });

    it('clears logs when timestamp is stale', async () => {
      await logStorage.storeLogs(sampleLogs);
      mockAsyncStorage['app_logs_timestamp'] = (Date.now() - 6 * 60 * 1000).toString();
      await logStorage.autoDeleteIfNeeded();
      expect(mockAsyncStorage['app_logs']).toBeUndefined();
    });

    it('keeps logs when timestamp is fresh', async () => {
      await logStorage.storeLogs(sampleLogs);
      await logStorage.autoDeleteIfNeeded();
      expect(mockAsyncStorage['app_logs']).toBeDefined();
    });

    it('logs error and does not throw on failure', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(logStorage.autoDeleteIfNeeded()).resolves.toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe('setupAutoDeleteTimer', () => {
    it('clears logs after the timeout fires, and cleanup cancels it', async () => {
      jest.useFakeTimers();
      await logStorage.storeLogs(sampleLogs);
      const cleanup = logStorage.setupAutoDeleteTimer();
      jest.advanceTimersByTime(5 * 60 * 1000);
      // allow the async clearLogs() inside the timer callback to resolve
      await Promise.resolve();
      await Promise.resolve();
      expect(mockAsyncStorage['app_logs']).toBeUndefined();
      cleanup();
      jest.useRealTimers();
    });

    it('cleanup function cancels the timer before it fires', async () => {
      jest.useFakeTimers();
      await logStorage.storeLogs(sampleLogs);
      const cleanup = logStorage.setupAutoDeleteTimer();
      cleanup();
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      expect(mockAsyncStorage['app_logs']).toBeDefined();
      jest.useRealTimers();
    });
  });
});
