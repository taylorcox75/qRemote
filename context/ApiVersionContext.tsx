import React, { createContext, useContext, ReactNode } from 'react';
import { apiClient } from '@/services/api/client';
import { ApiFeatures, getApiFeatures } from '@/utils/apiVersion';
import { useServer } from './ServerContext';

interface ApiVersionContextType {
  apiVersion: string | null;
  features: ApiFeatures;
}

const ApiVersionContext = createContext<ApiVersionContextType | undefined>(undefined);

export function ApiVersionProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useServer();

  // Derive directly from isConnected so there's no extra render cycle.
  // By the time isConnected flips true, apiClient.setApiVersion() has already
  // been called inside connectToEndpoint.
  const apiVersion = isConnected ? apiClient.getApiVersion() : null;
  const features = getApiFeatures(apiVersion);

  return (
    <ApiVersionContext.Provider value={{ apiVersion, features }}>
      {children}
    </ApiVersionContext.Provider>
  );
}

export function useApiFeatures(): ApiVersionContextType {
  const ctx = useContext(ApiVersionContext);
  if (!ctx) throw new Error('useApiFeatures must be used within ApiVersionProvider');
  return ctx;
}
