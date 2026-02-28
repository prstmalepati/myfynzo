import { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';

interface ScenarioProjection {
  age: number;
  bestCase: number;
  expectedCase: number;
  worstCase: number;
}

interface LifeEvent {
  age: number;
  description: string;
  impact: number;
  type: 'expense' | 'income' | 'windfall';
}

export default function WealthProjection() {
  const { formatAmount, formatCompact } = useCurrency();
  
  // Inputs
  const [currentAge, setCurrentAge] = useState(0);
  const [projectionAge, setProjectionAge] = useState(0);
  const [currentNetWorth, setCurrentNetWorth] = useState(0);
  const [monthlySavings, setMonthlySavings] = useState(0);
  const [annualIncome, setAnnualIncome] = useState(0);
  const [incomeGrowth, setIncomeGrowth] = useState(3);
  const [savingsRate, setSavingsRate] = useState(30);
  
  // Return scenarios
  const [bestCaseReturn, setBestCaseReturn] = useState(10);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [worstCaseReturn, setWorstCaseReturn] = useState(4);
  
  // Life events
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([
    { age: 35, description: 'Home Purchase', impact: -100000, type: 'expense' },
    { age: 40, description: 'Career Promotion', impact: 20000, type: 'income' },
    { age: 45, description: 'Inheritance', impact: 150000, type: 'windfall' }
  ]);

  const [newEventAge, setNewEventAge] = useState(currentAge);
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventImpact, setNewEventImpact] = useState(0);
  const [newEventType, setNewEventType] = useState<'expense' | 'income' | 'windfall'>('expense');

  const calculateProjection = (returnRate: number): ScenarioProjection[] => {
    const projections: ScenarioProjection[] = [];
    const years = projectionAge - currentAge;
    
    let balance = currentNetWorth;
    let currentIncome = annualIncome;
    let currentSavings = monthlySavings;
    
    const monthlyReturn = Math.pow(1 + returnRate / 100, 1 / 12) - 1;
    
    for (let year = 0; year <= years; year++) {
      const age = currentAge + year;
      
      // Check for life events at this age
      const eventsThisYear = lifeEvents.filter(e => e.age === age);
      
      if (year > 0) {
        // Add monthly savings throughout the year
        for (let month = 0; month < 12; month++) {
          balance = balance * (1 + monthlyReturn) + currentSavings;
        }
        
        // Apply life events
        eventsThisYear.forEach(event => {
          if (event.type === 'expense' || event.type === 'windfall') {
            balance += event.impact;
          } else if (event.type === 'income') {
            currentIncome += event.impact;
            currentSavings = (currentIncome * (savingsRate / 100)) / 12;
          }
        });
        
        // Increase income and savings
        if (eventsThisYear.filter(e => e.type === 'income').length === 0) {
          currentIncome *= (1 + incomeGrowth / 100);
          currentSavings = (currentIncome * (savingsRate / 100)) / 12;
        }
      }
      
      projections.push({
        age,
        bestCase: 0,
        expectedCase: balance,
        worstCase: 0
      });
    }
    
    return projections;
  };

  // Calculate all three scenarios
  const bestCase = calculateProjection(bestCaseReturn);
  const expected = calculateProjection(expectedReturn);
  const worstCase = calculateProjection(worstCaseReturn);
  
  // Combine into single array
  const projections: ScenarioProjection[] = expected.map((exp, i) => ({
    age: exp.age,
    bestCase: bestCase[i].expectedCase,
    expectedCase: exp.expectedCase,
    worstCase: worstCase[i].expectedCase
  }));

  const finalProjection = projections[projections.length - 1];
  const maxValue = Math.max(...projections.map(p => p.bestCase));

  const addLifeEvent = () => {
    if (newEventDesc && newEventImpact !== 0) {
      setLifeEvents([...lifeEvents, {
        age: newEventAge,
        description: newEventDesc,
        impact: newEventImpact,
        type: newEventType
      }].sort((a, b) => a.age - b.age));
      
      // Reset form
      setNewEventDesc('');
      setNewEventImpact(0);
      setNewEventAge(currentAge);
    }
  };

  const removeLifeEvent = (index: number) => {
    setLifeEvents(lifeEvents.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-3xl font-bold text-surface-900 mb-6 flex items-center gap-3">
        <span className="text-4xl">💰</span>
        Wealth Projection
      </h2>
      <p className="text-surface-900-500 mb-8">Multi-scenario wealth projection with life events</p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column - Inputs */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-secondary-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-surface-900 mb-4">Basic Information</h3>
            
            <div className="space-y-4">
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
                <label className="block text-sm font-semibold text-surface-900-700 mb-2">Projection Until Age</label>
                <input
                  type="number"
                  value={projectionAge}
                  onChange={(e) => setProjectionAge(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

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
                <label className="block text-sm font-semibold text-surface-900-700 mb-2">Annual Income</label>
                <input
                  type="number"
                  value={annualIncome}
                  onChange={(e) => setAnnualIncome(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-900-700 mb-2">Income Growth (%/year)</label>
                <input
                  type="number"
                  value={incomeGrowth}
                  onChange={(e) => setIncomeGrowth(Number(e.target.value))}
                  step="0.1"
                  className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-900-700 mb-2">Savings Rate (% of income)</label>
                <input
                  type="number"
                  value={savingsRate}
                  onChange={(e) => setSavingsRate(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>
          </div>

          {/* Return Scenarios */}
          <div className="bg-secondary-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-surface-900 mb-4">Return Scenarios</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-green-700 mb-2">Best Case Return (%)</label>
                <input
                  type="number"
                  value={bestCaseReturn}
                  onChange={(e) => setBestCaseReturn(Number(e.target.value))}
                  step="0.1"
                  className="w-full px-4 py-3 border-2 border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-2">Expected Return (%)</label>
                <input
                  type="number"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(Number(e.target.value))}
                  step="0.1"
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-red-700 mb-2">Worst Case Return (%)</label>
                <input
                  type="number"
                  value={worstCaseReturn}
                  onChange={(e) => setWorstCaseReturn(Number(e.target.value))}
                  step="0.1"
                  className="w-full px-4 py-3 border-2 border-red-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Life Events */}
          <div className="bg-secondary-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-surface-900 mb-4">Life Events</h3>
            
            {/* Existing Events */}
            <div className="space-y-2 mb-4">
              {lifeEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold text-surface-900-900">
                      {event.type === 'expense' && '💸'} 
                      {event.type === 'income' && '💰'} 
                      {event.type === 'windfall' && '🎁'} 
                      {' '}{event.description}
                    </div>
                    <div className="text-sm text-surface-900-500">
                      Age {event.age} • {event.impact >= 0 ? '+' : ''}{formatAmount(event.impact)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeLifeEvent(index)}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Event */}
            <div className="space-y-3 pt-4 border-t border-secondary-200">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-surface-900-700 mb-1">Age</label>
                  <input
                    type="number"
                    value={newEventAge}
                    onChange={(e) => setNewEventAge(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-900-700 mb-1">Type</label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as 'expense' | 'income' | 'windfall')}
                    className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income Change</option>
                    <option value="windfall">Windfall</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-900-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  placeholder="e.g., House purchase"
                  className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-900-700 mb-1">
                  {newEventType === 'income' ? 'Annual Income Change' : 'Amount'}
                </label>
                <input
                  type="number"
                  value={newEventImpact}
                  onChange={(e) => setNewEventImpact(Number(e.target.value))}
                  placeholder={newEventType === 'expense' ? 'Negative for expense' : 'Positive amount'}
                  className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <button
                onClick={addLifeEvent}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                Add Life Event
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border-2 border-green-200">
              <div className="text-xs font-semibold text-green-700 mb-1">Best Case</div>
              <div className="text-xl font-bold text-green-900">{formatCompact(finalProjection.bestCase)}</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
              <div className="text-xs font-semibold text-blue-700 mb-1">Expected</div>
              <div className="text-xl font-bold text-blue-900">{formatCompact(finalProjection.expectedCase)}</div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border-2 border-red-200">
              <div className="text-xs font-semibold text-red-700 mb-1">Worst Case</div>
              <div className="text-xl font-bold text-red-900">{formatCompact(finalProjection.worstCase)}</div>
            </div>
          </div>

          {/* Projection Chart */}
          <div className="bg-secondary-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-surface-900 mb-4">
              Wealth Projection Timeline
            </h3>
            
            <div className="space-y-2">
              {projections.filter((_, i) => i % Math.ceil(projections.length / 15) === 0 || i === projections.length - 1).map((proj) => {
                const hasEvent = lifeEvents.some(e => e.age === proj.age);
                const event = lifeEvents.find(e => e.age === proj.age);
                
                return (
                  <div key={proj.age}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-12 text-xs font-semibold text-surface-900-500">Age {proj.age}</div>
                      <div className="flex-1 h-12 relative bg-white rounded-lg overflow-hidden">
                        {/* Worst Case */}
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-200 to-red-300"
                          style={{ width: `${(proj.worstCase / maxValue) * 100}%` }}
                        />
                        
                        {/* Expected Case */}
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-300 to-blue-400"
                          style={{ width: `${(proj.expectedCase / maxValue) * 100}%` }}
                        />
                        
                        {/* Best Case */}
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-green-500"
                          style={{ width: `${(proj.bestCase / maxValue) * 100}%` }}
                        />
                        
                        {/* Value Label */}
                        <div className="absolute inset-0 flex items-center justify-end pr-2">
                          <span className="text-xs font-bold text-white drop-shadow-lg">
                            {formatCompact(proj.expectedCase)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Life Event Marker */}
                    {hasEvent && event && (
                      <div className="ml-14 mb-2">
                        <div className="inline-block px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-lg text-xs">
                          <span className="font-semibold">
                            {event.type === 'expense' && '💸'} 
                            {event.type === 'income' && '💰'} 
                            {event.type === 'windfall' && '🎁'} 
                            {' '}{event.description}
                          </span>
                          <span className="ml-2 text-yellow-800">
                            {event.impact >= 0 ? '+' : ''}{formatCompact(event.impact)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-500 rounded"></div>
                <span>Best ({bestCaseReturn}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-blue-300 to-blue-400 rounded"></div>
                <span>Expected ({expectedReturn}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-red-200 to-red-300 rounded"></div>
                <span>Worst ({worstCaseReturn}%)</span>
              </div>
            </div>
          </div>

          {/* Key Milestones */}
          <div className="bg-secondary-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-surface-900 mb-4">Key Milestones</h3>
            
            <div className="space-y-3">
              {[500000, 1000000, 2000000, 5000000].map(milestone => {
                const bestCaseAge = projections.find(p => p.bestCase >= milestone)?.age;
                const expectedAge = projections.find(p => p.expectedCase >= milestone)?.age;
                const worstCaseAge = projections.find(p => p.worstCase >= milestone)?.age;
                
                return (
                  <div key={milestone} className="p-4 bg-white rounded-lg">
                    <div className="font-bold text-surface-900-900 mb-2">{formatCompact(milestone)}</div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-green-700">
                        Best: {bestCaseAge ? `Age ${bestCaseAge}` : 'Not reached'}
                      </div>
                      <div className="text-blue-700">
                        Expected: {expectedAge ? `Age ${expectedAge}` : 'Not reached'}
                      </div>
                      <div className="text-red-700">
                        Worst: {worstCaseAge ? `Age ${worstCaseAge}` : 'Not reached'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Notes */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">ℹ️ About This Projection:</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Three scenarios show range of possible outcomes</li>
              <li>• Life events are applied at specified ages</li>
              <li>• Income growth of {incomeGrowth}% increases savings over time</li>
              <li>• Savings rate: {savingsRate}% of income</li>
              <li>• Does not account for taxes or unexpected events</li>
              <li>• Actual results will vary based on market conditions</li>
            </ul>
          </div>
        </div>
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
