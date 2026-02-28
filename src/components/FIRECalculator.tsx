import { useState, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';

interface FIREResult {
  yearsToFIRE: number;
  fireDate: Date;
  requiredPortfolio: number;
  currentProgress: number;
  monthlyContributionNeeded: number;
  safeWithdrawalAmount: number;
  inflationAdjustedTarget: number;
  probabilityOfSuccess: number;
}

export default function FIRECalculator() {
  const { formatAmount, formatCompact } = useCurrency();
  
  // Inputs
  const [currentAge, setCurrentAge] = useState(0);
  const [targetRetirementAge, setTargetRetirementAge] = useState(0);
  const [currentNetWorth, setCurrentNetWorth] = useState(0);
  const [monthlySavings, setMonthlySavings] = useState(0);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [annualExpenses, setAnnualExpenses] = useState(0);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [country, setCountry] = useState('Germany');
  const [customInflation, setCustomInflation] = useState(2.5);

  // Country inflation rates (2024 estimates)
  const inflationRates: { [key: string]: number } = {
    'Germany': 2.5,
    'United States': 3.2,
    'United Kingdom': 2.8,
    'Switzerland': 1.8,
    'France': 2.3,
    'Spain': 2.9,
    'Italy': 1.9,
    'Netherlands': 2.4,
    'Austria': 3.1,
    'Belgium': 2.2,
    'Japan': 2.0,
    'Australia': 3.5,
    'Canada': 2.7,
    'Singapore': 2.1,
    'Custom': customInflation
  };

  const inflationRate = inflationRates[country] || 2.5;

  const calculateFIRE = (): FIREResult => {
    const yearsToRetirement = targetRetirementAge - currentAge;
    const monthsToRetirement = yearsToRetirement * 12;
    
    // Real return (after inflation)
    const realReturn = (expectedReturn - inflationRate) / 100;
    const monthlyReturn = Math.pow(1 + realReturn, 1/12) - 1;
    
    // Required portfolio for FIRE (using 4% rule or custom)
    const requiredPortfolio = annualExpenses / (withdrawalRate / 100);
    
    // Inflation-adjusted target
    const inflationAdjustedTarget = requiredPortfolio * Math.pow(1 + inflationRate/100, yearsToRetirement);
    
    // Future value of current portfolio
    const futureValueCurrent = currentNetWorth * Math.pow(1 + realReturn, yearsToRetirement);
    
    // Future value of monthly savings (annuity formula)
    const futureValueSavings = monthlySavings * (Math.pow(1 + monthlyReturn, monthsToRetirement) - 1) / monthlyReturn;
    
    // Total projected portfolio
    const totalProjected = futureValueCurrent + futureValueSavings;
    
    // Current progress toward FIRE
    const currentProgress = (currentNetWorth / requiredPortfolio) * 100;
    
    // Calculate actual years to FIRE (when portfolio reaches target)
    let actualYearsToFIRE = 0;
    let portfolio = currentNetWorth;
    
    while (portfolio < inflationAdjustedTarget && actualYearsToFIRE < 50) {
      portfolio = portfolio * (1 + realReturn) + (monthlySavings * 12);
      actualYearsToFIRE++;
    }
    
    // Monthly contribution needed to hit target
    const stillNeeded = Math.max(0, inflationAdjustedTarget - futureValueCurrent);
    const monthlyNeeded = stillNeeded > 0 
      ? (stillNeeded * monthlyReturn) / (Math.pow(1 + monthlyReturn, monthsToRetirement) - 1)
      : 0;
    
    // Safe withdrawal amount (4% rule)
    const safeWithdrawalAmount = totalProjected * (withdrawalRate / 100);
    
    // Probability of success (simplified - based on coverage ratio)
    const coverageRatio = totalProjected / inflationAdjustedTarget;
    let probabilityOfSuccess = 0;
    if (coverageRatio >= 1.5) probabilityOfSuccess = 95;
    else if (coverageRatio >= 1.25) probabilityOfSuccess = 85;
    else if (coverageRatio >= 1.0) probabilityOfSuccess = 75;
    else if (coverageRatio >= 0.75) probabilityOfSuccess = 60;
    else if (coverageRatio >= 0.5) probabilityOfSuccess = 40;
    else probabilityOfSuccess = 20;
    
    const fireDate = new Date();
    fireDate.setFullYear(fireDate.getFullYear() + actualYearsToFIRE);
    
    return {
      yearsToFIRE: actualYearsToFIRE,
      fireDate,
      requiredPortfolio: inflationAdjustedTarget,
      currentProgress,
      monthlyContributionNeeded: Math.max(0, monthlyNeeded - monthlySavings),
      safeWithdrawalAmount,
      inflationAdjustedTarget,
      probabilityOfSuccess
    };
  };

  const result = calculateFIRE();

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-3xl font-bold text-surface-900 mb-6 flex items-center gap-3">
        <span className="text-4xl">🔥</span>
        FIRE Calculator
      </h2>
      <p className="text-surface-900-500 mb-8">Financial Independence, Retire Early</p>

      {/* Input Section */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Age Inputs */}
        <div>
          <label className="block text-sm font-semibold text-surface-900-700 mb-2">Current Age</label>
          <input
            type="number"
            value={currentAge}
            onChange={(e) => setCurrentAge(Number(e.target.value))}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-surface-900-700 mb-2">Target Retirement Age</label>
          <input
            type="number"
            value={targetRetirementAge}
            onChange={(e) => setTargetRetirementAge(Number(e.target.value))}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        {/* Financial Inputs */}
        <div>
          <label className="block text-sm font-semibold text-surface-900-700 mb-2">Current Net Worth</label>
          <input
            type="number"
            value={currentNetWorth}
            onChange={(e) => setCurrentNetWorth(Number(e.target.value))}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-surface-900-700 mb-2">Monthly Savings</label>
          <input
            type="number"
            value={monthlySavings}
            onChange={(e) => setMonthlySavings(Number(e.target.value))}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-surface-900-700 mb-2">Annual Expenses in Retirement</label>
          <input
            type="number"
            value={annualExpenses}
            onChange={(e) => setAnnualExpenses(Number(e.target.value))}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-surface-900-700 mb-2">Expected Return (%)</label>
          <input
            type="number"
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(Number(e.target.value))}
            step="0.1"
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-surface-900-700 mb-2">Safe Withdrawal Rate (%)</label>
          <input
            type="number"
            value={withdrawalRate}
            onChange={(e) => setWithdrawalRate(Number(e.target.value))}
            step="0.1"
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        {/* Country/Inflation */}
        <div>
          <label className="block text-sm font-semibold text-surface-900-700 mb-2">Country / Location</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="Germany">Germany ({inflationRates.Germany}%)</option>
            <option value="United States">United States ({inflationRates['United States']}%)</option>
            <option value="United Kingdom">United Kingdom ({inflationRates['United Kingdom']}%)</option>
            <option value="Switzerland">Switzerland ({inflationRates.Switzerland}%)</option>
            <option value="France">France ({inflationRates.France}%)</option>
            <option value="Spain">Spain ({inflationRates.Spain}%)</option>
            <option value="Italy">Italy ({inflationRates.Italy}%)</option>
            <option value="Netherlands">Netherlands ({inflationRates.Netherlands}%)</option>
            <option value="Austria">Austria ({inflationRates.Austria}%)</option>
            <option value="Belgium">Belgium ({inflationRates.Belgium}%)</option>
            <option value="Japan">Japan ({inflationRates.Japan}%)</option>
            <option value="Australia">Australia ({inflationRates.Australia}%)</option>
            <option value="Canada">Canada ({inflationRates.Canada}%)</option>
            <option value="Singapore">Singapore ({inflationRates.Singapore}%)</option>
            <option value="Custom">Custom Inflation Rate</option>
          </select>
        </div>

        {/* Custom Inflation */}
        {country === 'Custom' && (
          <div>
            <label className="block text-sm font-semibold text-surface-900-700 mb-2">Custom Inflation Rate (%)</label>
            <input
              type="number"
              value={customInflation}
              onChange={(e) => setCustomInflation(Number(e.target.value))}
              step="0.1"
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="space-y-6">
        {/* Main Result Card */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 border-2 border-orange-200">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎯</div>
            <div className="text-sm font-semibold text-orange-700 mb-2">Years to FIRE</div>
            <div className="text-6xl font-bold text-orange-900 mb-2">{result.yearsToFIRE}</div>
            <div className="text-lg text-orange-700">
              Target Date: {result.fireDate.getFullYear()}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm font-semibold mb-2">
              <span>Current Progress</span>
              <span>{result.currentProgress.toFixed(1)}%</span>
            </div>
            <div className="h-6 bg-white/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000"
                style={{ width: `${Math.min(100, result.currentProgress)}%` }}
              />
            </div>
          </div>

          {/* Success Probability */}
          <div className="text-center mt-6 p-4 bg-white/50 rounded-xl">
            <div className="text-sm font-semibold text-orange-700 mb-1">Probability of Success</div>
            <div className="text-3xl font-bold text-orange-900">{result.probabilityOfSuccess}%</div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
            <div className="text-sm font-semibold text-blue-700 mb-1">Required Portfolio</div>
            <div className="text-2xl font-bold text-blue-900">{formatCompact(result.requiredPortfolio)}</div>
            <div className="text-xs text-blue-600 mt-2">Inflation-adjusted</div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200">
            <div className="text-sm font-semibold text-green-700 mb-1">Annual Withdrawal</div>
            <div className="text-2xl font-bold text-green-900">{formatCompact(result.safeWithdrawalAmount)}</div>
            <div className="text-xs text-green-600 mt-2">{withdrawalRate}% safe withdrawal</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
            <div className="text-sm font-semibold text-purple-700 mb-1">Current Net Worth</div>
            <div className="text-2xl font-bold text-purple-900">{formatCompact(currentNetWorth)}</div>
            <div className="text-xs text-purple-600 mt-2">Starting point</div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-secondary-50 rounded-xl p-6">
          <h3 className="text-xl font-bold text-surface-900 mb-4">FIRE Plan Details</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-secondary-200">
              <div>
                <div className="font-semibold text-surface-900-900">Timeline</div>
                <div className="text-sm text-surface-900-500">{currentAge} → {targetRetirementAge} years old</div>
              </div>
              <div className="text-xl font-bold text-primary">{result.yearsToFIRE} years</div>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-secondary-200">
              <div>
                <div className="font-semibold text-surface-900-900">Monthly Savings</div>
                <div className="text-sm text-surface-900-500">Current contribution</div>
              </div>
              <div className="text-xl font-bold text-green-600">{formatAmount(monthlySavings)}</div>
            </div>

            {result.monthlyContributionNeeded > 0 && (
              <div className="flex justify-between items-center py-3 border-b border-secondary-200">
                <div>
                  <div className="font-semibold text-surface-900-900">Additional Savings Needed</div>
                  <div className="text-sm text-surface-900-500">To reach target on time</div>
                </div>
                <div className="text-xl font-bold text-orange-600">+{formatAmount(result.monthlyContributionNeeded)}</div>
              </div>
            )}

            <div className="flex justify-between items-center py-3 border-b border-secondary-200">
              <div>
                <div className="font-semibold text-surface-900-900">Expected Return</div>
                <div className="text-sm text-surface-900-500">Before inflation</div>
              </div>
              <div className="text-xl font-bold text-blue-600">{expectedReturn}%</div>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-secondary-200">
              <div>
                <div className="font-semibold text-surface-900-900">Inflation Rate</div>
                <div className="text-sm text-surface-900-500">{country}</div>
              </div>
              <div className="text-xl font-bold text-red-600">{inflationRate}%</div>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-secondary-200">
              <div>
                <div className="font-semibold text-surface-900-900">Real Return</div>
                <div className="text-sm text-surface-900-500">After inflation</div>
              </div>
              <div className="text-xl font-bold text-teal-600">{(expectedReturn - inflationRate).toFixed(1)}%</div>
            </div>

            <div className="flex justify-between items-center py-3 bg-blue-50 rounded-lg px-4">
              <div className="font-bold text-surface-900-900">Annual Expenses Covered</div>
              <div className="text-xl font-bold text-blue-700">{formatAmount(annualExpenses)}</div>
            </div>
          </div>
        </div>

        {/* Info Notes */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">ℹ️ Important Notes:</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• The 4% rule is a guideline - actual safe withdrawal rate may vary</li>
            <li>• Inflation rate is based on {country} historical averages</li>
            <li>• Real returns account for inflation: {expectedReturn}% - {inflationRate}% = {(expectedReturn - inflationRate).toFixed(1)}%</li>
            <li>• Probability of success increases with larger safety margin (125%+ of target)</li>
            <li>• Consider healthcare costs, taxes, and unexpected expenses</li>
            <li>• Past performance doesn't guarantee future returns</li>
          </ul>
        </div>
      </div>
      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-500">⚠️ Disclaimer:</strong> This FIRE calculator provides approximate projections for informational purposes only and does not constitute financial advice. Actual results may vary significantly based on market conditions, tax implications, and personal circumstances. Consult a qualified financial advisor before making retirement decisions. No data is saved.
        </p>
      </div>
    </div>
  );
}
