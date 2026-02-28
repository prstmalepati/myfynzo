import { useState } from 'react';

// Determine India's current Financial Year (April–March)
// If current month >= April, FY = currentYear – (currentYear+1)
// If current month < April, FY = (currentYear-1) – currentYear
const now = new Date();
const indiaFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // 0-indexed: 3 = April
const indiaFYEnd = indiaFYStart + 1;
const indiaFYLabel = `FY ${indiaFYStart}-${String(indiaFYEnd).slice(-2)}`; // e.g. "FY 2025-26"
const indiaAYLabel = `AY ${indiaFYEnd}-${String(indiaFYEnd + 1).slice(-2)}`; // e.g. "AY 2026-27"

// India FY 2025-26 / 2026-27 — New Tax Regime (default from FY 2023-24)
// No changes announced for FY 2026-27 — same slabs apply
const INDIA_NEW_REGIME = [
  { min: 0, max: 400000, rate: 0 },
  { min: 400000, max: 800000, rate: 0.05 },
  { min: 800000, max: 1200000, rate: 0.10 },
  { min: 1200000, max: 1600000, rate: 0.15 },
  { min: 1600000, max: 2000000, rate: 0.20 },
  { min: 2000000, max: 2400000, rate: 0.25 },
  { min: 2400000, max: Infinity, rate: 0.30 },
];

// Old Regime (optional)
const INDIA_OLD_REGIME = [
  { min: 0, max: 250000, rate: 0 },
  { min: 250000, max: 500000, rate: 0.05 },
  { min: 500000, max: 1000000, rate: 0.20 },
  { min: 1000000, max: Infinity, rate: 0.30 },
];

const STANDARD_DEDUCTION_NEW = 75000; // FY 2025-26
const STANDARD_DEDUCTION_OLD = 50000;
const SECTION_80C_LIMIT = 150000;
const SECTION_80D_LIMIT_SELF = 25000;
const SECTION_80D_LIMIT_PARENTS = 50000; // for senior citizen parents
const HRA_MAX_PCT = 0.50; // metro

const CESS_RATE = 0.04; // Health & Education Cess
const SURCHARGE_BRACKETS = [
  { min: 0, max: 5000000, rate: 0 },
  { min: 5000000, max: 10000000, rate: 0.10 },
  { min: 10000000, max: 20000000, rate: 0.15 },
  { min: 20000000, max: 50000000, rate: 0.25 },
  { min: 50000000, max: Infinity, rate: 0.37 },
];

function calcProgressive(income: number, brackets: { min: number; max: number; rate: number }[]): number {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    tax += (Math.min(income, b.max) - b.min) * b.rate;
  }
  return tax;
}

function getSurchargeRate(income: number): number {
  for (let i = SURCHARGE_BRACKETS.length - 1; i >= 0; i--) {
    if (income > SURCHARGE_BRACKETS[i].min) return SURCHARGE_BRACKETS[i].rate;
  }
  return 0;
}

export default function IndiaTaxCalculator() {
  const [income, setIncome] = useState(0);
  const [regime, setRegime] = useState<'new' | 'old'>('new');
  const [section80c, setSection80c] = useState(0);
  const [section80d, setSection80d] = useState(0);
  const [nps, setNps] = useState(0); // Section 80CCD(1B) — up to ₹50,000
  const [homeLoan, setHomeLoan] = useState(0); // Section 24 — up to ₹2,00,000

  const isNew = regime === 'new';
  const standardDeduction = isNew ? STANDARD_DEDUCTION_NEW : STANDARD_DEDUCTION_OLD;

  // Deductions
  let totalDeductions = standardDeduction;
  if (!isNew) {
    totalDeductions += Math.min(section80c, SECTION_80C_LIMIT);
    totalDeductions += Math.min(section80d, SECTION_80D_LIMIT_SELF);
    totalDeductions += Math.min(nps, 50000);
    totalDeductions += Math.min(homeLoan, 200000);
  }

  const taxableIncome = Math.max(0, income - totalDeductions);
  const brackets = isNew ? INDIA_NEW_REGIME : INDIA_OLD_REGIME;

  // New regime rebate: if taxable income ≤ ₹12,00,000 (FY 2025-26), full rebate u/s 87A
  const newRegimeRebateLimit = 1200000;

  let baseTax = calcProgressive(taxableIncome, brackets);

  // Apply rebate for new regime
  if (isNew && taxableIncome <= newRegimeRebateLimit) {
    baseTax = 0;
  }
  // Old regime rebate: if taxable income ≤ ₹5,00,000
  if (!isNew && taxableIncome <= 500000) {
    baseTax = Math.max(0, baseTax - 12500);
  }

  const surcharge = baseTax * getSurchargeRate(taxableIncome);
  const cess = (baseTax + surcharge) * CESS_RATE;
  const totalTax = baseTax + surcharge + cess;
  const netIncome = income - totalTax;
  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;

  // PF (Employee: 12% of basic, assume basic = 50% of CTC)
  const basicSalary = income * 0.5;
  const epf = Math.min(basicSalary, 180000) * 0.12; // ₹15,000/month cap

  const format = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

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
          <span className="text-2xl">🇮🇳</span>
          <h2 className="text-2xl font-bold text-secondary font-display">India Tax Calculator</h2>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">{indiaFYLabel}</span>
        </div>

        {/* Regime Toggle */}
        <div className="flex gap-3 mb-6">
          <button onClick={() => setRegime('new')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${isNew ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            New Regime (Default)
          </button>
          <button onClick={() => setRegime('old')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${!isNew ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Old Regime
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Annual Income / CTC (₹)</label>
            <input type="number" value={income || ''} placeholder="0" onChange={e => setIncome(Number(e.target.value))}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
          </div>
          {!isNew && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Section 80C (max ₹1.5L)</label>
                <input type="number" value={section80c || ''} placeholder="0" onChange={e => setSection80c(Number(e.target.value))}
                  max={150000} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Section 80D — Health Insurance</label>
                <input type="number" value={section80d || ''} placeholder="0" onChange={e => setSection80d(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">NPS 80CCD(1B) (max ₹50K)</label>
                <input type="number" value={nps || ''} placeholder="0" onChange={e => setNps(Number(e.target.value))}
                  max={50000} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Home Loan Interest Sec 24</label>
                <input type="number" value={homeLoan || ''} placeholder="0" onChange={e => setHomeLoan(Number(e.target.value))}
                  max={200000} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
              </div>
            </>
          )}
        </div>
        {isNew && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200/50 text-sm text-blue-800">
            New regime offers lower rates but no deductions except ₹75,000 standard deduction.
            Income up to ₹12,00,000 is effectively tax-free (Section 87A rebate).
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8">
        <h3 className="text-lg font-bold text-secondary mb-4">Tax Breakdown ({isNew ? 'New' : 'Old'} Regime)</h3>
        <Row label="Gross Income" value={format(income)} />
        <Row label="Standard Deduction" value={`-${format(standardDeduction)}`} color="text-emerald-600" />
        {!isNew && section80c > 0 && <Row label="Section 80C" value={`-${format(Math.min(section80c, SECTION_80C_LIMIT))}`} color="text-emerald-600" />}
        {!isNew && section80d > 0 && <Row label="Section 80D" value={`-${format(Math.min(section80d, SECTION_80D_LIMIT_SELF))}`} color="text-emerald-600" />}
        {!isNew && nps > 0 && <Row label="NPS 80CCD(1B)" value={`-${format(Math.min(nps, 50000))}`} color="text-emerald-600" />}
        {!isNew && homeLoan > 0 && <Row label="Home Loan Sec 24" value={`-${format(Math.min(homeLoan, 200000))}`} color="text-emerald-600" />}
        <Row label="Taxable Income" value={format(taxableIncome)} />
        <div className="my-3 border-t border-slate-100" />
        <Row label="Income Tax" value={format(baseTax)} color="text-red-600" />
        {surcharge > 0 && <Row label="Surcharge" value={format(surcharge)} color="text-red-500" />}
        <Row label="Health & Education Cess (4%)" value={format(cess)} color="text-red-500" />
        <Row label="Total Tax" value={format(totalTax)} bold color="text-red-600" />
        <Row label="Net Income (Annual)" value={format(netIncome)} bold color="text-emerald-600" />
        <Row label="Net Income (Monthly)" value={format(netIncome / 12)} />

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-primary/5 rounded-xl p-4 text-center border border-primary/10">
            <div className="text-2xl font-bold text-primary">{effectiveRate.toFixed(1)}%</div>
            <div className="text-xs text-slate-500 mt-1">Effective Tax Rate</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-200/50">
            <div className="text-2xl font-bold text-amber-700">{format(netIncome / 12)}</div>
            <div className="text-xs text-slate-500 mt-1">Monthly Take-Home</div>
          </div>
        </div>
      </div>
      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-500">⚠️ Disclaimer:</strong> This calculator provides approximate estimates for informational purposes only and does not constitute tax, legal, or financial advice. Actual tax liabilities may vary based on your individual circumstances, applicable deductions, surcharges, and current Income Tax Act provisions. For official tax information, visit the{' '}
          <a href="https://www.incometax.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Income Tax Department of India</a>{' '}
          or consult a Chartered Accountant (CA). No data is saved.
        </p>
      </div>
    </div>
  );
}
