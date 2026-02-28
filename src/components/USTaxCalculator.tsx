import { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';

// 2025 US Federal Tax Brackets (inflation-adjusted)
const US_BRACKETS_SINGLE = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];
const US_BRACKETS_MARRIED = [
  { min: 0, max: 23850, rate: 0.10 },
  { min: 23850, max: 96950, rate: 0.12 },
  { min: 96950, max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: Infinity, rate: 0.37 },
];

const STANDARD_DEDUCTION_SINGLE = 15000; // 2025 estimated
const STANDARD_DEDUCTION_MARRIED = 30000;
const SOCIAL_SECURITY_RATE = 0.062;
const SOCIAL_SECURITY_WAGE_BASE = 176100; // 2025
const MEDICARE_RATE = 0.0145;
const MEDICARE_ADDITIONAL_THRESHOLD = 200000;
const MEDICARE_ADDITIONAL_RATE = 0.009;

const US_STATES: { name: string; rate: number }[] = [
  { name: 'No State Tax (TX, FL, WA, NV, WY, SD, AK, NH, TN)', rate: 0 },
  { name: 'California', rate: 0.093 },
  { name: 'New York', rate: 0.0685 },
  { name: 'New Jersey', rate: 0.0637 },
  { name: 'Illinois', rate: 0.0495 },
  { name: 'Pennsylvania', rate: 0.0307 },
  { name: 'Massachusetts', rate: 0.05 },
  { name: 'Oregon', rate: 0.099 },
  { name: 'Minnesota', rate: 0.0985 },
  { name: 'Connecticut', rate: 0.0699 },
  { name: 'Other (avg 5%)', rate: 0.05 },
];

function calcProgressiveTax(income: number, brackets: typeof US_BRACKETS_SINGLE): number {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    const taxable = Math.min(income, b.max) - b.min;
    tax += taxable * b.rate;
  }
  return tax;
}

export default function USTaxCalculator() {
  const { formatAmount } = useCurrency();
  const [filing, setFiling] = useState<'single' | 'married'>('single');
  const [income, setIncome] = useState(0);
  const [stateIdx, setStateIdx] = useState(0);
  const [retirement401k, setRetirement401k] = useState(0);
  const [hsaContrib, setHsaContrib] = useState(0);

  const brackets = filing === 'single' ? US_BRACKETS_SINGLE : US_BRACKETS_MARRIED;
  const standardDeduction = filing === 'single' ? STANDARD_DEDUCTION_SINGLE : STANDARD_DEDUCTION_MARRIED;

  // Taxable income
  const adjustedGross = Math.max(0, income - retirement401k - hsaContrib);
  const taxableIncome = Math.max(0, adjustedGross - standardDeduction);

  // Federal tax
  const federalTax = calcProgressiveTax(taxableIncome, brackets);

  // FICA
  const socialSecurity = Math.min(income, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE;
  const medicare = income * MEDICARE_RATE + (income > MEDICARE_ADDITIONAL_THRESHOLD ? (income - MEDICARE_ADDITIONAL_THRESHOLD) * MEDICARE_ADDITIONAL_RATE : 0);
  const totalFICA = socialSecurity + medicare;

  // State tax (simplified flat rate for demo)
  const stateTaxRate = US_STATES[stateIdx].rate;
  const stateTax = taxableIncome * stateTaxRate;

  const totalTax = federalTax + totalFICA + stateTax;
  const netIncome = income - totalTax;
  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
  const marginalRate = brackets.find(b => taxableIncome <= b.max)?.rate || 0.37;

  const Row = ({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) => (
    <div className={`flex justify-between py-2.5 ${bold ? 'border-t-2 border-slate-200 pt-3 mt-1' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold text-secondary' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-semibold ${color || (bold ? 'text-secondary' : 'text-slate-800')}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🇺🇸</span>
          <h2 className="text-2xl font-bold text-secondary font-display">US Federal Tax Calculator</h2>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">2025</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Filing Status</label>
            <select value={filing} onChange={e => setFiling(e.target.value as any)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white">
              <option value="single">Single</option>
              <option value="married">Married Filing Jointly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Annual Gross Income (USD)</label>
            <input type="number" value={income || ''} placeholder="0" onChange={e => setIncome(Number(e.target.value))}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">State</label>
            <select value={stateIdx} onChange={e => setStateIdx(Number(e.target.value))}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white">
              {US_STATES.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">401(k) Contribution</label>
            <input type="number" value={retirement401k} onChange={e => setRetirement401k(Number(e.target.value))}
              placeholder="0" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">HSA Contribution</label>
            <input type="number" value={hsaContrib} onChange={e => setHsaContrib(Number(e.target.value))}
              placeholder="0" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8">
        <h3 className="text-lg font-bold text-secondary mb-4">Tax Breakdown</h3>
        <Row label="Gross Income" value={`$${income.toLocaleString()}`} />
        <Row label={`Standard Deduction (${filing})`} value={`-$${standardDeduction.toLocaleString()}`} color="text-emerald-600" />
        {retirement401k > 0 && <Row label="401(k) Deduction" value={`-$${retirement401k.toLocaleString()}`} color="text-emerald-600" />}
        <Row label="Taxable Income" value={`$${taxableIncome.toLocaleString()}`} />
        <div className="my-3 border-t border-slate-100" />
        <Row label="Federal Income Tax" value={`$${Math.round(federalTax).toLocaleString()}`} color="text-red-600" />
        <Row label="Social Security (6.2%)" value={`$${Math.round(socialSecurity).toLocaleString()}`} color="text-red-500" />
        <Row label="Medicare (1.45%)" value={`$${Math.round(medicare).toLocaleString()}`} color="text-red-500" />
        {stateTax > 0 && <Row label={`State Tax (${(stateTaxRate * 100).toFixed(1)}%)`} value={`$${Math.round(stateTax).toLocaleString()}`} color="text-red-500" />}
        <Row label="Total Tax" value={`$${Math.round(totalTax).toLocaleString()}`} bold color="text-red-600" />
        <Row label="Net Income (Annual)" value={`$${Math.round(netIncome).toLocaleString()}`} bold color="text-emerald-600" />
        <Row label="Net Income (Monthly)" value={`$${Math.round(netIncome / 12).toLocaleString()}`} />

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-primary/5 rounded-xl p-4 text-center border border-primary/10">
            <div className="text-2xl font-bold text-primary">{effectiveRate.toFixed(1)}%</div>
            <div className="text-xs text-slate-500 mt-1">Effective Tax Rate</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-200/50">
            <div className="text-2xl font-bold text-amber-700">{(marginalRate * 100).toFixed(0)}%</div>
            <div className="text-xs text-slate-500 mt-1">Marginal Bracket</div>
          </div>
        </div>
      </div>
      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-500">⚠️ Disclaimer:</strong> This calculator provides approximate estimates for informational purposes only and does not constitute tax, legal, or financial advice. Actual tax liabilities may vary based on your individual circumstances, filing status, deductions, and credits. For official tax information, visit the{' '}
          <a href="https://www.irs.gov" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Internal Revenue Service (IRS)</a>{' '}
          or consult a licensed CPA or tax professional. No data is saved.
        </p>
      </div>
    </div>
  );
}
