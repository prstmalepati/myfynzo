import { useState, useRef } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import PartnerToggle from '../components/PartnerToggle';
import IncomeManager from './IncomeManager';
import Debts from './Debts';
import { usePageTitle } from '../hooks/usePageTitle';

export default function IncomeDebts() {
  const [activeTab, setActiveTab] = useState<'income' | 'debts'>('income');
  usePageTitle('Income & Debts');

  // Refs to trigger add from child components
  const incomeAddRef = useRef<{ triggerAdd: () => void } | null>(null);
  const debtAddRef = useRef<{ triggerAdd: () => void } | null>(null);

  const handleAdd = () => {
    if (activeTab === 'income') incomeAddRef.current?.triggerAdd();
    else debtAddRef.current?.triggerAdd();
  };

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header with Add button on top-right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeIn">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Income & Debts</h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'income'
                ? 'Track all income sources for accurate financial planning'
                : 'Track all debts in one place — totals auto-sync to Wealth Projector'}
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-teal-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {activeTab === 'income' ? 'Add Income' : 'Add Debt'}
          </button>
        </div>

        {/* Family Premium Toggle */}
        <PartnerToggle context="Manage finances per person" showHousehold />

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
          <button onClick={() => setActiveTab('income')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'income' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-secondary'}`}>
            💰 Income Manager
          </button>
          <button onClick={() => setActiveTab('debts')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'debts' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-secondary'}`}>
            💳 Debt Manager
          </button>
        </div>

        {/* Tab Content */}
        <div className="animate-fadeIn">
          {activeTab === 'income' && <IncomeManager embedded ref={incomeAddRef} />}
          {activeTab === 'debts' && <Debts embedded ref={debtAddRef} />}
        </div>
      </div>
    </SidebarLayout>
  );
}
