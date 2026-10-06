import type { i18n as I18n } from 'i18next';
import pl from '@/locales/pl/translation.json';
import ru from '@/locales/ru/translation.json';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn(),
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => {} } }));

// Hermes ships Intl without PluralRules, which made i18next pick `_one` or `_other` only.
describe('plural forms without native Intl.PluralRules', () => {
  const nativePluralRules = Intl.PluralRules;
  let i18n: I18n;

  beforeAll(() => {
    delete (Intl as { PluralRules?: unknown }).PluralRules;
    jest.isolateModules(() => {
      require('@/i18n');
      i18n = require('i18next');
    });
  });

  afterAll(() => {
    (Intl as { PluralRules: unknown }).PluralRules = nativePluralRules;
  });

  it.each([
    [1, 'Usunięto 1 torrent'],
    [2, 'Usunięto 2 torrenty'],
    [5, 'Usunięto 5 torrentów'],
    [22, 'Usunięto 22 torrenty'],
    [12, 'Usunięto 12 torrentów'],
  ])('uses the right Polish form for %i', (count, expected) => {
    expect(i18n.getFixedT('pl')('toast.torrentsDeleted', { count })).toBe(expected);
  });

  it.each([
    [1, 'Удалён 1 торрент'],
    [2, 'Удалено 2 торрента'],
    [5, 'Удалено 5 торрентов'],
    [21, 'Удалён 21 торрент'],
    [11, 'Удалено 11 торрентов'],
  ])('uses the right Russian form for %i', (count, expected) => {
    expect(i18n.getFixedT('ru')('toast.torrentsDeleted', { count })).toBe(expected);
  });
});

describe.each([
  ['pl', pl],
  ['ru', ru],
])('%s plural keys', (_lng, translation) => {
  it('define one, few, many and other together', () => {
    const groups = new Map<string, Set<string>>();
    const walk = (node: Record<string, unknown>, path: string) => {
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'object' && value !== null) {
          walk(value as Record<string, unknown>, `${path}${key}.`);
          continue;
        }
        // A bare key is i18next's fallback when the `_one` form is missing.
        const [, name, form = 'one'] = key.match(/^(.*?)(?:_(one|few|many|other))?$/)!;
        const base = `${path}${name}`;
        if (!groups.has(base)) groups.set(base, new Set());
        groups.get(base)!.add(form);
      }
    };
    walk(translation, '');

    const incomplete = [...groups]
      .filter(([, forms]) => forms.size > 1 && forms.size < 4)
      .map(([base, forms]) => `${base} (${[...forms].join(', ')})`);
    expect(incomplete).toEqual([]);
  });
});
