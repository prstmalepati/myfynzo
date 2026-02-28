// =============================================================
// services/cloudFunctions.ts — Client wrappers for Cloud Functions
// =============================================================
// These replace direct Firestore writes to shared collections.
// Use these in production. During development, the fallback in
// marketDataService.ts (direct Firestore writes) still works
// because the rules allow authenticated writes to market_prices.

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

const functions = getFunctions(app); // Uses default region (us-central1)

// ─── Market Data ──────────────────────────────────────────────

export interface CloudPrice {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
  exchange: string;
  updatedAt: string;
  source: string;
  fromCache: boolean;
}

/**
 * Fetch a single stock/ETF price via Cloud Function.
 * The function handles API key securely, writes to Firestore cache.
 */
export async function cloudFetchPrice(symbol: string, exchange?: string): Promise<CloudPrice | null> {
  try {
    const fn = httpsCallable<{ symbol: string; exchange?: string }, CloudPrice>(functions, 'fetchPrice');
    const result = await fn({ symbol, ...(exchange ? { exchange } : {}) });
    return result.data;
  } catch (err: any) {
    console.warn(`Cloud fetchPrice failed for ${symbol}:`, err.message);
    return null;
  }
}

/**
 * Batch fetch up to 10 prices via Cloud Function.
 */
export async function cloudFetchPrices(symbols: string[]): Promise<Record<string, CloudPrice>> {
  try {
    const fn = httpsCallable<{ symbols: string[] }, Record<string, CloudPrice>>(functions, 'fetchPrices');
    const result = await fn({ symbols: symbols.slice(0, 10) });
    return result.data;
  } catch (err: any) {
    console.warn('Cloud fetchPrices failed:', err.message);
    return {};
  }
}

// ─── Admin Functions ──────────────────────────────────────────

/**
 * Seed tax rules to Firestore (admin only).
 */
export async function cloudSeedTaxRules(rules: any[]): Promise<{ seeded: number }> {
  const fn = httpsCallable<{ rules: any[] }, { seeded: number }>(functions, 'seedTaxRules');
  const result = await fn({ rules });
  return result.data;
}

/**
 * List all users (admin only).
 */
export async function cloudListUsers(): Promise<{ users: any[]; count: number }> {
  const fn = httpsCallable<void, { users: any[]; count: number }>(functions, 'listUsers');
  const result = await fn();
  return result.data;
}

/**
 * Save API keys securely (admin only).
 */
export async function cloudSaveApiKeys(keys: Record<string, string>): Promise<{ saved: string[] }> {
  const fn = httpsCallable<Record<string, string>, { saved: string[] }>(functions, 'saveApiKeys');
  const result = await fn(keys);
  return result.data;
}
