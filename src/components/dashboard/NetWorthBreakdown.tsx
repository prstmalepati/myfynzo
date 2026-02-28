// =============================================================
// components/dashboard/NetWorthBreakdown.tsx
// =============================================================
// Donut chart + legend showing cash, investments, assets, debt.

interface Props {
  cash: number;
  investments: number;
  recurringValue: number;
  assets: number;
  totalDebt: number;
  netWorth: number;
  projectedValue: number;
  projYears: number;
  formatAmount: (n: number) => string;
}

export default function NetWorthBreakdown({
  cash, investments, recurringValue, assets, totalDebt, netWorth, projectedValue, projYears, formatAmount
}: Props) {
  const segments = [
    { label: 'Cash', value: cash, color: '#10b981' },
    { label: 'Investments', value: investments + recurringValue, color: '#0f766e' },
    { label: 'Assets', value: assets, color: '#8b5cf6' },
  ].filter(s => s.value > 0);

  const total = segments.reduce((s, i) => s + i.value, 0) || 1;
  const R = 52, cx = 65, cy = 65, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Net Worth Breakdown</h3>
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="relative w-[130px] h-[130px] flex-shrink-0">
          <svg viewBox="0 0 130 130" width="130" height="130">
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
            {segments.map((seg, i) => {
              const pct = seg.value / total;
              const dash = pct * C;
              const gap = C - dash;
              const el = (
                <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={seg.color} strokeWidth="14"
                  strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
                  transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-700" />
              );
              offset += dash;
              return el;
            })}
            {totalDebt > 0 && (() => {
              const debtPct = Math.min(totalDebt / total, 0.5);
              const dash = debtPct * C;
              return (
                <circle cx={cx} cy={cy} r={R} fill="none" stroke="#ef4444" strokeWidth="14" strokeOpacity="0.6"
                  strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
                  transform={`rotate(-90 ${cx} ${cy})`} />
              );
            })()}
            <text x={cx} y={cy - 6} textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="700">{formatAmount(netWorth)}</text>
            <text x={cx} y={cy + 8} textAnchor="middle" fill="#94a3b8" fontSize="7" textTransform="uppercase">Net Worth</text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {[
            { label: 'Cash & Savings', value: cash, color: '#10b981', icon: '🏦' },
            { label: 'Investments', value: investments + recurringValue, color: '#0f766e', icon: '📈' },
            { label: 'Physical Assets', value: assets, color: '#8b5cf6', icon: '🏠' },
            { label: 'Debt', value: -totalDebt, color: '#ef4444', icon: '💳' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-slate-500 flex-1">{item.label}</span>
              <span className={`text-xs font-bold ${item.value < 0 ? 'text-red-500' : 'text-secondary'}`}>
                {item.value < 0 ? '−' : ''}{formatAmount(Math.abs(item.value))}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-secondary">Projected ({projYears}yr)</span>
            <span className="text-xs font-bold text-primary">{formatAmount(projectedValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
