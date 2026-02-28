// =============================================================
// components/dashboard/QuickStats.tsx
// =============================================================
// Four stat cards linking to Portfolio, Debt, Goals, Projected.

import { Link } from 'react-router-dom';

interface Props {
  investments: number;
  recurringValue: number;
  totalGain: number;
  totalGainPct: number;
  investmentCount: number;
  totalDebt: number;
  debtCount: number;
  goalCount: number;
  goalsOnTrack: number;
  goalProgress: number;
  projectedValue: number;
  projYears: number;
  formatAmount: (n: number) => string;
}

export default function QuickStats({
  investments, recurringValue, totalGain, totalGainPct, investmentCount,
  totalDebt, debtCount, goalCount, goalsOnTrack, goalProgress,
  projectedValue, projYears, formatAmount,
}: Props) {
  const stats = [
    {
      to: '/investments', icon: '📈', bg: 'bg-emerald-500/8', l: 'Portfolio',
      v: formatAmount(investments + recurringValue),
      d: totalGain !== 0 ? `${totalGain >= 0 ? '+' : ''}${totalGainPct.toFixed(1)}%` : `${investmentCount} assets`,
      dc: totalGain >= 0 ? 'text-emerald-600' : 'text-red-500',
    },
    {
      to: '/debts', icon: '💳', bg: 'bg-amber-500/8', l: 'Debt',
      v: formatAmount(totalDebt),
      d: debtCount > 0 ? `${debtCount} active` : 'None',
      dc: totalDebt === 0 ? 'text-emerald-600' : 'text-slate-400',
    },
    {
      to: '/goal-tracker', icon: '🎯', bg: 'bg-amber-500/8', l: 'Goals',
      v: `${goalCount} Active`,
      d: goalsOnTrack > 0 ? `${goalsOnTrack} on track` : goalCount > 0 ? `${goalProgress.toFixed(0)}%` : 'Set one',
      dc: 'text-blue-600',
    },
    {
      to: '/wealth-projection', icon: '🔮', bg: 'bg-violet-500/8', l: 'Projected',
      v: formatAmount(projectedValue),
      d: `in ${projYears} years`,
      dc: 'text-slate-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {stats.map(s => (
        <Link key={s.to} to={s.to} className="group flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-card hover:border-primary/20 hover:shadow-card-hover transition-all">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${s.bg}`}>{s.icon}</div>
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">{s.l}</div>
            <div className="text-sm font-bold text-secondary mt-0.5">{s.v}</div>
            <div className={`text-[10px] font-semibold mt-0.5 ${s.dc}`}>{s.d}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
