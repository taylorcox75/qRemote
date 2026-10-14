import { AxiosError } from 'axios';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isAxiosError(error: unknown): error is AxiosError {
  return error instanceof AxiosError || (error instanceof Error && 'isAxiosError' in error);
}

/**
 * HTTP status attached by the API client's error normalizer, when the request
 * got a response. Lets callers branch on the status instead of substring-matching
 * the human-readable message.
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof Error && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

/**
 * "certificate" in each of the locales this app ships (see
 * locales/*\/translation.json), plus the language-neutral technical terms
 * "SSL"/"TLS" that iOS's error descriptions tend to carry regardless of
 * device language. Used to recognize a TLS-rejection failure (NSURLError
 * -1202 and friends) from free-text error descriptions that are localized
 * to the device's language — matching only the English word would miss
 * most non-English users.
 */
const TLS_REJECTION_KEYWORDS = [
  'ssl',
  'tls',
  'certificate', // en
  'certificado', // es
  '证书', // zh
  'certificat', // fr
  'zertifikat', // de
  'сертификат', // ru
  'certyfikat', // pl
  'sertifika', // tr
];

/**
 * Best-effort text to sniff for TLS-rejection wording. iOS's rejected-cert
 * failure surfaces to JS as a plain ERR_NETWORK with no error code
 * preserved — the useful detail (the native NSError's localizedDescription)
 * is not on the error at all, but React Native's XHR bridge stashes it in
 * the response body on error instead of forwarding the NSURLErrorDomain
 * code (see XMLHttpRequest.js / RCTNetworking.mm). Axios attaches that XHR
 * as `error.request`. On error RN blanks `.response` but keeps the text on
 * `.responseText`, so that is checked first, then `.response`; `.message`
 * is the fallback for callers that don't go through axios's XHR adapter.
 */
function extractErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const request = (error as { request?: { response?: unknown; responseText?: unknown } }).request;
  // React Native's XHR deliberately returns '' from `.response` once
  // `_hasError` is set — i.e. on exactly the failures this function exists
  // to inspect — but `.responseText` still returns the stashed native
  // description. Read that first. It throws when responseType isn't
  // ''/'text', so guard the access.
  let nativeText = '';
  if (request) {
    try {
      if (typeof request.responseText === 'string') nativeText = request.responseText;
    } catch {
      // responseType was set to something non-text; fall through.
    }
    if (!nativeText && typeof request.response === 'string') nativeText = request.response;
  }
  if (nativeText) return nativeText;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

/** True when `error` looks like iOS rejecting the server's TLS certificate
 * rather than a genuinely unreachable server — see `extractErrorText`. */
export function isTlsRejection(error: unknown): boolean {
  const text = extractErrorText(error).toLowerCase();
  if (!text) return false;
  return TLS_REJECTION_KEYWORDS.some((keyword) => text.includes(keyword));
}
