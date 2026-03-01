import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useAdmin } from '../hooks/useAdmin';
import { useTier } from '../hooks/useTier';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { t } = useLocale();
  const { isAdmin, adminLoading } = useAdmin();
  const { isFree, isLinkedPartner } = useTier();
  const [collapsed, setCollapsed] = useState(false);
  const [displayName, setDisplayName] = useState('');

  // Listen to Firestore for displayName changes
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setDisplayName(d.displayName || d.fullName || '');
      }
    });
    return () => unsub();
  }, [user]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // ─── CORE section ───
  const coreItems = [
    { path: '/dashboard', label: t('nav.dashboard'), premium: false, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    )},
    { path: '/investments', label: t('nav.investments'), premium: false, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    )},
    { path: '/wealth-projection', label: t('nav.wealthProjection') || 'Wealth Projector', premium: false, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    )},
  ];

  // ─── PLANNING section ───
  const planningItems = [
    { path: '/income-debts', label: 'Income & Debts', premium: true, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { path: '/lifestyle-basket', label: 'Lifestyle Basket', premium: true, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    )},
    { path: '/goals', label: t('nav.goalTracker'), premium: true, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
      </svg>
    )},
  ];

  // ─── TOOLS section ───
  const toolItems = [
    { path: '/financial-lab', label: 'Financial Lab', premium: true, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    )},
    { path: '/calculators', label: t('nav.calculators'), premium: false, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
      </svg>
    )},
  ];

  // ─── SYSTEM section ───
  const systemItems = [
    { path: '/settings', label: t('nav.settings'), premium: false, icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    ...(isAdmin ? [{
      path: '/admin', label: 'Admin', premium: false, icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      )
    }] : []),
  ];

  const SidebarContent = () => {
    const renderNavGroup = (items: any[]) => items.map((item: any) => {
      const isActive = location.pathname === item.path || (item.path === '/financial-lab' && ['/scenario-branching', '/anti-portfolio'].includes(location.pathname));
      const isLocked = isFree && item.premium === true;
      if (isLocked) return (
        <button key={item.path} onClick={() => setShowUpgrade(true)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-white/25 hover:text-white/40 hover:bg-white/[0.03]"
          title={collapsed ? `${item.label} (Premium)` : ''}>
          <span className="flex-shrink-0 opacity-50">{item.icon}</span>
          {!collapsed && (<><span className="text-sm font-medium flex-1 text-left truncate">{item.label}</span>
            <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md">PRO</span></>)}
        </button>
      );
      return (
        <Link key={item.path} to={item.path} title={collapsed ? item.label : ''}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative ${
            isActive ? 'bg-primary/90 text-white shadow-lg shadow-primary/20' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'}`}>
          <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/90'}`}>{item.icon}</span>
          {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
          {isActive && !collapsed && <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/60" />}
        </Link>
      );
    });

    return (
    <>
      {/* Logo */}
      <div className={`${collapsed ? 'p-4' : 'px-5 py-5'} border-b border-white/[0.06]`}>
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <Link to="/dashboard" className="flex items-center gap-3.5 group">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <img 
                  src="/logo-transparent.png" 
                  alt="myfynzo" 
                  className="w-9 h-9 object-contain"
                />
              </div>
              <span className="text-[22px] font-bold text-white tracking-tight font-display">
                myfynzo
              </span>
              {isLinkedPartner && (
                <span className="text-[8px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                  ✓ Family Linked
                </span>
              )}
            </Link>
          ) : (
            <Link to="/dashboard" className="mx-auto group">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                <img 
                  src="/logo-transparent.png" 
                  alt="myfynzo" 
                  className="w-9 h-9 object-contain"
                />
              </div>
            </Link>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex text-white/30 hover:text-white/70 transition-colors p-1.5 rounded-lg hover:bg-white/[0.05]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex mx-auto mt-2 text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
            >
              <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* CORE */}
        {renderNavGroup(coreItems)}

        {/* PLANNING label */}
        {!collapsed && <div className="px-3.5 pt-4 pb-1"><span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.15em]">Planning</span></div>}
        {collapsed && <div className="my-2 mx-3 border-t border-white/[0.06]" />}
        {renderNavGroup(planningItems)}

        {/* TOOLS label */}
        {!collapsed && <div className="px-3.5 pt-4 pb-1"><span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.15em]">Tools</span></div>}
        {collapsed && <div className="my-2 mx-3 border-t border-white/[0.06]" />}
        {renderNavGroup(toolItems)}

        {/* SYSTEM label */}
        {!collapsed && <div className="px-3.5 pt-4 pb-1"><span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.15em]">System</span></div>}
        {collapsed && <div className="my-2 mx-3 border-t border-white/[0.06]" />}
        {renderNavGroup(systemItems)}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-white/[0.06]">
        <Link to="/account"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            location.pathname === '/account'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
          } ${collapsed ? 'justify-center' : ''}`}>
          <div className={`flex-shrink-0 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs ${collapsed ? 'w-8 h-8' : 'w-8 h-8'}`}>
            {(displayName || user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/70 truncate font-medium">{displayName || user?.displayName || user?.email}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider leading-none mt-0.5">{t("nav.account")}</div>
            </div>
          )}
        </Link>
        {!collapsed ? (
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg text-xs text-white/30 hover:text-red-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span>{t('nav.signOut')}</span>
          </button>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center mt-1 py-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"
            title={t('nav.signOut')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
  };

  return (
    <div className="flex min-h-screen bg-surface-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-slate-200/50">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold text-secondary tracking-tight font-display">myfynzo</span>
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-secondary flex flex-col
          transition-transform duration-300 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex bg-secondary text-white flex-col transition-all duration-300 ease-out sticky top-0 h-screen ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:mt-0 mt-14">
        {children}
      </main>

      {/* Premium Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUpgrade(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-secondary mb-2">Premium is Coming Soon</h3>
              <p className="text-sm text-slate-500 mb-6">
                This feature requires a Premium plan. Join the waitlist to be the first to know when Premium launches — and get early-bird pricing.
              </p>
              <div className="space-y-3">
                <Link to="/account" onClick={() => setShowUpgrade(false)}
                  className="block w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                  View Plans & Join Waitlist
                </Link>
                <button onClick={() => setShowUpgrade(false)}
                  className="block w-full py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all">
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
