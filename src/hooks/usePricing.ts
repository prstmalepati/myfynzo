import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { TIER_PRICES, ANNUAL_ONLY_CURRENCIES, isAnnualOnly } from '../constants/tiers';

type PricingData = Record<string, { premium: { monthly: number; annual: number }; couples: { monthly: number; annual: number } }>;

/**
 * Loads pricing from Firestore `system/pricing` with fallback to hardcoded TIER_PRICES.
 * Admin can update pricing via the Admin panel → changes propagate in real-time.
 */
export function usePricing() {
  const [prices, setPrices] = useState<PricingData>(TIER_PRICES);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'system', 'pricing'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          // Merge Firestore data with fallback (in case new currencies aren't in DB yet)
          const merged = { ...TIER_PRICES };
          for (const cur of Object.keys(data)) {
            if (cur === 'updatedAt') continue;
            if (data[cur]?.premium && data[cur]?.couples) {
              merged[cur] = data[cur];
            }
          }
          setPrices(merged);
        }
      },
      () => {
        // On error (e.g. no doc yet), use hardcoded fallback
        setPrices(TIER_PRICES);
      }
    );
    return unsubscribe;
  }, []);

  const getPrice = (currency: string, tier: 'premium' | 'couples', period: 'monthly' | 'annual'): number => {
    const p = prices[currency] || prices.EUR;
    if (isAnnualOnly(currency) && period === 'monthly') {
      return p[tier].annual;
    }
    return p[tier][period];
  };

  const getAnnualSavings = (currency: string, tier: 'premium' | 'couples'): number => {
    const p = prices[currency] || prices.EUR;
    const monthly = p[tier].monthly * 12;
    const annual = p[tier].annual;
    return Math.round(((monthly - annual) / monthly) * 100);
  };

  return { prices, getPrice, getAnnualSavings };
}
