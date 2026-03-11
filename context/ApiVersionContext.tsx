import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ApiVersion, parseApiVersion } from '../utils/apiVersion';

const FALLBACK: ApiVersion = { raw: '2.9.0', major: 2, minor: 9, patch: 0 };

interface ApiVersionContextType {
  apiVersion: ApiVersion;
  setApiVersionFromString: (raw: string) => void;
}

const ApiVersionContext = createContext<ApiVersionContextType | undefined>(undefined);

export function ApiVersionProvider({ children }: { children: ReactNode }) {
  const [apiVersion, setApiVersionState] = useState<ApiVersion>(FALLBACK);

  const setApiVersionFromString = (raw: string) => {
    setApiVersionState(parseApiVersion(raw));
  };

  return (
    <ApiVersionContext.Provider value={{ apiVersion, setApiVersionFromString }}>
      {children}
    </ApiVersionContext.Provider>
  );
}

/**
 * Returns the current API version. Falls back to 2.9.0 if not yet set,
 * ensuring v5 users are never degraded and callers never receive null.
 */
export function useApiVersion() {
  const ctx = useContext(ApiVersionContext);
  if (!ctx) {
    return { apiVersion: FALLBACK, setApiVersionFromString: (_: string) => {} };
  }
  return ctx;
}
