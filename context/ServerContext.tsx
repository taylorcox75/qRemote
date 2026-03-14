import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ServerConfig } from '@/types/api';
import { ServerManager } from '@/services/server-manager';
import { apiClient } from '@/services/api/client';
import { storageService } from '@/services/storage';

interface ServerContextType {
  currentServer: ServerConfig | null;
  isConnected: boolean;
  isLoading: boolean;
  connectToServer: (server: ServerConfig) => Promise<boolean>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<boolean>;
  checkAndReconnect: () => Promise<boolean>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [currentServer, setCurrentServer] = useState<ServerConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    async function autoConnect() {
      try {
        const prefs = await storageService.getPreferences();
        const autoConnectLastServer = prefs.autoConnectLastServer !== false;

        let server: ServerConfig | null = null;

        if (autoConnectLastServer) {
          server = await ServerManager.getCurrentServer();
        }

        if (!server) {
          const allServers = await ServerManager.getServers();
          if (allServers.length === 1) {
            server = allServers[0];
          }
        }

        if (server) {
          setCurrentServer(server);
          try {
            const connected = await ServerManager.connectToServer(server);
            setIsConnected(connected);
            if (!connected) {
              setCurrentServer(null);
              apiClient.setServer(null);
            }
          } catch {
            setIsConnected(false);
            setCurrentServer(null);
            apiClient.setServer(null);
          }
        } else {
          setIsConnected(false);
          apiClient.setServer(null);
        }
      } catch {
        setIsConnected(false);
        apiClient.setServer(null);
      } finally {
        setInitLoading(false);
      }
    }
    autoConnect();
  }, []);

  const connectMutation = useMutation({
    mutationFn: (server: ServerConfig) => ServerManager.connectToServer(server),
    onSuccess: (success: boolean, server: ServerConfig) => {
      if (success) {
        setCurrentServer(server);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    },
    onError: () => {
      setIsConnected(false);
    },
  });

  const connectToServer = async (server: ServerConfig): Promise<boolean> => {
    const success = await connectMutation.mutateAsync(server);
    return success;
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      try {
        await ServerManager.disconnect();
      } catch {
        // Best-effort — ignore disconnect errors (same as original)
      }
    },
    onSuccess: () => {
      setCurrentServer(null);
      setIsConnected(false);
    },
  });

  const disconnect = async () => {
    await disconnectMutation.mutateAsync();
  };

  const reconnect = useCallback(async (): Promise<boolean> => {
    try {
      setReconnecting(true);
      const success = await ServerManager.reconnect();
      setIsConnected(success);
      return success;
    } catch {
      setIsConnected(false);
      return false;
    } finally {
      setReconnecting(false);
    }
  }, []);

  const checkAndReconnect = useCallback(async (): Promise<boolean> => {
    if (!currentServer) {
      setIsConnected(false);
      return false;
    }

    try {
      const success = await ServerManager.reconnect();
      setIsConnected(success);
      return success;
    } catch {
      try {
        const reconnected = await ServerManager.connectToServer(currentServer);
        setIsConnected(reconnected);
        return reconnected;
      } catch {
        setIsConnected(false);
        return false;
      }
    }
  }, [currentServer]);

  const isLoading =
    initLoading || connectMutation.isPending || disconnectMutation.isPending || reconnecting;

  return (
    <ServerContext.Provider
      value={{
        currentServer,
        isConnected,
        isLoading,
        connectToServer,
        disconnect,
        reconnect,
        checkAndReconnect,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const context = useContext(ServerContext);
  if (context === undefined) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return context;
}
