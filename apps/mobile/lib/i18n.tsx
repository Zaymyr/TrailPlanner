import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en } from '../locales/en';
import { fr } from '../locales/fr';
import type { Locale, MobileTranslations } from '../locales/types';

const LOCALE_STORAGE_KEY = 'trailplanner.locale';

const translations: Record<Locale, MobileTranslations> = { en, fr };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: MobileTranslations;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const resolveDeviceLocale = (): Locale => {
  // Try to use Intl if available (React Native >= 0.70)
  try {
    const lang = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    if (lang.startsWith('fr')) return 'fr';
  } catch {
    // ignore
  }
  return 'en';
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'en' || stored === 'fr') {
          setLocaleState(stored);
        } else {
          setLocaleState(resolveDeviceLocale());
        }
      })
      .catch(() => setLocaleState(resolveDeviceLocale()))
      .finally(() => setLoaded(true));
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    AsyncStorage.setItem(LOCALE_STORAGE_KEY, newLocale).catch(() => {});
  }, []);

  const t = useMemo(() => translations[locale], [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  // Don't render until locale is resolved to avoid flicker
  if (!loaded) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
