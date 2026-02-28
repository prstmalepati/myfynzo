import { useState, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import { usePartner } from '../context/PartnerContext';
import { useTier } from '../hooks/useTier';
import SidebarLayout from '../components/SidebarLayout';
import PartnerToggle from '../components/PartnerToggle';
import SmartDateInput from '../components/SmartDateInput';
import { useToast } from '../context/ToastContext';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, setDoc, getDoc } from 'firebase/firestore';

interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  contributorUid: string;
  contributorName: string;
  note?: string;
}

interface Goal {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  notes: string;
  createdAt: Date;
  isShared?: boolean;
  sharedWith?: string;
  ownerUid?: string;
  ownerName?: string;
  contributions?: GoalContribution[];
  myContribution?: number;
  partnerContribution?: number;
  sourceGoalId?: string;
  sourceOwnerUid?: string;
}

export default function GoalTracker({ embedded }: { embedded?: boolean }) {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isFamily, isHouseholdView, isPartnerView, partnerUid, partnerName } = usePartner();
  const { isCouples } = useTier();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [partnerGoals, setPartnerGoals] = useState<Goal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionNote, setContributionNote] = useState('');
  const [showContributions, setShowContributions] = useState<string | null>(null);

  const [goalName, setGoalName] = useState('');
  const [category, setCategory] = useState('savings');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSharedGoal, setIsSharedGoal] = useState(false);

  const categories = [
    { id: 'savings', label: 'Emergency Fund', icon: '🛡️', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    { id: 'investment', label: 'Investment Goal', icon: '📈', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    { id: 'purchase', label: 'Major Purchase', icon: '🏠', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
    { id: 'travel', label: 'Travel', icon: '✈️', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
    { id: 'education', label: 'Education', icon: '🎓', bgColor: 'bg-teal-100', textColor: 'text-teal-700' },
    { id: 'retirement', label: 'Retirement', icon: '🏖️', bgColor: 'bg-red-100', textColor: 'text-red-700' },
    { id: 'debt', label: 'Debt Payoff', icon: '💳', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    { id: 'family', label: 'Family Goal', icon: '👨‍👩‍👧‍👦', bgColor: 'bg-pink-100', textColor: 'text-pink-700' },
    { id: 'other', label: 'Other', icon: '🎯', bgColor: 'bg-slate-100', textColor: 'text-slate-700' }
  ];

  useEffect(() => { loadGoals(); }, [user]);
  useEffect(() => { if (isFamily && partnerUid) loadPartnerGoals(); }, [user, isFamily, partnerUid]);

  const loadGoals = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'goals'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() })) as Goal[];
      setGoals(data.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()));
    } catch (err) { console.error('Error loading goals:', err); }
    finally { setPageLoading(false); }
  };

  const loadPartnerGoals = async () => {
    if (!user || !partnerUid) return;
    try {
      const snap = await getDocs(collection(db, 'users', partnerUid, 'goals'));
      const data = snap.docs.map(d => ({
        id: d.id, ...d.data(), ownerUid: partnerUid, ownerName: partnerName || 'Partner',
        createdAt: d.data().createdAt?.toDate() || new Date()
      })) as Goal[];
      setPartnerGoals(data.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()));
    } catch (err) { console.error('Error loading partner goals:', err); }
  };

  const displayGoals = (() => {
    if (!isFamily) return goals;
    if (isPartnerView) return partnerGoals;
    if (isHouseholdView) {
      const partnerFiltered = partnerGoals.filter(pg => !(pg.isShared && pg.sharedWith === user?.uid));
      return [...goals, ...partnerFiltered.map(g => ({ ...g, ownerUid: partnerUid || '', ownerName: partnerName || 'Partner' }))];
    }
    return goals;
  })();

  const handleAddGoal = async () => {
    if (!user || !goalName || !targetAmount || !targetDate) { showToast('Please fill in all required fields', 'error'); return; }
    try {
      const goalData: any = { name: goalName, category, targetAmount: Number(targetAmount), currentAmount: Number(currentAmount) || 0, targetDate, notes, createdAt: new Date() };
      if (isSharedGoal && isFamily && partnerUid) {
        goalData.isShared = true;
        goalData.sharedWith = partnerUid;
        goalData.ownerUid = user.uid;
        goalData.ownerName = user.displayName || user.email?.split('@')[0] || 'You';
      }
      if (editingGoal) {
        await updateDoc(doc(db, 'users', user.uid, 'goals', editingGoal.id), goalData);
        showToast('Goal updated', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'goals'), goalData);
        // If shared, create mirror reference in partner's goals
        if (isSharedGoal && partnerUid) {
          try {
            await setDoc(doc(db, 'users', partnerUid, 'goals', `shared_${docRef.id}`), {
              ...goalData,
              sourceGoalId: docRef.id,
              sourceOwnerUid: user.uid,
            });
          } catch (mirrorErr) { console.warn('Mirror creation failed:', mirrorErr); }
        }
        showToast(isSharedGoal ? 'Shared goal created!' : 'Goal created', 'success');
      }
      resetForm(); loadGoals(); if (isFamily && partnerUid) loadPartnerGoals(); setShowAddModal(false);
    } catch (err) { console.error('Error saving goal:', err); showToast('Failed to save goal', 'error'); }
  };

  const handleContribute = async () => {
    if (!user || !contributingGoal || !contributionAmount) return;
    const amount = Number(contributionAmount);
    if (amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    try {
      const goalOwnerUid = contributingGoal.sourceOwnerUid || contributingGoal.ownerUid || user.uid;
      const goalId = contributingGoal.sourceGoalId || (contributingGoal.id.startsWith('shared_') ? contributingGoal.id.replace('shared_', '') : contributingGoal.id);

      const contribution = {
        amount, date: new Date().toISOString(),
        contributorUid: user.uid,
        contributorName: user.displayName || user.email?.split('@')[0] || 'You',
        note: contributionNote || '',
      };

      // Add contribution and update amount on the source goal
      await addDoc(collection(db, 'users', goalOwnerUid, 'goals', goalId, 'contributions'), contribution);
      const goalRef = doc(db, 'users', goalOwnerUid, 'goals', goalId);
      const goalSnap = await getDoc(goalRef);
      if (goalSnap.exists()) {
        await updateDoc(goalRef, { currentAmount: (goalSnap.data().currentAmount || 0) + amount });
      }

      // Update mirror if it exists
      if (partnerUid) {
        try {
          const mirrorRef = doc(db, 'users', partnerUid === goalOwnerUid ? user.uid : partnerUid, 'goals', `shared_${goalId}`);
          const mirrorSnap = await getDoc(mirrorRef);
          if (mirrorSnap.exists()) {
            await updateDoc(mirrorRef, { currentAmount: (mirrorSnap.data().currentAmount || 0) + amount });
          }
        } catch {}
      }

      showToast(`Contributed ${formatAmount(amount)}!`, 'success');
      setContributingGoal(null); setContributionAmount(''); setContributionNote('');
      loadGoals(); if (isFamily && partnerUid) loadPartnerGoals();
    } catch (err) { console.error('Contribution error:', err); showToast('Failed to contribute', 'error'); }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user || !confirm('Are you sure you want to delete this goal?')) return;
    try { await deleteDoc(doc(db, 'users', user.uid, 'goals', goalId)); showToast('Goal deleted', 'success'); loadGoals(); }
    catch (err) { console.error('Error deleting goal:', err); showToast('Failed to delete goal', 'error'); }
  };

  const handleEditGoal = (goal: Goal) => {
    if (goal.ownerUid && goal.ownerUid !== user?.uid) return;
    setEditingGoal(goal); setGoalName(goal.name); setCategory(goal.category);
    setTargetAmount(goal.targetAmount.toString()); setCurrentAmount(goal.currentAmount.toString());
    setTargetDate(goal.targetDate); setNotes(goal.notes); setIsSharedGoal(goal.isShared || false);
    setShowAddModal(true);
  };

  const resetForm = () => { setEditingGoal(null); setGoalName(''); setCategory('savings'); setTargetAmount(''); setCurrentAmount(''); setTargetDate(''); setNotes(''); setIsSharedGoal(false); };

  const getCategoryInfo = (id: string) => categories.find(c => c.id === id) || categories[categories.length - 1];
  const calcProgress = (cur: number, target: number) => Math.min(100, (cur / target) * 100);
  const calcDaysLeft = (td: string) => Math.ceil((new Date(td).getTime() - Date.now()) / 86400000);

  const totalTarget = displayGoals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrent = displayGoals.reduce((s, g) => s + g.currentAmount, 0);
  const overallPct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
  const sharedCount = displayGoals.filter(g => g.isShared).length;

  const content = (
    <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Financial Goals</h1>
            <p className="text-sm text-slate-500 mt-1">Track progress toward your major financial milestones</p>
          </div>
          {!isPartnerView && (
            <button onClick={() => { resetForm(); setShowAddModal(true); }}
              className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Goal
            </button>
          )}
        </div>
      )}

      {!embedded && <PartnerToggle context="Track goals together" showHousehold />}

      {/* Summary Cards */}
      <div className={`grid ${isFamily ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-6`}>
        <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated">
          <div className="text-xs text-white/50 mb-1">Total Goal Amount</div>
          <div className="text-2xl font-bold tracking-tight tabular-nums">{formatAmount(totalTarget)}</div>
          <div className="text-xs text-white/40 mt-1">{displayGoals.length} goal{displayGoals.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
          <div className="text-xs text-slate-500 mb-1">Amount Saved</div>
          <div className="text-2xl font-bold text-secondary tracking-tight tabular-nums">{formatAmount(totalCurrent)}</div>
          <div className="text-xs text-slate-400 mt-1">{formatAmount(totalTarget - totalCurrent)} remaining</div>
        </div>
        <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
          <div className="text-xs text-slate-500 mb-1">Overall Progress</div>
          <div className="text-2xl font-bold text-secondary tracking-tight">{overallPct.toFixed(0)}%</div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(overallPct, 100)}%` }} />
          </div>
        </div>
        {isFamily && (
          <div className="rounded-2xl p-5 bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200/60 shadow-card">
            <div className="text-xs text-pink-600 mb-1">Shared Goals</div>
            <div className="text-2xl font-bold text-pink-700 tracking-tight">{sharedCount}</div>
            <div className="text-xs text-pink-400 mt-1">with {partnerName || 'partner'}</div>
          </div>
        )}
      </div>

      {/* Goals List */}
      {displayGoals.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-200/80 shadow-card">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="text-lg font-bold text-secondary mb-2">No Goals Yet</h3>
          <p className="text-sm text-slate-400 mb-6">{isPartnerView ? `${partnerName} hasn't created any goals yet` : 'Start by creating your first financial goal'}</p>
          {!isPartnerView && <button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">Create Your First Goal</button>}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {displayGoals.map(goal => {
            const cat = getCategoryInfo(goal.category);
            const pct = calcProgress(goal.currentAmount, goal.targetAmount);
            const days = calcDaysLeft(goal.targetDate);
            const overdue = days < 0;
            const nearDL = days < 30 && days >= 0;
            const isPartnerGoal = goal.ownerUid && goal.ownerUid !== user?.uid;
            const remaining = goal.targetAmount - goal.currentAmount;
            const moNeeded = days > 0 && remaining > 0 ? remaining / (days / 30) : 0;

            return (
              <div key={`${goal.ownerUid || 'self'}-${goal.id}`} className={`bg-white rounded-2xl p-5 border shadow-card hover:shadow-card-hover transition-all ${goal.isShared ? 'border-pink-200/60 ring-1 ring-pink-100' : 'border-slate-200/80 hover:border-primary/20'}`}>
                {goal.isShared && (
                  <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1 bg-pink-50 rounded-lg w-fit">
                    <span className="text-xs">👨‍👩‍👧‍👦</span>
                    <span className="text-[10px] font-semibold text-pink-600">Shared Goal {isPartnerGoal ? `· by ${goal.ownerName}` : '· by You'}</span>
                  </div>
                )}
                {isPartnerGoal && !goal.isShared && (
                  <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1 bg-blue-50 rounded-lg w-fit">
                    <span className="text-[10px] font-semibold text-blue-600">{goal.ownerName}'s Goal</span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${cat.bgColor} rounded-xl flex items-center justify-center text-2xl`}>{cat.icon}</div>
                    <div>
                      <h3 className="text-lg font-bold text-secondary mb-0.5">{goal.name}</h3>
                      <div className={`text-xs font-semibold ${cat.textColor}`}>{cat.label}</div>
                    </div>
                  </div>
                  {!isPartnerGoal && (
                    <div className="flex gap-1">
                      {goal.isShared && isFamily && (
                        <button onClick={() => { setContributingGoal(goal); setContributionAmount(''); setContributionNote(''); }}
                          className="p-1.5 hover:bg-pink-50 rounded-lg transition-colors text-pink-400 hover:text-pink-600" title="Contribute">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        </button>
                      )}
                      <button onClick={() => handleEditGoal(goal)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-primary">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                      </button>
                      <button onClick={() => handleDeleteGoal(goal.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-500">{formatAmount(goal.currentAmount)}</span>
                    <span className="font-bold text-primary">{formatAmount(goal.targetAmount)}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 rounded-full ${goal.isShared ? 'bg-gradient-to-r from-pink-400 to-rose-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-center mt-2"><span className="text-xs font-bold text-secondary">{pct.toFixed(1)}% complete</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[10px] text-slate-400 mb-1">Remaining</div>
                    <div className="text-sm font-bold text-secondary tabular-nums">{formatAmount(remaining)}</div>
                  </div>
                  <div className={`rounded-xl p-3 ${overdue ? 'bg-red-50' : nearDL ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                    <div className={`text-[10px] mb-1 ${overdue ? 'text-red-500' : nearDL ? 'text-amber-500' : 'text-emerald-500'}`}>Time Left</div>
                    <div className={`text-sm font-bold ${overdue ? 'text-red-600' : nearDL ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {overdue ? `${Math.abs(days)}d overdue` : `${days} days`}
                    </div>
                  </div>
                </div>

                {!overdue && moNeeded > 0 && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">💡</span>
                      <span className="text-[11px] text-blue-700">Save <strong>{formatAmount(moNeeded)}/mo</strong> to reach this goal on time</span>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Target:</span>
                    <span className="font-semibold text-secondary">{new Date(goal.targetDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                </div>
                {goal.notes && <div className="mt-2 pt-2 border-t border-slate-100"><div className="text-[10px] text-slate-400">{goal.notes}</div></div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-elevated flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 lg:p-8 pb-4 border-b border-slate-100 shrink-0">
              <h2 className="text-2xl font-bold text-secondary font-display">{editingGoal ? 'Edit Goal' : 'Create New Goal'}</h2>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 lg:p-8 pt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Goal Name *</label>
                <input type="text" value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="e.g., Emergency Fund, Down Payment"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                      className={`px-3 py-2 rounded-lg border-2 transition-all flex items-center gap-2 text-sm ${category === cat.id ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                      <span>{cat.icon}</span><span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Amount *</label>
                  <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="25000" min="0" step="100"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Amount</label>
                  <input type="number" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} placeholder="5000" min="0" step="100"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              </div>
              <SmartDateInput label="Target Date *" value={targetDate} onChange={setTargetDate} min={new Date().toISOString().split('T')[0]} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (Optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any notes..." rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              {isFamily && partnerUid && (
                <div className={`rounded-xl p-4 border-2 transition-all cursor-pointer ${isSharedGoal ? 'border-pink-300 bg-pink-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`} onClick={() => setIsSharedGoal(!isSharedGoal)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isSharedGoal ? 'bg-pink-100' : 'bg-slate-100'}`}>👨‍👩‍👧‍👦</div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${isSharedGoal ? 'text-pink-700' : 'text-slate-700'}`}>Share with {partnerName || 'Partner'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Both of you can contribute and track progress together</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all flex items-center ${isSharedGoal ? 'bg-pink-400 justify-end' : 'bg-slate-300 justify-start'}`}>
                      <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5" />
                    </div>
                  </div>
                </div>
              )}
              {targetAmount && currentAmount && (
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-primary text-sm">Progress Preview:</span>
                    <span className="text-xl font-bold text-primary">{calcProgress(Number(currentAmount) || 0, Number(targetAmount)).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${calcProgress(Number(currentAmount) || 0, Number(targetAmount))}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 lg:p-8 pt-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0">
              <button onClick={handleAddGoal} disabled={!goalName.trim() || !targetAmount || !targetDate}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${!goalName.trim() || !targetAmount || !targetDate ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'}`}>
                {editingGoal ? 'Update Goal' : isSharedGoal ? 'Create Shared Goal' : 'Create Goal'}
              </button>
              <button onClick={() => { setShowAddModal(false); resetForm(); }}
                className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {contributingGoal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setContributingGoal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-elevated p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${getCategoryInfo(contributingGoal.category).bgColor}`}>
                {getCategoryInfo(contributingGoal.category).icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-secondary">Contribute to Goal</h3>
                <p className="text-xs text-slate-400">{contributingGoal.name}</p>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500">{formatAmount(contributingGoal.currentAmount)} saved</span>
                <span className="font-bold text-primary">{formatAmount(contributingGoal.targetAmount)} target</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full" style={{ width: `${calcProgress(contributingGoal.currentAmount, contributingGoal.targetAmount)}%` }} />
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                <input type="number" value={contributionAmount} onChange={e => setContributionAmount(e.target.value)} placeholder="500" min="1"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:ring-2 focus:ring-pink-200 focus:border-pink-400 outline-none text-lg font-bold" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
                <input type="text" value={contributionNote} onChange={e => setContributionNote(e.target.value)} placeholder="e.g., Monthly savings"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-secondary focus:ring-2 focus:ring-pink-200 focus:border-pink-400 outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleContribute} disabled={!contributionAmount || Number(contributionAmount) <= 0}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${!contributionAmount || Number(contributionAmount) <= 0 ? 'bg-slate-200 text-slate-400' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/20'}`}>
                Contribute {contributionAmount ? formatAmount(Number(contributionAmount)) : ''}
              </button>
              <button onClick={() => setContributingGoal(null)} className="px-5 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50">Cancel</button>
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
      <div className="grid md:grid-cols-3 gap-4 mb-6">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100/80 rounded-2xl animate-pulse" />)}</div>
      <div className="h-64 bg-slate-100/60 rounded-2xl animate-pulse" />
    </div></SidebarLayout>
  );
  return <SidebarLayout>{content}</SidebarLayout>;
}
