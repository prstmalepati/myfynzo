// =============================================================
// types/index.ts — Shared domain types for myFynzo
// =============================================================
// Single source of truth for all financial data types used across pages.
// Eliminates `any` usage and ensures consistency between components.

// ─── Investment Types ────────────────────────────────────────

export interface Investment {
  id: string;
  name: string;
  symbol: string;
  type: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  currency: string;
  exchange: string;
  notes: string;
  dividendYield?: number;
  dividendPerShare?: number;
  dividendFrequency?: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  lastDividendDate?: string;
  lastPriceUpdate?: Date;
  _isPartner?: boolean;
}

export interface MIPEntry {
  id: string;
  date: string;
  amount: number;
  nav?: number;
  units?: number;
}

export interface MIP {
  id: string;
  name: string;
  symbol?: string;
  category: string;
  monthlyAmount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  purchasePrice?: number;
  currentPrice?: number;
  notes: string;
  startDate?: string;
  entries?: MIPEntry[];
  _isPartner?: boolean;
}

export interface CashSaving {
  id: string;
  name: string;
  type: 'Bank Savings' | 'Cash' | 'Other';
  amount: number;
  notes: string;
  _isPartner?: boolean;
}

export interface PhysicalAsset {
  id: string;
  name: string;
  type: 'Real Estate' | 'Vehicle' | 'Land' | 'Jewelry' | 'Art' | 'Other';
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  notes: string;
  _isPartner?: boolean;
}

// ─── Debt Types ──────────────────────────────────────────────

export interface Debt {
  id: string;
  name: string;
  category: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
  lender: string;
  notes: string;
}

// ─── Income Types ────────────────────────────────────────────

export interface Income {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  type: string;
  notes?: string;
}

// ─── Goal Types ──────────────────────────────────────────────

export interface Goal {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  notes: string;
  createdAt: Date;
}

// ─── Lifestyle Types ─────────────────────────────────────────

export interface LifestyleItem {
  id: string;
  name: string;
  category: string;
  monthlyCost: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  notes: string;
  _isPartner?: boolean;
}

// ─── Dashboard Aggregated Types ──────────────────────────────

export interface DashboardData {
  // Portfolio
  totalInvestments: number;
  totalCost: number;
  investmentCount: number;
  investmentItems: Investment[];
  invByType: { type: string; value: number; cost: number }[];
  recurringValue: number;
  monthlyInvestment: number;
  // Cash & Assets
  cashSavings: number;
  physicalAssets: number;
  // Debts
  totalDebt: number;
  monthlyDebtPayment: number;
  debtCount: number;
  // Goals
  goalCount: number;
  goalProgress: number;
  goalsOnTrack: number;
  // Lifestyle
  lifestyleMonthly: number;
  // Income
  netIncome: number;
  // Projection settings
  expectedReturn: number;
  projYears: number;
}

export interface PartnerData {
  investments: number;
  cash: number;
  assets: number;
  income: number;
  expenses: number;
  recurring: number;
}

export interface HealthScoreItem {
  name: string;
  value: number;
  color: string;
}

export interface HealthScore {
  overall: number;
  scores: HealthScoreItem[];
}

export interface SmartAlert {
  type: 'good' | 'warn' | 'info';
  icon: string;
  text: string;
}

// ─── Net Worth Snapshot ──────────────────────────────────────

export interface NetWorthSnapshot {
  date: string;
  netWorth: number;
  investments: number;
  cash: number;
  assets: number;
  debts: number;
  createdAt: Date;
}

// ─── Projection Types ────────────────────────────────────────

export interface ProjectionInputs {
  currentNetWorth: number;
  totalInvestments: number;
  totalDebt: number;
  monthlyExpenses: number;
  monthlyInvestment: number;
  monthlyDebtPayment: number;
  expectedReturn: number;
  inflationRate: number;
  projectionYears: number;
  volatility: number;
  retirementAge: number;
  withdrawalRate: number;
}

export interface YearData {
  year: number;
  age: number;
  netWorth: number;
  netWorthReal: number;
  investments: number;
  debt: number;
  totalContributed: number;
  totalGrowth: number;
}

// ─── Anti-Portfolio Types ────────────────────────────────────

export interface AntiPortfolioItem {
  id: string;
  title: string;
  category: 'crypto' | 'stocks' | 'real-estate' | 'business' | 'other';
  wouldHaveInvested: number;
  dateConsidered: Date;
  currentValue: number;
  reasoning: string;
  emotionalTrigger: 'fomo' | 'greed' | 'fear' | 'hype' | 'peer-pressure' | 'overconfidence';
  lessonsLearned: string;
  dodgedBullet: boolean;
  createdAt: Date;
}

// ─── Scenario Types ──────────────────────────────────────────

export interface LifeEvent {
  id: string;
  age: number;
  type: 'income' | 'expense' | 'savings' | 'other';
  description: string;
  amount: number;
  recurring: boolean;
}

export interface Scenario {
  id?: string;
  name: string;
  currentAge: number;
  targetAge: number;
  currentSavings: number;
  monthlyIncome: number;
  monthlySavings: number;
  expectedReturn: number;
  inflation: number;
  lifeEvents: LifeEvent[];
  color: string;
}

// ─── Report Types ────────────────────────────────────────────

export interface ReportData {
  userName: string;
  currency: string;
  country: string;
  date: string;
  investments: {
    name: string; type: string; symbol: string;
    quantity: number; purchasePrice: number; currentPrice: number;
    purchaseDate: string; gain: number; gainPct: number;
  }[];
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  recurringInvestments: { name: string; monthlyAmount: number; category: string }[];
  totalMonthlyInvestment: number;
  cashSavings: number;
  physicalAssets: number;
  totalDebt: number;
  debts: { name: string; remaining: number; rate: number; monthly: number }[];
  netWorth: number;
  monthlyExpenses: number;
  annualExpenses: number;
  goals: { name: string; target: number; current: number; progress: number }[];
  projectedValue: number;
  projectionYears: number;
  expectedReturn: number;
  allocationByType: { type: string; value: number; pct: number }[];
}

// ─── Utility Types ───────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';
export type InvestmentSortBy = 'name' | 'value' | 'gain' | 'gainPct' | 'cagr' | 'date';
export type GainFilter = 'all' | 'profit' | 'loss';
