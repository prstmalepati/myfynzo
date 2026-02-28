import { useState } from 'react';

interface TaxCalculation {
  grossIncome: number;
  incomeTax: number;
  solidarityTax: number;
  churchTax: number;
  pensionInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  careInsurance: number;
  totalTax: number;
  totalSocialContributions: number;
  totalDeductions: number;
  netIncome: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  taxFreeAllowance: number;
  kindergeld: number;
  taxableIncome: number;
}

// ═══════════════════════════════════════════════════════════════
// Year-specific tax parameters
// Sources: §32a EStG, Steuerfortentwicklungsgesetz,
//          Sozialversicherungs-Rechengrößenverordnung,
//          finanz-tools.de, Bundesregierung.de, Finanztip.de
// ═══════════════════════════════════════════════════════════════
interface YearParams {
  year: number;
  grundfreibetrag: number;
  zone1End: number;           // End of progressive zone 1
  zone2End: number;           // End of progressive zone 2
  zone3End: number;           // End of 42% zone (Reichensteuer threshold)
  yCoeff: number;             // Zone 1 quadratic coefficient
  zCoeff: number;             // Zone 2 quadratic coefficient
  zone2Const: number;         // Zone 2 constant term
  zone3Const: number;         // 42% zone constant (0.42·x - C)
  zone4Const: number;         // 45% zone constant (0.45·x - C)
  kindergeldPerMonth: number;
  soliThresholdSingle: number;
  pensionCeiling: number;     // Beitragsbemessungsgrenze Rente (yearly)
  healthCeiling: number;      // Beitragsbemessungsgrenze GKV (yearly)
  healthAdditionalRate: number; // Avg Zusatzbeitrag employee share
  careBaseRate: number;       // Pflegeversicherung base employee share
  careChildlessSurcharge: number;
  careChildDiscount: number;  // Discount per additional child
  unemploymentRate: number;   // Employee share
}

const TAX_PARAMS: Record<number, YearParams> = {
  // ─── 2025 ──────────────────────────────────────────────────
  // §32a EStG 2025 (Steuerfortentwicklungsgesetz, BGBl. 2024 I Nr. 449)
  // SV-Rechengrößenverordnung 2025
  2025: {
    year: 2025,
    grundfreibetrag: 12096,
    zone1End: 17443,
    zone2End: 68480,
    zone3End: 277825,
    yCoeff: 932.30,       // ESt = (932.30·y + 1400)·y
    zCoeff: 176.64,       // ESt = (176.64·z + 2397)·z + 1015.13
    zone2Const: 1015.13,
    zone3Const: 10911.92, // ESt = 0.42·x - 10911.92
    zone4Const: 19246.67, // ESt = 0.45·x - 19246.67
    kindergeldPerMonth: 255,
    soliThresholdSingle: 18130,
    pensionCeiling: 96600,  // 8050 × 12
    healthCeiling: 66150,   // 5512.50 × 12
    healthAdditionalRate: 0.0125, // ~2.5% avg Zusatzbeitrag / 2
    careBaseRate: 0.018,    // 3.6% total / 2 = 1.8% employee (raised 1.1.2025)
    careChildlessSurcharge: 0.006,
    careChildDiscount: 0.0025,
    unemploymentRate: 0.013,
  },
  // ─── 2026 ──────────────────────────────────────────────────
  // §32a EStG 2026 (Steuerfortentwicklungsgesetz)
  // SV-Rechengrößenverordnung 2026
  2026: {
    year: 2026,
    grundfreibetrag: 12348,
    zone1End: 17799,
    zone2End: 69878,
    zone3End: 277825,
    yCoeff: 914.51,       // ESt = (914.51·y + 1400)·y
    zCoeff: 173.10,       // ESt = (173.10·z + 2397)·z + 1034.87
    zone2Const: 1034.87,
    zone3Const: 11135.63, // ESt = 0.42·x - 11135.63
    zone4Const: 19470.38, // ESt = 0.45·x - 19470.38
    kindergeldPerMonth: 259,
    soliThresholdSingle: 20350,
    pensionCeiling: 101400, // 8450 × 12
    healthCeiling: 69750,   // 5812.50 × 12
    healthAdditionalRate: 0.0145, // ~2.9% avg Zusatzbeitrag / 2
    careBaseRate: 0.018,    // 3.6% total / 2 = 1.8% employee (unchanged)
    careChildlessSurcharge: 0.006,
    careChildDiscount: 0.0025,
    unemploymentRate: 0.013,
  },
};

// Determine current + previous year dynamically
const availableYears = Object.keys(TAX_PARAMS)
  .map(Number)
  .sort((a, b) => b - a); // newest first

export default function GermanTaxCalculator() {
  const [selectedYear, setSelectedYear] = useState(availableYears[0]); // default: newest
  const [filingStatus, setFilingStatus] = useState<'single' | 'married'>('single');
  const [annualIncome, setAnnualIncome] = useState(0);
  const [partnerIncome, setPartnerIncome] = useState(0);
  const [churchTaxPayer, setChurchTaxPayer] = useState(false);
  const [children, setChildren] = useState(0);
  const [state, setState] = useState('Bayern');

  const P = TAX_PARAMS[selectedYear];

  const calculateGermanTax = (income: number, married: boolean = false): TaxCalculation => {
    const kindergeld = children * P.kindergeldPerMonth * 12;

    // Taxable income (for display)
    let taxableIncome = married ? income / 2 : income;
    taxableIncome = Math.max(0, taxableIncome - P.grundfreibetrag);

    // ─── Income Tax (§32a EStG) ────────────────────────────
    let incomeTax = 0;
    const x = married ? income / 2 : income;

    if (x <= P.grundfreibetrag) {
      incomeTax = 0;
    } else if (x <= P.zone1End) {
      const y = (x - P.grundfreibetrag) / 10000;
      incomeTax = (P.yCoeff * y + 1400) * y;
    } else if (x <= P.zone2End) {
      const z = (x - P.zone1End) / 10000;
      incomeTax = (P.zCoeff * z + 2397) * z + P.zone2Const;
    } else if (x <= P.zone3End) {
      incomeTax = 0.42 * x - P.zone3Const;
    } else {
      incomeTax = 0.45 * x - P.zone4Const;
    }

    // Round to full euro (statutory requirement)
    incomeTax = Math.floor(incomeTax);

    // Ehegattensplitting — double for married
    if (married) incomeTax *= 2;

    // ─── Solidarity Surcharge (5.5%) ───────────────────────
    const soliThreshold = married ? P.soliThresholdSingle * 2 : P.soliThresholdSingle;
    let solidarityTax = 0;
    if (incomeTax > soliThreshold) {
      const excess = incomeTax - soliThreshold;
      solidarityTax = Math.min(incomeTax * 0.055, excess * 0.119);
    }

    // ─── Church Tax ────────────────────────────────────────
    const churchRate = (state === 'Bayern' || state === 'Baden-Württemberg') ? 0.08 : 0.09;
    const churchTax = churchTaxPayer ? incomeTax * churchRate : 0;

    // ─── Social Security (Sozialversicherung) ──────────────
    // Pension (Rentenversicherung): 18.6% total, 9.3% employee
    const pensionBase = Math.min(income, P.pensionCeiling);
    const pensionInsurance = pensionBase * 0.093;

    // Health (Krankenversicherung): 14.6% base + avg Zusatzbeitrag
    const healthBase = Math.min(income, P.healthCeiling);
    const healthInsurance = healthBase * 0.073 + healthBase * P.healthAdditionalRate;

    // Unemployment (Arbeitslosenversicherung): 2.6% total, 1.3% employee
    const unemploymentInsurance = pensionBase * P.unemploymentRate;

    // Care (Pflegeversicherung): base + childless surcharge or child discount
    let careRate = P.careBaseRate;
    if (children === 0) {
      careRate += P.careChildlessSurcharge; // +0.6% childless
    } else if (children >= 2) {
      careRate -= P.careChildDiscount * Math.min(children - 1, 4); // max 4 discounts
    }
    const careInsurance = healthBase * careRate;

    // ─── Totals ────────────────────────────────────────────
    const totalTax = incomeTax + solidarityTax + churchTax;
    const totalSocialContributions = pensionInsurance + healthInsurance + unemploymentInsurance + careInsurance;
    const totalDeductions = totalTax + totalSocialContributions;
    const netIncome = income - totalDeductions + kindergeld;
    const effectiveTaxRate = income > 0 ? (totalDeductions / income) * 100 : 0;

    // ─── Marginal Tax Rate ─────────────────────────────────
    let marginalTaxRate = 0;
    if (x <= P.grundfreibetrag) {
      marginalTaxRate = 0;
    } else if (x <= P.zone1End) {
      marginalTaxRate = 14 + ((x - P.grundfreibetrag) / (P.zone1End - P.grundfreibetrag)) * 9.97;
    } else if (x <= P.zone2End) {
      marginalTaxRate = 23.97 + ((x - P.zone1End) / (P.zone2End - P.zone1End)) * 18.03;
    } else if (x <= P.zone3End) {
      marginalTaxRate = 42;
    } else {
      marginalTaxRate = 45;
    }

    return {
      grossIncome: income, incomeTax, solidarityTax, churchTax,
      pensionInsurance, healthInsurance, unemploymentInsurance, careInsurance,
      totalTax, totalSocialContributions, totalDeductions, netIncome,
      effectiveTaxRate, marginalTaxRate, taxFreeAllowance: P.grundfreibetrag,
      kindergeld, taxableIncome,
    };
  };

  let result: TaxCalculation;
  if (filingStatus === 'married' && partnerIncome > 0) {
    result = calculateGermanTax(annualIncome + partnerIncome, true);
  } else {
    result = calculateGermanTax(annualIncome, filingStatus === 'married');
  }

  const formatEuro = (amount: number) => `€${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatEuroCompact = (amount: number) => `€${amount.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
  const formatPercent = (percent: number) => `${(isNaN(percent) ? 0 : percent).toFixed(2)}%`;

  const careRateTotal = P.careBaseRate * 2; // Display total rate (both halves)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-secondary to-surface-700 rounded-2xl p-8 text-white shadow-elevated">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
              <span className="text-5xl">🇩🇪</span>
              German Tax Calculator
            </h2>
            <p className="text-white/60 text-lg">
              Complete tax calculation with Grundfreibetrag, Kindergeld & progressive rates
            </p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            {/* Year Selector */}
            <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
              {availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    selectedYear === yr
                      ? 'bg-white text-secondary shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
            <div className="text-sm text-white/50">Filing Status</div>
            <div className="text-3xl font-bold">
              {filingStatus === 'married' ? '👫 Married' : '👤 Single'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT: Input Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-secondary-200">
            <h3 className="text-2xl font-bold text-surface-900 mb-6">📝 Your Details</h3>

            <div className="space-y-4">
              {/* Filing Status */}
              <div>
                <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                  Filing Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFilingStatus('single')}
                    className={`py-3 px-4 rounded-xl font-semibold transition-all ${
                      filingStatus === 'single'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-secondary-100 text-surface-900-500 hover:bg-slate-200'
                    }`}
                  >
                    👤 Single
                  </button>
                  <button
                    onClick={() => setFilingStatus('married')}
                    className={`py-3 px-4 rounded-xl font-semibold transition-all ${
                      filingStatus === 'married'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-secondary-100 text-surface-900-500 hover:bg-slate-200'
                    }`}
                  >
                    👫 Married
                  </button>
                </div>
              </div>

              {/* Annual Income */}
              <div>
                <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                  {filingStatus === 'married' ? 'Your Annual Gross Income' : 'Annual Gross Income'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={annualIncome || ''} placeholder="0"
                    onChange={(e) => setAnnualIncome(Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none font-semibold text-lg"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-900-400">€</span>
                </div>
              </div>

              {/* Partner Income (if married) */}
              {filingStatus === 'married' && (
                <div>
                  <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                    Partner's Annual Gross Income
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={partnerIncome}
                      onChange={(e) => setPartnerIncome(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none font-semibold text-lg"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-900-400">€</span>
                  </div>
                  {partnerIncome > 0 && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-xs text-blue-700 font-semibold">Combined Income:</div>
                      <div className="text-lg font-bold text-blue-900">{formatEuroCompact(annualIncome + partnerIncome)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Number of Children */}
              <div>
                <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                  👶 Number of Children (Kindergeld)
                </label>
                <input
                  type="number"
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
                  min="0"
                  max="10"
                  className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none font-semibold text-lg"
                />
                {children > 0 && (
                  <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="text-xs text-primary font-semibold">Annual Kindergeld:</div>
                    <div className="text-lg font-bold text-secondary">+{formatEuroCompact(children * P.kindergeldPerMonth * 12)}/year</div>
                    <div className="text-xs text-slate-500 mt-1">€{P.kindergeldPerMonth}/month per child ({selectedYear})</div>
                  </div>
                )}
              </div>

              {/* State */}
              <div>
                <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                  State (Bundesland)
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none font-semibold"
                >
                  <option value="Bayern">Bayern</option>
                  <option value="Baden-Württemberg">Baden-Württemberg</option>
                  <option value="Berlin">Berlin</option>
                  <option value="Hamburg">Hamburg</option>
                  <option value="Hessen">Hessen</option>
                  <option value="Nordrhein-Westfalen">Nordrhein-Westfalen</option>
                  <option value="Other">Other</option>
                </select>
                <div className="mt-1 text-xs text-surface-900-400">
                  Church tax: {state === 'Bayern' || state === 'Baden-Württemberg' ? '8%' : '9%'}
                </div>
              </div>

              {/* Church Tax */}
              <div className="flex items-center gap-3 p-4 bg-secondary-50 rounded-xl">
                <input
                  type="checkbox"
                  id="churchTax"
                  checked={churchTaxPayer}
                  onChange={(e) => setChurchTaxPayer(e.target.checked)}
                  className="w-5 h-5 text-primary rounded"
                />
                <label htmlFor="churchTax" className="text-sm font-semibold text-surface-900-700 cursor-pointer">
                  ⛪ Pay Church Tax (Kirchensteuer)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Results Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-secondary to-surface-700 rounded-xl p-6 text-white shadow-card">
              <div className="text-sm text-white/60 mb-1">💰 Gross Income</div>
              <div className="text-3xl font-bold">{formatEuroCompact(result.grossIncome)}</div>
              <div className="text-xs text-white/40 mt-1">{formatEuro(result.grossIncome)}</div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-card">
              <div className="text-sm text-slate-500 mb-1">📉 Total Deductions</div>
              <div className="text-3xl font-bold text-secondary">{formatEuroCompact(result.totalDeductions)}</div>
              <div className="text-xs text-slate-400 mt-1">{formatPercent(result.effectiveTaxRate)} effective</div>
            </div>

            <div className="bg-gradient-to-br from-primary to-teal-600 rounded-xl p-6 text-white shadow-card">
              <div className="text-sm text-white/60 mb-1">✅ Net Income</div>
              <div className="text-3xl font-bold">{formatEuroCompact(result.netIncome)}</div>
              <div className="text-xs text-white/40 mt-1">
                {children > 0 && `+${formatEuroCompact(result.kindergeld)} Kindergeld`}
              </div>
            </div>
          </div>

          {/* Tax Breakdown */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-secondary-200">
            <h3 className="text-2xl font-bold text-surface-900 mb-4 flex items-center gap-2">
              📊 Income Tax Breakdown — {selectedYear}
            </h3>
            
            {/* Grundfreibetrag */}
            <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-secondary">✅ Tax-Free Allowance (Grundfreibetrag)</span>
                <span className="font-bold text-primary text-lg">{formatEuroCompact(P.grundfreibetrag)}</span>
              </div>
              <div className="text-xs text-slate-500">
                The first €{P.grundfreibetrag.toLocaleString()} is completely tax-free in {selectedYear}
              </div>
            </div>

            {/* Progressive Tax Rates — dynamic from params */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-secondary-50 rounded-lg">
                <div>
                  <div className="font-semibold text-surface-900-700">Zone 1: Tax-Free (Nullzone)</div>
                  <div className="text-xs text-surface-900-400">€0 – €{P.grundfreibetrag.toLocaleString()}</div>
                </div>
                <span className="font-bold text-primary">0%</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-secondary-50 rounded-lg">
                <div>
                  <div className="font-semibold text-surface-900-700">Zone 2: Progressive (14% → 24%)</div>
                  <div className="text-xs text-surface-900-400">€{(P.grundfreibetrag + 1).toLocaleString()} – €{P.zone1End.toLocaleString()}</div>
                </div>
                <span className="font-bold text-blue-600">14–24%</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-secondary-50 rounded-lg">
                <div>
                  <div className="font-semibold text-surface-900-700">Zone 3: Progressive (24% → 42%)</div>
                  <div className="text-xs text-surface-900-400">€{(P.zone1End + 1).toLocaleString()} – €{P.zone2End.toLocaleString()}</div>
                </div>
                <span className="font-bold text-orange-600">24–42%</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-secondary-50 rounded-lg">
                <div>
                  <div className="font-semibold text-surface-900-700">Zone 4: Proportional (Spitzensteuersatz)</div>
                  <div className="text-xs text-surface-900-400">€{(P.zone2End + 1).toLocaleString()} – €{P.zone3End.toLocaleString()}</div>
                </div>
                <span className="font-bold text-secondary">42%</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div>
                  <div className="font-semibold text-secondary">Zone 5: Rich Tax (Reichensteuer)</div>
                  <div className="text-xs text-slate-500">Above €{P.zone3End.toLocaleString()}</div>
                </div>
                <span className="font-bold text-amber-700 text-lg">45%</span>
              </div>
            </div>

            {/* Actual Tax Amounts */}
            <div className="mt-6 space-y-2 pt-6 border-t-2 border-secondary-200">
              <div className="flex justify-between items-center">
                <span className="text-surface-900-700">Income Tax (Einkommensteuer)</span>
                <span className="font-semibold text-surface-900-900">{formatEuro(result.incomeTax)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-surface-900-700">Solidarity Surcharge (Soli 5.5%, threshold €{P.soliThresholdSingle.toLocaleString()})</span>
                <span className="font-semibold text-surface-900-900">{formatEuro(result.solidarityTax)}</span>
              </div>
              {churchTaxPayer && (
                <div className="flex justify-between items-center">
                  <span className="text-surface-900-700">
                    Church Tax (Kirchensteuer {state === 'Bayern' || state === 'Baden-Württemberg' ? '8%' : '9%'})
                  </span>
                  <span className="font-semibold text-surface-900-900">{formatEuro(result.churchTax)}</span>
                </div>
              )}
              <div className="border-t-2 border-secondary-200 pt-3 flex justify-between items-center">
                <span className="font-bold text-surface-900-900 text-lg">Total Taxes</span>
                <span className="font-bold text-secondary text-xl">{formatEuro(result.totalTax)}</span>
              </div>
            </div>
          </div>

          {/* Social Security */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-secondary-200">
            <h3 className="text-2xl font-bold text-surface-900 mb-4 flex items-center gap-2">
              🏥 Social Security (Sozialversicherung) — {selectedYear}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-semibold text-surface-900-700">Pension Insurance (Rentenversicherung)</div>
                  <div className="text-xs text-surface-900-400">18.6% total (9.3% employee) · ceiling €{P.pensionCeiling.toLocaleString()}</div>
                </div>
                <span className="font-semibold text-surface-900-900">{formatEuro(result.pensionInsurance)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-semibold text-surface-900-700">Health Insurance (Krankenversicherung)</div>
                  <div className="text-xs text-surface-900-400">14.6% + ~{(P.healthAdditionalRate * 200).toFixed(1)}% avg additional · ceiling €{P.healthCeiling.toLocaleString()}</div>
                </div>
                <span className="font-semibold text-surface-900-900">{formatEuro(result.healthInsurance)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-semibold text-surface-900-700">Unemployment Insurance (Arbeitslosenversicherung)</div>
                  <div className="text-xs text-surface-900-400">2.6% total (1.3% employee)</div>
                </div>
                <span className="font-semibold text-surface-900-900">{formatEuro(result.unemploymentInsurance)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-semibold text-surface-900-700">Care Insurance (Pflegeversicherung)</div>
                  <div className="text-xs text-surface-900-400">
                    {children === 0 ? `${(careRateTotal * 100).toFixed(1)}% base + 0.6% childless surcharge` : 
                     children >= 2 ? `${(careRateTotal * 100).toFixed(1)}% base − discount for ${children} children` : 
                     `${(careRateTotal * 100).toFixed(1)}% base rate`}
                  </div>
                </div>
                <span className="font-semibold text-surface-900-900">{formatEuro(result.careInsurance)}</span>
              </div>

              <div className="border-t-2 border-blue-300 pt-3 flex justify-between items-center">
                <span className="font-bold text-surface-900-900 text-lg">Total Social Contributions</span>
                <span className="font-bold text-blue-600 text-xl">{formatEuro(result.totalSocialContributions)}</span>
              </div>
            </div>
          </div>

          {/* Tax Rates */}
          <div className="bg-gradient-to-r from-secondary to-surface-700 rounded-2xl shadow-elevated p-6 text-white">
            <h3 className="text-2xl font-bold mb-4">📈 Your Tax Rates</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-white/50 mb-2">Effective Tax Rate</div>
                <div className="text-5xl font-bold mb-2">{formatPercent(result.effectiveTaxRate)}</div>
                <div className="text-xs text-white/40">Total deductions / Gross income</div>
              </div>
              <div>
                <div className="text-sm text-white/50 mb-2">Marginal Tax Rate</div>
                <div className="text-5xl font-bold mb-2">{formatPercent(result.marginalTaxRate)}</div>
                <div className="text-xs text-white/40">Tax on next euro earned</div>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div className="bg-white rounded-2xl shadow-card p-6 border border-slate-200">
            <h3 className="text-2xl font-bold text-surface-900 mb-4">📅 Monthly Overview</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Gross</div>
                <div className="text-2xl font-bold text-secondary">{formatEuroCompact(result.grossIncome / 12)}</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Deductions</div>
                <div className="text-2xl font-bold text-slate-600">-{formatEuroCompact(result.totalDeductions / 12)}</div>
              </div>
              {children > 0 && (
                <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="text-xs text-primary mb-1">Kindergeld</div>
                  <div className="text-2xl font-bold text-primary">+{formatEuroCompact(result.kindergeld / 12)}</div>
                </div>
              )}
              <div className="text-center p-4 bg-primary/10 rounded-xl border border-primary/30">
                <div className="text-xs text-primary font-semibold mb-1">Net Monthly</div>
                <div className="text-3xl font-bold text-primary">{formatEuroCompact(result.netIncome / 12)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-500">⚠️ Disclaimer:</strong> This calculator provides approximate estimates for {selectedYear} based on §32a EStG and SV-Rechengrößenverordnung {selectedYear}. It does not constitute tax, legal, or financial advice. Actual tax liabilities may differ based on your individual circumstances, deductions, and current legislation. For official tax information, visit the{' '}
          <a href="https://www.bundesfinanzministerium.de" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Bundesministerium der Finanzen (BMF)</a>{' '}
          or consult a certified Steuerberater. No data is saved.
        </p>
      </div>
    </div>
  );
}
