import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { usePartner } from '../context/PartnerContext';
import SidebarLayout from '../components/SidebarLayout';
import PartnerToggle from '../components/PartnerToggle';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';

interface LifestyleItem {
  id: string;
  name: string;
  category: string;
  monthlyCost: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  notes: string;
}

// ── Living Expenses: essentials you must pay ──
const LIVING_CATEGORIES = [
  { id: 'rent', label: 'Rent / Mortgage', icon: '🏠', color: '#0f766e' },
  { id: 'electricity', label: 'Electricity', icon: '⚡', color: '#eab308' },
  { id: 'heating', label: 'Heating / Gas', icon: '🔥', color: '#ea580c' },
  { id: 'water', label: 'Water & Sewage', icon: '💧', color: '#0ea5e9' },
  { id: 'internet', label: 'Internet & Phone', icon: '📶', color: '#6366f1' },
  { id: 'municipality', label: 'Municipality / Gemeinde', icon: '🏛️', color: '#7c3aed' },
  { id: 'groceries', label: 'Groceries & Household', icon: '🛒', color: '#16a34a' },
  { id: 'transport', label: 'Transportation', icon: '🚗', color: '#2563eb' },
  { id: 'fuel', label: 'Fuel / Charging', icon: '⛽', color: '#f97316' },
  { id: 'publicTransport', label: 'Public Transport', icon: '🚇', color: '#0891b2' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', color: '#7c3aed' },
  { id: 'health', label: 'Health & Medical', icon: '🏥', color: '#dc2626' },
  { id: 'childcare', label: 'Childcare & Kids', icon: '👶', color: '#ec4899' },
  { id: 'education', label: 'Education & School', icon: '🎓', color: '#0891b2' },
  { id: 'maintenance', label: 'Home Maintenance', icon: '🔧', color: '#78716c' },
];

// ── Lifestyle Expenses: discretionary spending ──
const LIFESTYLE_CATEGORIES = [
  { id: 'dining', label: 'Dining & Takeaway', icon: '🍽️', color: '#ea580c' },
  { id: 'subscriptions', label: 'Subscriptions & Streaming', icon: '📱', color: '#f59e0b' },
  { id: 'entertainment', label: 'Entertainment & Events', icon: '🎬', color: '#8b5cf6' },
  { id: 'fitness', label: 'Fitness & Wellness', icon: '🏋️', color: '#14b8a6' },
  { id: 'clothing', label: 'Clothing & Personal Care', icon: '👕', color: '#a855f7' },
  { id: 'travel', label: 'Travel & Vacations', icon: '✈️', color: '#6366f1' },
  { id: 'hobbies', label: 'Hobbies & Leisure', icon: '🎨', color: '#06b6d4' },
  { id: 'pets', label: 'Pets & Animals', icon: '🐾', color: '#84cc16' },
  { id: 'gifts', label: 'Gifts & Celebrations', icon: '🎁', color: '#f43f5e' },
  { id: 'charity', label: 'Charity & Donations', icon: '💝', color: '#059669' },
  { id: 'other', label: 'Other Recurring', icon: '📋', color: '#6b7280' },
];

// Combined for lookups — keeps backward compat with old category IDs
const CATEGORIES = [...LIVING_CATEGORIES, ...LIFESTYLE_CATEGORIES];


export default function LifestyleBasket({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { activeProfile, isReadOnly, partnerUid, loadPartnerDocs, isPartnerView } = usePartner();

  const [items, setItems] = useState<LifestyleItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('rent');
  const [monthlyCost, setMonthlyCost] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [notes, setNotes] = useState('');

  useEffect(() => { if (user) loadItems(); }, [user, activeProfile]);

  const loadItems = async () => {
    if (!user) return;
    try {
      if (activeProfile === 'household' && partnerUid) {
        const [selfSnap, partnerDocs] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'lifestyleBasket')),
          loadPartnerDocs('lifestyleBasket'),
        ]);
        const all = [
          ...selfSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          ...partnerDocs,
        ] as LifestyleItem[];
        setItems(all);
      } else if (isPartnerView && partnerUid) {
        const snap = await getDocs(collection(db, 'users', partnerUid, 'lifestyleBasket'));
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LifestyleItem[]);
      } else {
        const snap = await getDocs(collection(db, 'users', user.uid, 'lifestyleBasket'));
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LifestyleItem[]);
      }
    } catch (err) { console.error('Error loading:', err); }
    finally { setPageLoading(false); }
  };

  const resetForm = () => {
    setItemName(''); setCategory('housing'); setMonthlyCost('');
    setFrequency('monthly'); setNotes(''); setEditingId(null);
  };

  const openEdit = (item: LifestyleItem) => {
    setItemName(item.name); setCategory(item.category);
    setMonthlyCost(String(item.monthlyCost)); setFrequency(item.frequency || 'monthly');
    setNotes(item.notes || ''); setEditingId(item.id); setShowModal(true);
  };

  const handleSave = async () => {
    if (!user || !itemName.trim() || !monthlyCost) return;
    setLoading(true);
    try {
      const data = {
        name: itemName.trim(), category, monthlyCost: Number(monthlyCost),
        frequency, notes: notes.trim(), updatedAt: new Date(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'users', user.uid, 'lifestyleBasket', editingId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'lifestyleBasket'), { ...data, createdAt: new Date() });
      }
      resetForm(); setShowModal(false); await loadItems();
    } catch (err) { console.error('Error saving:', err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'lifestyleBasket', id));
      setDeleteConfirmId(null); await loadItems();
    } catch (err) { console.error('Error deleting:', err); }
  };

  const annualCost = (item: LifestyleItem) => {
    if (item.frequency === 'yearly') return item.monthlyCost;
    if (item.frequency === 'quarterly') return item.monthlyCost * 4;
    return item.monthlyCost * 12;
  };

  const monthlyEquiv = (item: LifestyleItem) => {
    if (item.frequency === 'monthly') return item.monthlyCost;
    if (item.frequency === 'quarterly') return item.monthlyCost / 3;
    return item.monthlyCost / 12;
  };

  const totalAnnual = items.reduce((s, i) => s + annualCost(i), 0);
  const totalMonthly = items.reduce((s, i) => s + monthlyEquiv(i), 0);

  const categoryBreakdown = CATEGORIES.map(cat => {
    const catItems = items.filter(i => i.category === cat.id);
    const annual = catItems.reduce((s, i) => s + annualCost(i), 0);
    return { ...cat, items: catItems, annual, pct: totalAnnual > 0 ? (annual / totalAnnual) * 100 : 0 };
  }).filter(c => c.items.length > 0).sort((a, b) => b.annual - a.annual);

  const livingIds = new Set(LIVING_CATEGORIES.map(c => c.id));
  const totalLivingMonthly = items.filter(i => livingIds.has(i.category)).reduce((s, i) => s + monthlyEquiv(i), 0);
  const totalLifestyleMonthly = totalMonthly - totalLivingMonthly;

  const getCat = (id: string) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  if (pageLoading) {
    const skeleton = (
      <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
        <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" />
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
    return embedded ? skeleton : <SidebarLayout>{skeleton}</SidebarLayout>;
  }

  const content = (
    <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center ${embedded ? 'justify-end' : 'justify-between'} gap-4 mb-8 animate-fadeIn`}>
          {!embedded && (
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Lifestyle Basket</h1>
              <p className="text-sm text-slate-500 mt-1">Track your living expenses and lifestyle spending in one place</p>
            </div>
          )}
          {!isReadOnly && (
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Expense
            </button>
          )}
        </div>

        {/* Partner Toggle */}
        <PartnerToggle context="Track expenses per person" showHousehold />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated animate-slideUp">
            <div className="text-xs text-white/50 mb-1">Total Monthly</div>
            <div className="text-2xl font-bold tracking-tight">{formatAmount(totalMonthly)}</div>
            <div className="text-xs text-white/40 mt-1">{items.length} recurring item{items.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" />Living Expenses</div>
            <div className="text-2xl font-bold text-teal-700 tracking-tight">{formatAmount(totalLivingMonthly)}</div>
            <div className="text-xs text-slate-400 mt-1">{totalMonthly > 0 ? Math.round((totalLivingMonthly / totalMonthly) * 100) : 0}% of total</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" />Lifestyle Expenses</div>
            <div className="text-2xl font-bold text-violet-700 tracking-tight">{formatAmount(totalLifestyleMonthly)}</div>
            <div className="text-xs text-slate-400 mt-1">{totalMonthly > 0 ? Math.round((totalLifestyleMonthly / totalMonthly) * 100) : 0}% of total</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
            <div className="text-xs text-slate-500 mb-1">Annual Total</div>
            <div className="text-2xl font-bold text-secondary tracking-tight">{formatAmount(totalAnnual)}</div>
            <div className="text-xs text-slate-400 mt-1">{categoryBreakdown.length} active categories</div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-card">
            <div className="text-5xl mb-4">🛒</div>
            <h3 className="text-lg font-bold text-secondary mb-2">No expenses yet</h3>
            <p className="text-slate-400 text-sm mb-6">Add your recurring monthly, quarterly, or yearly expenses</p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
              Add Your First Expense
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Donut Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <h3 className="text-sm font-bold text-secondary mb-4">Expense Breakdown</h3>
              <div className="flex flex-col items-center gap-4">
                <svg viewBox="0 0 120 120" className="w-36 h-36">
                  {(() => {
                    let startAngle = 0;
                    return categoryBreakdown.map((cat) => {
                      const pct = cat.annual / totalAnnual;
                      const angle = pct * 360;
                      const endAngle = startAngle + angle;
                      const largeArc = angle > 180 ? 1 : 0;
                      const r = 50, cx = 60, cy = 60;
                      const x1 = cx + r * Math.cos((startAngle - 90) * Math.PI / 180);
                      const y1 = cy + r * Math.sin((startAngle - 90) * Math.PI / 180);
                      const x2 = cx + r * Math.cos((endAngle - 90) * Math.PI / 180);
                      const y2 = cy + r * Math.sin((endAngle - 90) * Math.PI / 180);
                      const path = categoryBreakdown.length === 1
                        ? `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx - 0.01},${cy - r} Z`
                        : `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
                      startAngle = endAngle;
                      return <path key={cat.id} d={path} fill={cat.color} opacity={0.85} />;
                    });
                  })()}
                  <circle cx="60" cy="60" r="30" fill="white" />
                  <text x="60" y="57" textAnchor="middle" className="text-[8px] fill-slate-400">Annual</text>
                  <text x="60" y="69" textAnchor="middle" className="text-[10px] fill-slate-800 font-bold">{formatAmount(totalAnnual)}</text>
                </svg>
                <div className="w-full space-y-2">
                  {categoryBreakdown.map(cat => (
                    <div key={cat.id} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs text-slate-600 flex-1 truncate">{cat.icon} {cat.label}</span>
                      <span className="text-xs font-bold text-slate-500">{cat.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Items by Category — grouped */}
            <div className="lg:col-span-2 space-y-3">
              {/* Living Expenses section */}
              {categoryBreakdown.filter(c => livingIds.has(c.id)).length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">Living Expenses</span>
                    <span className="text-xs text-slate-400">{formatAmount(totalLivingMonthly)}/mo</span>
                  </div>
                  {categoryBreakdown.filter(c => livingIds.has(c.id)).map(cat => (
                <div key={cat.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: cat.color + '15' }}>{cat.icon}</span>
                      <span className="text-sm font-bold text-secondary">{cat.label}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{cat.items.length}</span>
                    </div>
                    <span className="text-sm font-bold text-secondary">{formatAmount(cat.annual)}<span className="text-[10px] text-slate-400 font-normal">/yr</span></span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {cat.items.map(item => (
                      <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-secondary">{item.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>{formatAmount(item.monthlyCost)}/{item.frequency === 'monthly' ? 'mo' : item.frequency === 'quarterly' ? 'qtr' : 'yr'}</span>
                            {item.notes && <><span className="text-slate-200">·</span><span>{item.notes}</span></>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-secondary">{formatAmount(annualCost(item))}</div>
                            <div className="text-[10px] text-slate-400">/year</div>
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                            </button>
                            <button onClick={() => setDeleteConfirmId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
                </>
              )}

              {/* Lifestyle Expenses section */}
              {categoryBreakdown.filter(c => !livingIds.has(c.id)).length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-3">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Lifestyle Expenses</span>
                    <span className="text-xs text-slate-400">{formatAmount(totalLifestyleMonthly)}/mo</span>
                  </div>
                  {categoryBreakdown.filter(c => !livingIds.has(c.id)).map(cat => (
                    <div key={cat.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: cat.color + '15' }}>{cat.icon}</span>
                          <span className="text-sm font-bold text-secondary">{cat.label}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{cat.items.length}</span>
                        </div>
                        <span className="text-sm font-bold text-secondary">{formatAmount(cat.annual)}<span className="text-[10px] text-slate-400 font-normal">/yr</span></span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {cat.items.map(item => (
                          <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-secondary">{item.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                <span>{formatAmount(item.monthlyCost)}/{item.frequency === 'monthly' ? 'mo' : item.frequency === 'quarterly' ? 'qtr' : 'yr'}</span>
                                {item.notes && <><span className="text-slate-200">·</span><span>{item.notes}</span></>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-sm font-bold text-secondary">{formatAmount(annualCost(item))}</div>
                                <div className="text-[10px] text-slate-400">/year</div>
                              </div>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                                </button>
                                <button onClick={() => setDeleteConfirmId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirmId(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-elevated" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-secondary mb-2">Delete Expense</h3>
              <p className="text-slate-500 text-sm mb-6">Are you sure? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors">Delete</button>
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); resetForm(); }}>
            <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-elevated animate-slideUp" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-secondary font-display">{editingId ? 'Edit' : 'Add'} Expense</h2>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Category</label>
                  {/* Living Expenses */}
                  <div className="mb-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />Living Expenses
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {LIVING_CATEGORIES.map(cat => (
                        <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                          className={`p-1.5 rounded-xl border-2 text-center transition-all ${category === cat.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                          <div className="text-sm mb-0.5">{cat.icon}</div>
                          <div className="text-[8px] font-semibold text-secondary leading-tight">{cat.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Lifestyle Expenses */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />Lifestyle Expenses
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {LIFESTYLE_CATEGORIES.map(cat => (
                        <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                          className={`p-1.5 rounded-xl border-2 text-center transition-all ${category === cat.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                          <div className="text-sm mb-0.5">{cat.icon}</div>
                          <div className="text-[8px] font-semibold text-secondary leading-tight">{cat.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Expense Name</label>
                  <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g., Netflix, Car Insurance, Rent..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Amount</label>
                    <input type="number" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)} placeholder="0" min="0" step="0.01"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Frequency</label>
                    <select value={frequency} onChange={e => setFrequency(e.target.value as any)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10">
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                {monthlyCost && Number(monthlyCost) > 0 && (
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-primary">Annual Cost</span>
                      <span className="text-lg font-bold text-primary">{formatAmount(frequency === 'yearly' ? Number(monthlyCost) : frequency === 'quarterly' ? Number(monthlyCost) * 4 : Number(monthlyCost) * 12)}</span>
                    </div>
                    {frequency !== 'monthly' && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-slate-500">Monthly equiv.</span>
                        <span className="text-sm font-bold text-secondary">{formatAmount(frequency === 'yearly' ? Number(monthlyCost) / 12 : Number(monthlyCost) / 3)}</span>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary resize-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} disabled={loading || !itemName.trim() || !monthlyCost}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all text-white ${loading || !itemName.trim() || !monthlyCost ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'}`}>
                    {loading ? 'Saving...' : editingId ? 'Update Expense' : 'Add Expense'}
                  </button>
                  <button onClick={() => { setShowModal(false); resetForm(); }} className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );

  return embedded ? content : <SidebarLayout>{content}</SidebarLayout>;
}
