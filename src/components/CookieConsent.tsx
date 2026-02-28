// =============================================================
// components/CookieConsent.tsx — GDPR-compliant cookie banner
// =============================================================
// Shows once on first visit. Stores preference in localStorage.
// Essential cookies are always active; analytics is opt-in.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const COOKIE_KEY = 'myfynzo_cookie_consent';

interface CookiePreferences {
  essential: true; // Always true
  analytics: boolean;
  timestamp: number;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_KEY);
      if (!stored) {
        // Small delay so it doesn't flash on load
        const t = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage blocked — don't show banner
    }
  }, []);

  const accept = (analytics: boolean) => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
    } catch {}

    // If analytics declined, disable GA/Firebase Analytics
    if (!analytics) {
      // @ts-ignore — GA opt-out
      window['ga-disable-G-HXZKYF3EEX'] = true;
    }

    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] p-4 animate-slideUp">
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-elevated p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-secondary mb-1">Cookie Preferences</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We use essential cookies to make myfynzo work. We'd also like to use analytics cookies
              to understand how you use our app and improve it.{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </p>

            {showDetails && (
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-secondary">Essential</span>
                    <span className="text-slate-400 ml-2">Authentication, language, currency</span>
                  </div>
                  <span className="text-xs text-green-600 font-medium">Always active</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-secondary">Analytics</span>
                    <span className="text-slate-400 ml-2">Firebase Analytics, usage patterns</span>
                  </div>
                  <span className="text-xs text-slate-400">Optional</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => accept(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={() => accept(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                Essential Only
              </button>
              {!showDetails && (
                <button
                  onClick={() => setShowDetails(true)}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Check if analytics cookies were accepted */
export function hasAnalyticsConsent(): boolean {
  try {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) return false;
    const prefs: CookiePreferences = JSON.parse(stored);
    return prefs.analytics === true;
  } catch {
    return false;
  }
}
