/**
 * server-manager.ts — Server CRUD, connection lifecycle, and auto-reconnect logic.
 *
 * Key exports: ServerManager, isNetworkError
 * Known issues: isNetworkError was duplicated inline 3× (deduplicated in Task 1.6).
 */
import { AxiosError } from 'axios';
import { ServerConfig, ServerEndpointKind } from '@/types/api';
import { hasFallback, insecureCertHostnames, resolveServerEndpoint } from '@/utils/server';
import { getServerAuthMode } from '@/utils/authMode';
import { QUI_KEY_MISSING_MESSAGE, isQuiKeyRejection } from '@/utils/quiProxy';
import { buildServerExport, ServerExportFile } from '@/utils/server-export';
import { storageService } from './storage';
import { apiClient } from './api/client';
import { authApi } from './api/auth';
import { applicationApi } from './api/application';
import { clogInfo, clogWarn, clogError } from './connectivity-log';
import {
  setInsecureCertAllowedHosts,
  isInsecureCertAllowlistAvailable,
} from '@/modules/insecure-cert-allowlist';

/**
 * Pushes every host opted into `allowInsecureCert` to the native TLS
 * allowlist (see modules/insecure-cert-allowlist). Called after every read
 * or write of the server list so the native side never lags behind a toggle
 * change before the next connection attempt.
 */
function syncInsecureCertAllowlist(servers: ServerConfig[]): void {
  const wantAllowlist = servers.filter((s) => s.allowInsecureCert);
  // A server can have this flag set while the native module is absent from
  // the running binary (OTA JS on a pre-#256 binary — see
  // modules/insecure-cert-allowlist/index.ts). The toggle silently no-ops in
  // that case; warn so a connection failure doesn't look unexplained.
  if (wantAllowlist.length > 0 && !isInsecureCertAllowlistAvailable()) {
    clogWarn(
      'CERT',
      `${wantAllowlist.length} server(s) have "Allow Untrusted, Self-Signed Certificate" enabled, but this build has no native allowlist module — the toggle will not take effect until the app is updated from the App Store.`,
    );
  }
  // The native side exact-matches the bare hostname from the TLS challenge,
  // so a Host with a path, a typed port or a trailing dot is normalized first.
  const hosts = new Set(
    wantAllowlist.flatMap((s) => [
      ...insecureCertHostnames(s.host),
      ...(s.useFallback ? insecureCertHostnames(s.fallbackHost) : []),
    ]),
  );
  setInsecureCertAllowedHosts([...hosts]);
}

/**
 * Thrown by connectToServer when a newer connect, a disconnect or the current
 * server's deletion took over while this attempt was in flight. The attempt
 * has left the API client alone; callers should drop its result silently.
 * Avoids the words "Connection"/"Network"/"timeout" so isNetworkError (and
 * with it the fallback endpoint) never fires for it.
 */
export const CONNECT_SUPERSEDED_MESSAGE = 'Connect attempt superseded by a newer one.';

export function isConnectSuperseded(error: unknown): boolean {
  return error instanceof Error && error.message === CONNECT_SUPERSEDED_MESSAGE;
}

function supersededError(cause?: unknown): Error {
  return new Error(CONNECT_SUPERSEDED_MESSAGE, cause === undefined ? undefined : { cause });
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
   * Identifies the connect attempt that owns the API client. Bumped by every
   * connectToServer, disconnect, and deletion of the connected server. An
   * attempt may only clear the client, write the current-server id or set
   * the API version while its token is still the latest — server ids can't
   * be used for this, because a fallback endpoint shares its primary's id.
   */
  private static connectAttempt = 0;

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
      this.connectAttempt++;
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
   * (password, proxy Basic Auth password, API key, qui proxy key, custom headers) stripped
   * — see utils/server-export.ts.
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
          quiProxyKey: current.quiProxyKey,
          customHeaders: current.customHeaders,
          // Not part of an export (utils/server-export.ts) — trust in a
          // self-signed certificate is decided on this device, so keep it.
          allowInsecureCert: current.allowInsecureCert,
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
    const attempt = ++this.connectAttempt;
    const owns = () => attempt === this.connectAttempt;
    const primaryResolved = resolveServerEndpoint(server, 'primary');

    try {
      const success = await this.connectToEndpoint(server, primaryResolved, 'primary', owns);
      if (success) return true;
      // Login returned Fails (auth) — don't try fallback with the same creds.
      return false;
    } catch (primaryError: unknown) {
      if (!owns()) {
        throw isConnectSuperseded(primaryError) ? primaryError : supersededError(primaryError);
      }
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
        const success = await this.connectToEndpoint(server, fallbackResolved, 'fallback', owns);
        if (success) {
          clogInfo('CONN', 'Connected via fallback endpoint');
          return true;
        }
        return false;
      } catch (fallbackError: unknown) {
        if (isConnectSuperseded(fallbackError)) throw fallbackError;
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
   *
   * `owns` reports whether this attempt is still the latest. Once it isn't,
   * the attempt touches nothing shared — no clearing the client (that would
   * abort the newer attempt's login), no storage writes — and throws
   * CONNECT_SUPERSEDED_MESSAGE.
   */
  private static async connectToEndpoint(
    server: ServerConfig,
    resolved: ServerConfig,
    endpoint: ServerEndpointKind,
    owns: () => boolean,
  ): Promise<boolean> {
    const authMode = getServerAuthMode(resolved);
    clogInfo(
      'CONN',
      `Connecting to ${resolved.host}:${resolved.port || 'default'} via ${endpoint} (authMode=${authMode})`,
    );
    apiClient.setServer(resolved);
    /** Commit a successful connect, unless a newer attempt took over meanwhile. */
    const commit = async (apiVersion: string, how: string): Promise<true> => {
      if (!owns()) throw supersededError();
      apiClient.setApiVersion(apiVersion);
      await storageService.setCurrentServerId(server.id);
      await storageService.setManualDisconnect(false);
      clogInfo('CONN', `Connected successfully via ${endpoint} (${how}, API ${apiVersion})`);
      return true;
    };

    // Errors reaching this file already have any qui proxy key redacted at
    // the source (services/api/client.ts), so messages here are logged as-is.
    try {
      // qui Client Proxy (#272): qui's login endpoint is a no-op, so this takes
      // the same no-login path as API key / bypass auth below — the key in the
      // request path is the whole credential.
      if (authMode === 'quiProxy' && !resolved.quiProxyKey) {
        throw new Error(QUI_KEY_MISSING_MESSAGE);
      }
      if (authMode !== 'password') {
        try {
          const versionInfo = await applicationApi.getVersion();
          return await commit(versionInfo.apiVersion, authMode);
        } catch (error: unknown) {
          if (!owns() || isConnectSuperseded(error)) throw error;
          const message = error instanceof Error ? error.message : String(error);
          const axiosErr = error instanceof AxiosError ? error : undefined;
          clogError('CONN', `${authMode} connect failed (${endpoint}): ${message}`);
          if (isNetworkError(error)) {
            throw error;
          }
          if (isQuiKeyRejection(error)) {
            // A wrong/revoked key — surface qui's own explanation instead of the
            // generic "check your credentials" (there are no credentials here).
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
          return await commit(versionInfo.apiVersion, 'authenticated');
        } catch (error: unknown) {
          if (!owns() || isConnectSuperseded(error)) throw error;
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

      if (!owns()) throw supersededError();
      clogWarn('CONN', `Login returned Fails (${endpoint}) — clearing server`);
      apiClient.setServer(null);
      return false;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!owns()) {
        // A newer connect or a disconnect owns the client now; clearing it
        // here would abort that newer attempt's login.
        clogInfo('CONN', `connectToEndpoint(${endpoint}) superseded — leaving the client alone`);
        throw isConnectSuperseded(error) ? error : supersededError(error);
      }
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
    // Any connect still in flight is now stale: it must not clear the client,
    // retry, or record itself as the current server.
    this.connectAttempt++;
    const previousServer = apiClient.getServer();
    // API-key auth is stateless and the login/logout endpoints reject Bearer
    // keys outright, so there's no session to end. The same goes for a qui
    // proxy: qui owns the real qBittorrent session, and its login was a no-op,
    // so there is nothing for this client to log out of.
    const previousMode = previousServer ? getServerAuthMode(previousServer) : null;
    if (previousServer && previousMode !== 'apiKey' && previousMode !== 'quiProxy') {
      // Best-effort logout — fire it, but don't await it. Against an
      // unreachable server this used to make disconnect() wait out the
      // logout POST's own timeout before returning; abortInFlight() below
      // cancels it immediately instead (#254). Errors (including the
      // cancellation itself) are ignored either way — logout is best-effort.
      authApi.logout().catch(() => {
        // Ignore logout errors
      });
    }
    clogInfo(
      'CONN',
      previousServer
        ? `Disconnecting from ${previousServer.host}:${previousServer.port || 'default'} (user requested)`
        : 'Disconnect requested (no server was connected)',
    );
    // Cancel the logout above plus any other in-flight requests (e.g. the
    // torrent/transfer polls) so disconnect returns promptly and nothing
    // lands after the fact (#254).
    apiClient.abortInFlight();
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
   * Reconnect to a server. Prefer passing `server` explicitly — storage's
   * "current server" isn't written until after a connect's login succeeds
   * (see connectToEndpoint below), so during a connect-in-progress window it
   * can still name the *previous* server, and a reconnect firing in that
   * window would otherwise log back into the wrong one.
   */
  static async reconnect(server?: ServerConfig): Promise<boolean> {
    const target = server ?? (await storageService.getCurrentServer());
    if (!target) {
      return false;
    }
    return await this.connectToServer(target);
  }

  /**
   * Test connection to a server without saving it. When the server has a
   * fallback endpoint configured, both endpoints are tested and per-endpoint
   * results are returned alongside the top-level success flag, which is true
   * when *either* endpoint succeeds.
   *
   * Runs on an isolated client (apiClient.createIsolatedClient), so the live
   * connection — its server, session cookie, in-flight polls and any search
   * jobs tied to that session — is untouched by a test.
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
    try {
      if (!hasFallback(server)) {
        // Simple primary-only path — preserves the original shape for callers
        // that don't need per-endpoint detail.
        return await this.testEndpoint(resolveServerEndpoint(server, 'primary'), signal);
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
    } finally {
      if (server.allowInsecureCert) {
        // Back to exactly the saved servers: an unsaved (or not-yet-saved
        // edit of a) server must not stay trusted after its test.
        syncInsecureCertAllowlist(await storageService.getServers());
      }
    }
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
    clogInfo('CONN', `testEndpoint to ${resolved.host}:${resolved.port || 'default'}`);

    try {
      if (getServerAuthMode(resolved) === 'quiProxy' && !resolved.quiProxyKey) {
        return { success: false, error: QUI_KEY_MISSING_MESSAGE };
      }

      const client = apiClient.createIsolatedClient(resolved);

      if (getServerAuthMode(resolved) === 'password') {
        const loginResult = await authApi.login(
          resolved.username,
          resolved.password,
          signal,
          client,
        );
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

      // Plain text — see the get() note in services/api/client.ts.
      await client.get('/api/v2/app/version', undefined, signal, { responseType: 'text' });

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

      if (isQuiKeyRejection(error)) {
        clogWarn('CONN', 'testEndpoint failed: qui rejected the proxy key');
        return { success: false, error: message };
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
    }
  }
}
