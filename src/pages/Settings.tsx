import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLocale } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import SidebarLayout from '../components/SidebarLayout';
import { useToast } from '../context/ToastContext';
import { SUPPORTED_CURRENCIES, SupportedCurrency } from '../constants/countries';
import { usePageTitle } from '../hooks/usePageTitle';

interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  dateOfBirth: string;
  occupation: string;
  preferredCurrency: string;
  locale: string;
  projectionYears: number;
  notifications: { email: boolean; push: boolean; weekly: boolean };
}

export default function Settings() {
  const { user } = useAuth();
  usePageTitle('Settings');
  const { currency, setCurrency, exchangeRates, ratesLoading, ratesLastUpdated } = useCurrency();
  const { t, locale, setLocale, isGerman } = useLocale();
  const { theme: appTheme, resolved: resolvedTheme, setTheme: setAppTheme } = useTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '', email: user?.email || '', phone: '', address: '', city: '',
    country: '', postalCode: '', dateOfBirth: '', occupation: '',
    preferredCurrency: currency, locale: locale, projectionYears: 10,
    notifications: { email: true, push: false, weekly: true }
  });

  useEffect(() => { if (user) loadProfile(); }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, 'users', user!.uid));
      if (snap.exists()) {
        const d = snap.data();
        setProfile({
          fullName: d.fullName || '', email: user!.email || '', phone: d.phone || '',
          address: d.address || '', city: d.city || '', country: d.country || '',
          postalCode: d.postalCode || '', dateOfBirth: d.dateOfBirth || '',
          occupation: d.occupation || '', preferredCurrency: d.preferredCurrency || currency,
          locale: d.locale || locale, projectionYears: d.projectionYears || 10,
          notifications: d.notifications || { email: true, push: false, weekly: true }
        });
      }
    } catch (err) { console.error('Error loading profile:', err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'users', user!.uid), {
        ...profile, locale: locale, updatedAt: new Date()
      }, { merge: true });
      if (profile.preferredCurrency !== currency) {
        setCurrency(profile.preferredCurrency as SupportedCurrency);
      }
      showToast(t('settings.saved'), 'success');
    } catch (err) {
      showToast(t('settings.saveFailed'), 'error');
    } finally { setSaving(false); }
  };

  const updateProfile = (field: string, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };
  const updateNotification = (field: string, value: boolean) => {
    setProfile(prev => ({ ...prev, notifications: { ...prev.notifications, [field]: value } }));
  };

  // XE-style exchange rate display
  const baseRates: { code: string; symbol: string }[] = [
    { code: 'EUR', symbol: '€' }, { code: 'GBP', symbol: '£' },
    { code: 'CHF', symbol: 'CHF' }, { code: 'INR', symbol: '₹' },
  ];

  const getRate = (from: string, to: string) => {
    const fromRate = exchangeRates[from] || 1;
    const toRate = exchangeRates[to] || 1;
    return toRate / fromRate;
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
          {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse mb-4" />)}
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-3xl lg:text-4xl font-bold text-secondary font-display">{t('settings.title')}</h1>
          <p className="text-slate-500 mt-1">{t('settings.subtitle')}</p>
        </div>

        {/* Account link card */}
        <Link to="/account" className="block bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 mb-6 hover:border-primary/20 hover:shadow-card-hover transition-all group animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                {(profile.fullName || user?.email || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-bold text-secondary">{profile.fullName || 'Set your name'}</div>
                <div className="text-xs text-slate-500">{user?.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:block">Profile, address & subscription</span>
              <svg className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        </Link>

        {/* Preferences: Currency + Language */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8 mb-6">
          <h2 className="text-xl font-bold text-secondary mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/8 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              </svg>
            </div>
            {t('settings.preferences')}
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.currency')}</label>
              <select value={profile.preferredCurrency}
                onChange={e => { updateProfile('preferredCurrency', e.target.value); setCurrency(e.target.value as SupportedCurrency); }}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white">
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code} — {isGerman ? c.nameDE : c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.language')}</label>
              <div className="flex gap-2">
                <button onClick={() => setLocale('en')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${
                    locale === 'en' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-slate-200 text-slate-600 hover:border-primary/30'
                  }`}>
                  <span>🇬🇧</span> English
                </button>
                {profile.country === 'Germany' && (
                  <button onClick={() => setLocale('de')}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${
                      locale === 'de' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-slate-200 text-slate-600 hover:border-primary/30'
                    }`}>
                    <span>🇩🇪</span> Deutsch
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Appearance</label>
              <div className="flex gap-2">
                <button onClick={() => setAppTheme('light')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${appTheme === 'light' || (appTheme === 'system' && resolvedTheme === 'light') ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-slate-200 text-slate-500 hover:border-primary/30'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                  Light
                </button>
                <button onClick={() => setAppTheme('dark')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${appTheme === 'dark' || (appTheme === 'system' && resolvedTheme === 'dark') ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-slate-200 text-slate-500 hover:border-primary/30'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                  Dark
                </button>
                <button onClick={() => setAppTheme('system')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${appTheme === 'system' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-slate-200 text-slate-500 hover:border-primary/30'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                  </svg>
                  Auto
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700">Dashboard Projection Period</label>
                <span className="text-sm font-bold text-primary">{profile.projectionYears} years</span>
              </div>
              <input type="range" min="5" max="50" step="1" value={profile.projectionYears}
                onChange={e => updateProfile('projectionYears', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>5yr</span><span>15yr</span><span>25yr</span><span>35yr</span><span>50yr</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Controls the projected value shown on your Dashboard card</p>
            </div>
          </div>
        </div>

        {/* Market Data & Sources */}
        <div className="space-y-4 mb-6">
          {/* XE Exchange Rates - full width */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-secondary flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                {t('settings.exchangeRates')}
              </h2>
              <div className="flex items-center gap-2">
                {ratesLastUpdated && (
                  <span className="text-[10px] text-slate-400">
                    {new Date(ratesLastUpdated).toLocaleTimeString(locale === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">LIVE</span>
              </div>
            </div>
            {ratesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {baseRates.filter(r => r.code !== currency).map(target => {
                  const rate = getRate(currency, target.code);
                  return (
                    <div key={target.code} className="bg-slate-50 rounded-xl p-3 border border-slate-100 hover:border-primary/20 transition-colors">
                      <div className="text-[10px] font-semibold text-slate-400 mb-0.5">{currency} → {target.code}</div>
                      <div className="text-sm font-bold text-secondary">{target.symbol}{rate.toFixed(rate > 10 ? 2 : 4)}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{t('settings.poweredByXE')}</span>
              <a href="https://www.xe.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline font-medium">xe.com →</a>
            </div>
          </div>

          {/* Data Sources - 3 across */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a href="https://www.justetf.com" target="_blank" rel="noopener noreferrer"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 hover:border-primary/30 transition-all group flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-secondary group-hover:text-primary transition-colors">justETF</div>
                <div className="text-[10px] text-slate-400">ETF research & ISINs</div>
              </div>
              <span className="text-[9px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full font-semibold ml-auto flex-shrink-0">ETF</span>
            </a>
            <a href="https://finance.yahoo.com" target="_blank" rel="noopener noreferrer"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 hover:border-primary/30 transition-all group flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-secondary group-hover:text-primary transition-colors">Yahoo Finance</div>
                <div className="text-[10px] text-slate-400">Stocks, crypto & market data</div>
              </div>
              <span className="text-[9px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-semibold ml-auto flex-shrink-0">Market</span>
            </a>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-secondary">Twelve Data API</div>
                <div className="text-[10px] text-slate-400">Powers live prices & search</div>
              </div>
              <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold ml-auto flex-shrink-0">Active</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8 mb-6">
          <h2 className="text-xl font-bold text-secondary mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/8 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            {t('settings.notifications')}
          </h2>
          <div className="space-y-3">
            {[
              { key: 'email', title: t('settings.emailNotif'), desc: t('settings.emailNotifDesc') },
              { key: 'push', title: t('settings.pushNotif'), desc: t('settings.pushNotifDesc') },
              { key: 'weekly', title: t('settings.weeklyNotif'), desc: t('settings.weeklyNotifDesc') },
            ].map(item => (
              <label key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100">
                <div>
                  <div className="font-semibold text-secondary text-sm">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only"
                    checked={(profile.notifications as any)[item.key]}
                    onChange={e => updateNotification(item.key, e.target.checked)} />
                  <div className={`w-11 h-6 rounded-full transition-colors ${(profile.notifications as any)[item.key] ? 'bg-primary' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${(profile.notifications as any)[item.key] ? 'translate-x-5' : ''}`} />
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Subscription Management */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 lg:p-8 mb-6">
          <h2 className="text-xl font-bold text-secondary mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            Subscription
          </h2>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4">
            <div>
              <div className="text-sm font-semibold text-secondary">Current Plan</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {profile.preferredCurrency && 'Manage your subscription and billing'}
              </div>
            </div>
            <Link to="/account" className="px-4 py-2 bg-primary/10 text-primary text-sm font-semibold rounded-xl hover:bg-primary/20 transition-colors">
              View Plans
            </Link>
          </div>

          {/* Cancellation — legally required in Germany (§ 312k BGB) and EU */}
          <div className="border border-red-100 rounded-xl p-4 bg-red-50/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-red-800">Cancel Subscription</div>
                <p className="text-xs text-red-600/70 mt-1 leading-relaxed">
                  You can cancel your subscription at any time. Your access continues until the end of your current billing period. 
                  No further charges will be made after cancellation.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors">
                    Cancel Subscription
                  </button>
                  <span className="text-[10px] text-slate-400">As per §312k BGB (Germany) & EU consumer rights</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cancel Subscription Modal */}
          {showCancelModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCancelModal(false)}>
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-elevated animate-slideUp" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-secondary">Cancel Subscription?</h3>
                    <p className="text-xs text-slate-400">This action can be reversed by re-subscribing</p>
                  </div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 mb-5 border border-red-100">
                  <ul className="space-y-2 text-sm text-red-700">
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Your access continues until the end of the current billing period.
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                      No further charges will be made.
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25" /></svg>
                      Your data will be preserved — you can re-subscribe anytime.
                    </li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      showToast('Subscription cancellation will be available once payments are live. Contact support for assistance.', 'success');
                    }}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
                    Yes, Cancel My Subscription
                  </button>
                  <button onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
                    Keep Subscription
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security & Privacy link */}
        <Link to="/security" className="block bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 mb-6 hover:border-primary/20 hover:shadow-card-hover transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary">Security & Privacy</h2>
                <p className="text-xs text-slate-500">Data protection, GDPR rights, export & delete your data</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-700">Secure</span>
              </div>
              <svg className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        </Link>

        {/* Save */}
        <div className="flex justify-end gap-3 animate-fadeIn">
          <button onClick={loadProfile}
            className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
            {t('settings.reset')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`px-8 py-3 rounded-xl font-semibold transition-all text-white flex items-center gap-2 ${
              saving ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'
            }`}>
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('settings.saving')}</>
            ) : (
              <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>{t('settings.save')}</>
            )}
          </button>
        </div>
      </div>
    </SidebarLayout>
  );
}
