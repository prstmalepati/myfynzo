// =============================================================
// context/UserProfileContext.tsx — User profile with country + tier
// Fixes: 1.3 (admin via custom claims), 2.4 (single pricing source)
// =============================================================
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { detectCountry } from '../services/geoLocation';
import { TIER_PRICES, getCurrencySymbol, getTierPrice, isAnnualOnly } from '../constants/tiers';

export type UserTier = 'free' | 'premium' | 'couples';
export type UserCountry = 'Germany' | 'India' | string;

// Country → tax calc mapping
export const COUNTRY_TAX_MAP: Record<string, { id: string; label: string; icon: string }> = {
  'Germany':       { id: 'tax-de', label: 'German Tax',  icon: '🇩🇪' },
  'India':         { id: 'tax-in', label: 'India Tax',   icon: '🇮🇳' },
};

// 2.4: Country → pricing derived from the SINGLE source of truth in tiers.ts
function getPricingForCountry(country: string) {
  const currencyMap: Record<string, string> = {
    'Germany': 'EUR', 'India': 'INR',
  };
  const currency = currencyMap[country] || 'EUR';
  const prices = TIER_PRICES[currency] || TIER_PRICES.EUR;
  const sym = getCurrencySymbol(currency);
  const annualOnly = isAnnualOnly(currency);

  return {
    symbol: sym,
    currency,
    free: `${sym}0`,
    premium: `${sym}${prices.premium.monthly}`,
    premiumYearly: `${sym}${prices.premium.annual}`,
    couples: `${sym}${prices.couples.monthly}`,
    couplesYearly: `${sym}${prices.couples.annual}`,
    annualOnly,
  };
}

const DEFAULT_PRICING = getPricingForCountry('Germany');

interface UserProfile {
  tier: UserTier;
  country: UserCountry;
  currency: string;
  locale: string;
  loaded: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  // Country-aware helpers
  myTaxCalc: { id: string; label: string; icon: string } | null;
  allTaxCalcs: { id: string; label: string; icon: string }[];
  pricing: typeof DEFAULT_PRICING;
}

const defaultProfile: UserProfile = {
  tier: 'free',
  country: '',
  currency: 'EUR',
  locale: 'en',
  loaded: false,
  isPremium: false,
  isAdmin: false,
  myTaxCalc: null,
  allTaxCalcs: Object.values(COUNTRY_TAX_MAP),
  pricing: DEFAULT_PRICING,
};

const UserProfileContext = createContext<UserProfile>(defaultProfile);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);

  useEffect(() => {
    if (!user) {
      setProfile({ ...defaultProfile, loaded: true });
      return;
    }

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          const tier = (d.tier || 'free') as UserTier;
          let country = d.country || '';
          let userCurrency = d.preferredCurrency || d.currency || 'EUR';
          let userLocale = d.locale || 'en';

          // If country is missing, detect from IP and backfill
          if (!country) {
            try {
              const geo = await detectCountry();
              country = geo.country;
              userCurrency = geo.currency;
              userLocale = geo.locale;
              await updateDoc(doc(db, 'users', user.uid), {
                country: geo.country,
                preferredCurrency: geo.currency,
                locale: geo.locale,
              }).catch(() => {});
            } catch (err) {
              console.warn('[UserProfile] Geo detection failed:', err);
            }
          }

          const isPremium = tier === 'premium' || tier === 'couples';

          // 1.3: Check admin via Custom Claims (no Firestore read needed)
          let isAdmin = false;
          try {
            const tokenResult = await user.getIdTokenResult();
            isAdmin = tokenResult.claims.admin === true;
          } catch (err) {
            console.warn('[UserProfile] Could not read custom claims:', err);
          }

          // Fallback: UID check (migration period)
          if (!isAdmin) {
            try {
              const adminSnap = await getDoc(doc(db, 'system', 'admin_whitelist'));
              if (adminSnap.exists()) {
                const uids = adminSnap.data().uids || [];
                isAdmin = uids.includes(user.uid);
              }
            } catch {
              // Permission denied = not admin
            }
          }

          // Country-aware tax calc
          const myTaxCalc = COUNTRY_TAX_MAP[country] || null;
          const allTaxCalcs = myTaxCalc
            ? [myTaxCalc, ...Object.values(COUNTRY_TAX_MAP).filter(t => t.id !== myTaxCalc.id)]
            : Object.values(COUNTRY_TAX_MAP);

          // 2.4: Pricing from single source of truth
          const pricing = getPricingForCountry(country);

          setProfile({
            tier, country,
            currency: userCurrency,
            locale: userLocale,
            loaded: true,
            isPremium, isAdmin,
            myTaxCalc, allTaxCalcs, pricing,
          });
        } else {
          setProfile({ ...defaultProfile, loaded: true });
        }
      } catch (err) {
        console.error('[UserProfile] Failed to load:', err);
        setProfile({ ...defaultProfile, loaded: true });
      }
    };

    load();
  }, [user]);

  return (
    <UserProfileContext.Provider value={profile}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
