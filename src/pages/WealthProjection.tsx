import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLocale } from '../context/LocaleContext';
import { db } from '../firebase/config';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, query, orderBy, limit, deleteDoc, Timestamp } from 'firebase/firestore';
import SidebarLayout from '../components/SidebarLayout';
import PartnerToggle from '../components/PartnerToggle';
import { usePartner } from '../context/PartnerContext';
import { useTier } from '../hooks/useTier';
import { usePageTitle } from '../hooks/usePageTitle';

interface ProjectionInputs {
  currentNetWorth: number;
  totalInvestments: number;
  totalDebt: number;
  monthlyExpenses: number;
  monthlyInvestment: number;
  monthlyDebtPayment: number;
  expectedReturn: number;
  inflationRate: number;
  projectionYears: number;
  volatility: number; // Tier 2: Monte Carlo std dev
  retirementAge: number; // Tier 2: Drawdown phase
  withdrawalRate: number;
}

interface YearData {
  year: number;
  age: number;
  netWorth: number;
  netWorthReal: number;
  investments: number;
  debt: number;
  totalContributed: number;
  totalGrowth: number;
}

export default function WealthProjection() {
  const { user } = useAuth();
  usePageTitle('Wealth Projection');
  const { formatAmount, currency } = useCurrency();
  const { isFamily, activeProfile, isHouseholdView, isPartnerView, partnerName, partnerUid } = usePartner();
  const { isCouples, isFree, limits } = useTier();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchedInvestments, setFetchedInvestments] = useState<number | null>(null);
  const [fetchedDebt, setFetchedDebt] = useState<number | null>(null);
  const [fetchedMonthlyDebtPayment, setFetchedMonthlyDebtPayment] = useState<number>(0);
  const [fetchedLifestyleMonthly, setFetchedLifestyleMonthly] = useState<number | null>(null);
  const [fetchedMipMonthly, setFetchedMipMonthly] = useState<number | null>(null);
  const [currentAge, setCurrentAge] = useState(0);
  const [fetchedInvestmentCost, setFetchedInvestmentCost] = useState(0);
  const [fetchedCash, setFetchedCash] = useState(0);
  const [fetchedAssets, setFetchedAssets] = useState(0);
  const [netIncome, setNetIncome] = useState(0);
  const [annualBonus, setAnnualBonus] = useState(0);
  const [taxCountry, setTaxCountry] = useState('');

  // Partner data for Family Premium toggle
  const [pInvestments, setPInvestments] = useState(0);
  const [pCash, setPCash] = useState(0);
  const [pAssets, setPAssets] = useState(0);
  const [pDebt, setPDebt] = useState(0);
  const [pIncome, setPIncome] = useState(0);
  const [pExpenses, setPExpenses] = useState(0);
  const [pMip, setPMip] = useState(0);
  const [pDebtPayment, setPDebtPayment] = useState(0);

  // Projection history
  interface HistoryRecord {
    id: string;
    savedAt: Date;
    netWorth: number;
    cashSavings: number;
    totalInvestments: number;
    investmentCost: number;
    monthlyInvestment: number;
    projectionYears: number;
    expectedReturn: number;
    projectedNetWorth: number;
    label?: string;
  }
  const [projectionHistory, setProjectionHistory] = useState<HistoryRecord[]>([]);

  const [inputs, setInputs] = useState<ProjectionInputs>({
    currentNetWorth: 0,
    totalInvestments: 0,
    totalDebt: 0,
    monthlyExpenses: 0,
    monthlyInvestment: 0,
    monthlyDebtPayment: 0,
    expectedReturn: 7,
    inflationRate: 2.5,
    projectionYears: 30,
    volatility: 15,
    retirementAge: 65,
    withdrawalRate: 4,
  });

  // Load saved projection + fetch investments total
  // Clamp projection years for free users
  useEffect(() => {
    if (isFree && inputs.projectionYears > limits.projectionYears) {
      setInputs(prev => ({ ...prev, projectionYears: limits.projectionYears }));
    }
  }, [isFree]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Fetch saved projection inputs
        const snap = await getDoc(doc(db, 'users', user.uid, 'projections', 'wealth'));
        if (snap.exists()) {
          const d = snap.data();
          setInputs(prev => ({ ...prev, ...d }));
          if (d.currentAge) setCurrentAge(d.currentAge);
          if (d.netIncome) setNetIncome(d.netIncome);
          if (d.annualBonus) setAnnualBonus(d.annualBonus);
        }

        // Auto-fetch total monthly income from Income Manager
        try {
          const incSnap = await getDocs(collection(db, 'users', user.uid, 'incomes'));
          let totalMonthlyIncome = 0;
          incSnap.docs.forEach(d => {
            const inc = d.data();
            const amt = inc.amount || 0;
            const freq = inc.frequency || 'monthly';
            totalMonthlyIncome += freq === 'yearly' ? amt / 12 : freq === 'quarterly' ? amt / 3 : amt;
          });
          if (totalMonthlyIncome > 0) setNetIncome(totalMonthlyIncome);
        } catch {}

        // Auto-calculate age from Date of Birth in user profile
        try {
          const profileSnap = await getDoc(doc(db, 'users', user.uid));
          if (profileSnap.exists()) {
            const pd = profileSnap.data();
            const dob = pd.dateOfBirth;
            if (dob) {
              const birthDate = new Date(dob + 'T00:00:00');
              const today = new Date();
              let age = today.getFullYear() - birthDate.getFullYear();
              const m = today.getMonth() - birthDate.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
              if (age > 0 && age < 120) setCurrentAge(age);
            }
            if (pd.country) setTaxCountry(pd.country);
          }
        } catch {}

        // Auto-fetch total investment value + cost
        const invSnap = await getDocs(collection(db, 'users', user.uid, 'investments'));
        let total = 0, totalCost = 0;
        invSnap.docs.forEach(d => {
          const inv = d.data();
          total += (inv.quantity || 0) * (inv.currentPrice || inv.purchasePrice || 0);
          totalCost += (inv.quantity || 0) * (inv.purchasePrice || 0);
        });
        setFetchedInvestments(total);
        setFetchedInvestmentCost(totalCost);
        if (total > 0) {
          setInputs(prev => ({ ...prev, totalInvestments: total }));
        }

        // Auto-fetch Cash & Savings + Physical Assets → currentNetWorth
        let cashTotal = 0, assetTotal = 0, recurringTotal = 0;
        try {
          const cashSnap = await getDocs(collection(db, 'users', user.uid, 'cashSavings'));
          cashSnap.docs.forEach(d => { cashTotal += d.data().amount || 0; });
        } catch {}
        try {
          const assetSnap = await getDocs(collection(db, 'users', user.uid, 'physicalAssets'));
          assetSnap.docs.forEach(d => { assetTotal += d.data().currentValue || 0; });
        } catch {}
        // Recurring investments estimated value
        try {
          const mipDataSnap = await getDocs(collection(db, 'users', user.uid, 'monthlyInvestments'));
          mipDataSnap.docs.forEach(d => {
            const mip = d.data();
            const amt = mip.monthlyAmount || 0;
            const freq = mip.frequency || 'monthly';
            const startStr = mip.startDate;
            if (!startStr || amt <= 0) return;
            const start = new Date(startStr + 'T00:00:00');
            const now = new Date();
            let invested = 0;
            const step = freq === 'quarterly' ? 3 : freq === 'yearly' ? 12 : 1;
            const d2 = new Date(start);
            while (d2 <= now) { invested += amt; d2.setMonth(d2.getMonth() + step); }
            // Apply price growth if available
            if (mip.currentPrice && mip.purchasePrice && mip.purchasePrice > 0) {
              recurringTotal += invested * (mip.currentPrice / mip.purchasePrice);
            } else {
              recurringTotal += invested;
            }
          });
        } catch {}
        
        const netWorthBase = cashTotal + assetTotal;
        setFetchedCash(cashTotal);
        setFetchedAssets(assetTotal);
        if (netWorthBase > 0) {
          setInputs(prev => ({ ...prev, currentNetWorth: netWorthBase }));
        }
        // Add recurring investments to total investments
        if (recurringTotal > 0) {
          setInputs(prev => ({ ...prev, totalInvestments: total + recurringTotal }));
        }

        // Auto-fetch total debt from debts collection
        const debtSnap = await getDocs(collection(db, 'users', user.uid, 'debts'));
        let debtTotal = 0, debtMonthly = 0;
        debtSnap.docs.forEach(d => {
          const dd = d.data();
          debtTotal += dd.remainingAmount || 0;
          debtMonthly += dd.monthlyPayment || 0;
        });
        setFetchedDebt(debtTotal);
        setFetchedMonthlyDebtPayment(debtMonthly);
        setInputs(prev => ({
          ...prev,
          totalDebt: debtTotal,
          monthlyDebtPayment: debtMonthly,
        }));

        // Auto-fetch lifestyle basket monthly expenses
        const lifeSnap = await getDocs(collection(db, 'users', user.uid, 'lifestyleBasket'));
        let lifestyleMonthly = 0;
        lifeSnap.docs.forEach(d => {
          const data = d.data();
          const cost = data.monthlyCost || data.cost || 0;
          const freq = data.frequency || 'monthly';
          lifestyleMonthly += freq === 'monthly' ? cost : freq === 'quarterly' ? cost / 3 : cost / 12;
        });
        if (lifestyleMonthly > 0) {
          setFetchedLifestyleMonthly(lifestyleMonthly);
          setInputs(prev => ({ ...prev, monthlyExpenses: Math.round(lifestyleMonthly) }));
        }

        // Auto-fetch monthly investment from MIPs
        const mipSnap = await getDocs(collection(db, 'users', user.uid, 'monthlyInvestments'));
        let mipMonthly = 0;
        mipSnap.docs.forEach(d => { mipMonthly += d.data().monthlyAmount || 0; });
        if (mipMonthly > 0) {
          setFetchedMipMonthly(mipMonthly);
          setInputs(prev => ({ ...prev, monthlyInvestment: Math.round(mipMonthly) }));
        }

        // Load projection history
        try {
          const histQ = query(
            collection(db, 'users', user.uid, 'projections', 'wealth', 'history'),
            orderBy('savedAt', 'desc'),
            limit(20)
          );
          const histSnap = await getDocs(histQ);
          const hist: HistoryRecord[] = histSnap.docs.map(d => {
            const h = d.data();
            return {
              id: d.id,
              savedAt: h.savedAt?.toDate?.() || new Date(),
              netWorth: h.netWorth || 0,
              cashSavings: h.cashSavings || 0,
              totalInvestments: h.totalInvestments || 0,
              investmentCost: h.investmentCost || 0,
              monthlyInvestment: h.monthlyInvestment || 0,
              projectionYears: h.projectionYears || 0,
              expectedReturn: h.expectedReturn || 0,
              projectedNetWorth: h.projectedNetWorth || 0,
              label: h.label || '',
            };
          });
          setProjectionHistory(hist);
        } catch (histErr) { 
          console.warn('[WealthProjection] History load failed:', histErr);
          // Fallback: try without orderBy (no index needed)
          try {
            const histSnapFallback = await getDocs(
              collection(db, 'users', user.uid, 'projections', 'wealth', 'history')
            );
            const hist2: HistoryRecord[] = histSnapFallback.docs.map(d => {
              const h = d.data();
              return {
                id: d.id,
                savedAt: h.savedAt?.toDate?.() || new Date(),
                netWorth: h.netWorth || 0,
                cashSavings: h.cashSavings || 0,
                totalInvestments: h.totalInvestments || 0,
                investmentCost: h.investmentCost || 0,
                monthlyInvestment: h.monthlyInvestment || 0,
                projectionYears: h.projectionYears || 0,
                expectedReturn: h.expectedReturn || 0,
                projectedNetWorth: h.projectedNetWorth || 0,
                label: h.label || '',
              };
            });
            hist2.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
            setProjectionHistory(hist2.slice(0, 20));
          } catch (e2) {
            console.warn('[WealthProjection] History fallback also failed:', e2);
          }
        }
      } catch (err) {
        console.error('Error loading:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Load partner data for Family Premium (from partner's actual account)
  useEffect(() => {
    if (!user || !isFamily || !partnerUid) return;
    (async () => {
      try {
        // Partner investments
        const invSnap = await getDocs(collection(db, 'users', partnerUid, 'investments'));
        let pInv = 0; invSnap.docs.forEach(d => { const dd = d.data(); pInv += (dd.currentPrice || dd.purchasePrice || 0) * (dd.quantity || 0); });
        setPInvestments(pInv);

        // Partner cash
        const cashSnap = await getDocs(collection(db, 'users', partnerUid, 'cashSavings'));
        let pc = 0; cashSnap.docs.forEach(d => pc += d.data().amount || 0);
        setPCash(pc);

        // Partner assets
        const assetSnap = await getDocs(collection(db, 'users', partnerUid, 'physicalAssets'));
        let pa = 0; assetSnap.docs.forEach(d => pa += d.data().currentValue || 0);
        setPAssets(pa);

        // Partner income
        const incSnap = await getDocs(collection(db, 'users', partnerUid, 'incomes'));
        let pi = 0;
        incSnap.docs.forEach(d => {
          const inc = d.data(); const amt = inc.amount || 0; const freq = inc.frequency || 'monthly';
          pi += freq === 'yearly' ? amt / 12 : freq === 'quarterly' ? amt / 3 : amt;
        });
        setPIncome(pi);

        // Partner expenses
        const expSnap = await getDocs(collection(db, 'users', partnerUid, 'lifestyleBasket'));
        let pe = 0;
        expSnap.docs.forEach(d => {
          const e = d.data(); const cost = e.monthlyCost || e.cost || 0; const freq = e.frequency || 'monthly';
          pe += freq === 'monthly' ? cost : freq === 'quarterly' ? cost / 3 : cost / 12;
        });
        setPExpenses(pe);

        // Partner MIP
        const mipSnap = await getDocs(collection(db, 'users', partnerUid, 'monthlyInvestments'));
        let pm = 0; mipSnap.docs.forEach(d => pm += d.data().monthlyAmount || 0);
        setPMip(pm);

        // Partner debts
        const debtSnap = await getDocs(collection(db, 'users', partnerUid, 'debts'));
        let pd2 = 0, pdp = 0;
        debtSnap.docs.forEach(d => { pd2 += d.data().remainingAmount || 0; pdp += d.data().monthlyPayment || 0; });
        setPDebt(pd2);
        setPDebtPayment(pdp);
      } catch (err) { console.error('[WealthProjection] Partner data load error:', err); }
    })();
  }, [user, isFamily, partnerUid]);

  // View-dependent values for Family Premium toggle
  const vCash = isHouseholdView ? fetchedCash + pCash : isPartnerView ? pCash : fetchedCash;
  const vAssets = isHouseholdView ? fetchedAssets + pAssets : isPartnerView ? pAssets : fetchedAssets;
  const vInvestments = isHouseholdView ? (fetchedInvestments || 0) + pInvestments : isPartnerView ? pInvestments : (fetchedInvestments || 0);
  const vDebt = isHouseholdView ? (fetchedDebt || 0) + pDebt : isPartnerView ? pDebt : (fetchedDebt || 0);
  const vExpenses = isHouseholdView ? (fetchedLifestyleMonthly || 0) + pExpenses : isPartnerView ? pExpenses : (fetchedLifestyleMonthly || 0);
  const vMip = isHouseholdView ? (fetchedMipMonthly || 0) + pMip : isPartnerView ? pMip : (fetchedMipMonthly || 0);
  const vIncome = isHouseholdView ? netIncome + pIncome : isPartnerView ? pIncome : netIncome;
  const vDebtPayment = isHouseholdView ? fetchedMonthlyDebtPayment + pDebtPayment : isPartnerView ? pDebtPayment : fetchedMonthlyDebtPayment;

  // Sync inputs when Family Premium toggle changes
  useEffect(() => {
    if (!isFamily) return;
    setInputs(prev => ({
      ...prev,
      totalInvestments: vInvestments,
      totalDebt: vDebt,
      monthlyExpenses: vExpenses,
      monthlyInvestment: vMip,
      monthlyDebtPayment: vDebtPayment,
    }));
  }, [activeProfile, isFamily, vInvestments, vDebt, vExpenses, vMip, vDebtPayment]);

  const update = (field: keyof ProjectionInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!finalData) {
      console.error('[WealthProjection] Cannot save — projection data not ready');
      return;
    }
    setSaving(true);
    try {
      // Save current projection inputs
      await setDoc(doc(db, 'users', user.uid, 'projections', 'wealth'), {
        ...inputs, currentAge, netIncome, updatedAt: new Date(),
      });

      // Save a history snapshot
      const netWorth = fetchedCash + fetchedAssets + inputs.totalInvestments - inputs.totalDebt;
      const record = {
        savedAt: Timestamp.now(),
        netWorth,
        cashSavings: inputs.currentNetWorth,
        totalInvestments: inputs.totalInvestments,
        investmentCost: fetchedInvestmentCost,
        monthlyInvestment: inputs.monthlyInvestment,
        projectionYears: inputs.projectionYears,
        expectedReturn: inputs.expectedReturn,
        projectedNetWorth: finalData?.netWorth || 0,
      };
      const docRef = await addDoc(
        collection(db, 'users', user.uid, 'projections', 'wealth', 'history'),
        record
      );
      // Prepend to local history
      setProjectionHistory(prev => [{
        id: docRef.id,
        savedAt: new Date(),
        ...record,
      }, ...prev].slice(0, 20));
    } catch (err: any) {
      console.error('[WealthProjection] Save error:', err?.code, err?.message, err);
    }
    finally { setSaving(false); }
  };

  // Calculate projection data — includes ALL financial sources
  const projectionData = useMemo<YearData[]>(() => {
    const data: YearData[] = [];
    const r = inputs.expectedReturn / 100;
    const inf = inputs.inflationRate / 100;
    const annualInvestment = inputs.monthlyInvestment * 12;
    const annualDebtPayment = inputs.monthlyDebtPayment * 12;
    const annualSaving = netIncome > 0 ? Math.max(0, (netIncome - inputs.monthlyExpenses - inputs.monthlyInvestment - inputs.monthlyDebtPayment) * 12) : 0;

    // Starting values: investments include both holdings AND recurring investment value
    let investments = inputs.totalInvestments;
    let recurring = fetchedMipMonthly !== null ? (inputs.monthlyInvestment * 12) : 0; // annual recurring contribution
    let debt = inputs.totalDebt;
    let cash = isFamily ? vCash : fetchedCash; // cash grows from monthly savings
    const assets = isFamily ? vAssets : fetchedAssets; // physical assets stay constant (no appreciation model)

    // Net worth = cash + assets + investments - debt
    let netWorth = cash + assets + investments - debt;
    let totalContributed = 0;
    let totalGrowth = 0;

    data.push({
      year: 0, age: currentAge, netWorth, netWorthReal: netWorth,
      investments, debt, totalContributed: 0, totalGrowth: 0,
    });

    for (let y = 1; y <= inputs.projectionYears; y++) {
      // Investments grow with expected return + new monthly contributions
      const growth = investments * r;
      investments = investments + growth + annualInvestment;
      totalGrowth += growth;
      totalContributed += annualInvestment;

      // Cash grows from monthly savings (leftover after expenses, investments, debt)
      cash = cash + annualSaving;

      // Debt decreases via monthly payments
      if (debt > 0 && annualDebtPayment > 0) {
        const payment = Math.min(debt, annualDebtPayment);
        debt = Math.max(0, debt - payment);
      }

      netWorth = cash + assets + investments - debt;
      const netWorthReal = netWorth / Math.pow(1 + inf, y);

      data.push({
        year: y, age: currentAge + y, netWorth, netWorthReal,
        investments, debt, totalContributed, totalGrowth,
      });
    }
    return data;
  }, [inputs, currentAge, fetchedCash, fetchedAssets, fetchedMipMonthly, netIncome, isFamily, vCash, vAssets, activeProfile]);

  // Milestones
  const milestones = useMemo(() => {
    const targets = [100000, 250000, 500000, 1000000, 2000000, 5000000];
    const currSymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'INR' ? '₹' : currency === 'CAD' ? 'C$' : '€';
    return targets.map(target => {
      const yearData = projectionData.find(d => d.netWorth >= target);
      const label = target >= 1000000
        ? `${currSymbol}${(target / 1000000).toFixed(0)}M`
        : `${currSymbol}${(target / 1000).toFixed(0)}K`;
      return { target, label, year: yearData?.year ?? null, age: yearData?.age ?? null };
    }).filter(m => m.year !== null && m.year! <= inputs.projectionYears);
  }, [projectionData, currency, inputs.projectionYears]);

  // Tier 2: Monte Carlo simulation (Premium only)
  const monteCarloData = useMemo(() => {
    if (!isPremium) return null;
    const SIMS = 500;
    const years = inputs.projectionYears;
    const mean = inputs.expectedReturn / 100;
    const vol = inputs.volatility / 100;
    const monthly = inputs.monthlyInvestment;
    const startInv = inputs.totalInvestments;
    const startCash = isFamily ? vCash : fetchedCash;
    const startAssets = isFamily ? vAssets : fetchedAssets;
    const startDebt = inputs.totalDebt;
    const annualDebtPay = inputs.monthlyDebtPayment * 12;
    const annualSave = netIncome > 0 ? Math.max(0, (netIncome - inputs.monthlyExpenses - inputs.monthlyInvestment - inputs.monthlyDebtPayment) * 12) : 0;
    const retireYear = Math.max(0, inputs.retirementAge - currentAge);
    const wr = inputs.withdrawalRate / 100;

    const allPaths: number[][] = [];
    for (let s = 0; s < SIMS; s++) {
      let inv = startInv, cash = startCash, debt = startDebt;
      const path = [cash + startAssets + inv - debt];
      for (let y = 1; y <= years; y++) {
        // Box-Muller normal random
        const u1 = Math.random(), u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
        const annualReturn = mean + vol * z;
        if (y <= retireYear) {
          // Accumulation phase
          inv = inv * (1 + annualReturn) + monthly * 12;
          cash = cash + annualSave;
        } else {
          // Drawdown phase
          const withdrawal = (inv + cash) * wr;
          inv = inv * (1 + annualReturn) - withdrawal;
        }
        if (debt > 0) debt = Math.max(0, debt - annualDebtPay);
        path.push(Math.max(0, cash + startAssets + inv - debt));
      }
      allPaths.push(path);
    }

    // Percentiles at each year
    const percentiles = [];
    for (let y = 0; y <= years; y++) {
      const vals = allPaths.map(p => p[y]).sort((a, b) => a - b);
      percentiles.push({
        year: y,
        p10: vals[Math.floor(SIMS * 0.10)],
        p25: vals[Math.floor(SIMS * 0.25)],
        p50: vals[Math.floor(SIMS * 0.50)],
        p75: vals[Math.floor(SIMS * 0.75)],
        p90: vals[Math.floor(SIMS * 0.90)],
      });
    }
    return percentiles;
  }, [inputs, isPremium, currentAge, fetchedCash, fetchedAssets, netIncome, isFamily, vCash, vAssets]);

  const finalData = projectionData[projectionData.length - 1];

  // Chart dimensions
  const chartW = 700, chartH = 280, padL = 60, padR = 20, padT = 20, padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const mcMax = monteCarloData ? Math.max(...monteCarloData.map(d => d.p90)) : 0;
  const maxVal = Math.max(...projectionData.map(d => d.netWorth), mcMax, 1);
  const maxYears = inputs.projectionYears;

  const toX = (y: number) => padL + (y / maxYears) * plotW;
  const toY = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const nominalPath = projectionData.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(d.year).toFixed(1)},${toY(d.netWorth).toFixed(1)}`
  ).join(' ');

  const realPath = projectionData.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(d.year).toFixed(1)},${toY(d.netWorthReal).toFixed(1)}`
  ).join(' ');

  const areaPath = nominalPath + ` L${toX(maxYears).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`;

  // Monte Carlo band paths
  const mcBandPath = (topKey: 'p90' | 'p75', bottomKey: 'p10' | 'p25') => {
    if (!monteCarloData) return '';
    const top = monteCarloData.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(d.year).toFixed(1)},${toY(d[topKey]).toFixed(1)}`).join(' ');
    const bottom = [...monteCarloData].reverse().map((d, i) => `${i === 0 ? 'L' : 'L'}${toX(d.year).toFixed(1)},${toY(d[bottomKey]).toFixed(1)}`).join(' ');
    return top + ' ' + bottom + ' Z';
  };

  const mcMedianPath = monteCarloData ? monteCarloData.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(d.year).toFixed(1)},${toY(d.p50).toFixed(1)}`
  ).join(' ') : '';

  // Retirement age line
  const retireYear = Math.max(0, inputs.retirementAge - currentAge);
  const retireX = retireYear <= maxYears ? toX(retireYear) : null;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const val = maxVal * pct;
    return { val, y: toY(val), label: formatAmount(val) };
  });

  // X-axis ticks
  const xStep = maxYears <= 10 ? 1 : maxYears <= 20 ? 5 : 10;
  const xTicks: number[] = [];
  for (let i = 0; i <= maxYears; i += xStep) xTicks.push(i);
  if (xTicks[xTicks.length - 1] !== maxYears) xTicks.push(maxYears);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 h-96 bg-slate-100 rounded-2xl animate-pulse" />
            <div className="lg:col-span-2 h-96 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Wealth Projector</h1>
            <p className="text-sm text-slate-500 mt-1">Project your net worth up to 50 years into the future</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
              saving ? 'bg-slate-200 text-slate-400' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90'
            }`}>
            {saving ? 'Saving...' : '💾 Save Projection'}
          </button>
        </div>

        {/* Family Premium 3-way toggle */}
        <PartnerToggle context="Project wealth per person or household" showHousehold />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ─── Left: Inputs ───────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            {/* Income (from Income Manager) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <h3 className="text-sm font-bold text-secondary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[10px]">💵</span>
                Income
                {netIncome > 0 && <span className="text-[9px] text-primary bg-primary/8 px-1.5 py-0.5 rounded-full font-semibold ml-auto">From Income Manager</span>}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Monthly Net Income ({currency})</label>
                  <input type="number" value={Math.round(netIncome) || ''} readOnly={netIncome > 0} disabled={netIncome > 0}
                    onChange={e => { if (netIncome === 0) setNetIncome(Number(e.target.value)); }}
                    placeholder="Add income sources first"
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary ${
                      netIncome > 0 ? 'bg-slate-50 cursor-not-allowed' : 'focus:border-primary/40 focus:ring-2 focus:ring-primary/10'
                    }`} />
                  <a href="/income" className="text-[10px] text-primary font-semibold hover:underline mt-1 inline-block">
                    {netIncome > 0 ? 'Manage income sources →' : 'Add income sources →'}
                  </a>
                </div>
                {netIncome > 0 && (
                  <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 space-y-0.5">
                    <div>Annual net: <span className="font-bold text-secondary">{formatAmount(netIncome * 12)}</span></div>
                    {inputs.monthlyExpenses > 0 && (
                      <div>Savings rate: <span className="font-bold text-secondary">{((1 - inputs.monthlyExpenses / netIncome) * 100).toFixed(0)}%</span></div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Position */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <h3 className="text-sm font-bold text-secondary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[10px]">💰</span>
                Current Position
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Cash & Savings ({currency})</label>
                  <input type="number" value={Math.round(isFamily ? vCash : fetchedCash) || ''} readOnly disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary bg-slate-50 cursor-not-allowed" />
                  <a href="/investments" className="text-[10px] text-primary font-semibold hover:underline mt-1 inline-block">
                    Manage in Investment Hub →
                  </a>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Physical Assets ({currency})</label>
                  <input type="number" value={Math.round(isFamily ? vAssets : fetchedAssets) || ''} readOnly disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary bg-slate-50 cursor-not-allowed" />
                  <a href="/investments" className="text-[10px] text-primary font-semibold hover:underline mt-1 inline-block">
                    Manage in Investment Hub →
                  </a>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Total Investments ({currency})</label>
                  <input type="number" value={Math.round(inputs.totalInvestments) || ''} readOnly disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary bg-slate-50 cursor-not-allowed" />
                  <a href="/investments" className="text-[10px] text-primary font-semibold hover:underline mt-1 inline-block">
                    Manage in Investment Hub →
                  </a>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Total Debt ({currency})</label>
                  <input type="number" value={Math.round(inputs.totalDebt) || ''} readOnly disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary bg-slate-50 cursor-not-allowed" />
                  <a href="/debts" className="text-[10px] text-primary font-semibold hover:underline mt-1 inline-block">
                    Manage debts →
                  </a>
                </div>
              </div>
            </div>

            {/* Monthly Expenses & Payments */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <h3 className="text-sm font-bold text-secondary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-[10px]">🏠</span>
                Monthly Expenses & Payments
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Monthly Expenses ({currency})</label>
                  <input type="number" value={inputs.monthlyExpenses || ''}
                    readOnly={fetchedLifestyleMonthly !== null && fetchedLifestyleMonthly > 0}
                    disabled={fetchedLifestyleMonthly !== null && fetchedLifestyleMonthly > 0}
                    onChange={e => update('monthlyExpenses', Number(e.target.value))}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary ${
                      fetchedLifestyleMonthly !== null && fetchedLifestyleMonthly > 0
                        ? 'bg-slate-50 cursor-not-allowed' : 'focus:border-primary/40 focus:ring-2 focus:ring-primary/10'
                    }`}
                    placeholder="Rent, food, utilities..." />
                  <a href="/lifestyle-basket" className="text-[10px] text-primary font-semibold hover:underline mt-1 inline-block">
                    Manage expenses →
                  </a>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Monthly Debt Payment ({currency})</label>
                  <input type="number" value={inputs.monthlyDebtPayment || ''} readOnly disabled
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary bg-slate-50 cursor-not-allowed" />
                  {inputs.monthlyDebtPayment > 0 && (
                    <a href="/debts" className="text-[10px] text-primary font-semibold hover:underline mt-1 inline-block">
                      Manage debts →
                    </a>
                  )}
                </div>
                <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 space-y-0.5">
                  <div>Total outflow: <span className="font-bold text-secondary">{formatAmount(inputs.monthlyExpenses + inputs.monthlyDebtPayment)}/mo</span></div>
                  {inputs.monthlyDebtPayment > 0 && inputs.totalDebt > 0 && (
                    <div>Debt-free in: <span className="font-bold text-secondary">
                      {Math.ceil(inputs.totalDebt / (inputs.monthlyDebtPayment * 12))} years
                    </span></div>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Investment & Savings */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <h3 className="text-sm font-bold text-secondary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-[10px]">📈</span>
                Monthly Investment & Savings
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Monthly Investment ({currency})</label>
                  <input type="number" value={inputs.monthlyInvestment || ''}
                    readOnly={fetchedMipMonthly !== null && fetchedMipMonthly > 0}
                    disabled={fetchedMipMonthly !== null && fetchedMipMonthly > 0}
                    onChange={e => update('monthlyInvestment', Number(e.target.value))}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary ${
                      fetchedMipMonthly !== null && fetchedMipMonthly > 0
                        ? 'bg-slate-50 cursor-not-allowed' : 'focus:border-primary/40 focus:ring-2 focus:ring-primary/10'
                    }`}
                    placeholder="Amount you invest each month" />
                  {fetchedMipMonthly !== null && fetchedMipMonthly > 0 && (
                    <a href="/investments" className="text-[10px] text-primary font-semibold hover:underline mt-1 inline-block">
                      Manage plans →
                    </a>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Monthly Saving ({currency})</label>
                  {(() => {
                    const monthlySaving = netIncome - (inputs.monthlyExpenses + inputs.monthlyInvestment + inputs.monthlyDebtPayment);
                    return (
                      <>
                        <input type="number" value={netIncome > 0 ? Math.round(monthlySaving) : ''} readOnly disabled
                          placeholder={netIncome > 0 ? '' : 'Set income above'}
                          className={`w-full px-3 py-2 border rounded-xl text-sm bg-slate-50 cursor-not-allowed ${monthlySaving < 0 ? 'border-red-200 text-red-500' : 'border-slate-200 text-secondary'}`} />
                        <div className="text-[10px] text-slate-400 mt-1">
                          Income − (Expenses + Investment + Debt)
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 space-y-0.5">
                  <div>Annual investment: <span className="font-bold text-secondary">{formatAmount(inputs.monthlyInvestment * 12)}</span></div>
                  {netIncome > 0 && (
                    <div>Savings rate: <span className="font-bold text-secondary">{(((netIncome - inputs.monthlyExpenses) / netIncome) * 100).toFixed(0)}%</span></div>
                  )}
                </div>
              </div>
            </div>

            {/* Assumptions */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <h3 className="text-sm font-bold text-secondary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-[10px]">⚙️</span>
                Assumptions
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-500">Expected Return</label>
                    <span className="text-xs font-bold text-secondary">{inputs.expectedReturn}%</span>
                  </div>
                  <input type="range" min="1" max="15" step="0.5" value={inputs.expectedReturn}
                    onChange={e => update('expectedReturn', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>1%</span><span>Conservative</span><span>Aggressive</span><span>15%</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-500">Inflation Rate</label>
                    <span className="text-xs font-bold text-secondary">{inputs.inflationRate}%</span>
                  </div>
                  <input type="range" min="0" max="8" step="0.5" value={inputs.inflationRate}
                    onChange={e => update('inflationRate', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-500">Projection Period</label>
                    <span className="text-xs font-bold text-secondary">{inputs.projectionYears} years{isFree && inputs.projectionYears >= limits.projectionYears ? ' (free limit)' : ''}</span>
                  </div>
                  <input type="range" min="1" max={isFree ? limits.projectionYears : 50} step="1" value={Math.min(inputs.projectionYears, isFree ? limits.projectionYears : 50)}
                    onChange={e => update('projectionYears', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  <div className="relative h-4 mt-0.5">
                    {(isFree ? [1, 2, 3, 4, 5] : [5, 15, 25, 35, 50]).map(yr => (
                      <span key={yr} className="absolute text-[10px] text-slate-400 -translate-x-1/2"
                        style={{ left: `${((yr - (isFree ? 1 : 5)) / ((isFree ? 5 : 50) - (isFree ? 1 : 5))) * 100}%` }}>
                        {yr}yr
                      </span>
                    ))}
                  </div>
                  {isFree && (
                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                      Upgrade to Premium for 50-year projections
                    </p>
                  )}
                </div>
              </div>

              {/* Tier 2: Advanced Assumptions (Premium) */}
              {isPremium && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 mt-4">
                  <h3 className="text-xs font-bold text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-500/10 text-blue-600 rounded-md flex items-center justify-center text-[10px]">⚡</span>
                    Monte Carlo & Retirement
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-500">Market Volatility (σ)</label>
                        <span className="text-xs font-bold text-secondary">{inputs.volatility}%</span>
                      </div>
                      <input type="range" min="5" max="35" step="1" value={inputs.volatility}
                        onChange={e => update('volatility', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>Low (5%)</span><span>High (35%)</span></div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-500">Retirement Age</label>
                        <span className="text-xs font-bold text-secondary">{inputs.retirementAge}</span>
                      </div>
                      <input type="range" min={currentAge + 1 || 30} max="80" step="1" value={inputs.retirementAge}
                        onChange={e => update('retirementAge', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-400" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-500">Withdrawal Rate (SWR)</label>
                        <span className="text-xs font-bold text-secondary">{inputs.withdrawalRate}%</span>
                      </div>
                      <input type="range" min="2" max="6" step="0.5" value={inputs.withdrawalRate}
                        onChange={e => update('withdrawalRate', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-400" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>Conservative (2%)</span><span>Aggressive (6%)</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Right: Chart & Results ─────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-secondary to-surface-700 rounded-2xl p-4 text-white">
                <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Today Net Worth</div>
                <div className="text-lg font-bold">{formatAmount(projectionData[0].netWorth)}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Net Worth in {inputs.projectionYears}yr</div>
                <div className="text-lg font-bold text-secondary">{formatAmount(finalData.netWorth)}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Real Net Worth in {inputs.projectionYears}yr</div>
                <div className="text-lg font-bold text-amber-600">{formatAmount(finalData.netWorthReal)}</div>
              </div>
            </div>

            {/* Investment Portfolio Snapshot */}
            {(inputs.totalInvestments > 0 || inputs.currentNetWorth > 0) && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-secondary">Investment Portfolio Snapshot</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {/* Card 1: Cash & Savings */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cash & Savings</div>
                    <div className="text-base font-bold text-secondary">{formatAmount(inputs.currentNetWorth)}</div>
                  </div>

                  {/* Card 2: Current Value — total investments + accumulated MIP contributions */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Current Investment Value</div>
                    <div className="text-base font-bold text-secondary">{formatAmount(inputs.totalInvestments)}</div>
                    {inputs.monthlyInvestment > 0 && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        incl. {formatAmount(inputs.monthlyInvestment)}/mo MIP
                      </div>
                    )}
                  </div>

                  {/* Card 3: Projected Value — compounds current + monthly contributions at expected return */}
                  {(() => {
                    const r = inputs.expectedReturn / 100;
                    const years = inputs.projectionYears;
                    const monthlyRate = r / 12;
                    const totalMonths = years * 12;
                    // Future value of current investments compounded
                    const fvInvestments = inputs.totalInvestments * Math.pow(1 + r, years);
                    // Future value of monthly contributions (annuity)
                    const fvContributions = monthlyRate > 0
                      ? inputs.monthlyInvestment * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate)
                      : inputs.monthlyInvestment * totalMonths;
                    const projectedTotal = fvInvestments + fvContributions;
                    // Total principal = current investments + all future monthly contributions
                    const totalPrincipal = inputs.totalInvestments + (inputs.monthlyInvestment * totalMonths);
                    const totalReturns = projectedTotal - totalPrincipal;
                    const returnPct = totalPrincipal > 0 ? (totalReturns / totalPrincipal) * 100 : 0;
                    return (
                      <div className="bg-gradient-to-br from-primary/5 to-teal-50 rounded-xl p-3 border border-primary/20">
                        <div className="text-[10px] text-primary/70 uppercase tracking-wider mb-1">Projected Value ({years}yr)</div>
                        <div className="text-base font-bold text-primary">{formatAmount(projectedTotal)}</div>
                        {totalReturns > 0 && (
                          <div className="text-[10px] font-semibold mt-0.5 text-emerald-600">
                            +{formatAmount(totalReturns)} returns ({returnPct.toFixed(0)}%)
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Monthly contributions: <span className="font-semibold text-secondary">{formatAmount(inputs.monthlyInvestment)}/mo</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Total wealth today: <span className="font-semibold text-secondary">{formatAmount(inputs.currentNetWorth + inputs.totalInvestments)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-secondary">Net Worth Projection</h3>
                <div className="flex items-center gap-4 text-[10px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-primary rounded-full" /> Net Worth
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-amber-500 rounded-full" /> Inflation-adjusted
                  </span>
                </div>
              </div>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxHeight: '320px' }}>
                {/* Grid lines */}
                {yTicks.map((tick, i) => (
                  <g key={i}>
                    <line x1={padL} y1={tick.y} x2={chartW - padR} y2={tick.y}
                      stroke="#f1f5f9" strokeWidth="1" />
                    <text x={padL - 8} y={tick.y + 3} textAnchor="end"
                      className="text-[9px] fill-slate-400">{tick.label}</text>
                  </g>
                ))}
                {/* X-axis labels */}
                {xTicks.map((yr, i) => (
                  <text key={i} x={toX(yr)} y={chartH - 8} textAnchor="middle"
                    className="text-[9px] fill-slate-400">
                    {yr === 0 ? 'Now' : `${yr}yr`}
                  </text>
                ))}
                {/* Area fill */}
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(15,118,110)" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="rgb(15,118,110)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Monte Carlo bands (Premium) */}
                {monteCarloData && (<>
                  <path d={mcBandPath('p90', 'p10')} fill="rgb(59,130,246)" fillOpacity="0.06" />
                  <path d={mcBandPath('p75', 'p25')} fill="rgb(59,130,246)" fillOpacity="0.10" />
                  <path d={mcMedianPath} fill="none" stroke="rgb(59,130,246)" strokeWidth="1.5" strokeDasharray="6,3" strokeLinecap="round" opacity="0.7" />
                </>)}
                {/* Retirement age line */}
                {retireX !== null && retireYear > 0 && retireYear < maxYears && (
                  <>
                    <line x1={retireX} y1={padT} x2={retireX} y2={padT + plotH} stroke="rgb(239,68,68)" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
                    <text x={retireX + 4} y={padT + 12} fontSize="9" fill="rgb(239,68,68)" opacity="0.7">Retire</text>
                  </>
                )}
                <path d={areaPath} fill="url(#projGrad)" />
                {/* Nominal line */}
                <path d={nominalPath} fill="none" stroke="rgb(15,118,110)" strokeWidth="2.5" strokeLinecap="round" />
                {/* Real line */}
                <path d={realPath} fill="none" stroke="rgb(245,158,11)" strokeWidth="1.5" strokeDasharray="4,3" strokeLinecap="round" />
                {/* Milestone markers */}
                {milestones.map(m => m.year !== null && (
                  <g key={m.target}>
                    <line x1={padL} y1={toY(m.target)} x2={chartW - padR} y2={toY(m.target)} stroke="rgb(148,163,184)" strokeWidth="0.5" strokeDasharray="2,4" />
                    <text x={chartW - padR - 2} y={toY(m.target) - 3} textAnchor="end" fontSize="8" fill="rgb(148,163,184)">{m.label}</text>
                  </g>
                ))}
              </svg>
              {/* Chart legend */}
              <div className="flex flex-wrap items-center gap-4 mt-3 px-2">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-3 h-0.5 bg-teal-600 rounded inline-block" /> Nominal</span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-3 h-0.5 bg-amber-500 rounded inline-block" style={{ borderTop: '1px dashed' }} /> Real (inflation-adj.)</span>
                {monteCarloData && <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-3 h-2 bg-blue-500/15 rounded inline-block border border-blue-400/30" /> Monte Carlo (p10–p90)</span>}
              </div>
            </div>

            {/* Year-by-year breakdown (collapsible) */}
            <details className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
              <summary className="p-5 cursor-pointer text-sm font-bold text-secondary hover:bg-slate-50 transition-colors flex items-center justify-between">
                Year-by-Year Breakdown
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <div className="px-5 pb-5 max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider">
                      <th className="text-left py-2">Year</th>
                      <th className="text-right py-2">Net Worth</th>
                      <th className="text-right py-2">Real Net Worth</th>
                      <th className="text-right py-2">Contributed</th>
                      <th className="text-right py-2">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionData.filter((_, i) => i % (inputs.projectionYears <= 20 ? 1 : 5) === 0 || i === projectionData.length - 1).map((d, i) => (
                      <tr key={i} className="border-b border-slate-50 text-slate-600">
                        <td className="py-1.5 font-semibold">{d.year === 0 ? 'Today' : `Year ${d.year}`}</td>
                        <td className="py-1.5 text-right font-semibold text-secondary">{formatAmount(d.netWorth)}</td>
                        <td className="py-1.5 text-right text-amber-600">{formatAmount(d.netWorthReal)}</td>
                        <td className="py-1.5 text-right">{formatAmount(d.totalContributed)}</td>
                        <td className="py-1.5 text-right text-emerald-600">{formatAmount(d.totalGrowth)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {/* Insights */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
              <h3 className="text-sm font-bold mb-3 text-white/80">Key Insights</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white/[0.06] rounded-xl p-3">
                  <div className="text-white/40 mb-0.5">Compound growth effect</div>
                  <div className="font-bold">{formatAmount(finalData.totalGrowth)} earned</div>
                  <div className="text-white/50 mt-0.5">
                    vs {formatAmount(finalData.totalContributed)} contributed
                  </div>
                </div>
                <div className="bg-white/[0.06] rounded-xl p-3">
                  <div className="text-white/40 mb-0.5">Inflation impact</div>
                  <div className="font-bold">{formatAmount(finalData.netWorth - finalData.netWorthReal)} lost</div>
                  <div className="text-white/50 mt-0.5">
                    {((1 - finalData.netWorthReal / finalData.netWorth) * 100).toFixed(0)}% purchasing power erosion
                  </div>
                </div>
                <div className="bg-white/[0.06] rounded-xl p-3">
                  <div className="text-white/40 mb-0.5">Growth vs contributions</div>
                  <div className="font-bold">
                    {finalData.totalContributed > 0
                      ? `${(finalData.totalGrowth / finalData.totalContributed * 100).toFixed(0)}%`
                      : '—'} ratio
                  </div>
                  <div className="text-white/50 mt-0.5">
                    {finalData.totalGrowth > finalData.totalContributed
                      ? 'Money working harder than you'
                      : 'Keep going — compound interest needs time'}
                  </div>
                </div>
                <div className="bg-white/[0.06] rounded-xl p-3">
                  <div className="text-white/40 mb-0.5">Retirement age</div>
                  <div className="font-bold">Year {inputs.projectionYears}</div>
                  <div className="text-white/50 mt-0.5">
                    With {formatAmount(finalData.netWorthReal)} in today's money
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Projection History ─────────────────── */}
            {projectionHistory.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-bold text-secondary">Projection History</h3>
                  </div>
                  <span className="text-[10px] text-slate-400">{projectionHistory.length} snapshots</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider">
                        <th className="py-2 text-left font-semibold">Date</th>
                        <th className="py-2 text-right font-semibold">Net Worth</th>
                        <th className="py-2 text-right font-semibold">Investments</th>
                        <th className="py-2 text-right font-semibold">Monthly</th>
                        <th className="py-2 text-right font-semibold">Projected ({inputs.projectionYears}yr)</th>
                        <th className="py-2 text-right font-semibold">Change</th>
                        <th className="py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectionHistory.map((h, idx) => {
                        const prev = projectionHistory[idx + 1];
                        const nwChange = prev ? h.netWorth - prev.netWorth : 0;
                        return (
                          <tr key={h.id} className="border-b border-slate-50 text-slate-600 hover:bg-slate-50/50 transition-colors">
                            <td className="py-2">
                              <div className="font-semibold text-secondary">
                                {h.savedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {h.savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="py-2 text-right font-semibold">{formatAmount(h.netWorth)}</td>
                            <td className="py-2 text-right">{formatAmount(h.totalInvestments)}</td>
                            <td className="py-2 text-right">{formatAmount(h.monthlyInvestment)}/mo</td>
                            <td className="py-2 text-right font-semibold text-primary">{formatAmount(h.projectedNetWorth)}</td>
                            <td className="py-2 text-right">
                              {prev ? (
                                <span className={`font-semibold ${nwChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {nwChange >= 0 ? '+' : ''}{formatAmount(nwChange)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-2 text-right">
                              <button
                                onClick={async () => {
                                  if (!user) return;
                                  try {
                                    await deleteDoc(doc(db, 'users', user.uid, 'projections', 'wealth', 'history', h.id));
                                    setProjectionHistory(prev => prev.filter(r => r.id !== h.id));
                                  } catch {}
                                }}
                                className="text-slate-300 hover:text-red-400 transition-colors p-1"
                                title="Delete record"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {projectionHistory.length >= 2 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
                    <span>
                      First snapshot: {projectionHistory[projectionHistory.length - 1].savedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span>•</span>
                    <span>
                      Net worth change: {(() => {
                        const first = projectionHistory[projectionHistory.length - 1];
                        const latest = projectionHistory[0];
                        const diff = latest.netWorth - first.netWorth;
                        return (
                          <span className={diff >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                            {diff >= 0 ? '+' : ''}{formatAmount(diff)}
                          </span>
                        );
                      })()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
