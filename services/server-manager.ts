/**
 * server-manager.ts — Server CRUD, connection lifecycle, and auto-reconnect logic.
 *
 * Key exports: ServerManager, isNetworkError
 * Known issues: isNetworkError was duplicated inline 3× (deduplicated in Task 1.6).
 */
import { AxiosError } from 'axios';
import { ServerConfig, ServerEndpointKind } from '@/types/api';
import { hasFallback, resolveServerEndpoint } from '@/utils/server';
import { getServerAuthMode } from '@/utils/authMode';
import { buildServerExport, ServerExportFile } from '@/utils/server-export';
import { storageService } from './storage';
import { apiClient } from './api/client';
import { authApi } from './api/auth';
import { applicationApi } from './api/application';
import { clogInfo, clogWarn, clogError } from './connectivity-log';
import { setInsecureCertAllowedHosts } from '@/modules/insecure-cert-allowlist';

/**
 * Pushes every host opted into `allowInsecureCert` to the native TLS
 * allowlist (see modules/insecure-cert-allowlist). Called after every read
 * or write of the server list so the native side never lags behind a toggle
 * change before the next connection attempt.
 */
function syncInsecureCertAllowlist(servers: ServerConfig[]): void {
  const hosts = servers
    .filter((s) => s.allowInsecureCert)
    .flatMap((s) => [s.host, s.fallbackHost])
    .filter((h): h is string => !!h);
  setInsecureCertAllowedHosts(hosts);
}

/**
 * Per-endpoint outcome from a connection test. Used to surface granular
 * primary/fallback feedback in the UI without forcing every caller to handle
 * a richer shape — the simple primary-only servers still see a single result.
 */
export interface EndpointTestResult {
  success: boolean;
  error?: string;
}

export interface ConnectionTestResult extends EndpointTestResult {
  /** When fallback was attempted, the per-endpoint outcomes. */
  primary?: EndpointTestResult;
  fallback?: EndpointTestResult;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return (
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ETIMEDOUT' ||
      (error.response?.status ?? 0) >= 500 ||
      error.message.includes('timeout') ||
      error.message.includes('Connection') ||
      error.message.includes('Network')
    );
  }
  if (error instanceof Error) {
    return (
      error.message.includes('timeout') ||
      error.message.includes('Connection') ||
      error.message.includes('Network')
    );
  }
  return false;
}

export class ServerManager {
  /**
   * Add or update a server
   */
  static async saveServer(server: ServerConfig): Promise<void> {
    await storageService.saveServer(server);
    syncInsecureCertAllowlist(await storageService.getServers());
  }

  /**
   * Get all saved servers
   */
  static async getServers(): Promise<ServerConfig[]> {
    const servers = await storageService.getServers();
    syncInsecureCertAllowlist(servers);
    return servers;
  }

  /**
   * Get server by ID
   */
  static async getServer(id: string): Promise<ServerConfig | null> {
    return await storageService.getServer(id);
  }

  /**
   * Delete a server
   */
  static async deleteServer(id: string): Promise<void> {
    const currentServer = apiClient.getServer();
    if (currentServer?.id === id) {
      // Disconnect from this server
      clogInfo(
        'CONN',
        `Deleting currently-connected server ${currentServer.host}:${currentServer.port || 'default'} — clearing API client`,
      );
      apiClient.setServer(null);
      await storageService.setCurrentServerId(null);
      // The remembered "user disconnected" state belonged to this server;
      // don't let it suppress auto-connect for a different server later.
      await storageService.setManualDisconnect(false);
    }
    await storageService.deleteServer(id);
    syncInsecureCertAllowlist(await storageService.getServers());
  }

  /**
   * Build a shareable export of every saved server, with all secrets
   * (password, proxy Basic Auth password, API key) stripped — see
   * utils/server-export.ts.
   */
  static async exportServers(): Promise<ServerExportFile> {
    const servers = await storageService.getServers();
    return buildServerExport(servers);
  }

  /**
   * Merge imported server configs (already parsed + validated by
   * utils/server-export.ts parseServerImport) into the saved list.
   *
   * An imported entry whose id matches an existing server updates that
   * server's connection settings but KEEPS the secrets already stored on
   * this device — imports never carry secrets, and overwriting SecureStore
   * with the import's empty strings would silently wipe working credentials
   * on a re-import. New entries are added with empty secrets for the user
   * to fill in.
   */
  static async importServers(
    imported: ServerConfig[],
  ): Promise<{ added: number; updated: number }> {
    const existing = await storageService.getServers();
    const existingById = new Map(existing.map((server) => [server.id, server]));

    let added = 0;
    let updated = 0;
    for (const server of imported) {
      const current = existingById.get(server.id);
      if (current) {
        await storageService.saveServer({
          ...server,
          password: current.password,
          basicAuthPassword: current.basicAuthPassword,
          apiKey: current.apiKey,
        });
        updated++;
      } else {
        await storageService.saveServer(server);
        added++;
      }
    }
    clogInfo('CONN', `Imported servers — ${added} added, ${updated} updated`);
    return { added, updated };
  }

  /**
   * Connect to a server (set as current and authenticate). When the server
   * has a fallback endpoint configured, the primary endpoint is attempted
   * first; if it fails with a network error, the fallback endpoint is tried.
   * Authentication errors are not retried against the fallback because they
   * share credentials with the primary endpoint.
   */
  static async connectToServer(server: ServerConfig): Promise<boolean> {
    const primaryResolved = resolveServerEndpoint(server, 'primary');

    try {
      const success = await this.connectToEndpoint(server, primaryResolved, 'primary');
      if (success) return true;
      // Login returned Fails (auth) — don't try fallback with the same creds.
      return false;
    } catch (primaryError: unknown) {
      if (!hasFallback(server) || !isNetworkError(primaryError)) {
        // Not eligible for fallback — surface the original error.
        throw primaryError;
      }

      const fallbackResolved = resolveServerEndpoint(server, 'fallback');
      const primaryMessage =
        primaryError instanceof Error ? primaryError.message : String(primaryError);
      clogWarn(
        'CONN',
        `Primary endpoint failed (${primaryMessage}); trying fallback ${fallbackResolved.host}:${fallbackResolved.port || 'default'}`,
      );

      try {
        const success = await this.connectToEndpoint(server, fallbackResolved, 'fallback');
        if (success) {
          clogInfo('CONN', 'Connected via fallback endpoint');
          return true;
        }
        return false;
      } catch (fallbackError: unknown) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        clogError('CONN', `Fallback endpoint also failed: ${fallbackMessage}`);
        // Surface the fallback error since both routes failed; it's the
        // most recent and usually the most informative.
        throw fallbackError;
      }
    }
  }

  /**
   * Internal: attempt a connection against a single resolved endpoint. The
   * resolved config carries the chosen host/port/useHttps while keeping the
   * shared id/credentials so cookies and stored IDs remain consistent.
   */
  private static async connectToEndpoint(
    server: ServerConfig,
    resolved: ServerConfig,
    endpoint: ServerEndpointKind,
  ): Promise<boolean> {
    const authMode = getServerAuthMode(resolved);
    clogInfo(
      'CONN',
      `Connecting to ${resolved.host}:${resolved.port || 'default'} via ${endpoint} (authMode=${authMode})`,
    );
    apiClient.setServer(resolved);

    try {
      if (authMode !== 'password') {
        try {
          const versionInfo = await applicationApi.getVersion();
          await storageService.setCurrentServerId(server.id);
          await storageService.setManualDisconnect(false);
          apiClient.setApiVersion(versionInfo.apiVersion);
          clogInfo(
            'CONN',
            `Connected successfully via ${endpoint} (${authMode}, API ${versionInfo.apiVersion})`,
          );
          return true;
        } catch (error: unknown) {
          apiClient.setServer(null);
          const message = error instanceof Error ? error.message : String(error);
          const axiosErr = error instanceof AxiosError ? error : undefined;
          clogError('CONN', `${authMode} connect failed (${endpoint}): ${message}`);
          if (isNetworkError(error)) {
            throw error;
          }
          if (
            axiosErr?.response?.status === 403 ||
            axiosErr?.response?.status === 401 ||
            message.includes('Authentication')
          ) {
            throw new Error('Authentication failed. Please check your credentials.', {
              cause: error,
            });
          }
          throw new Error('Failed to connect to server. Please check your settings.', {
            cause: error,
          });
        }
      }

      const loginResult = await authApi.login(resolved.username, resolved.password);

      if (loginResult.status === 'Ok') {
        try {
          const versionInfo = await applicationApi.getVersion();
          await storageService.setCurrentServerId(server.id);
          await storageService.setManualDisconnect(false);
          apiClient.setApiVersion(versionInfo.apiVersion);
          clogInfo(
            'CONN',
            `Connected successfully via ${endpoint} (authenticated, API ${versionInfo.apiVersion})`,
          );
          return true;
        } catch (error: unknown) {
          apiClient.setServer(null);
          const message = error instanceof Error ? error.message : String(error);
          const axiosErr = error instanceof AxiosError ? error : undefined;
          clogError('CONN', `Post-login API check failed (${endpoint}): ${message}`);
          if (isNetworkError(error)) {
            throw error;
          }
          if (
            axiosErr?.response?.status === 403 ||
            axiosErr?.response?.status === 401 ||
            message.includes('Authentication')
          ) {
            throw new Error('Authentication failed. Please check your credentials.', {
              cause: error,
            });
          }
          throw new Error('Failed to connect to server. Please check your settings.', {
            cause: error,
          });
        }
      }

      clogWarn('CONN', `Login returned Fails (${endpoint}) — clearing server`);
      apiClient.setServer(null);
      return false;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      clogError('CONN', `connectToEndpoint(${endpoint}) error: ${message}`);
      apiClient.setServer(null);
      throw error;
    }
  }

  /**
   * Get current connected server
   */
  static async getCurrentServer(): Promise<ServerConfig | null> {
    const [current, allServers] = await Promise.all([
      storageService.getCurrentServer(),
      storageService.getServers(),
    ]);
    syncInsecureCertAllowlist(allServers);
    return current;
  }

  /**
   * Disconnect from current server
   */
  static async disconnect(): Promise<void> {
    const previousServer = apiClient.getServer();
    // API-key auth is stateless and the login/logout endpoints reject Bearer
    // keys outright, so there's no session to end.
    if (previousServer && getServerAuthMode(previousServer) !== 'apiKey') {
      try {
        await authApi.logout();
      } catch {
        // Ignore logout errors
      }
    }
    clogInfo(
      'CONN',
      previousServer
        ? `Disconnecting from ${previousServer.host}:${previousServer.port || 'default'} (user requested)`
        : 'Disconnect requested (no server was connected)',
    );
    apiClient.setServer(null);
    // Keep currentServerId so Settings can offer one-tap reconnect to the
    // last server, and so auto-connect-last-server still has a target — but
    // remember the explicit disconnect so startup auto-connect skips it
    // until the user connects again. Only when a server was actually
    // connected: the disconnect that follows deleting the current server
    // (apiClient already cleared) must not suppress auto-connect for a
    // different server later.
    if (previousServer) {
      await storageService.setManualDisconnect(true);
    }
  }

  /**
   * Reconnect to current server (if one is set)
   */
  static async reconnect(): Promise<boolean> {
    const currentServer = await storageService.getCurrentServer();
    if (!currentServer) {
      return false;
    }
    return await this.connectToServer(currentServer);
  }

  /**
   * Test connection to a server without saving it. When the server has a
   * fallback endpoint configured, both endpoints are tested and per-endpoint
   * results are returned alongside the top-level success flag, which is true
   * when *either* endpoint succeeds.
   */
  static async testConnection(
    server: ServerConfig,
    signal?: AbortSignal,
  ): Promise<ConnectionTestResult> {
    if (server.allowInsecureCert) {
      // Server may not be saved yet (Add Server's "Test Connection" builds a
      // throwaway ServerConfig) — union it with the persisted allowlist so
      // the toggle takes effect immediately, without wiping other servers'
      // entries out of the native allowlist.
      syncInsecureCertAllowlist([...(await storageService.getServers()), server]);
    }
    if (!hasFallback(server)) {
      // Simple primary-only path — preserves the original shape for callers
      // that don't need per-endpoint detail.
      const result = await this.testEndpoint(resolveServerEndpoint(server, 'primary'), signal);
      return result;
    }

    const primary = await this.testEndpoint(resolveServerEndpoint(server, 'primary'), signal);
    if (signal?.aborted) {
      throw new Error('Test cancelled');
    }
    const fallback = await this.testEndpoint(resolveServerEndpoint(server, 'fallback'), signal);

    const success = primary.success || fallback.success;
    return {
      success,
      error: success ? undefined : fallback.error || primary.error,
      primary,
      fallback,
    };
  }

  /**
   * Internal: test a single resolved endpoint and translate errors into the
   * EndpointTestResult shape. Cancellation propagates so the caller can stop
   * the whole test sequence in flight.
   */
  private static async testEndpoint(
    resolved: ServerConfig,
    signal?: AbortSignal,
  ): Promise<EndpointTestResult> {
    const previousServer = apiClient.getServer();
    clogInfo('CONN', `testEndpoint to ${resolved.host}:${resolved.port || 'default'}`);

    try {
      apiClient.setServer(resolved);

      try {
        if (getServerAuthMode(resolved) === 'password') {
          const loginResult = await authApi.login(resolved.username, resolved.password, signal);
          if (loginResult.status !== 'Ok') {
            clogWarn('CONN', 'testEndpoint: auth failed');
            return {
              success: false,
              error: 'Authentication failed. Please check your username and password.',
            };
          }
        }

        if (signal?.aborted) {
          throw new Error('Test cancelled');
        }

        await applicationApi.getVersion(signal);

        clogInfo('CONN', 'testEndpoint succeeded');
        return { success: true };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const axiosErr = error instanceof AxiosError ? error : undefined;

        if (
          error instanceof Error &&
          (error.name === 'AbortError' || error.name === 'CanceledError')
        ) {
          throw error;
        }
        if (
          axiosErr?.code === 'ERR_CANCELED' ||
          message === 'Test cancelled' ||
          message.includes('cancel')
        ) {
          throw error;
        }

        if (
          axiosErr?.response?.status === 403 ||
          axiosErr?.response?.status === 401 ||
          message.includes('Authentication')
        ) {
          clogWarn(
            'CONN',
            `testEndpoint failed: auth error (${axiosErr?.response?.status || message})`,
          );
          return { success: false, error: 'Authentication failed. Please check your credentials.' };
        } else if (isNetworkError(error)) {
          clogError('CONN', `testEndpoint failed: network error (${axiosErr?.code || message})`);
          return {
            success: false,
            error: 'Connection failed. Please check your server address and network connection.',
          };
        } else {
          clogError('CONN', `testEndpoint failed: ${message}`);
          return {
            success: false,
            error: message || 'Connection test failed. Please check your settings.',
          };
        }
      } finally {
        apiClient.setServer(previousServer);
      }
    } catch (error: unknown) {
      apiClient.setServer(previousServer);
      const message = error instanceof Error ? error.message : String(error);
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'CanceledError')
      ) {
        throw error;
      }
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') {
        throw error;
      }
      if (message === 'Test cancelled' || message.includes('cancel')) {
        throw error;
      }
      return {
        success: false,
        error: message || 'Connection test failed. Please check your settings.',
      };
    }
  }
}
