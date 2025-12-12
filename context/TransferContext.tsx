import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { GlobalTransferInfo } from '../types/api';
import { transferApi } from '../services/api/transfer';
import { useServer } from './ServerContext';

interface TransferContextType {
  transferInfo: GlobalTransferInfo | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleAlternativeSpeedLimits: () => Promise<void>;
  setDownloadLimit: (limit: number) => Promise<void>;
  setUploadLimit: (limit: number) => Promise<void>;
}

const TransferContext = createContext<TransferContextType | undefined>(undefined);

export function TransferProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useServer();
  const [transferInfo, setTransferInfo] = useState<GlobalTransferInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected) {
      setTransferInfo(null);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [info, altSpeedLimitsState] = await Promise.all([
        transferApi.getGlobalTransferInfo(),
        transferApi.getAlternativeSpeedLimitsState().catch(() => false), // Fallback to false if it fails
      ]);
      // Merge the alternative speed limits state into the transfer info
      setTransferInfo({
        ...info,
        use_alt_speed_limits: altSpeedLimitsState,
      });
    } catch (err: any) {
      // Don't log errors if we're not connected - it's expected
      if (isConnected) {
        setError(err.message || 'Failed to load transfer info');
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

  useEffect(() => {
    if (isConnected) {
      refresh();
      
      // Set up polling for real-time updates
      const interval = setInterval(() => {
        if (isConnected) {
          refresh();
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    } else {
      setTransferInfo(null);
      setError(null);
    }
  }, [isConnected, refresh]);

  return (
    <TransferContext.Provider
      value={{
        transferInfo,
        isLoading,
        error,
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

