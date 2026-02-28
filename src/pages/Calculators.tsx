import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useTier } from '../hooks/useTier';
import SidebarLayout from '../components/SidebarLayout';

// Import new calculator components
import FIRECalculator from '../components/FIRECalculator';
import ProjectionCalculator from '../components/ProjectionCalculator';
import WealthProjection from '../components/WealthProjection';
import GermanTaxCalculator from '../components/GermanTaxCalculator';
// Tax calculators for supported regions

import IndiaTaxCalculator from '../components/IndiaTaxCalculator';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Calculators() {
  const { formatAmount, formatCompact, currency } = useCurrency();
  usePageTitle('Calculators');
  const { myTaxCalc, allTaxCalcs, country } = useUserProfile();
  const { isFree } = useTier();

  // Default to user's country tax calc if available, else FIRE
  const [activeCalculator, setActiveCalculator] = useState('projection');

  // Build calculator tabs — universal calcs + country-relevant tax calcs
  // Order: Investment Returns, Retirement, Wealth Scenarios, Debt Payoff, then tax calcs
  const universalCalcs = [
    { id: 'projection', label: 'Investment Returns', icon: '📈', premium: false },
    { id: 'retirement', label: 'Retirement', icon: '👴', premium: false },
    { id: 'wealth', label: 'Wealth Scenarios', icon: '💰', premium: true },
    { id: 'debt', label: 'Debt Payoff', icon: '💳', premium: true },
  ];

  // User's country tax calc first, then others grouped separately
  const myTaxCalcs = myTaxCalc ? [{ ...myTaxCalc, premium: true }] : [];
  const otherTaxCalcs = allTaxCalcs.filter(t => t.id !== myTaxCalc?.id).map(t => ({ ...t, premium: true }));

  const extraCalcs: { id: string; label: string; icon: string; premium: boolean }[] = [];

  // FIRE is premium only
  const premiumCalcs = [
    { id: 'fire', label: 'FIRE Calculator', icon: '🔥', premium: true },
  ];

  // For free tier, auto-select user's tax calc if currently on a locked calc
  const allCalcs = [...universalCalcs, ...myTaxCalcs, ...otherTaxCalcs, ...premiumCalcs, ...extraCalcs];
  const activeCalcInfo = allCalcs.find(c => c.id === activeCalculator);
  const isActiveCalcLocked = isFree && activeCalcInfo?.premium;

  // Premium upgrade card for locked calculators
  const PremiumCalcGate = () => (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-10 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-secondary mb-2">Premium Calculator</h3>
      <p className="text-sm text-slate-500 mb-6">
        {activeCalcInfo?.label} is available on the Premium plan. Your free plan includes your country's tax calculator.
      </p>
      <Link to="/account" className="inline-block px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
        View Plans & Upgrade
      </Link>
    </div>
  );

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fadeIn">
          <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">
            Calculators
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Professional tools to plan your financial future
          </p>
        </div>

        {/* Calculator Tabs — grouped */}
        <div className="mb-6 space-y-2">
          {/* Universal + user's tax */}
          <div className="flex flex-wrap gap-2">
            {[...universalCalcs, ...myTaxCalcs, ...premiumCalcs].map(calc => {
              const isLocked = isFree && calc.premium;
              return (
                <button
                  key={calc.id}
                  onClick={() => setActiveCalculator(calc.id)}
                  className={`px-5 py-2.5 rounded-xl font-semibold transition-all text-sm flex items-center gap-1.5 ${
                    activeCalculator === calc.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : isLocked
                        ? 'bg-slate-50 border border-slate-200 text-slate-400'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-primary/30'
                  }`}
                >
                  <span>{calc.icon}</span>{calc.label}
                  {isLocked && <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md ml-1">PRO</span>}
                </button>
              );
            })}
            {extraCalcs.map(calc => {
              const isLocked = isFree && calc.premium;
              return (
                <button
                  key={calc.id}
                  onClick={() => setActiveCalculator(calc.id)}
                  className={`px-5 py-2.5 rounded-xl font-semibold transition-all text-sm flex items-center gap-1.5 ${
                    activeCalculator === calc.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : isLocked
                        ? 'bg-slate-50 border border-slate-200 text-slate-400'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-primary/30'
                  }`}
                >
                  <span>{calc.icon}</span>{calc.label}
                  {isLocked && <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md ml-1">PRO</span>}
                </button>
              );
            })}
          </div>

          {/* Other countries — collapsed */}
          {otherTaxCalcs.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mr-1">Other countries</span>
              {otherTaxCalcs.map(calc => {
                const isLocked = isFree && calc.premium;
                return (
                  <button
                    key={calc.id}
                    onClick={() => setActiveCalculator(calc.id)}
                    className={`px-4 py-2 rounded-xl font-medium transition-all text-xs flex items-center gap-1 ${
                      activeCalculator === calc.id
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : isLocked
                          ? 'bg-slate-50 border border-slate-200 text-slate-400'
                          : 'bg-slate-50 border border-slate-200 text-slate-500 hover:border-primary/30'
                    }`}
                  >
                    <span>{calc.icon}</span>{calc.label}
                    {isLocked && <span className="text-[8px] font-bold text-amber-500 ml-1">PRO</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Calculator Content */}
        <div className="animate-fadeIn">
          {isActiveCalcLocked ? (
            <PremiumCalcGate />
          ) : (
            <>
              {activeCalculator === 'fire' && <FIRECalculator />}
              {activeCalculator === 'projection' && <ProjectionCalculator />}
              {activeCalculator === 'wealth' && <WealthProjection />}
              {activeCalculator === 'tax-de' && <GermanTaxCalculator />}
              {/* Tax calculators for supported regions rendered below */}
              {activeCalculator === 'tax-in' && <IndiaTaxCalculator />}
              {activeCalculator === 'retirement' && <RetirementCalculator formatAmount={formatAmount} formatCompact={formatCompact} currency={currency} />}
              {activeCalculator === 'debt' && <DebtPayoffCalculator formatAmount={formatAmount} currency={currency} />}
            </>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}

// ============================================================================
// RETIREMENT CALCULATOR (KEPT FROM YOUR ORIGINAL)
// ============================================================================
function RetirementCalculator({ formatAmount, formatCompact, currency }: any) {
  const [currentAge, setCurrentAge] = useState(0);
  const [retirementAge, setRetirementAge] = useState(0);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [monthlyContribution, setMonthlyContribution] = useState(0);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [inflationRate, setInflationRate] = useState(2.5);

  const hasInputs = currentAge > 0 && retirementAge > currentAge;
  const yearsToRetirement = Math.max(retirementAge - currentAge, 1);
  const monthlyReturn = expectedReturn / 100 / 12;
  const months = yearsToRetirement * 12;

  // Future value of current savings
  const futureValueCurrent = currentSavings * Math.pow(1 + monthlyReturn, months);

  // Future value of monthly contributions
  const futureValueContributions = monthlyContribution * 
    ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);

  const retirementSavings = futureValueCurrent + futureValueContributions;
  const totalContributed = currentSavings + (monthlyContribution * months);
  const investmentGains = retirementSavings - totalContributed;

  // Inflation-adjusted value
  const realValue = retirementSavings / Math.pow(1 + inflationRate / 100, yearsToRetirement);

  // Safe withdrawal amount (4% rule)
  const annualWithdrawal = retirementSavings * 0.04;
  const monthlyIncome = annualWithdrawal / 12;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-secondary-200">
        <h2 className="text-2xl font-bold text-surface-900 mb-6">Your Retirement Plan</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">Current Age</label>
            <input type="number" value={currentAge || ''} placeholder="e.g. 30"
              onChange={(e) => setCurrentAge(Number(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">Retirement Age</label>
            <input type="number" value={retirementAge || ''} placeholder="e.g. 60"
              onChange={(e) => setRetirementAge(Number(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">Current Savings ({currency})</label>
            <input type="number" value={currentSavings || ''} placeholder="0"
              onChange={(e) => setCurrentSavings(Number(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">Monthly Contribution ({currency})</label>
            <input type="number" value={monthlyContribution || ''} placeholder="0"
              onChange={(e) => setMonthlyContribution(Number(e.target.value) || 0)}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">
              Expected Return (%)
            </label>
            <input
              type="number"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(Number(e.target.value))}
              step="0.5"
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">
              Inflation Rate (%)
            </label>
            <input
              type="number"
              value={inflationRate}
              onChange={(e) => setInflationRate(Number(e.target.value))}
              step="0.1"
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg"
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-primary to-teal-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="text-sm opacity-90 mb-2">Total at Retirement</div>
          <div className="text-5xl font-bold mb-3">{formatCompact(retirementSavings)}</div>
          <div className="text-xs opacity-75 mb-4">{formatAmount(retirementSavings)}</div>
          <div className="border-t border-white/20 pt-4 mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="opacity-75">Today's Value:</span>
              <span className="font-semibold">{formatCompact(realValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Years to Go:</span>
              <span className="font-semibold">{yearsToRetirement} years</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-secondary-200 space-y-6">
          <div>
            <div className="text-sm text-surface-900-500 mb-2">Monthly Retirement Income (4% rule)</div>
            <div className="text-3xl lg:text-4xl font-bold text-surface-900">{formatAmount(monthlyIncome)}</div>
            <div className="text-sm text-surface-900-400 mt-1">{formatAmount(annualWithdrawal)}/year</div>
          </div>
          
          <div className="pt-4 border-t space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-surface-900-500">Total Contributed</span>
              <span className="font-bold text-primary">{formatCompact(totalContributed)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-surface-900-500">Investment Gains</span>
              <span className="font-bold text-green-600">+{formatCompact(investmentGains)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-bold text-surface-900">Total Savings</span>
              <span className="font-bold text-surface-900 text-xl">{formatCompact(retirementSavings)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-secondary-200">
        <h3 className="text-xl font-bold text-surface-900 mb-6">Your Journey to Retirement</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              {currentAge}
            </div>
            <div className="flex-1">
              <div className="font-bold text-surface-900">Today</div>
              <div className="text-sm text-surface-900-500">Starting Savings: {formatAmount(currentSavings)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 pl-6">
            <div className="w-1 h-16 bg-gradient-to-b from-blue-500 to-green-500"></div>
            <div className="text-sm text-surface-900-500">
              Contributing {formatAmount(monthlyContribution)}/month for {yearsToRetirement} years
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
              {retirementAge}
            </div>
            <div className="flex-1">
              <div className="font-bold text-surface-900">Retirement</div>
              <div className="text-sm text-surface-900-500">Total Savings: {formatAmount(retirementSavings)}</div>
            </div>
          </div>
        </div>
      </div>
      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-500">⚠️ Disclaimer:</strong> This retirement calculator provides approximate projections for informational purposes only. Actual results will vary based on market conditions, tax implications, and personal circumstances. This does not constitute financial advice. Consult a qualified financial advisor. No data is saved.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// DEBT PAYOFF CALCULATOR (KEPT FROM YOUR ORIGINAL)
// ============================================================================
function DebtPayoffCalculator({ formatAmount, currency }: any) {
  const [debtAmount, setDebtAmount] = useState(0);
  const [interestRate, setInterestRate] = useState(0);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  const calculatePayoff = () => {
    if (monthlyPayment <= 0 || interestRate < 0) {
      return { months: 0, totalPaid: 0, totalInterest: 0 };
    }

    const monthlyRate = interestRate / 100 / 12;
    let balance = debtAmount;
    let months = 0;
    let totalPaid = 0;

    const monthlyInterest = balance * monthlyRate;
    if (monthlyPayment <= monthlyInterest) {
      return { months: Infinity, totalPaid: 0, totalInterest: 0 };
    }

    while (balance > 0 && months < 600) {
      const interest = balance * monthlyRate;
      const principal = monthlyPayment - interest;
      
      if (balance <= monthlyPayment) {
        totalPaid += balance + interest;
        balance = 0;
        months++;
        break;
      }
      
      balance -= principal;
      totalPaid += monthlyPayment;
      months++;
    }

    return {
      months,
      totalPaid,
      totalInterest: totalPaid - debtAmount
    };
  };

  const payoff = calculatePayoff();
  const years = Math.floor(payoff.months / 12);
  const remainingMonths = payoff.months % 12;
  const isPayoffImpossible = payoff.months === Infinity || payoff.months === 0;
  const isEmptyState = debtAmount === 0 && interestRate === 0 && monthlyPayment === 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-secondary-200">
        <h2 className="text-2xl font-bold text-surface-900 mb-6">Debt Information</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">Total Debt ({currency})</label>
            <input
              type="number"
              value={debtAmount || ''} placeholder="0"
              onChange={(e) => setDebtAmount(Number(e.target.value))}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">Annual Interest Rate (%)</label>
            <input
              type="number"
              value={interestRate || ''} placeholder="0"
              onChange={(e) => setInterestRate(Number(e.target.value))}
              step="0.5"
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">Monthly Payment ({currency})</label>
            <input
              type="number"
              value={monthlyPayment || ''} placeholder="0"
              onChange={(e) => setMonthlyPayment(Number(e.target.value))}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-lg"
            />
          </div>
        </div>
      </div>

      {isEmptyState ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-3">📊</div>
          <h3 className="text-lg font-bold text-secondary mb-2">Enter your debt details above</h3>
          <p className="text-sm text-slate-500">Fill in your total debt, interest rate, and monthly payment to see your payoff timeline.</p>
        </div>
      ) : isPayoffImpossible ? (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-2xl font-bold text-red-900 mb-2">Payment Too Low!</h3>
          <p className="text-red-700 mb-4">
            Your monthly payment doesn't cover the interest charges. Increase your payment to at least{' '}
            <strong>{formatAmount((debtAmount * interestRate / 100 / 12) + 1)}</strong> per month.
          </p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-primary to-teal-600 rounded-2xl p-6 text-white shadow-xl">
              <div className="text-sm opacity-90 mb-2">Time to Payoff</div>
              <div className="text-3xl lg:text-4xl font-bold mb-2">{years}y {remainingMonths}m</div>
              <div className="text-sm opacity-75">{payoff.months} months total</div>
            </div>
            <div className="bg-white rounded-2xl p-6 border-2 border-red-200 bg-red-50">
              <div className="text-sm text-red-900 mb-2">Total Amount Paid</div>
              <div className="text-3xl lg:text-4xl font-bold text-red-700 mb-2">{formatAmount(payoff.totalPaid)}</div>
              <div className="text-sm text-red-600">Principal + Interest</div>
            </div>
            <div className="bg-white rounded-2xl p-6 border-2 border-orange-200 bg-orange-50">
              <div className="text-sm text-orange-900 mb-2">Total Interest</div>
              <div className="text-3xl lg:text-4xl font-bold text-orange-700 mb-2">{formatAmount(payoff.totalInterest)}</div>
              <div className="text-sm text-orange-600">Extra cost of debt</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-secondary-200">
            <h3 className="text-xl font-bold text-surface-900 mb-6">Payment Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                <span className="text-surface-900-700">Original Debt</span>
                <span className="font-bold text-surface-900">{formatAmount(debtAmount)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                <span className="text-orange-900">Total Interest</span>
                <span className="font-bold text-orange-700">+{formatAmount(payoff.totalInterest)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border-2 border-red-300">
                <span className="text-red-900 font-bold">Total You'll Pay</span>
                <span className="font-bold text-red-700 text-xl">{formatAmount(payoff.totalPaid)}</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-bold text-surface-900 mb-3">💡 Pay More, Save More</h4>
              <div className="text-sm text-surface-900-700 space-y-2">
                <div>
                  If you increase payment to {formatAmount(monthlyPayment + 100)}:
                  <ul className="list-disc list-inside ml-4 mt-1 text-surface-900-500">
                    <li>Save approximately {formatAmount((payoff.totalInterest * 0.15))} in interest</li>
                    <li>Pay off {Math.floor(payoff.months * 0.15)} months faster</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-500">⚠️ Disclaimer:</strong> This debt payoff calculator provides approximate estimates for informational purposes only. Actual payoff timelines may vary based on interest rate changes, fees, and payment variations. This does not constitute financial advice. No data is saved.
        </p>
      </div>
    </div>
  );
}
