import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLocale } from '../context/LocaleContext';
import { db } from '../firebase/config';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import SidebarLayout from '../components/SidebarLayout';
import SmartDateInput from '../components/SmartDateInput';
import { useToast } from '../context/ToastContext';

const DEBT_CATEGORIES = [
  { id: 'mortgage', label: 'Mortgage', icon: '🏠', color: '#ef4444' },
  { id: 'auto', label: 'Auto Loan', icon: '🚗', color: '#f97316' },
  { id: 'student', label: 'Student Loan', icon: '🎓', color: '#8b5cf6' },
  { id: 'credit_card', label: 'Credit Card', icon: '💳', color: '#ec4899' },
  { id: 'personal', label: 'Personal', icon: '🏦', color: '#2563eb' },
  { id: 'other', label: 'Other', icon: '📋', color: '#6b7280' },
];

interface Debt {
  id: string;
  name: string;
  category: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
  lender: string;
  notes: string;
}

const emptyDebt: Omit<Debt, 'id'> = {
  name: '', category: 'mortgage', totalAmount: 0, remainingAmount: 0,
  interestRate: 0, monthlyPayment: 0, startDate: '', lender: '', notes: '',
};

export default function Debts({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { formatAmount, currency } = useCurrency();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Debt, 'id'>>(emptyDebt);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { if (user) loadDebts(); }, [user]);

  const loadDebts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'debts'));
      setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Debt)));
    } catch (err) { console.error('Error loading debts:', err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await setDoc(doc(db, 'users', user.uid, 'debts', editingId), { ...form, updatedAt: new Date() });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'debts'), { ...form, createdAt: new Date(), updatedAt: new Date() });
      }
      showToast(editingId ? 'Debt updated' : 'Debt added', 'success');
      setShowForm(false); setEditingId(null); setForm(emptyDebt); loadDebts();
    } catch (err) { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleEdit = (debt: Debt) => {
    setForm({
      name: debt.name, category: debt.category, totalAmount: debt.totalAmount,
      remainingAmount: debt.remainingAmount, interestRate: debt.interestRate,
      monthlyPayment: debt.monthlyPayment, startDate: debt.startDate,
      lender: debt.lender, notes: debt.notes,
    });
    setEditingId(debt.id); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'debts', id));
      showToast('Debt removed', 'success'); setDeleteConfirm(null); loadDebts();
    } catch (err) { showToast('Failed to delete', 'error'); }
  };

  const totalDebt = useMemo(() => debts.reduce((s, d) => s + (d.remainingAmount || 0), 0), [debts]);
  const totalOriginal = useMemo(() => debts.reduce((s, d) => s + (d.totalAmount || 0), 0), [debts]);
  const totalMonthly = useMemo(() => debts.reduce((s, d) => s + (d.monthlyPayment || 0), 0), [debts]);
  const totalPaidOff = totalOriginal - totalDebt;
  const paidPctAll = totalOriginal > 0 ? (totalPaidOff / totalOriginal) * 100 : 0;

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    debts.forEach(d => { map[d.category] = (map[d.category] || 0) + (d.remainingAmount || 0); });
    return DEBT_CATEGORIES.filter(c => map[c.id]).map(c => ({
      ...c, amount: map[c.id], pct: totalDebt > 0 ? (map[c.id] / totalDebt) * 100 : 0,
    }));
  }, [debts, totalDebt]);

  const getCat = (id: string) => DEBT_CATEGORIES.find(c => c.id === id) || DEBT_CATEGORIES[5];

  if (loading) {
    const skeleton = (
      <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
        <div className="grid sm:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
        {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse mb-3" />)}
      </div>
    );
    return embedded ? skeleton : <SidebarLayout>{skeleton}</SidebarLayout>;
  }

  const content = (
    <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
      {/* Header */}
      <div className={`flex items-center ${embedded ? 'justify-end' : 'justify-between'} mb-6 animate-fadeIn`}>
        {!embedded && (
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display tracking-tight">Debt Manager</h1>
            <p className="text-sm text-slate-500 mt-1">Track all debts in one place. Totals auto-sync to Wealth Projector.</p>
          </div>
        )}
          <button onClick={() => { setForm(emptyDebt); setEditingId(null); setShowForm(true); }}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add Debt
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-elevated relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
            <div className="text-xs text-white/50 mb-1">Total Remaining</div>
            <div className="text-2xl font-bold tracking-tight">{formatAmount(totalDebt)}</div>
            <div className="text-xs text-white/40 mt-1">{debts.length} debt{debts.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
            <div className="text-xs text-slate-500 mb-1">Monthly Payments</div>
            <div className="text-xl font-bold text-secondary">{formatAmount(totalMonthly)}</div>
            <div className="text-xs text-slate-400 mt-1">{formatAmount(totalMonthly * 12)}/yr</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
            <div className="text-xs text-slate-500 mb-1">Paid Off</div>
            <div className="text-xl font-bold text-emerald-600">{formatAmount(totalPaidOff)}</div>
            <div className="text-xs text-emerald-500 mt-1">{paidPctAll.toFixed(1)}% of original</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
            <div className="text-xs text-slate-500 mb-1">Debt-Free In</div>
            <div className="text-xl font-bold text-secondary">
              {totalMonthly > 0 ? `~${Math.ceil(totalDebt / (totalMonthly * 12))} yr` : '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">At current rate</div>
          </div>
        </div>

        {/* Breakdown */}
        {byCategory.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 mb-6">
            <h2 className="text-sm font-bold text-secondary mb-4">Debt by Category</h2>
            <div className="flex gap-6 items-center">
              <svg viewBox="0 0 120 120" className="w-28 h-28 flex-shrink-0">
                {(() => {
                  const r = 45, c = 2 * Math.PI * r;
                  let offset = 0;
                  return byCategory.map((cat, i) => {
                    const dash = (cat.pct / 100) * c;
                    const el = (<circle key={i} cx="60" cy="60" r={r} fill="none" stroke={cat.color} strokeWidth="14" strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />);
                    offset += dash;
                    return el;
                  });
                })()}
                <circle cx="60" cy="60" r="28" fill="white" />
                <text x="60" y="57" textAnchor="middle" className="text-[10px] fill-slate-400">Total</text>
                <text x="60" y="69" textAnchor="middle" className="text-[11px] fill-slate-800 font-bold">{debts.length}</text>
              </svg>
              <div className="flex-1 space-y-2">
                {byCategory.map((cat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs text-slate-600 flex-1">{cat.icon} {cat.label}</span>
                    <span className="text-xs font-bold text-secondary">{formatAmount(cat.amount)}</span>
                    <span className="text-[10px] text-slate-400 w-10 text-right">{cat.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Debt List */}
        {debts.length === 0 && !showForm ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-secondary mb-2">No debts recorded</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">Add your debts to track payoff progress and impact on net worth.</p>
            <button onClick={() => { setForm(emptyDebt); setShowForm(true); }}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all">
              Add Your First Debt
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debt</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Original</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Remaining</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly</th>
                    <th className="text-center py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map(debt => {
                    const cat = getCat(debt.category);
                    const paidPct = debt.totalAmount > 0 ? ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100 : 0;
                    return (
                      <tr key={debt.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: cat.color + '15' }}>{cat.icon}</div>
                            <div>
                              <div className="font-semibold text-secondary text-sm">{debt.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                <span style={{ color: cat.color }} className="font-semibold">{cat.label}</span>
                                {debt.lender && <><span>·</span><span>{debt.lender}</span></>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-4 px-5 text-sm text-slate-500">{formatAmount(debt.totalAmount)}</td>
                        <td className="text-right py-4 px-5 text-sm font-semibold text-amber-600">{formatAmount(debt.remainingAmount)}</td>
                        <td className="text-right py-4 px-5 text-sm text-slate-600">{debt.interestRate > 0 ? `${debt.interestRate}%` : '—'}</td>
                        <td className="text-right py-4 px-5 text-sm font-semibold text-secondary">{formatAmount(debt.monthlyPayment)}</td>
                        <td className="py-4 px-5">
                          <div className="w-full">
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-0.5">
                              <div className="h-full rounded-full transition-all" style={{ width: `${paidPct}%`, backgroundColor: cat.color }} />
                            </div>
                            <div className="text-[10px] text-slate-400 text-center">{paidPct.toFixed(0)}% paid</div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(debt)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                            </button>
                            {deleteConfirm === debt.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDelete(debt.id)} className="text-[10px] text-amber-700 font-bold px-2 py-1 bg-amber-50 rounded-lg hover:bg-amber-100">Delete</button>
                                <button onClick={() => setDeleteConfirm(null)} className="text-[10px] text-slate-400 px-2 py-1 rounded-lg hover:bg-slate-50">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirm(debt.id)} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {debts.map(debt => {
                const cat = getCat(debt.category);
                const paidPct = debt.totalAmount > 0 ? ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100 : 0;
                return (
                  <div key={debt.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: cat.color + '15' }}>{cat.icon}</div>
                        <div>
                          <div className="font-bold text-secondary text-sm">{debt.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span style={{ color: cat.color }}>{cat.label}</span>
                            {debt.lender && <><span>·</span><span>{debt.lender}</span></>}
                            {debt.interestRate > 0 && <><span>·</span><span>{debt.interestRate}% APR</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(debt)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                        </button>
                        <button onClick={() => deleteConfirm === debt.id ? handleDelete(debt.id) : setDeleteConfirm(debt.id)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-[10px] text-slate-400">Remaining</div>
                        <div className="text-sm font-bold text-amber-600">{formatAmount(debt.remainingAmount)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Original</div>
                        <div className="text-sm font-semibold text-slate-600">{formatAmount(debt.totalAmount)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Monthly</div>
                        <div className="text-sm font-bold text-secondary">{formatAmount(debt.monthlyPayment)}</div>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${paidPct}%`, backgroundColor: cat.color }} />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{paidPct.toFixed(0)}% paid off</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Add/Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-elevated animate-slideUp" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-secondary font-display">{editingId ? 'Edit' : 'Add'} Debt</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white">
                    {DEBT_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Debt Name</label>
                  <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    placeholder="e.g. Home Mortgage, Car Loan..." />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Original Amount ({currency})</label>
                    <input type="number" value={form.totalAmount || ''} onChange={e => setForm(prev => ({ ...prev, totalAmount: Number(e.target.value) }))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" placeholder="Total borrowed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Remaining ({currency})</label>
                    <input type="number" value={form.remainingAmount || ''} onChange={e => setForm(prev => ({ ...prev, remainingAmount: Number(e.target.value) }))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" placeholder="Current balance" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Interest Rate (%)</label>
                    <input type="number" step="0.1" value={form.interestRate || ''} onChange={e => setForm(prev => ({ ...prev, interestRate: Number(e.target.value) }))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" placeholder="e.g. 3.5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Monthly Payment ({currency})</label>
                    <input type="number" value={form.monthlyPayment || ''} onChange={e => setForm(prev => ({ ...prev, monthlyPayment: Number(e.target.value) }))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Lender</label>
                    <input type="text" value={form.lender} onChange={e => setForm(prev => ({ ...prev, lender: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" placeholder="Bank / Institution" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <SmartDateInput label="Start Date" value={form.startDate} onChange={v => setForm(prev => ({ ...prev, startDate: v }))}
                      max={new Date().toISOString().split('T')[0]} compact />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary resize-none" placeholder="Optional notes..." />
                </div>
                {form.totalAmount > 0 && form.remainingAmount > 0 && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-amber-700">Progress</span>
                      <span className="text-sm font-bold text-amber-700">{((form.totalAmount - form.remainingAmount) / form.totalAmount * 100).toFixed(1)}% paid off</span>
                    </div>
                    {form.monthlyPayment > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Est. payoff</span>
                        <span className="text-xs font-semibold text-secondary">~{Math.ceil(form.remainingAmount / form.monthlyPayment)} months</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} disabled={saving || !form.name.trim()}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all text-white ${saving || !form.name.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'}`}>
                    {saving ? 'Saving...' : editingId ? 'Update Debt' : 'Add Debt'}
                  </button>
                  <button onClick={() => setShowForm(false)} disabled={saving}
                    className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  return embedded ? content : <SidebarLayout>{content}</SidebarLayout>;
}
