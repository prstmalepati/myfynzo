// =============================================================
// components/DownloadReportButton.tsx
// Button that gathers all user data and generates a PDF report
// Premium feature — shown on Investment Hub and Account page
// =============================================================

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTier } from '../hooks/useTier';
import { db } from '../firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

interface Props {
  className?: string;
  compact?: boolean;
}

export default function DownloadReportButton({ className = '', compact = false }: Props) {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { isPremium } = useTier();
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    if (!user || !isPremium) return;
    setGenerating(true);

    try {
      // Gather all financial data
      const [invSnap, mipSnap, cashSnap, assetSnap, debtSnap, goalSnap, projSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'investments')),
        getDocs(collection(db, 'users', user.uid, 'monthlyInvestments')),
        getDocs(collection(db, 'users', user.uid, 'cashSavings')),
        getDocs(collection(db, 'users', user.uid, 'physicalAssets')),
        getDocs(collection(db, 'users', user.uid, 'debts')),
        getDocs(collection(db, 'users', user.uid, 'goals')),
        getDoc(doc(db, 'users', user.uid, 'projections', 'wealth')),
        getDoc(doc(db, 'users', user.uid)),
      ]);

      const userProfile = userSnap.exists() ? userSnap.data() : {};

      // Investments
      const investments = invSnap.docs.map(d => {
        const data = d.data();
        const value = (data.quantity || 0) * (data.currentPrice || data.purchasePrice || 0);
        const cost = (data.quantity || 0) * (data.purchasePrice || 0);
        return {
          name: data.name || '', type: data.type || 'Other', symbol: data.symbol || '',
          quantity: data.quantity || 0, purchasePrice: data.purchasePrice || 0,
          currentPrice: data.currentPrice || data.purchasePrice || 0,
          purchaseDate: data.purchaseDate || '',
          gain: value - cost,
          gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        };
      });

      const totalValue = investments.reduce((s, i) => s + i.quantity * i.currentPrice, 0);
      const totalCost = investments.reduce((s, i) => s + i.quantity * i.purchasePrice, 0);

      // Allocation by type
      const typeMap: Record<string, number> = {};
      investments.forEach(i => { typeMap[i.type] = (typeMap[i.type] || 0) + i.quantity * i.currentPrice; });
      const allocationByType = Object.entries(typeMap)
        .map(([type, value]) => ({ type, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);

      // Recurring investments
      const recurringInvestments = mipSnap.docs.map(d => {
        const data = d.data();
        return { name: data.name || '', monthlyAmount: data.monthlyAmount || 0, category: data.category || '' };
      });
      const totalMonthlyInvestment = recurringInvestments.reduce((s, m) => s + m.monthlyAmount, 0);

      // Cash
      let cashSavings = 0;
      cashSnap.docs.forEach(d => cashSavings += d.data().amount || 0);

      // Assets
      let physicalAssets = 0;
      assetSnap.docs.forEach(d => physicalAssets += d.data().currentValue || 0);

      // Debts
      const debts = debtSnap.docs.map(d => {
        const data = d.data();
        return {
          name: data.name || '', remaining: data.remainingAmount || 0,
          rate: data.interestRate || 0, monthly: data.monthlyPayment || 0,
        };
      });
      const totalDebt = debts.reduce((s, d) => s + d.remaining, 0);

      // Goals
      const goals = goalSnap.docs.map(d => {
        const data = d.data();
        return {
          name: data.name || '', target: data.targetAmount || 0,
          current: data.currentAmount || 0,
          progress: data.targetAmount > 0 ? Math.round((data.currentAmount / data.targetAmount) * 100) : 0,
        };
      });

      // Expenses
      let annualExpenses = 0;
      const lifeSnap = await getDocs(collection(db, 'users', user.uid, 'lifestyleBasket'));
      lifeSnap.docs.forEach(d => {
        const data = d.data();
        const cost = data.monthlyCost || data.cost || 0;
        const freq = data.frequency || 'monthly';
        annualExpenses += freq === 'yearly' ? cost : freq === 'quarterly' ? cost * 4 : cost * 12;
      });

      // Projection
      const proj = projSnap.exists() ? projSnap.data() : null;
      const projYears = proj?.projectionYears || userProfile?.projectionYears || 10;
      const expectedReturn = (proj?.expectedReturn || 7) / 100;
      const monthlyInv = proj?.monthlyInvestment || totalMonthlyInvestment;

      // Calculate projected value
      let projected = totalValue + cashSavings + physicalAssets;
      const annualInv = monthlyInv * 12;
      for (let y = 0; y < projYears; y++) projected = projected * (1 + expectedReturn) + annualInv;

      const netWorth = totalValue + cashSavings + physicalAssets - totalDebt;

      // Dynamic import and generate
      const { generatePortfolioReport } = await import('../services/reportGenerator');

      const blob = await generatePortfolioReport({
        userName: user.displayName || user.email?.split('@')[0] || 'User',
        currency: currency || 'EUR',
        country: userProfile?.country || '',
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        investments, totalValue, totalCost,
        totalGain: totalValue - totalCost,
        totalGainPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        recurringInvestments, totalMonthlyInvestment,
        cashSavings, physicalAssets,
        totalDebt, debts, netWorth,
        monthlyExpenses: annualExpenses / 12, annualExpenses,
        goals,
        projectedValue: projected, projectionYears: projYears,
        expectedReturn: expectedReturn * 100,
        allocationByType,
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myfynzo-portfolio-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Report] Generation failed:', err);
      alert('Report generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (!isPremium) {
    return compact ? null : (
      <button disabled className="px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-sm font-semibold cursor-not-allowed flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
        PDF Report (Premium)
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className={`flex items-center gap-2 font-semibold transition-all ${
        compact
          ? 'px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50'
          : 'px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-secondary hover:bg-slate-50 shadow-sm'
      } ${className}`}
    >
      {generating ? (
        <>
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          PDF Report
        </>
      )}
    </button>
  );
}
