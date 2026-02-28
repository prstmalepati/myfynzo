import { useState, useEffect } from 'react';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../context/AuthContext';
import SidebarLayout from '../components/SidebarLayout';
import { db } from '../firebase/config';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ALL_TAX_RULES } from '../data/taxRules';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';

type Tab = 'overview' | 'users' | 'tax-rules' | 'market-prices' | 'pricing' | 'system';

export default function Admin() {
  const { isAdmin, adminLoading } = useAdmin();
  usePageTitle('Admin');
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState({ users: 0, investments: 0, goals: 0, debts: 0, mips: 0, assets: 0, cashAccounts: 0, freeUsers: 0, premiumUsers: 0, couplesUsers: 0, countriesMap: {} as Record<string, number>, verifiedUsers: 0, activeToday: 0, activeWeek: 0, waitlistUsers: [] as { email: string; plan: string; date: string; name: string }[] });
  const [users, setUsers] = useState<any[]>([]);
  const [cachedPrices, setCachedPrices] = useState<any[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  // Pricing management
  const CURRENCIES = ['EUR', 'GBP', 'INR', 'CHF'];
  const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', GBP: '£', INR: '₹', CHF: 'CHF' };
  const [pricingData, setPricingData] = useState<Record<string, { premium: { monthly: number; annual: number }; couples: { monthly: number; annual: number } }>>({
    EUR: { premium: { monthly: 5.99, annual: 59 },   couples: { monthly: 8.99, annual: 89 } },
    GBP: { premium: { monthly: 4.99, annual: 49 },   couples: { monthly: 7.99, annual: 79 } },
    INR: { premium: { monthly: 299,  annual: 2999 },  couples: { monthly: 599,  annual: 5999 } },
    CHF: { premium: { monthly: 5.99, annual: 59 },   couples: { monthly: 8.99, annual: 89 } },
  });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingDirty, setPricingDirty] = useState(false);

  useEffect(() => { if (isAdmin) loadDashboard(); }, [isAdmin]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      let usersData: any[] = [];
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      } catch (err) {
        console.warn('[Admin] Cannot list users — deploy firestore.rules with admin list permission.', err);
        if (user) { try { const myDoc = await getDoc(doc(db, 'users', user.uid)); if (myDoc.exists()) usersData = [{ uid: user.uid, ...myDoc.data() }]; } catch {} }
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
      const weekAgo = todayStart - 7 * 86400;
      let totalInv = 0, totalGoals = 0, totalDebts = 0, totalMips = 0, totalAssets = 0, totalCash = 0;
      let freeUsers = 0, premiumUsers = 0, couplesUsers = 0, verifiedUsers = 0, activeToday = 0, activeWeek = 0;
      const countriesMap: Record<string, number> = {};
      const waitlistUsers: { email: string; plan: string; date: string; name: string }[] = [];

      const enriched = await Promise.all(usersData.map(async (u) => {
        const tier = u.tier || 'free';
        if (tier === 'free') freeUsers++; else if (tier === 'premium') premiumUsers++; else if (tier === 'couples') couplesUsers++;
        if (u.emailVerified) verifiedUsers++;
        const country = u.country || 'Unknown';
        countriesMap[country] = (countriesMap[country] || 0) + 1;
        const lts = u.lastLogin?.seconds || 0;
        if (lts >= todayStart) activeToday++;
        if (lts >= weekAgo) activeWeek++;
        // Collect waitlist users
        if (u.premiumWaitlist) {
          const wlDate = u.premiumWaitlistAt?.seconds ? new Date(u.premiumWaitlistAt.seconds * 1000).toLocaleDateString() : '';
          waitlistUsers.push({ email: u.email || '—', plan: u.premiumWaitlist, date: wlDate, name: u.displayName || u.email?.split('@')[0] || '—' });
        }

        let inv = 0, mip = 0, goal = 0, debt = 0, asset = 0, cash = 0;
        try {
          const [a, b, c, d2, e, f] = await Promise.all([
            getDocs(collection(db, 'users', u.uid, 'investments')).catch(() => ({ size: 0 })),
            getDocs(collection(db, 'users', u.uid, 'monthlyInvestments')).catch(() => ({ size: 0 })),
            getDocs(collection(db, 'users', u.uid, 'goals')).catch(() => ({ size: 0 })),
            getDocs(collection(db, 'users', u.uid, 'debts')).catch(() => ({ size: 0 })),
            getDocs(collection(db, 'users', u.uid, 'physicalAssets')).catch(() => ({ size: 0 })),
            getDocs(collection(db, 'users', u.uid, 'cashSavings')).catch(() => ({ size: 0 })),
          ]);
          inv = a.size; mip = b.size; goal = c.size; debt = d2.size; asset = e.size; cash = f.size;
        } catch {}
        totalInv += inv; totalMips += mip; totalGoals += goal; totalDebts += debt; totalAssets += asset; totalCash += cash;
        return { ...u, investmentCount: inv, mipCount: mip, goalCount: goal, debtCount: debt, assetCount: asset, cashCount: cash };
      }));

      setUsers(enriched);
      setStats({ users: usersData.length, investments: totalInv, goals: totalGoals, debts: totalDebts, mips: totalMips, assets: totalAssets, cashAccounts: totalCash, freeUsers, premiumUsers, couplesUsers, countriesMap, verifiedUsers, activeToday, activeWeek, waitlistUsers });
      try { const ps = await getDocs(collection(db, 'market_prices')); setCachedPrices(ps.docs.map(d => ({ symbol: d.id, ...d.data() }))); } catch {}
      try { const ss = await getDoc(doc(db, 'system', 'api_keys')); if (ss.exists()) setSystemConfig(ss.data()); } catch {}
      try { const pd = await getDoc(doc(db, 'system', 'pricing')); if (pd.exists()) setPricingData(pd.data() as any); } catch {}
    } catch (err) { console.error('Admin load error:', err); } finally { setLoading(false); }
  };

  const updatePrice = (currency: string, tier: 'premium' | 'couples', period: 'monthly' | 'annual', value: number) => {
    setPricingData(prev => ({
      ...prev,
      [currency]: { ...prev[currency], [tier]: { ...prev[currency][tier], [period]: value } },
    }));
    setPricingDirty(true);
  };

  const savePricing = async () => {
    setPricingSaving(true);
    try {
      await setDoc(doc(db, 'system', 'pricing'), { ...pricingData, updatedAt: new Date() });
      showToast('Pricing saved — changes are live!', 'success');
      setPricingDirty(false);
    } catch (err: any) {
      showToast('Failed to save pricing: ' + err.message, 'error');
    } finally { setPricingSaving(false); }
  };

  const seedTaxRules = async () => {
    try { for (const rule of ALL_TAX_RULES) { await setDoc(doc(db, 'taxRules', `tax-${rule.countryCode.toLowerCase()}`), { ...rule, seededAt: new Date() }); } showToast('success', `Seeded ${ALL_TAX_RULES.length} tax rules`); } catch (e: any) { showToast('error', 'Failed: ' + e.message); }
  };
  const ts = (v: any) => { if (!v) return '—'; const d = v.seconds ? new Date(v.seconds * 1000) : new Date(v); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const tsRel = (v: any) => { if (!v) return '—'; const d = v.seconds ? new Date(v.seconds * 1000) : new Date(v); const s = (Date.now() - d.getTime()) / 1000; if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); };

  if (adminLoading || loading) return <SidebarLayout><div className="p-6 lg:p-8 max-w-7xl mx-auto"><div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" /><div className="grid sm:grid-cols-4 gap-4 mb-8">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}</div></div></SidebarLayout>;
  if (!isAdmin) return <SidebarLayout><div className="p-8 text-center"><h1 className="text-2xl font-bold text-secondary">Access Denied</h1><p className="text-slate-500 mt-2">Not authorised.</p></div></SidebarLayout>;

  const filtered = users.filter(u => {
    const mt = !userFilter || (u.email || '').toLowerCase().includes(userFilter.toLowerCase()) || (u.displayName || u.fullName || '').toLowerCase().includes(userFilter.toLowerCase());
    const tt = tierFilter === 'all' || (u.tier || 'free') === tierFilter;
    return mt && tt;
  });
  const totalDP = stats.investments + stats.mips + stats.goals + stats.debts + stats.assets + stats.cashAccounts;

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Admin Console</h1>
            <p className="text-sm text-slate-500 mt-1">Platform-wide analytics & management</p>
          </div>
          <button onClick={loadDashboard} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
            Refresh
          </button>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit overflow-x-auto">
          {(['overview', 'users', 'tax-rules', 'market-prices', 'pricing', 'system'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${tab === t ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-secondary'}`}>
              {t === 'tax-rules' ? 'Tax Rules' : t === 'market-prices' ? 'Prices' : t === 'pricing' ? '💰 Pricing' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ─── OVERVIEW ───────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {stats.users <= 1 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <div><div className="text-sm font-bold text-amber-800 mb-1">Only seeing your own data?</div><div className="text-xs text-amber-700">Deploy updated rules: <code className="bg-amber-100 px-1 rounded">firebase deploy --only firestore:rules</code></div></div>
              </div>
            )}

            {/* KPI Row 1 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated">
                <div className="text-xs text-white/50 mb-1">Total Users</div>
                <div className="text-3xl font-bold">{stats.users}</div>
                <div className="text-[10px] text-white/40 mt-1">{stats.verifiedUsers} verified</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Active Today</div>
                <div className="text-3xl font-bold text-secondary">{stats.activeToday}</div>
                <div className="text-[10px] text-slate-400 mt-1">{stats.activeWeek} this week</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Tier Breakdown</div>
                <div className="flex items-end gap-1.5 mt-1">
                  <span className="text-lg font-bold text-slate-400">{stats.freeUsers}</span><span className="text-[10px] text-slate-400 mb-0.5">free</span>
                  <span className="text-lg font-bold text-amber-600 ml-2">{stats.premiumUsers}</span><span className="text-[10px] text-amber-600 mb-0.5">pro</span>
                  <span className="text-lg font-bold text-purple-600 ml-2">{stats.couplesUsers}</span><span className="text-[10px] text-purple-600 mb-0.5">duo</span>
                </div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Total Data Points</div>
                <div className="text-3xl font-bold text-secondary">{totalDP}</div>
                <div className="text-[10px] text-slate-400 mt-1">across all users</div>
              </div>
            </div>

            {/* KPI Row 2: Feature counts */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { label: 'Holdings', value: stats.investments, bg: 'bg-primary/8', color: 'text-primary' },
                { label: 'Recurring', value: stats.mips, bg: 'bg-blue-50', color: 'text-blue-600' },
                { label: 'Goals', value: stats.goals, bg: 'bg-amber-50', color: 'text-amber-600' },
                { label: 'Debts', value: stats.debts, bg: 'bg-red-50', color: 'text-red-500' },
                { label: 'Assets', value: stats.assets, bg: 'bg-violet-50', color: 'text-violet-600' },
                { label: 'Cash Accts', value: stats.cashAccounts, bg: 'bg-emerald-50', color: 'text-emerald-600' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-4 ${s.bg} border border-slate-100`}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{s.label}</div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Row 3: Countries + Recent Activity */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <h3 className="text-sm font-bold text-secondary mb-3">Users by Country</h3>
                <div className="space-y-2">
                  {Object.entries(stats.countriesMap).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
                    <div key={c} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">{c}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(n / stats.users) * 100}%` }} /></div>
                        <span className="text-xs font-bold text-secondary w-6 text-right">{n}</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(stats.countriesMap).length === 0 && <div className="text-xs text-slate-400">No data</div>}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <h3 className="text-sm font-bold text-secondary mb-3">Recent Activity</h3>
                <div className="space-y-2.5">
                  {[...users].sort((a, b) => (b.lastLogin?.seconds || 0) - (a.lastLogin?.seconds || 0)).slice(0, 8).map((u, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                          {(u.displayName || u.fullName || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-600 truncate max-w-[120px]">{u.displayName || u.fullName || u.email?.split('@')[0]}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${u.tier === 'premium' ? 'bg-amber-100 text-amber-700' : u.tier === 'couples' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>{u.tier || 'free'}</span>
                      </div>
                      <span className="text-slate-400 flex-shrink-0">{tsRel(u.lastLogin)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature Adoption */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <h3 className="text-sm font-bold text-secondary mb-3">Feature Adoption</h3>
              <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Holdings', count: users.filter(u => u.investmentCount > 0).length },
                  { label: 'Recurring', count: users.filter(u => u.mipCount > 0).length },
                  { label: 'Goals', count: users.filter(u => u.goalCount > 0).length },
                  { label: 'Debts', count: users.filter(u => u.debtCount > 0).length },
                  { label: 'Assets', count: users.filter(u => u.assetCount > 0).length },
                  { label: 'Cash', count: users.filter(u => u.cashCount > 0).length },
                ].map(f => {
                  const pct = stats.users > 0 ? (f.count / stats.users) * 100 : 0;
                  return (
                    <div key={f.label} className="text-center">
                      <div className="text-lg font-bold text-secondary">{pct.toFixed(0)}%</div>
                      <div className="text-[10px] text-slate-400">{f.count}/{stats.users} use {f.label}</div>
                      <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="text-xs text-slate-500 mb-1">Cached Prices</div><div className="text-2xl font-bold text-secondary">{cachedPrices.length}</div></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="text-xs text-slate-500 mb-1">Tax Rule Sets</div><div className="text-2xl font-bold text-secondary">{ALL_TAX_RULES.length}</div><button onClick={seedTaxRules} className="text-[10px] text-primary font-semibold hover:underline mt-1">Seed →</button></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="text-xs text-slate-500 mb-1">Admin</div><div className="text-sm font-bold text-amber-700 truncate">{user?.email}</div></div>
            </div>

            {/* Waitlist Demand */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-secondary flex items-center gap-2">
                    📋 Premium Waitlist
                    {stats.waitlistUsers.length > 0 && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{stats.waitlistUsers.length}</span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Users who joined the waitlist from Beta features</p>
                </div>
              </div>
              {stats.waitlistUsers.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">No waitlist signups yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-2 pr-4">User</th>
                        <th className="pb-2 pr-4">Email</th>
                        <th className="pb-2 pr-4">Interested In</th>
                        <th className="pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.waitlistUsers.map((wl, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-2 pr-4 text-secondary font-medium">{wl.name}</td>
                          <td className="py-2 pr-4 text-slate-500 text-xs">{wl.email}</td>
                          <td className="py-2 pr-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${wl.plan === 'couples' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                              {wl.plan === 'couples' ? 'Family Premium' : 'Premium'}
                            </span>
                          </td>
                          <td className="py-2 text-[10px] text-slate-400">{wl.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── USERS ──────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input type="text" value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="Search name or email..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              </div>
              <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
                <option value="all">All Tiers</option><option value="free">Free</option><option value="premium">Premium</option><option value="couples">Couples</option>
              </select>
              <span className="text-xs text-slate-400">{filtered.length} of {users.length}</span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">User</th><th className="px-4 py-3">Country</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3 text-center">Data</th><th className="px-4 py-3">Last Active</th><th className="px-4 py-3">Joined</th>
                  </tr></thead>
                  <tbody>
                    {filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users match.</td></tr> : filtered.map((u, i) => {
                      const dc = (u.investmentCount || 0) + (u.mipCount || 0) + (u.goalCount || 0) + (u.debtCount || 0) + (u.assetCount || 0) + (u.cashCount || 0);
                      return (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{(u.displayName || u.fullName || u.email || '?').charAt(0).toUpperCase()}</div><div><div className="font-semibold text-secondary text-xs truncate max-w-[150px]">{u.displayName || u.fullName || u.uid?.slice(0, 10)}</div><div className="text-[10px] text-slate-400 truncate max-w-[150px]">{u.email}</div></div></div></td>
                          <td className="px-4 py-3 text-xs text-slate-600">{u.country || '—'}</td>
                          <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(u.tier || 'free') === 'premium' ? 'bg-amber-100 text-amber-700' : (u.tier || 'free') === 'couples' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>{u.tier || 'free'}</span></td>
                          <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1 flex-wrap">
                            {u.investmentCount > 0 && <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded">{u.investmentCount}H</span>}
                            {u.mipCount > 0 && <span className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded">{u.mipCount}R</span>}
                            {u.goalCount > 0 && <span className="text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded">{u.goalCount}G</span>}
                            {u.debtCount > 0 && <span className="text-[9px] bg-red-50 text-red-500 px-1 py-0.5 rounded">{u.debtCount}D</span>}
                            {u.assetCount > 0 && <span className="text-[9px] bg-violet-50 text-violet-600 px-1 py-0.5 rounded">{u.assetCount}A</span>}
                            {u.cashCount > 0 && <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded">{u.cashCount}C</span>}
                            {dc === 0 && <span className="text-[10px] text-slate-300">—</span>}
                          </div></td>
                          <td className="px-4 py-3 text-xs text-slate-400">{tsRel(u.lastLogin)}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{ts(u.createdAt || u.updatedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAX RULES ──────────────────────────────────── */}
        {tab === 'tax-rules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{ALL_TAX_RULES.length} tax rule sets</p><button onClick={seedTaxRules} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90">Seed All</button></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_TAX_RULES.map(rule => (
                <div key={rule.countryCode} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-2 mb-1"><span className="text-lg">{rule.countryCode === 'DE' ? '🇩🇪' : '🇮🇳'}</span><span className="text-sm font-bold text-secondary">{rule.country} {rule.year}</span></div>
                  <div className="text-[10px] text-slate-400">Currency: {rule.currency} · {rule.brackets?.single?.length || 0} brackets</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── MARKET PRICES ──────────────────────────────── */}
        {tab === 'market-prices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{cachedPrices.length} cached</p>
              <button onClick={async () => { for (const p of cachedPrices) { await deleteDoc(doc(db, 'market_prices', p.symbol)); } setCachedPrices([]); showToast('success', 'Purged'); }} className="px-4 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600">Purge All</button>
            </div>
            {cachedPrices.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">No cached prices</div> : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto max-h-[500px]"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50"><tr className="text-left text-slate-500 uppercase tracking-wider"><th className="px-4 py-2">Symbol</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2">Cur</th><th className="px-4 py-2">Updated</th><th className="px-4 py-2 text-right">Action</th></tr></thead><tbody>
                {cachedPrices.map(p => (<tr key={p.symbol} className="border-t border-slate-50 hover:bg-slate-50"><td className="px-4 py-2 font-mono font-bold text-primary">{p.symbol}</td><td className="px-4 py-2 text-right font-semibold text-secondary">{p.price?.toFixed(2)}</td><td className="px-4 py-2 text-slate-500">{p.currency || '—'}</td><td className="px-4 py-2 text-slate-400">{ts(p.fetchedAt || p.updatedAt)}</td><td className="px-4 py-2 text-right"><button onClick={async () => { await deleteDoc(doc(db, 'market_prices', p.symbol)); setCachedPrices(prev => prev.filter(x => x.symbol !== p.symbol)); }} className="text-red-400 hover:text-red-600 text-[10px] font-semibold">Del</button></td></tr>))}
              </tbody></table></div></div>
            )}
          </div>
        )}

        {/* ─── PRICING ────────────────────────────────────── */}
        {tab === 'pricing' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-secondary flex items-center gap-2">
                    💰 Subscription Pricing
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Edit prices per currency. Changes publish immediately to the website and app.</p>
                </div>
                <button onClick={savePricing} disabled={pricingSaving || !pricingDirty}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    pricingDirty
                      ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}>
                  {pricingSaving ? 'Saving...' : pricingDirty ? '💾 Save & Publish' : 'Saved ✓'}
                </button>
              </div>

              {/* Header */}
              <div className="grid grid-cols-[80px_1fr_1fr] gap-4 mb-3 px-1">
                <div />
                <div className="text-center">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Premium</span>
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Family Premium</span>
                </div>
              </div>

              {/* Currency rows */}
              <div className="space-y-3">
                {CURRENCIES.map(cur => (
                  <div key={cur} className="grid grid-cols-[80px_1fr_1fr] gap-4 items-center bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-secondary">{CURRENCY_SYMBOLS[cur]}</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">{cur}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 text-center">Monthly</label>
                        <input type="number" step="0.01" value={pricingData[cur]?.premium?.monthly || 0}
                          onChange={e => updatePrice(cur, 'premium', 'monthly', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center font-semibold text-secondary bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 text-center">Annual</label>
                        <input type="number" step="1" value={pricingData[cur]?.premium?.annual || 0}
                          onChange={e => updatePrice(cur, 'premium', 'annual', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center font-semibold text-secondary bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 text-center">Monthly</label>
                        <input type="number" step="0.01" value={pricingData[cur]?.couples?.monthly || 0}
                          onChange={e => updatePrice(cur, 'couples', 'monthly', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm text-center font-semibold text-secondary bg-white focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/10" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 text-center">Annual</label>
                        <input type="number" step="1" value={pricingData[cur]?.couples?.annual || 0}
                          onChange={e => updatePrice(cur, 'couples', 'annual', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm text-center font-semibold text-secondary bg-white focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/10" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Annual-only currencies note */}
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-[10px] text-amber-700 flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <strong>INR</strong> is set to annual-only billing. Monthly prices for INR are still stored but not shown to users. To change annual-only currencies, update <code className="bg-amber-100 px-1 rounded">ANNUAL_ONLY_CURRENCIES</code> in tiers.ts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── SYSTEM ─────────────────────────────────────── */}
        {tab === 'system' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-secondary mb-3">API Keys</h3>
              <div className="space-y-2">
                {['twelveData', 'anthropicKey'].map(k => (
                  <div key={k} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-xs font-semibold text-secondary">{k === 'anthropicKey' ? 'Anthropic (Claude)' : 'Twelve Data'}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${systemConfig[k] ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{systemConfig[k] ? 'OK' : 'Missing'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-secondary mb-2">Admin Whitelist</h3>
              <div className="text-xs text-slate-500">Firestore: <code className="bg-slate-100 px-1 rounded">system/admin_whitelist → emails[]</code></div>
              <div className="mt-2 text-sm font-semibold text-secondary">{user?.email}</div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
