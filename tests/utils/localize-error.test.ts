import fs from 'fs';
import path from 'path';
import i18next from 'i18next';
import {
  CERTIFICATE_REJECTED_MESSAGE,
  EXACT_ERROR_KEYS,
  localizeErrorMessage,
} from '@/utils/localize-error';
import en from '@/locales/en/translation.json';
import tr from '@/locales/tr/translation.json';

const ROOT = path.join(__dirname, '..', '..');
const LOCALES = fs
  .readdirSync(path.join(ROOT, 'locales'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const SERVICE_SOURCES = [
  'services/api/client.ts',
  'services/api/auth.ts',
  'services/server-manager.ts',
  'utils/quiProxy.ts',
]
  .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
  .join('\n');

const lookup = (json: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], json);

const fakeT = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

describe('localizeErrorMessage', () => {
  it('maps each known message to its key', () => {
    for (const [message, key] of Object.entries(EXACT_ERROR_KEYS)) {
      expect(localizeErrorMessage(message, fakeT)).toBe(key);
    }
  });

  it('passes unknown, empty and server-supplied messages through unchanged', () => {
    expect(localizeErrorMessage('Fails.', fakeT)).toBe('Fails.');
    expect(localizeErrorMessage('', fakeT)).toBe('');
    // A near miss must not match — exact text only.
    expect(
      localizeErrorMessage('Authentication failed. Please check your credentials', fakeT),
    ).toBe('Authentication failed. Please check your credentials');
  });

  it('fills in the translated toggle name for a rejected certificate', () => {
    expect(localizeErrorMessage(CERTIFICATE_REJECTED_MESSAGE, fakeT)).toBe(
      'errors.certificateRejected {"setting":"server.allowInsecureCert"}',
    );
  });

  it('keeps the retry delay and the missing endpoint URL', () => {
    expect(
      localizeErrorMessage('Rate limited by server. Please retry after 30 seconds.', fakeT),
    ).toBe('errors.rateLimitedRetry {"seconds":"30"}');
    expect(
      localizeErrorMessage(
        'Endpoint not found: http://nas:8080/api/v2/app/version. Please check your qBittorrent version and API compatibility.',
        fakeT,
      ),
    ).toBe('errors.endpointNotFound {"url":"http://nas:8080/api/v2/app/version"}');
  });

  it('produces Turkish text with a real i18next instance', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'tr',
      resources: { en: { translation: en }, tr: { translation: tr } },
      interpolation: { escapeValue: false },
    });
    const t = i18n.t.bind(i18n) as (key: string, options?: Record<string, unknown>) => string;

    expect(
      localizeErrorMessage('Connection timeout. Please check your server connection.', t),
    ).toBe(tr.errors.connectionTimeout);
    expect(localizeErrorMessage(CERTIFICATE_REJECTED_MESSAGE, t)).toContain(
      tr.server.allowInsecureCert,
    );
  });
});

describe('mapped messages stay in sync with the services', () => {
  // If a service rewords one of these, the mapping silently stops matching and
  // users see English again — fail here instead.
  it.each([...Object.keys(EXACT_ERROR_KEYS), CERTIFICATE_REJECTED_MESSAGE])(
    '"%s" still appears in the service sources',
    (message) => {
      expect(SERVICE_SOURCES).toContain(message);
    },
  );

  it('the templated messages still have the shape the patterns expect', () => {
    expect(SERVICE_SOURCES).toContain(' Please retry after ${retryAfter} seconds.');
    expect(SERVICE_SOURCES).toContain(
      'Endpoint not found: ${fullUrl}. Please check your qBittorrent version and API compatibility.',
    );
  });
});

describe('every key used exists in every locale', () => {
  const keys = [
    ...Object.values(EXACT_ERROR_KEYS),
    'errors.certificateRejected',
    'errors.rateLimitedRetry',
    'errors.endpointNotFound',
    'server.allowInsecureCert',
  ];

  it.each(LOCALES)('%s', (locale) => {
    const json = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'locales', locale, 'translation.json'), 'utf8'),
    );
    const missing = keys.filter((key) => typeof lookup(json, key) !== 'string');
    expect(missing).toEqual([]);
  });
});
