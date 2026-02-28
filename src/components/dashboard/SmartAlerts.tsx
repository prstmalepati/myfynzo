// =============================================================
// components/dashboard/SmartAlerts.tsx
// =============================================================
// Smart financial alerts with contextual icons and colors.

import type { SmartAlert } from '../../types';

interface Props {
  alerts: SmartAlert[];
  pricesLastUpdated: string | null;
}

export default function SmartAlerts({ alerts, pricesLastUpdated }: Props) {
  const formatTimeSince = (iso: string) => {
    try {
      const d = new Date(iso);
      const mins = Math.round((Date.now() - d.getTime()) / 60000);
      return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.round(mins / 60)}h ago` : d.toLocaleDateString();
    } catch { return ''; }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Smart Alerts</h3>
      {pricesLastUpdated && (
        <p className="text-[10px] text-slate-300 -mt-2 mb-3">
          Prices updated {formatTimeSince(pricesLastUpdated)}
        </p>
      )}
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${
            a.type === 'good' ? 'bg-emerald-50/50 border-emerald-200/50'
            : a.type === 'warn' ? 'bg-amber-50/50 border-amber-200/50'
            : 'bg-blue-50/50 border-blue-200/50'
          }`}>
            <span className="text-sm flex-shrink-0 mt-px">{a.icon}</span>
            <div className="text-xs text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: a.text }} />
          </div>
        ))}
      </div>
    </div>
  );
}
