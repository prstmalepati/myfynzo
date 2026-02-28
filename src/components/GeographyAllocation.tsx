// =============================================================
// components/GeographyAllocation.tsx
// Donut chart showing investment allocation by geography
// Determines geography from exchange, currency, or symbol prefix
// =============================================================

import { useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';

interface Investment {
  name: string;
  symbol: string;
  exchange: string;
  currency: string;
  quantity: number;
  currentPrice: number;
  type: string;
}

interface Props {
  investments: Investment[];
  compact?: boolean;
}

const GEOGRAPHY_COLORS: Record<string, string> = {
  'India': '#f59e0b',
  'US': '#3b82f6',
  'Europe': '#8b5cf6',
  'Germany': '#8b5cf6',
  'UK': '#06b6d4',
  'Global': '#10b981',
  'Crypto': '#f97316',
  'Other': '#94a3b8',
};

function detectGeography(inv: Investment): string {
  const sym = inv.symbol?.toUpperCase() || '';
  const exch = inv.exchange?.toLowerCase() || '';
  const curr = inv.currency?.toUpperCase() || '';

  // Indian
  if (sym.startsWith('MF:') || exch.includes('nse') || exch.includes('bse') || exch.includes('amfi') || curr === 'INR') return 'India';
  // German/European
  if (exch.includes('xetr') || exch.includes('frankfurt') || exch.includes('tradegate') || exch.includes('fwb')) return 'Germany';
  if (exch.includes('euronext') || exch.includes('paris') || exch.includes('amsterdam') || exch.includes('milan') || exch.includes('six')) return 'Europe';
  if (exch.includes('lse') || exch.includes('london') || curr === 'GBP') return 'UK';
  // US
  if (exch.includes('nasdaq') || exch.includes('nyse') || exch.includes('nysearca') || curr === 'USD') return 'US';
  // Crypto
  if (exch.includes('crypto') || inv.type === 'Crypto') return 'Crypto';
  // Global ETFs
  if (sym.includes('WORLD') || sym.includes('MSCI') || sym.includes('GLOBAL') || inv.name?.toLowerCase().includes('world') || inv.name?.toLowerCase().includes('global')) return 'Global';

  return 'Other';
}

export default function GeographyAllocation({ investments, compact = false }: Props) {
  const { formatAmount, formatCompact } = useCurrency();

  const geoData = useMemo(() => {
    if (investments.length === 0) return null;

    const geoMap: Record<string, number> = {};
    let total = 0;

    investments.forEach(inv => {
      const value = inv.quantity * inv.currentPrice;
      if (value <= 0) return;
      const geo = detectGeography(inv);
      geoMap[geo] = (geoMap[geo] || 0) + value;
      total += value;
    });

    if (total <= 0) return null;

    const items = Object.entries(geoMap)
      .map(([region, value]) => ({
        region,
        value,
        pct: (value / total) * 100,
        color: GEOGRAPHY_COLORS[region] || GEOGRAPHY_COLORS['Other'],
      }))
      .sort((a, b) => b.value - a.value);

    return { items, total };
  }, [investments]);

  if (!geoData) return null;

  // SVG donut chart
  const size = compact ? 90 : 110;
  const strokeWidth = compact ? 16 : 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumPct = 0;
  const arcs = geoData.items.map(item => {
    const start = cumPct;
    cumPct += item.pct;
    return {
      ...item,
      offset: circumference - (start / 100) * circumference,
      length: (item.pct / 100) * circumference,
    };
  });

  return (
    <div className={`${compact ? '' : 'bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card'}`}>
      {!compact && <h3 className="text-sm font-bold text-secondary mb-4">Geographic Allocation</h3>}

      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="flex-shrink-0 relative" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
            {/* Background ring */}
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth}
            />
            {/* Data arcs */}
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx={size / 2} cy={size / 2} r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                strokeDashoffset={arc.offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[9px] text-slate-400 uppercase">Regions</div>
            <div className="text-sm font-bold text-secondary">{geoData.items.length}</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5 min-w-0">
          {geoData.items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="text-[11px] text-secondary truncate">{item.region}</span>
                <span className="text-[11px] font-semibold text-slate-500 ml-1">{item.pct.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
