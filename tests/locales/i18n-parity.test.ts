/**
 * i18n-parity.test.ts — Guardrail against locale drift.
 *
 * Catches two classes of bugs that have hit this repo before (see the
 * torrentDetail translation-gap incident in v3.5.1):
 *   1. Structural drift — a locale file missing keys that `en` has (or vice
 *      versa), e.g. after adding a new screen/string and forgetting to
 *      backfill the other 5 locale files.
 *   2. Silent non-translation — a key exists in every locale (so key-parity
 *      passes) but its value was never actually translated and is still the
 *      literal English string. This is exactly how the torrentDetail
 *      namespace regressed to ~170 untranslated keys per locale without
 *      anyone noticing, since nothing enforced that translations differ
 *      from the source language.
 */
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.join(__dirname, '..', '..', 'locales');
const SOURCE_LOCALE = 'en';
const TARGET_LOCALES = ['es', 'zh', 'fr', 'de', 'ru'];

type TranslationTree = { [key: string]: string | TranslationTree };

function loadLocale(locale: string): TranslationTree {
  const filePath = path.join(LOCALES_DIR, locale, 'translation.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Flattens a nested translation object into `"a.b.c": "value"` pairs. */
function flatten(obj: TranslationTree, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, fullKey));
    }
  }
  return result;
}

/**
 * Keys that are legitimately allowed to stay byte-identical to the English
 * value in every locale. These are NOT translation gaps — they're technical
 * content (URLs, file paths, protocol/format examples) that must not be
 * translated, or values that coincidentally match across languages (loanwords,
 * numbers-only strings, proper nouns/brand names).
 *
 * Add to this list ONLY when you've verified by hand that the match is
 * intentional — if you're unsure, translate the string instead of
 * whitelisting it.
 */
const COINCIDENTAL_MATCH_ALLOWLIST = new Set<string>([
  // Placeholder/example text showing a literal URL, magnet link, or file
  // path format — these are illustrative syntax, not prose, and stay in
  // their canonical form across all locales.
  'placeholders.magnetLink',
  'placeholders.trackerUrl',
  'screens.search.placeholder',
  'screens.search.installPluginPlaceholder',
  'screens.addTorrent.savePathPlaceholder',
  'screens.settings.defaultSavePathPlaceholder',
  // "tracker" is kept as an established loanword (not translated) throughout
  // es/fr, matching how it's used elsewhere in those same locale files
  // (e.g. errors.failedToFetchTracker keeps "tracker" untranslated inline).
  'torrentDetail.trackersCount',
  'torrentDetail.trackersCount_other',
  'torrentDetail.trackersTab',
  // "Client"/"Status"/"Tags" are standard German IT loanwords used as-is
  // throughout the de locale (see e.g. de's "tags": "Tags", "status": "Status").
  'screens.logs.client',
  'torrentDetail.trackerStatusLabel',
  'filters.tagsCount',
  // "OK" is a universal computing term some translators intentionally keep
  // untranslated (de/fr/ru keep it; es/zh localize it — both are valid).
  'server.testEndpointOk',
]);

/**
 * Minimum English string length (in characters) before an identical match is
 * treated as a real translation gap. Short strings (numbers, "OK", "%",
 * single common words, acronyms) frequently and legitimately coincide across
 * languages, so checking them would produce constant false positives. This
 * repo's actual translation-gap incident (torrentDetail) involved dozens of
 * full sentences/phrases, comfortably above this threshold.
 */
const MIN_LENGTH_FOR_VALUE_CHECK = 16;

const enFlat = flatten(loadLocale(SOURCE_LOCALE));
const enKeys = Object.keys(enFlat).sort();
const enKeySet = new Set(enKeys);

describe('i18n locale parity', () => {
  it('en has at least one key (sanity check the fixture loaded)', () => {
    expect(enKeys.length).toBeGreaterThan(100);
  });

  describe.each(TARGET_LOCALES)('%s locale', (locale) => {
    const localeFlat = flatten(loadLocale(locale));
    const localeKeys = new Set(Object.keys(localeFlat));

    it('is missing no keys that en has', () => {
      const missing = enKeys.filter((k) => !localeKeys.has(k));
      expect(missing).toEqual([]);
    });

    it('has no extra keys that en does not have', () => {
      const extra = [...localeKeys].filter((k) => !enKeySet.has(k));
      expect(extra).toEqual([]);
    });

    it('has no long strings left byte-identical to the English source (untranslated)', () => {
      const untranslated: string[] = [];
      for (const [key, enValue] of Object.entries(enFlat)) {
        if (enValue.length < MIN_LENGTH_FOR_VALUE_CHECK) continue;
        if (COINCIDENTAL_MATCH_ALLOWLIST.has(key)) continue;
        if (localeFlat[key] === enValue) {
          untranslated.push(key);
        }
      }
      expect(untranslated).toEqual([]);
    });
  });
});
