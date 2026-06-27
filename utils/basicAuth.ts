/**
 * basicAuth.ts — HTTP Basic Auth header encoder.
 *
 * Uses a byte-level base64 implementation to correctly handle non-ASCII
 * characters in usernames/passwords. Hermes' native `btoa` is latin1-only
 * and throws on any codepoint > 255; this avoids that limitation.
 *
 * Key exports: basicAuthHeader
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode a UTF-8 string to base64 without relying on btoa.
 * Works on Hermes (React Native) with any Unicode input.
 */
function encodeBase64(input: string): string {
  // Encode to UTF-8 bytes
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      // Surrogate pair — decode full code point
      const hi = code;
      const lo = input.charCodeAt(++i);
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  // Encode bytes to base64
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? BASE64_CHARS[b2 & 63] : '=';
  }
  return result;
}

/**
 * Build the value for an HTTP `Authorization: Basic …` header.
 * The credentials are encoded as `username:password` in base64 (RFC 7617).
 */
export function basicAuthHeader(username: string, password: string): string {
  return 'Basic ' + encodeBase64(`${username}:${password}`);
}
