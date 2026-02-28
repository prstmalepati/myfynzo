import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase/config';
import { collection, addDoc, deleteDoc, doc, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import SidebarLayout from '../components/SidebarLayout';
import { useToast } from '../context/ToastContext';
import AntiPortfolioCard from '../components/AntiPortfolioCard';
import AddMistakeModal from '../components/AddMistakeModal';

export interface AntiPortfolioItem {
  id: string;
  title: string;
  category: 'crypto' | 'stocks' | 'real-estate' | 'business' | 'other';
  wouldHaveInvested: number;
  dateConsidered: Date;
  currentValue: number;
  reasoning: string;
  emotionalTrigger: 'fomo' | 'greed' | 'fear' | 'hype' | 'peer-pressure' | 'overconfidence';
  lessonsLearned: string;
  dodgedBullet: boolean;
  createdAt: Date;
}

export default function AntiPortfolio({ embedded }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { formatAmount, formatCompact, currency } = useCurrency();
  const { showToast } = useToast();
  const [items, setItems] = useState<AntiPortfolioItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user]);

  const loadItems = async () => {
    try {
      const itemsRef = collection(db, 'users', user.uid, 'anti_portfolio');
      const q = query(itemsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const loadedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateConsidered: doc.data().dateConsidered?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as AntiPortfolioItem[];

      setItems(loadedItems);
      setLoading(false);
    } catch (error) {
      console.error('Error loading anti-portfolio items:', error);
      setLoading(false);
    }
  };

  const handleAddItem = async (item: Omit<AntiPortfolioItem, 'id' | 'createdAt'>) => {
    try {
      const itemsRef = collection(db, 'users', user.uid, 'anti_portfolio');
      await addDoc(itemsRef, {
        ...item,
        dateConsidered: Timestamp.fromDate(item.dateConsidered),
        createdAt: Timestamp.now()
      });

      setShowAddModal(false);
      loadItems();
    } catch (error) {
      console.error('Error adding item:', error);
      showToast('Failed to add item. Please try again.');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Delete this anti-portfolio entry? This cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'anti_portfolio', itemId));
        loadItems();
      } catch (error) {
        console.error('Error deleting item:', error);
        showToast('Failed to delete item');
      }
    }
  };

  // Statistics
  const totalDodgedBullets = items.filter(i => i.dodgedBullet).length;
  const totalMissedGains = items.filter(i => !i.dodgedBullet).length;
  const totalWouldHaveInvested = items.reduce((sum, i) => sum + i.wouldHaveInvested, 0);
  const totalCurrentValue = items.reduce((sum, i) => sum + i.currentValue, 0);
  const netSaved = totalWouldHaveInvested - totalCurrentValue;

  const mostCommonTrigger = items.length > 0 
    ? items.reduce((acc, item) => {
        acc[item.emotionalTrigger] = (acc[item.emotionalTrigger] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  const topTrigger = Object.entries(mostCommonTrigger).sort((a, b) => b[1] - a[1])[0];

  const filteredItems = filterCategory === 'all' 
    ? items 
    : items.filter(i => i.category === filterCategory);

  const categories = [
    { value: 'all', label: 'All Categories', icon: '📊' },
    { value: 'crypto', label: 'Crypto', icon: '₿' },
    { value: 'stocks', label: 'Stocks', icon: '📈' },
    { value: 'real-estate', label: 'Real Estate', icon: '🏠' },
    { value: 'business', label: 'Business', icon: '💼' },
    { value: 'other', label: 'Other', icon: '🎯' }
  ];

  if (loading) {
    const loadingContent = (
        <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        </div>
    );
    if (embedded) return loadingContent;
    return <SidebarLayout>{loadingContent}</SidebarLayout>;
  }

  const content = (
      <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
        {/* Header — only standalone */}
        {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeIn">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Anti-Portfolio</h1>
            <p className="text-sm text-slate-500 mt-1">Track the investments you wisely avoided</p>
          </div>
        </div>
        )}

        {/* Statistics Dashboard */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {/* Net Impact */}
          <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated">
            <div className="text-xs text-white/50 mb-1">
              {netSaved > 0 ? 'Money Saved' : 'Gains Missed'}
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {formatCompact(Math.abs(netSaved))}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {netSaved > 0 ? 'Avoided losses' : 'Missed opportunities'}
            </div>
          </div>

          {/* Dodged Bullets */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
            <div className="text-xs text-slate-500 mb-1">Dodged Bullets</div>
            <div className="text-2xl font-bold text-secondary">{totalDodgedBullets}</div>
            <div className="text-xs text-emerald-500 mt-1">Smart decisions</div>
          </div>

          {/* Missed Gains */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
            <div className="text-xs text-slate-500 mb-1">Missed Gains</div>
            <div className="text-2xl font-bold text-secondary">{totalMissedGains}</div>
            <div className="text-xs text-amber-500 mt-1">Learning moments</div>
          </div>

          {/* Top Trigger */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
            <div className="text-xs text-slate-500 mb-1">Top Trigger</div>
            <div className="text-lg font-bold text-secondary capitalize">
              {topTrigger ? topTrigger[0].replace('-', ' ') : 'None yet'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {topTrigger ? `${topTrigger[1]} instances` : 'Add items to see'}
            </div>
          </div>
        </div>

        {/* Insights Card */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">🧠</div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-secondary mb-2">Behavioral Insights</h2>
                
                {netSaved > 0 ? (
                  <div className="space-y-1">
                    <p className="text-sm text-slate-600">
                      By avoiding {totalDodgedBullets} bad investment{totalDodgedBullets !== 1 ? 's' : ''}, 
                      you've saved <span className="font-bold text-primary">{formatAmount(netSaved)}</span>.
                    </p>
                    {topTrigger && (
                      <p className="text-blue-800">
                        Your most common trigger is <strong className="capitalize">{topTrigger[0].replace('-', ' ')}</strong>. 
                        Next time you feel this way, remember this anti-portfolio.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-blue-900">
                      You've identified {totalMissedGains} missed opportunity{totalMissedGains !== 1 ? 'ies' : 'y'}, 
                      worth about <strong>{formatAmount(Math.abs(netSaved))}</strong> in potential gains.
                    </p>
                    <p className="text-blue-800">
                      Remember: Missing gains is better than losing capital. Stay disciplined!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {items.length > 0 && (
          <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(cat.value)}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  filterCategory === cat.value
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-white border border-secondary-200 text-surface-900-700 hover:border-primary'
                }`}
              >
                <span className="mr-2">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredItems.length === 0 && items.length === 0 && (
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-12 border-2 border-dashed border-secondary-200 text-center">
            <div className="text-6xl mb-4">🛡️</div>
            <h3 className="text-2xl font-bold text-surface-900 mb-3">Start Your Anti-Portfolio</h3>
            <p className="text-surface-900-500 mb-6 max-w-lg mx-auto">
              Track investments you almost made but didn't. Learn from near-misses. Build discipline.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-8 py-4 bg-gradient-to-r from-primary to-teal-600 text-white rounded-xl hover:shadow-xl transition-all font-bold text-lg"
            >
              Add Your First Entry
            </button>

            {/* Examples */}
            <div className="mt-8 text-left max-w-2xl mx-auto">
              <div className="text-sm font-semibold text-surface-900-700 mb-3">Examples:</div>
              <div className="space-y-2 text-sm text-surface-900-500">
                <div className="flex items-start gap-2">
                  <span>💡</span>
                  <span>"Almost bought Bitcoin at $60K because of FOMO. It's now $35K. Saved $25K."</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>💡</span>
                  <span>"Friend pressured me into his startup. Would've invested $50K. Company failed."</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>💡</span>
                  <span>"Wanted to buy GameStop during meme stock craze. Thankfully didn't."</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        {filteredItems.length > 0 && (
          <div className="space-y-4">
            {filteredItems.map(item => (
              <AntiPortfolioCard
                key={item.id}
                item={item}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}

        {/* Floating Add Button */}
        {items.length > 0 && (
          <button
            onClick={() => setShowAddModal(true)}
            className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-primary to-teal-600 text-white rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center text-3xl font-bold z-50"
          >
            +
          </button>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <AddMistakeModal
            onAdd={handleAddItem}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </div>
  );

  if (embedded) return content;
  return <SidebarLayout>{content}</SidebarLayout>;
}
