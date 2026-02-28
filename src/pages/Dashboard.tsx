import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLocale } from '../context/LocaleContext';
import { useTier } from '../hooks/useTier';
import { usePartner } from '../context/PartnerContext';
import SidebarLayout from '../components/SidebarLayout';
import PartnerToggle from '../components/PartnerToggle';
import NetWorthSparkline from '../components/NetWorthSparkline';
import OnboardingWizard from '../components/OnboardingWizard';
import DividendTracker from '../components/DividendTracker';
import { db } from '../firebase/config';
import { auth as firebaseAuth } from '../firebase/config';
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { fetchMultiplePrices } from '../services/marketDataService';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Dashboard() {
  const { user } = useAuth();
  usePageTitle('Dashboard');
  const { formatAmount, currency } = useCurrency();
  const { t } = useLocale();
  const { isPremium, isFree, isCouples } = useTier();
  const { partnerName, isFamily, activeProfile, isHouseholdView, isPartnerView, partnerUid } = usePartner();
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const isEmailUser = user?.providerData?.some(p => p.providerId === 'password');
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified ?? false);

  // Refresh emailVerified status on load (catches verification done in another tab)
  useEffect(() => {
    if (user && isEmailUser && !user.emailVerified) {
      user.reload().then(() => {
        if (user.emailVerified) {
          setEmailVerified(true);
          setDoc(doc(db, 'users', user.uid), { emailVerified: true }, { merge: true }).catch(() => {});
        }
      }).catch(() => {});
    } else if (user?.emailVerified) {
      setEmailVerified(true);
    }
  }, [user]);

  const needsVerification = isEmailUser && !emailVerified && !verifyBannerDismissed;

  const [totalInvestments, setTotalInvestments] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [investmentCount, setInvestmentCount] = useState(0);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [investmentItems, setInvestmentItems] = useState<any[]>([]);
  const [invByType, setInvByType] = useState<{ type: string; value: number; cost: number }[]>([]);
  const [lifestyleMonthly, setLifestyleMonthly] = useState(0);
  const [goalCount, setGoalCount] = useState(0);
  const [goalProgress, setGoalProgress] = useState(0);
  const [goalsOnTrack, setGoalsOnTrack] = useState(0);
  const [cashSavings, setCashSavings] = useState(0);
  const [physicalAssets, setPhysicalAssets] = useState(0);
  const [recurringValue, setRecurringValue] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [monthlyInvestment, setMonthlyInvestment] = useState(0);
  const [monthlyDebtPayment, setMonthlyDebtPayment] = useState(0);
  const [expectedReturn, setExpectedReturn] = useState(0.07);
  const [projYears, setProjYears] = useState(10);
  const [netIncome, setNetIncome] = useState(0);
  const [debtCount, setDebtCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Tier 2: Trend tracking
  const [netWorthChange30d, setNetWorthChange30d] = useState<number | null>(null);
  const [netWorthChangePct30d, setNetWorthChangePct30d] = useState<number>(0);
  const [lifestyleAvg3m, setLifestyleAvg3m] = useState<number | null>(null);
  const [pricesLastUpdated, setPricesLastUpdated] = useState<string | null>(null);

  // Partner data (Family Premium only)
  const [partnerInvestments, setPartnerInvestments] = useState(0);
  const [partnerCash, setPartnerCash] = useState(0);
  const [partnerAssets, setPartnerAssets] = useState(0);
  const [partnerIncome, setPartnerIncome] = useState(0);
  const [partnerExpenses, setPartnerExpenses] = useState(0);
  const [partnerRecurring, setPartnerRecurring] = useState(0);

  useEffect(() => { if (user) loadData(); }, [user]);

  // Load partner data for Family Premium (from partner's actual account)
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
        setPartnerInvestments(pInv);

        let pCash = 0; cashSnap.docs.forEach(d => pCash += d.data().amount || 0);
        setPartnerCash(pCash);

        let pAssets = 0; assetSnap.docs.forEach(d => pAssets += d.data().currentValue || 0);
        setPartnerAssets(pAssets);

        let pInc = 0;
        incSnap.docs.forEach(d => {
          const inc = d.data(); const amt = inc.amount || 0; const freq = inc.frequency || 'monthly';
          pInc += freq === 'yearly' ? amt / 12 : freq === 'quarterly' ? amt / 3 : amt;
        });
        setPartnerIncome(pInc);

        let pExp = 0;
        expSnap.docs.forEach(d => {
          const e = d.data(); const cost = e.monthlyCost || e.cost || 0; const freq = e.frequency || 'monthly';
          pExp += freq === 'monthly' ? cost : freq === 'quarterly' ? cost / 3 : cost / 12;
        });
        setPartnerExpenses(pExp);

        let pRec = 0;
        mipSnap.docs.forEach(d => {
          const m = d.data(); const start = m.startDate ? new Date(m.startDate + 'T00:00:00') : null;
          if (!start || !m.monthlyAmount) return;
          const months = Math.max(0, (new Date().getFullYear() - start.getFullYear()) * 12 + (new Date().getMonth() - start.getMonth()));
          pRec += m.monthlyAmount * months;
        });
        setPartnerRecurring(pRec);
      } catch (err) { console.error('[Dashboard] Partner data load error:', err); }
    };
    loadPartner();
  }, [user, isFamily, partnerUid]);

  const partnerNetWorth = partnerCash + partnerAssets + partnerInvestments + partnerRecurring;
  const selfNetWorth = cashSavings + physicalAssets + totalInvestments + recurringValue - totalDebt;
  const householdNetWorth = selfNetWorth + partnerNetWorth;

  // View-dependent values based on active profile toggle
  const viewNetWorth = isHouseholdView ? householdNetWorth : isPartnerView ? partnerNetWorth : selfNetWorth;
  const viewInvestments = isHouseholdView ? totalInvestments + partnerInvestments : isPartnerView ? partnerInvestments : totalInvestments;
  const viewCash = isHouseholdView ? cashSavings + partnerCash : isPartnerView ? partnerCash : cashSavings;
  const viewAssets = isHouseholdView ? physicalAssets + partnerAssets : isPartnerView ? partnerAssets : physicalAssets;
  const viewIncome = isHouseholdView ? netIncome + partnerIncome : isPartnerView ? partnerIncome : netIncome;
  const viewExpenses = isHouseholdView ? lifestyleMonthly + partnerExpenses : isPartnerView ? partnerExpenses : lifestyleMonthly;
  const viewLabel = isHouseholdView ? 'Family' : isPartnerView ? partnerName + "'s" : 'Your';

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // ─── Parallel fetch: all Firestore reads at once ───
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

      // ─── Process Investments ───
      const typeMap: Record<string, { value: number; cost: number }> = {};
      let invTotal = 0, costTotal = 0;
      invSnap.docs.forEach(d => {
        const data = d.data();
        const val = (data.quantity || 0) * (data.currentPrice || data.purchasePrice || 0);
        const cost = (data.quantity || 0) * (data.purchasePrice || 0);
        invTotal += val; costTotal += cost;
        const tp = data.type || 'Other';
        if (!typeMap[tp]) typeMap[tp] = { value: 0, cost: 0 };
        typeMap[tp].value += val; typeMap[tp].cost += cost;
      });
      setTotalInvestments(invTotal); setTotalCost(costTotal);
      setInvestmentCount(invSnap.docs.length);
      setInvByType(Object.entries(typeMap).map(([type, d]) => ({ type, ...d })).sort((a, b) => b.value - a.value));
      setInvestmentItems(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // ─── Process Goals ───
      let gTarget = 0, gCurrent = 0, onTrack = 0;
      goalSnap.docs.forEach(d => {
        const data = d.data();
        gTarget += data.targetAmount || 0; gCurrent += data.currentAmount || 0;
        if ((data.currentAmount || 0) >= (data.targetAmount || 1) * 0.4) onTrack++;
      });
      setGoalCount(goalSnap.docs.length);
      setGoalProgress(gTarget > 0 ? (gCurrent / gTarget) * 100 : 0);
      setGoalsOnTrack(onTrack);

      // ─── Process Lifestyle ───
      let lm = 0;
      lifeSnap.docs.forEach(d => {
        const data = d.data();
        const cost = data.monthlyCost || data.cost || 0;
        const freq = data.frequency || 'monthly';
        lm += freq === 'monthly' ? cost : freq === 'quarterly' ? cost / 3 : cost / 12;
      });
      setLifestyleMonthly(lm);

      // ─── Process Projection Settings ───
      if (userSnap.exists() && userSnap.data().projectionYears) setProjYears(userSnap.data().projectionYears);
      if (projSnap.exists()) {
        const pd = projSnap.data();
        if (pd.monthlyInvestment) setMonthlyInvestment(pd.monthlyInvestment);
        if (pd.expectedReturn) setExpectedReturn(pd.expectedReturn / 100);
        if (pd.projectionYears) setProjYears(pd.projectionYears);
        if (pd.netIncome) setNetIncome(pd.netIncome);
      }

      // ─── Process Income (overrides projection saved value) ───
      if (incSnap) {
        let totalMonthlyIncome = 0;
        incSnap.docs.forEach(d => {
          const inc = d.data(); const amt = inc.amount || 0; const freq = inc.frequency || 'monthly';
          totalMonthlyIncome += freq === 'yearly' ? amt / 12 : freq === 'quarterly' ? amt / 3 : amt;
        });
        if (totalMonthlyIncome > 0) setNetIncome(totalMonthlyIncome);
      }

      // ─── Process Cash & Savings ───
      if (cashSnap) { let c = 0; cashSnap.docs.forEach(d => c += d.data().amount || 0); setCashSavings(c); }

      // ─── Process Physical Assets ───
      if (assetSnap) { let a = 0; assetSnap.docs.forEach(d => a += d.data().currentValue || 0); setPhysicalAssets(a); }

      // ─── Process Recurring Investments ───
      if (mipSnap) {
        let mVal = 0, mMonth = 0;
        mipSnap.docs.forEach(d => {
          const m = d.data(); const amt = m.monthlyAmount || 0; const freq = m.frequency || 'monthly';
          mMonth += freq === 'quarterly' ? amt / 3 : freq === 'yearly' ? amt / 12 : amt;
          const start = m.startDate ? new Date(m.startDate + 'T00:00:00') : null;
          if (!start || amt <= 0) return;
          const step = freq === 'quarterly' ? 3 : freq === 'yearly' ? 12 : 1;
          let inv = 0; const dt = new Date(start);
          while (dt <= new Date()) { inv += amt; dt.setMonth(dt.getMonth() + step); }
          mVal += m.currentPrice && m.purchasePrice && m.purchasePrice > 0 ? inv * (m.currentPrice / m.purchasePrice) : inv;
        });
        setRecurringValue(mVal);
        if (mMonth > 0 && monthlyInvestment === 0) setMonthlyInvestment(mMonth);
      }

      // ─── Process Debts ───
      let dSum = 0, dPay = 0;
      debtSnap.docs.forEach(d => { const dd = d.data(); dSum += dd.remainingAmount || 0; dPay += dd.monthlyPayment || 0; });
      setTotalDebt(dSum); setMonthlyDebtPayment(dPay); setDebtCount(debtSnap.docs.length);

      // ─── Auto-refresh live prices (non-blocking) ───
      const allSymbols: string[] = [];
      invSnap.docs.forEach(d => { const s = d.data().symbol; if (s) allSymbols.push(s); });
      if (allSymbols.length > 0) {
        fetchMultiplePrices(allSymbols).then(priceMap => {
          if (priceMap.size === 0) return;
          let liveTotal = 0, costTotal2 = 0;
          invSnap.docs.forEach(d => {
            const data = d.data();
            const sym = (data.symbol || '').trim().toUpperCase();
            const live = priceMap.get(sym);
            const price = live ? live.price : (data.currentPrice || data.purchasePrice || 0);
            liveTotal += (data.quantity || 0) * price;
            costTotal2 += (data.quantity || 0) * (data.purchasePrice || 0);
          });
          if (liveTotal > 0) { setTotalInvestments(liveTotal); setTotalCost(costTotal2); }
        }).catch(() => {});
      }

      // ─── Onboarding check ───
      if (userSnap.exists() && userSnap.data().onboardingCompletedAt) {
        setOnboardingDismissed(true);
      }

      // ─── Daily net worth snapshot (non-blocking) ───
      const today = new Date().toISOString().split('T')[0];
      const snapCash = cashSnap ? cashSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0) : 0;
      const snapAssets = assetSnap ? assetSnap.docs.reduce((s, d) => s + (d.data().currentValue || 0), 0) : 0;
      if (invTotal > 0) {
        const snapRef = doc(db, 'users', uid, 'netWorthSnapshots', today);
        getDoc(snapRef).then(existing => {
          if (!existing.exists()) {
            setDoc(snapRef, {
              date: today, netWorth: invTotal + snapCash + snapAssets - dSum,
              investments: invTotal, cash: snapCash, assets: snapAssets, debts: dSum,
              createdAt: new Date(),
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (err) { console.error('Dashboard load error:', err); }
    finally {
      setLoading(false);

      // ─── Tier 2: Non-blocking trend analysis ───
      if (user) {
        const uid = user.uid;
        // 30-day net worth trend
        try {
          const d30 = new Date(); d30.setDate(d30.getDate() - 30);
          const d30Str = d30.toISOString().split('T')[0];
          const oldSnap = await getDoc(doc(db, 'users', uid, 'netWorthSnapshots', d30Str));
          if (oldSnap.exists()) {
            const oldNw = oldSnap.data().netWorth || 0;
            const currentNw = cashSavings + physicalAssets + totalInvestments + recurringValue - totalDebt;
            setNetWorthChange30d(currentNw - oldNw);
            setNetWorthChangePct30d(oldNw > 0 ? ((currentNw - oldNw) / oldNw) * 100 : 0);
          }
        } catch {}
        // 3-month lifestyle average for anomaly detection
        try {
          const dates: string[] = [];
          for (let m = 1; m <= 3; m++) {
            const d = new Date(); d.setMonth(d.getMonth() - m);
            dates.push(d.toISOString().split('T')[0].slice(0, 7)); // YYYY-MM
          }
          const snapQ = query(collection(db, 'users', uid, 'netWorthSnapshots'), orderBy('date', 'desc'), limit(90));
          const snapDocs = await getDocs(snapQ);
          const monthlyExpenses: Record<string, number> = {};
          snapDocs.docs.forEach(d => {
            const data = d.data();
            const ym = (data.date || '').slice(0, 7);
            if (dates.includes(ym) && data.debts !== undefined) {
              // Use the latest snapshot per month as a rough proxy
              if (!monthlyExpenses[ym]) monthlyExpenses[ym] = data.debts || 0;
            }
          });
          const vals = Object.values(monthlyExpenses);
          if (vals.length >= 2) setLifestyleAvg3m(vals.reduce((s, v) => s + v, 0) / vals.length);
        } catch {}
        // Last price update time
        try {
          const priceDoc = await getDocs(query(collection(db, 'market_prices'), orderBy('updatedAt', 'desc'), limit(1)));
          if (!priceDoc.empty) {
            const ts = priceDoc.docs[0].data().updatedAt;
            if (ts?.toDate) setPricesLastUpdated(ts.toDate().toISOString());
            else if (typeof ts === 'string') setPricesLastUpdated(ts);
          }
        } catch {}
      }
    }
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'there';
  const totalGain = totalInvestments - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const netWorth = isFamily ? viewNetWorth : (cashSavings + physicalAssets + totalInvestments + recurringValue - totalDebt);

  // Active-view values (respond to You/Partner/Household toggle)
  const aCash = isFamily ? viewCash : cashSavings;
  const aAssets = isFamily ? viewAssets : physicalAssets;
  const aInvestments = isFamily ? viewInvestments : totalInvestments;
  const aIncome = isFamily ? viewIncome : netIncome;
  const aExpenses = isFamily ? viewExpenses : lifestyleMonthly;

  const projectedValue = useMemo(() => {
    let inv = aInvestments + recurringValue;
    const annual = monthlyInvestment * 12;
    for (let y = 0; y < projYears; y++) inv = inv * (1 + expectedReturn) + annual;
    return aCash + aAssets + inv - Math.max(0, totalDebt - monthlyDebtPayment * 12 * projYears);
  }, [aInvestments, recurringValue, projYears, aCash, aAssets, totalDebt, monthlyInvestment, expectedReturn, monthlyDebtPayment]);

  // ─── Health Score ───
  const healthScore = useMemo(() => {
    const scores: { name: string; value: number; color: string }[] = [];
    // Savings Rate
    let sr = monthlyInvestment > 0 ? 50 : 20;
    if (aIncome > 0) { sr = Math.max(0, Math.min(100, Math.round(((aIncome - aExpenses) / aIncome) * 100))); }
    scores.push({ name: 'Savings Rate', value: sr, color: '#10b981' });
    // Debt-to-Income
    let dti = totalDebt === 0 ? 95 : 80;
    if (aIncome > 0 && totalDebt > 0) dti = Math.max(0, Math.min(100, Math.round(100 - (totalDebt / (aIncome * 12)) * 25)));
    scores.push({ name: 'Debt-to-Income', value: dti, color: dti >= 60 ? '#10b981' : dti >= 40 ? '#f59e0b' : '#ef4444' });
    // Diversification
    const types = invByType.length;
    scores.push({ name: 'Diversification', value: types === 0 ? 20 : types === 1 ? 35 : types === 2 ? 55 : types === 3 ? 72 : 85, color: '#3b82f6' });
    // Emergency Fund
    let ef = aCash > 0 ? 50 : 15;
    if (aExpenses > 0) ef = Math.round(Math.min(100, (aCash / aExpenses / 6) * 100));
    scores.push({ name: 'Emergency Fund', value: ef, color: '#8b5cf6' });
    // Goal Progress
    scores.push({ name: 'Goal Progress', value: goalCount > 0 ? Math.round(Math.min(100, goalProgress)) : 20, color: '#0f766e' });
    // Returns
    scores.push({ name: 'Returns', value: totalCost > 0 ? Math.round(Math.min(100, Math.max(0, 50 + totalGainPct * 2))) : 30, color: '#06b6d4' });
    return { overall: Math.round(scores.reduce((s, sc) => s + sc.value, 0) / scores.length), scores };
  }, [aIncome, aExpenses, monthlyInvestment, totalDebt, invByType, aCash, goalCount, goalProgress, totalCost, totalGainPct]);

  const scoreLabel = healthScore.overall >= 80 ? 'Excellent' : healthScore.overall >= 65 ? 'Good' : healthScore.overall >= 45 ? 'Fair' : 'Needs Attention';
  // Health score label
  const monthlySaving = aIncome > 0 ? aIncome - aExpenses - monthlyInvestment - monthlyDebtPayment : 0;

  // Alerts
  const alerts = useMemo(() => {
    const a: { type: 'good' | 'warn' | 'info'; icon: string; text: string }[] = [];
    if (totalGainPct < -10) a.push({ type: 'warn', icon: '📉', text: `Portfolio down <strong>${totalGainPct.toFixed(1)}%</strong>. Review holdings.` });
    if (totalGainPct > 15) a.push({ type: 'good', icon: '🚀', text: `Portfolio up <strong>+${totalGainPct.toFixed(1)}%</strong>. Consider rebalancing.` });
    if (aExpenses > 0 && aCash > 0) {
      const m = aCash / aExpenses;
      if (m < 3) a.push({ type: 'info', icon: '💡', text: `Emergency fund: <strong>${m.toFixed(1)} months</strong>. Aim for 6.` });
      else if (m >= 6) a.push({ type: 'good', icon: '🛡️', text: `Emergency fund: <strong>${m.toFixed(1)} months</strong>. Well done!` });
    }
    if (totalDebt > 0 && monthlyDebtPayment > 0) {
      const yrs = Math.ceil(totalDebt / monthlyDebtPayment / 12);
      a.push({ type: yrs <= 2 ? 'good' : 'info', icon: '🏦', text: `Debt-free in ~<strong>${yrs} year${yrs !== 1 ? 's' : ''}</strong>.` });
    }
    if (goalCount > 0 && goalProgress >= 40) a.push({ type: 'good', icon: '🎯', text: `Goals <strong>${goalProgress.toFixed(0)}%</strong> complete — on track!` });
    if (aIncome > 0 && monthlySaving >= 0) {
      const rate = ((monthlySaving + monthlyInvestment) / aIncome * 100);
      a.push({ type: rate >= 30 ? 'good' : 'info', icon: '📊', text: `Savings rate: <strong>${rate.toFixed(0)}%</strong> of income.` });
    }
    if (a.length === 0) a.push({ type: 'info', icon: '✨', text: 'Add investments, expenses, and goals to unlock insights.' });
    // Spending anomaly
    if (lifestyleAvg3m !== null && lifestyleMonthly > 0 && lifestyleAvg3m > 0) {
      const pctDiff = ((lifestyleMonthly - lifestyleAvg3m) / lifestyleAvg3m) * 100;
      if (pctDiff > 20) a.push({ type: 'warn', icon: '⚡', text: `Expenses up <strong>${pctDiff.toFixed(0)}%</strong> vs 3-month average.` });
    }
    return a.slice(0, 6);
  }, [totalGainPct, aExpenses, aCash, totalDebt, monthlyDebtPayment, goalCount, goalProgress, aIncome, monthlySaving, monthlyInvestment, lifestyleAvg3m, lifestyleMonthly]);

  if (loading) return (
    <SidebarLayout><div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="animate-pulse space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-10 w-48 bg-slate-200/80 rounded-xl" />
          <div className="flex-1" />
          <div className="h-8 w-32 bg-slate-200/60 rounded-lg" />
        </div>
        <div className="h-52 bg-gradient-to-br from-slate-200/50 to-slate-100/50 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100/80 rounded-2xl" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-56 bg-slate-100/60 rounded-2xl" />
          <div className="h-56 bg-slate-100/60 rounded-2xl" />
        </div>
      </div>
    </div></SidebarLayout>
  );

  return (
    <SidebarLayout>
      <div className="p-5 lg:p-8 max-w-7xl mx-auto">
        {/* Email Verification Banner */}
        {needsVerification && (
          <div className="mb-5 px-5 py-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3 shadow-sm">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Verify your email to unlock all features</p>
              <p className="text-xs text-amber-700 mt-1">Check your inbox for a verification link from <strong>support@myfynzo.com</strong>. It may be in your spam folder.</p>
              <div className="mt-2.5 flex items-center gap-3">
                {verifySent ? (
                  <span className="text-xs font-semibold text-green-700">Verification email sent! Check your inbox.</span>
                ) : (
                  <button onClick={async () => {
                    setResendingVerify(true);
                    try {
                      const fns = getFunctions();
                      const sendVerify = httpsCallable(fns, 'sendVerificationEmail');
                      await sendVerify({});
                      setVerifySent(true);
                    } catch {
                      try {
                        if (firebaseAuth.currentUser) {
                          await sendEmailVerification(firebaseAuth.currentUser);
                          setVerifySent(true);
                        }
                      } catch { }
                    }
                    setResendingVerify(false);
                  }}
                    disabled={resendingVerify}
                    className="text-xs font-semibold text-amber-800 underline hover:text-amber-900 transition-colors">
                    {resendingVerify ? 'Sending...' : 'Resend verification email'}
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => setVerifyBannerDismissed(true)} className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Onboarding wizard */}
        {!onboardingDismissed && investmentCount === 0 && !loading && (
          <OnboardingWizard onComplete={() => setOnboardingDismissed(true)} investmentCount={investmentCount} />
        )}

        {/* ═══ HEADER ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-secondary font-display">{t('dashboard.welcome', { name: displayName })}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('dashboard.overview')}</p>
          </div>
          {isPremium && aIncome > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-primary/5 to-teal-50 border border-primary/10">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
              </div>
              <span className="text-[12px] text-slate-600 leading-snug">
                Savings rate <strong className="text-primary">{((monthlySaving + monthlyInvestment) / aIncome * 100).toFixed(0)}%</strong>
                {totalGainPct > 3 ? <> · Portfolio <strong className="text-emerald-600">+{totalGainPct.toFixed(1)}%</strong></> : totalGainPct < -3 ? <> · Portfolio <strong className="text-red-500">{totalGainPct.toFixed(1)}%</strong></> : null}
              </span>
            </div>
          )}
        </div>

        <PartnerToggle context="View financial overview" showHousehold />

        {/* ═══ HERO: HEALTH SCORE + NET WORTH ═══ */}
        <div className="rounded-2xl mb-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0c1220 0%, #162032 40%, #0f1c2e 100%)' }}>
          {/* Ambient glow effects */}
          <div className="absolute -top-20 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #34d399, transparent 65%)' }} />
          <div className="absolute -bottom-32 right-10 w-[350px] h-[350px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #0ea5e9, transparent 60%)' }} />
          <div className="absolute top-1/2 left-1/3 w-[250px] h-[250px] rounded-full opacity-[0.02]" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 60%)' }} />

          <div className="relative z-10 p-6 lg:p-7">
            {/* Row 1: Score + Net Worth + Projected */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
              {/* Health Score Ring */}
              <div className="flex items-center gap-5 flex-shrink-0">
                <div className="relative w-[110px] h-[110px]">
                  <svg viewBox="0 0 110 110" width="110" height="110">
                    <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                    <circle cx="55" cy="55" r="46" fill="none" stroke="url(#healthGrad)" strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={2 * Math.PI * 46 - (healthScore.overall / 100) * 2 * Math.PI * 46}
                      transform="rotate(-90 55 55)" className="transition-all duration-1000" />
                    <defs>
                      <linearGradient id="healthGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#0d9488" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[28px] font-extrabold tabular-nums text-white">{healthScore.overall}</span>
                    <span className="text-[7px] text-white/25 uppercase tracking-[0.2em]">score</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Financial Health</p>
                  <h2 className="text-lg font-bold text-white tracking-tight">{scoreLabel}</h2>
                </div>
              </div>

              <div className="hidden lg:block flex-1" />

              {/* Net Worth + Projected */}
              <div className="flex gap-8">
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">Net Worth</p>
                  <p className="text-[26px] font-extrabold text-white leading-none tabular-nums">{formatAmount(netWorth)}</p>
                  {netWorthChange30d !== null && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 ${
                      netWorthChange30d >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                    }`}>
                      {netWorthChange30d >= 0 ? '▲' : '▼'} {Math.abs(netWorthChangePct30d).toFixed(1)}% <span className="text-white/20 font-normal">30d</span>
                    </span>
                  )}
                  <NetWorthSparkline currentNetWorth={netWorth} className="mt-2" />
                </div>
                <div className="border-l border-white/[0.06] pl-8">
                  <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">Projected ({projYears}yr)</p>
                  <p className="text-[26px] font-extrabold leading-none tabular-nums" style={{ color: '#2dd4bf' }}>{formatAmount(projectedValue)}</p>
                  {isPremium && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-medium text-emerald-400/70">{expectedReturn > 0 ? `${(expectedReturn * 100).toFixed(0)}%` : '7%'} return</span>
                      <span className="text-[10px] text-white/15">·</span>
                      <span className="text-[10px] text-white/20">{formatAmount(monthlyInvestment)}/mo</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-scores — pill grid */}
            <div className="mt-6 pt-5 border-t border-white/[0.05]">
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                {healthScore.scores.map(s => (
                  <div key={s.name} className="rounded-xl px-3 py-2.5 border border-white/[0.04] hover:border-white/[0.08] transition-all" style={{ background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] text-white/30 truncate">{s.name}</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ QUICK STATS ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { to: '/investments', icon: '📈', accent: 'from-emerald-500/10 to-emerald-500/5', ring: 'ring-emerald-500/10', l: 'Portfolio', v: formatAmount(aInvestments + recurringValue), d: totalGain !== 0 ? `${totalGain >= 0 ? '+' : ''}${totalGainPct.toFixed(1)}%` : `${investmentCount} assets`, dc: totalGain >= 0 ? 'text-emerald-600' : 'text-red-500' },
            { to: '/debts', icon: '💳', accent: 'from-amber-500/10 to-amber-500/5', ring: 'ring-amber-500/10', l: 'Debt', v: formatAmount(totalDebt), d: debtCount > 0 ? `${debtCount} active` : 'None', dc: totalDebt === 0 ? 'text-emerald-600' : 'text-slate-400' },
            { to: '/goal-tracker', icon: '🎯', accent: 'from-blue-500/10 to-blue-500/5', ring: 'ring-blue-500/10', l: 'Goals', v: `${goalCount} Active`, d: goalsOnTrack > 0 ? `${goalsOnTrack} on track` : goalCount > 0 ? `${goalProgress.toFixed(0)}%` : 'Set one', dc: 'text-blue-600' },
            { to: '/wealth-projection', icon: '🔮', accent: 'from-violet-500/10 to-violet-500/5', ring: 'ring-violet-500/10', l: 'Projected', v: formatAmount(projectedValue), d: `in ${projYears} years`, dc: 'text-slate-400' },
          ].map(s => (
            <Link key={s.to} to={s.to} className={`group relative p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300/60 transition-all duration-200`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-lg mb-3`}>{s.icon}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{s.l}</div>
              <div className="text-base font-bold text-secondary mt-0.5 tabular-nums">{s.v}</div>
              <div className={`text-[11px] font-semibold mt-0.5 ${s.dc}`}>{s.d}</div>
            </Link>
          ))}
        </div>

        {/* ═══ NET WORTH BREAKDOWN + ALERTS ═══ */}
        <div className="grid md:grid-cols-2 gap-4 mb-5">
          {/* Net Worth — Donut */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Net Worth Breakdown</h3>
            <div className="flex items-center gap-5">
              <div className="relative w-[130px] h-[130px] flex-shrink-0">
                {(() => {
                  const segments = [
                    { label: 'Cash', value: aCash, color: '#10b981' },
                    { label: 'Investments', value: aInvestments + recurringValue, color: '#0f766e' },
                    { label: 'Assets', value: aAssets, color: '#8b5cf6' },
                  ].filter(s => s.value > 0);
                  const total = segments.reduce((s, i) => s + i.value, 0) || 1;
                  const R = 52, cx = 65, cy = 65, C = 2 * Math.PI * R;
                  let offset = 0;
                  return (
                    <svg viewBox="0 0 130 130" width="130" height="130">
                      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
                      {segments.map((seg, i) => {
                        const pct = seg.value / total;
                        const dash = pct * C;
                        const gap = C - dash;
                        const el = <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={seg.color} strokeWidth="14"
                          strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
                          transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-700" />;
                        offset += dash;
                        return el;
                      })}
                      {totalDebt > 0 && (() => {
                        const debtPct = Math.min(totalDebt / total, 0.5);
                        const dash = debtPct * C;
                        return <circle cx={cx} cy={cy} r={R} fill="none" stroke="#ef4444" strokeWidth="14" strokeOpacity="0.6"
                          strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
                          transform={`rotate(-90 ${cx} ${cy})`} />;
                      })()}
                      <text x={cx} y={cy - 6} textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="700">{formatAmount(netWorth)}</text>
                      <text x={cx} y={cy + 8} textAnchor="middle" fill="#94a3b8" fontSize="7">NET WORTH</text>
                    </svg>
                  );
                })()}
              </div>
              <div className="flex-1 space-y-2.5">
                {[
                  { label: 'Cash & Savings', value: aCash, color: '#10b981' },
                  { label: 'Investments', value: aInvestments + recurringValue, color: '#0f766e' },
                  { label: 'Physical Assets', value: aAssets, color: '#8b5cf6' },
                  { label: 'Debt', value: -totalDebt, color: '#ef4444' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-slate-500 flex-1">{item.label}</span>
                    <span className={`text-xs font-bold tabular-nums ${item.value < 0 ? 'text-red-500' : 'text-secondary'}`}>
                      {item.value < 0 ? '−' : ''}{formatAmount(Math.abs(item.value))}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-secondary">Projected ({projYears}yr)</span>
                  <span className="text-xs font-bold text-primary tabular-nums">{formatAmount(projectedValue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Alerts */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Smart Alerts</h3>
              {pricesLastUpdated && (
                <span className="text-[10px] text-slate-300">
                  Prices {(() => { try { const d = new Date(pricesLastUpdated); const mins = Math.round((Date.now() - d.getTime()) / 60000); return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.round(mins/60)}h ago` : d.toLocaleDateString(); } catch { return ''; } })()}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                  a.type === 'good' ? 'bg-emerald-50/40 border-emerald-100'
                  : a.type === 'warn' ? 'bg-amber-50/40 border-amber-100'
                  : 'bg-blue-50/40 border-blue-100'
                }`}>
                  <span className="text-sm flex-shrink-0 mt-px">{a.icon}</span>
                  <div className="text-xs text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: a.text }} />
                </div>
              ))}
            </div>
          </div>

          {/* Dividend Income Widget (compact) */}
          {investmentItems.some(i => i.dividendYield > 0 || i.dividendPerShare > 0) && (
            <DividendTracker investments={investmentItems} compact />
          )}
        </div>

        {/* ═══ PREMIUM: Cash Flow + Projection Chart ═══ */}
        {isPremium && aIncome > 0 ? (
          <>
            {/* Monthly Cash Flow */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 mb-4">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Monthly Cash Flow</h3>
                <span className="text-[11px] text-slate-400">
                  Savings rate: <strong className="text-primary">{aIncome > 0 ? Math.round(Math.max(0, monthlySaving) / aIncome * 100) : 0}%</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                {[
                  { label: 'Income', value: aIncome, bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', badge: 'in', badgeBg: 'bg-emerald-100 text-emerald-600' },
                  { label: 'Expenses', value: aExpenses, bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600', badge: 'out', badgeBg: 'bg-slate-100 text-slate-400' },
                  { label: 'Invested', value: monthlyInvestment, bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', badge: 'out', badgeBg: 'bg-blue-100 text-blue-500' },
                  { label: 'Debt', value: monthlyDebtPayment, bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', badge: 'out', badgeBg: 'bg-slate-100 text-slate-400' },
                  { label: 'Saved', value: Math.max(0, monthlySaving), bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700', badge: 'net', badgeBg: 'bg-violet-100 text-violet-600' },
                ].filter(b => b.value > 0 || b.label === 'Saved').map(b => (
                  <div key={b.label} className={`${b.bg} rounded-xl border ${b.border} p-3.5`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-500 font-medium">{b.label}</span>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md ${b.badgeBg}`}>{b.badge}</span>
                    </div>
                    <div className={`text-lg font-bold ${b.text} tabular-nums`}>{formatAmount(b.value)}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{aIncome > 0 ? Math.round(b.value / aIncome * 100) : 0}% of income</div>
                  </div>
                ))}
              </div>
              {/* Visual flow bar */}
              <div className="relative">
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                  {[
                    { value: aExpenses, color: 'bg-slate-300' },
                    { value: monthlyInvestment, color: 'bg-blue-400' },
                    { value: monthlyDebtPayment, color: 'bg-amber-400' },
                    { value: Math.max(0, monthlySaving), color: 'bg-violet-400' },
                  ].filter(s => s.value > 0).map((s, i) => (
                    <div key={i} className={`${s.color} transition-all duration-700`} style={{ width: `${aIncome > 0 ? (s.value / aIncome * 100) : 0}%` }} />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-slate-300">
                  <span>0%</span>
                  <span>100% of income</span>
                </div>
              </div>
            </div>

            {/* Net Worth Projection Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Net Worth Projection</h3>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 rounded bg-primary inline-block" /> Nominal</span>
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 rounded bg-primary/30 inline-block" /> Real</span>
                </div>
              </div>
              <div className="h-[180px]">
                {(() => {
                  const pts: { y: number; nw: number; re: number }[] = [];
                  let inv = aInvestments + recurringValue, dbt = totalDebt;
                  const r = expectedReturn, ann = monthlyInvestment * 12, dp = monthlyDebtPayment * 12, base = aCash + aAssets;
                  pts.push({ y: 0, nw: netWorth, re: netWorth });
                  for (let i = 1; i <= projYears; i++) {
                    inv = inv * (1 + r) + ann; dbt = Math.max(0, dbt - dp);
                    const nw = base + inv - dbt;
                    pts.push({ y: i, nw, re: nw / Math.pow(1.025, i) });
                  }
                  const mx = Math.max(...pts.map(d => d.nw), 1);
                  const W = 660, H = 175, pL = 55, pR = 10, pT = 8, pB = 22, pw = W - pL - pR, ph = H - pT - pB;
                  const tx = (y: number) => pL + (y / projYears) * pw;
                  const ty = (v: number) => pT + ph - (v / mx) * ph;
                  const nL = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${tx(d.y).toFixed(1)},${ty(d.nw).toFixed(1)}`).join(' ');
                  const rL = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${tx(d.y).toFixed(1)},${ty(d.re).toFixed(1)}`).join(' ');
                  const area = nL + ` L${tx(projYears).toFixed(1)},${ty(0).toFixed(1)} L${tx(0).toFixed(1)},${ty(0).toFixed(1)} Z`;
                  const xS = projYears <= 10 ? 2 : projYears <= 20 ? 5 : 10;
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
                      <defs><linearGradient id="nf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(15,118,110,0.08)"/><stop offset="100%" stopColor="rgba(15,118,110,0)"/></linearGradient></defs>
                      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => { const v = mx * p, y = ty(v); return <g key={i}><line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#f1f5f9" strokeWidth="0.8" /><text x={pL - 4} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="7" fontFamily="monospace">{v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : '0'}</text></g>; })}
                      {Array.from({ length: Math.floor(projYears / xS) + 1 }, (_, i) => i * xS).map(yr => <text key={yr} x={tx(yr)} y={H - 4} textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">{yr}yr</text>)}
                      <path d={area} fill="url(#nf)" />
                      <path d={nL} fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={rL} fill="none" stroke="#0f766e" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.25" />
                      <circle cx={tx(projYears)} cy={ty(pts[pts.length - 1].nw)} r="3.5" fill="#0f766e" stroke="white" strokeWidth="2" />
                      <circle cx={tx(0)} cy={ty(netWorth)} r="2.5" fill="#0f766e" stroke="white" strokeWidth="1.5" />
                    </svg>
                  );
                })()}
              </div>
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[11px] text-slate-400">Today: <strong className="text-secondary tabular-nums">{formatAmount(netWorth)}</strong></span>
                <span className="text-[11px] text-slate-400">In {projYears}yr: <strong className="text-primary tabular-nums">{formatAmount(projectedValue)}</strong></span>
              </div>
            </div>
          </>
        ) : isFree ? (
          <div className="relative rounded-2xl overflow-hidden border border-slate-200/60 mb-5">
            <div className="p-6 opacity-20 blur-sm pointer-events-none bg-white">
              <div className="h-7 bg-slate-100 rounded-lg mb-3 w-44" />
              <div className="flex gap-1 mb-3">{[1,2,3,4,5].map(i => <div key={i} className="flex-1 h-7 bg-slate-100 rounded-lg" />)}</div>
              <div className="h-[150px] bg-gradient-to-b from-emerald-50 to-blue-50 rounded-xl" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm text-center p-6">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center mb-3 shadow-lg shadow-primary/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              </div>
              <h3 className="text-base font-bold text-secondary mb-1">Unlock Premium Dashboard</h3>
              <p className="text-xs text-slate-500 mb-3 max-w-xs">Cash flow, net worth timeline, AI insights, and score trends.</p>
              <div className="flex gap-3 mb-4 text-[11px] text-slate-600 flex-wrap justify-center">
                {['Cash Flow', 'Timeline', 'AI Briefing', 'Trends'].map(f => <span key={f} className="flex items-center gap-1"><span className="text-primary text-[9px]">✦</span>{f}</span>)}
              </div>
              <Link to="/pricing" className="px-5 py-2 bg-gradient-to-r from-primary to-teal-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">Upgrade to Premium</Link>
            </div>
          </div>
        ) : null}

        {/* Trust Strip */}
        <Link to="/security" className="flex items-center justify-center gap-5 py-2.5 px-4 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-all">
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[10px] text-slate-400 font-medium">AES-256 encrypted</span></div>
          <span className="text-slate-200">|</span>
          <div className="flex items-center gap-1.5"><span className="text-[10px]">🇪🇺</span><span className="text-[10px] text-slate-400 font-medium">EU data residency</span></div>
          <span className="text-slate-200">|</span>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[10px] text-slate-400 font-medium">GDPR compliant</span></div>
        </Link>
      </div>
    </SidebarLayout>
  );
}
