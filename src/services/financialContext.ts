/**
 * financialContext.ts — Gathers user's complete financial snapshot for fynzo Intelligence
 * This becomes the system prompt context so Claude can give personalized advice.
 */
import { db } from '../firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export interface FinancialSnapshot {
  summary: string;       // Human-readable summary for the AI system prompt
  investments: any[];
  mips: any[];
  expenses: any[];
  debts: any[];
  goals: any[];
  projection: any;
  userProfile: any;
}

export async function gatherFinancialContext(uid: string): Promise<FinancialSnapshot> {
  const [invSnap, mipSnap, lifeSnap, debtSnap, goalSnap, projSnap, userSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'investments')),
    getDocs(collection(db, 'users', uid, 'monthlyInvestments')),
    getDocs(collection(db, 'users', uid, 'lifestyleBasket')),
    getDocs(collection(db, 'users', uid, 'debts')),
    getDocs(collection(db, 'users', uid, 'goals')),
    getDoc(doc(db, 'users', uid, 'projections', 'wealth')),
    getDoc(doc(db, 'users', uid)),
  ]);

  const investments = invSnap.docs.map(d => {
    const data = d.data();
    return {
      name: data.name, type: data.type, symbol: data.symbol,
      quantity: data.quantity, purchasePrice: data.purchasePrice,
      currentPrice: data.currentPrice,
      value: (data.quantity || 0) * (data.currentPrice || data.purchasePrice || 0),
      gainPct: data.purchasePrice > 0 ? (((data.currentPrice || data.purchasePrice) - data.purchasePrice) / data.purchasePrice * 100) : 0,
    };
  });

  const mips = mipSnap.docs.map(d => {
    const data = d.data();
    return { name: data.name, category: data.category, monthlyAmount: data.monthlyAmount };
  });

  const expenses = lifeSnap.docs.map(d => {
    const data = d.data();
    const cost = data.monthlyCost || data.cost || 0;
    const freq = data.frequency || 'monthly';
    const annual = freq === 'yearly' ? cost : freq === 'quarterly' ? cost * 4 : cost * 12;
    return { name: data.name, category: data.category, amount: cost, frequency: freq, annual };
  });

  const debts = debtSnap.docs.map(d => {
    const data = d.data();
    return {
      name: data.name, type: data.type, remainingAmount: data.remainingAmount,
      interestRate: data.interestRate, monthlyPayment: data.monthlyPayment,
    };
  });

  const goals = goalSnap.docs.map(d => {
    const data = d.data();
    const progress = data.targetAmount > 0 ? (data.currentAmount / data.targetAmount * 100) : 0;
    return {
      name: data.name, category: data.category, targetAmount: data.targetAmount,
      currentAmount: data.currentAmount, targetDate: data.targetDate, progress: Math.round(progress),
    };
  });

  const projection = projSnap.exists() ? projSnap.data() : null;
  const userProfile = userSnap.exists() ? userSnap.data() : {};

  // Build concise summary for AI
  const totalPortfolio = investments.reduce((s, i) => s + i.value, 0);
  const totalCost = investments.reduce((s, i) => s + i.quantity * i.purchasePrice, 0);
  const monthlyMip = mips.reduce((s, m) => s + m.monthlyAmount, 0);
  const annualExpenses = expenses.reduce((s, e) => s + e.annual, 0);
  const totalDebt = debts.reduce((s, d) => s + (d.remainingAmount || 0), 0);
  const monthlyDebt = debts.reduce((s, d) => s + (d.monthlyPayment || 0), 0);

  const lines: string[] = [
    `USER FINANCIAL SNAPSHOT:`,
    `Currency: ${userProfile.currency || 'EUR'} | Country: ${userProfile.country || 'Unknown'}`,
    ``,
    `PORTFOLIO: ${investments.length} holdings, total value ${totalPortfolio.toFixed(0)}, cost basis ${totalCost.toFixed(0)}, gain ${(totalPortfolio - totalCost).toFixed(0)} (${totalCost > 0 ? ((totalPortfolio - totalCost) / totalCost * 100).toFixed(1) : 0}%)`,
  ];

  if (investments.length > 0) {
    // Top 5 holdings by value
    const top = [...investments].sort((a, b) => b.value - a.value).slice(0, 5);
    lines.push(`Top holdings: ${top.map(i => `${i.name} (${i.type}, ${i.value.toFixed(0)}, ${i.gainPct >= 0 ? '+' : ''}${i.gainPct.toFixed(1)}%)`).join('; ')}`);

    // Allocation by type
    const byType: Record<string, number> = {};
    investments.forEach(i => { byType[i.type] = (byType[i.type] || 0) + i.value; });
    lines.push(`Allocation: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, v]) => `${t}: ${(v / totalPortfolio * 100).toFixed(0)}%`).join(', ')}`);
  }

  lines.push(``);
  lines.push(`MONTHLY INVESTMENTS (MIPs): ${mips.length} plans, ${monthlyMip.toFixed(0)}/month (${(monthlyMip * 12).toFixed(0)}/year)`);
  if (mips.length > 0) {
    lines.push(`Plans: ${mips.map(m => `${m.name} (${m.category}, ${m.monthlyAmount}/mo)`).join('; ')}`);
  }

  lines.push(``);
  lines.push(`EXPENSES: ${expenses.length} items, ${annualExpenses.toFixed(0)}/year (${(annualExpenses / 12).toFixed(0)}/month)`);
  if (expenses.length > 0) {
    const byCat: Record<string, number> = {};
    expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.annual; });
    lines.push(`By category: ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c}: ${v.toFixed(0)}/yr`).join(', ')}`);
  }

  lines.push(``);
  lines.push(`DEBTS: ${debts.length} items, total ${totalDebt.toFixed(0)}, monthly payments ${monthlyDebt.toFixed(0)}`);
  if (debts.length > 0) {
    lines.push(`Debts: ${debts.map(d => `${d.name} (${d.type}, ${d.remainingAmount} remaining, ${d.interestRate}% APR, ${d.monthlyPayment}/mo)`).join('; ')}`);
  }

  lines.push(``);
  lines.push(`GOALS: ${goals.length} active`);
  if (goals.length > 0) {
    lines.push(`Goals: ${goals.map(g => `${g.name} (${g.category}, ${g.progress}% done, ${g.currentAmount}/${g.targetAmount}, target: ${g.targetDate})`).join('; ')}`);
  }

  if (projection) {
    lines.push(``);
    lines.push(`WEALTH PROJECTION SETTINGS: Monthly expenses ${projection.monthlyExpenses}, Monthly investment ${projection.monthlyInvestment}, Expected return ${projection.expectedReturn}%, Inflation ${projection.inflationRate}%, Projection years ${projection.projectionYears}`);
  }

  return {
    summary: lines.join('\n'),
    investments, mips, expenses, debts, goals, projection, userProfile,
  };
}
