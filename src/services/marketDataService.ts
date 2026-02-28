// =============================================================
// services/marketDataService.ts — Live stock/ETF/crypto prices
// =============================================================
// STRATEGY:
// 1. Try Cloud Function (fetchPrice) — secure, server-side API key
// 2. Fall back to direct client fetch if CF unavailable (dev mode)
// 3. CoinGecko for crypto (free, no key needed)
// Caches in Firestore under market_prices/{symbol}

import { db } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { cloudFetchPrice, cloudFetchPrices } from './cloudFunctions';

export interface MarketPrice {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
  exchange: string;
  updatedAt: Date;
  source: string;
}

// Cache duration: 15 minutes during market hours, 6 hours otherwise
const CACHE_DURATION_MS = 15 * 60 * 1000;
const CACHE_DURATION_CLOSED_MS = 6 * 60 * 60 * 1000;

function isMarketOpen(): boolean {
  const now = new Date();
  const hour = now.getUTCHours();
  const day = now.getUTCDay();
  // Rough: Mon-Fri, 8am-9pm UTC covers US + EU market hours
  return day >= 1 && day <= 5 && hour >= 8 && hour <= 21;
}

// ─── Read from Firestore cache ────────────────────────────────
async function getCachedPrice(symbol: string): Promise<MarketPrice | null> {
  try {
    const snap = await getDoc(doc(db, 'market_prices', symbol.toUpperCase()));
    if (!snap.exists()) return null;
    const data = snap.data();
    const updatedAt = data.updatedAt?.toDate?.() || new Date(data.updatedAt);
    const maxAge = isMarketOpen() ? CACHE_DURATION_MS : CACHE_DURATION_CLOSED_MS;
    if (Date.now() - updatedAt.getTime() > maxAge) return null; // stale
    return { ...data, updatedAt } as MarketPrice;
  } catch {
    return null;
  }
}

async function setCachedPrice(price: MarketPrice): Promise<void> {
  try {
    await setDoc(doc(db, 'market_prices', price.symbol.toUpperCase()), {
      ...price,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error('Cache write failed:', err);
  }
}

// ─── Twelve Data (primary) ────────────────────────────────────
// SECURITY: API key is read from env var only (for dev mode).
// In production, all price fetching should go through Cloud Functions.
// The client NEVER reads system/api_keys from Firestore.
async function getApiKey(): Promise<string> {
  const envKey = import.meta.env.VITE_TWELVE_DATA_KEY || '';
  if (!envKey) {
    console.warn('[MarketData] No VITE_TWELVE_DATA_KEY env var. Client-side TwelveData disabled. Prices will use Cloud Function or Yahoo fallback.');
  }
  return envKey;
}

async function fetchFromTwelveData(symbol: string, exchange?: string, expectedName?: string): Promise<MarketPrice | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;
  try {
    // Build URL with optional exchange for non-US symbols
    let url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    if (exchange) {
      // Map common exchange names to Twelve Data exchange codes
      const exchangeMap: Record<string, string> = {
        'XETRA': 'XETR', 'Frankfurt': 'XETR', 'FWB': 'XETR',
        'Euronext Amsterdam': 'AMS', 'Euronext Paris': 'EPA', 'Euronext Brussels': 'EBR',
        'London Stock Exchange': 'LSE', 'LSE': 'LSE',
        'Milan': 'BIT', 'Borsa Italiana': 'BIT',
        'SIX Swiss': 'SIX', 'SIX': 'SIX',
        'Tradegate': 'TGT',
        'NSE': 'NSE', 'BSE': 'BSE',
        'National Stock Exchange of India': 'NSE', 'Bombay Stock Exchange': 'BSE',
        'TSX': 'TSX', 'Toronto Stock Exchange': 'TSX',
      };
      const exCode = exchangeMap[exchange] || exchange;
      url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exCode)}&apikey=${apiKey}`;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code || !data.close) {
      // If exchange-qualified fetch fails, retry without exchange
      if (exchange) return fetchFromTwelveData(symbol, undefined, expectedName);
      return null;
    }

    // Verify the returned instrument matches what we expect
    // Twelve Data can return a completely different stock for the same symbol on different exchanges
    if (expectedName && data.name) {
      const returnedName = data.name.toLowerCase();
      const expected = expectedName.toLowerCase();
      // Check if there's meaningful overlap (at least first word matches)
      const expectedFirstWord = expected.split(/[\s,]+/)[0];
      const returnedFirstWord = returnedName.split(/[\s,]+/)[0];
      if (expectedFirstWord.length > 2 && returnedFirstWord.length > 2 &&
          expectedFirstWord !== returnedFirstWord &&
          !returnedName.includes(expectedFirstWord) &&
          !expected.includes(returnedFirstWord)) {
        console.warn(`[Price] Symbol ${symbol} on ${exchange}: expected "${expectedName}" but got "${data.name}". Retrying without exchange.`);
        // Name mismatch — the exchange-qualified symbol returns a different company
        if (exchange) return fetchFromTwelveData(symbol, undefined, expectedName);
        return null;
      }
    }

    return {
      symbol: data.symbol || symbol.toUpperCase(),
      price: parseFloat(data.close),
      previousClose: parseFloat(data.previous_close || data.close),
      change: parseFloat(data.change || '0'),
      changePercent: parseFloat(data.percent_change || '0'),
      currency: data.currency || 'USD',
      name: data.name || symbol,
      exchange: data.exchange || exchange || '',
      updatedAt: new Date(),
      source: 'twelvedata',
    };
  } catch {
    return null;
  }
}

// ─── CoinGecko for crypto (free, no key) ──────────────────────
const CRYPTO_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  DOT: 'polkadot', XRP: 'ripple', DOGE: 'dogecoin', MATIC: 'matic-network',
  AVAX: 'avalanche-2', LINK: 'chainlink', BNB: 'binancecoin',
};

async function fetchFromCoinGecko(symbol: string): Promise<MarketPrice | null> {
  const id = CRYPTO_MAP[symbol.toUpperCase()];
  if (!id) return null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,eur&include_24hr_change=true`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const coin = data[id];
    if (!coin) return null;
    return {
      symbol: symbol.toUpperCase(),
      price: coin.usd,
      previousClose: coin.usd / (1 + (coin.usd_24h_change || 0) / 100),
      change: coin.usd - (coin.usd / (1 + (coin.usd_24h_change || 0) / 100)),
      changePercent: coin.usd_24h_change || 0,
      currency: 'USD',
      name: id.charAt(0).toUpperCase() + id.slice(1),
      exchange: 'Crypto',
      updatedAt: new Date(),
      source: 'coingecko',
    };
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────

export async function fetchLivePrice(symbol: string, forceRefresh = false, exchange?: string, expectedName?: string): Promise<MarketPrice | null> {
  if (!symbol?.trim()) return null;
  const sym = symbol.trim().toUpperCase();

  // Indian Mutual Fund: symbol format is MF:123456
  if (sym.startsWith('MF:')) {
    const schemeCode = sym.replace('MF:', '');
    if (!forceRefresh) { const cached = await getCachedPrice(sym); if (cached) return cached; }
    
    // Fetch NAV and also try to get fund name from full API response
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const fundName = data.meta?.scheme_name || data.meta?.fund_house || sym;
          const mp: MarketPrice = {
            symbol: sym, price: parseFloat(data.data[0].nav), previousClose: parseFloat(data.data[0].nav),
            change: 0, changePercent: 0, currency: 'INR',
            name: fundName, exchange: 'AMFI',
            updatedAt: new Date(), source: 'mfapi',
          };
          await setCachedPrice(mp);
          return mp;
        }
      }
    } catch {}
    
    // Fallback to simple fetch
    const nav = await fetchIndianMFNav(schemeCode);
    if (nav) {
      const mp: MarketPrice = {
        symbol: sym, price: nav.nav, previousClose: nav.nav,
        change: 0, changePercent: 0, currency: 'INR',
        name: sym, exchange: 'AMFI',
        updatedAt: new Date(), source: 'mfapi',
      };
      await setCachedPrice(mp);
      return mp;
    }
    return null;
  }

  // 1. Check Firestore cache (skip if forceRefresh)
  if (!forceRefresh) {
    const cached = await getCachedPrice(sym);
    if (cached) return cached;
  }

  // 2. Try crypto first if it's a known crypto symbol (free, no key)
  if (CRYPTO_MAP[sym]) {
    const crypto = await fetchFromCoinGecko(sym);
    if (crypto) { await setCachedPrice(crypto); return crypto; }
  }

  // 3. Try Cloud Function (secure, server-side API key)
  try {
    const cloudResult = await cloudFetchPrice(sym);
    if (cloudResult && cloudResult.price) {
      const mp: MarketPrice = {
        symbol: cloudResult.symbol, price: cloudResult.price,
        previousClose: cloudResult.previousClose, change: cloudResult.change,
        changePercent: cloudResult.changePercent, currency: cloudResult.currency,
        name: cloudResult.name, exchange: cloudResult.exchange,
        updatedAt: new Date(cloudResult.updatedAt), source: cloudResult.source,
      };
      return mp;
    }
  } catch {
    // Cloud Function not deployed — fall back to direct client fetch
  }

  // 4. Fallback: Direct Twelve Data fetch from client (dev mode)
  const stock = await fetchFromTwelveData(sym, exchange, expectedName);
  if (stock) { console.log(`[Price] ${sym}: fetched from Twelve Data → ${stock.price}`); await setCachedPrice(stock); return stock; }

  // 5. Try crypto as last resort
  const cryptoFallback = await fetchFromCoinGecko(sym);
  if (cryptoFallback) { console.log(`[Price] ${sym}: fetched from CoinGecko → ${cryptoFallback.price}`); await setCachedPrice(cryptoFallback); return cryptoFallback; }

  console.warn(`[Price] ${sym}: No price found from any source`);
  return null;
}

// Batch fetch for multiple symbols (used by dashboard)
export async function fetchMultiplePrices(symbols: string[]): Promise<Map<string, MarketPrice>> {
  const results = new Map<string, MarketPrice>();
  const unique = [...new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean))];

  // Try Cloud Function batch first
  try {
    const cloudResults = await cloudFetchPrices(unique.slice(0, 10));
    for (const [sym, data] of Object.entries(cloudResults)) {
      if (data && data.price) {
        results.set(sym, {
          symbol: data.symbol, price: data.price,
          previousClose: data.previousClose, change: data.change,
          changePercent: data.changePercent, currency: data.currency,
          name: data.name, exchange: data.exchange,
          updatedAt: new Date(data.updatedAt), source: data.source,
        });
      }
    }
    // If cloud handled everything, return
    if (unique.every(s => results.has(s))) return results;
  } catch {
    // Cloud Functions not available, fall back to individual fetches
  }

  // Fallback: fetch remaining individually
  const remaining = unique.filter(s => !results.has(s));
  const batchSize = 4;
  for (let i = 0; i < remaining.length; i += batchSize) {
    const batch = remaining.slice(i, i + batchSize);
    const promises = batch.map(async sym => {
      const price = await fetchLivePrice(sym);
      if (price) results.set(sym, price);
    });
    await Promise.all(promises);
    if (i + batchSize < remaining.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return results;
}

// Get all cached prices (for offline/quick display)
export async function getAllCachedPrices(): Promise<Map<string, MarketPrice>> {
  const results = new Map<string, MarketPrice>();
  try {
    const snap = await getDocs(collection(db, 'market_prices'));
    snap.docs.forEach(d => {
      const data = d.data();
      results.set(d.id, { ...data, updatedAt: data.updatedAt?.toDate?.() || new Date() } as MarketPrice);
    });
  } catch {}
  return results;
}

// ─── Symbol Search (Twelve Data) ──────────────────────────────
export interface SymbolResult {
  symbol: string;
  instrument_name: string;
  exchange: string;
  country: string;
  type: string; // 'Common Stock', 'ETF', etc.
  currency: string;
}

export async function searchSymbols(query: string): Promise<SymbolResult[]> {
  if (!query || query.trim().length < 1) return [];

  // Detect ISIN format (2 letter country + 9 alphanum + 1 check digit)
  const isISIN = /^[A-Z]{2}[A-Z0-9]{10}$/i.test(query.trim());

  // Search both Twelve Data and Indian MFs in parallel
  const [twelveResults, mfResults] = await Promise.all([
    searchTwelveData(query),
    searchIndianMF(query),
  ]);

  // If ISIN detected and no results, try searching by ISIN via symbol lookup
  let isinResults: SymbolResult[] = [];
  if (isISIN && twelveResults.length === 0) {
    // Twelve Data symbol_search also supports ISIN; retry with explicit filter
    isinResults = await searchTwelveData(query.trim().toUpperCase());
  }

  // Combine: Indian MFs first if query looks Indian, otherwise Twelve Data first
  const isIndianQuery = /mutual|fund|nifty|sensex|sbi|hdfc|icici|axis|kotak|nippon|mirae|parag/i.test(query);
  let combined = isIndianQuery ? [...mfResults, ...twelveResults, ...isinResults] : [...twelveResults, ...isinResults, ...mfResults];
  
  // Smart ranking: relevance first, then exchange preference
  const q = query.trim().toLowerCase();
  const eurIndExchanges = /xetra|frankfurt|fwb|etr|euronext|lse|paris|milan|amsterdam|tradegate|nse|bse|bombay|national stock/i;
  const usExchanges = /nasdaq|nyse|nysearca|otc|cboe/i;

  combined.sort((a, b) => {
    // 1. Relevance: exact symbol match (highest priority)
    const aExactSym = a.symbol.toLowerCase() === q ? -10 : 0;
    const bExactSym = b.symbol.toLowerCase() === q ? -10 : 0;

    // 2. Relevance: symbol starts with query
    const aSymStart = a.symbol.toLowerCase().startsWith(q) ? -5 : 0;
    const bSymStart = b.symbol.toLowerCase().startsWith(q) ? -5 : 0;

    // 3. Relevance: name starts with query
    const aNameStart = a.instrument_name.toLowerCase().startsWith(q) ? -4 : 0;
    const bNameStart = b.instrument_name.toLowerCase().startsWith(q) ? -4 : 0;

    // 4. Relevance: name contains query as a whole word
    const aNameWord = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(a.instrument_name) ? -3 : 0;
    const bNameWord = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(b.instrument_name) ? -3 : 0;

    // 5. Exchange preference (secondary tiebreaker)
    const aExch = eurIndExchanges.test(a.exchange) ? 0 : usExchanges.test(a.exchange) ? 1 : 2;
    const bExch = eurIndExchanges.test(b.exchange) ? 0 : usExchanges.test(b.exchange) ? 1 : 2;

    const aTotal = aExactSym + aSymStart + aNameStart + aNameWord + aExch;
    const bTotal = bExactSym + bSymStart + bNameStart + bNameWord + bExch;
    return aTotal - bTotal;
  });
  
  return combined.slice(0, 15);
}

async function searchTwelveData(query: string): Promise<SymbolResult[]> {
  if (!query || query.trim().length < 1) return [];
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.warn('[MarketData] No Twelve Data API key found. Set it in Firestore: system/api_keys → twelveData, or env VITE_TWELVE_DATA_KEY. Stock/ETF search disabled.');
    return [];
  }
  try {
    // Twelve Data supports searching by symbol name; for ISIN, use show_plan=false
    const isISIN = /^[A-Z]{2}[A-Z0-9]{10}$/i.test(query.trim());
    const searchParam = isISIN ? query.trim().toUpperCase() : query.trim();
    const res = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(searchParam)}&outputsize=15&apikey=${apiKey}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];
    return data.data
      .filter((d: any) => d.symbol && d.instrument_name)
      .slice(0, 15)
      .map((d: any) => ({
        symbol: d.symbol,
        instrument_name: d.instrument_name,
        exchange: d.exchange || '',
        country: d.country || '',
        type: d.instrument_type || d.type || '',
        currency: d.currency || 'USD',
      }));
  } catch {
    return [];
  }
}

// ─── Indian Mutual Funds via MFAPI (free, no API key) ────────
// Uses https://api.mfapi.in — free public API for Indian MF NAVs
// Scheme codes map: common fund names to AMFI scheme codes

const INDIAN_MF_SCHEMES: Record<string, { code: number; name: string }> = {
  // Large Cap
  'NIFTY50': { code: 120716, name: 'UTI Nifty 50 Index Fund' },
  'SENSEX': { code: 119598, name: 'HDFC Index Fund Sensex' },
  // Popular Funds
  'PPFAS': { code: 122639, name: 'Parag Parikh Flexi Cap Fund' },
  'AXIS_BLUECHIP': { code: 120503, name: 'Axis Bluechip Fund' },
  'MIRAE_LARGE': { code: 118834, name: 'Mirae Asset Large Cap Fund' },
  'SBI_SMALL': { code: 130503, name: 'SBI Small Cap Fund' },
  'HDFC_MID': { code: 101762, name: 'HDFC Mid-Cap Opportunities Fund' },
  'KOTAK_FLEXI': { code: 118551, name: 'Kotak Flexicap Fund' },
  'ICICI_TECH': { code: 120594, name: 'ICICI Pru Technology Fund' },
  'NIPPON_INDIA_SMALL': { code: 113177, name: 'Nippon India Small Cap Fund' },
};

export async function searchIndianMF(query: string): Promise<SymbolResult[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, 15).map((d: any) => ({
      symbol: `MF:${d.schemeCode}`,
      instrument_name: d.schemeName || '',
      exchange: 'AMFI',
      country: 'India',
      type: 'Mutual Fund (IN)',
      currency: 'INR',
    }));
  } catch {
    return [];
  }
}

export async function fetchIndianMFNav(schemeCode: string | number): Promise<{ nav: number; date: string } | null> {
  try {
    // Try /latest first, fallback to main endpoint
    let res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    if (!res.ok) {
      res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return {
        nav: parseFloat(data.data[0].nav),
        date: data.data[0].date,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchIndianMFNavOnDate(schemeCode: string | number, date: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return null;
    // Date format in MFAPI is dd-MM-yyyy
    const targetDate = new Date(date);
    // Find exact date or closest date before
    let closest: { nav: number; diff: number } | null = null;
    for (const entry of data.data) {
      const parts = entry.date.split('-');
      const entryDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      const diff = targetDate.getTime() - entryDate.getTime();
      if (diff >= 0 && (!closest || diff < closest.diff)) {
        closest = { nav: parseFloat(entry.nav), diff };
      }
      // Stop searching if we've gone more than 10 days back
      if (diff > 10 * 24 * 60 * 60 * 1000) break;
    }
    return closest?.nav || null;
  } catch {
    return null;
  }
}

// ─── Fetch historical price for a specific date ──────────────
export async function fetchPriceOnDate(symbol: string, date: string, exchange?: string): Promise<number | null> {
  if (!symbol || !date) return null;

  // Indian Mutual Fund: symbol format is MF:123456
  if (symbol.startsWith('MF:')) {
    const schemeCode = symbol.replace('MF:', '');
    return await fetchIndianMFNavOnDate(schemeCode, date);
  }

  const apiKey = await getApiKey();
  if (!apiKey) return null;
  try {
    // Build exchange param
    const exParam = exchange ? `&exchange=${encodeURIComponent(exchange)}` : '';
    const res = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${date}&end_date=${date}${exParam}&apikey=${apiKey}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.values && data.values.length > 0) {
      return parseFloat(data.values[0].close);
    }
    // If exact date not found (weekend/holiday), try a few days back
    const dt = new Date(date);
    dt.setDate(dt.getDate() - 5);
    const startBack = dt.toISOString().split('T')[0];
    const res2 = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${startBack}&end_date=${date}&outputsize=5${exParam}&apikey=${apiKey}`
    );
    if (!res2.ok) return null;
    const data2 = await res2.json();
    if (data2.values && data2.values.length > 0) {
      return parseFloat(data2.values[0].close);
    }
    return null;
  } catch {
    return null;
  }
}
