// =============================================================
// components/CountryGate.tsx
// Controls access based on user's detected/stored country
// - For authenticated users: reads country from Firestore profile (no IP re-detect)
// - For unauthenticated users: uses cached IP-based detection
// - Admin whitelist: admins can test any country by setting it in Firestore
// =============================================================

import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { detectCountry } from '../services/geoLocation';

// Countries with full access (free tier)
const ALLOWED_COUNTRIES = ['India', 'Germany'];

interface CountryGateProps {
  children: ReactNode;
  mode: 'signup' | 'page';
}

// Cache to avoid re-fetching on every route change
let cachedAccess: { allowed: boolean; country: string } | null = null;

export function useCountryAccess() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(cachedAccess?.allowed ?? null);
  const [country, setCountry] = useState(cachedAccess?.country || '');

  useEffect(() => {
    // If we have a cached result AND user hasn't changed, use it immediately
    if (cachedAccess) {
      setAllowed(cachedAccess.allowed);
      setCountry(cachedAccess.country);
      return;
    }

    let cancelled = false;

    const checkAccess = async () => {
      try {
        if (user) {
          // Authenticated: read country from Firestore (already stored at signup)
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists() && !cancelled) {
            const data = snap.data();
            const userCountry = data.country || '';
            const isAdmin = data.role === 'admin' || data.isAdmin === true;
            // Also check system/admin_whitelist for whitelisted admins
            let adminAllowed = isAdmin;
            if (!adminAllowed) {
              try {
                const wl = await getDoc(doc(db, 'system', 'admin_whitelist'));
                if (wl.exists()) {
                  const wlData = wl.data();
                  adminAllowed = (wlData.uids || []).includes(user.uid) || (wlData.emails || []).includes(user.email || '');
                }
              } catch {}
            }

            if (adminAllowed) {
              cachedAccess = { allowed: true, country: userCountry };
              setAllowed(true);
              setCountry(userCountry);
              return;
            }

            const isAllowed = ALLOWED_COUNTRIES.includes(userCountry);
            cachedAccess = { allowed: isAllowed, country: userCountry };
            setAllowed(isAllowed);
            setCountry(userCountry);
            return;
          }
        }

        // Unauthenticated or no Firestore doc: use IP detection (cached in localStorage)
        const geo = await detectCountry();
        if (!cancelled) {
          const isAllowed = ALLOWED_COUNTRIES.includes(geo.country);
          cachedAccess = { allowed: isAllowed, country: geo.country };
          setAllowed(isAllowed);
          setCountry(geo.country);
        }
      } catch {
        if (!cancelled) {
          // On error, allow access (graceful degradation)
          cachedAccess = { allowed: true, country: '' };
          setAllowed(true);
        }
      }
    };

    checkAccess();
    return () => { cancelled = true; };
  }, [user?.uid]);

  return { allowed, country, loading: allowed === null };
}

// Clear cache on logout (called from AuthContext)
export function clearCountryCache() {
  cachedAccess = null;
}

export function CountryGate({ children, mode }: CountryGateProps) {
  const { allowed, country, loading } = useCountryAccess();
  const { user } = useAuth();

  // For authenticated users: show children while checking (prevents blank flash)
  // The cache resolves instantly on subsequent navigations
  if (loading) {
    // If user is logged in, show content optimistically (they were allowed in before)
    if (user) return <>{children}</>;
    // For unauthenticated (signup/login), show nothing briefly — splash covers this
    return null;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-secondary font-display mb-3">
            Coming soon to {country || 'your region'}
          </h1>
          <p className="text-slate-500 mb-6 leading-relaxed">
            myfynzo is currently available in select countries.
            Join our waitlist to be the first to know when we launch in your region.
          </p>
          <a href={`mailto:hello@myfynzo.com?subject=Waitlist: ${country}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/10">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Join the Waitlist
          </a>
          <div className="mt-8">
            <Link to="/" className="text-sm text-slate-400 hover:text-primary transition-colors">← Back to Home</Link>
          </div>
          <div className="mt-10 flex items-center justify-center gap-3 text-sm text-slate-300">
            <span>Currently live in</span>
            <span className="bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 text-xs text-slate-400 font-medium">🇮🇳 India</span>
            <span className="bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 text-xs text-slate-400 font-medium">🇩🇪 Germany</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Premium request component
export function PremiumRequestBanner() {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-lg">✨</span>
        <div>
          <div className="text-sm font-bold text-amber-900">Interested in Premium?</div>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Premium features are currently invite-only. Apply to get early access to fynzo Intelligence AI, unlimited investments, and more.
          </p>
          <a href="mailto:hello@myfynzo.com?subject=Premium Access Request"
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors">
            Request Premium Access →
          </a>
        </div>
      </div>
    </div>
  );
}
