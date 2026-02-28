// =============================================================
// constants/countries.ts — Supported countries, currencies, tax config
// =============================================================

export interface CountryConfig {
  code: string;
  name: string;
  nameDE: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  taxCalculator: string | null;  // which tax calc to show
  inflationRate: number;         // default for FIRE calc
  flag: string;
  region: 'europe' | 'asia';
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  // Europe
  { code: 'DE', name: 'Germany', nameDE: 'Deutschland', currency: 'EUR', currencySymbol: '€', locale: 'de-DE', taxCalculator: 'german', inflationRate: 2.5, flag: '🇩🇪', region: 'europe' },
  { code: 'AT', name: 'Austria', nameDE: 'Österreich', currency: 'EUR', currencySymbol: '€', locale: 'de-AT', taxCalculator: 'german', inflationRate: 3.1, flag: '🇦🇹', region: 'europe' },
  { code: 'FR', name: 'France', nameDE: 'Frankreich', currency: 'EUR', currencySymbol: '€', locale: 'fr-FR', taxCalculator: null, inflationRate: 2.3, flag: '🇫🇷', region: 'europe' },
  { code: 'NL', name: 'Netherlands', nameDE: 'Niederlande', currency: 'EUR', currencySymbol: '€', locale: 'nl-NL', taxCalculator: null, inflationRate: 2.4, flag: '🇳🇱', region: 'europe' },
  { code: 'BE', name: 'Belgium', nameDE: 'Belgien', currency: 'EUR', currencySymbol: '€', locale: 'nl-BE', taxCalculator: null, inflationRate: 2.2, flag: '🇧🇪', region: 'europe' },
  { code: 'ES', name: 'Spain', nameDE: 'Spanien', currency: 'EUR', currencySymbol: '€', locale: 'es-ES', taxCalculator: null, inflationRate: 2.9, flag: '🇪🇸', region: 'europe' },
  { code: 'IT', name: 'Italy', nameDE: 'Italien', currency: 'EUR', currencySymbol: '€', locale: 'it-IT', taxCalculator: null, inflationRate: 1.9, flag: '🇮🇹', region: 'europe' },
  { code: 'CH', name: 'Switzerland', nameDE: 'Schweiz', currency: 'CHF', currencySymbol: 'CHF', locale: 'de-CH', taxCalculator: null, inflationRate: 1.8, flag: '🇨🇭', region: 'europe' },
  { code: 'GB', name: 'United Kingdom', nameDE: 'Vereinigtes Königreich', currency: 'GBP', currencySymbol: '£', locale: 'en-GB', taxCalculator: null, inflationRate: 2.8, flag: '🇬🇧', region: 'europe' },

  // Asia
  { code: 'IN', name: 'India', nameDE: 'Indien', currency: 'INR', currencySymbol: '₹', locale: 'en-IN', taxCalculator: 'india', inflationRate: 5.0, flag: '🇮🇳', region: 'asia' },
];

export type SupportedCurrency = 'EUR' | 'GBP' | 'CHF' | 'INR';

export const SUPPORTED_CURRENCIES: { code: SupportedCurrency; symbol: string; name: string; nameDE: string }[] = [
  { code: 'EUR', symbol: '€', name: 'Euro', nameDE: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound', nameDE: 'Britisches Pfund' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', nameDE: 'Schweizer Franken' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', nameDE: 'Indische Rupie' },
];

// Get country config by code or name
export function getCountryByCode(code: string): CountryConfig | undefined {
  return SUPPORTED_COUNTRIES.find(c => c.code === code);
}

export function getCountryByName(name: string): CountryConfig | undefined {
  return SUPPORTED_COUNTRIES.find(c => c.name === name || c.nameDE === name);
}

// Get default currency for a country
export function getDefaultCurrency(countryName: string): SupportedCurrency {
  const country = getCountryByName(countryName);
  return (country?.currency as SupportedCurrency) || 'EUR';
}
