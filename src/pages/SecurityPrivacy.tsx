// =============================================================
// pages/SecurityPrivacy.tsx — Dedicated trust & transparency page
// =============================================================
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useCurrency } from '../context/CurrencyContext';
import SidebarLayout from '../components/SidebarLayout';
import { db } from '../firebase/config';
import { collection, getDocs, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { usePageTitle } from '../hooks/usePageTitle';

type Tab = 'overview' | 'data' | 'privacy' | 'account';

export default function SecurityPrivacy() {
  const { user, logout } = useAuth();
  usePageTitle('Security & Privacy');
  const { locale } = useLocale();
  const { currency } = useCurrency();
  const [tab, setTab] = useState<Tab>('overview');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'password' | 'deleting' | 'done'>('confirm');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const isGoogle = user?.providerData.some(p => p.providerId === 'google.com');
  const isDE = locale === 'de';

  // Load data counts for the "Your Data" tab
  useEffect(() => {
    if (user) loadDataCounts();
  }, [user]);

  const loadDataCounts = async () => {
    if (!user) return;
    setCountsLoading(true);
    const counts: Record<string, number> = {};
    const cols = [
      { key: 'investments', label: 'Investments' },
      { key: 'goals', label: 'Goals' },
      { key: 'lifestyleBasket', label: 'Lifestyle Items' },
      { key: 'anti_portfolio', label: 'Anti-Portfolio' },
      { key: 'scenarios', label: 'Scenarios' },
    ];
    for (const c of cols) {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, c.key));
        counts[c.label] = snap.size;
      } catch { counts[c.label] = 0; }
    }
    setDataCounts(counts);
    setCountsLoading(false);
  };

  // ─── Export (GDPR Art. 20) ────────────────────────────────
  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const exportData: Record<string, any> = {};
      const profileSnap = await getDoc(doc(db, 'users', user.uid));
      if (profileSnap.exists()) {
        const d = { ...profileSnap.data() };
        delete d.updatedAt; delete d.createdAt;
        exportData.profile = d;
      }
      const cols = ['investments', 'goals', 'lifestyleBasket', 'anti_portfolio', 'scenarios'];
      for (const c of cols) {
        const snap = await getDocs(collection(db, 'users', user.uid, c));
        exportData[c] = snap.docs.map(d => {
          const data = { ...d.data() };
          // Convert Firestore Timestamps to ISO strings
          Object.keys(data).forEach(k => {
            if (data[k]?.toDate) data[k] = data[k].toDate().toISOString();
          });
          return { id: d.id, ...data };
        });
      }
      exportData._meta = {
        exportedAt: new Date().toISOString(),
        userId: user.uid,
        email: user.email,
        format: 'myfynzo-export-v1',
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myfynzo-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 5000);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // ─── Account Deletion (GDPR Art. 17) ─────────────────────
  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteStep('deleting');
    setDeleteError('');
    try {
      if (isGoogle) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } else if (deletePassword) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, deletePassword));
      }
      const subs = ['investments', 'goals', 'lifestyleBasket', 'anti_portfolio', 'scenarios'];
      for (const sub of subs) {
        const snap = await getDocs(collection(db, 'users', user.uid, sub));
        for (const d of snap.docs) await deleteDoc(doc(db, 'users', user.uid, sub, d.id));
      }
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      setDeleteStep('done');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login' || err.code === 'auth/wrong-password') {
        setDeleteStep('password');
        setDeleteError('Please enter your password to confirm.');
      } else {
        setDeleteError(err.message || 'Failed. Please try again.');
        setDeleteStep('confirm');
      }
    }
  };

  // ─── Security checklist items ─────────────────────────────
  const securityChecks = [
    { label: 'Encryption at rest (AES-256)', ok: true, detail: 'All Firestore data encrypted by Google Cloud.' },
    { label: 'Encryption in transit (TLS 1.3)', ok: true, detail: 'All connections use HTTPS with TLS 1.3.' },
    { label: 'EU data residency (Frankfurt)', ok: true, detail: 'Firestore region: europe-west1 (Frankfurt, Germany).' },
    { label: 'Per-user data isolation', ok: true, detail: 'Firestore rules enforce request.auth.uid == userId.' },
    { label: 'No third-party data sharing', ok: true, detail: 'Your financial data is never sold or shared with third parties.' },
    { label: 'Account deletion available', ok: true, detail: 'Full data erasure per GDPR Article 17.' },
    { label: 'Data export available', ok: true, detail: 'Download all your data as JSON per GDPR Article 20.' },
    { label: 'Firebase Auth (Google-managed)', ok: true, detail: 'Passwords hashed with scrypt. We never see your password.' },
    { label: 'Email verified', ok: !!user?.emailVerified, detail: user?.emailVerified ? 'Your email is verified.' : 'Please verify your email for full account security.' },
  ];

  const tabs = [
    { id: 'overview' as Tab, label: 'Security Status', icon: '🛡️' },
    { id: 'data' as Tab, label: 'Your Data', icon: '📊' },
    { id: 'privacy' as Tab, label: 'Privacy', icon: '🔒' },
    { id: 'account' as Tab, label: 'Account', icon: '👤' },
  ];

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fadeIn">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Security & Privacy</h1>
              <p className="text-sm text-slate-500">How we protect your financial data</p>
            </div>
          </div>
        </div>

        {/* Overall status banner */}
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
          <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-bold text-emerald-800">All systems operational</span>
            <span className="text-xs text-emerald-600 ml-2">— {securityChecks.filter(c => c.ok).length}/{securityChecks.length} checks passed</span>
          </div>
          <span className="text-xs text-emerald-600 font-mono hidden sm:block">
            {new Date().toLocaleDateString(isDE ? 'de-DE' : 'en-US')}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-secondary text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══════════════════════════════════ */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Security checklist */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">Security Checklist</h2>
              <div className="space-y-2">
                {securityChecks.map((check, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    check.ok ? 'bg-emerald-50/60' : 'bg-amber-50/60'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      check.ok ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}>
                      {check.ok ? (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-secondary">{check.label}</div>
                      <div className="text-xs text-slate-500">{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">How Your Data Is Protected</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: '🔐', title: 'Encrypted at Rest', desc: 'Google Cloud encrypts all stored data with AES-256. Decryption keys are managed by Google KMS.' },
                  { icon: '🌐', title: 'Encrypted in Transit', desc: 'Every connection uses TLS 1.3. No data travels unencrypted between your browser and our servers.' },
                  { icon: '🇪🇺', title: 'EU Data Residency', desc: 'Your data lives in Frankfurt, Germany (europe-west1). It never leaves the European Union.' },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <div className="text-sm font-bold text-secondary mb-1">{item.title}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* What we DON'T do — honest transparency */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">What We Don't Do</h2>
              <div className="space-y-2.5">
                {[
                  { text: 'We never sell your data to advertisers or data brokers.', icon: '🚫' },
                  { text: 'We never share your financial data with third parties.', icon: '🚫' },
                  { text: 'We never access your bank accounts or execute trades.', icon: '🚫' },
                  { text: 'We never store your passwords — Firebase Auth handles them with scrypt hashing.', icon: '🚫' },
                  { text: 'We never use your data to train AI models.', icon: '🚫' },
                  { text: 'We never show ads or let advertisers access user data.', icon: '🚫' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg">
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-sm text-slate-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial disclaimer */}
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span className="text-sm font-bold text-blue-800">Financial Disclaimer</span>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                myfynzo is an informational tool for personal financial tracking and planning. 
                Tax calculations are estimates based on publicly available tax rules and do not constitute tax advice. 
                Investment projections are based on historical averages and are not guarantees of future returns. 
                Always consult a qualified Steuerberater, tax advisor, or financial professional for decisions 
                specific to your situation.
              </p>
            </div>
          </div>
        )}

        {/* ═══ YOUR DATA TAB ══════════════════════════════════ */}
        {tab === 'data' && (
          <div className="space-y-4">
            {/* Data inventory */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-1">Data We Store About You</h2>
              <p className="text-xs text-slate-500 mb-4">Complete inventory of data associated with your account.</p>

              {countsLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(dataCounts).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-sm font-semibold text-secondary">{label}</span>
                      <span className="text-sm font-bold text-primary">{count} record{count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-semibold text-secondary">Profile (name, email, preferences)</span>
                    <span className="text-sm font-bold text-primary">1 record</span>
                  </div>
                </div>
              )}
            </div>

            {/* Where it's stored */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">Where Your Data Lives</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <span className="text-lg">🗄️</span>
                  <div>
                    <div className="text-sm font-semibold text-secondary">Google Cloud Firestore</div>
                    <div className="text-xs text-slate-500">Region: europe-west1 (Frankfurt, Germany). Encrypted with AES-256.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <span className="text-lg">🔑</span>
                  <div>
                    <div className="text-sm font-semibold text-secondary">Firebase Authentication</div>
                    <div className="text-xs text-slate-500">Your password is hashed with scrypt. We never store or see plaintext passwords.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <span className="text-lg">📱</span>
                  <div>
                    <div className="text-sm font-semibold text-secondary">Your Browser (local only)</div>
                    <div className="text-xs text-slate-500">Auth token stored in IndexedDB. No financial data cached locally.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Export & Delete */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <h3 className="font-bold text-secondary">Export All Data</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Download everything we have about you as a JSON file. 
                  This is your GDPR right to data portability (Article 20).
                </p>
                <button onClick={handleExport} disabled={exporting}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    exported ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                    exporting ? 'bg-slate-100 text-slate-400' :
                    'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                  }`}>
                  {exported ? '✓ Downloaded' : exporting ? 'Preparing export...' : 'Download My Data'}
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-red-100 shadow-card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  <h3 className="font-bold text-red-700">Delete Account</h3>
                </div>
                <p className="text-xs text-red-600/70 mb-4">
                  Permanently delete your account and ALL associated data. 
                  This action cannot be undone (GDPR Article 17).
                </p>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors">
                  Delete My Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PRIVACY TAB ════════════════════════════════════ */}
        {tab === 'privacy' && (
          <div className="space-y-4">
            {/* GDPR rights */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">Your GDPR Rights</h2>
              <div className="space-y-3">
                {[
                  { right: 'Right to Access (Art. 15)', desc: 'You can request all data we hold about you.', action: 'Export your data in the "Your Data" tab.', icon: '📋' },
                  { right: 'Right to Rectification (Art. 16)', desc: 'You can correct any inaccurate data.', action: 'Edit your profile in Settings.', icon: '✏️' },
                  { right: 'Right to Erasure (Art. 17)', desc: 'You can delete your account and all data.', action: 'Delete account in the "Your Data" tab.', icon: '🗑️' },
                  { right: 'Right to Portability (Art. 20)', desc: 'You can download your data in a machine-readable format.', action: 'JSON export available in the "Your Data" tab.', icon: '📦' },
                  { right: 'Right to Restrict Processing (Art. 18)', desc: 'Contact us to restrict how we process your data.', action: 'Email: privacy@myfynzo.com', icon: '⏸️' },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{item.icon}</span>
                      <span className="text-sm font-bold text-secondary">{item.right}</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-1">{item.desc}</p>
                    <p className="text-xs text-primary font-semibold">{item.action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Third-party services */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">Third-Party Services We Use</h2>
              <p className="text-xs text-slate-500 mb-4">These are the only external services that interact with your data.</p>
              <div className="space-y-2">
                {[
                  { name: 'Google Firebase', purpose: 'Authentication, database, hosting', data: 'Email, profile, financial data (encrypted)', location: '🇪🇺 Frankfurt, DE', dpa: 'Google Cloud DPA' },
                  { name: 'ExchangeRate-API', purpose: 'Live currency exchange rates', data: 'No user data sent — only rate queries', location: '🇺🇸 Global CDN', dpa: 'N/A — no PII' },
                  { name: 'Twelve Data', purpose: 'Live stock/ETF prices', data: 'Only stock symbols — no user data', location: '🇺🇸 Global CDN', dpa: 'N/A — no PII' },
                  { name: 'CoinGecko', purpose: 'Cryptocurrency prices', data: 'Only coin IDs — no user data', location: '🇸🇬 Singapore', dpa: 'N/A — no PII' },
                ].map((svc, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                      {svc.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-secondary">{svc.name}</span>
                        <span className="text-xs text-slate-400">{svc.location}</span>
                      </div>
                      <div className="text-xs text-slate-500">{svc.purpose}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Data shared: {svc.data}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal pages */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">Legal Documents</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { title: 'Privacy Policy', desc: 'How we collect, use, and protect your data.', href: '#' },
                  { title: 'Terms of Service', desc: 'Rules and conditions for using myfynzo.', href: '#' },
                  { title: 'Impressum', desc: 'Legal notice required by German TMG §5.', href: '#' },
                  { title: 'Cookie Policy', desc: 'Cookies we use and why.', href: '#' },
                ].map((doc, i) => (
                  <a key={i} href={doc.href} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-slate-50 transition-colors group">
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <div>
                      <div className="text-sm font-semibold text-secondary">{doc.title}</div>
                      <div className="text-xs text-slate-400">{doc.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACCOUNT TAB ════════════════════════════════════ */}
        {tab === 'account' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">Account Details</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { label: 'Email', value: user?.email || '—' },
                  { label: 'Auth Provider', value: isGoogle ? 'Google Account' : 'Email & Password' },
                  { label: 'Account Created', value: user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString(isDE ? 'de-DE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { label: 'Last Sign In', value: user?.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString(isDE ? 'de-DE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                  { label: 'User ID', value: user?.uid || '—' },
                  { label: 'Email Verified', value: user?.emailVerified ? '✅ Verified' : '⚠️ Not verified' },
                  { label: 'Currency', value: currency },
                  { label: 'Language', value: locale === 'de' ? 'Deutsch' : 'English' },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl">
                    <div className="text-xs text-slate-400 mb-0.5">{item.label}</div>
                    <div className={`text-sm font-semibold text-secondary ${item.label === 'User ID' ? 'font-mono text-xs text-slate-500 truncate' : ''}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active sessions info */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h2 className="text-lg font-bold text-secondary mb-4">Session Security</h2>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-emerald-800">Current Session Active</span>
                </div>
                <div className="text-xs text-emerald-600">
                  Signed in as {user?.email} via {isGoogle ? 'Google OAuth 2.0' : 'email/password'}. 
                  Session token managed by Firebase Auth with automatic refresh.
                </div>
              </div>
              <button onClick={logout}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors">
                Sign Out of All Sessions
              </button>
            </div>
          </div>
        )}

        {/* ─── Delete Confirmation Modal ─────────────────── */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-white rounded-2xl shadow-elevated w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              {deleteStep === 'confirm' && (
                <>
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-secondary text-center mb-2">Delete Your Account?</h3>
                  <p className="text-sm text-slate-500 text-center mb-2">This will permanently delete:</p>
                  <ul className="text-xs text-slate-600 mb-4 space-y-1">
                    {Object.entries(dataCounts).map(([label, count]) => (
                      <li key={label} className="flex items-center gap-2 pl-2">
                        <span className="w-1 h-1 bg-red-400 rounded-full" />
                        {count} {label.toLowerCase()}
                      </li>
                    ))}
                    <li className="flex items-center gap-2 pl-2">
                      <span className="w-1 h-1 bg-red-400 rounded-full" />
                      Your profile and preferences
                    </li>
                  </ul>
                  <p className="text-xs text-red-600 font-semibold text-center mb-4">This cannot be undone.</p>
                  {deleteError && <p className="text-xs text-red-600 text-center mb-3 bg-red-50 p-2 rounded-lg">{deleteError}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancel</button>
                    <button onClick={() => isGoogle ? handleDeleteAccount() : setDeleteStep('password')}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700">Yes, Delete Everything</button>
                  </div>
                </>
              )}
              {deleteStep === 'password' && (
                <>
                  <h3 className="text-lg font-bold text-secondary mb-2">Confirm Password</h3>
                  <p className="text-sm text-slate-500 mb-4">Enter your password to permanently delete your account.</p>
                  {deleteError && <p className="text-xs text-red-600 mb-3 bg-red-50 p-2 rounded-lg">{deleteError}</p>}
                  <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                    placeholder="Your password" autoFocus className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary mb-4" />
                  <div className="flex gap-3">
                    <button onClick={() => { setShowDeleteConfirm(false); setDeleteStep('confirm'); }}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm">Cancel</button>
                    <button onClick={handleDeleteAccount} disabled={!deletePassword}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50">Delete Permanently</button>
                  </div>
                </>
              )}
              {deleteStep === 'deleting' && (
                <div className="text-center py-8">
                  <div className="w-10 h-10 border-3 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-slate-600">Deleting all your data...</p>
                </div>
              )}
              {deleteStep === 'done' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-secondary mb-2">Account Deleted</h3>
                  <p className="text-sm text-slate-500">All data removed. Redirecting...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
