import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import zh from '../locales/zh/translation.json';
import fr from '../locales/fr/translation.json';
import de from '../locales/de/translation.json';

const LANGUAGE_KEY = '@qremote/language';

export const getStoredLanguage = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredLanguage = async (lang: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // Ignore storage errors
  }
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    zh: { translation: zh },
    'zh-CN': { translation: zh },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// Apply stored or device language asynchronously after init
getStoredLanguage().then((stored) => {
  const langToUse = stored || Localization.getLocales()[0]?.languageCode || 'en';
  if (i18n.hasResourceBundle(langToUse, 'translation')) {
    i18n.changeLanguage(langToUse);
  } else if (stored) {
    i18n.changeLanguage('en');
  }
});
