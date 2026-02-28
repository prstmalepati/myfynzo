import { useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import GoalTracker from './GoalTracker';
import ScenarioBranching from './ScenarioBranching';
import AntiPortfolio from './AntiPortfolio';
import { usePageTitle } from '../hooks/usePageTitle';

const TABS = [
  { id: 'goals', label: 'Goal Tracker', icon: '🎯' },
  { id: 'scenarios', label: 'Scenarios', icon: '🔀' },
  { id: 'anti', label: 'Anti-Portfolio', icon: '⚠️' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function FinancialLab() {
  const [tab, setTab] = useState<TabId>('goals');
  usePageTitle('Financial Lab');

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fadeIn">
          <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Financial Lab</h1>
          <p className="text-sm text-slate-500 mt-1">Experiment with goals, scenarios, and track avoided investments</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1.5 mb-8 w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-slate-500 hover:text-secondary hover:bg-white/50'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'goals' && <GoalTracker embedded />}
        {tab === 'scenarios' && <ScenarioBranching embedded />}
        {tab === 'anti' && <AntiPortfolio embedded />}
      </div>
    </SidebarLayout>
  );
}
