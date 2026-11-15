import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { ServerConfig, ServerEndpointKind } from '@/types/api';
import { ServerManager, isConnectSuperseded } from '@/services/server-manager';
import { apiClient } from '@/services/api/client';
import { storageService } from '@/services/storage';
import { getActiveEndpoint } from '@/utils/server';
import { resolveConnectionSettings } from '@/utils/connection-settings';
import { clogInfo, clogWarn } from '@/services/connectivity-log';

interface ServerContextType {
  currentServer: ServerConfig | null;
  isConnected: boolean;
  isLoading: boolean;
  /**
   * True only while a connect attempt (connectToServer) is in flight — unlike
   * `isLoading`, this excludes disconnects, so a disconnect still falls
   * through to the "Not Connected" screen instead of showing the skeleton.
   */
  isConnecting: boolean;
  /**
   * Which endpoint of `currentServer` is currently active in `apiClient`.
   * Null when not connected or when the server has no fallback configured
   * and the endpoint is unambiguous (callers can treat null as "primary").
   */
  activeEndpoint: ServerEndpointKind | null;
  /**
   * When the current connection was established, for a client-side "session
   * length" display (#232) — qBittorrent's own server_state has no uptime or
   * session-duration field, so this tracks the app's own connection instead.
   * Null while disconnected.
   */
  connectedAt: Date | null;
  /**
   * True while checkAndReconnect() (the reactive, error-driven auto-reconnect
   * path) is in flight. Deliberately separate from `isConnecting` — that
   * flag also covers a *manual* reconnect() and feeds `isLoading`, both of
   * which are consumed in places that shouldn't change behavior for an
   * automatic background recovery. Lets UI (e.g. the torrents list, torrent
   * detail) show a soft "reconnecting" placeholder instead of stale data or
   * a hard auth error during the window before an automatic reconnect
   * resolves.
   */
  isReconnecting: boolean;
  connectToServer: (server: ServerConfig) => Promise<boolean>;
  disconnect: () => Promise<void>;
  /** Drop the remembered last server (e.g. after it was deleted). */
  forgetCurrentServer: () => void;
  /**
   * Replace the remembered server's config after it was edited, so one-tap
   * Connect (Settings hub) doesn't retry with the pre-edit host/credentials.
   * No-op when the edited server isn't the remembered one.
   */
  updateCurrentServer: (server: ServerConfig) => void;
  reconnect: () => Promise<boolean>;
  checkAndReconnect: () => Promise<boolean>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [currentServer, setCurrentServer] = useState<ServerConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<ServerEndpointKind | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Tracks the current connection's start time from isConnected transitions
  // rather than from each individual setIsConnected call site, so every
  // connect path (initial connect, reconnect, checkAndReconnect) is covered
  // by one source of truth.
  useEffect(() => {
    setConnectedAt((prev) => (isConnected ? (prev ?? new Date()) : null));
  }, [isConnected]);

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

  // Bumped by every user-driven change of connection (connect, disconnect,
  // forgetting the server). Each background flow — startup auto-connect,
  // reconnect(), checkAndReconnect()'s run — captures it when it starts and
  // stops touching state (or retrying) once it moves: a newer action owns
  // the connection now, and a stale run setting isConnected would flip the
  // UI back to a server the user just left or disconnected from.
  const connectionEpochRef = useRef(0);

  useEffect(() => {
    async function autoConnect() {
      const epoch = connectionEpochRef.current;
      const superseded = () => epoch !== connectionEpochRef.current;
      try {
        const prefs = await storageService.getPreferences();
        // Apply connection settings before the first connect attempt fires.
        // RootLayout also applies these from the same preferences, but its
        // effect runs after this provider's (child effects fire before a
        // parent's on mount) — without this, the very first cold-launch
        // connect always uses apiClient's built-in defaults instead of the
        // user's configured timeout/retry count.
        apiClient.updateSettings(resolveConnectionSettings(prefs));
        const autoConnectLastServer = prefs.autoConnectLastServer !== false;
        const manualDisconnect = await storageService.getManualDisconnect();

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

        if (superseded()) {
          // The user connected or disconnected while startup was still
          // reading storage — their choice wins.
          return;
        }

        if (server && manualDisconnect) {
          // The user explicitly disconnected last session. Keep the server
          // remembered so Settings can offer one-tap Connect, but stay
          // offline until the user connects again.
          clogInfo('CONN', 'Skipping startup auto-connect — user disconnected last session');
          setCurrentServer(server);
          setIsConnected(false);
          setActiveEndpoint(null);
        } else if (server) {
          setCurrentServer(server);
          try {
            const connected = await ServerManager.connectToServer(server);
            if (superseded()) return;
            setIsConnected(connected);
            refreshActiveEndpoint(server, connected);
            // Keep currentServer even on failure so Settings can offer Connect.
            if (!connected) {
              setIsConnected(false);
            }
          } catch {
            if (superseded()) return;
            setIsConnected(false);
            setActiveEndpoint(null);
            // Keep currentServer so the user can retry from Settings.
          }
        } else {
          setIsConnected(false);
          setActiveEndpoint(null);
          if (apiClient.getServer()) {
            clogInfo('CONN', 'No saved server to auto-connect to at startup — clearing API client');
            apiClient.setServer(null);
          }
        }
      } catch {
        if (superseded()) return;
        setIsConnected(false);
        setActiveEndpoint(null);
        if (apiClient.getServer()) {
          clogWarn('CONN', 'Startup auto-connect failed unexpectedly — clearing API client');
          apiClient.setServer(null);
        }
      } finally {
        setInitLoading(false);
      }
    }
    autoConnect();
  }, [refreshActiveEndpoint]);

  // The epoch of the connect currently in flight (null when none), so
  // reconnect()/checkAndReconnect() can no-op instead of racing it. An epoch
  // rather than a boolean so a superseded connect settling late can't clear
  // the flag out from under the newer one.
  const connectInFlightEpochRef = useRef<number | null>(null);

  // Multiple independent consumers (TorrentContext, useSearchJob) each call
  // checkAndReconnect on their own AppState foreground listener, all firing
  // off the same OS event. Without de-duping, two concurrent reconnect
  // attempts race each other's login/cookie-refresh flow — one can see the
  // other's in-progress state as a failure, flipping isConnected to false for
  // a moment even though the session was actually fine, which then trips
  // anything that clears state on disconnect (e.g. an active search job).
  // Sharing one in-flight promise across callers avoids that — but only for
  // callers reconnecting the *same* server: the promise is keyed by server id
  // so a caller that shows up after a server switch starts its own run
  // instead of being handed a stale promise whose closure would report
  // isConnected/activeEndpoint for the wrong server.
  const checkAndReconnectPromiseRef = useRef<{ id: string; promise: Promise<boolean> } | null>(
    null,
  );
  /** Identifies the latest checkAndReconnect run, which owns isReconnecting. */
  const reconnectRunRef = useRef(0);

  const connectMutation = useMutation({
    mutationFn: (server: ServerConfig) => ServerManager.connectToServer(server),
    onMutate: () => {
      const epoch = ++connectionEpochRef.current;
      connectInFlightEpochRef.current = epoch;
      // Drop the current connection state (and with it, every consumer's
      // poll — e.g. TorrentContext's rid-sync) *before* the new server's
      // login runs. Otherwise the old server's poll keeps firing through the
      // switch, apiClient.setServer(newServer) clears its cookie for the new
      // host, and a poll tick lands unauthenticated and 403s — which the
      // shared 403 handler treats as a real auth failure and wipes the new
      // server's just-issued session cookie right out from under it.
      setIsConnected(false);
      setActiveEndpoint(null);
      // A reconnect/checkAndReconnect that was already in flight when this
      // connect started is now stale — let it finish harmlessly rather than
      // having it clobber the connect we're about to run.
      checkAndReconnectPromiseRef.current = null;
      return { epoch };
    },
    onSuccess: (success: boolean, server: ServerConfig, context) => {
      if (context?.epoch !== connectionEpochRef.current) return;
      if (success) {
        setCurrentServer(server);
        setIsConnected(true);
        refreshActiveEndpoint(server, true);
      } else {
        setIsConnected(false);
        setActiveEndpoint(null);
      }
    },
    onError: (_error, _server, context) => {
      if (context?.epoch !== connectionEpochRef.current) return;
      setIsConnected(false);
      setActiveEndpoint(null);
    },
    onSettled: (_data, _error, _server, context) => {
      if (connectInFlightEpochRef.current === context?.epoch) {
        connectInFlightEpochRef.current = null;
      }
    },
  });

  const connectToServer = async (server: ServerConfig): Promise<boolean> => {
    const success = await connectMutation.mutateAsync(server);
    return success;
  };

  const disconnectMutation = useMutation({
    onMutate: () => {
      // Supersede any connect or reconnect still in flight so it can't flip
      // isConnected back on after the user disconnected.
      connectionEpochRef.current++;
      connectInFlightEpochRef.current = null;
      checkAndReconnectPromiseRef.current = null;
    },
    mutationFn: async () => {
      try {
        await ServerManager.disconnect();
      } catch {
        // Best-effort — ignore disconnect errors (same as original)
      }
    },
    onSuccess: () => {
      // Keep currentServer so Settings can show it with a Connect action.
      setIsConnected(false);
      setActiveEndpoint(null);
      checkAndReconnectPromiseRef.current = null;
    },
  });

  const disconnect = async () => {
    await disconnectMutation.mutateAsync();
  };

  const forgetCurrentServer = useCallback(() => {
    connectionEpochRef.current++;
    setCurrentServer(null);
    setIsConnected(false);
    setActiveEndpoint(null);
    checkAndReconnectPromiseRef.current = null;
  }, []);

  const updateCurrentServer = useCallback((server: ServerConfig) => {
    setCurrentServer((prev) => (prev && prev.id === server.id ? server : prev));
  }, []);

  const reconnect = useCallback(async (): Promise<boolean> => {
    // A connect is already establishing a session — let it finish rather
    // than racing it with a second login against the same or a different
    // server (see connectMutation.onMutate for the failure this avoids).
    if (connectInFlightEpochRef.current !== null) {
      return false;
    }
    const epoch = connectionEpochRef.current;
    try {
      setReconnecting(true);
      const success = await ServerManager.reconnect(currentServer ?? undefined);
      if (epoch !== connectionEpochRef.current) return false;
      setIsConnected(success);
      refreshActiveEndpoint(currentServer, success);
      return success;
    } catch {
      if (epoch !== connectionEpochRef.current) return false;
      setIsConnected(false);
      setActiveEndpoint(null);
      return false;
    } finally {
      setReconnecting(false);
    }
  }, [currentServer, refreshActiveEndpoint]);

  const checkAndReconnect = useCallback((): Promise<boolean> => {
    if (connectInFlightEpochRef.current !== null) {
      return Promise.resolve(false);
    }

    const cached = checkAndReconnectPromiseRef.current;
    if (cached && cached.id === currentServer?.id) {
      return cached.promise;
    }

    // Once a connect, disconnect or forget has happened since this run
    // started, it must neither retry nor set state: a stale retry would
    // re-login to the server the user just left (aborting the new connect's
    // login) or reconnect after a manual disconnect.
    const epoch = connectionEpochRef.current;
    const superseded = () => epoch !== connectionEpochRef.current;
    const runToken = ++reconnectRunRef.current;

    const run = async (): Promise<boolean> => {
      setIsReconnecting(true);
      if (!currentServer) {
        setIsConnected(false);
        setActiveEndpoint(null);
        return false;
      }

      try {
        const success = await ServerManager.reconnect(currentServer);
        if (superseded()) return false;
        setIsConnected(success);
        refreshActiveEndpoint(currentServer, success);
        return success;
      } catch (error: unknown) {
        if (superseded() || isConnectSuperseded(error)) return false;
        try {
          const reconnected = await ServerManager.connectToServer(currentServer);
          if (superseded()) return false;
          setIsConnected(reconnected);
          refreshActiveEndpoint(currentServer, reconnected);
          return reconnected;
        } catch (retryError: unknown) {
          if (superseded() || isConnectSuperseded(retryError)) return false;
          setIsConnected(false);
          setActiveEndpoint(null);
          return false;
        }
      }
    };

    const id = currentServer?.id;
    const promise = run().finally(() => {
      // A later run owns the flag if one started after this one.
      if (reconnectRunRef.current === runToken) {
        setIsReconnecting(false);
      }
      if (checkAndReconnectPromiseRef.current?.promise === promise) {
        checkAndReconnectPromiseRef.current = null;
      }
    });
    if (id) {
      checkAndReconnectPromiseRef.current = { id, promise };
    }
    return promise;
  }, [currentServer, refreshActiveEndpoint]);

  const isLoading =
    initLoading || connectMutation.isPending || disconnectMutation.isPending || reconnecting;
  const isConnecting = connectMutation.isPending || reconnecting;

  return (
    <ServerContext.Provider
      value={{
        currentServer,
        isConnected,
        connectedAt,
        isLoading,
        isConnecting,
        isReconnecting,
        activeEndpoint,
        connectToServer,
        disconnect,
        forgetCurrentServer,
        updateCurrentServer,
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
