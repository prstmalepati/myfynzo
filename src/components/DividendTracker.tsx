// =============================================================
// components/DividendTracker.tsx
// Shows dividend income summary and annual projection
// Reads dividendYield from investment docs
// Premium feature — shown on Dashboard and Investment Hub
// =============================================================

import { useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';

interface DividendInvestment {
  name: string;
  symbol: string;
  type: string;
  quantity: number;
  currentPrice: number;
  dividendYield?: number;       // Annual yield as percentage (e.g. 2.5)
  dividendPerShare?: number;    // Annual dividend per share in currency
  dividendFrequency?: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  lastDividendDate?: string;
}

interface Props {
  investments: DividendInvestment[];
  compact?: boolean; // Compact mode for dashboard widget
}

export default function DividendTracker({ investments, compact = false }: Props) {
  const { formatAmount, formatCompact } = useCurrency();

  const dividendData = useMemo(() => {
    const withDividends = investments.filter(
      inv => (inv.dividendYield && inv.dividendYield > 0) || (inv.dividendPerShare && inv.dividendPerShare > 0)
    );

    if (withDividends.length === 0) return null;

    let totalAnnualDividend = 0;
    const items = withDividends.map(inv => {
      const value = inv.quantity * inv.currentPrice;
      let annualDividend = 0;

      if (inv.dividendPerShare && inv.dividendPerShare > 0) {
        annualDividend = inv.dividendPerShare * inv.quantity;
      } else if (inv.dividendYield && inv.dividendYield > 0) {
        annualDividend = value * (inv.dividendYield / 100);
      }

      totalAnnualDividend += annualDividend;

      return {
        name: inv.name,
        symbol: inv.symbol,
        value,
        annualDividend,
        yield: value > 0 ? (annualDividend / value) * 100 : 0,
        frequency: inv.dividendFrequency || 'quarterly',
        lastDate: inv.lastDividendDate,
      };
    }).sort((a, b) => b.annualDividend - a.annualDividend);

    const totalPortfolioValue = investments.reduce((s, i) => s + i.quantity * i.currentPrice, 0);
    const portfolioYield = totalPortfolioValue > 0 ? (totalAnnualDividend / totalPortfolioValue) * 100 : 0;

    return {
      items,
      totalAnnualDividend,
      monthlyDividend: totalAnnualDividend / 12,
      portfolioYield,
      dividendPayerCount: withDividends.length,
    };
  }, [investments]);

  if (!dividendData) {
    if (compact) return null;
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card">
        <h3 className="text-sm font-bold text-secondary mb-2">Dividend Income</h3>
        <p className="text-xs text-slate-400">No dividend data yet. Add dividend yield or dividend per share to your holdings to track passive income.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <span className="text-base">💰</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-secondary">Dividend Income</h3>
              <p className="text-[10px] text-slate-400">{dividendData.dividendPayerCount} dividend payers</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-emerald-600">{formatAmount(dividendData.totalAnnualDividend)}</div>
            <div className="text-[10px] text-emerald-500/70">per year</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">{formatAmount(dividendData.monthlyDividend)}/month</span>
          <span className="text-emerald-600 font-semibold">{dividendData.portfolioYield.toFixed(2)}% yield</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-secondary">Dividend Income</h3>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-600">{formatAmount(dividendData.totalAnnualDividend)}<span className="text-xs text-slate-400 font-normal">/yr</span></div>
          <div className="text-[10px] text-slate-400">{formatAmount(dividendData.monthlyDividend)}/mo · {dividendData.portfolioYield.toFixed(2)}% yield</div>
        </div>
      </div>

      {/* Monthly projection bar */}
      <div className="grid grid-cols-12 gap-1 mb-4">
        {Array.from({ length: 12 }, (_, i) => {
          const monthNames = ['J','F','M','A','M','J','J','A','S','O','N','D'];
          // Simplified: distribute based on frequency patterns
          const monthDividend = dividendData.monthlyDividend;
          const maxMonth = dividendData.totalAnnualDividend / 4; // normalize
          const height = maxMonth > 0 ? Math.max(4, (monthDividend / maxMonth) * 24) : 4;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-full bg-emerald-100 rounded-full" style={{ height: `${height}px` }}>
                <div className="w-full bg-emerald-500 rounded-full" style={{ height: `${height}px` }} />
              </div>
              <span className="text-[8px] text-slate-400">{monthNames[i]}</span>
            </div>
          );
        })}
      </div>

      {/* Top dividend payers */}
      <div className="space-y-2">
        {dividendData.items.slice(0, 5).map((item, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-emerald-600">{i + 1}</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-secondary truncate">{item.name}</div>
                <div className="text-[10px] text-slate-400">{item.frequency} · {item.yield.toFixed(2)}% yield</div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <div className="text-xs font-bold text-emerald-600">{formatAmount(item.annualDividend)}</div>
              <div className="text-[10px] text-slate-400">/year</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
