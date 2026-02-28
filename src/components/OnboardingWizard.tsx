// =============================================================
// components/OnboardingWizard.tsx
// First-run guided setup for new users
// Shows after signup when user has 0 investments
// =============================================================

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase/config';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { Link } from 'react-router-dom';

interface Props {
  onComplete: () => void;
  investmentCount: number;
}

type Step = 'welcome' | 'goal' | 'first-investment' | 'savings' | 'done';

const GOALS = [
  { id: 'wealth', emoji: '📈', label: 'Build wealth', desc: 'Grow my investments over time' },
  { id: 'retirement', emoji: '🏖️', label: 'Retire comfortably', desc: 'Plan for financial independence' },
  { id: 'tax', emoji: '💰', label: 'Optimize taxes', desc: 'Reduce my tax burden legally' },
  { id: 'fire', emoji: '🔥', label: 'Achieve FIRE', desc: 'Financial independence, retire early' },
  { id: 'family', emoji: '👨‍👩‍👧‍👦', label: 'Family security', desc: 'Protect and plan for my family' },
  { id: 'learn', emoji: '🎓', label: 'Learn investing', desc: 'Understand markets and grow' },
];

export default function OnboardingWizard({ onComplete, investmentCount }: Props) {
  const { user } = useAuth();
  const { formatAmount, currency } = useCurrency();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [monthlySavings, setMonthlySavings] = useState('');
  const [saving, setSaving] = useState(false);

  // Don't show if user already has investments
  if (investmentCount > 0) return null;

  const handleSaveGoals = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        financialGoals: selectedGoals,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true });

      if (monthlySavings && Number(monthlySavings) > 0) {
        await setDoc(doc(db, 'users', user.uid, 'projections', 'wealth'), {
          monthlyInvestment: Number(monthlySavings),
          updatedAt: new Date(),
        }, { merge: true });
      }
    } catch (err) {
      console.error('[Onboarding] Save error:', err);
    }
    setSaving(false);
    setStep('done');
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden mb-6">
      {step === 'welcome' && (
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-primary/20 to-emerald-100 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">👋</span>
          </div>
          <h2 className="text-2xl font-bold text-secondary font-display mb-2">Welcome to myfynzo!</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Let's set up your financial dashboard in under 2 minutes. We'll personalize everything based on your goals.
          </p>
          <button
            onClick={() => setStep('goal')}
            className="px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Let's get started
          </button>
          <button
            onClick={onComplete}
            className="block mx-auto mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}

      {step === 'goal' && (
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-sm font-bold text-primary">1</div>
            <div>
              <h3 className="text-lg font-bold text-secondary">What are your financial goals?</h3>
              <p className="text-xs text-slate-400">Select all that apply</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {GOALS.map(goal => (
              <button
                key={goal.id}
                onClick={() => toggleGoal(goal.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedGoals.includes(goal.id)
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="text-2xl mb-2">{goal.emoji}</div>
                <div className="text-sm font-semibold text-secondary">{goal.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{goal.desc}</div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button onClick={() => setStep('welcome')} className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-700">Back</button>
            <button
              onClick={() => setStep('savings')}
              disabled={selectedGoals.length === 0}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 'savings' && (
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-sm font-bold text-primary">2</div>
            <div>
              <h3 className="text-lg font-bold text-secondary">How much do you invest monthly?</h3>
              <p className="text-xs text-slate-400">This helps us project your wealth growth</p>
            </div>
          </div>
          <div className="max-w-xs mb-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                {currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : '$'}
              </span>
              <input
                type="number"
                value={monthlySavings}
                onChange={e => setMonthlySavings(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-secondary font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-2">per month (SIPs, recurring deposits, etc.)</div>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button onClick={() => setStep('goal')} className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-700">Back</button>
            <button
              onClick={handleSaveGoals}
              disabled={saving}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 transition-all"
            >
              {saving ? 'Saving...' : 'Complete setup ✓'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-emerald-100 to-primary/20 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-xl font-bold text-secondary font-display mb-2">You're all set!</h2>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto text-sm">
            Now add your first investment to see your dashboard come alive.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/investments"
              className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add your first investment
            </Link>
            <button
              onClick={onComplete}
              className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              Explore dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
