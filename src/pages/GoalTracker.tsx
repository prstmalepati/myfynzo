import { useState, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import SidebarLayout from '../components/SidebarLayout';
import SmartDateInput from '../components/SmartDateInput';
import { useToast } from '../context/ToastContext';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';

interface Goal {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  notes: string;
  createdAt: Date;
}

export default function GoalTracker({ embedded }: { embedded?: boolean }) {
  const { formatAmount, formatCompact } = useCurrency();
  const { showToast } = useToast();
  const { user } = useAuth();
  
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  
  // Form fields
  const [goalName, setGoalName] = useState('');
  const [category, setCategory] = useState('savings');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');

  const categories = [
    { id: 'savings', label: 'Emergency Fund', icon: '🛡️', bgColor: 'bg-blue-100', textColor: 'text-blue-700', progressFrom: 'from-blue-400', progressTo: 'to-blue-600' },
    { id: 'investment', label: 'Investment Goal', icon: '📈', bgColor: 'bg-green-100', textColor: 'text-green-700', progressFrom: 'from-green-400', progressTo: 'to-green-600' },
    { id: 'purchase', label: 'Major Purchase', icon: '🏠', bgColor: 'bg-purple-100', textColor: 'text-purple-700', progressFrom: 'from-purple-400', progressTo: 'to-purple-600' },
    { id: 'travel', label: 'Travel', icon: '✈️', bgColor: 'bg-orange-100', textColor: 'text-orange-700', progressFrom: 'from-orange-400', progressTo: 'to-orange-600' },
    { id: 'education', label: 'Education', icon: '🎓', bgColor: 'bg-teal-100', textColor: 'text-teal-700', progressFrom: 'from-teal-400', progressTo: 'to-teal-600' },
    { id: 'retirement', label: 'Retirement', icon: '🏖️', bgColor: 'bg-red-100', textColor: 'text-red-700', progressFrom: 'from-red-400', progressTo: 'to-red-600' },
    { id: 'debt', label: 'Debt Payoff', icon: '💳', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700', progressFrom: 'from-yellow-400', progressTo: 'to-yellow-600' },
    { id: 'other', label: 'Other', icon: '🎯', bgColor: 'bg-secondary-100', textColor: 'text-surface-900-700', progressFrom: 'from-slate-400', progressTo: 'to-slate-600' }
  ];

  useEffect(() => {
    loadGoals();
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;
    
    try {
      const goalsRef = collection(db, 'users', user.uid, 'goals');
      const snapshot = await getDocs(goalsRef);
      const goalsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Goal[];
      
      setGoals(goalsData.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()));
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setPageLoading(false);
    }
  };

  const handleAddGoal = async () => {
    if (!user || !goalName || !targetAmount || !targetDate) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const goalData = {
        name: goalName,
        category,
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount) || 0,
        targetDate,
        notes,
        createdAt: new Date()
      };

      if (editingGoal) {
        await updateDoc(doc(db, 'users', user.uid, 'goals', editingGoal.id), goalData);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'goals'), goalData);
      }

      resetForm();
      loadGoals();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('Failed to save goal. Please try again.');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user || !confirm('Are you sure you want to delete this goal?')) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'goals', goalId));
      loadGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal.');
    }
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setCategory(goal.category);
    setTargetAmount(goal.targetAmount.toString());
    setCurrentAmount(goal.currentAmount.toString());
    setTargetDate(goal.targetDate);
    setNotes(goal.notes);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEditingGoal(null);
    setGoalName('');
    setCategory('savings');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('');
    setNotes('');
  };

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(c => c.id === categoryId) || categories[categories.length - 1];
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min(100, (current / target) * 100);
  };

  const calculateDaysRemaining = (targetDate: string) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const totalTargetAmount = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalCurrentAmount = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const overallProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;

  const content = (
      <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
        {/* Header — only when standalone */}
        {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeIn">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Financial Goals</h1>
            <p className="text-sm text-slate-500 mt-1">Track progress toward your major financial milestones</p>
          </div>
          <button onClick={() => { resetForm(); setShowAddModal(true); }}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add Goal
          </button>
        </div>
        )}

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6 stagger">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated animate-slideUp">
            <div className="text-xs text-white/50 mb-1">Total Goal Amount</div>
            <div className="text-2xl font-bold tracking-tight">{formatAmount(totalTargetAmount)}</div>
            <div className="text-xs text-white/40 mt-1">{goals.length} active goal{goals.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
            <div className="text-xs text-slate-500 mb-1">Amount Saved</div>
            <div className="text-2xl font-bold text-secondary tracking-tight">{formatAmount(totalCurrentAmount)}</div>
            <div className="text-xs text-slate-400 mt-1">{formatAmount(totalTargetAmount - totalCurrentAmount)} remaining</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
            <div className="text-xs text-slate-500 mb-1">Overall Progress</div>
            <div className="text-2xl font-bold text-secondary tracking-tight">{overallProgress.toFixed(0)}%</div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(overallProgress, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Goals List */}
        {goals.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-slate-200/80 shadow-card">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-lg font-bold text-secondary mb-2">No Goals Yet</h3>
            <p className="text-sm text-slate-400 mb-6">Start by creating your first financial goal</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Create Your First Goal
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {goals.map(goal => {
              const categoryInfo = getCategoryInfo(goal.category);
              const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
              const daysRemaining = calculateDaysRemaining(goal.targetDate);
              const isOverdue = daysRemaining < 0;
              const isNearDeadline = daysRemaining < 30 && daysRemaining >= 0;

              return (
                <div key={goal.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-card-hover hover:border-primary/20 transition-all">
                  {/* Goal Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 ${categoryInfo.bgColor} rounded-xl flex items-center justify-center text-2xl`}>
                        {categoryInfo.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-secondary mb-0.5">{goal.name}</h3>
                        <div className={`text-xs font-semibold ${categoryInfo.textColor}`}>
                          {categoryInfo.label}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditGoal(goal)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-primary">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                      </button>
                      <button onClick={() => handleDeleteGoal(goal.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold text-slate-500">{formatAmount(goal.currentAmount)}</span>
                      <span className="font-bold text-primary">{formatAmount(goal.targetAmount)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-xs font-bold text-secondary">{progress.toFixed(1)}% complete</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400 mb-1">Remaining</div>
                      <div className="text-sm font-bold text-secondary">
                        {formatAmount(goal.targetAmount - goal.currentAmount)}
                      </div>
                    </div>
                    <div className={`rounded-xl p-3 ${
                      isOverdue ? 'bg-red-50' : isNearDeadline ? 'bg-amber-50' : 'bg-emerald-50'
                    }`}>
                      <div className={`text-[10px] mb-1 ${
                        isOverdue ? 'text-red-500' : isNearDeadline ? 'text-amber-500' : 'text-emerald-500'
                      }`}>Time Left</div>
                      <div className={`text-sm font-bold ${
                        isOverdue ? 'text-red-600' : isNearDeadline ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {isOverdue ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining} days`}
                      </div>
                    </div>
                  </div>

                  {/* Target Date */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Target:</span>
                      <span className="font-semibold text-secondary">
                        {new Date(goal.targetDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {goal.notes && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <div className="text-[10px] text-slate-400">{goal.notes}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit Goal Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => { setShowAddModal(false); resetForm(); }}>
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-elevated animate-slideUp flex flex-col"
              onClick={e => e.stopPropagation()}>

              {/* Fixed header */}
              <div className="flex justify-between items-center p-6 lg:p-8 pb-4 border-b border-slate-100 shrink-0">
                <h2 className="text-2xl font-bold text-secondary font-display">
                  {editingGoal ? 'Edit Goal' : 'Create New Goal'}
                </h2>
                <button type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 p-6 lg:p-8 pt-5 space-y-4">
                {/* Goal Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Goal Name *</label>
                  <input type="text" value={goalName} onChange={e => setGoalName(e.target.value)}
                    placeholder="e.g., Emergency Fund, Down Payment, Vacation"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>

                {/* Category — compact horizontal scroll on mobile, wrapping grid on desktop */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                        className={`px-3 py-2 rounded-lg border-2 transition-all flex items-center gap-2 text-sm ${
                          category === cat.id
                            ? 'border-primary bg-primary/10 font-semibold text-primary'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}>
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount fields side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Amount *</label>
                    <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
                      placeholder="25000" min="0" step="100"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Amount</label>
                    <input type="number" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)}
                      placeholder="5000" min="0" step="100"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                </div>

                {/* Target Date */}
                <div>
                  <SmartDateInput
                    label="Target Date *"
                    value={targetDate}
                    onChange={setTargetDate}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (Optional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Add any additional notes..." rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>

                {/* Preview */}
                {targetAmount && currentAmount && (
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-primary text-sm">Progress Preview:</span>
                      <span className="text-xl font-bold text-primary">
                        {calculateProgress(Number(currentAmount) || 0, Number(targetAmount)).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${calculateProgress(Number(currentAmount) || 0, Number(targetAmount))}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed footer — always visible */}
              <div className="flex gap-3 p-6 lg:p-8 pt-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0">
                <button type="button" onClick={handleAddGoal}
                  disabled={!goalName.trim() || !targetAmount || !targetDate}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    !goalName.trim() || !targetAmount || !targetDate
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98]'
                  }`}>
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </button>
                <button type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
  );

  if (embedded) return content;
  if (pageLoading) return (
    <SidebarLayout><div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="h-8 w-56 bg-slate-200/60 rounded-lg mb-2 animate-pulse" />
      <div className="h-4 w-80 bg-slate-100 rounded mb-6 animate-pulse" />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100/80 rounded-2xl animate-pulse" />)}
      </div>
      <div className="h-64 bg-slate-100/60 rounded-2xl animate-pulse" />
    </div></SidebarLayout>
  );

  return <SidebarLayout>{content}</SidebarLayout>;
}
