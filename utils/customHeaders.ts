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
  return RESERVED_HEADER_NAMES.has(name.trim().toLowerCase());
}

/** Trim every pair and drop rows left fully blank. Used before persisting and before sending. */
export function sanitizeCustomHeaders(headers: CustomHeaderPair[] | undefined): CustomHeaderPair[] {
  if (!headers) return [];
  return headers
    .map((header) => ({ key: header.key.trim(), value: header.value.trim() }))
    .filter((header) => header.key.length > 0 && header.value.length > 0);
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
