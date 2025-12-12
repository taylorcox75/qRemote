import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ServerConfig } from '../types/api';
import { ServerManager } from '../services/server-manager';
import { apiClient } from '../services/api/client';

interface ServerContextType {
  currentServer: ServerConfig | null;
  isConnected: boolean;
  isLoading: boolean;
  connectToServer: (server: ServerConfig) => Promise<boolean>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<boolean>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [currentServer, setCurrentServer] = useState<ServerConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCurrentServer();
  }, []);

  const loadCurrentServer = async () => {
    try {
      setIsLoading(true);
      
      // First, try to get the last connected server (if any)
      let server = await ServerManager.getCurrentServer();
      
      // If no last connected server, check if there's exactly one server saved
      // If so, auto-connect to it
      if (!server) {
        const allServers = await ServerManager.getServers();
        if (allServers.length === 1) {
          // Only one server exists, auto-connect to it
          server = allServers[0];
        }
      }
      
      if (server) {
        setCurrentServer(server);
        try {
          const connected = await ServerManager.connectToServer(server);
          setIsConnected(connected);
          if (!connected) {
            // If connection failed, clear the server
            setCurrentServer(null);
            // Ensure API client server is cleared
            apiClient.setServer(null);
          }
        } catch (error: any) {
          // If connection fails, don't set as connected
          setIsConnected(false);
          setCurrentServer(null);
          // Ensure API client server is cleared
          apiClient.setServer(null);
        }
      } else {
        setIsConnected(false);
        // Ensure API client server is cleared
        apiClient.setServer(null);
      }
    } catch (error) {
      setIsConnected(false);
      // Ensure API client server is cleared
      apiClient.setServer(null);
    } finally {
      setIsLoading(false);
    }
  };

  const connectToServer = async (server: ServerConfig): Promise<boolean> => {
    try {
      setIsLoading(true);
      const success = await ServerManager.connectToServer(server);
      if (success) {
        setCurrentServer(server);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
      return success;
    } catch (error) {
      setIsConnected(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      setIsLoading(true);
      await ServerManager.disconnect();
      setCurrentServer(null);
      setIsConnected(false);
    } catch (error) {
      // Ignore disconnect errors
    } finally {
      setIsLoading(false);
    }
  };

  const reconnect = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const success = await ServerManager.reconnect();
      setIsConnected(success);
      return success;
    } catch (error) {
      setIsConnected(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ServerContext.Provider
      value={{
        currentServer,
        isConnected,
        isLoading,
        connectToServer,
        disconnect,
        reconnect,
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

