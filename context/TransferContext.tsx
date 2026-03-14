import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlobalTransferInfo } from '@/types/api';
import { transferApi } from '@/services/api/transfer';
import { useServer } from './ServerContext';
import { getErrorMessage } from '@/utils/error';

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

async function fetchTransferInfo(): Promise<GlobalTransferInfo> {
  const [info, altSpeedLimitsState] = await Promise.all([
    transferApi.getGlobalTransferInfo(),
    transferApi.getAlternativeSpeedLimitsState().catch(() => false),
  ]);
  return {
    ...info,
    use_alt_speed_limits: altSpeedLimitsState,
  };
}

export function TransferProvider({ children }: { children: ReactNode }) {
  const { isConnected, checkAndReconnect } = useServer();
  const queryClient = useQueryClient();

  const appStateRef = useRef(AppState.currentState);
  const lastActiveTime = useRef(Date.now());
  const [isRecoveringState, setIsRecoveringState] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const {
    data: transferData,
    isLoading: queryIsLoading,
    error: queryError,
    dataUpdatedAt,
  } = useQuery<GlobalTransferInfo>({
    queryKey: ['transfer'],
    queryFn: fetchTransferInfo,
    refetchInterval: 3000,
    enabled: isConnected,
  });

  // Clear mutation errors and recovery state after each successful fetch
  useEffect(() => {
    if (dataUpdatedAt > 0) {
      setMutationError(null);
      setIsRecoveringState(false);
    }
  }, [dataUpdatedAt]);

  // Remove cached data when disconnected
  useEffect(() => {
    if (!isConnected) {
      queryClient.removeQueries({ queryKey: ['transfer'] });
      setMutationError(null);
    }
  }, [isConnected, queryClient]);

  // AppState handler: pause awareness in background, recover on foreground
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState === 'background' && nextState === 'active') {
        const timeInBackground = Date.now() - lastActiveTime.current;
        lastActiveTime.current = Date.now();

        if (isConnected) {
          setIsRecoveringState(true);
          setMutationError(null);

          if (timeInBackground > 30000) {
            await checkAndReconnect();
          }

          await queryClient.invalidateQueries({ queryKey: ['transfer'] });
          setIsRecoveringState(false);
        }
      } else if (nextState === 'background') {
        lastActiveTime.current = Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isConnected, checkAndReconnect, queryClient]);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    await queryClient.invalidateQueries({ queryKey: ['transfer'] });
  }, [isConnected, queryClient]);

  const toggleAlternativeSpeedLimits = useCallback(async () => {
    if (!isConnected) return;
    try {
      await transferApi.toggleAlternativeSpeedLimits();
      await queryClient.invalidateQueries({ queryKey: ['transfer'] });
    } catch (err: unknown) {
      setMutationError(getErrorMessage(err));
    }
  }, [isConnected, queryClient]);

  const setDownloadLimit = useCallback(async (limit: number) => {
    if (!isConnected) return;
    try {
      await transferApi.setGlobalDownloadLimit(limit);
      await queryClient.invalidateQueries({ queryKey: ['transfer'] });
    } catch (err: unknown) {
      setMutationError(getErrorMessage(err));
    }
  }, [isConnected, queryClient]);

  const setUploadLimit = useCallback(async (limit: number) => {
    if (!isConnected) return;
    try {
      await transferApi.setGlobalUploadLimit(limit);
      await queryClient.invalidateQueries({ queryKey: ['transfer'] });
    } catch (err: unknown) {
      setMutationError(getErrorMessage(err));
    }
  }, [isConnected, queryClient]);

  const transferInfo = isConnected ? (transferData ?? null) : null;
  const error = mutationError
    ?? (isRecoveringState ? null : queryError ? getErrorMessage(queryError) : null);

  return (
    <TransferContext.Provider
      value={{
        transferInfo,
        isLoading: queryIsLoading,
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
