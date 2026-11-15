// Shared mock factories for the coverage suites under tests/rn/components/cov
// and tests/rn/screens/ui. Not a test file (no .test suffix).
//
// Usage inside a jest.mock factory (factories may only reference `require`d
// modules or variables prefixed with `mock`):
//   jest.mock('@/context/ThemeContext', () => require('../../components/cov/mocks').themeModule);
import { mockColors } from '../theme-mock';

/** Any color key the code asks for resolves; known keys keep their mock value. */
export const colorsProxy: Record<string, string> = new Proxy(
  { ...mockColors } as Record<string, string>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return '#123456';
    },
  },
);

export const themeModule = {
  useTheme: () => ({
    colors: colorsProxy,
    isDark: true,
    themeMode: 'dark',
    toggleTheme: jest.fn(),
    setThemeMode: jest.fn(),
    reloadCustomColors: jest.fn(),
  }),
};

/** i18n stand-in: returns the key, with interpolated params appended so tests can assert them. */
export const i18nModule = {
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && typeof params === 'object') {
        const values = Object.entries(params)
          .filter(([k]) => k !== 'defaultValue')
          .map(([k, v]) => `${k}=${String(v)}`);
        return values.length ? `${key}(${values.join(',')})` : key;
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: jest.fn() },
  }),
  Trans: ({ children }: { children: unknown }) => children,
  initReactI18next: { type: '3rdParty', init: jest.fn() },
};

/** FocusAwareStatusBar needs a navigation focus context; outside a navigator it renders nothing. */
export const focusAwareStatusBarModule = { FocusAwareStatusBar: () => null };
