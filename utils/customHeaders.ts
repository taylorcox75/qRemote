/**
 * customHeaders.ts — Validation and sanitization for per-server custom HTTP headers (#228).
 *
 * Headers are sent on every request to support reverse-proxy/tunnel setups
 * (Pangolin, Cloudflare Access, etc.) that gate access with their own header
 * based token auth, layered independently of qBittorrent's own auth.
 *
 * Key exports: CustomHeaderPair, isReservedHeaderName, sanitizeCustomHeaders, validateCustomHeaders
 */

export interface CustomHeaderPair {
  key: string;
  value: string;
}

/**
 * Header names qRemote already manages. Letting a custom header collide with
 * one of these would silently break auth, cookie handling, or CORS instead of
 * doing what the user intended.
 */
const RESERVED_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'referer',
  'origin',
  'content-type',
  'host',
]);

export function isReservedHeaderName(name: string): boolean {
  if (typeof name !== 'string') return false;
  return RESERVED_HEADER_NAMES.has(name.trim().toLowerCase());
}

/**
 * Parse the SecureStore payload back into header pairs.
 *
 * Deliberately paranoid: this is persisted data in an app with no migration
 * system, so anything already on a device is there forever. Validates the
 * *shape* of each entry, not just that the JSON parses — a well-formed
 * `[{"key": 123}]` would otherwise reach `isReservedHeaderName` and throw on
 * `.trim()`. Anything unrecognized degrades to [] rather than propagating.
 */
export function parseStoredCustomHeaders(raw: string | null | undefined): CustomHeaderPair[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (entry): entry is CustomHeaderPair =>
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as CustomHeaderPair).key === 'string' &&
      typeof (entry as CustomHeaderPair).value === 'string',
  );
}

function isCustomHeaderPair(entry: unknown): entry is CustomHeaderPair {
  return (
    !!entry &&
    typeof entry === 'object' &&
    typeof (entry as CustomHeaderPair).key === 'string' &&
    typeof (entry as CustomHeaderPair).value === 'string'
  );
}

/**
 * Trim every pair, drop rows left blank, and drop reserved names. Used before
 * persisting and before sending.
 *
 * Tolerates arbitrary input rather than trusting the declared type: the
 * settings-import path spreads unvalidated JSON into a ServerConfig, so this
 * can genuinely receive a non-array or malformed entries at runtime.
 */
export function sanitizeCustomHeaders(headers: CustomHeaderPair[] | undefined): CustomHeaderPair[] {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter(isCustomHeaderPair)
    .map((header) => ({ key: header.key.trim(), value: header.value.trim() }))
    .filter(
      (header) =>
        header.key.length > 0 && header.value.length > 0 && !isReservedHeaderName(header.key),
    );
}

export type CustomHeaderValidationError = 'empty' | 'incomplete' | 'reserved';

export interface CustomHeaderValidation {
  valid: boolean;
  error?: CustomHeaderValidationError;
  reservedName?: string;
}

/**
 * Validates the raw (unsanitized) row state from the add/edit server forms.
 * Called only when the "use custom headers" toggle is on, mirroring how
 * useBasicAuth requires a username.
 */
export function validateCustomHeaders(headers: CustomHeaderPair[]): CustomHeaderValidation {
  const nonBlankRows = headers.filter((header) => header.key.trim() || header.value.trim());
  if (nonBlankRows.length === 0) {
    return { valid: false, error: 'empty' };
  }
  for (const header of nonBlankRows) {
    if (!header.key.trim() || !header.value.trim()) {
      return { valid: false, error: 'incomplete' };
    }
    if (isReservedHeaderName(header.key)) {
      return { valid: false, error: 'reserved', reservedName: header.key.trim() };
    }
  }
  return { valid: true };
}
