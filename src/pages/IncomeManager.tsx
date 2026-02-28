import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { usePartner } from '../context/PartnerContext';
import SidebarLayout from '../components/SidebarLayout';
import PartnerToggle from '../components/PartnerToggle';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';

interface IncomeItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  taxType: string;
  notes: string;
}

const CATEGORIES = [
  { id: 'salary', label: 'Salary / Wages', icon: '💼', color: '#0f766e' },
  { id: 'freelance', label: 'Freelance / Contract', icon: '💻', color: '#2563eb' },
  { id: 'business', label: 'Business Income', icon: '🏢', color: '#7c3aed' },
  { id: 'rental', label: 'Rental Income', icon: '🏠', color: '#ea580c' },
  { id: 'dividends', label: 'Dividends', icon: '📈', color: '#16a34a' },
  { id: 'interest', label: 'Interest & Savings', icon: '🏦', color: '#0891b2' },
  { id: 'pension', label: 'Pension / Retirement', icon: '🧓', color: '#6366f1' },
  { id: 'government', label: 'Government Benefits', icon: '🏛️', color: '#dc2626' },
  { id: 'childBenefit', label: 'Child Benefits', icon: '👶', color: '#ec4899' },
  { id: 'bonus', label: 'Bonus / Commission', icon: '🎯', color: '#f59e0b' },
  { id: 'sideIncome', label: 'Side Income', icon: '⚡', color: '#8b5cf6' },
  { id: 'gifts', label: 'Gifts / Inheritance', icon: '🎁', color: '#f43f5e' },
  { id: 'other', label: 'Other Income', icon: '📋', color: '#6b7280' },
];

const getCat = (id: string) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export default function IncomeManager({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { formatAmount, currency } = useCurrency();
  const { activeProfile, profileLabel, isPartnerView, isReadOnly, partnerUid, loadPartnerDocs } = usePartner();

  const [items, setItems] = useState<IncomeItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('salary');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [taxType, setTaxType] = useState('net');
  const [notes, setNotes] = useState('');

  useEffect(() => { if (user) loadItems(); }, [user, activeProfile]);

  const loadItems = async () => {
    if (!user) return;
    setPageLoading(true);
    try {
      const sortFn = (a: IncomeItem, b: IncomeItem) => {
        const toM = (i: IncomeItem) => i.frequency === 'yearly' ? i.amount / 12 : i.frequency === 'quarterly' ? i.amount / 3 : i.amount;
        return toM(b) - toM(a);
      };
      if (activeProfile === 'household' && partnerUid) {
        const [selfSnap, partnerDocs] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'incomes')),
          loadPartnerDocs('incomes'),
        ]);
        const all = [
          ...selfSnap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeItem)),
          ...partnerDocs as IncomeItem[],
        ].sort(sortFn);
        setItems(all);
      } else if (isPartnerView && partnerUid) {
        const snap = await getDocs(collection(db, 'users', partnerUid, 'incomes'));
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeItem)).sort(sortFn));
      } else {
        const snap = await getDocs(collection(db, 'users', user.uid, 'incomes'));
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeItem)).sort(sortFn));
      }
    } catch (err) { console.error('Error loading incomes:', err); }
    finally { setPageLoading(false); }
  };

  const openEdit = (item: IncomeItem) => {
    setName(item.name); setCategory(item.category); setAmount(String(item.amount));
    setFrequency(item.frequency); setTaxType(item.taxType || 'net'); setNotes(item.notes || '');
    setEditingId(item.id); setShowModal(true);
  };

  const resetForm = () => {
    setName(''); setCategory('salary'); setAmount(''); setFrequency('monthly');
    setTaxType('net'); setNotes(''); setEditingId(null);
  };

  const handleSave = async () => {
    if (!user || !name.trim() || !amount) return;
    setLoading(true);
    try {
      const data = {
        name: name.trim(), category, amount: Number(amount), frequency,
        taxType, notes: notes.trim(), updatedAt: new Date(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'users', user.uid, 'incomes', editingId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'incomes'), { ...data, createdAt: new Date() });
      }
      await loadItems(); resetForm(); setShowModal(false);
    } catch (err) { console.error('Save error:', err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'incomes', id));
      setItems(prev => prev.filter(i => i.id !== id));
      setDeleteConfirmId(null);
    } catch (err) { console.error('Delete error:', err); }
  };

  const toMonthly = (i: IncomeItem) => i.frequency === 'yearly' ? i.amount / 12 : i.frequency === 'quarterly' ? i.amount / 3 : i.amount;
  const toAnnual = (i: IncomeItem) => i.frequency === 'yearly' ? i.amount : i.frequency === 'quarterly' ? i.amount * 4 : i.amount * 12;

  const totalMonthly = items.reduce((s, i) => s + toMonthly(i), 0);
  const totalAnnual = items.reduce((s, i) => s + toAnnual(i), 0);

  const categoryBreakdown = useMemo(() => {
    return CATEGORIES.map(cat => {
      const catItems = items.filter(i => i.category === cat.id);
      const monthly = catItems.reduce((s, i) => s + toMonthly(i), 0);
      return { ...cat, monthly, annual: monthly * 12, count: catItems.length };
    }).filter(c => c.count > 0).sort((a, b) => b.monthly - a.monthly);
  }, [items]);

  if (pageLoading) {
    const skeleton = (
      <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
        <div className="grid md:grid-cols-3 gap-4 mb-6">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
    return embedded ? skeleton : <SidebarLayout>{skeleton}</SidebarLayout>;
  }

  const content = (
    <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
        {/* Header */}
        <div className={`flex items-center ${embedded ? 'justify-end' : 'justify-between'} mb-6`}>
          {!embedded && (
            <div>
              <h1 className="text-2xl font-bold text-secondary font-display">Income Manager</h1>
              <p className="text-sm text-slate-500 mt-0.5">Track all income sources for accurate financial planning</p>
            </div>
          )}
          {!isReadOnly && (
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-teal-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Income
            </button>
          )}
        </div>

        {/* Partner Toggle */}
        {!embedded && <PartnerToggle context="Track income per person" showHousehold />}

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden">
            <div className="absolute top-[-30px] right-[-30px] w-[100px] h-[100px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Monthly Net Income</div>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{formatAmount(totalMonthly)}</div>
            <div className="text-[10px] text-white/30 mt-1">{items.length} source{items.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Annual Income</div>
            <div className="text-2xl font-bold text-secondary">{formatAmount(totalAnnual)}</div>
            <div className="text-[10px] text-slate-400 mt-1">{categoryBreakdown.length} categories</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Top Source</div>
            {categoryBreakdown.length > 0 ? (
              <>
                <div className="text-2xl font-bold text-secondary">{formatAmount(categoryBreakdown[0].monthly)}<span className="text-sm text-slate-400 font-normal">/mo</span></div>
                <div className="text-[10px] text-slate-400 mt-1">{categoryBreakdown[0].icon} {categoryBreakdown[0].label}</div>
              </>
            ) : (
              <div className="text-sm text-slate-400 mt-2">No income added yet</div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 mb-6">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Income by Category</h3>
            <div className="flex h-5 rounded-full overflow-hidden mb-4">
              {categoryBreakdown.map(cat => (
                <div key={cat.id} style={{ width: `${(cat.monthly / totalMonthly * 100)}%`, backgroundColor: cat.color }} title={`${cat.label}: ${formatAmount(cat.monthly)}/mo`} className="transition-all duration-500 first:rounded-l-full last:rounded-r-full" />
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {categoryBreakdown.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs text-slate-500 flex-1 truncate">{cat.icon} {cat.label}</span>
                  <span className="text-xs font-bold text-secondary">{(cat.monthly / totalMonthly * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Income Items */}
        {items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-card">
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-lg font-bold text-secondary mb-2">No income sources yet</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">Add your salary, freelance income, rental income, dividends, and more to build a complete financial picture.</p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="px-6 py-2.5 bg-gradient-to-r from-primary to-teal-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20">
              Add First Income
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const cat = getCat(item.category);
              const monthly = toMonthly(item);
              const pct = totalMonthly > 0 ? (monthly / totalMonthly * 100) : 0;
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 flex items-center gap-4 group hover:border-primary/20 hover:shadow-card-hover transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: cat.color + '12' }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-secondary truncate">{item.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase">{item.frequency}</span>
                      {item.taxType === 'gross' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">Gross</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{cat.label}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-secondary">{formatAmount(monthly)}<span className="text-[10px] text-slate-400 font-normal">/mo</span></div>
                    <div className="text-[10px] text-slate-400">{pct.toFixed(0)}% of total</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </button>
                    {deleteConfirmId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(item.id)} className="px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Delete</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 text-[10px] font-bold text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); resetForm(); }}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-elevated max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-secondary">{editingId ? 'Edit' : 'Add'} Income Source</h2>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 rounded-lg hover:bg-slate-100">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Income Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Software Engineer Salary, Apartment Rental..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Category</label>
                  <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto p-0.5">
                    {CATEGORIES.map(cat => (
                      <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          category === cat.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}>
                        <span>{cat.icon}</span>
                        <span className="truncate">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Amount ({currency})</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Frequency</label>
                    <select value={frequency} onChange={e => setFrequency(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-secondary bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10">
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Type</label>
                    <select value={taxType} onChange={e => setTaxType(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-secondary bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10">
                      <option value="net">Net (After Tax)</option>
                      <option value="gross">Gross (Before Tax)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Optional notes..."
                    rows={2}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none" />
                </div>

                {amount && (
                  <div className="bg-gradient-to-br from-primary/5 to-teal-500/5 border border-primary/10 rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-primary">{formatAmount(frequency === 'yearly' ? Number(amount) / 12 : frequency === 'quarterly' ? Number(amount) / 3 : Number(amount))}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Monthly</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-secondary">{formatAmount(frequency === 'yearly' ? Number(amount) : frequency === 'quarterly' ? Number(amount) * 4 : Number(amount) * 12)}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Annual</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={loading || !name.trim() || !amount}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary to-teal-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                  {loading ? 'Saving...' : editingId ? 'Update' : 'Add Income'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

  return embedded ? content : <SidebarLayout>{content}</SidebarLayout>;
}
