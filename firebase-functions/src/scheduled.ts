// =============================================================
// functions/src/scheduled.ts
// Scheduled Cloud Functions for myfynzo
// 1. updateMarketPrices — daily price refresh for all user holdings
// 2. snapshotNetWorth — weekly net worth snapshots for all users
// =============================================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─── Price sources ──────────────────────────────────────────────

interface PriceResult {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
  exchange: string;
  source: string;
}

// Yahoo Finance v8 API (no API key needed, more reliable)
async function fetchYahooPrice(symbol: string): Promise<PriceResult | null> {
  try {
    // Convert MF: prefix to Indian format
    if (symbol.startsWith('MF:')) return null; // Handle separately via MFAPI

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result?.meta) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;

    return {
      symbol: meta.symbol || symbol,
      price,
      previousClose: prevClose,
      change: price - prevClose,
      changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      currency: meta.currency || 'USD',
      name: meta.shortName || meta.longName || symbol,
      exchange: meta.exchangeName || '',
      source: 'yahoo',
    };
  } catch {
    return null;
  }
}

// Indian Mutual Fund NAV via MFAPI (free)
async function fetchMFAPIPrice(schemeCode: string): Promise<PriceResult | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.data?.[0]) return null;

    // Also get fund name from meta
    const fullRes = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    let name = `MF:${schemeCode}`;
    if (fullRes.ok) {
      const fullData = await fullRes.json();
      name = fullData?.meta?.scheme_name || name;
    }

    return {
      symbol: `MF:${schemeCode}`,
      price: parseFloat(data.data[0].nav),
      previousClose: parseFloat(data.data[0].nav),
      change: 0,
      changePercent: 0,
      currency: 'INR',
      name,
      exchange: 'AMFI',
      source: 'mfapi',
    };
  } catch {
    return null;
  }
}

// CoinGecko for crypto (free)
const CRYPTO_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  DOT: 'polkadot', XRP: 'ripple', DOGE: 'dogecoin', BNB: 'binancecoin',
  AVAX: 'avalanche-2', LINK: 'chainlink', MATIC: 'matic-network',
};

async function fetchCryptoPrice(symbol: string): Promise<PriceResult | null> {
  const id = CRYPTO_MAP[symbol.toUpperCase()];
  if (!id) return null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const coin = data[id];
    if (!coin) return null;
    const price = coin.usd;
    const change24h = coin.usd_24h_change || 0;
    const prevClose = price / (1 + change24h / 100);
    return {
      symbol: symbol.toUpperCase(), price, previousClose: prevClose,
      change: price - prevClose, changePercent: change24h,
      currency: 'USD', name: id.charAt(0).toUpperCase() + id.slice(1),
      exchange: 'Crypto', source: 'coingecko',
    };
  } catch {
    return null;
  }
}

async function fetchPrice(symbol: string): Promise<PriceResult | null> {
  if (!symbol) return null;
  const sym = symbol.trim().toUpperCase();

  // Indian Mutual Fund
  if (sym.startsWith('MF:')) {
    return fetchMFAPIPrice(sym.replace('MF:', ''));
  }

  // Crypto
  if (CRYPTO_MAP[sym]) {
    return fetchCryptoPrice(sym);
  }

  // Stocks/ETFs via Yahoo Finance
  return fetchYahooPrice(sym);
}

// ═══════════════════════════════════════════════════════════════
// 1. SCHEDULED PRICE UPDATE — runs daily at 21:00 UTC
// Collects all unique symbols across all users, fetches prices,
// writes to market_prices/{symbol} and updates user investment docs
// ═══════════════════════════════════════════════════════════════

export const updateMarketPrices = functions.pubsub
  .schedule('0 21 * * *') // 9 PM UTC daily (covers India 2:30 AM IST, Germany 10 PM CET)
  .timeZone('UTC')
  .onRun(async () => {
    console.log('[updateMarketPrices] Starting scheduled price update...');

    try {
      // 1. Collect all unique symbols across all users
      const symbolMap = new Map<string, { userIds: string[]; investmentIds: string[] }>();
      const usersSnap = await db.collection('users').get();

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;

        // From investments
        const invSnap = await db.collection('users').doc(uid).collection('investments').get();
        for (const inv of invSnap.docs) {
          const sym = (inv.data().symbol || '').trim().toUpperCase();
          if (!sym) continue;
          if (!symbolMap.has(sym)) symbolMap.set(sym, { userIds: [], investmentIds: [] });
          const entry = symbolMap.get(sym)!;
          if (!entry.userIds.includes(uid)) entry.userIds.push(uid);
          entry.investmentIds.push(`${uid}/${inv.id}`);
        }

        // From monthly investments (recurring)
        const mipSnap = await db.collection('users').doc(uid).collection('monthlyInvestments').get();
        for (const mip of mipSnap.docs) {
          const sym = (mip.data().symbol || '').trim().toUpperCase();
          if (!sym) continue;
          if (!symbolMap.has(sym)) symbolMap.set(sym, { userIds: [], investmentIds: [] });
          const entry = symbolMap.get(sym)!;
          if (!entry.userIds.includes(uid)) entry.userIds.push(uid);
        }
      }

      console.log(`[updateMarketPrices] Found ${symbolMap.size} unique symbols across ${usersSnap.size} users`);

      // 2. Fetch prices for all symbols (with rate limiting)
      let updated = 0, failed = 0;
      const batch = db.batch();

      for (const [symbol] of symbolMap) {
        try {
          const price = await fetchPrice(symbol);
          if (price && price.price > 0) {
            // Write to market_prices cache
            const priceRef = db.collection('market_prices').doc(symbol);
            batch.set(priceRef, {
              ...price,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            updated++;
          } else {
            failed++;
          }
        } catch (err) {
          console.warn(`[updateMarketPrices] Failed for ${symbol}:`, err);
          failed++;
        }

        // Rate limit: 300ms between calls
        await new Promise(r => setTimeout(r, 300));
      }

      // Commit market_prices batch
      await batch.commit();

      // 3. Update individual user investment currentPrice fields
      const updateBatch = db.batch();
      let userUpdates = 0;

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const invSnap = await db.collection('users').doc(uid).collection('investments').get();

        for (const inv of invSnap.docs) {
          const sym = (inv.data().symbol || '').trim().toUpperCase();
          if (!sym) continue;

          // Read from freshly written market_prices
          const priceDoc = await db.collection('market_prices').doc(sym).get();
          if (priceDoc.exists) {
            const priceData = priceDoc.data()!;
            updateBatch.update(inv.ref, {
              currentPrice: priceData.price,
              lastPriceUpdate: admin.firestore.FieldValue.serverTimestamp(),
            });
            userUpdates++;
          }
        }
      }

      if (userUpdates > 0) await updateBatch.commit();

      console.log(`[updateMarketPrices] Done: ${updated} prices updated, ${failed} failed, ${userUpdates} user investments refreshed`);
    } catch (err) {
      console.error('[updateMarketPrices] Fatal error:', err);
    }
  });

// ═══════════════════════════════════════════════════════════════
// 2. NET WORTH SNAPSHOT — runs weekly on Sunday at 22:00 UTC
// Calculates net worth for each user and writes to snapshots subcollection
// ═══════════════════════════════════════════════════════════════

export const snapshotNetWorth = functions.pubsub
  .schedule('0 22 * * 0') // Every Sunday 10 PM UTC
  .timeZone('UTC')
  .onRun(async () => {
    console.log('[snapshotNetWorth] Starting weekly net worth snapshot...');

    try {
      const usersSnap = await db.collection('users').get();
      const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd
      let snapshotCount = 0;

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        try {
          // Sum investments (quantity × currentPrice)
          let investmentValue = 0;
          const invSnap = await db.collection('users').doc(uid).collection('investments').get();
          invSnap.docs.forEach(d => {
            const data = d.data();
            investmentValue += (data.quantity || 0) * (data.currentPrice || data.purchasePrice || 0);
          });

          // Sum recurring investments estimated value
          let recurringValue = 0;
          const mipSnap = await db.collection('users').doc(uid).collection('monthlyInvestments').get();
          mipSnap.docs.forEach(d => {
            const m = d.data();
            const startDate = m.startDate ? new Date(m.startDate) : null;
            if (!startDate || !m.monthlyAmount) return;
            const months = Math.max(0,
              (new Date().getFullYear() - startDate.getFullYear()) * 12 +
              (new Date().getMonth() - startDate.getMonth())
            );
            const invested = m.monthlyAmount * months;
            if (m.currentPrice && m.purchasePrice && m.purchasePrice > 0) {
              recurringValue += invested * (m.currentPrice / m.purchasePrice);
            } else {
              recurringValue += invested;
            }
          });

          // Sum cash & savings
          let cashValue = 0;
          const cashSnap = await db.collection('users').doc(uid).collection('cashSavings').get();
          cashSnap.docs.forEach(d => { cashValue += d.data().amount || 0; });

          // Sum physical assets
          let assetValue = 0;
          const assetSnap = await db.collection('users').doc(uid).collection('physicalAssets').get();
          assetSnap.docs.forEach(d => { assetValue += d.data().currentValue || 0; });

          // Sum debts
          let debtValue = 0;
          const debtSnap = await db.collection('users').doc(uid).collection('debts').get();
          debtSnap.docs.forEach(d => { debtValue += d.data().amount || d.data().remaining || 0; });

          const netWorth = investmentValue + recurringValue + cashValue + assetValue - debtValue;

          // Write snapshot
          await db.collection('users').doc(uid).collection('netWorthSnapshots').doc(today).set({
            date: today,
            netWorth,
            investments: investmentValue,
            recurring: recurringValue,
            cash: cashValue,
            assets: assetValue,
            debts: debtValue,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          snapshotCount++;
        } catch (err) {
          console.warn(`[snapshotNetWorth] Failed for user ${uid}:`, err);
        }
      }

      console.log(`[snapshotNetWorth] Done: ${snapshotCount} user snapshots created for ${today}`);
    } catch (err) {
      console.error('[snapshotNetWorth] Fatal error:', err);
    }
  });

// ═══════════════════════════════════════════════════════════════
// 3. ON-DEMAND: Take snapshot now (callable from admin or client)
// ═══════════════════════════════════════════════════════════════

export const takeNetWorthSnapshot = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.HttpsError('unauthenticated', 'Must be logged in');

  const uid = context.auth.uid;
  const today = new Date().toISOString().split('T')[0];

  let investmentValue = 0, recurringValue = 0, cashValue = 0, assetValue = 0, debtValue = 0;

  const invSnap = await db.collection('users').doc(uid).collection('investments').get();
  invSnap.docs.forEach(d => {
    const dd = d.data();
    investmentValue += (dd.quantity || 0) * (dd.currentPrice || dd.purchasePrice || 0);
  });

  const mipSnap = await db.collection('users').doc(uid).collection('monthlyInvestments').get();
  mipSnap.docs.forEach(d => {
    const m = d.data();
    const start = m.startDate ? new Date(m.startDate) : null;
    if (!start || !m.monthlyAmount) return;
    const months = Math.max(0, (new Date().getFullYear() - start.getFullYear()) * 12 + (new Date().getMonth() - start.getMonth()));
    const invested = m.monthlyAmount * months;
    recurringValue += (m.currentPrice && m.purchasePrice > 0) ? invested * (m.currentPrice / m.purchasePrice) : invested;
  });

  const cashSnap = await db.collection('users').doc(uid).collection('cashSavings').get();
  cashSnap.docs.forEach(d => { cashValue += d.data().amount || 0; });

  const assetSnap = await db.collection('users').doc(uid).collection('physicalAssets').get();
  assetSnap.docs.forEach(d => { assetValue += d.data().currentValue || 0; });

  const debtSnap = await db.collection('users').doc(uid).collection('debts').get();
  debtSnap.docs.forEach(d => { debtValue += d.data().amount || d.data().remaining || 0; });

  const netWorth = investmentValue + recurringValue + cashValue + assetValue - debtValue;

  await db.collection('users').doc(uid).collection('netWorthSnapshots').doc(today).set({
    date: today, netWorth, investments: investmentValue, recurring: recurringValue,
    cash: cashValue, assets: assetValue, debts: debtValue,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, date: today, netWorth };
});
