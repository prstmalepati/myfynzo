// =============================================================
// components/InvestmentIntelligence.tsx
// B7 Enhancement — Portfolio X-Ray, Rebalancing, Dividend Calendar
// Premium feature — embedded in Investments page Overview tab
// =============================================================

import { useState, useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';

interface IntelInvestment {
  name: string;
  symbol: string;
  type: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate?: string;
  dividendYield?: number;
  dividendPerShare?: number;
  dividendFrequency?: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
}

interface TargetAllocation {
  type: string;
  target: number;
}

interface Props {
  investments: IntelInvestment[];
  compact?: boolean;
}

const DEFAULT_TARGETS: TargetAllocation[] = [
  { type: 'Stocks', target: 40 },
  { type: 'ETFs', target: 30 },
  { type: 'Bonds', target: 10 },
  { type: 'Cryptocurrency', target: 5 },
  { type: 'Gold', target: 5 },
  { type: 'Cash', target: 10 },
];

const TYPE_COLORS: Record<string, string> = {
  Stocks: '#3b82f6', ETFs: '#10b981', Bonds: '#f59e0b', Cryptocurrency: '#8b5cf6',
  Gold: '#eab308', Silver: '#94a3b8', 'Mutual Funds': '#06b6d4', 'Real Estate': '#f97316',
  Commodities: '#84cc16', Other: '#6b7280',
};

export default function InvestmentIntelligence({ investments, compact = false }: Props) {
  const { formatAmount } = useCurrency();
  const [activeTab, setActiveTab] = useState<'rebalance' | 'dividends' | 'costbasis'>('rebalance');
  const [targets, setTargets] = useState<TargetAllocation[]>(DEFAULT_TARGETS);
  const [editingTargets, setEditingTargets] = useState(false);

  const allocationData = useMemo(() => {
    const totalValue = investments.reduce((s, i) => s + i.quantity * i.currentPrice, 0);
    if (totalValue === 0) return null;
    const byType: Record<string, { value: number; count: number; items: IntelInvestment[] }> = {};
    investments.forEach(inv => {
      const t = inv.type || 'Other';
      if (!byType[t]) byType[t] = { value: 0, count: 0, items: [] };
      byType[t].value += inv.quantity * inv.currentPrice;
      byType[t].count++;
      byType[t].items.push(inv);
    });
    const allocations = Object.entries(byType).map(([type, data]) => ({
      type, value: data.value,
      actual: (data.value / totalValue) * 100,
      target: targets.find(t => t.type === type)?.target || 0,
      count: data.count, items: data.items,
    })).sort((a, b) => b.value - a.value);
    const rebalanceActions = allocations
      .filter(a => a.target > 0)
      .map(a => ({ type: a.type, actual: a.actual, target: a.target, diff: a.actual - a.target, amount: (a.actual - a.target) / 100 * totalValue }))
      .filter(a => Math.abs(a.diff) > 2)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    return { totalValue, allocations, rebalanceActions };
  }, [investments, targets]);

  const dividendCalendar = useMemo(() => {
    const withDividends = investments.filter(inv => (inv.dividendYield && inv.dividendYield > 0) || (inv.dividendPerShare && inv.dividendPerShare > 0));
    if (withDividends.length === 0) return null;
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i, label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
      payments: [] as { name: string; symbol: string; amount: number }[], total: 0,
    }));
    withDividends.forEach(inv => {
      const value = inv.quantity * inv.currentPrice;
      let annualDiv = 0;
      if (inv.dividendPerShare && inv.dividendPerShare > 0) annualDiv = inv.dividendPerShare * inv.quantity;
      else if (inv.dividendYield && inv.dividendYield > 0) annualDiv = value * (inv.dividendYield / 100);
      const freq = inv.dividendFrequency || 'quarterly';
      const pm: number[] = freq === 'monthly' ? Array.from({length:12},(_,i)=>i) : freq === 'quarterly' ? [2,5,8,11] : freq === 'semi-annual' ? [5,11] : [11];
      const perPayment = annualDiv / pm.length;
      pm.forEach(m => { months[m].payments.push({ name: inv.name, symbol: inv.symbol, amount: perPayment }); months[m].total += perPayment; });
    });
    const totalAnnual = months.reduce((s, m) => s + m.total, 0);
    const maxMonth = Math.max(...months.map(m => m.total));
    return { months, totalAnnual, maxMonth };
  }, [investments]);

  const costBasisData = useMemo(() => {
    return investments.filter(i => i.quantity > 0).map(inv => {
      const costBasis = inv.quantity * inv.purchasePrice;
      const currentValue = inv.quantity * inv.currentPrice;
      const gain = currentValue - costBasis;
      const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
      const holdingDays = inv.purchaseDate ? Math.ceil((Date.now() - new Date(inv.purchaseDate).getTime()) / 86400000) : 0;
      return { name: inv.name, symbol: inv.symbol, type: inv.type, quantity: inv.quantity, purchasePrice: inv.purchasePrice, currentPrice: inv.currentPrice, costBasis, currentValue, gain, gainPct, holdingDays, isLongTerm: holdingDays > 365 };
    }).sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain));
  }, [investments]);

  if (!allocationData || investments.length === 0) {
    if (compact) return null;
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card">
        <h3 className="text-sm font-bold text-secondary mb-2">Investment Intelligence</h3>
        <p className="text-xs text-slate-400">Add investments to see rebalancing recommendations, dividend calendar, and cost basis analysis.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'rebalance' as const, label: 'Rebalance', icon: '⚖️' },
    { id: 'dividends' as const, label: 'Dividends', icon: '💰' },
    { id: 'costbasis' as const, label: 'Cost Basis', icon: '📊' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="border-b border-slate-100 px-5 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-secondary flex items-center gap-2">
            <span className="text-base">🧠</span> Investment Intelligence
          </h3>
          <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">PREMIUM</span>
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${activeTab === t.id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'rebalance' && (
          <div>
            {allocationData.rebalanceActions.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-semibold text-secondary">Portfolio is balanced</p>
                <p className="text-xs text-slate-400 mt-1">All allocations are within 2% of targets</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-3">Your portfolio is off-target. Recommended adjustments:</p>
                {allocationData.rebalanceActions.map((action, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${action.diff > 0 ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${TYPE_COLORS[action.type] || '#6b7280'}20`, color: TYPE_COLORS[action.type] || '#6b7280' }}>
                        {action.diff > 0 ? '↓' : '↑'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-secondary">{action.type}</div>
                        <div className="text-[10px] text-slate-400">{action.actual.toFixed(1)}% → {action.target}% target</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${action.diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {action.diff > 0 ? 'Sell' : 'Buy'} {formatAmount(Math.abs(action.amount))}
                      </div>
                      <div className="text-[10px] text-slate-400">{Math.abs(action.diff).toFixed(1)}% off</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500">Allocation vs Target</span>
                <button onClick={() => setEditingTargets(!editingTargets)} className="text-[10px] font-semibold text-primary hover:underline">
                  {editingTargets ? 'Done' : 'Edit Targets'}
                </button>
              </div>
              <div className="space-y-2">
                {allocationData.allocations.filter(a => a.actual > 0.5 || a.target > 0).map(a => {
                  const targetVal = targets.find(t => t.type === a.type)?.target || 0;
                  return (
                    <div key={a.type} className="flex items-center gap-3">
                      <div className="w-16 text-[10px] font-semibold text-slate-600 truncate">{a.type}</div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-50 rounded-full overflow-hidden relative">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(a.actual, 100)}%`, backgroundColor: TYPE_COLORS[a.type] || '#6b7280', opacity: 0.7 }} />
                          {targetVal > 0 && <div className="absolute top-0 bottom-0 w-0.5 bg-secondary/60" style={{ left: `${targetVal}%` }} />}
                        </div>
                      </div>
                      <div className="w-12 text-right text-[10px] font-bold text-secondary">{a.actual.toFixed(1)}%</div>
                      {editingTargets && (
                        <input type="number" value={targetVal} onChange={e => {
                          const newTargets = targets.map(t => t.type === a.type ? { ...t, target: Number(e.target.value) } : t);
                          if (!newTargets.find(t => t.type === a.type)) newTargets.push({ type: a.type, target: Number(e.target.value) });
                          setTargets(newTargets);
                        }} className="w-12 px-1 py-0.5 border border-slate-200 rounded text-[10px] text-center" min="0" max="100" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dividends' && (
          <div>
            {!dividendCalendar ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">💰</div>
                <p className="text-sm font-semibold text-secondary">No dividend data</p>
                <p className="text-xs text-slate-400 mt-1">Add dividend yield to your holdings to see the calendar</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4 p-3 bg-emerald-50 rounded-xl">
                  <div>
                    <div className="text-xs text-emerald-600 font-semibold">Projected Annual Dividends</div>
                    <div className="text-lg font-bold text-emerald-700">{formatAmount(dividendCalendar.totalAnnual)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-emerald-500">Monthly Average</div>
                    <div className="text-sm font-bold text-emerald-600">{formatAmount(dividendCalendar.totalAnnual / 12)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {dividendCalendar.months.map(m => {
                    const barH = dividendCalendar.maxMonth > 0 ? Math.max(4, (m.total / dividendCalendar.maxMonth) * 32) : 4;
                    const now = new Date().getMonth();
                    const isPast = m.month < now;
                    return (
                      <div key={m.month} className={`text-center p-2 rounded-xl border ${m.month === now ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100'}`}>
                        <div className={`text-[10px] font-semibold mb-1 ${m.month === now ? 'text-emerald-600' : isPast ? 'text-slate-300' : 'text-slate-500'}`}>{m.label}</div>
                        <div className="flex justify-center mb-1">
                          <div className="w-3 rounded-full" style={{ height: `${barH}px`, backgroundColor: isPast ? '#6ee7b7' : '#10b981' }} />
                        </div>
                        <div className={`text-[9px] font-bold ${m.total > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                          {m.total > 0 ? formatAmount(m.total) : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Upcoming Payments</div>
                  {dividendCalendar.months
                    .filter(m => m.month >= new Date().getMonth() && m.payments.length > 0)
                    .slice(0, 3)
                    .flatMap(m => m.payments.map(p => ({ ...p, month: m.label })))
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 6)
                    .map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-emerald-600">{p.month.slice(0,1)}</span>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-secondary">{p.name}</div>
                            <div className="text-[9px] text-slate-400">{p.symbol} · {p.month}</div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-600">{formatAmount(p.amount)}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'costbasis' && (
          <div>
            {costBasisData.length === 0 ? (
              <div className="text-center py-6"><div className="text-3xl mb-2">📊</div><p className="text-sm font-semibold text-secondary">No holdings</p></div>
            ) : (
              <>
                {(() => {
                  const totalCost = costBasisData.reduce((s, i) => s + i.costBasis, 0);
                  const totalValue = costBasisData.reduce((s, i) => s + i.currentValue, 0);
                  const totalGain = totalValue - totalCost;
                  const longTermGain = costBasisData.filter(i => i.isLongTerm).reduce((s, i) => s + i.gain, 0);
                  const shortTermGain = costBasisData.filter(i => !i.isLongTerm).reduce((s, i) => s + i.gain, 0);
                  return (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="p-2.5 rounded-xl bg-slate-50">
                        <div className="text-[10px] text-slate-400">Total Cost Basis</div>
                        <div className="text-sm font-bold text-secondary">{formatAmount(totalCost)}</div>
                      </div>
                      <div className={`p-2.5 rounded-xl ${totalGain >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <div className={`text-[10px] ${totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Unrealized Gain</div>
                        <div className={`text-sm font-bold ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatAmount(totalGain)}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-blue-50">
                        <div className="text-[10px] text-blue-500">Long-term / Short</div>
                        <div className="text-[11px] font-bold text-blue-600">{formatAmount(longTermGain)} / {formatAmount(shortTermGain)}</div>
                      </div>
                    </div>
                  );
                })()}
                <div className="space-y-2">
                  {costBasisData.slice(0, 8).map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-1 h-8 rounded-full ${item.isLongTerm ? 'bg-blue-400' : 'bg-amber-400'}`} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-secondary truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>{item.symbol}</span><span>·</span>
                            <span>{item.quantity} @ {formatAmount(item.purchasePrice)}</span><span>·</span>
                            <span className={`font-semibold ${item.isLongTerm ? 'text-blue-500' : 'text-amber-500'}`}>{item.isLongTerm ? 'LT' : 'ST'}</span>
                            {item.holdingDays > 0 && <span className="text-slate-300">({Math.floor(item.holdingDays / 30)}mo)</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className={`text-xs font-bold ${item.gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{item.gain >= 0 ? '+' : ''}{formatAmount(item.gain)}</div>
                        <div className={`text-[10px] ${item.gainPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{item.gainPct >= 0 ? '+' : ''}{item.gainPct.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">💡</span>
                    <p className="text-[10px] text-amber-700">
                      <strong>Tax tip:</strong> Long-term holdings (&gt; 1 year) may qualify for lower tax rates.
                      In Germany, Teilfreistellung reduces taxable gains for equity ETFs by 30%.
                      In India, LTCG above ₹1.25L is taxed at 12.5% vs 20% STCG.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
