// =============================================================
// components/dashboard/CashFlowCard.tsx
// =============================================================
// Monthly cash flow waterfall with flow cards and visual bar.

interface Props {
  income: number;
  expenses: number;
  monthlyInvestment: number;
  monthlyDebtPayment: number;
  monthlySaving: number;
  formatAmount: (n: number) => string;
}

export default function CashFlowCard({ income, expenses, monthlyInvestment, monthlyDebtPayment, monthlySaving, formatAmount }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 mb-4">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Cash Flow</h3>
        <span className="text-xs text-slate-400">
          Savings rate: <strong className="text-primary">{income > 0 ? Math.round(Math.max(0, monthlySaving) / income * 100) : 0}%</strong>
        </span>
      </div>

      {/* Flow cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Income', value: income, icon: '↓', bg: 'bg-emerald-50', border: 'border-emerald-200/60', text: 'text-emerald-600', badge: 'in' },
          { label: 'Expenses', value: expenses, icon: '→', bg: 'bg-amber-50', border: 'border-amber-200/60', text: 'text-amber-600', badge: 'out' },
          { label: 'Invested', value: monthlyInvestment, icon: '→', bg: 'bg-blue-50', border: 'border-blue-200/60', text: 'text-blue-600', badge: 'out' },
          { label: 'Debt', value: monthlyDebtPayment, icon: '→', bg: 'bg-amber-50', border: 'border-amber-200/50', text: 'text-amber-600', badge: 'out' },
          { label: 'Saved', value: Math.max(0, monthlySaving), icon: '✦', bg: 'bg-violet-50', border: 'border-violet-200/60', text: 'text-violet-600', badge: 'net' },
        ].filter(b => b.value > 0 || b.label === 'Saved').map(b => (
          <div key={b.label} className={`${b.bg} rounded-xl border ${b.border} p-3.5 relative`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 font-medium">{b.label}</span>
              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                b.badge === 'in' ? 'bg-emerald-100 text-emerald-600'
                : b.badge === 'net' ? 'bg-violet-100 text-violet-600'
                : 'bg-slate-100 text-slate-400'
              }`}>{b.badge}</span>
            </div>
            <div className={`text-lg font-bold ${b.text} tabular-nums`}>{formatAmount(b.value)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{income > 0 ? Math.round(b.value / income * 100) : 0}% of income</div>
          </div>
        ))}
      </div>

      {/* Visual flow bar */}
      <div className="relative">
        <div className="flex h-3 rounded-full overflow-hidden">
          {[
            { value: expenses, color: 'bg-amber-400' },
            { value: monthlyInvestment, color: 'bg-blue-400' },
            { value: monthlyDebtPayment, color: 'bg-amber-400' },
            { value: Math.max(0, monthlySaving), color: 'bg-violet-400' },
          ].filter(s => s.value > 0).map((s, i) => (
            <div key={i} className={`${s.color} transition-all duration-700`} style={{ width: `${income > 0 ? (s.value / income * 100) : 0}%` }} />
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] text-slate-400">
          <span>0%</span>
          <span>100% of income</span>
        </div>
      </div>
    </div>
  );
}
