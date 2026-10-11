/**
 * quiProxy.ts — Pure helpers for connecting through a qui "Client Proxy" (#272).
 *
 * qui (https://getqui.com) is a qBittorrent web UI whose reverse proxy hands
 * out a Client API key and a ready-made proxy URL of the form
 * `http(s)://host[:port][/qui-base]/proxy/<key>`. Clients use that URL as the
 * qBittorrent address with NO username/password: qui validates the key from
 * the path segment, answers `/api/v2/auth/login` with a no-op "Ok.", and
 * passes everything else through to the real qBittorrent.
 *
 * ServerConfig has no URL-path field of its own, so a qui server is modeled
 * as host/port/useHttps/basePath (= the qui base path) plus a secret
 * `quiProxyKey`; the client re-joins `<basePath>/proxy/<key>` at request time
 * (see withQuiProxyPath). Because the key lives in the URL path, anything that
 * logs or displays a URL must run it through redactQuiProxyKey.
 *
 * Key exports: parseQuiProxyUrl, detectQuiProxyUrlInHost, buildQuiProxyUrl, withQuiProxyPath,
 *   redactQuiProxyKey, QUI_KEY_REJECTED_MESSAGE, QUI_KEY_MISSING_MESSAGE, isQuiKeyRejection
 */
import { ServerConfig } from '@/types/api';

/** Shown in place of the proxy key wherever a URL is displayed or logged. */
export const QUI_KEY_MASK = '••••';

/**
 * Message thrown (by services/api/client.ts) when qui answers 401 "Invalid API
 * key" / "Missing API key" for a request to a qui-mode server. Callers
 * substring-match it via isQuiKeyRejection — keep the two in sync.
 */
export const QUI_KEY_REJECTED_MESSAGE = 'qui rejected the proxy key. Check the proxy URL.';

/**
 * Message when a qui-mode server has no stored proxy key — e.g. one imported
 * from an export file (exports never carry secrets) and not yet re-entered.
 */
export const QUI_KEY_MISSING_MESSAGE =
  'This qui server has no proxy key. Edit it and paste the proxy URL again.';

/** True when an error (or message) is the qui key rejection above. */
export function isQuiKeyRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes(QUI_KEY_REJECTED_MESSAGE);
}

export type QuiProxyParseError =
  /** Nothing (or only whitespace) was entered. */
  | 'empty'
  /** Not an explicit http:// or https:// URL. */
  | 'scheme'
  /** Missing/unusable host, or credentials/query/fragment present. */
  | 'host'
  /** Port is not an integer in 1–65535. */
  | 'port'
  /** URL does not end in `/proxy/<key>`. */
  | 'proxyPath';

export type QuiProxyParseResult =
  | {
      ok: true;
      useHttps: boolean;
      host: string;
      port?: number;
      /** The qui base path (`/` when qui is served from the root), never including `/proxy/<key>`. */
      basePath: string;
      key: string;
    }
  | { ok: false; error: QuiProxyParseError };

/**
 * Parse a qui Client Proxy URL — `http(s)://host[:port][/qui-base]/proxy/<key>[/]`.
 *
 * Hand-rolled rather than `new URL()`: React Native's URL polyfill is partial
 * and this needs to behave identically under Hermes and jest. The scheme must
 * be explicit (no guessing), and anything that would make the key ambiguous —
 * userinfo, a query string, a fragment, or path segments after the key — is
 * rejected rather than silently dropped.
 */
export function parseQuiProxyUrl(input: string): QuiProxyParseResult {
  const text = (input ?? '').trim();
  if (!text) return { ok: false, error: 'empty' };

  const schemeMatch = /^(https?):\/\/(.*)$/i.exec(text);
  if (!schemeMatch) return { ok: false, error: 'scheme' };
  const useHttps = schemeMatch[1].toLowerCase() === 'https';
  const rest = schemeMatch[2];

  if (/[\s?#]/.test(rest)) return { ok: false, error: 'host' };

  const slash = rest.indexOf('/');
  const authority = slash === -1 ? rest : rest.slice(0, slash);
  const path = slash === -1 ? '' : rest.slice(slash);

  // Host (optionally an IPv6 literal in brackets) plus an optional :port.
  // Userinfo (user:pass@) has no place here — auth is the path key.
  if (authority.includes('@')) return { ok: false, error: 'host' };
  const authorityMatch = /^(\[[0-9a-fA-F:.]+\]|[^:@[\]/]+)(?::(.*))?$/.exec(authority);
  if (!authorityMatch) return { ok: false, error: 'host' };
  const host = authorityMatch[1];

  let port: number | undefined;
  if (authorityMatch[2] !== undefined) {
    if (!/^\d+$/.test(authorityMatch[2])) return { ok: false, error: 'port' };
    port = Number(authorityMatch[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: 'port' };
  }

  // Empty segments (`//`, trailing `/`) are noise, not part of the key.
  const segments = path.split('/').filter((segment) => segment.length > 0);
  const keySegment = segments[segments.length - 1];
  if (segments.length < 2 || segments[segments.length - 2] !== 'proxy' || !keySegment) {
    return { ok: false, error: 'proxyPath' };
  }
  const baseSegments = segments.slice(0, -2);

  return {
    ok: true,
    useHttps,
    host,
    port,
    basePath: baseSegments.length > 0 ? `/${baseSegments.join('/')}` : '/',
    key: keySegment,
  };
}

/**
 * qui generates Client API keys as 32 random bytes in hex (64 chars). Matching
 * 32+ hex chars keeps host-field detection from firing on a real qBittorrent
 * that happens to sit behind a reverse proxy at `/proxy/<name>`.
 */
const QUI_GENERATED_KEY = /^[0-9a-f]{32,}$/i;

/**
 * Detect a qui proxy URL typed or pasted into the plain Host field (#278).
 * That can never connect: the Port field is appended after the whole host, so
 * the request goes to `/proxy/<key>:<port>/…` and qui rejects the key it sees.
 * Returns the URL to move into the qui Proxy field (a scheme-less paste gets
 * one from the HTTPS toggle), or null when the text isn't a qui proxy URL.
 */
export function detectQuiProxyUrlInHost(hostText: string, useHttps: boolean): string | null {
  const text = (hostText ?? '').trim();
  if (!/\/proxy\//i.test(text)) return null;
  const url = /^https?:\/\//i.test(text) ? text : `${useHttps ? 'https' : 'http'}://${text}`;
  const parsed = parseQuiProxyUrl(url);
  return parsed.ok && QUI_GENERATED_KEY.test(parsed.key) ? url : null;
}

/**
 * Join a qui base path and key into the request path `/<base>/proxy/<key>`,
 * normalizing slashes (the base may be `/`, `''`, `/qui`, or `qui/`).
 */
export function withQuiProxyPath(basePath: string | undefined, key: string): string {
  const baseSegments = (basePath ?? '').split('/').filter((segment) => segment.length > 0);
  return `/${[...baseSegments, 'proxy', key].join('/')}`;
}

/**
 * Rebuild the proxy URL a user would paste, from a stored qui server — used to
 * repopulate the edit screen. With no key (e.g. a server imported from an
 * export, which never carries secrets) the URL ends at `/proxy/` so the user
 * only has to append their key.
 */
export function buildQuiProxyUrl(
  server: Pick<ServerConfig, 'host' | 'port' | 'useHttps' | 'basePath' | 'quiProxyKey'>,
): string {
  const host = (server.host || '').trim();
  if (!host) return '';
  const scheme = server.useHttps ? 'https' : 'http';
  const portPart = server.port && server.port > 0 ? `:${server.port}` : '';
  const key = server.quiProxyKey ?? '';
  const path = withQuiProxyPath(server.basePath, key);
  // withQuiProxyPath leaves a trailing slash when the key is empty ('/proxy/').
  return `${scheme}://${host}${portPart}${path}`;
}

/**
 * Replace the key segment after `/proxy/` with a mask, anywhere in a string.
 * Over-redacts rather than under-redacts: the key is taken to run to the next
 * whitespace, `/`, `?`, `#`, quote, bracket or comma.
 */
export function redactQuiProxyKey(text: string): string {
  if (!text) return text;
  return text.replace(/(\/proxy\/)[^/\s?#'"`<>()[\],;]+/gi, `$1${QUI_KEY_MASK}`);
}
