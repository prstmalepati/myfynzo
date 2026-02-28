// =============================================================
// components/BenchmarkComparison.tsx
// Compares portfolio performance against a selected benchmark
// Shows side-by-side comparison with visual chart
// Premium feature — shown on Investment Hub Overview
// =============================================================

import { useState, useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';

interface Investment {
  name: string;
  type: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
}

interface Props {
  investments: Investment[];
  country?: string;
}

// Benchmark data — approximate annual returns for common indices
const BENCHMARKS: Record<string, { name: string; region: string; annualReturns: Record<string, number> }> = {
  'NIFTY50': {
    name: 'Nifty 50', region: 'India',
    annualReturns: { '2024': 8.8, '2023': 20.0, '2022': 4.3, '2021': 24.1, '2020': 14.9, '3yr': 14.5, '5yr': 14.5, '10yr': 12.2 },
  },
  'SENSEX': {
    name: 'Sensex', region: 'India',
    annualReturns: { '2024': 8.2, '2023': 18.7, '2022': 4.4, '2021': 22.0, '2020': 15.8, '3yr': 13.8, '5yr': 13.9, '10yr': 11.8 },
  },
  'SP500': {
    name: 'S&P 500', region: 'US',
    annualReturns: { '2024': 23.3, '2023': 24.2, '2022': -19.4, '2021': 26.9, '2020': 16.3, '3yr': 8.9, '5yr': 14.5, '10yr': 12.7 },
  },
  'NASDAQ': {
    name: 'Nasdaq 100', region: 'US',
    annualReturns: { '2024': 25.6, '2023': 53.8, '2022': -32.6, '2021': 26.6, '2020': 47.6, '3yr': 12.3, '5yr': 20.8, '10yr': 18.4 },
  },
  'MSCI_WORLD': {
    name: 'MSCI World', region: 'Global',
    annualReturns: { '2024': 17.1, '2023': 21.8, '2022': -18.1, '2021': 21.8, '2020': 15.9, '3yr': 6.5, '5yr': 11.6, '10yr': 9.8 },
  },
  'DAX': {
    name: 'DAX', region: 'Germany',
    annualReturns: { '2024': 18.8, '2023': 20.3, '2022': -12.3, '2021': 15.8, '2020': 3.5, '3yr': 8.5, '5yr': 9.0, '10yr': 7.8 },
  },
};

export default function BenchmarkComparison({ investments, country }: Props) {
  const { formatAmount } = useCurrency();

  // Default benchmark based on country
  const defaultBenchmark = country === 'IN' ? 'NIFTY50' : country === 'DE' ? 'DAX' : country === 'US' ? 'SP500' : 'MSCI_WORLD';
  const [selectedBenchmark, setSelectedBenchmark] = useState(defaultBenchmark);

  const comparison = useMemo(() => {
    if (investments.length === 0) return null;

    // Calculate portfolio weighted CAGR
    const now = Date.now();
    let totalCost = 0, totalValue = 0;
    let weightedYears = 0;

    const invWithDates = investments.filter(i => i.purchaseDate && i.purchasePrice > 0 && i.currentPrice > 0);
    if (invWithDates.length === 0) return null;

    invWithDates.forEach(inv => {
      const cost = inv.quantity * inv.purchasePrice;
      const value = inv.quantity * inv.currentPrice;
      totalCost += cost;
      totalValue += value;
      const years = (now - new Date(inv.purchaseDate + 'T00:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      weightedYears += years * (cost / invWithDates.reduce((s, i2) => s + i2.quantity * i2.purchasePrice, 0));
    });

    if (totalCost <= 0 || weightedYears < 0.05) return null;

    const portfolioCAGR = (Math.pow(totalValue / totalCost, 1 / weightedYears) - 1) * 100;
    const absoluteReturn = ((totalValue - totalCost) / totalCost) * 100;

    const bm = BENCHMARKS[selectedBenchmark];
    // Use appropriate benchmark return based on holding period
    let benchmarkReturn = bm.annualReturns['3yr'] || 10;
    if (weightedYears <= 1.5) benchmarkReturn = bm.annualReturns['2024'] || bm.annualReturns['3yr'] || 10;
    else if (weightedYears <= 4) benchmarkReturn = bm.annualReturns['3yr'] || 10;
    else if (weightedYears <= 7) benchmarkReturn = bm.annualReturns['5yr'] || 10;
    else benchmarkReturn = bm.annualReturns['10yr'] || 10;

    const alpha = portfolioCAGR - benchmarkReturn;

    return {
      portfolioCAGR,
      absoluteReturn,
      benchmarkReturn,
      alpha,
      beatingBenchmark: alpha > 0,
      holdingPeriod: weightedYears,
      totalCost,
      totalValue,
    };
  }, [investments, selectedBenchmark]);

  if (!comparison) return null;

  const bm = BENCHMARKS[selectedBenchmark];

  // Visual bar chart data
  const maxVal = Math.max(Math.abs(comparison.portfolioCAGR), Math.abs(comparison.benchmarkReturn));
  const portfolioPct = maxVal > 0 ? (comparison.portfolioCAGR / maxVal) * 100 : 0;
  const benchmarkPct = maxVal > 0 ? (comparison.benchmarkReturn / maxVal) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-secondary">Benchmark Comparison</h3>
        <select
          value={selectedBenchmark}
          onChange={e => setSelectedBenchmark(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-secondary bg-white"
        >
          {Object.entries(BENCHMARKS).map(([key, b]) => (
            <option key={key} value={key}>{b.name} ({b.region})</option>
          ))}
        </select>
      </div>

      {/* Visual comparison */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-secondary">Your Portfolio</span>
            <span className={`text-sm font-bold ${comparison.portfolioCAGR >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {comparison.portfolioCAGR >= 0 ? '+' : ''}{comparison.portfolioCAGR.toFixed(1)}%
            </span>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${comparison.portfolioCAGR >= 0 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}
              style={{ width: `${Math.max(4, Math.abs(portfolioPct))}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500">{bm.name}</span>
            <span className={`text-sm font-bold ${comparison.benchmarkReturn >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {comparison.benchmarkReturn >= 0 ? '+' : ''}{comparison.benchmarkReturn.toFixed(1)}%
            </span>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${comparison.benchmarkReturn >= 0 ? 'bg-gradient-to-r from-blue-400 to-blue-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}
              style={{ width: `${Math.max(4, Math.abs(benchmarkPct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Alpha indicator */}
      <div className={`rounded-xl p-3 ${comparison.beatingBenchmark ? 'bg-emerald-50 border border-emerald-200/60' : 'bg-amber-50 border border-amber-200/60'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{comparison.beatingBenchmark ? '🏆' : '📊'}</span>
            <div>
              <div className={`text-xs font-bold ${comparison.beatingBenchmark ? 'text-emerald-700' : 'text-amber-700'}`}>
                {comparison.beatingBenchmark ? 'Outperforming' : 'Underperforming'} {bm.name}
              </div>
              <div className="text-[10px] text-slate-500">
                ~{comparison.holdingPeriod.toFixed(1)} year avg. holding period
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-bold ${comparison.alpha >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {comparison.alpha >= 0 ? '+' : ''}{comparison.alpha.toFixed(1)}%
            </div>
            <div className="text-[9px] text-slate-400">alpha (annualized)</div>
          </div>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-[9px] text-slate-300 mt-3">
        Portfolio return: CAGR. Benchmark: approximate {comparison.holdingPeriod < 2 ? '1yr' : comparison.holdingPeriod < 5 ? '3yr' : comparison.holdingPeriod < 8 ? '5yr' : '10yr'} annualized return. Past performance doesn't guarantee future results.
      </p>
    </div>
  );
}
