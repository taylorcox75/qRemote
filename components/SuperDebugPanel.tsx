/**
 * SuperDebugPanel.tsx — Step-by-step server connectivity diagnostic tool (reach, login, cookie, API checks).
 *
 * Key exports: SuperDebugPanel, SuperDebugPanelProps
 * Known issues: None currently tracked.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/constants/spacing';
import { APP_VERSION } from '@/utils/version';
import { getConnectivityLog, formatConnectivityLog } from '@/services/connectivity-log';
import { logsApi } from '@/services/api/logs';
import { apiClient } from '@/services/api/client';
import { getErrorMessage } from '@/utils/error';
import { isLoginBodyFail, isLoginSuccess } from '@/utils/login-response';

// ---------------------------------------------------------------------------
// Diagnostic HTTP client
// ---------------------------------------------------------------------------
//
// The login (Step 2) and cookie-check (Step 3) steps used to run over the
// raw fetch() API so this panel had zero dependency on the app's own HTTP
// stack. On React Native, fetch() is backed by a pure-JS `whatwg-fetch`
// polyfill (react-native/Libraries/Core/setUpXHR.js) that itself dispatches
// through XMLHttpRequest — so in principle it has the same access to
// response headers as XHR does. In practice, though, React Native's own
// networking docs list cookie-based auth over fetch() as unstable and
// specifically call out `credentials: 'omit'` (which this panel used) as
// "currently not working" (https://reactnative.dev/docs/network#known-issues-with-fetch-and-cookie-based-authentication,
// see also facebook/react-native#23185). That matches what was actually
// observed: Step 3 could never see the Set-Cookie header even when the
// server sent one and the login itself succeeded.
//
// `services/api/client.ts` never hits this problem because it never uses
// fetch() at all — plain `axios.create()` resolves to axios's `xhr` adapter
// on React Native (XMLHttpRequest is defined globally), and that adapter's
// response headers come straight from `xhr.getAllResponseHeaders()`, which
// reliably includes Set-Cookie here. This is exactly how its response
// interceptor captures `headers['set-cookie']` today.
//
// So this panel now drives a dedicated, isolated axios instance for the
// login/API-check steps instead of fetch() — reusing the same proven
// XHR-based path, without touching the shared `apiClient` singleton or its
// cookie jar/current-server state.
const diagnosticHttp = axios.create({
  withCredentials: false,
  // Let the diagnostic inspect every status code itself (401/403/404/etc.),
  // same as fetch() never throwing based on HTTP status.
  validateStatus: () => true,
});

/** Reads the Set-Cookie value(s) off an axios response's headers, tolerant of
 * the array shape (duplicate headers) and casing quirks — mirrors the proven
 * extraction in services/api/client.ts's response interceptor. Returns one
 * raw Set-Cookie string per cookie the server sent. */
function extractSetCookieValues(headers: unknown): string[] {
  const h = headers as Record<string, string | string[] | undefined> | undefined;
  const raw = h?.['set-cookie'] ?? h?.['Set-Cookie'] ?? h?.['SET-COOKIE'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Picks the session cookie `name=value` pair to send back on later requests.
 *
 * qBittorrent's session cookie is NOT always named `SID` — 5.x has a
 * configurable "Session cookie name" (e.g. `QBT_SID_8080`), so requiring the
 * classic name produced false "no cookie" results. The real app never cared:
 * services/api/client.ts's interceptor just takes `split(';')[0].trim()`
 * (the whole first name=value pair, whatever the name). Do the same here:
 * prefer a cookie whose name mentions SID when several were sent, otherwise
 * use the first one. */
function pickSessionCookiePair(setCookieValues: string[]): string {
  const pairs = setCookieValues
    .map((cookie) => cookie.split(';')[0].trim())
    .filter((pair) => pair.includes('='));
  if (pairs.length === 0) return '';
  const sidLike = pairs.find((pair) => pair.split('=')[0].toUpperCase().includes('SID'));
  return sidLike ?? pairs[0];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuperDebugPanelProps {
  host: string;
  port: string;
  useHttps: boolean;
  username: string;
  password: string;
  bypassAuth: boolean;
  /** Optional proxy Basic Auth fields — when absent, no Authorization header is sent. */
  useBasicAuth?: boolean;
  basicAuthUsername?: string;
  basicAuthPassword?: string;
}

type DiagnosticStep = 'REACH' | 'LOGIN' | 'COOKIE' | 'API' | 'INFO' | 'WARN' | 'ERROR';
type DiagnosticStatus = 'success' | 'warning' | 'error' | 'info';

interface DiagnosticEntry {
  id: number;
  timestamp: number;
  step: DiagnosticStep;
  message: string;
  detail?: string;
  status: DiagnosticStatus;
}

/**
 * A session proven to work by the diagnostic's own Step 4 API check (via the
 * isolated diagnosticHttp axios instance above, independent of the shared
 * apiClient singleton). Reused by the log export so it doesn't depend on
 * apiClient.getServer(), which reflects unrelated app-wide connection state
 * and can be null even right after this panel's own diagnostic just
 * succeeded.
 */
interface ValidatedSession {
  configKey: string;
  baseUrl: string;
  /** Full `name=value` session cookie pair (name is server-configurable, not always `SID`). */
  sessionCookie: string;
  basicAuth: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuperDebugPanel({
  host,
  port,
  useHttps,
  username,
  password,
  bypassAuth,
  useBasicAuth = false,
  basicAuthUsername = '',
  basicAuthPassword = '',
}: SuperDebugPanelProps) {
  const { colors } = useTheme();
  const [log, setLog] = useState<DiagnosticEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [pinging, setPinging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const validatedSessionRef = useRef<ValidatedSession | null>(null);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const sanitizeHost = (h: string): string =>
    h.trim().replace(/^(https?:\/\/)/i, '').replace(/[:\/]+$/, '');

  const buildUrl = useCallback((): string => {
    const protocol = useHttps ? 'https' : 'http';
    const clean = sanitizeHost(host);
    const portNum = port.trim() ? parseInt(port, 10) : undefined;
    const portPart = portNum && portNum > 0 && !isNaN(portNum) ? `:${portNum}` : '';
    return `${protocol}://${clean}${portPart}`;
  }, [host, port, useHttps]);

  /** Build the Authorization header value when proxy Basic Auth is enabled. */
  const buildBasicAuthHeader = useCallback((): string | null => {
    if (!useBasicAuth || !basicAuthUsername.trim()) return null;
    const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const input = `${basicAuthUsername.trim()}:${basicAuthPassword}`;
    const bytes: number[] = [];
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      if (code < 0x80) { bytes.push(code); }
      else if (code < 0x800) { bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f)); }
      else { bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f)); }
    }
    let b64 = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i], b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
      b64 += BASE64[b0 >> 2];
      b64 += BASE64[((b0 & 3) << 4) | (b1 >> 4)];
      b64 += i + 1 < bytes.length ? BASE64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
      b64 += i + 2 < bytes.length ? BASE64[b2 & 63] : '=';
    }
    return 'Basic ' + b64;
  }, [useBasicAuth, basicAuthUsername, basicAuthPassword]);

  /** Fingerprint of everything that affects the diagnostic's outcome, so a
   * validated session is only trusted for export while the form still
   * matches the config it was actually proven against. */
  const buildConfigKey = useCallback((): string => {
    return JSON.stringify({
      host: sanitizeHost(host), port, useHttps, bypassAuth, username, password,
      useBasicAuth, basicAuthUsername, basicAuthPassword,
    });
  }, [host, port, useHttps, bypassAuth, username, password, useBasicAuth, basicAuthUsername, basicAuthPassword]);

  const addEntry = useCallback(
    (step: DiagnosticStep, message: string, status: DiagnosticStatus, detail?: string) => {
      const entry: DiagnosticEntry = {
        id: ++idRef.current,
        timestamp: Date.now(),
        step,
        message,
        detail,
        status,
      };
      setLog((prev) => [...prev, entry]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
    [],
  );

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const isHostEmpty = (): boolean => sanitizeHost(host).length === 0;

  // -------------------------------------------------------------------------
  // Feature 1: Ping Host
  // -------------------------------------------------------------------------

  const handlePing = async () => {
    if (isHostEmpty()) {
      addEntry('ERROR', 'Host field is empty. Enter an IP or domain above first.', 'error');
      return;
    }
    const url = buildUrl();
    setPinging(true);
    addEntry('REACH', `Pinging ${url} ...`, 'info');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const start = Date.now();

    try {
      const basicAuth = buildBasicAuthHeader();
      const reachHeaders: Record<string, string> = {};
      if (basicAuth) reachHeaders['Authorization'] = basicAuth;
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'HEAD',
          headers: reachHeaders,
          signal: controller.signal,
        });
      } catch {
        // Some servers reject HEAD — fall back to GET
        if (controller.signal.aborted) throw new Error('Timed out after 15s');
        response = await fetch(url, {
          method: 'GET',
          headers: reachHeaders,
          signal: controller.signal,
        });
      }
      const latency = Date.now() - start;

      if (response.status < 400) {
        addEntry('REACH', `Host reachable — HTTP ${response.status} in ${latency}ms`, 'success');
      } else if (response.status === 401 || response.status === 403) {
        if (useBasicAuth && response.status === 401) {
          addEntry('REACH', `Host reachable — HTTP ${response.status} in ${latency}ms (proxy credentials rejected or not accepted)`, 'warning');
        } else {
          addEntry('REACH', `Host reachable — HTTP ${response.status} in ${latency}ms (auth required, this is normal)`, 'success');
        }
      } else {
        addEntry('REACH', `Host responded with HTTP ${response.status} in ${latency}ms`, 'warning');
      }
    } catch (err: unknown) {
      const latency = Date.now() - start;
      const msg = getErrorMessage(err) || 'Unknown error';
      addEntry('REACH', `Host unreachable after ${latency}ms`, 'error');

      // Provide specific guidance based on error type
      if (msg.includes('Network request failed') || msg.includes('Failed to connect')) {
        addEntry('WARN', 'The device cannot reach the server at all. Possible causes:\n  1. IP address or domain is wrong\n  2. Server is off or qBittorrent is not running\n  3. Port is incorrect (qBittorrent default: 8080)\n  4. Firewall is blocking the connection\n  5. If remote: VPN/port forwarding not configured', 'warning');
      } else if (msg.includes('Timed out') || msg.includes('timeout') || msg.includes('aborted')) {
        addEntry('WARN', 'Connection timed out. The server did not respond within 15 seconds. Possible causes:\n  1. Server is behind a firewall that silently drops packets\n  2. Wrong port (packets go nowhere)\n  3. Network latency too high (weak connection)', 'warning');
      } else if (msg.includes('SSL') || msg.includes('certificate') || msg.includes('TLS')) {
        addEntry('WARN', 'SSL/TLS error. If you do not have HTTPS set up on your server, turn off the "Use HTTPS" toggle above.', 'warning');
      } else {
        addEntry('WARN', `Error detail: ${msg}`, 'warning');
      }
    } finally {
      clearTimeout(timeout);
      setPinging(false);
    }
  };

  // -------------------------------------------------------------------------
  // Feature 2: Open in Browser
  // -------------------------------------------------------------------------

  const handleOpenWebUI = async () => {
    if (isHostEmpty()) {
      addEntry('ERROR', 'Host field is empty.', 'error');
      return;
    }
    const url = buildUrl();
    addEntry('INFO', `Opening in browser: ${url}`, 'info');
    addEntry('INFO', 'If qBittorrent WebUI loads in the browser, your server is reachable from this device.', 'info');
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        addEntry('ERROR', `Cannot open URL on this device: ${url}`, 'error');
        return;
      }
      await Linking.openURL(url);
    } catch (err: unknown) {
      addEntry('ERROR', `Failed to open URL: ${getErrorMessage(err)}`, 'error');
    }
  };

  const handleOpenLoginAPI = async () => {
    if (isHostEmpty()) {
      addEntry('ERROR', 'Host field is empty.', 'error');
      return;
    }
    const url = `${buildUrl()}/api/v2/auth/login`;
    addEntry('INFO', `Opening login endpoint: ${url}`, 'info');
    addEntry('INFO', 'If the server is working, the browser will show "Fails." (because no credentials were sent). That confirms the API endpoint is reachable.', 'info');
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        addEntry('ERROR', `Cannot open URL on this device: ${url}`, 'error');
        return;
      }
      await Linking.openURL(url);
    } catch (err: unknown) {
      addEntry('ERROR', `Failed to open URL: ${getErrorMessage(err)}`, 'error');
    }
  };

  // -------------------------------------------------------------------------
  // Feature 3: Full Diagnostic
  // -------------------------------------------------------------------------

  const handleFullDiagnostic = async () => {
    if (isHostEmpty()) {
      addEntry('ERROR', 'Host field is empty. Enter an IP or domain above first.', 'error');
      return;
    }
    if (!bypassAuth && (!username.trim() || !password.trim())) {
      addEntry('ERROR', 'Username and password are required. Fill them in above, or enable "Bypass Authentication".', 'error');
      return;
    }

    // Clear previous results for a clean run
    setLog([]);
    idRef.current = 0;
    validatedSessionRef.current = null;

    const baseUrl = buildUrl();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);

    // Use setTimeout to let the clear render before we start adding entries
    await new Promise((r) => setTimeout(r, 50));

    addEntry('INFO', '--- Full Connection Diagnostic ---', 'info');
    addEntry('INFO', `Target: ${baseUrl}`, 'info');
    addEntry('INFO', `Platform: ${Platform.OS} ${Platform.Version}`, 'info');
    addEntry('INFO', `App: ${APP_VERSION}`, 'info');
    addEntry('INFO', `HTTPS: ${useHttps ? 'Yes' : 'No'} | Auth Bypass: ${bypassAuth ? 'Yes' : 'No'} | Basic Auth: ${useBasicAuth ? 'Yes' : 'No'}`, 'info');

    let passed = 0;
    const totalSteps = bypassAuth ? 2 : 4;
    let sessionCookie = '';

    try {
      // -- Step 1: Reachability -----------------------------------------------
      addEntry('REACH', 'Step 1 — Can the device reach the server?', 'info');
      const reachStart = Date.now();
      const reachTimeout = setTimeout(() => {
        if (!controller.signal.aborted) controller.abort();
      }, 15000);

      const basicAuth = buildBasicAuthHeader();
      const diagHeaders: Record<string, string> = {};
      if (basicAuth) diagHeaders['Authorization'] = basicAuth;

      try {
        let reachResp: Response;
        try {
          reachResp = await fetch(baseUrl, { method: 'HEAD', headers: diagHeaders, signal: controller.signal });
        } catch {
          if (controller.signal.aborted) throw new Error('Timed out after 15s');
          reachResp = await fetch(baseUrl, { method: 'GET', headers: diagHeaders, signal: controller.signal });
        }
        clearTimeout(reachTimeout);
        const reachLatency = Date.now() - reachStart;
        if (reachResp.status === 401 && useBasicAuth) {
          addEntry('REACH', `Server responded — HTTP ${reachResp.status} in ${reachLatency}ms (proxy credentials rejected — check Basic Auth username/password)`, 'warning');
          passed++;
        } else {
          addEntry('REACH', `Server responded — HTTP ${reachResp.status} in ${reachLatency}ms`, 'success');
          passed++;
        }
      } catch (err: unknown) {
        clearTimeout(reachTimeout);
        if (controller.signal.aborted && !getErrorMessage(err).includes('Timed out')) throw err;
        const reachLatency = Date.now() - reachStart;
        const msg = getErrorMessage(err) || 'Unknown error';
        addEntry('REACH', `FAILED — Server unreachable after ${reachLatency}ms`, 'error');

        if (msg.includes('Network request failed') || msg.includes('Failed to connect')) {
          addEntry('WARN', 'Your device cannot establish a connection to this address.\n\nChecklist:\n  1. Is the IP/domain correct?\n  2. Is qBittorrent running with WebUI enabled?\n  3. Is the port correct? (default: 8080)\n  4. Is a firewall blocking the connection?\n  5. If accessing remotely: is port forwarding or VPN set up?\n  6. Try "Open WebUI" above to test in a browser.', 'warning');
        } else if (msg.includes('Timed out') || msg.includes('timeout') || msg.includes('aborted')) {
          addEntry('WARN', 'The server did not respond within 15 seconds.\n\nThis usually means:\n  1. A firewall is silently dropping packets\n  2. The port is wrong (nothing is listening)\n  3. The server is too slow or overloaded\n\nTry "Open WebUI" above to verify in a browser.', 'warning');
        } else if (msg.includes('SSL') || msg.includes('certificate') || msg.includes('TLS')) {
          addEntry('WARN', 'SSL/TLS handshake failed. If you do not have HTTPS configured on your qBittorrent server, turn off the "Use HTTPS" toggle and try again.', 'warning');
        } else {
          addEntry('WARN', `Error: ${msg}`, 'warning');
        }
        addEntry('ERROR', 'Stopping diagnostic — cannot proceed without a reachable server.', 'error');
        return;
      }

      if (bypassAuth) {
        addEntry('INFO', 'Steps 2-3 skipped (auth bypass enabled).', 'info');
      } else {
        // -- Step 2: Login ----------------------------------------------------
        addEntry('LOGIN', 'Step 2 — Can the app log in?', 'info');
        const loginUrl = `${baseUrl}/api/v2/auth/login`;
        const loginStart = Date.now();
        try {
          const loginResp = await diagnosticHttp.post(
            loginUrl,
            `username=${encodeURIComponent(username.trim())}&password=${encodeURIComponent(password.trim())}`,
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(basicAuth ? { 'Authorization': basicAuth } : {}),
              },
              signal: controller.signal,
            },
          );
          const loginLatency = Date.now() - loginStart;
          const loginBody = typeof loginResp.data === 'string' ? loginResp.data : String(loginResp.data ?? '');
          const bodyTrimmed = loginBody.trim();
          const loginSetCookies = extractSetCookieValues(loginResp.headers);
          const loginCookiePresent = loginSetCookies.length > 0;

          if (isLoginBodyFail(bodyTrimmed)) {
            addEntry('LOGIN', `Login REJECTED — "${bodyTrimmed}" (HTTP ${loginResp.status}, ${loginLatency}ms)`, 'error');
            addEntry('WARN', 'The server said "Fails." which means the username or password is wrong.\n\nChecklist:\n  1. Double-check your username (default: admin)\n  2. Double-check your password\n  3. Check if qBittorrent has locked you out (too many failed attempts)\n  4. Try logging in via the browser first to confirm credentials work', 'warning');
            addEntry('ERROR', 'Stopping diagnostic — login failed.', 'error');
            return;
          } else if (loginResp.status === 404) {
            addEntry('LOGIN', `HTTP 404 — Login endpoint not found (${loginLatency}ms)`, 'error');
            addEntry('WARN', 'The /api/v2/auth/login endpoint does not exist. This could mean:\n  1. qBittorrent WebUI API is disabled\n  2. A reverse proxy is not forwarding /api/ paths\n  3. An incompatible qBittorrent version', 'warning');
            addEntry('ERROR', 'Stopping diagnostic — API endpoint missing.', 'error');
            return;
          } else if (
            isLoginSuccess({
              status: loginResp.status,
              body: loginBody,
              hasSessionCookie: loginCookiePresent,
            })
          ) {
            const detail = bodyTrimmed
              ? `"${bodyTrimmed.substring(0, 40)}"`
              : 'empty body (qBittorrent 5.x style)';
            addEntry('LOGIN', `Login successful — ${detail} (HTTP ${loginResp.status}, ${loginLatency}ms)`, 'success');
          } else {
            addEntry('LOGIN', `Unexpected response — "${bodyTrimmed.substring(0, 80)}" (HTTP ${loginResp.status}, ${loginLatency}ms)`, 'error');
            addEntry('ERROR', 'Stopping diagnostic — unexpected login response.', 'error');
            return;
          }
          passed++;

          // Log response headers for diagnosis
          const headerLines: string[] = [];
          const loginHeaders = loginResp.headers as unknown as Record<string, unknown>;
          for (const key of Object.keys(loginHeaders)) {
            const value = loginHeaders[key];
            headerLines.push(`  ${key}: ${Array.isArray(value) ? value.join('; ') : String(value)}`);
          }
          if (headerLines.length > 0) {
            addEntry('LOGIN', `Response headers:\n${headerLines.join('\n')}`, 'info');
          }

          // -- Step 3: Cookie Check -------------------------------------------
          addEntry('COOKIE', 'Step 3 — Was a session cookie received?', 'info');

          // The session cookie name is configurable in qBittorrent 5.x (e.g.
          // QBT_SID_8080), so capture whatever name=value pair the server
          // sent instead of insisting on the classic `SID` name — exactly
          // like the real app's client.ts interceptor does.
          const cookiePair = pickSessionCookiePair(loginSetCookies);

          if (cookiePair) {
            sessionCookie = cookiePair;
            const eqIdx = cookiePair.indexOf('=');
            const cookieName = cookiePair.substring(0, eqIdx);
            const cookieValue = cookiePair.substring(eqIdx + 1);
            const truncated = cookieValue.length > 12
              ? cookieValue.substring(0, 12) + '...'
              : cookieValue;
            addEntry('COOKIE', `Session cookie captured: ${cookieName}=${truncated}`, 'success');
            passed++;
          } else {
            addEntry('COOKIE', 'No set-cookie header received from server.', 'warning');
            addEntry('WARN', 'The server genuinely did not send a session cookie for this login. This is expected if qBittorrent is configured to bypass authentication for this device\'s IP/subnet, or if this qBittorrent version/setup authenticates purely via the response body without issuing a cookie.\n\nIf the app still gets "403 Forbidden" errors after this:\n\n  1. In qBittorrent: Settings > WebUI > enable "Bypass authentication for clients in whitelisted IP subnets"\n  2. Add your device\'s IP or subnet (e.g. 192.168.1.0/24 or 100.0.0.0/8 for Tailscale)\n  3. Then enable "Bypass Authentication" in qBitRemote', 'warning');
            passed++; // Not a hard failure — server may intentionally omit the cookie
          }
        } catch (err: unknown) {
          if (controller.signal.aborted) throw err;
          const loginLatency = Date.now() - loginStart;
          addEntry('LOGIN', `Login request FAILED after ${loginLatency}ms`, 'error');
          addEntry('WARN', `Error: ${getErrorMessage(err)}\n\nThe server is reachable (Step 1 passed) but the login request failed. This could mean:\n  1. qBittorrent has IP-based access restrictions blocking this device\n  2. A reverse proxy is rejecting the POST request\n  3. If using Tailscale/VPN: the WebUI may only be listening on localhost (127.0.0.1) — change it to 0.0.0.0 in qBittorrent settings`, 'warning');
          addEntry('ERROR', 'Stopping diagnostic.', 'error');
          return;
        }
      }

      // -- Step 4: API Version Check ----------------------------------------
      addEntry('API', 'Step 4 — Can the app access the API after login?', 'info');
      const versionUrl = `${baseUrl}/api/v2/app/version`;
      const apiStart = Date.now();
      try {
        const headers: Record<string, string> = {};
        if (sessionCookie) {
          headers['Cookie'] = sessionCookie;
        }
        if (basicAuth) {
          headers['Authorization'] = basicAuth;
        }
        const apiResp = await diagnosticHttp.get(versionUrl, {
          headers,
          signal: controller.signal,
        });
        const apiLatency = Date.now() - apiStart;
        const apiBody = typeof apiResp.data === 'string' ? apiResp.data : String(apiResp.data ?? '');

        if (apiResp.status === 200) {
          addEntry('API', `qBittorrent ${apiBody.trim()} (HTTP ${apiResp.status}, ${apiLatency}ms)`, 'success');
          passed++;
          // This proves the session (cookie/basic-auth combo) actually works
          // end-to-end — remember it so "Export Full Logs" can fetch server
          // logs using it instead of depending on the unrelated apiClient
          // singleton.
          validatedSessionRef.current = { configKey: buildConfigKey(), baseUrl, sessionCookie, basicAuth };
        } else if (apiResp.status === 403) {
          addEntry('API', `HTTP 403 Forbidden — Not authenticated (${apiLatency}ms)`, 'error');
          if (!bypassAuth && !sessionCookie) {
            addEntry('WARN', 'Login succeeded (Step 2) but no session cookie was captured (Step 3), so this API request was rejected.\n\nSolution:\n  1. In qBittorrent: Settings > WebUI > "Bypass authentication for clients in whitelisted IP subnets"\n  2. Add your device\'s IP or subnet\n  3. Enable "Bypass Authentication" toggle in qBitRemote', 'warning');
          } else if (bypassAuth) {
            addEntry('WARN', 'Auth bypass is enabled, but the server still requires authentication.\n\nIn qBittorrent: Settings > WebUI:\n  1. Enable "Bypass authentication for clients in whitelisted IP subnets"\n  2. Add your device\'s IP or subnet to the whitelist', 'warning');
          } else {
            addEntry('WARN', 'The session cookie was sent but the server rejected it. The cookie may have expired or is invalid. Try running the diagnostic again.', 'warning');
          }
        } else {
          addEntry('API', `Unexpected — HTTP ${apiResp.status}: "${apiBody.trim().substring(0, 100)}" (${apiLatency}ms)`, 'warning');
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) throw err;
        const apiLatency = Date.now() - apiStart;
        addEntry('API', `API request failed after ${apiLatency}ms — ${getErrorMessage(err)}`, 'error');
      }
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : '';
      if (
        errName === 'AbortError' ||
        errName === 'CanceledError' ||
        getErrorMessage(err) === 'Cancelled' ||
        controller.signal.aborted
      ) {
        addEntry('INFO', 'Diagnostic cancelled.', 'info');
        return;
      }
      addEntry('ERROR', `Unexpected error: ${getErrorMessage(err)}`, 'error');
    } finally {
      if (!controller.signal.aborted) {
        addEntry('INFO', '', 'info'); // spacer
        if (passed === totalSteps) {
          addEntry('INFO', `All ${totalSteps} checks passed. Your server should connect normally. If the app still fails to connect, copy this report and open an issue on GitHub.`, 'success');
        } else {
          addEntry('INFO', `${passed}/${totalSteps} checks passed. Review the issues above and try the suggested fixes.`, passed > 0 ? 'warning' : 'error');
        }
      }
      abortRef.current = null;
      setRunning(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  };

  // -------------------------------------------------------------------------
  // Feature 4: Copy Report
  // -------------------------------------------------------------------------

  const handleCopyReport = async () => {
    const baseUrl = buildUrl();
    const clean = sanitizeHost(host);
    const portNum = port.trim() ? parseInt(port, 10) : undefined;

    const lines = [
      '=== qBitRemote Diagnostic Report ===',
      `App Version: ${APP_VERSION}`,
      `Platform: ${Platform.OS} ${Platform.Version}`,
      `Date: ${new Date().toISOString()}`,
      '',
      `URL: ${baseUrl}`,
      `Host: ${clean || '(empty)'}`,
      `Port: ${portNum || 'default (80/443)'}`,
      `HTTPS: ${useHttps ? 'Yes' : 'No'}`,
      `Auth Bypass: ${bypassAuth ? 'Yes' : 'No'}`,
      `Basic Auth: ${useBasicAuth ? 'Yes' : 'No'}`,
      '',
      '--- Diagnostic Log ---',
      ...log.map((e) => `${formatTime(e.timestamp)} [${e.step}] ${e.message}`),
    ];

    if (log.length === 0) {
      lines.push('(no diagnostic entries — run a test first)');
    }

    try {
      await Clipboard.setStringAsync(lines.join('\n'));
      addEntry('INFO', 'Full report copied to clipboard.', 'success');
    } catch (err: unknown) {
      addEntry('ERROR', `Failed to copy: ${getErrorMessage(err)}`, 'error');
    }
  };

  // -------------------------------------------------------------------------
  // Feature 5: Clear Log
  // -------------------------------------------------------------------------

  const handleClear = () => {
    setLog([]);
    idRef.current = 0;
  };

  // -------------------------------------------------------------------------
  // Feature 6: Export Full Logs
  // -------------------------------------------------------------------------

  const [exporting, setExporting] = useState(false);

  const handleExportLogs = async () => {
    setExporting(true);
    addEntry('INFO', 'Preparing log export...', 'info');

    try {
      const baseUrl = buildUrl();
      const clean = sanitizeHost(host);
      const portNum = port.trim() ? parseInt(port, 10) : undefined;
      const now = new Date();

      // --- Section 1: Header ---
      const header = [
        '╔══════════════════════════════════════════════════╗',
        '║          qBitRemote — Full Log Export            ║',
        '╚══════════════════════════════════════════════════╝',
        '',
        `Generated: ${now.toISOString()}`,
        `App Version: ${APP_VERSION}`,
        `Platform: ${Platform.OS} ${Platform.Version}`,
        '',
      ];

      // --- Section 2: Server Configuration ---
      const configSection = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        'SERVER CONFIGURATION',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `URL: ${baseUrl}`,
        `Host: ${clean || '(empty)'}`,
        `Port: ${portNum || 'default (80/443)'}`,
        `HTTPS: ${useHttps ? 'Yes' : 'No'}`,
        `Auth Bypass: ${bypassAuth ? 'Yes' : 'No'}`,
        `Basic Auth: ${useBasicAuth ? 'Yes' : 'No'}`,
        `Username: ${username ? '(set)' : '(empty)'}`,
        '',
      ];

      // --- Section 3: Diagnostic Panel Log ---
      const diagSection = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        'DIAGNOSTIC PANEL LOG',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ];
      if (log.length > 0) {
        diagSection.push(
          ...log.map(
            (e) => `${formatTime(e.timestamp)} [${e.step}] ${e.message}`,
          ),
        );
      } else {
        diagSection.push('(no diagnostic entries — run a test first)');
      }
      diagSection.push('');

      // --- Section 4: App Connectivity Log ---
      const connectivitySection = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        'APP CONNECTIVITY LOG (this session)',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        formatConnectivityLog(),
        '',
      ];

      // --- Section 5: qBittorrent Server Logs (if connected) ---
      const serverLogSection: string[] = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        'qBITTORRENT SERVER LOGS',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ];

      // Prefer the diagnostic's own already-validated session (proven working
      // by Step 4 above, using this screen's own host/credentials) over the
      // shared apiClient singleton, whose "current server" reflects unrelated
      // app-wide connection lifecycle and can be null even when this exact
      // diagnostic just succeeded. Only trust it while the form still matches
      // the config it was validated against.
      const validatedSession = validatedSessionRef.current?.configKey === buildConfigKey()
        ? validatedSessionRef.current
        : null;

      if (validatedSession) {
        const logHeaders: Record<string, string> = {};
        if (validatedSession.sessionCookie) logHeaders['Cookie'] = validatedSession.sessionCookie;
        if (validatedSession.basicAuth) logHeaders['Authorization'] = validatedSession.basicAuth;

        try {
          const mainLogResp = await fetch(
            `${validatedSession.baseUrl}/api/v2/log/main?normal=1&info=1&warning=1&critical=1`,
            { method: 'GET', headers: logHeaders, credentials: 'omit' },
          );
          if (!mainLogResp.ok) throw new Error(`HTTP ${mainLogResp.status}`);
          const appLogs = (await mainLogResp.json()) as { id: number; message: string; timestamp: number; type: number }[];

          if (appLogs.length > 0) {
            serverLogSection.push('');
            serverLogSection.push(`--- Application Logs (${appLogs.length} entries) ---`);
            const sorted = [...appLogs].sort((a, b) => a.id - b.id);
            for (const entry of sorted) {
              const typeLabel =
                entry.type === 1 ? 'NORMAL' :
                entry.type === 2 ? 'WARNING' :
                entry.type === 4 ? 'CRITICAL' : 'INFO';
              const ts = new Date(entry.timestamp * 1000).toISOString().replace('T', ' ').replace('Z', '');
              serverLogSection.push(`${ts} [${typeLabel}] ${entry.message}`);
            }
          } else {
            serverLogSection.push('(no application log entries returned from server)');
          }

          try {
            const peerLogResp = await fetch(
              `${validatedSession.baseUrl}/api/v2/log/peers`,
              { method: 'GET', headers: logHeaders, credentials: 'omit' },
            );
            if (!peerLogResp.ok) throw new Error(`HTTP ${peerLogResp.status}`);
            const peerLogs = (await peerLogResp.json()) as { id: number; ip: string; port: number; connection: string; flags: string; client: string }[];
            if (peerLogs.length > 0) {
              serverLogSection.push('');
              serverLogSection.push(`--- Peer Logs (${peerLogs.length} entries) ---`);
              const sortedPeers = [...peerLogs].sort((a, b) => a.id - b.id);
              for (const entry of sortedPeers) {
                const ts = new Date(entry.id * 1000).toISOString().replace('T', ' ').replace('Z', '');
                serverLogSection.push(
                  `${ts} ${entry.ip}:${entry.port} | ${entry.client} | ${entry.connection} | flags=${entry.flags}`,
                );
              }
            } else {
              serverLogSection.push('');
              serverLogSection.push('(no peer log entries returned from server)');
            }
          } catch {
            serverLogSection.push('');
            serverLogSection.push('(failed to fetch peer logs)');
          }
        } catch (err: unknown) {
          serverLogSection.push(`(could not fetch server logs using this screen's validated diagnostic session: ${getErrorMessage(err)})`);
        }
      } else if (apiClient.getServer()) {
        try {
          // Fetch application logs (all levels)
          const appLogs = await logsApi.getLog(true, true, true, true);
          if (appLogs.length > 0) {
            serverLogSection.push('');
            serverLogSection.push(`--- Application Logs (${appLogs.length} entries) ---`);
            const sorted = [...appLogs].sort((a, b) => a.id - b.id);
            for (const entry of sorted) {
              const typeLabel =
                entry.type === 1 ? 'NORMAL' :
                entry.type === 2 ? 'WARNING' :
                entry.type === 4 ? 'CRITICAL' : 'INFO';
              const ts = new Date(entry.timestamp * 1000).toISOString().replace('T', ' ').replace('Z', '');
              serverLogSection.push(`${ts} [${typeLabel}] ${entry.message}`);
            }
          } else {
            serverLogSection.push('(no application log entries returned from server)');
          }

          // Fetch peer logs
          try {
            const peerLogs = await logsApi.getPeerLog();
            if (peerLogs.length > 0) {
              serverLogSection.push('');
              serverLogSection.push(`--- Peer Logs (${peerLogs.length} entries) ---`);
              const sortedPeers = [...peerLogs].sort((a, b) => a.id - b.id);
              for (const entry of sortedPeers) {
                const ts = new Date(entry.id * 1000).toISOString().replace('T', ' ').replace('Z', '');
                serverLogSection.push(
                  `${ts} ${entry.ip}:${entry.port} | ${entry.client} | ${entry.connection} | flags=${entry.flags}`,
                );
              }
            } else {
              serverLogSection.push('');
              serverLogSection.push('(no peer log entries returned from server)');
            }
          } catch {
            serverLogSection.push('');
            serverLogSection.push('(failed to fetch peer logs)');
          }
        } catch (err: unknown) {
          serverLogSection.push(`(could not fetch server logs: ${getErrorMessage(err)})`);
        }
      } else {
        serverLogSection.push('(not connected — run "Run Full Diagnostic" above first to include this server\'s logs in the report)');
      }
      serverLogSection.push('');

      // --- Section 6: Raw Connectivity Log Entries (JSON) ---
      const rawSection = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        'RAW CONNECTIVITY LOG (JSON, for developer use)',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ];
      const connEntries = getConnectivityLog();
      if (connEntries.length > 0) {
        rawSection.push(JSON.stringify(connEntries, null, 2));
      } else {
        rawSection.push('[]');
      }
      rawSection.push('');

      // --- Assemble ---
      const fullReport = [
        ...header,
        ...configSection,
        ...diagSection,
        ...connectivitySection,
        ...serverLogSection,
        ...rawSection,
        '═══ End of Report ═══',
      ].join('\n');

      // Write to file
      const docDir = FileSystem.documentDirectory;
      if (!docDir) {
        addEntry('ERROR', 'File system not available.', 'error');
        return;
      }

      const dateStr = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `qBitRemote-logs-${dateStr}.txt`;
      const fileUri = `${docDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, fullReport);

      if (await Sharing.isAvailableAsync()) {
        const shareOptions: Sharing.SharingOptions = {
          mimeType: 'text/plain',
          dialogTitle: 'Export qBitRemote Logs',
        };
        if (Platform.OS === 'ios') {
          shareOptions.UTI = 'public.plain-text';
        }
        await Sharing.shareAsync(fileUri, shareOptions);
        addEntry('INFO', 'Logs exported successfully.', 'success');
      } else {
        // Fallback: copy to clipboard
        await Clipboard.setStringAsync(fullReport);
        addEntry('INFO', 'Sharing unavailable — full report copied to clipboard instead.', 'warning');
      }
    } catch (err: unknown) {
      addEntry('ERROR', `Export failed: ${getErrorMessage(err)}`, 'error');
      Alert.alert('Export Failed', getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  // -------------------------------------------------------------------------
  // UI Helpers
  // -------------------------------------------------------------------------

  const getStepColor = (status: DiagnosticStatus): string => {
    switch (status) {
      case 'success': return colors.success;
      case 'warning': return colors.warning;
      case 'error': return colors.error;
      case 'info':
      default: return colors.primary;
    }
  };

  const getStepIcon = (status: DiagnosticStatus): React.ComponentProps<typeof Ionicons>['name'] => {
    switch (status) {
      case 'success': return 'checkmark-circle';
      case 'warning': return 'warning';
      case 'error': return 'alert-circle';
      case 'info':
      default: return 'information-circle';
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Section label */}
      <View style={styles.sectionLabelRow}>
        <Ionicons name="hardware-chip-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>NETWORK DIAGNOSTICS</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handlePing}
          disabled={pinging || running}
        >
          {pinging ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="pulse-outline" size={16} color="#FFFFFF" style={styles.buttonIcon} />
          )}
          <Text style={styles.actionButtonText}>{pinging ? 'Pinging...' : 'Ping Host'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleOpenWebUI}
          disabled={running}
        >
          <Ionicons name="open-outline" size={16} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.actionButtonText}>Open WebUI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleOpenLoginAPI}
          disabled={running}
        >
          <Ionicons name="key-outline" size={16} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.actionButtonText}>Test API</Text>
        </TouchableOpacity>
      </View>

      {/* Full Diagnostic Button */}
      {running ? (
        <View style={styles.runningRow}>
          <View style={styles.runningContent}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.runningText, { color: colors.text }]}>Running diagnostic...</Text>
          </View>
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: colors.error }]}
            onPress={handleCancel}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.diagButton, { backgroundColor: colors.primary }]}
          onPress={handleFullDiagnostic}
          disabled={pinging}
        >
          <Ionicons name="medkit-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.diagButtonText}>Run Full Diagnostic</Text>
        </TouchableOpacity>
      )}

      {/* Export Logs Button */}
      <TouchableOpacity
        style={[styles.exportButton, { backgroundColor: colors.success }]}
        onPress={handleExportLogs}
        disabled={running || exporting}
      >
        {exporting ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.buttonIcon} />
        ) : (
          <Ionicons name="download-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
        )}
        <Text style={styles.exportButtonText}>
          {exporting ? 'Preparing Export...' : 'Export Full Logs'}
        </Text>
      </TouchableOpacity>

      {/* Diagnostic Log */}
      {log.length > 0 && (
        <>
          <View style={[styles.logSeparator, { backgroundColor: colors.surfaceOutline }]} />
          <View style={styles.logHeader}>
            <Text style={[styles.logTitle, { color: colors.text }]}>Results</Text>
            <View style={styles.logActions}>
              <TouchableOpacity onPress={handleCopyReport} style={styles.logActionBtn}>
                <Ionicons name="copy-outline" size={14} color={colors.primary} />
                <Text style={[styles.logActionText, { color: colors.primary }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClear} style={styles.logActionBtn}>
                <Ionicons name="trash-outline" size={14} color={colors.error} />
                <Text style={[styles.logActionText, { color: colors.error }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.logScroll}
            contentContainerStyle={styles.logScrollContent}
            nestedScrollEnabled
          >
            {log.map((entry) => (
              <View
                key={entry.id}
                style={[
                  styles.logEntry,
                  { borderLeftColor: getStepColor(entry.status) },
                ]}
              >
                {entry.message.length > 0 && (
                  <>
                    <View style={styles.logEntryHeader}>
                      <Ionicons
                        name={getStepIcon(entry.status)}
                        size={13}
                        color={getStepColor(entry.status)}
                      />
                      <Text style={[styles.logStepBadge, { color: getStepColor(entry.status) }]}>
                        {entry.step}
                      </Text>
                      <Text style={[styles.logTimestamp, { color: colors.textSecondary }]}>
                        {formatTime(entry.timestamp)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.logMessage, { color: colors.text }]}
                      selectable
                    >
                      {entry.message}
                    </Text>
                  </>
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.small,
    minHeight: 36,
  },
  buttonIcon: {
    marginRight: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  diagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    minHeight: 46,
  },
  diagButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    minHeight: 46,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  runningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    minHeight: 46,
  },
  runningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  runningText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.small,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logSeparator: {
    height: 1,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  logTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  logActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  logActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  logActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logScroll: {
    maxHeight: 450,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  logScrollContent: {
    paddingBottom: spacing.sm,
  },
  logEntry: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: 3,
    marginBottom: 2,
  },
  logEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
  },
  logStepBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logTimestamp: {
    fontSize: 10,
    marginLeft: 'auto',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMessage: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
