// =============================================================
// services/geoLocation.ts — Detect user country from IP
// Uses free ipapi.co service (no API key needed, 1000 req/day)
// =============================================================

export interface GeoResult {
  country: string;       // "India", "Germany", etc.
  countryCode: string;   // "IN", "DE", etc.
  currency: string;      // "INR", "EUR", etc.
  locale: string;        // "en", "de", "ta"
  city: string;
  region: string;
}

// Country code → our standard country name
const COUNTRY_MAP: Record<string, string> = {
  DE: 'Germany',
  US: 'United States',
  CA: 'Canada',
  IN: 'India',
  GB: 'United Kingdom',
  CH: 'Switzerland',
  AT: 'Austria',
  NL: 'Netherlands',
  FR: 'France',
  IE: 'Ireland',
  AU: 'Australia',
};

// Country code → default currency
const CURRENCY_MAP: Record<string, string> = {
  DE: 'EUR', AT: 'EUR', NL: 'EUR', FR: 'EUR', IE: 'EUR',
  US: 'USD',
  CA: 'CAD',
  IN: 'INR',
  GB: 'GBP',
  CH: 'CHF',
  AU: 'AUD',
};

// Country code → default locale
const LOCALE_MAP: Record<string, string> = {
  DE: 'de', AT: 'de', CH: 'de',
  IN: 'en',
  US: 'en', CA: 'en', GB: 'en', AU: 'en',
  FR: 'en', NL: 'en', IE: 'en',
};

// Country code → landing page COUNTRY_PROFILES index
export const COUNTRY_PROFILE_INDEX: Record<string, number> = {
  DE: 0, AT: 0, NL: 0, FR: 0, IE: 0,   // Europe → Germany/EU profile
  US: 1,
  CA: 2,
  IN: 3,
  GB: 4, CH: 4, AU: 4,                   // Other → Europe profile
};

let cachedResult: GeoResult | null = null;

export async function detectCountry(): Promise<GeoResult> {
  // Return cached result if available
  if (cachedResult) return cachedResult;

  // Check localStorage cache (valid for 24 hours)
  try {
    const cached = localStorage.getItem('myfynzo_geo');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        cachedResult = parsed.data;
        return cachedResult!;
      }
    }
  } catch {}

  // Fetch from IP geolocation API
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const cc = data.country_code || '';
      const result: GeoResult = {
        country: COUNTRY_MAP[cc] || data.country_name || '',
        countryCode: cc,
        currency: CURRENCY_MAP[cc] || data.currency || 'EUR',
        locale: LOCALE_MAP[cc] || 'en',
        city: data.city || '',
        region: data.region || '',
      };
      cachedResult = result;
      // Cache in localStorage
      try {
        localStorage.setItem('myfynzo_geo', JSON.stringify({ data: result, timestamp: Date.now() }));
      } catch {}
      return result;
    }
  } catch {}

  // Fallback: try timezone-based detection
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta')) {
      const result: GeoResult = { country: 'India', countryCode: 'IN', currency: 'INR', locale: 'en', city: '', region: '' };
      cachedResult = result;
      return result;
    }
    if (tz.startsWith('America/New_York') || tz.startsWith('America/Chicago') || tz.startsWith('America/Denver') || tz.startsWith('America/Los_Angeles')) {
      const result: GeoResult = { country: 'United States', countryCode: 'US', currency: 'USD', locale: 'en', city: '', region: '' };
      cachedResult = result;
      return result;
    }
    if (tz.startsWith('Europe/Berlin') || tz.startsWith('Europe/Vienna') || tz.startsWith('Europe/Zurich')) {
      const result: GeoResult = { country: 'Germany', countryCode: 'DE', currency: 'EUR', locale: 'de', city: '', region: '' };
      cachedResult = result;
      return result;
    }
    if (tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver')) {
      const result: GeoResult = { country: 'Canada', countryCode: 'CA', currency: 'CAD', locale: 'en', city: '', region: '' };
      cachedResult = result;
      return result;
    }
  } catch {}

  // Ultimate fallback
  const fallback: GeoResult = { country: 'Germany', countryCode: 'DE', currency: 'EUR', locale: 'en', city: '', region: '' };
  cachedResult = fallback;
  return fallback;
}

/**
 * Get the COUNTRY_PROFILES index for a detected country
 */
export function getCountryProfileIndex(countryCode: string): number {
  return COUNTRY_PROFILE_INDEX[countryCode] ?? 0;
}
