// =============================================================
// data/taxRules.ts — Tax rules for Firestore seeding & Admin
// Path in Firestore: tax_rules/{countryCode}-{year}
// =============================================================
// Contains current year + previous year for each supported country.
// Germany: Calendar year (Jan–Dec). India: Financial Year (Apr–Mar).

export interface TaxBracket {
  min: number;
  max: number;  // use 999999999 for Infinity
  rate: number;
}

export interface TaxRuleSet {
  country: string;
  countryCode: string;
  year: number;
  yearLabel: string;        // e.g. "2026" or "FY 2025-26"
  currency: string;
  updatedAt: string;
  source: string;
  brackets: {
    single: TaxBracket[];
    married?: TaxBracket[];
  };
  standardDeduction: {
    single: number;
    married?: number;
  };
  socialSecurity: {
    employeeRate: number;
    wageBase: number;
  };
  medicareOrHealth: {
    rate: number;
    additionalRate?: number;
    additionalThreshold?: number;
  };
  // Germany-specific
  kindergeld?: number;        // monthly per child
  solidarityThreshold?: number; // single threshold
  careInsuranceRate?: number;
  healthCeiling?: number;
  notes: string;
}

// ═══════════════════════════════════════════════════════════════
// GERMANY
// ═══════════════════════════════════════════════════════════════

// ─── Germany 2025 (Previous Year) ────────────────────────────
// Source: §32a EStG 2025, Programmablaufplan 2025
export const GERMANY_2025: TaxRuleSet = {
  country: 'Germany', countryCode: 'DE', year: 2025,
  yearLabel: '2025',
  currency: 'EUR',
  updatedAt: '2025-01-01',
  source: '§32a EStG 2025 / Programmablaufplan 2025',
  brackets: {
    single: [
      { min: 0, max: 12096, rate: 0 },              // Grundfreibetrag
      { min: 12096, max: 17443, rate: 0.14 },        // Progressive zone 1 (14%→23.97%)
      { min: 17443, max: 68480, rate: 0.2397 },      // Progressive zone 2 (23.97%→42%)
      { min: 68480, max: 277825, rate: 0.42 },       // Spitzensteuersatz
      { min: 277825, max: 999999999, rate: 0.45 },   // Reichensteuer
    ],
  },
  standardDeduction: { single: 12096 },  // Grundfreibetrag 2025
  socialSecurity: {
    employeeRate: 0.093,  // Pension: 18.6% total, 9.3% employee
    wageBase: 96600,      // Pension ceiling 2025 (€96,600/year)
  },
  medicareOrHealth: {
    rate: 0.073,            // Health: 14.6% total, 7.3% employee
    additionalRate: 0.0125, // Avg additional ~2.5%/2 = 1.25% employee (GKV-Schätzerkreis 2025)
  },
  kindergeld: 255,           // €255/month per child
  solidarityThreshold: 18130, // Soli threshold single
  careInsuranceRate: 0.018,  // 3.6% total, 1.8% employee base (raised 1.1.2025)
  healthCeiling: 66150,      // Health insurance ceiling
  notes: 'Grundfreibetrag €12,096. Kindergeld €255/mo. Soli: 5.5% if tax > €18,130. Church tax 8% (BY/BW) or 9%. Pension ceiling €96,600. Health ceiling €66,150. Care insurance 3.6% (1.8% employee, raised from 3.4% on 1.1.2025, +0.6% childless). Formula: Zone 1: y=(x-12096)/10000, ESt=(932.30·y+1400)·y. Zone 2: z=(x-17443)/10000, ESt=(176.64·z+2397)·z+1015.13. Zone 3: 0.42·x-10911.92. Zone 4: 0.45·x-19246.67.'
};

// ─── Germany 2026 (Current Year) ─────────────────────────────
// Source: §32a EStG 2026 (Steuerfortentwicklungsgesetz), PAP 2026
export const GERMANY_2026: TaxRuleSet = {
  country: 'Germany', countryCode: 'DE', year: 2026,
  yearLabel: '2026',
  currency: 'EUR',
  updatedAt: '2026-01-01',
  source: '§32a EStG 2026 / Steuerfortentwicklungsgesetz / PAP 2026',
  brackets: {
    single: [
      { min: 0, max: 12348, rate: 0 },              // Grundfreibetrag 2026
      { min: 12348, max: 17799, rate: 0.14 },        // Progressive zone 1 (14%→23.97%)
      { min: 17799, max: 69878, rate: 0.2397 },      // Progressive zone 2 (23.97%→42%)
      { min: 69878, max: 277825, rate: 0.42 },       // Spitzensteuersatz
      { min: 277825, max: 999999999, rate: 0.45 },   // Reichensteuer
    ],
  },
  standardDeduction: { single: 12348 },  // Grundfreibetrag 2026
  socialSecurity: {
    employeeRate: 0.093,  // Pension: 18.6% total, 9.3% employee (unchanged)
    wageBase: 101400,     // Pension ceiling 2026 (€101,400/year)
  },
  medicareOrHealth: {
    rate: 0.073,            // Health: 14.6% total, 7.3% employee
    additionalRate: 0.0145, // Avg additional 2.9%/2 = 1.45% employee
  },
  kindergeld: 259,           // €259/month per child
  solidarityThreshold: 20350, // Soli threshold single 2026
  careInsuranceRate: 0.018,  // 3.6% total, 1.8% employee base
  healthCeiling: 69750,      // Health insurance ceiling 2026
  notes: 'Grundfreibetrag €12,348. Kindergeld €259/mo. Soli: 5.5% if tax > €20,350. Church tax 8% (BY/BW) or 9%. Pension ceiling €101,400. Health ceiling €69,750. Care insurance 3.6% (1.8% employee, +0.6% childless). Unemployment 2.6% (1.3% employee). Formula: Zone 1: y=(x-12348)/10000, ESt=(914.51·y+1400)·y. Zone 2: z=(x-17799)/10000, ESt=(173.10·z+2397)·z+1034.87. Zone 3: 0.42·x-11135.63. Zone 4: 0.45·x-19470.38.'
};

// ═══════════════════════════════════════════════════════════════
// INDIA (Financial Year: April–March)
// ═══════════════════════════════════════════════════════════════

// ─── India FY 2024-25 (Previous Year) ────────────────────────
// Source: Union Budget 2024 / Finance Act 2024
export const INDIA_FY2024: TaxRuleSet = {
  country: 'India', countryCode: 'IN', year: 2024,
  yearLabel: 'FY 2024-25',
  currency: 'INR',
  updatedAt: '2024-04-01',
  source: 'Finance Act 2024 / Union Budget 2024',
  brackets: {
    single: [ // New Regime (default from FY 2023-24)
      { min: 0, max: 300000, rate: 0 },
      { min: 300000, max: 700000, rate: 0.05 },
      { min: 700000, max: 1000000, rate: 0.10 },
      { min: 1000000, max: 1200000, rate: 0.15 },
      { min: 1200000, max: 1500000, rate: 0.20 },
      { min: 1500000, max: 999999999, rate: 0.30 },
    ],
    married: [ // Old Regime
      { min: 0, max: 250000, rate: 0 },
      { min: 250000, max: 500000, rate: 0.05 },
      { min: 500000, max: 1000000, rate: 0.20 },
      { min: 1000000, max: 999999999, rate: 0.30 },
    ],
  },
  standardDeduction: { single: 75000, married: 50000 },
  socialSecurity: { employeeRate: 0.12, wageBase: 180000 },
  medicareOrHealth: { rate: 0.04 }, // Cess
  notes: 'New regime default. Rebate u/s 87A: ₹25,000 if income ≤ ₹7L. Standard deduction ₹75,000 (new), ₹50,000 (old). Surcharge 10-37% above ₹50L.'
};

// ─── India FY 2025-26 (Current Year) ─────────────────────────
// Source: Union Budget 2025 / Finance Act 2025
export const INDIA_FY2025: TaxRuleSet = {
  country: 'India', countryCode: 'IN', year: 2025,
  yearLabel: 'FY 2025-26',
  currency: 'INR',
  updatedAt: '2025-04-01',
  source: 'Finance Act 2025 / Union Budget 2025',
  brackets: {
    single: [ // New Regime (default)
      { min: 0, max: 400000, rate: 0 },
      { min: 400000, max: 800000, rate: 0.05 },
      { min: 800000, max: 1200000, rate: 0.10 },
      { min: 1200000, max: 1600000, rate: 0.15 },
      { min: 1600000, max: 2000000, rate: 0.20 },
      { min: 2000000, max: 2400000, rate: 0.25 },
      { min: 2400000, max: 999999999, rate: 0.30 },
    ],
    married: [ // Old Regime (unchanged)
      { min: 0, max: 250000, rate: 0 },
      { min: 250000, max: 500000, rate: 0.05 },
      { min: 500000, max: 1000000, rate: 0.20 },
      { min: 1000000, max: 999999999, rate: 0.30 },
    ],
  },
  standardDeduction: { single: 75000, married: 50000 },
  socialSecurity: { employeeRate: 0.12, wageBase: 180000 },
  medicareOrHealth: { rate: 0.04 }, // Cess
  notes: 'New regime default. Rebate u/s 87A: ₹60,000 if income ≤ ₹12L (up from ₹7L). Nil exemption ₹4L (up from ₹3L). Standard deduction ₹75,000. Surcharge capped at 25% in new regime.'
};

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

export const ALL_TAX_RULES: TaxRuleSet[] = [
  GERMANY_2026, GERMANY_2025,
  INDIA_FY2025, INDIA_FY2024,
];

// Helper: get rules for a country, sorted newest first
export function getRulesForCountry(countryCode: string): TaxRuleSet[] {
  return ALL_TAX_RULES
    .filter(r => r.countryCode === countryCode)
    .sort((a, b) => b.year - a.year);
}

// Helper: get current year rule for a country
export function getCurrentRule(countryCode: string): TaxRuleSet | undefined {
  const rules = getRulesForCountry(countryCode);
  return rules[0]; // newest
}

// Helper: Firestore path for a tax rule
export function taxRulePath(countryCode: string, year: number): string {
  return `tax_rules/${countryCode}-${year}`;
}
