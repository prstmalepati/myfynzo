// =============================================================
// hooks/useDashboardData.ts — Dashboard data fetching hook
// =============================================================
// Extracts all Firestore reads, data processing, and partner data
// loading from Dashboard.tsx into a reusable hook.
// Reduces Dashboard from 833 → ~350 lines (UI only).

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { usePartner } from '../context/PartnerContext';
import { useTier } from './useTier';
import { db } from '../firebase/config';
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { fetchMultiplePrices } from '../services/marketDataService';
import type {
  Investment, DashboardData, PartnerData, HealthScore, SmartAlert
} from '../types';

const EMPTY_DASHBOARD: DashboardData = {
  totalInvestments: 0, totalCost: 0, investmentCount: 0,
  investmentItems: [], invByType: [], recurringValue: 0,
  monthlyInvestment: 0, cashSavings: 0, physicalAssets: 0,
  totalDebt: 0, monthlyDebtPayment: 0, debtCount: 0,
  goalCount: 0, goalProgress: 0, goalsOnTrack: 0,
  lifestyleMonthly: 0, netIncome: 0, expectedReturn: 0.07, projYears: 10,
};

const EMPTY_PARTNER: PartnerData = {
  investments: 0, cash: 0, assets: 0, income: 0, expenses: 0, recurring: 0,
};

// ─── Data processing helpers (pure functions) ────────────────

function processInvestments(docs: any[]) {
  const typeMap: Record<string, { value: number; cost: number }> = {};
  let invTotal = 0, costTotal = 0;
  const items: Investment[] = [];

  docs.forEach(d => {
    const data = typeof d.data === 'function' ? d.data() : d;
    const val = (data.quantity || 0) * (data.currentPrice || data.purchasePrice || 0);
    const cost = (data.quantity || 0) * (data.purchasePrice || 0);
    invTotal += val; costTotal += cost;
    const tp = data.type || 'Other';
    if (!typeMap[tp]) typeMap[tp] = { value: 0, cost: 0 };
    typeMap[tp].value += val; typeMap[tp].cost += cost;
    items.push({ id: d.id, ...data } as Investment);
  });

  return {
    totalInvestments: invTotal,
    totalCost: costTotal,
    investmentCount: docs.length,
    investmentItems: items,
    invByType: Object.entries(typeMap)
      .map(([type, d]) => ({ type, ...d }))
      .sort((a, b) => b.value - a.value),
  };
}

function processGoals(docs: any[]) {
  let gTarget = 0, gCurrent = 0, onTrack = 0;
  docs.forEach(d => {
    const data = typeof d.data === 'function' ? d.data() : d;
    gTarget += data.targetAmount || 0; gCurrent += data.currentAmount || 0;
    if ((data.currentAmount || 0) >= (data.targetAmount || 1) * 0.4) onTrack++;
  });
  return {
    goalCount: docs.length,
    goalProgress: gTarget > 0 ? (gCurrent / gTarget) * 100 : 0,
    goalsOnTrack: onTrack,
  };
}

function processLifestyle(docs: any[]) {
  let lm = 0;
  docs.forEach(d => {
    const data = typeof d.data === 'function' ? d.data() : d;
    const cost = data.monthlyCost || data.cost || 0;
    const freq = data.frequency || 'monthly';
    lm += freq === 'monthly' ? cost : freq === 'quarterly' ? cost / 3 : cost / 12;
  });
  return lm;
}

function processIncome(docs: any[]) {
  let total = 0;
  docs.forEach(d => {
    const data = typeof d.data === 'function' ? d.data() : d;
    const amt = data.amount || 0;
    const freq = data.frequency || 'monthly';
    total += freq === 'yearly' ? amt / 12 : freq === 'quarterly' ? amt / 3 : amt;
  });
  return total;
}

function processRecurring(docs: any[]) {
  let mVal = 0, mMonth = 0;
  docs.forEach(d => {
    const data = typeof d.data === 'function' ? d.data() : d;
    const amt = data.monthlyAmount || 0; const freq = data.frequency || 'monthly';
    mMonth += freq === 'quarterly' ? amt / 3 : freq === 'yearly' ? amt / 12 : amt;
    const start = data.startDate ? new Date(data.startDate + 'T00:00:00') : null;
    if (!start || amt <= 0) return;
    const step = freq === 'quarterly' ? 3 : freq === 'yearly' ? 12 : 1;
    let inv = 0; const dt = new Date(start);
    while (dt <= new Date()) { inv += amt; dt.setMonth(dt.getMonth() + step); }
    mVal += data.currentPrice && data.purchasePrice && data.purchasePrice > 0
      ? inv * (data.currentPrice / data.purchasePrice)
      : inv;
  });
  return { recurringValue: mVal, monthlyInvestment: mMonth };
}

// ─── Health Score calculation ────────────────────────────────

export function calculateHealthScore(
  income: number, expenses: number, monthlyInvestment: number,
  totalDebt: number, invByType: { type: string; value: number; cost: number }[],
  cash: number, goalCount: number, goalProgress: number,
  totalCost: number, totalGainPct: number
): HealthScore {
  const scores: { name: string; value: number; color: string }[] = [];

  // Savings Rate
  let sr = monthlyInvestment > 0 ? 50 : 20;
  if (income > 0) sr = Math.max(0, Math.min(100, Math.round(((income - expenses) / income) * 100)));
  scores.push({ name: 'Savings Rate', value: sr, color: '#10b981' });

  // Debt-to-Income
  let dti = totalDebt === 0 ? 95 : 80;
  if (income > 0 && totalDebt > 0) dti = Math.max(0, Math.min(100, Math.round(100 - (totalDebt / (income * 12)) * 25)));
  scores.push({ name: 'Debt-to-Income', value: dti, color: dti >= 60 ? '#10b981' : dti >= 40 ? '#f59e0b' : '#ef4444' });

  // Diversification
  const types = invByType.length;
  scores.push({ name: 'Diversification', value: types === 0 ? 20 : types === 1 ? 35 : types === 2 ? 55 : types === 3 ? 72 : 85, color: '#3b82f6' });

  // Emergency Fund
  let ef = cash > 0 ? 50 : 15;
  if (expenses > 0) ef = Math.round(Math.min(100, (cash / expenses / 6) * 100));
  scores.push({ name: 'Emergency Fund', value: ef, color: '#8b5cf6' });

  // Goal Progress
  scores.push({ name: 'Goal Progress', value: goalCount > 0 ? Math.round(Math.min(100, goalProgress)) : 20, color: '#0f766e' });

  // Returns
  scores.push({ name: 'Returns', value: totalCost > 0 ? Math.round(Math.min(100, Math.max(0, 50 + totalGainPct * 2))) : 30, color: '#06b6d4' });

  return { overall: Math.round(scores.reduce((s, sc) => s + sc.value, 0) / scores.length), scores };
}

// ─── Smart Alerts generation ─────────────────────────────────

export function generateAlerts(
  totalGainPct: number, expenses: number, cash: number,
  totalDebt: number, monthlyDebtPayment: number,
  goalCount: number, goalProgress: number,
  income: number, monthlySaving: number, monthlyInvestment: number,
  lifestyleAvg3m: number | null, lifestyleMonthly: number
): SmartAlert[] {
  const a: SmartAlert[] = [];

  if (totalGainPct < -10) a.push({ type: 'warn', icon: '📉', text: `Portfolio down <strong>${totalGainPct.toFixed(1)}%</strong>. Review holdings.` });
  if (totalGainPct > 15) a.push({ type: 'good', icon: '🚀', text: `Portfolio up <strong>+${totalGainPct.toFixed(1)}%</strong>. Consider rebalancing.` });

  if (expenses > 0 && cash > 0) {
    const m = cash / expenses;
    if (m < 3) a.push({ type: 'info', icon: '💡', text: `Emergency fund: <strong>${m.toFixed(1)} months</strong>. Aim for 6.` });
    else if (m >= 6) a.push({ type: 'good', icon: '🛡️', text: `Emergency fund: <strong>${m.toFixed(1)} months</strong>. Well done!` });
  }

  if (totalDebt > 0 && monthlyDebtPayment > 0) {
    const yrs = Math.ceil(totalDebt / monthlyDebtPayment / 12);
    a.push({ type: yrs <= 2 ? 'good' : 'info', icon: '🏦', text: `Debt-free in ~<strong>${yrs} year${yrs !== 1 ? 's' : ''}</strong>.` });
  }

  if (goalCount > 0 && goalProgress >= 40) a.push({ type: 'good', icon: '🎯', text: `Goals <strong>${goalProgress.toFixed(0)}%</strong> complete — on track!` });

  if (income > 0 && monthlySaving >= 0) {
    const rate = ((monthlySaving + monthlyInvestment) / income * 100);
    a.push({ type: rate >= 30 ? 'good' : 'info', icon: '📊', text: `Savings rate: <strong>${rate.toFixed(0)}%</strong> of income.` });
  }

  if (a.length === 0) a.push({ type: 'info', icon: '✨', text: 'Add investments, expenses, and goals to unlock insights.' });

  // Spending anomaly
  if (lifestyleAvg3m !== null && lifestyleMonthly > 0 && lifestyleAvg3m > 0) {
    const pctDiff = ((lifestyleMonthly - lifestyleAvg3m) / lifestyleAvg3m) * 100;
    if (pctDiff > 20) a.push({ type: 'warn', icon: '⚡', text: `Expenses up <strong>${pctDiff.toFixed(0)}%</strong> vs 3-month average.` });
  }

  return a.slice(0, 6);
}

// ─── Main Hook ───────────────────────────────────────────────

export function useDashboardData() {
  const { user } = useAuth();
  const { isPremium, isFree } = useTier();
  const { isFamily, activeProfile, isHouseholdView, isPartnerView, partnerUid, partnerName } = usePartner();

  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [partnerData, setPartnerData] = useState<PartnerData>(EMPTY_PARTNER);
  const [loading, setLoading] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Trend tracking
  const [netWorthChange30d, setNetWorthChange30d] = useState<number | null>(null);
  const [netWorthChangePct30d, setNetWorthChangePct30d] = useState<number>(0);
  const [lifestyleAvg3m, setLifestyleAvg3m] = useState<number | null>(null);
  const [pricesLastUpdated, setPricesLastUpdated] = useState<string | null>(null);

  // ─── Load main user data ────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const uid = user.uid;
      const [invSnap, goalSnap, lifeSnap, userSnap, projSnap, incSnap, cashSnap, assetSnap, mipSnap, debtSnap] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'investments')),
        getDocs(collection(db, 'users', uid, 'goals')),
        getDocs(collection(db, 'users', uid, 'lifestyleBasket')),
        getDoc(doc(db, 'users', uid)),
        getDoc(doc(db, 'users', uid, 'projections', 'wealth')),
        getDocs(collection(db, 'users', uid, 'incomes')).catch(() => null),
        getDocs(collection(db, 'users', uid, 'cashSavings')).catch(() => null),
        getDocs(collection(db, 'users', uid, 'physicalAssets')).catch(() => null),
        getDocs(collection(db, 'users', uid, 'monthlyInvestments')).catch(() => null),
        getDocs(collection(db, 'users', uid, 'debts')),
      ]);

      const invData = processInvestments(invSnap.docs);
      const goalData = processGoals(goalSnap.docs);
      const lifestyleMonthly = processLifestyle(lifeSnap.docs);

      // Projection settings
      let projYears = 10, expectedReturn = 0.07, savedMonthlyInvestment = 0, savedNetIncome = 0;
      if (userSnap.exists() && userSnap.data().projectionYears) projYears = userSnap.data().projectionYears;
      if (projSnap.exists()) {
        const pd = projSnap.data()!;
        if (pd.monthlyInvestment) savedMonthlyInvestment = pd.monthlyInvestment;
        if (pd.expectedReturn) expectedReturn = pd.expectedReturn / 100;
        if (pd.projectionYears) projYears = pd.projectionYears;
        if (pd.netIncome) savedNetIncome = pd.netIncome;
      }

      // Income
      let netIncome = savedNetIncome;
      if (incSnap) {
        const incomeTotal = processIncome(incSnap.docs);
        if (incomeTotal > 0) netIncome = incomeTotal;
      }

      // Cash & Physical Assets
      let cashTotal = 0, assetTotal = 0;
      if (cashSnap) cashSnap.docs.forEach(d => cashTotal += d.data().amount || 0);
      if (assetSnap) assetSnap.docs.forEach(d => assetTotal += d.data().currentValue || 0);

      // Recurring (MIPs)
      const { recurringValue, monthlyInvestment: mipMonthly } = mipSnap
        ? processRecurring(mipSnap.docs)
        : { recurringValue: 0, monthlyInvestment: 0 };
      const monthlyInvestment = savedMonthlyInvestment || mipMonthly;

      // Debts
      let dSum = 0, dPay = 0;
      debtSnap.docs.forEach(d => { const dd = d.data(); dSum += dd.remainingAmount || 0; dPay += dd.monthlyPayment || 0; });

      const newData: DashboardData = {
        ...invData,
        recurringValue,
        monthlyInvestment,
        cashSavings: cashTotal,
        physicalAssets: assetTotal,
        totalDebt: dSum,
        monthlyDebtPayment: dPay,
        debtCount: debtSnap.docs.length,
        ...goalData,
        lifestyleMonthly,
        netIncome,
        expectedReturn,
        projYears,
      };
      setData(newData);

      // Check onboarding
      if (userSnap.exists() && userSnap.data().onboardingCompletedAt) {
        setOnboardingDismissed(true);
      }

      // ─── Non-blocking: Auto-refresh live prices ───
      const allSymbols = invSnap.docs.map(d => d.data().symbol).filter(Boolean) as string[];
      if (allSymbols.length > 0) {
        fetchMultiplePrices(allSymbols).then(priceMap => {
          if (priceMap.size === 0) return;
          let liveTotal = 0, liveCost = 0;
          invSnap.docs.forEach(d => {
            const dd = d.data();
            const sym = (dd.symbol || '').trim().toUpperCase();
            const live = priceMap.get(sym);
            const price = live ? live.price : (dd.currentPrice || dd.purchasePrice || 0);
            liveTotal += (dd.quantity || 0) * price;
            liveCost += (dd.quantity || 0) * (dd.purchasePrice || 0);
          });
          if (liveTotal > 0) {
            setData(prev => ({ ...prev, totalInvestments: liveTotal, totalCost: liveCost }));
          }
        }).catch(() => {});
      }

      // ─── Non-blocking: Daily snapshot ───
      const today = new Date().toISOString().split('T')[0];
      if (invData.totalInvestments > 0) {
        const snapRef = doc(db, 'users', uid, 'netWorthSnapshots', today);
        getDoc(snapRef).then(existing => {
          if (!existing.exists()) {
            setDoc(snapRef, {
              date: today,
              netWorth: invData.totalInvestments + cashTotal + assetTotal - dSum,
              investments: invData.totalInvestments, cash: cashTotal, assets: assetTotal, debts: dSum,
              createdAt: new Date(),
            }).catch(() => {});
          }
        }).catch(() => {});
      }

    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      // ─── Non-blocking trend analysis ───
      loadTrends();
    }
  }, [user]);

  // ─── Trend analysis (non-blocking) ─────────────────────────
  const loadTrends = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;

    // 30-day net worth trend
    try {
      const d30 = new Date(); d30.setDate(d30.getDate() - 30);
      const d30Str = d30.toISOString().split('T')[0];
      const oldSnap = await getDoc(doc(db, 'users', uid, 'netWorthSnapshots', d30Str));
      if (oldSnap.exists()) {
        const oldNw = oldSnap.data().netWorth || 0;
        const currentNw = data.cashSavings + data.physicalAssets + data.totalInvestments + data.recurringValue - data.totalDebt;
        setNetWorthChange30d(currentNw - oldNw);
        setNetWorthChangePct30d(oldNw > 0 ? ((currentNw - oldNw) / oldNw) * 100 : 0);
      }
    } catch {}

    // 3-month lifestyle average
    try {
      const dates: string[] = [];
      for (let m = 1; m <= 3; m++) {
        const d = new Date(); d.setMonth(d.getMonth() - m);
        dates.push(d.toISOString().split('T')[0].slice(0, 7));
      }
      const snapQ = query(collection(db, 'users', uid, 'netWorthSnapshots'), orderBy('date', 'desc'), limit(90));
      const snapDocs = await getDocs(snapQ);
      const monthlyExpenses: Record<string, number> = {};
      snapDocs.docs.forEach(d => {
        const dd = d.data();
        const ym = (dd.date || '').slice(0, 7);
        if (dates.includes(ym) && dd.debts !== undefined) {
          if (!monthlyExpenses[ym]) monthlyExpenses[ym] = dd.debts || 0;
        }
      });
      const vals = Object.values(monthlyExpenses);
      if (vals.length >= 2) setLifestyleAvg3m(vals.reduce((s, v) => s + v, 0) / vals.length);
    } catch {}

    // Last price update
    try {
      const priceDoc = await getDocs(query(collection(db, 'market_prices'), orderBy('updatedAt', 'desc'), limit(1)));
      if (!priceDoc.empty) {
        const ts = priceDoc.docs[0].data().updatedAt;
        if (ts?.toDate) setPricesLastUpdated(ts.toDate().toISOString());
        else if (typeof ts === 'string') setPricesLastUpdated(ts);
      }
    } catch {}
  }, [user, data]);

  // ─── Load partner data (Family Premium) ────────────────────
  useEffect(() => {
    if (!user || !isFamily || !partnerUid) return;
    const loadPartner = async () => {
      try {
        const [invSnap, cashSnap, assetSnap, incSnap, expSnap, mipSnap] = await Promise.all([
          getDocs(collection(db, 'users', partnerUid, 'investments')),
          getDocs(collection(db, 'users', partnerUid, 'cashSavings')),
          getDocs(collection(db, 'users', partnerUid, 'physicalAssets')),
          getDocs(collection(db, 'users', partnerUid, 'incomes')),
          getDocs(collection(db, 'users', partnerUid, 'lifestyleBasket')),
          getDocs(collection(db, 'users', partnerUid, 'monthlyInvestments')),
        ]);

        let pInv = 0; invSnap.docs.forEach(d => { const dd = d.data(); pInv += (dd.currentPrice || dd.purchasePrice || 0) * (dd.quantity || 0); });
        let pCash = 0; cashSnap.docs.forEach(d => pCash += d.data().amount || 0);
        let pAssets = 0; assetSnap.docs.forEach(d => pAssets += d.data().currentValue || 0);
        const pInc = processIncome(incSnap.docs);
        const pExp = processLifestyle(expSnap.docs);
        const { recurringValue: pRec } = processRecurring(mipSnap.docs);

        setPartnerData({ investments: pInv, cash: pCash, assets: pAssets, income: pInc, expenses: pExp, recurring: pRec });
      } catch (err) {
        console.error('[Dashboard] Partner data load error:', err);
      }
    };
    loadPartner();
  }, [user, isFamily, partnerUid]);

  // ─── Load on mount ─────────────────────────────────────────
  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  // ─── Computed values based on active profile ───────────────
  const selfNetWorth = data.cashSavings + data.physicalAssets + data.totalInvestments + data.recurringValue - data.totalDebt;
  const partnerNetWorth = partnerData.cash + partnerData.assets + partnerData.investments + partnerData.recurring;
  const householdNetWorth = selfNetWorth + partnerNetWorth;

  const activeValues = useMemo(() => {
    const nw = isHouseholdView ? householdNetWorth : isPartnerView ? partnerNetWorth : selfNetWorth;
    return {
      netWorth: nw,
      investments: isHouseholdView ? data.totalInvestments + partnerData.investments : isPartnerView ? partnerData.investments : data.totalInvestments,
      cash: isHouseholdView ? data.cashSavings + partnerData.cash : isPartnerView ? partnerData.cash : data.cashSavings,
      assets: isHouseholdView ? data.physicalAssets + partnerData.assets : isPartnerView ? partnerData.assets : data.physicalAssets,
      income: isHouseholdView ? data.netIncome + partnerData.income : isPartnerView ? partnerData.income : data.netIncome,
      expenses: isHouseholdView ? data.lifestyleMonthly + partnerData.expenses : isPartnerView ? partnerData.expenses : data.lifestyleMonthly,
      label: isHouseholdView ? 'Family' : isPartnerView ? partnerName + "'s" : 'Your',
    };
  }, [data, partnerData, isHouseholdView, isPartnerView, selfNetWorth, partnerNetWorth, householdNetWorth, partnerName]);

  const totalGain = data.totalInvestments - data.totalCost;
  const totalGainPct = data.totalCost > 0 ? (totalGain / data.totalCost) * 100 : 0;

  // Projection
  const projectedValue = useMemo(() => {
    let inv = activeValues.investments + data.recurringValue;
    const annual = data.monthlyInvestment * 12;
    for (let y = 0; y < data.projYears; y++) inv = inv * (1 + data.expectedReturn) + annual;
    return activeValues.cash + activeValues.assets + inv - Math.max(0, data.totalDebt - data.monthlyDebtPayment * 12 * data.projYears);
  }, [activeValues, data]);

  const monthlySaving = activeValues.income > 0
    ? activeValues.income - activeValues.expenses - data.monthlyInvestment - data.monthlyDebtPayment
    : 0;

  // Health score
  const healthScore = useMemo(() => calculateHealthScore(
    activeValues.income, activeValues.expenses, data.monthlyInvestment,
    data.totalDebt, data.invByType, activeValues.cash,
    data.goalCount, data.goalProgress, data.totalCost, totalGainPct
  ), [activeValues, data, totalGainPct]);

  // Alerts
  const alerts = useMemo(() => generateAlerts(
    totalGainPct, activeValues.expenses, activeValues.cash,
    data.totalDebt, data.monthlyDebtPayment,
    data.goalCount, data.goalProgress,
    activeValues.income, monthlySaving, data.monthlyInvestment,
    lifestyleAvg3m, data.lifestyleMonthly
  ), [totalGainPct, activeValues, data, monthlySaving, lifestyleAvg3m]);

  return {
    // Raw data
    data,
    partnerData,
    loading,
    onboardingDismissed,
    setOnboardingDismissed,

    // Computed
    activeValues,
    totalGain,
    totalGainPct,
    projectedValue,
    monthlySaving,
    healthScore,
    alerts,

    // Trends
    netWorthChange30d,
    netWorthChangePct30d,
    pricesLastUpdated,

    // Actions
    refresh: loadData,
  };
}
