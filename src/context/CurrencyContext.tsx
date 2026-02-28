import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { SupportedCurrency, SUPPORTED_CURRENCIES, getDefaultCurrency } from '../constants/countries';

interface ExchangeRates {
  [key: string]: number;
}

interface CurrencyContextType {
  currency: SupportedCurrency;
  setCurrency: (currency: SupportedCurrency) => void;
  formatAmount: (amount: number) => string;
  formatCompact: (amount: number) => string;
  exchangeRates: ExchangeRates;
  ratesLoading: boolean;
  ratesLastUpdated: string | null;
  convert: (amount: number, from: SupportedCurrency, to: SupportedCurrency) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<SupportedCurrency>('EUR');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({});
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesLastUpdated, setRatesLastUpdated] = useState<string | null>(null);

  // Load user's currency preference from Firestore
  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          const saved = data.preferredCurrency as SupportedCurrency;
          if (saved && SUPPORTED_CURRENCIES.some(c => c.code === saved)) {
            setCurrencyState(saved);
          } else if (data.country) {
            setCurrencyState(getDefaultCurrency(data.country));
          }
        }
      }).catch(() => {});
    }
  }, [user]);

  // Fetch exchange rates (free API, no key needed)
  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 6 * 60 * 60 * 1000); // every 6h
    return () => clearInterval(interval);
  }, []);

  const fetchRates = async () => {
    try {
      setRatesLoading(true);
      // First try to read from Firestore cache
      const cacheDoc = await getDoc(doc(db, 'system', 'exchange_rates')).catch(() => null);
      if (cacheDoc?.exists()) {
        const data = cacheDoc.data();
        const updatedAt = data.updatedAt?.toDate?.() || new Date(data.updatedAt);
        const ageHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours < 12 && data.rates) {
          setExchangeRates(data.rates);
          setRatesLastUpdated(updatedAt.toISOString());
          setRatesLoading(false);
          return;
        }
      }
      // Fallback: fetch from free API (no key)
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
      if (res.ok) {
        const data = await res.json();
        setExchangeRates(data.rates || {});
        setRatesLastUpdated(new Date().toISOString());
      }
    } catch (err) {
      // Use hardcoded fallback rates if API fails
      setExchangeRates({
        EUR: 1, GBP: 0.86, CHF: 0.94, INR: 90.5
      });
    } finally {
      setRatesLoading(false);
    }
  };

  const setCurrency = (c: SupportedCurrency) => {
    setCurrencyState(c);
  };

  const getSymbol = (c: SupportedCurrency) => {
    return SUPPORTED_CURRENCIES.find(sc => sc.code === c)?.symbol || c;
  };

  const getLocale = (c: SupportedCurrency) => {
    switch (c) {
      case 'EUR': return 'de-DE';
      case 'GBP': return 'en-GB';
      case 'CHF': return 'de-CH';
      case 'INR': return 'en-IN';
      default: return 'de-DE';
    }
  };

  const formatAmount = (amount: number): string => {
    try {
      return new Intl.NumberFormat(getLocale(currency), {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${getSymbol(currency)}${amount.toFixed(2)}`;
    }
  };

  const formatCompact = (amount: number): string => {
    const symbol = getSymbol(currency);
    if (Math.abs(amount) >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
    if (Math.abs(amount) >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`;
    return `${symbol}${amount.toFixed(0)}`;
  };

  const convert = (amount: number, from: SupportedCurrency, to: SupportedCurrency): number => {
    if (from === to) return amount;
    const fromRate = exchangeRates[from] || 1;
    const toRate = exchangeRates[to] || 1;
    return (amount / fromRate) * toRate;
  };

  return (
    <CurrencyContext.Provider value={{
      currency, setCurrency, formatAmount, formatCompact,
      exchangeRates, ratesLoading, ratesLastUpdated, convert
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
}
