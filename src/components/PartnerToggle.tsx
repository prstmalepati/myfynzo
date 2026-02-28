// =============================================================
// components/PartnerToggle.tsx — Family Premium profile switcher
// =============================================================
// Supports 2-way (You / Partner) and 3-way (You / Partner / Household) modes.
import { usePartner } from '../context/PartnerContext';

interface PartnerToggleProps {
  context?: string;
  showHousehold?: boolean;
}

export default function PartnerToggle({ context, showHousehold = false }: PartnerToggleProps) {
  const { isFamily, activeProfile, setActiveProfile, partnerName } = usePartner();

  if (!isFamily) return null;

  const buttons: { key: 'self' | 'partner' | 'household'; label: string; dot: string; active: string }[] = [
    { key: 'self', label: 'You', dot: 'bg-primary', active: 'text-primary' },
    { key: 'partner', label: partnerName, dot: 'bg-violet-500', active: 'text-violet-600' },
    ...(showHousehold
      ? [{ key: 'household' as const, label: 'Family', dot: 'bg-violet-500', active: 'text-violet-500' }]
      : []),
  ];

  return (
    <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl px-4 py-2.5 mb-5 shadow-card animate-fadeIn">
      <div className="flex items-center gap-2 text-[12px] text-slate-400 font-medium">
        <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-500 to-primary text-white text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
          👨‍👩‍👧 Family
        </span>
        {context && <span className="hidden sm:inline">{context}</span>}
      </div>
      <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
        {buttons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setActiveProfile(btn.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeProfile === btn.key
                ? `bg-white ${btn.active} shadow-sm`
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeProfile === btn.key ? btn.dot : 'bg-slate-300'}`} />
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
