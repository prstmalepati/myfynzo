// =============================================================
// context/LocaleContext.tsx — i18n context + useT() hook
// =============================================================

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { translations, interpolate, Locale } from '../i18n/translations';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isGerman: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const { user } = useAuth();

  // Load saved locale from Firestore on auth
  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.locale === 'de' || data.locale === 'en') {
            setLocaleState(data.locale);
          } else if (data.country === 'Germany') {
            setLocaleState('de');
          }
        }
      }).catch(() => {});
    }
  }, [user]);

  // Also persist in localStorage for instant load
  useEffect(() => {
    const saved = localStorage.getItem('myfynzo_locale') as Locale;
    if (saved === 'en' || saved === 'de') setLocaleState(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('myfynzo_locale', l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const str = translations[locale]?.[key] || translations.en[key] || key;
    return vars ? interpolate(str, vars) : str;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, isGerman: locale === 'de' }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider');
  return context;
}

// Shortcut hook
export function useT() {
  const { t } = useLocale();
  return t;
}
