import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GlobalTransferInfo } from '../types/api';
import { transferApi } from '../services/api/transfer';
import { useServer } from './ServerContext';

interface TransferContextType {
  transferInfo: GlobalTransferInfo | null;
  isLoading: boolean;
  error: string | null;
  isRecoveringFromBackground: boolean;
  refresh: () => Promise<void>;
  toggleAlternativeSpeedLimits: () => Promise<void>;
  setDownloadLimit: (limit: number) => Promise<void>;
  setUploadLimit: (limit: number) => Promise<void>;
}

const TransferContext = createContext<TransferContextType | undefined>(undefined);

// Consecutive failures before showing error to the user — suppresses brief blips
const FAILURE_THRESHOLD = 3;

export function TransferProvider({ children }: { children: ReactNode }) {
  const { isConnected, checkAndReconnect } = useServer();
  const [transferInfo, setTransferInfo] = useState<GlobalTransferInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastActiveTime = useRef(Date.now());
  const isRecovering = useRef(false);
  const consecutiveFailures = useRef(0);

  // State-backed version so consumers re-render when recovery starts/ends
  const [isRecoveringState, setIsRecoveringState] = useState(false);

  const setRecovering = useCallback((val: boolean) => {
    isRecovering.current = val;
    setIsRecoveringState(val);
  }, []);

  const refresh = useCallback(async () => {
    if (!isConnected) {
      setTransferInfo(null);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      const [info, altSpeedLimitsState] = await Promise.all([
        transferApi.getGlobalTransferInfo(),
        transferApi.getAlternativeSpeedLimitsState().catch(() => false),
      ]);
      setTransferInfo({
        ...info,
        use_alt_speed_limits: altSpeedLimitsState,
      });
      // Clear error and reset counters on success
      setError(null);
      consecutiveFailures.current = 0;
      setRecovering(false);
    } catch (err: any) {
      if (isConnected && !isRecovering.current) {
        consecutiveFailures.current += 1;
        // Only surface the error after sustained failures to suppress transient blips
        if (consecutiveFailures.current >= FAILURE_THRESHOLD) {
          setError(err.message || 'Failed to load transfer info');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const toggleAlternativeSpeedLimits = useCallback(async () => {
    if (!isConnected) return;
    try {
      await transferApi.toggleAlternativeSpeedLimits();
      await refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle speed limits');
    }
  }, [isConnected, refresh]);

  const setDownloadLimit = useCallback(async (limit: number) => {
    if (!isConnected) return;
    try {
      await transferApi.setGlobalDownloadLimit(limit);
      await refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to set download limit');
    }
  }, [isConnected, refresh]);

  const setUploadLimit = useCallback(async (limit: number) => {
    if (!isConnected) return;
    try {
      await transferApi.setGlobalUploadLimit(limit);
      await refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to set upload limit');
    }
  }, [isConnected, refresh]);

  // Main polling — uses intervalRef so the AppState handler can stop/start it independently
  useEffect(() => {
    if (isConnected) {
      consecutiveFailures.current = 0;
      refresh();
      intervalRef.current = setInterval(refresh, 3000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      setTransferInfo(null);
      setError(null);
      consecutiveFailures.current = 0;
    }
  }, [isConnected]); // intentionally excludes refresh — interval captures latest via closure

  // AppState handler: mirrors TorrentContext's background/foreground recovery
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState === 'background' && nextState === 'active') {
        const timeInBackground = Date.now() - lastActiveTime.current;
        lastActiveTime.current = Date.now();

        if (isConnected) {
          // Suppress errors while recovering; clear stale error immediately
          setRecovering(true);
          consecutiveFailures.current = 0;
          setError(null);

          if (timeInBackground > 30000) {
            // Connection may be stale — attempt silent reconnect before resuming
            await checkAndReconnect();
          }

          // Restart polling interval
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(refresh, 3000);

          // Immediate refresh; recovery flag cleared on first success inside refresh()
          await refresh();
          // Ensure flag is cleared even if refresh didn't succeed
          setRecovering(false);
        }
      } else if (nextState === 'background') {
        lastActiveTime.current = Date.now();
        // Pause polling in background to avoid accumulating failures
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isConnected, checkAndReconnect, refresh]);

  return (
    <TransferContext.Provider
      value={{
        transferInfo,
        isLoading,
        error,
        isRecoveringFromBackground: isRecoveringState,
        refresh,
        toggleAlternativeSpeedLimits,
        setDownloadLimit,
        setUploadLimit,
      }}
    >
      {children}
    </TransferContext.Provider>
  );
}

export function useTransfer() {
  const context = useContext(TransferContext);
  if (context === undefined) {
    throw new Error('useTransfer must be used within a TransferProvider');
  }
  return context;
}

