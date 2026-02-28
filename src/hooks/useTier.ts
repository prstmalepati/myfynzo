import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { TIER_LIMITS, TierType, TierLimits } from '../constants/tiers';

// Hardcoded tier overrides for testing (bypasses Firestore)
// In production, tier comes from Stripe webhook → Firestore
const TIER_OVERRIDES: Record<string, TierType> = {
  // 'admin@myfynzo.com': 'couples',
  // 'bk.malepati@gmail.com': 'free',  // free tier test user
};

interface TierInfo {
  tier: TierType;
  isPremium: boolean;
  isCouples: boolean;
  isLinkedPartner: boolean;
  isFree: boolean;
  limits: TierLimits;
  loading: boolean;
  canUseFeature: (feature: keyof TierLimits) => boolean;
  checkLimit: (feature: 'maxAssets' | 'projectionYears' | 'bankConnections' | 'maxScenarios' | 'users', currentCount: number) => boolean;
}

export function useTier(): TierInfo {
  const { user } = useAuth();
  const [tier, setTier] = useState<TierType>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTier('free');
      setLoading(false);
      return;
    }

    // Check hardcoded overrides first
    if (user.email && TIER_OVERRIDES[user.email]) {
      setTier(TIER_OVERRIDES[user.email]);
      setLoading(false);
      return;
    }

    // Listen for real-time tier from Firestore
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.data();
        const userTier = (data?.tier as TierType) || 'free';
        setTier(userTier);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading tier:', error);
        setTier('free');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const isPremium = tier === 'premium' || tier === 'couples' || tier === 'family_linked';
  const isCouples = tier === 'couples';
  const isLinkedPartner = tier === 'family_linked';
  const isFree = tier === 'free';

  const canUseFeature = (feature: keyof TierLimits): boolean => {
    const value = limits[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    return value !== 'weekly';
  };

  const checkLimit = (
    feature: 'maxAssets' | 'projectionYears' | 'bankConnections' | 'maxScenarios' | 'users',
    currentCount: number
  ): boolean => {
    return currentCount < limits[feature];
  };

  return { tier, isPremium, isCouples, isLinkedPartner, isFree, limits, loading, canUseFeature, checkLimit };
}

export function usePremiumFeature(feature: keyof TierLimits) {
  const { canUseFeature } = useTier();
  return { hasAccess: canUseFeature(feature), locked: !canUseFeature(feature) };
}
