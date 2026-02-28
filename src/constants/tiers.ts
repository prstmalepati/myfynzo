/**
 * 3-Tier Subscription Model
 * Free → Premium → Family Premium
 */

export type TierType = 'free' | 'premium' | 'couples' | 'family_linked';

export interface TierLimits {
  maxAssets: number;
  projectionYears: number;
  bankConnections: number;
  maxScenarios: number;
  users: number;
  exportFrequency: 'daily' | 'weekly' | 'unlimited';
  advancedProjections: boolean;
  couplesProjection: boolean;
  monteCarlo: boolean;
  pdfReports: boolean;
  prioritySupport: boolean;
  liveMarketPrices: boolean;
  csvImport: boolean;
  allTaxCalcs: boolean;
}

export const TIER_LIMITS: Record<TierType, TierLimits> = {
  free: {
    maxAssets: 3,
    maxRecurring: 2,
    projectionYears: 5,
    bankConnections: 0,
    maxScenarios: 0,
    users: 1,
    exportFrequency: 'weekly',
    advancedProjections: false,
    couplesProjection: false,
    monteCarlo: false,
    pdfReports: false,
    prioritySupport: false,
    liveMarketPrices: false,
    csvImport: false,
    allTaxCalcs: false,
  },
  premium: {
    maxAssets: 999,
    maxRecurring: 999,
    projectionYears: 50,
    bankConnections: 10,
    maxScenarios: 10,
    users: 1,
    exportFrequency: 'unlimited',
    advancedProjections: true,
    couplesProjection: false,
    monteCarlo: true,
    pdfReports: true,
    prioritySupport: true,
    liveMarketPrices: true,
    csvImport: true,
    allTaxCalcs: true,
  },
  couples: {
    maxAssets: 999,
    maxRecurring: 999,
    projectionYears: 50,
    bankConnections: 10,
    maxScenarios: 10,
    users: 2,
    exportFrequency: 'unlimited',
    advancedProjections: true,
    couplesProjection: true,
    monteCarlo: true,
    pdfReports: true,
    prioritySupport: true,
    liveMarketPrices: true,
    csvImport: true,
    allTaxCalcs: true,
  },
  family_linked: {
    maxAssets: 999,
    maxRecurring: 999,
    projectionYears: 50,
    bankConnections: 10,
    maxScenarios: 10,
    users: 1,
    exportFrequency: 'unlimited',
    advancedProjections: true,
    couplesProjection: false,
    monteCarlo: true,
    pdfReports: true,
    prioritySupport: true,
    liveMarketPrices: true,
    csvImport: true,
    allTaxCalcs: true,
  },
};

export const TIER_INFO = {
  free: {
    name: 'Free',
    tagline: 'Get started — no card required',
    features: [
      'Up to 3 holdings',
      '2 recurring investments',
      '5-year wealth projection',
      'Investment Returns calculator',
      'Retirement calculator',
      'Dashboard overview',
    ],
  },
  premium: {
    name: 'Premium',
    tagline: 'For serious wealth builders',
    features: [
      'Everything in Free',
      'Unlimited investments & assets',
      '50-year wealth projections',
      'All tax calculators (DE, IN)',
      'fynzo Intelligence AI advisor',
      'Debt Manager',
      'Lifestyle Basket tracker',
      'Scenario branching',
      'Live market prices',
      'CSV broker import',
      'PDF portfolio reports',
      'Dividend income tracker',
      'Benchmark comparison (vs Nifty, S&P, DAX)',
      'Geographic allocation analysis',
      'Priority support',
    ],
  },
  couples: {
    name: 'Family Premium',
    tagline: 'One subscription, two partners',
    features: [
      'Everything in Premium',
      'Partner access — invite your partner',
      'Joint wealth projection',
      'Combined net worth dashboard',
      'Shared goals & scenarios',
      'Individual + merged tax views',
      'Household FIRE calculator',
      'Partner activity feed',
    ],
  },
};

// ─── Purchasing Power Parity Pricing ──────────────────────────
// Base: EUR €5.99/€7.99 — adjusted for purchasing power
// USD and INR are annual-only billing
export const TIER_PRICES: Record<string, { premium: { monthly: number; annual: number }; couples: { monthly: number; annual: number } }> = {
  EUR: { premium: { monthly: 5.99, annual: 59 },    couples: { monthly: 8.99, annual: 89 } },
  INR: { premium: { monthly: 299,  annual: 2999 },  couples: { monthly: 599,  annual: 5999 } },
};

// Currencies that only allow annual billing (no monthly option)
export const ANNUAL_ONLY_CURRENCIES = ['INR'];

export function isAnnualOnly(currency: string): boolean {
  return ANNUAL_ONLY_CURRENCIES.includes(currency);
}

export function getTierPrice(currency: string, tier: 'premium' | 'couples', period: 'monthly' | 'annual'): number {
  const prices = TIER_PRICES[currency] || TIER_PRICES.EUR;
  // For annual-only currencies, always return annual price
  if (isAnnualOnly(currency) && period === 'monthly') {
    return prices[tier].annual;
  }
  return prices[tier][period];
}

export function getAnnualSavings(currency: string, tier: 'premium' | 'couples'): number {
  const prices = TIER_PRICES[currency] || TIER_PRICES.EUR;
  const monthly = prices[tier].monthly * 12;
  const annual = prices[tier].annual;
  return Math.round(((monthly - annual) / monthly) * 100);
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = { EUR: '€', INR: '₹' };
  return symbols[currency] || '€';
}
