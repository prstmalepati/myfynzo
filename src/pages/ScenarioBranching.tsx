import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import SidebarLayout from '../components/SidebarLayout';
import { useToast } from '../context/ToastContext';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';

interface Scenario {
  id?: string;
  name: string;
  currentAge: number;
  targetAge: number;
  currentSavings: number;
  monthlyIncome: number;
  monthlySavings: number;
  expectedReturn: number;
  inflation: number;
  lifeEvents: LifeEvent[];
  color: string;
}

interface LifeEvent {
  id: string;
  age: number;
  type: 'income' | 'expense' | 'savings' | 'other';
  description: string;
  amount: number;
  recurring: boolean;
}

export default function ScenarioBranching({ embedded }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { formatAmount, formatCompact } = useCurrency();
  const { showToast } = useToast();
  
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  
  // Form state
  const [scenarioName, setScenarioName] = useState('');
  const [currentAge, setCurrentAge] = useState(30);
  const [targetAge, setTargetAge] = useState(65);
  const [currentSavings, setCurrentSavings] = useState(50000);
  const [monthlyIncome, setMonthlyIncome] = useState(5000);
  const [monthlySavings, setMonthlySavings] = useState(1000);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [inflation, setInflation] = useState(2.5);

  useEffect(() => {
    if (user) {
      loadScenarios();
    }
  }, [user]);

  const loadScenarios = async () => {
    if (!user) return;
    
    try {
      const scenariosRef = collection(db, 'users', user.uid, 'scenarios');
      const snapshot = await getDocs(scenariosRef);
      const scenariosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Scenario[];
      
      setScenarios(scenariosData);
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };

  const handleCreateScenario = async () => {
    if (!user || !scenarioName.trim()) return;

    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
    const color = colors[scenarios.length % colors.length];

    const newScenario: Scenario = {
      name: scenarioName.trim(),
      currentAge,
      targetAge,
      currentSavings,
      monthlyIncome,
      monthlySavings,
      expectedReturn,
      inflation,
      lifeEvents: [],
      color
    };

    try {
      const scenariosRef = collection(db, 'users', user.uid, 'scenarios');
      await addDoc(scenariosRef, newScenario);
      
      resetForm();
      setShowCreateModal(false);
      await loadScenarios();
    } catch (error) {
      console.error('Error creating scenario:', error);
      showToast('Failed to create scenario');
    }
  };

  const handleDeleteScenario = async (id: string) => {
    if (!user || !window.confirm('Delete this scenario?')) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'scenarios', id));
      await loadScenarios();
      setSelectedScenarios(prev => prev.filter(s => s !== id));
    } catch (error) {
      console.error('Error deleting scenario:', error);
    }
  };

  const resetForm = () => {
    setScenarioName('');
    setCurrentAge(30);
    setTargetAge(65);
    setCurrentSavings(50000);
    setMonthlyIncome(5000);
    setMonthlySavings(1000);
    setExpectedReturn(7);
    setInflation(2.5);
  };

  const calculateProjection = (scenario: Scenario) => {
    const years = scenario.targetAge - scenario.currentAge;
    const monthlyReturn = scenario.expectedReturn / 100 / 12;
    const months = years * 12;
    
    let balance = scenario.currentSavings;
    const yearlyBalances = [balance];

    for (let year = 1; year <= years; year++) {
      for (let month = 1; month <= 12; month++) {
        balance = balance * (1 + monthlyReturn) + scenario.monthlySavings;
      }
      yearlyBalances.push(balance);
    }

    return {
      finalBalance: balance,
      yearlyBalances,
      years
    };
  };

  const toggleScenarioSelection = (id: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(id)) {
        return prev.filter(s => s !== id);
      } else if (prev.length < 3) {
        return [...prev, id];
      }
      return prev;
    });
  };

  const content = (
      <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
        {/* Header — only standalone */}
        {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeIn">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Scenario Branching</h1>
            <p className="text-sm text-slate-500 mt-1">Model different life paths and compare financial outcomes</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Create Scenario
          </button>
        </div>
        )}

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
            <div className="text-sm opacity-90 mb-2">Total Scenarios</div>
            <div className="text-3xl lg:text-4xl font-bold">{scenarios.length}</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 text-white shadow-xl">
            <div className="text-sm opacity-90 mb-2">Comparing</div>
            <div className="text-3xl lg:text-4xl font-bold">{selectedScenarios.length}/3</div>
            <div className="text-xs opacity-75 mt-1">Select up to 3 scenarios</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl">
            <div className="text-sm opacity-90 mb-2">Best Scenario</div>
            <div className="text-2xl font-bold">
              {scenarios.length > 0 
                ? scenarios.reduce((best, s) => 
                    calculateProjection(s).finalBalance > calculateProjection(best).finalBalance ? s : best, 
                    scenarios[0]
                  ).name
                : 'None yet'
              }
            </div>
          </div>
        </div>

        {/* Scenarios List */}
        {scenarios.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border-2 border-dashed border-secondary-200">
            <div className="text-6xl mb-4">🌳</div>
            <h3 className="text-2xl font-bold text-surface-900 mb-2">No Scenarios Yet</h3>
            <p className="text-surface-900-500 mb-6">
              Create your first scenario to start exploring different financial paths
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              Create First Scenario
            </button>
          </div>
        ) : (
          <>
            {/* Scenario Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {scenarios.map(scenario => {
                const projection = calculateProjection(scenario);
                const isSelected = selectedScenarios.includes(scenario.id!);

                return (
                  <div 
                    key={scenario.id}
                    className={`bg-white rounded-2xl p-6 border-2 transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-primary shadow-xl scale-[1.02]' 
                        : 'border-secondary-200 hover:border-secondary-200'
                    }`}
                    onClick={() => toggleScenarioSelection(scenario.id!)}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${scenario.color}`}></div>
                        <div>
                          <h3 className="text-xl font-bold text-surface-900">{scenario.name}</h3>
                          <p className="text-sm text-surface-900-500">
                            Age {scenario.currentAge} → {scenario.targetAge} ({projection.years} years)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScenario(scenario.id!);
                        }}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-secondary-50 rounded-xl p-3">
                        <div className="text-xs text-surface-900-500 mb-1">Current Savings</div>
                        <div className="text-lg font-bold text-surface-900">
                          {formatCompact(scenario.currentSavings)}
                        </div>
                      </div>
                      <div className="bg-secondary-50 rounded-xl p-3">
                        <div className="text-xs text-surface-900-500 mb-1">Monthly Savings</div>
                        <div className="text-lg font-bold text-surface-900">
                          {formatCompact(scenario.monthlySavings)}
                        </div>
                      </div>
                      <div className="bg-secondary-50 rounded-xl p-3">
                        <div className="text-xs text-surface-900-500 mb-1">Expected Return</div>
                        <div className="text-lg font-bold text-green-600">
                          {scenario.expectedReturn}%
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 border-2 border-green-200">
                        <div className="text-xs text-green-700 mb-1">Final Balance</div>
                        <div className="text-lg font-bold text-green-700">
                          {formatCompact(projection.finalBalance)}
                        </div>
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="bg-primary/10 border-2 border-primary rounded-xl p-2 text-center">
                        <span className="text-primary font-semibold text-sm">
                          ✓ Selected for comparison
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Comparison View */}
            {selectedScenarios.length > 1 && (
              <div className="bg-white rounded-2xl p-8 border-2 border-primary">
                <h2 className="text-2xl font-bold text-surface-900 mb-6">
                  Scenario Comparison
                </h2>
                
                <div className="grid md:grid-cols-3 gap-6">
                  {selectedScenarios.map(id => {
                    const scenario = scenarios.find(s => s.id === id)!;
                    const projection = calculateProjection(scenario);

                    return (
                      <div key={id} className="border border-secondary-200 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`w-4 h-4 rounded-full ${scenario.color}`}></div>
                          <h3 className="font-bold text-surface-900">{scenario.name}</h3>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-surface-900-500">Final Balance</div>
                            <div className="text-2xl font-bold text-primary">
                              {formatAmount(projection.finalBalance)}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-surface-900-500">Total Contributions</div>
                            <div className="text-lg font-semibold text-surface-900-700">
                              {formatAmount(scenario.monthlySavings * projection.years * 12)}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-surface-900-500">Investment Gains</div>
                            <div className="text-lg font-semibold text-green-600">
                              {formatAmount(
                                projection.finalBalance - 
                                scenario.currentSavings - 
                                (scenario.monthlySavings * projection.years * 12)
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-surface-900-500">Return Rate</div>
                            <div className="text-lg font-semibold text-blue-600">
                              {scenario.expectedReturn}% / year
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Winner */}
                <div className="mt-8 bg-green-50 border-2 border-green-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-green-700 mb-1">🏆 Best Scenario</div>
                      <div className="text-2xl font-bold text-green-900">
                        {scenarios.find(s => s.id === selectedScenarios.reduce((best, id) => {
                          const scenario = scenarios.find(s => s.id === id)!;
                          const bestScenario = scenarios.find(s => s.id === best)!;
                          return calculateProjection(scenario).finalBalance > calculateProjection(bestScenario).finalBalance ? id : best;
                        }, selectedScenarios[0]))!.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-700 mb-1">Final Balance</div>
                      <div className="text-3xl font-bold text-green-900">
                        {formatCompact(Math.max(...selectedScenarios.map(id => {
                          const scenario = scenarios.find(s => s.id === id)!;
                          return calculateProjection(scenario).finalBalance;
                        })))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create Scenario Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-surface-900">Create New Scenario</h2>
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="text-surface-900-300 hover:text-surface-900-500 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                    Scenario Name *
                  </label>
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="e.g., Conservative Path, Aggressive Growth, Early Retirement"
                    className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                      Current Age
                    </label>
                    <input
                      type="number"
                      value={currentAge}
                      onChange={(e) => setCurrentAge(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                      Target Age
                    </label>
                    <input
                      type="number"
                      value={targetAge}
                      onChange={(e) => setTargetAge(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                    Current Savings (€)
                  </label>
                  <input
                    type="number"
                    value={currentSavings}
                    onChange={(e) => setCurrentSavings(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                      Monthly Income (€)
                    </label>
                    <input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                      Monthly Savings (€)
                    </label>
                    <input
                      type="number"
                      value={monthlySavings}
                      onChange={(e) => setMonthlySavings(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                      Expected Return (%)
                    </label>
                    <input
                      type="number"
                      value={expectedReturn}
                      onChange={(e) => setExpectedReturn(Number(e.target.value))}
                      step="0.1"
                      className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-surface-900-700 mb-2">
                      Inflation Rate (%)
                    </label>
                    <input
                      type="number"
                      value={inflation}
                      onChange={(e) => setInflation(Number(e.target.value))}
                      step="0.1"
                      className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateScenario}
                    disabled={!scenarioName.trim()}
                    className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-colors ${
                      !scenarioName.trim()
                        ? 'bg-secondary-300 text-surface-900-400 cursor-not-allowed'
                        : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                  >
                    Create Scenario
                  </button>
                  <button
                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                    className="px-6 py-3 border border-secondary-200 text-surface-900-700 rounded-xl font-semibold hover:bg-secondary-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) return content;
  return <SidebarLayout>{content}</SidebarLayout>;
}
