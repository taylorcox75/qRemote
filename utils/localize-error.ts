/**
 * Display-time translation of the English error messages the API layer throws.
 *
 * `services/api/client.ts`, `services/api/auth.ts` and
 * `services/server-manager.ts` normalize failures into fixed English
 * messages, and callers substring-match those messages (see the client's
 * header comment), so they can't be translated where they are thrown.
 * Instead, screens pass the message through `localizeErrorMessage` right
 * before showing it. Anything not recognized — server-supplied text,
 * already-translated text — is returned unchanged.
 *
 * `tests/utils/localize-error.test.ts` checks that every message mapped here
 * still appears verbatim in the service sources, so a reworded message shows
 * up as a failing test instead of silently falling back to English.
 */
import { QUI_KEY_MISSING_MESSAGE, QUI_KEY_REJECTED_MESSAGE } from '@/utils/quiProxy';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Exact English message → i18n key. */
export const EXACT_ERROR_KEYS: Record<string, string> = {
  'Authentication failed. Please check your credentials.': 'errors.authFailed',
  'Authentication failed. Please check your username and password.':
    'errors.authFailedUsernamePassword',
  'Connection failed. Please check your server address and network connection.':
    'errors.connectionFailedAddress',
  'Connection test failed. Please check your settings.': 'errors.connectionTestFailed',
  'Failed to connect to server. Please check your settings.': 'errors.failedToConnectServer',
  'Connection timeout. Please check your server connection.': 'errors.connectionTimeout',
  'No server configured': 'errors.noServerConfigured',
  'No server configured. Please connect to a server first.': 'toast.notConnected',
  'Rate limited by server.': 'errors.rateLimited',
  'Torrent queueing must be enabled in qBittorrent to change priorities.':
    'errors.queueingDisabled',
  'This torrent already exists or could not be added.': 'errors.torrentExistsOrFailed',
  'An unknown error occurred': 'errors.unknown',
  [QUI_KEY_REJECTED_MESSAGE]: 'errors.quiKeyRejected',
  [QUI_KEY_MISSING_MESSAGE]: 'errors.quiKeyMissing',
};

/** The certificate message names a settings toggle, which is translated separately. */
export const CERTIFICATE_REJECTED_MESSAGE =
  'Certificate rejected. Enable "Allow Untrusted, Self-Signed Certificate" for this server if you trust it.';

const RATE_LIMITED_RETRY = /^Rate limited by server\. Please retry after (.+) seconds\.$/;
const ENDPOINT_NOT_FOUND =
  /^Endpoint not found: (.+)\. Please check your qBittorrent version and API compatibility\.$/;

export function localizeErrorMessage(message: string, t: Translate): string {
  if (!message) return message;

  const key = EXACT_ERROR_KEYS[message];
  if (key) return t(key);

  if (message === CERTIFICATE_REJECTED_MESSAGE) {
    return t('errors.certificateRejected', { setting: t('server.allowInsecureCert') });
  }

  const retry = message.match(RATE_LIMITED_RETRY);
  if (retry) return t('errors.rateLimitedRetry', { seconds: retry[1] });

  const notFound = message.match(ENDPOINT_NOT_FOUND);
  if (notFound) return t('errors.endpointNotFound', { url: notFound[1] });

  return message;
}
