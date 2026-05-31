import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ServerConfig, ServerEndpointKind } from '@/types/api';
import { ServerManager } from '@/services/server-manager';
import { apiClient } from '@/services/api/client';
import { storageService } from '@/services/storage';
import { getActiveEndpoint } from '@/utils/server';

interface ServerContextType {
  currentServer: ServerConfig | null;
  isConnected: boolean;
  isLoading: boolean;
  /**
   * Which endpoint of `currentServer` is currently active in `apiClient`.
   * Null when not connected or when the server has no fallback configured
   * and the endpoint is unambiguous (callers can treat null as "primary").
   */
  activeEndpoint: ServerEndpointKind | null;
  connectToServer: (server: ServerConfig) => Promise<boolean>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<boolean>;
  checkAndReconnect: () => Promise<boolean>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [currentServer, setCurrentServer] = useState<ServerConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<ServerEndpointKind | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  // Derive the active endpoint from the server config + the endpoint the
  // apiClient ended up on after a (re)connect. Called from each connection
  // flow rather than via subscription because apiClient doesn't emit events.
  const refreshActiveEndpoint = useCallback((server: ServerConfig | null, connected: boolean) => {
    if (!server || !connected) {
      setActiveEndpoint(null);
      return;
    }
    setActiveEndpoint(getActiveEndpoint(server, apiClient.getServer()));
  }, []);

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
            refreshActiveEndpoint(server, connected);
            if (!connected) {
              setCurrentServer(null);
              apiClient.setServer(null);
            }
          } catch {
            setIsConnected(false);
            setActiveEndpoint(null);
            setCurrentServer(null);
            apiClient.setServer(null);
          }
        } else {
          setIsConnected(false);
          setActiveEndpoint(null);
          apiClient.setServer(null);
        }
      } catch {
        setIsConnected(false);
        setActiveEndpoint(null);
        apiClient.setServer(null);
      } finally {
        setInitLoading(false);
      }
    }
    autoConnect();
  }, [refreshActiveEndpoint]);

  const connectMutation = useMutation({
    mutationFn: (server: ServerConfig) => ServerManager.connectToServer(server),
    onSuccess: (success: boolean, server: ServerConfig) => {
      if (success) {
        setCurrentServer(server);
        setIsConnected(true);
        refreshActiveEndpoint(server, true);
      } else {
        setIsConnected(false);
        setActiveEndpoint(null);
      }
    },
    onError: () => {
      setIsConnected(false);
      setActiveEndpoint(null);
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
      setActiveEndpoint(null);
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
      refreshActiveEndpoint(currentServer, success);
      return success;
    } catch {
      setIsConnected(false);
      setActiveEndpoint(null);
      return false;
    } finally {
      setReconnecting(false);
    }
  }, [currentServer, refreshActiveEndpoint]);

  const checkAndReconnect = useCallback(async (): Promise<boolean> => {
    if (!currentServer) {
      setIsConnected(false);
      setActiveEndpoint(null);
      return false;
    }

    try {
      const success = await ServerManager.reconnect();
      setIsConnected(success);
      refreshActiveEndpoint(currentServer, success);
      return success;
    } catch {
      try {
        const reconnected = await ServerManager.connectToServer(currentServer);
        setIsConnected(reconnected);
        refreshActiveEndpoint(currentServer, reconnected);
        return reconnected;
      } catch {
        setIsConnected(false);
        setActiveEndpoint(null);
        return false;
      }
    }
  }, [currentServer, refreshActiveEndpoint]);

  const isLoading =
    initLoading || connectMutation.isPending || disconnectMutation.isPending || reconnecting;

  return (
    <ServerContext.Provider
      value={{
        currentServer,
        isConnected,
        isLoading,
        activeEndpoint,
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
