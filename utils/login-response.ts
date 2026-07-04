/**
 * Shared success/failure interpretation for qBittorrent /api/v2/auth/login
 * responses, used by both the API client (services/api/auth.ts) and the
 * connection diagnostic (components/SuperDebugPanel.tsx).
 *
 * Response matrix across qBittorrent versions:
 *   v4.x: HTTP 200 with body "Ok." on success, "Fails." on bad credentials
 *   v5.x: HTTP 204 No Content with empty body + Set-Cookie on success,
 *         401/403 on failure
 *
 * React Native's networking layer often strips Set-Cookie headers before
 * JS can read them, so a bare HTTP 204 must count as success on its own.
 */

export interface LoginResponseInfo {
  /** HTTP status code, when the caller has access to it. */
  status?: number;
  /** Raw response body text ('' when empty). */
  body: string;
  /** Whether a session cookie was observed (Set-Cookie header or cookie jar). */
  hasSessionCookie?: boolean;
}

export function isLoginBodyOk(body: string): boolean {
  const trimmed = body.trim();
  return trimmed === 'Ok.' || trimmed === 'Ok';
}

export function isLoginBodyFail(body: string): boolean {
  const trimmed = body.trim();
  return trimmed === 'Fails.' || trimmed === 'Fails';
}

export function isLoginSuccess({ status, body, hasSessionCookie = false }: LoginResponseInfo): boolean {
  if (isLoginBodyOk(body)) return true;
  if (isLoginBodyFail(body)) return false;
  // qBittorrent 5.x success — empty body, cookie may be invisible to JS.
  if (status === 204) return true;
  // A session cookie is the source of truth when the body is inconclusive
  // (e.g. a reverse proxy rewrote it). Status unknown counts as 2xx here so
  // the axios path (which never sees the status) keeps its existing behavior.
  const is2xx = status === undefined || (status >= 200 && status < 300);
  return is2xx && hasSessionCookie;
}
