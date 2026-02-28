// =============================================================
// components/dashboard/HealthScoreCard.tsx
// =============================================================
// Extracted from Dashboard.tsx — the dark health score hero card
// with radial progress, factor bars, and score label.

import type { HealthScore } from '../../types';

interface Props {
  healthScore: HealthScore;
  netWorth: number;
  formatAmount: (n: number) => string;
  netWorthChange30d: number | null;
  netWorthChangePct30d: number;
}

export default function HealthScoreCard({ healthScore, netWorth, formatAmount, netWorthChange30d, netWorthChangePct30d }: Props) {
  const scoreLabel = healthScore.overall >= 80 ? 'Excellent' : healthScore.overall >= 65 ? 'Good' : healthScore.overall >= 45 ? 'Fair' : 'Needs Attention';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white mb-5 relative overflow-hidden">
      {/* Subtle glow accents */}
      <div className="absolute top-0 left-1/4 w-[300px] h-[300px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }} />
      <div className="absolute bottom-0 right-1/4 w-[200px] h-[200px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />

      <div className="relative z-10 p-5 flex flex-col md:flex-row md:items-center gap-5">
        {/* Score Circle */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <div className="relative w-[100px] h-[100px]">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#scoreGrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${healthScore.overall * 2.64} ${264 - healthScore.overall * 2.64}`} className="transition-all duration-1000" />
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold tabular-nums">{healthScore.overall}</span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">{scoreLabel}</span>
            </div>
          </div>
          {/* Net Worth + Trend */}
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Net Worth</div>
            <div className="text-xl font-extrabold tabular-nums">{formatAmount(netWorth)}</div>
            {netWorthChange30d !== null && (
              <div className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${netWorthChange30d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <span>{netWorthChange30d >= 0 ? '↑' : '↓'}</span>
                <span>{formatAmount(Math.abs(netWorthChange30d))} ({netWorthChangePct30d >= 0 ? '+' : ''}{netWorthChangePct30d.toFixed(1)}%)</span>
                <span className="text-slate-500 font-normal ml-1">30d</span>
              </div>
            )}
          </div>
        </div>

        {/* Factor Bars */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-2">
          {healthScore.scores.map(s => (
            <div key={s.name} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-slate-400 truncate">{s.name}</span>
                  <span className="text-[10px] font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
