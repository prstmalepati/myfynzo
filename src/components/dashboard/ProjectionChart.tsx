// =============================================================
// components/dashboard/ProjectionChart.tsx
// =============================================================
// SVG line chart showing nominal and real (inflation-adjusted)
// net worth projection over time.

interface Props {
  investments: number;
  recurringValue: number;
  totalDebt: number;
  cash: number;
  assets: number;
  monthlyInvestment: number;
  monthlyDebtPayment: number;
  expectedReturn: number;
  projYears: number;
  netWorth: number;
  projectedValue: number;
  formatAmount: (n: number) => string;
}

export default function ProjectionChart({
  investments, recurringValue, totalDebt, cash, assets,
  monthlyInvestment, monthlyDebtPayment, expectedReturn,
  projYears, netWorth, projectedValue, formatAmount,
}: Props) {
  const pts: { y: number; nw: number; re: number }[] = [];
  let inv = investments + recurringValue, dbt = totalDebt;
  const r = expectedReturn, ann = monthlyInvestment * 12, dp = monthlyDebtPayment * 12, base = cash + assets;
  pts.push({ y: 0, nw: netWorth, re: netWorth });
  for (let i = 1; i <= projYears; i++) {
    inv = inv * (1 + r) + ann; dbt = Math.max(0, dbt - dp);
    const nw = base + inv - dbt;
    pts.push({ y: i, nw, re: nw / Math.pow(1.025, i) });
  }
  const mx = Math.max(...pts.map(d => d.nw), 1);
  const W = 660, H = 165, pL = 55, pR = 10, pT = 8, pB = 22, pw = W - pL - pR, ph = H - pT - pB;
  const tx = (y: number) => pL + (y / projYears) * pw;
  const ty = (v: number) => pT + ph - (v / mx) * ph;
  const nL = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${tx(d.y).toFixed(1)},${ty(d.nw).toFixed(1)}`).join(' ');
  const rL = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${tx(d.y).toFixed(1)},${ty(d.re).toFixed(1)}`).join(' ');
  const area = nL + ` L${tx(projYears).toFixed(1)},${ty(0).toFixed(1)} L${tx(0).toFixed(1)},${ty(0).toFixed(1)} Z`;
  const xS = projYears <= 10 ? 2 : projYears <= 20 ? 5 : 10;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Worth Projection</h3>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-px rounded bg-primary inline-block" style={{ height: 2 }} /> Nominal</span>
          <span className="flex items-center gap-1"><span className="w-3 h-px rounded bg-primary/30 inline-block" style={{ height: 2 }} /> Real</span>
        </div>
      </div>
      <div className="h-[170px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
          <defs>
            <linearGradient id="nf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(15,118,110,0.1)" />
              <stop offset="100%" stopColor="rgba(15,118,110,0)" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const v = mx * p, y = ty(v);
            return (
              <g key={i}>
                <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#f1f5f9" />
                <text x={pL - 4} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                  {v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : '0'}
                </text>
              </g>
            );
          })}
          {/* X axis labels */}
          {Array.from({ length: Math.floor(projYears / xS) + 1 }, (_, i) => i * xS).map(yr => (
            <text key={yr} x={tx(yr)} y={H - 4} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">{yr}yr</text>
          ))}
          {/* Chart paths */}
          <path d={area} fill="url(#nf)" />
          <path d={nL} fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={rL} fill="none" stroke="#0f766e" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
          <circle cx={tx(projYears)} cy={ty(pts[pts.length - 1].nw)} r="3" fill="#0f766e" stroke="white" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-slate-400">Today: <strong className="text-secondary">{formatAmount(netWorth)}</strong></span>
        <span className="text-[11px] text-slate-400">In {projYears}yr: <strong className="text-primary">{formatAmount(projectedValue)}</strong></span>
      </div>
    </div>
  );
}
