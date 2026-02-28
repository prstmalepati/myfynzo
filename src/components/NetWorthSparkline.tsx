// =============================================================
// components/NetWorthSparkline.tsx
// Shows a mini sparkline chart of net worth over time
// Reads from users/{uid}/netWorthSnapshots subcollection
// =============================================================

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase/config';
import { collection, getDocs, orderBy, query, limit, doc, setDoc } from 'firebase/firestore';

interface Snapshot {
  date: string;
  netWorth: number;
  investments: number;
  cash: number;
  assets: number;
  debts: number;
}

interface Props {
  currentNetWorth: number;
  className?: string;
}

export default function NetWorthSparkline({ currentNetWorth, className = '' }: Props) {
  const { user } = useAuth();
  const { formatAmount, formatCompact } = useCurrency();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadSnapshots();
  }, [user]);

  const loadSnapshots = async () => {
    if (!user) return;
    try {
      const q2 = query(
        collection(db, 'users', user.uid, 'netWorthSnapshots'),
        orderBy('date', 'desc'),
        limit(52) // Up to 1 year of weekly snapshots
      );
      const snap = await getDocs(q2);
      const data = snap.docs
        .map(d => d.data() as Snapshot)
        .reverse(); // Oldest first for chart

      setSnapshots(data);

      // If no snapshots exist yet, take one now (bootstrap)
      if (data.length === 0 && currentNetWorth > 0) {
        const today = new Date().toISOString().split('T')[0];
        await setDoc(doc(db, 'users', user.uid, 'netWorthSnapshots', today), {
          date: today,
          netWorth: currentNetWorth,
          investments: 0, cash: 0, assets: 0, debts: 0, recurring: 0,
          createdAt: new Date(),
        });
        setSnapshots([{ date: today, netWorth: currentNetWorth, investments: 0, cash: 0, assets: 0, debts: 0 }]);
      }
    } catch (err) {
      console.warn('[NetWorthSparkline] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add current value as the last data point
  const dataPoints = useMemo(() => {
    const pts = snapshots.map(s => s.netWorth);
    if (currentNetWorth > 0) pts.push(currentNetWorth);
    return pts;
  }, [snapshots, currentNetWorth]);

  // Calculate change
  const changeData = useMemo(() => {
    if (dataPoints.length < 2) return null;
    const first = dataPoints[0];
    const last = dataPoints[dataPoints.length - 1];
    const change = last - first;
    const changePct = first > 0 ? (change / first) * 100 : 0;
    return { change, changePct, isPositive: change >= 0 };
  }, [dataPoints]);

  if (loading || dataPoints.length < 2) return null;

  // SVG sparkline
  const w = 160, h = 40, pad = 2;
  const min = Math.min(...dataPoints) * 0.98;
  const max = Math.max(...dataPoints) * 1.02;
  const range = max - min || 1;
  const points = dataPoints.map((v, i) => {
    const x = pad + (i / (dataPoints.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const lineColor = changeData?.isPositive ? '#10b981' : '#ef4444';
  const gradientId = `nw-grad-${changeData?.isPositive ? 'up' : 'down'}`;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon
          points={`${pad},${h - pad} ${points.join(' ')} ${w - pad},${h - pad}`}
          fill={`url(#${gradientId})`}
        />
        {/* Line */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current value dot */}
        <circle
          cx={parseFloat(points[points.length - 1].split(',')[0])}
          cy={parseFloat(points[points.length - 1].split(',')[1])}
          r="2.5"
          fill={lineColor}
        />
      </svg>
      {changeData && (
        <div className="text-right">
          <div className={`text-[11px] font-bold ${changeData.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {changeData.isPositive ? '+' : ''}{formatCompact(changeData.change)}
          </div>
          <div className={`text-[9px] font-semibold ${changeData.isPositive ? 'text-emerald-500/70' : 'text-red-400/70'}`}>
            {changeData.isPositive ? '+' : ''}{changeData.changePct.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// XIRR Calculation — Newton-Raphson method
// Used for time-weighted return calculation on investments
// =============================================================

interface CashFlow {
  date: Date;
  amount: number; // negative = outflow (purchase), positive = inflow (current value)
}

export function calculateXIRR(cashFlows: CashFlow[], guess = 0.1): number | null {
  if (cashFlows.length < 2) return null;

  // Sort by date
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const d0 = sorted[0].date.getTime();

  const yearFrac = (d: Date) => (d.getTime() - d0) / (365.25 * 24 * 60 * 60 * 1000);

  // Newton-Raphson iteration
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    let f = 0, df = 0;
    for (const cf of sorted) {
      const t = yearFrac(cf.date);
      const denominator = Math.pow(1 + rate, t);
      if (!isFinite(denominator) || denominator === 0) return null;
      f += cf.amount / denominator;
      df -= t * cf.amount / (denominator * (1 + rate));
    }
    if (Math.abs(f) < 1e-6) return rate;
    if (df === 0) return null;
    const newRate = rate - f / df;
    if (!isFinite(newRate)) return null;
    rate = newRate;
  }

  // Didn't converge
  return Math.abs(rate) < 10 ? rate : null;
}

// Convenience: calculate XIRR for a single investment
export function investmentXIRR(
  purchaseDate: string,
  purchasePrice: number,
  quantity: number,
  currentPrice: number,
  currentDate: Date = new Date()
): number | null {
  if (!purchaseDate || !purchasePrice || !currentPrice || !quantity) return null;

  const cashFlows: CashFlow[] = [
    { date: new Date(purchaseDate), amount: -(purchasePrice * quantity) },
    { date: currentDate, amount: currentPrice * quantity },
  ];

  return calculateXIRR(cashFlows);
}
