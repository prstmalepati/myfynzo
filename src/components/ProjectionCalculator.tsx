import { useState, useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';

export default function ProjectionCalculator() {
  const { formatAmount } = useCurrency();

  const [lumpSum, setLumpSum] = useState(0);
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [annualReturn, setAnnualReturn] = useState(8);
  const [inflationRate, setInflationRate] = useState(2.5);
  const [years, setYears] = useState(0);

  const results = useMemo(() => {
    const r = annualReturn / 100;
    const inf = inflationRate / 100;
    const monthlyR = r / 12;
    const months = years * 12;

    // Future Value = Lump Sum * (1+r)^years + Monthly * [((1+r/12)^n - 1) / (r/12)]
    let fvLump = lumpSum * Math.pow(1 + r, years);
    let fvMonthly = monthlyR > 0
      ? monthlyAmount * ((Math.pow(1 + monthlyR, months) - 1) / monthlyR)
      : monthlyAmount * months;

    const nominalTotal = fvLump + fvMonthly;
    const totalContributed = lumpSum + (monthlyAmount * months);
    const totalGrowth = nominalTotal - totalContributed;

    // Real (inflation-adjusted)
    const realTotal = nominalTotal / Math.pow(1 + inf, years);
    const realGrowth = realTotal - totalContributed;

    // Yearly breakdown
    const yearly = [];
    let balance = lumpSum;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + monthlyR) + monthlyAmount;
      }
      const contributed = lumpSum + (monthlyAmount * y * 12);
      const growth = balance - contributed;
      const real = balance / Math.pow(1 + inf, y);
      yearly.push({ year: y, balance, contributed, growth, real });
    }

    return { nominalTotal, realTotal, totalContributed, totalGrowth, realGrowth, yearly };
  }, [lumpSum, monthlyAmount, annualReturn, inflationRate, years]);

  // Chart
  const maxVal = Math.max(...results.yearly.map(d => d.balance), 1);
  const chartW = 600, chartH = 200, padL = 10, padR = 10, padT = 10, padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const toX = (y: number) => padL + (y / years) * plotW;
  const toY = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const nominalPath = results.yearly.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(d.year).toFixed(1)},${toY(d.balance).toFixed(1)}`
  ).join(' ');
  const realPath = results.yearly.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(d.year).toFixed(1)},${toY(d.real).toFixed(1)}`
  ).join(' ');
  const contribPath = results.yearly.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(d.year).toFixed(1)},${toY(d.contributed).toFixed(1)}`
  ).join(' ');

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Inputs */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
          <h3 className="text-sm font-bold text-secondary mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[10px]">💰</span>
            Investment Inputs
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">One-time Investment</label>
              <input type="number" value={lumpSum || ''} onChange={e => setLumpSum(Number(e.target.value))} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Monthly Contribution</label>
              <input type="number" value={monthlyAmount || ''} onChange={e => setMonthlyAmount(Number(e.target.value))} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500">Expected Return</label>
                <span className="text-xs font-bold text-secondary">{annualReturn}%</span>
              </div>
              <input type="range" min="1" max="20" step="0.5" value={annualReturn}
                onChange={e => setAnnualReturn(Number(e.target.value))}
                className="w-full accent-primary" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500">Inflation Rate</label>
                <span className="text-xs font-bold text-secondary">{inflationRate}%</span>
              </div>
              <input type="range" min="0" max="10" step="0.5" value={inflationRate}
                onChange={e => setInflationRate(Number(e.target.value))}
                className="w-full accent-primary" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500">Time Period</label>
                <span className="text-xs font-bold text-secondary">{years} years</span>
              </div>
              <input type="range" min="1" max="40" step="1" value={years}
                onChange={e => setYears(Number(e.target.value))}
                className="w-full accent-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="lg:col-span-2 space-y-4">
        {/* Result Cards */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated">
            <div className="text-xs text-white/50 mb-1">Nominal Value</div>
            <div className="text-2xl font-bold tracking-tight">{formatAmount(results.nominalTotal)}</div>
            <div className="text-xs text-white/40 mt-1">after {years} years</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
            <div className="text-xs text-slate-500 mb-1">Real Value (inflation-adjusted)</div>
            <div className="text-2xl font-bold text-secondary tracking-tight">{formatAmount(results.realTotal)}</div>
            <div className="text-xs text-slate-400 mt-1">in today's money</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200/80 p-4">
            <div className="text-[10px] text-slate-400">Total Contributed</div>
            <div className="text-lg font-bold text-secondary">{formatAmount(results.totalContributed)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 p-4">
            <div className="text-[10px] text-slate-400">Growth (Nominal)</div>
            <div className="text-lg font-bold text-emerald-600">+{formatAmount(results.totalGrowth)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 p-4">
            <div className="text-[10px] text-slate-400">Growth (Real)</div>
            <div className={`text-lg font-bold ${results.realGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {results.realGrowth >= 0 ? '+' : ''}{formatAmount(results.realGrowth)}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
          <h3 className="text-sm font-bold text-secondary mb-3">Growth Over Time</h3>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
            <path d={contribPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
            <path d={realPath} fill="none" stroke="#0f766e" strokeWidth="2" opacity="0.5" />
            <path d={nominalPath} fill="none" stroke="#0f766e" strokeWidth="2.5" />
            {/* X axis labels */}
            {[0, Math.round(years * 0.25), Math.round(years * 0.5), Math.round(years * 0.75), years].filter((v, i, a) => a.indexOf(v) === i).map(y => (
              <text key={y} x={toX(y)} y={chartH - 5} textAnchor="middle" className="text-[9px] fill-slate-400">Y{y}</text>
            ))}
          </svg>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-primary rounded" /><span className="text-[10px] text-slate-500">Nominal</span></div>
            <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-primary/50 rounded" /><span className="text-[10px] text-slate-500">Real</span></div>
            <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 border-t border-dashed border-slate-400" /><span className="text-[10px] text-slate-500">Contributed</span></div>
          </div>
        </div>

        {/* Year-by-Year Table */}
        {results.yearly.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Year</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400">Contributed</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400">Nominal</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400">Real</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400">Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {results.yearly.filter((_, i) => i % Math.max(1, Math.floor(years / 10)) === 0 || i === results.yearly.length - 1).map(row => (
                    <tr key={row.year} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-xs font-semibold text-secondary">Y{row.year}</td>
                      <td className="px-4 py-2 text-xs text-right text-slate-500">{formatAmount(row.contributed)}</td>
                      <td className="px-4 py-2 text-xs text-right font-semibold text-secondary">{formatAmount(row.balance)}</td>
                      <td className="px-4 py-2 text-xs text-right text-slate-500">{formatAmount(row.real)}</td>
                      <td className="px-4 py-2 text-xs text-right font-semibold text-emerald-600">+{formatAmount(row.growth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-500">⚠️ Disclaimer:</strong> This calculator provides approximate projections for informational purposes only. Actual investment returns vary and past performance does not guarantee future results. Consult a qualified financial advisor. No data is saved.
        </p>
      </div>
    </div>
  );
}
