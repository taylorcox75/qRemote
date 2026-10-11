/**
 * client.ts — Singleton axios-based HTTP client for the qBittorrent WebUI API with cookie auth, retry, and request logging.
 *
 * Key exports: apiClient (singleton ApiClient instance)
 */
import axios, { AxiosInstance, AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { ServerConfig } from '@/types/api';
import { clogDebug, clogInfo, clogWarn, clogError } from '@/services/connectivity-log';
import { ApiFeatures, getApiFeatures } from '@/utils/apiVersion';
import { isTlsRejection } from '@/utils/error';
import { basicAuthHeader } from '@/utils/basicAuth';
import { isReservedHeaderName } from '@/utils/customHeaders';
import { getServerAuthMode } from '@/utils/authMode';
import { QUI_KEY_REJECTED_MESSAGE, redactQuiProxyKey, withQuiProxyPath } from '@/utils/quiProxy';

/** An error from the API client, carrying the HTTP status when the request got a response. */
export interface ApiError extends Error {
  status?: number;
}

/**
 * Build the error the interceptor throws.
 *
 * The message text is load-bearing — callers substring-match these strings — so
 * this only *adds* the status code alongside it, letting callers distinguish
 * e.g. "this torrent is gone" (404) from a generic failure without parsing prose.
 */
function apiError(message: string, status?: number): ApiError {
  const err = new Error(message) as ApiError;
  if (status !== undefined) err.status = status;
  return err;
}

/**
 * Config augmented with the session epoch it was issued under (see
 * ApiClient.sessionEpoch) and whether its URL carries a qui proxy key. The
 * latter is stamped per request — not read off `currentServer` when the
 * response lands — so a late response from a qui server we've since switched
 * away from is still redacted. Redaction is conditional on it because
 * `/proxy/<x>` is also a perfectly ordinary qBittorrent reverse-proxy base
 * path, which diagnostics should keep showing verbatim.
 */
type EpochedRequestConfig = InternalAxiosRequestConfig & {
  __sessionEpoch?: number;
  __quiProxy?: boolean;
};

const identity = (text: string): string => text;

class ApiClient {
  private client: AxiosInstance;
  private currentServer: ServerConfig | null = null;
  private cookies: string = '';
  private retryAttempts: number = 3;
  private apiVersion: string | null = null;
  private cachedFeatures: ApiFeatures | null = null;
  /**
   * Bumped whenever the current session's cookie is invalidated (a server
   * switch, an explicit clearCookies, or a 403). Each outgoing request is
   * stamped with the epoch active when it was sent; a 403 response is only
   * allowed to clear the *current* session's cookie when its request was
   * stamped with that same epoch. Without this, a request issued against a
   * just-superseded session (e.g. a poll for the server the app is switching
   * away from) can land after a new session's login and wipe the fresh
   * cookie it just received, surfacing as a spurious "Authentication failed"
   * on the new connect.
   */
  private sessionEpoch: number = 0;

  /**
   * Aborts every in-flight request relying on the session-scoped signal —
   * i.e. every call whose caller didn't pass its own `AbortSignal` — and is
   * itself the signal handed to those calls by default (see `get`/`post`/
   * `postFormData`/`postUrlEncoded`). Replaced (not just aborted) on every
   * session teardown so the *next* request isn't dead on arrival. Without
   * this, a request against a now-unreachable server had nothing to cancel
   * it: disconnect() had to wait out a full logout POST, and a stale poll
   * could land long after the app had moved on (#254).
   */
  private sessionController: AbortController = new AbortController();

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // In React Native, we need to manually handle cookies
      // withCredentials doesn't work the same way as in browsers
      withCredentials: false,
    });

    // Request interceptor to add cookies and base URL
    this.client.interceptors.request.use(
      (config: EpochedRequestConfig) => {
        if (!this.currentServer) {
          return Promise.reject(new Error('No server configured'));
        }

        config.__sessionEpoch = this.sessionEpoch;
        config.__quiProxy = getServerAuthMode(this.currentServer) === 'quiProxy';

        const protocol = this.currentServer.useHttps ? 'https' : 'http';
        // Defense-in-depth: strip protocol and trailing colons/slashes from host even if already sanitized
        const rawHost = (this.currentServer.host || '')
          .replace(/^(https?:\/\/)/i, '')
          .replace(/[:/]+$/, '');
        // The server forms have no base-path field, so a reverse-proxy path can
        // arrive inside Host ("example.com/qbit"). Split it off so the port goes
        // after the hostname, not after the path ("example.com/qbit:8443").
        const hostSlash = rawHost.indexOf('/');
        const host = hostSlash === -1 ? rawHost : rawHost.slice(0, hostSlash);
        const hostPath = hostSlash === -1 ? '' : rawHost.slice(hostSlash).replace(/\/+$/, '');
        const port = this.currentServer.port;
        const portNum = port !== undefined && port !== null ? Number(port) : undefined;
        const portPart =
          portNum !== undefined && !isNaN(portNum) && portNum > 0 ? `:${portNum}` : '';

        // qui Client Proxy (#272): the key is a path segment, so the effective
        // base path is `<qui base>/proxy/<key>`. qui has no Bearer header and no
        // real login — auth is entirely this path.
        const isQuiProxy = config.__quiProxy === true;
        const redact = isQuiProxy ? redactQuiProxyKey : identity;
        let basePath = this.currentServer.basePath || '/';
        if (isQuiProxy && this.currentServer.quiProxyKey) {
          basePath = withQuiProxyPath(basePath, this.currentServer.quiProxyKey);
        }

        // Handle base path - ensure it starts with / and doesn't end with /
        if (!basePath.startsWith('/')) {
          basePath = '/' + basePath;
        }
        // If basePath is just '/', set it to empty string to avoid double slashes
        if (basePath === '/') {
          basePath = '';
        } else if (basePath.endsWith('/')) {
          // Remove trailing slash for non-root paths
          basePath = basePath.slice(0, -1);
        }

        config.baseURL = `${protocol}://${host}${portPart}${hostPath}${basePath}`;

        // Every URL that reaches the log is redacted — in qui mode the baseURL
        // contains the secret key.
        clogDebug(
          'HTTP',
          redact(`${config.method?.toUpperCase() || 'REQ'} ${config.baseURL}${config.url || ''}`),
        );

        // API key auth (v5.2.0+ / WebAPI 2.14.1+) takes precedence over proxy
        // Basic Auth since both use the same Authorization header — a server
        // configured for both is choosing API key as the more specific option.
        // qui mode sends no Bearer header at all (its key is in the path), but
        // proxy Basic Auth still applies for a gateway sitting in front of qui.
        if (!isQuiProxy && this.currentServer.useApiKey && this.currentServer.apiKey) {
          config.headers.Authorization = `Bearer ${this.currentServer.apiKey}`;
        } else if (this.currentServer.useBasicAuth && this.currentServer.basicAuthUsername) {
          config.headers.Authorization = basicAuthHeader(
            this.currentServer.basicAuthUsername,
            this.currentServer.basicAuthPassword ?? '',
          );
        }

        // Add cookies if available
        if (this.cookies) {
          config.headers.Cookie = this.cookies;
        }

        // Add Referer header for qBittorrent 5.x compatibility
        config.headers.Referer = config.baseURL + '/';

        // Add Origin header for CORS/authentication
        config.headers.Origin = `${protocol}://${host}${portPart}`;

        // Custom headers (#228) — for tunnels/proxies with their own
        // header-based auth (e.g. Pangolin), independent of qBittorrent's
        // own auth mode.
        //
        // Reserved names are re-checked HERE rather than trusted from save-time
        // validation. These are applied last, so a header named `Authorization`
        // or `Cookie` would otherwise silently clobber the real auth this
        // request depends on — and save-time validation is not the only way
        // data reaches a ServerConfig (settings import spreads raw JSON).
        // Enforce the invariant at the point where it actually matters.
        if (this.currentServer.useCustomHeaders && this.currentServer.customHeaders?.length) {
          for (const header of this.currentServer.customHeaders) {
            if (header?.key && header?.value && !isReservedHeaderName(header.key)) {
              config.headers[header.key] = header.value;
            }
          }
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor to capture cookies and handle errors
    this.client.interceptors.response.use(
      (response) => {
        // Extract cookies from response headers
        // React Native/Axios may lowercase headers, so check all variations
        const headers = response.headers || {};
        const setCookieHeader =
          headers['set-cookie'] ||
          headers['Set-Cookie'] ||
          headers['SET-COOKIE'] ||
          // Also check if headers object has a get method (some implementations)
          (typeof headers.get === 'function' ? headers.get('set-cookie') : null);

        if (setCookieHeader) {
          this.mergeCookies(setCookieHeader);
          clogDebug('HTTP', `Cookies captured: ${this.cookies.substring(0, 60)}...`);
        }
        return response;
      },
      (error: AxiosError) => {
        // Redacted once here: reqUrl and every message below end up in the
        // connectivity log and/or a thrown (user-visible) Error, and in qui mode
        // the baseURL carries the secret proxy key.
        const wasQuiProxy = (error.config as EpochedRequestConfig | undefined)?.__quiProxy === true;
        const redact = wasQuiProxy ? redactQuiProxyKey : identity;
        const reqUrl = redact(`${error.config?.baseURL || ''}${error.config?.url || ''}`);
        const status = error.response?.status;

        // qui validates the proxy key from the URL path and answers 401 with a
        // plain-text "Invalid API key" / "Missing API key". That is a wrong or
        // revoked key — not a session a re-login can fix — so it gets its own
        // message rather than the generic fall-through below.
        if (status === 401 && wasQuiProxy) {
          const body = error.response?.data?.toString() ?? '';
          if (/\b(invalid|missing) api key\b/i.test(body)) {
            clogError('HTTP', `401 qui rejected the proxy key — ${reqUrl}`);
            throw apiError(QUI_KEY_REJECTED_MESSAGE, status);
          }
        }

        // Handle authentication errors
        if (status === 403) {
          const requestEpoch = (error.config as EpochedRequestConfig | undefined)?.__sessionEpoch;
          if (requestEpoch !== undefined && requestEpoch !== this.sessionEpoch) {
            // This request was issued under a session that's already been
            // superseded (e.g. a poll for the server we've since switched
            // away from). Its 403 says nothing about the *current* session,
            // so don't clear its cookie or report a real auth failure —
            // that would wipe a session another connect just established.
            clogWarn('HTTP', `403 from superseded session — ignoring: ${reqUrl}`);
            throw apiError('Request superseded by a newer session.', status);
          }
          this.cookies = '';
          this.sessionEpoch++;
          clogError('HTTP', `403 Forbidden — ${reqUrl}`);
          throw apiError('Authentication failed. Please check your credentials.', status);
        }

        // Handle rate limiting
        if (status === 429) {
          const headers = error.response?.headers ?? {};
          const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
          const waitMsg = retryAfter ? ` Please retry after ${retryAfter} seconds.` : '';
          clogWarn('HTTP', `429 Rate Limited — ${reqUrl}${waitMsg}`);
          throw apiError(`Rate limited by server.${waitMsg}`.trim(), status);
        }

        // 409 means different things on different endpoints — queueing
        // disabled on the priority-reorder endpoints, but e.g. a duplicate
        // torrent on /torrents/add. Only show the queueing message for the
        // endpoints that actually mean that.
        if (status === 409) {
          const isPriorityEndpoint = /\/torrents\/(top|bottom|increase|decrease)Prio$/.test(
            error.config?.url || '',
          );
          if (isPriorityEndpoint) {
            clogWarn('HTTP', `409 Conflict — ${reqUrl}`);
            throw apiError(
              'Torrent queueing must be enabled in qBittorrent to change priorities.',
              status,
            );
          }
          const message = error.response?.data?.toString().trim();
          clogWarn('HTTP', `409 Conflict — ${reqUrl}: ${message || '(no body)'}`);
          throw apiError(message || 'This torrent already exists or could not be added.', status);
        }

        // Handle 404 Not Found errors
        if (status === 404) {
          const fullUrl = reqUrl;
          clogWarn('HTTP', `404 Not Found — ${fullUrl}`);
          throw apiError(
            `Endpoint not found: ${fullUrl}. Please check your qBittorrent version and API compatibility.`,
            status,
          );
        }

        // Handle network errors
        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          // iOS's TLS-certificate rejection (NSURLErrorServerCertificateUntrusted,
          // -1202, and friends) surfaces here too — as a plain ERR_NETWORK with
          // no distinguishing code (#256). Without this, a rejected self-signed
          // certificate is indistinguishable from a genuinely dead server, so
          // nobody can tell what's wrong from the app alone. isTlsRejection reads
          // the native error description RN stashes on the XHR (see utils/error.ts)
          // to tell the two apart. This is a *new*, separate message — do not fold
          // it into 'Connection timeout...' below, which callers substring-match.
          if (isTlsRejection(error)) {
            clogWarn('TLS', `Certificate rejected — ${reqUrl}`);
            throw apiError(
              'Certificate rejected. Enable "Allow Untrusted, Self-Signed Certificate" for this server if you trust it.',
              status,
            );
          }
          clogError('HTTP', `Network error (${error.code}) — ${reqUrl}`);
          throw apiError('Connection timeout. Please check your server connection.', status);
        }

        // A request we cancelled ourselves — session teardown (setServer,
        // clearCookies) or an explicit abortInFlight() (disconnect, server
        // switch). Give it its own identifiable message rather than falling
        // into the generic branch below and surfacing as "canceled": it must
        // never be retried (isRetriableError doesn't match ERR_CANCELED) and
        // must never look like a real failure to callers — deliberately kept
        // out of RECONNECTABLE_MESSAGES (hooks/useReactiveReconnect.ts) so it
        // can't trigger a reconnect or flash error UI.
        if (error.code === 'ERR_CANCELED') {
          clogDebug('HTTP', `Request canceled — ${reqUrl}`);
          throw apiError('Request canceled.', status);
        }

        // Handle other errors
        const message = redact(
          error.response?.data?.toString() || error.message || 'An unknown error occurred',
        );
        clogError(
          'HTTP',
          `${status ? 'HTTP ' + status : error.code || 'Unknown'} — ${reqUrl}: ${message}`,
        );
        throw apiError(message, status);
      },
    );
  }

  updateSettings(config: { connectionTimeout?: number; retryAttempts?: number }) {
    if (config.connectionTimeout !== undefined) {
      this.client.defaults.timeout = config.connectionTimeout;
    }
    if (config.retryAttempts !== undefined) {
      this.retryAttempts = Math.max(0, config.retryAttempts);
    }
  }

  setApiVersion(v: string | null): void {
    this.apiVersion = v;
    this.cachedFeatures = null;
  }

  getApiVersion(): string | null {
    return this.apiVersion;
  }

  getApiFeatures(): ApiFeatures {
    if (!this.cachedFeatures) {
      this.cachedFeatures = getApiFeatures(this.apiVersion);
    }
    return this.cachedFeatures;
  }

  setServer(server: ServerConfig | null) {
    // Only clear cookies if we're switching to a different server or disconnecting
    if (!server || (this.currentServer && this.currentServer.id !== server.id)) {
      this.cookies = '';
      this.apiVersion = null;
      this.cachedFeatures = null;
      this.sessionEpoch++;
      this.abortInFlight();
    }
    this.currentServer = server;
    if (server) {
      clogInfo('HTTP', `API client set to ${server.host}:${server.port || 'default'}`);
    } else {
      clogInfo('HTTP', 'API client server cleared');
    }
  }

  getServer(): ServerConfig | null {
    return this.currentServer;
  }

  clearCookies() {
    this.cookies = '';
    this.sessionEpoch++;
    this.abortInFlight();
  }

  getCookies(): string {
    return this.cookies;
  }

  /**
   * Cancels every in-flight request that's relying on the session-scoped
   * signal (any `get`/`post`/`postFormData`/`postUrlEncoded` call whose
   * caller didn't pass its own `AbortSignal`) and starts a fresh session so
   * the next request isn't dead on arrival. Called automatically by
   * `setServer`/`clearCookies` on every session teardown, and directly by
   * `ServerManager.disconnect()` so a hung request against an unreachable
   * server can't make disconnect feel unresponsive (#254).
   */
  abortInFlight(): void {
    this.sessionController.abort();
    this.sessionController = new AbortController();
  }

  /**
   * Merge Set-Cookie values into the jar by name instead of replacing it.
   * A reverse proxy in front of qBittorrent may set its own cookie on any
   * response (Cloudflare __cf_bm, forward-auth session cookies); replacing the
   * jar wholesale dropped SID and forced a re-login on the next request.
   */
  private mergeCookies(setCookie: string | string[]): void {
    const jar = new Map<string, string>();
    const put = (pair: string) => {
      const trimmed = pair.trim();
      if (!trimmed) return;
      const eq = trimmed.indexOf('=');
      jar.set(eq === -1 ? trimmed : trimmed.slice(0, eq), trimmed);
    };
    this.cookies.split(';').forEach(put);
    (Array.isArray(setCookie) ? setCookie : [setCookie]).forEach((raw) => put(raw.split(';')[0]));
    this.cookies = Array.from(jar.values()).join('; ');
  }

  async postFormData(url: string, data: FormData, signal?: AbortSignal): Promise<unknown> {
    if (!this.currentServer) {
      throw new Error('No server configured');
    }

    const headers = new AxiosHeaders({ 'Content-Type': 'multipart/form-data' });
    if (this.cookies) {
      headers.set('Cookie', this.cookies);
    }

    const response = await this.client.post(url, data, {
      headers,
      signal: signal ?? this.sessionController.signal,
    });
    return response.data;
  }

  async postUrlEncoded(
    url: string,
    data: Record<string, string | number | boolean>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return (await this.postUrlEncodedWithStatus(url, data, signal)).data;
  }

  /**
   * Same request as `postUrlEncoded`, but also reports the HTTP status of the
   * 2xx response. Needed by the few endpoints that signal progress through the
   * status code rather than the body — e.g. torrents/fetchMetadata answers 202
   * while a download is still in flight and 200 once it has the metadata.
   */
  async postUrlEncodedWithStatus(
    url: string,
    data: Record<string, string | number | boolean>,
    signal?: AbortSignal,
  ): Promise<{ data: unknown; status: number }> {
    // Check server is configured (interceptor will also check, but fail early with better error)
    if (!this.currentServer) {
      throw new Error('No server configured. Please connect to a server first.');
    }

    // Manually encode the data as URL-encoded string
    const params: string[] = [];
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) {
        const value = String(data[key]);
        params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });
    const body = params.join('&');

    // Let the interceptor handle headers (it already sets Content-Type) and baseURL
    const response = await this.client.post(url, body, {
      signal: signal ?? this.sessionController.signal,
    });
    return { data: response.data, status: response.status };
  }

  private isRetriableError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      return (
        error.code === 'ECONNABORTED' ||
        error.code === 'ERR_NETWORK' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout')
      );
    }
    return error instanceof Error && error.message.includes('timeout');
  }

  /**
   * `connectionTimeout` (`this.client.defaults.timeout`) is a total budget
   * for the whole logical request, not a per-attempt allowance — otherwise
   * up to `retryAttempts + 1` attempts each waiting out the full timeout,
   * plus backoff between them, turned one GET against a dead server into
   * ~43s (and, with TanStack's own query-level retry on top, ~2 minutes)
   * before anything surfaced (#254). A floor keeps the last attempt in a
   * near-exhausted budget from being handed ~0ms.
   */
  private static readonly ATTEMPT_TIMEOUT_FLOOR_MS = 1000;

  private async withRetry<T>(fn: (timeoutMs: number) => Promise<T>): Promise<T> {
    const totalBudgetMs = this.client.defaults.timeout || 10000;
    const deadline = Date.now() + totalBudgetMs;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      const remainingBeforeAttempt = deadline - Date.now();
      if (attempt > 0 && remainingBeforeAttempt <= 0) {
        throw lastError;
      }
      const attemptTimeout = Math.max(ApiClient.ATTEMPT_TIMEOUT_FLOOR_MS, remainingBeforeAttempt);

      try {
        return await fn(attemptTimeout);
      } catch (error: unknown) {
        lastError = error;
        if (attempt >= this.retryAttempts || !this.isRetriableError(error)) {
          throw error;
        }
        const backoff = 500 * (attempt + 1);
        const remainingAfterFailure = deadline - Date.now();
        if (remainingAfterFailure <= backoff) {
          // The backoff sleep alone would blow the budget — stop now rather
          // than sleep past it and retry anyway.
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, backoff));
        clogWarn('HTTP', `Retrying request (attempt ${attempt + 1}/${this.retryAttempts})...`);
      }
    }
    throw lastError;
  }

  async get(
    url: string,
    params?: Record<string, string | number | boolean>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!this.currentServer) {
      throw new Error('No server configured');
    }

    const effectiveSignal = signal ?? this.sessionController.signal;
    return this.withRetry(async (timeoutMs) => {
      const response = await this.client.get(url, {
        params,
        signal: effectiveSignal,
        timeout: timeoutMs,
      });
      return response.data;
    });
  }

  async post(url: string, data?: unknown, signal?: AbortSignal): Promise<unknown> {
    if (!this.currentServer) {
      throw new Error('No server configured');
    }

    const response = await this.client.post(url, data, {
      signal: signal ?? this.sessionController.signal,
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();
