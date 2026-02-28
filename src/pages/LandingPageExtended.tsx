/**
 * LandingPageExtended.tsx — v15 Premium Wealth Platform
 * ─────────────────────────────────────────────────────
 * Design: InvestMates-inspired card layouts, bold typography,
 *         mixed image + mockup cards, text flag badges
 * AI:    fynzo Intelligence (replaces Pulse)
 * Flags: Text badges (DE/IN) instead of emoji for cross-browser
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BLOG_POSTS } from '../data/blogData';

/* ── Country profiles (no NRI community) ── */
const COUNTRIES = [
  { code:'DE', country:'Germany', currency:'€', tagline:'Ehegattensplitting, Riester, 42% Spitzensteuersatz — we calculate it all.', features:['German tax optimizer (2025/2026)','Kirchensteuer by Bundesland','Grundfreibetrag tracking','ETF Sparplan projections'], pricing:{free:'€0',premium:'€5.99',premiumYear:'€59',duo:'€8.99',duoYear:'€89',annualOnly:false}, bg:'bg-[#0c0c1d]', accent:'text-yellow-400' },
  { code:'IN', country:'India', currency:'₹', tagline:'Old vs New regime, 80C, NPS, HRA — see your true take-home instantly.', features:['Old vs New tax regime comparison','Section 80C/80D/80E optimizer','NPS & EPF tax benefit calculator','HRA & home loan deduction planner'], pricing:{free:'₹0',premium:'₹299',premiumYear:'₹2,999',duo:'₹599',duoYear:'₹5,999',annualOnly:true}, bg:'bg-orange-700', accent:'text-orange-300' },
];

/* ── Feature modules ── */
const FEATURES = [
  { icon:'✨', title:'fynzo Intelligence', desc:'Your personal AI advisor that reads your real portfolio, expenses, and goals — then gives advice about your money.', badge:'AI' },
  { icon:'📊', title:'Smart Dashboard', desc:'Net worth, health score, allocation and AI-powered insights — everything at a glance.' },
  { icon:'💼', title:'Investment Hub', desc:'Track stocks, ETFs, crypto, gold & silver with live market prices from global exchanges.' },
  { icon:'🔮', title:'Wealth Projector', desc:'50-year projections with inflation, tax impact, and multiple scenario modeling.' },
  { icon:'🧮', title:'Tax Calculators', desc:'Smart tax engines updated annually. See your real take-home, optimize deductions, and plan cross-border moves.' },
  { icon:'💰', title:'Earnings & Lifestyle', desc:'Income, living costs, lifestyle expenses, and debts — unified with interactive charts.', badge:'PRO' },
  { icon:'🧪', title:'Financial Lab', desc:'Scenario branching, anti-portfolio tracking, and goal tracker — your experimentation space.', badge:'PRO' },
  { icon:'🔥', title:'FIRE Calculator', desc:'Financial independence with country-specific inflation, pension, and withdrawal strategies.' },
];

/* ── Differentiators ── */
const DIFFS = [
  { icon:'🧠', title:'AI That Knows Your Numbers', desc:'fynzo Intelligence reads your actual portfolio, expenses, debts, and goals. Advice about YOUR money — not generic tips.', tag:"Powered by Anthropic's Claude AI" },
  { icon:'🌍', title:'Multi-Country Support', desc:'Country-specific tax calculators, localized currencies, and region-aware financial planning for global professionals.', tag:'Multiple countries live. More coming soon.' },
  { icon:'🛡️', title:'Privacy-First Architecture', desc:'No Plaid. No bank linking. No third-party data sharing. You enter your data, we protect it. Encryption at rest and in transit.', tag:'GDPR compliant from day one' },
  { icon:'📈', title:'Complete Financial Picture', desc:'Investments, income, expenses, debts, goals, insurance, lifestyle inflation — everything in one place with AI connecting the dots.', tag:'Not just a portfolio tracker' },
];

/* ── Flag badge component (cross-browser safe) ── */
function Flag({ code, size='md' }: { code: string, size?: 'sm'|'md'|'lg' }) {
  const colors: Record<string,string> = {
    DE: 'bg-gradient-to-b from-black via-red-600 to-yellow-400 text-white',
    IN: 'bg-gradient-to-b from-orange-500 via-white to-green-600 text-slate-800',
    EU: 'bg-blue-700 text-yellow-300',
  };
  const sizes = { sm:'w-5 h-3.5 text-[7px]', md:'w-7 h-5 text-[9px]', lg:'w-9 h-6 text-[10px]' };
  return <span className={`inline-flex items-center justify-center rounded-sm font-bold ${colors[code]||'bg-slate-300 text-slate-600'} ${sizes[size]} shadow-sm`}>{code}</span>;
}

/* ── Check icon ── */
const Chk = () => <svg className="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>;
const ChevDown = () => <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>;

export default function LandingPageExtended() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [ac, setAc] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [showWL, setShowWL] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [vc, setVc] = useState('');
  const [mob, setMob] = useState(false);

  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h); }, []);
  useEffect(() => {
    import('../services/geoLocation').then(({ detectCountry }) => {
      detectCountry().then(geo => {
        if (geo.country === 'India') setAc(1); else setAc(0);
        setVc(geo.country); setAllowed(['India','Germany'].includes(geo.country));
      });
    }).catch(() => {});
  }, []);

  const gated = (e: React.MouseEvent) => { if (!allowed) { e.preventDefault(); setShowWL(true); } };
  const cp = COUNTRIES[ac];
  const pr = cp.pricing;

  // Redirect authenticated users immediately — no landing page flash
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#fafbfc] antialiased">

      {/* ══════ NAVBAR ══════ */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-slate-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-12 h-12 object-contain" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-secondary tracking-tight font-display leading-none">myfynzo</span>
              <span className="text-[10px] font-semibold text-primary tracking-[0.15em] leading-none mt-1">Your Wealth. Reimagined by AI.</span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-8 text-sm">
            {[['Solutions','#solutions'],['Features','#features'],['Why myfynzo','#difference'],['Pricing','#pricing']].map(([label,href]) => <a key={href} href={href} className="text-slate-500 hover:text-secondary transition-colors font-medium">{label}</a>)}
            <Link to="/blog" className="text-slate-500 hover:text-secondary transition-colors font-medium">Blog</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" onClick={gated} className="hidden sm:block text-sm text-slate-600 hover:text-secondary font-medium px-4 py-2">Sign In</Link>
            <Link to="/signup" onClick={gated} className="px-6 py-2.5 bg-secondary text-white text-sm font-semibold rounded-full hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/10">Get Started Free</Link>
            <button onClick={() => setMob(!mob)} className="lg:hidden p-2 text-slate-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={mob ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg></button>
          </div>
        </div>
        {mob && <div className="lg:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-3">
          {[['Solutions','#solutions'],['Features','#features'],['Why myfynzo','#difference'],['Pricing','#pricing']].map(([label,href]) => <a key={href} href={href} onClick={() => setMob(false)} className="block text-sm text-slate-600 font-medium py-1.5">{label}</a>)}
          <Link to="/blog" onClick={() => setMob(false)} className="block text-sm text-slate-600 font-medium py-1.5">Blog</Link>
        </div>}
      </nav>

      {/* ══════ HERO ══════ */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-teal-50/30 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/[0.03] rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
            <div>
              {/* Platform pill */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white border border-slate-200/80 rounded-full text-sm text-slate-600 mb-8 shadow-sm">
                <span className="text-base">✨</span><span className="font-medium">AI-Powered Wealth Platform</span><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-bold text-secondary leading-[1.06] tracking-tight mb-7 font-display">
                {cp.code === 'IN' ? (
                  <>Know your<br className="hidden sm:block" /> real wealth.<br />
                  <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">Grow it with AI.</span></>
                ) : (
                  <>Know your<br className="hidden sm:block" /> real numbers.<br />
                  <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">Build wealth with clarity.</span></>
                )}
              </h1>
              <p className="text-lg lg:text-xl text-slate-500 leading-relaxed mb-10 max-w-xl">
                {cp.code === 'IN'
                  ? 'AI-powered wealth management built for India. Track your mutual funds, stocks, gold & FDs. Compare Old vs New tax regime. Plan your financial independence — all in one place.'
                  : 'AI-powered wealth management for people who take their money seriously. Track investments, optimize taxes, and plan your financial independence.'}
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                <Link to="/signup" onClick={gated} className="px-8 py-4 bg-secondary text-white rounded-full font-bold text-base hover:bg-secondary/90 transition-all shadow-xl shadow-secondary/15 hover:-translate-y-0.5 flex items-center gap-2">Get Started Free <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg></Link>
                <a href="#solutions" className="px-8 py-4 border-2 border-slate-200 text-slate-700 rounded-full font-bold text-base hover:border-slate-300 hover:bg-white transition-all">Explore Solutions</a>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
                {(cp.code === 'IN'
                  ? ['Free forever tier','Bank-grade security','No credit card','Your data stays private']
                  : ['Free forever tier','GDPR compliant','No credit card','Privacy-first']
                ).map((t,i) => (
                  <span key={i} className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span>{t}</span>
                ))}
              </div>
            </div>

            {/* Right — 3D Browser Mockup */}
            <div className="relative hidden lg:block" style={{minHeight:'460px',width:'540px',perspective:'1800px'}}>
              <div className="relative transition-transform duration-700 hover:[transform:rotateY(-4deg)_rotateX(3deg)_translateZ(20px)]" style={{transform:'rotateY(-12deg) rotateX(6deg)',transformStyle:'preserve-3d'}}>
                <div className="rounded-2xl overflow-hidden shadow-[30px_30px_80px_rgba(0,0,0,0.15)] border border-slate-200/60" style={{background:'rgba(255,255,255,0.97)'}}>
                  {/* Browser chrome */}
                  <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-3">
                    <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-200" /><div className="w-2.5 h-2.5 rounded-full bg-slate-200" /><div className="w-2.5 h-2.5 rounded-full bg-slate-200" /></div>
                    <div className="flex-1 bg-white rounded-lg px-3 py-1 flex items-center gap-2 border border-slate-100"><svg className="w-2.5 h-2.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg><span className="text-[10px] text-slate-400">myfynzo.com/dashboard</span></div>
                  </div>
                  {/* App content */}
                  <div className="flex" style={{minHeight:'320px'}}>
                    <div className="w-[52px] bg-secondary flex-shrink-0 p-2">
                      <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center mb-4 mx-auto"><img src="/logo-transparent.png" alt="" className="w-5 h-5 object-contain" /></div>
                      {['📊','🔮','💼','🎯','💳','⚙️'].map((icon,i) => (<div key={i} className={`w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center ${i === 0 ? 'bg-primary' : 'bg-white/5'}`}><span className="text-[10px]">{icon}</span></div>))}
                    </div>
                    <div className="flex-1 bg-slate-50/80 p-4">
                      <div className="flex items-center justify-between mb-3"><div><div className="text-[8px] text-slate-400">Welcome back</div><div className="text-xs font-bold text-secondary">Dashboard</div></div><div className="flex items-center gap-2"><span className="px-2 py-0.5 bg-primary/10 rounded-md text-[7px] text-primary font-bold">Premium</span><div className="w-6 h-6 bg-primary/10 rounded-full" /></div></div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-gradient-to-br from-secondary to-slate-700 rounded-xl p-2.5 text-white"><div className="text-[6px] text-white/40 uppercase tracking-wider">Net Worth</div><div className="text-sm font-bold mt-0.5">{cp.code === 'IN' ? '₹47.2L' : `${cp.currency}47,230`}</div><div className="text-[7px] text-emerald-400 font-semibold mt-0.5">+12.4% all time</div></div>
                        <div className="bg-white rounded-xl p-2.5 border border-slate-100"><div className="text-[6px] text-slate-400 uppercase tracking-wider">Portfolio</div><div className="text-sm font-bold text-secondary mt-0.5">{cp.code === 'IN' ? '₹35.2L' : `${cp.currency}35,200`}</div><div className="text-[7px] text-emerald-600 font-semibold mt-0.5">+{cp.code === 'IN' ? '₹3.9L' : `${cp.currency}3,920`} ↑</div></div>
                        <div className="bg-white rounded-xl p-2.5 border border-slate-100"><div className="text-[6px] text-slate-400 uppercase tracking-wider">{cp.code === 'IN' ? 'Monthly SIP' : 'Monthly Invest'}</div><div className="text-sm font-bold text-secondary mt-0.5">{cp.code === 'IN' ? '₹25K' : `${cp.currency}1,200`}</div><div className="text-[7px] text-slate-400 mt-0.5">{cp.code === 'IN' ? '5 active SIPs' : '5 active plans'}</div></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-white rounded-xl p-3 border border-slate-100"><div className="flex items-center justify-between mb-2"><span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider">Wealth Projection</span><span className="text-[7px] font-bold text-primary">{cp.currency}412K in 15yr</span></div><svg viewBox="0 0 220 55" className="w-full h-14"><defs><linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity="0.2"/><stop offset="100%" stopColor="#0f766e" stopOpacity="0"/></linearGradient></defs><path d="M0,48 C30,45 70,38 110,28 S180,10 220,3" fill="none" stroke="#0f766e" strokeWidth="1.8"/><path d="M0,48 C30,45 70,38 110,28 S180,10 220,3 L220,55 L0,55Z" fill="url(#hg1)"/><path d="M0,50 C30,48 70,42 110,34 S180,18 220,12" fill="none" stroke="#94a3b8" strokeWidth="0.7" strokeDasharray="3,3"/><circle cx="170" cy="12" r="2.5" fill="#0f766e"/></svg></div>
                        <div className="w-28 bg-white rounded-xl p-3 border border-slate-100"><div className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-2">Allocation</div><svg viewBox="0 0 50 50" className="w-11 h-11 mx-auto mb-2"><circle cx="25" cy="25" r="18" fill="none" stroke="#0f766e" strokeWidth="5" strokeDasharray="39 113"/><circle cx="25" cy="25" r="18" fill="none" stroke="#2563eb" strokeWidth="5" strokeDasharray="25 113" strokeDashoffset="-39"/><circle cx="25" cy="25" r="18" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray="20 113" strokeDashoffset="-64"/><circle cx="25" cy="25" r="18" fill="none" stroke="#8b5cf6" strokeWidth="5" strokeDasharray="29 113" strokeDashoffset="-84"/><circle cx="25" cy="25" r="12" fill="white"/></svg>{[{c:'#0f766e',n:'ETFs'},{c:'#2563eb',n:'Stocks'},{c:'#f59e0b',n:'Crypto'},{c:'#8b5cf6',n:'Other'}].map((a,i) => (<div key={i} className="flex items-center gap-1 mb-0.5"><span className="w-1 h-1 rounded-sm" style={{backgroundColor:a.c}}/><span className="text-[6px] text-slate-400">{a.n}</span></div>))}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{background:'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.04) 100%)'}} />
              </div>
              {/* Floating AI card */}
              <div className="absolute -left-6 bottom-16 z-10 bg-gradient-to-br from-primary to-emerald-700 rounded-2xl px-5 py-4 shadow-xl shadow-primary/20" style={{animation:'float 6s ease-in-out infinite'}}>
                <div className="text-[9px] text-white/60 font-semibold uppercase tracking-wider">✨ fynzo Intelligence</div>
                <div className="text-sm font-bold text-white mt-1">Optimize debt ↓</div>
                <div className="text-[11px] text-white/70">Save {cp.currency}2,400/year</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ SOLUTIONS — InvestMates-style large visual cards ══════ */}
      <section id="solutions" className="py-24 lg:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-primary tracking-widest uppercase mb-4">What we solve</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-display text-secondary leading-tight">Your complete wealth<br className="hidden sm:block" /> management suite</h2>
            <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">Advanced tools and AI-powered insights to make every financial decision clearer.</p>
          </div>

          {/* Bento grid — mixed image + mockup cards */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Card 1 — Dashboard (large, with mockup) */}
            <div className="group bg-white rounded-3xl border border-slate-200/70 p-8 lg:p-10 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/60 transition-all duration-500 relative">
              <h3 className="text-2xl lg:text-3xl font-bold text-secondary font-display mb-3">Unified Wealth View</h3>
              <p className="text-base text-slate-500 leading-relaxed mb-8 max-w-sm">Track all your investments, across countries, in a single intelligent dashboard.</p>
              {/* Mini dashboard mockup */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 relative">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-secondary to-slate-700 rounded-xl p-3.5 text-white"><div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Net Worth</div><div className="text-lg font-bold mt-1">{cp.code === 'IN' ? '₹47.2L' : `${cp.currency}47,230`}</div><div className="text-[10px] text-emerald-400 font-bold mt-0.5">+12.4%</div></div>
                  <div className="bg-white rounded-xl p-3.5 border border-slate-100 shadow-sm"><div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">{cp.code === 'IN' ? 'Portfolio' : 'Investments'}</div><div className="text-lg font-bold text-secondary mt-1">{cp.code === 'IN' ? '₹35.2L' : `${cp.currency}35,200`}</div></div>
                  <div className="bg-white rounded-xl p-3.5 border border-slate-100 shadow-sm"><div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Savings Rate</div><div className="text-lg font-bold text-primary mt-1">34%</div></div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 bg-white rounded-xl p-3 border border-slate-100"><div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2">Allocation</div><div className="flex gap-1 h-3 rounded-full overflow-hidden"><div className="bg-primary w-[40%]" /><div className="bg-blue-500 w-[25%]" /><div className="bg-amber-400 w-[20%]" /><div className="bg-purple-500 w-[15%]" /></div></div>
                  <div className="flex-1 bg-white rounded-xl p-3 border border-slate-100"><div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2">Health Score</div><div className="text-2xl font-bold text-primary">87<span className="text-sm text-slate-300">/100</span></div></div>
                </div>
                {/* Floating stat bubble */}
                <div className="absolute -top-3 -right-3 bg-white rounded-xl px-4 py-2.5 shadow-lg border border-slate-100">
                  <div className="text-primary font-bold text-sm">+19%</div>
                  <div className="text-[10px] text-slate-400">This quarter</div>
                </div>
              </div>
            </div>

            {/* Card 2 — Wealth Projector (with chart mockup) */}
            <div className="group bg-white rounded-3xl border border-slate-200/70 p-8 lg:p-10 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/60 transition-all duration-500 relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-xs text-blue-600 font-semibold mb-4">Financial Planning</div>
              <h3 className="text-2xl lg:text-3xl font-bold text-secondary font-display mb-3">Wealth Projector</h3>
              <p className="text-base text-slate-500 leading-relaxed mb-8 max-w-sm">See your financial future — 50-year projections calibrated to your country's tax rules and inflation.</p>
              {/* Chart mockup */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 relative">
                <svg viewBox="0 0 400 140" className="w-full" style={{maxHeight:'160px'}}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity="0.15"/><stop offset="100%" stopColor="#0f766e" stopOpacity="0"/></linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[35,70,105].map(y => <line key={y} x1="40" y1={y} x2="380" y2={y} stroke="#e2e8f0" strokeWidth="0.5" />)}
                  {/* Labels */}
                  <text x="15" y="38" fill="#94a3b8" fontSize="9" fontFamily="system-ui">{cp.currency}2.9M</text>
                  <text x="15" y="73" fill="#94a3b8" fontSize="9" fontFamily="system-ui">{cp.currency}1.7M</text>
                  <text x="15" y="108" fill="#94a3b8" fontSize="9" fontFamily="system-ui">{cp.currency}1.2M</text>
                  {['40','45','50','55','60'].map((a,i) => <text key={a} x={80+i*72} y="130" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="system-ui">{a}</text>)}
                  {/* Projection curve */}
                  <path d="M60,110 C120,105 180,85 250,60 S340,20 370,10" fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M60,110 C120,105 180,85 250,60 S340,20 370,10 L370,120 L60,120Z" fill="url(#pg)" />
                  {/* Dotted alternative */}
                  <path d="M60,110 C120,107 180,95 250,80 S340,55 370,45" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4" />
                  <circle cx="250" cy="60" r="5" fill="#0f766e" />
                  <circle cx="250" cy="60" r="8" fill="none" stroke="#0f766e" strokeWidth="1" opacity="0.3" />
                </svg>
                {/* Stat overlay */}
                <div className="absolute top-4 right-4 bg-white rounded-xl px-4 py-3 shadow-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-semibold uppercase">Monthly</div>
                  <div className="text-lg font-bold text-secondary">{cp.currency}1,400<span className="text-[10px] text-slate-400 font-normal">/mo</span></div>
                  <div className="text-[9px] text-slate-400 font-semibold uppercase mt-2">Goal net worth</div>
                  <div className="text-lg font-bold text-primary">{cp.currency}2.9M</div>
                </div>
              </div>
            </div>

            {/* Card 3 — AI Intelligence (dark card) */}
            <div className="group bg-gradient-to-br from-secondary via-[#1e2a4a] to-[#0f172a] rounded-3xl p-8 lg:p-10 overflow-hidden hover:shadow-2xl hover:shadow-secondary/30 transition-all duration-500 text-white relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-full text-xs text-primary font-semibold mb-4">Powered by AI</div>
              <h3 className="text-2xl lg:text-3xl font-bold font-display mb-3">fynzo Intelligence</h3>
              <p className="text-base text-white/50 leading-relaxed mb-8 max-w-sm">Your personal AI financial advisor that reads your real data and gives advice about <em className="text-white/70 not-italic font-medium">your</em> money.</p>
              {/* Chat mockup */}
              <div className="bg-white/[0.06] backdrop-blur-sm rounded-2xl border border-white/10 p-4 space-y-3">
                <div className="flex justify-end"><div className="bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[75%]"><p className="text-[12px]">Am I on track for early retirement?</p></div></div>
                <div className="flex justify-start"><div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]"><p className="text-[11px] text-white/70">Based on your portfolio of <strong className="text-white">{cp.currency}47,230</strong> and <strong className="text-white">{cp.currency}1,200/mo</strong> investments:</p><div className="mt-2 space-y-1.5">{[{c:'bg-emerald-400',t:`FIRE target: ${cp.currency}612K`},{c:'bg-primary',t:'Timeline: 14.2 years'},{c:'bg-amber-400',t:`To hit 12yr: ${cp.currency}1,580/mo`}].map((r,i) => (<div key={i} className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${r.c}`} /><span className="text-[10px] text-white/60"><strong className="text-white/80">{r.t}</strong></span></div>))}</div></div></div>
              </div>
              {/* Glow effects */}
              <div className="absolute top-10 right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-10 left-10 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Card 4 — Tax & Real-Time (split card) */}
            <div className="group bg-white rounded-3xl border border-slate-200/70 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/60 transition-all duration-500">
              <div className="grid sm:grid-cols-2 h-full">
                <div className="p-8 lg:p-10 flex flex-col justify-center">
                  <h3 className="text-2xl lg:text-3xl font-bold text-secondary font-display mb-3">Tax Calculators</h3>
                  <p className="text-base text-slate-500 leading-relaxed mb-6">Country-specific engines updated annually. See your real tax-home — not estimates.</p>
                  <div className="space-y-2.5">
                    {(['Income tax optimizer','Deduction & exemption finder','Cross-border tax support','Real-time take-home calculator']).map((f,i) => (
                      <div key={i} className="flex items-center gap-2.5"><Chk /><span className="text-sm text-slate-600">{f}</span></div>
                    ))}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex flex-col justify-center items-center border-l border-slate-100">
                  {/* Mini stat cards like InvestMates */}
                  <div className="space-y-3 w-full max-w-[200px]">
                    {[{l:'Tax Calculator',v:'Live',c:'text-emerald-600'},{l:'Exchange Rates',v:'Real-time',c:'text-blue-600'},{l:'Market Prices',v:'Live',c:'text-emerald-600'},{l:'Languages',v:'Multi',c:'text-secondary'}].map((s,i) => (
                      <div key={i} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">{s.l}</span>
                        <span className={`text-xs font-bold flex items-center gap-1.5 ${s.c}`}><span className="w-1.5 h-1.5 bg-current rounded-full" />{s.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ FEATURES GRID ══════ */}
      <section id="features" className="py-24 lg:py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-primary tracking-widest uppercase mb-4">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-display text-secondary">Powerful modules.<br className="hidden sm:block" /> <span className="text-primary">One platform.</span></h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((m, i) => (
              <div key={i} className="group relative bg-[#fafbfc] rounded-2xl border border-slate-100 p-6 hover:bg-white hover:border-transparent hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1">
                {m.badge && <span className={`absolute top-4 right-4 text-[9px] font-bold px-2.5 py-1 rounded-full ${m.badge === 'AI' ? 'bg-primary text-white' : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'}`}>{m.badge}</span>}
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-2xl mb-5 group-hover:scale-110 group-hover:shadow-md transition-all">{m.icon}</div>
                <h3 className="font-bold text-secondary text-base mb-2 font-display">{m.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
          {/* Extra: Privacy pill */}
          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center gap-3 bg-slate-900 text-white rounded-full px-6 py-3">
              <span className="text-lg">🔒</span>
              <span className="text-sm font-medium">Privacy by Design — No Plaid. No bank linking. No third-party data sharing. GDPR compliant.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ WHY MYFYNZO — Dark section with 2x3 grid like InvestMates "Digital Family Office" ══════ */}
      <section id="difference" className="py-24 lg:py-32 px-6 bg-gradient-to-br from-[#0a0e1a] via-[#111827] to-[#0a0e1a] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute top-20 right-10 w-80 h-80 bg-primary/8 rounded-full blur-3xl" /><div className="absolute bottom-10 left-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" /></div>
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — 2x2 mini feature grid (like InvestMates' dark card) */}
            <div className="bg-white/[0.04] backdrop-blur-sm rounded-3xl border border-white/[0.08] p-6 lg:p-8">
              <div className="grid grid-cols-2 gap-4">
                {[{t:'Wealth Projector',v:`${cp.currency}412K`,s:'in 15 years',icon:'📈'},{t:'Tax Saved',v:`${cp.currency}3,800`,s:'this year',icon:'🧮'},{t:'FIRE Progress',v:'47%',s:'on track',icon:'🔥'},{t:'Health Score',v:'87/100',s:'excellent',icon:'💪'}].map((c2,i) => (
                  <div key={i} className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.1] transition-colors">
                    <div className="text-2xl mb-3">{c2.icon}</div>
                    <div className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">{c2.t}</div>
                    <div className="text-xl font-bold text-white mt-1">{c2.v}</div>
                    <div className="text-[11px] text-primary font-semibold mt-0.5">{c2.s}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right — Text content */}
            <div>
              <p className="text-sm font-bold text-primary tracking-widest uppercase mb-4">Why myfynzo</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-display text-white leading-tight mb-8">What makes us<br /><span className="text-primary">different.</span></h2>
              <div className="space-y-6">
                {DIFFS.map((d, i) => (
                  <div key={i} className="group flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-xl flex-shrink-0 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">{d.icon}</div>
                    <div>
                      <h4 className="text-base font-bold text-white mb-1 font-display">{d.title}</h4>
                      <p className="text-sm text-white/40 leading-relaxed mb-2">{d.desc}</p>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary"><span className="w-1 h-1 bg-primary rounded-full" />{d.tag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ COUNTRY SUPPORT ══════ */}
      <section className="py-24 lg:py-32 px-6 bg-[#fafbfc]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-primary tracking-widest uppercase mb-4">Country-aware</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-display text-secondary">Your country. Your rules.<br className="hidden sm:block" /> <span className="text-primary">Your numbers.</span></h2>
            <p className="text-lg text-slate-500 mt-4 max-w-xl mx-auto">Tax brackets, social security, inflation rates — calibrated to where you live.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {COUNTRIES.map((c2, i) => (
              <button key={i} onClick={() => setAc(i)} className={`px-6 py-3 rounded-full text-sm font-semibold transition-all flex items-center gap-2.5 ${ac === i ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}><Flag code={c2.code} size="sm" />{c2.country}</button>
            ))}
            <span className="px-6 py-3 rounded-full text-sm font-semibold flex items-center gap-2.5 bg-slate-50 border-2 border-dashed border-slate-300 text-slate-400 cursor-default">
              <Flag code="EU" size="sm" />Europe <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold ml-1">COMING SOON</span>
            </span>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg overflow-hidden">
            <div className="grid lg:grid-cols-2">
              <div className="p-10 lg:p-12">
                <div className="flex items-center gap-4 mb-6"><Flag code={cp.code} size="lg" /><div><h3 className="text-2xl font-bold text-secondary font-display">{cp.country}</h3><p className="text-sm text-slate-500">{cp.tagline}</p></div></div>
                <div className="space-y-3.5 mb-8">
                  {cp.features.map((f, i) => (<div key={i} className="flex items-start gap-3"><Chk /><span className="text-sm text-slate-700">{f}</span></div>))}
                </div>
                <Link to="/signup" onClick={gated} className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary text-white rounded-full font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/15">Start with {cp.country} <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></Link>
              </div>
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-secondary p-10 lg:p-12 text-white flex flex-col justify-center">
                <div className="text-xs text-white/50 uppercase tracking-widest font-bold mb-4">Platform Status</div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[{l:'Tax Calculator',s:'Live'},{l:'Market Prices',s:'Live'},{l:'Exchange Rates',s:'Real-time'},{l:'Language',s:ac===0?'DE / EN':'TA / EN'}].map((item,i) => (
                    <div key={i} className="bg-white/10 rounded-xl px-4 py-3 text-xs"><div className="text-white/40 font-medium">{item.l}</div><div className="font-bold flex items-center gap-1.5 mt-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />{item.s}</div></div>
                  ))}
                </div>
                <div className="text-sm text-white/25">More countries coming — France, Netherlands, Austria, Switzerland.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section className="py-24 lg:py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-primary tracking-widest uppercase mb-4">3 steps</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-display text-secondary">From signup to clarity<br className="hidden sm:block" /> <span className="text-primary">in 5 minutes.</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10 max-w-4xl mx-auto">
            {[{s:'01',t:'Set your country',d:`Select your country — tax rules, language, and defaults adapt automatically.`,cl:'bg-primary'},{s:'02',t:'Add your portfolio',d:'Enter investments, goals, and lifestyle items. Live prices update via market data.',cl:'bg-blue-600'},{s:'03',t:'See your real numbers',d:'Tax-aware projections, FIRE calculations, and AI insights — calibrated to your reality.',cl:'bg-emerald-600'}].map((s,i) => (
              <div key={i} className="text-center"><div className={`w-16 h-16 ${s.cl} rounded-2xl flex items-center justify-center text-white text-lg font-bold mb-6 mx-auto shadow-lg`}>{s.s}</div><h3 className="text-xl font-bold text-secondary mb-3 font-display">{s.t}</h3><p className="text-sm text-slate-500 leading-relaxed">{s.d}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PRICING ══════ */}
      <section id="pricing" className="py-24 lg:py-32 px-6 bg-[#fafbfc]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-primary tracking-widest uppercase mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-display"><span className="text-secondary">Start free.</span>{' '}<span className="text-primary">Upgrade when ready.</span></h2>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-400">
              <span>Prices in</span><span className="font-medium text-slate-600">{cp.currency}</span>
              {pr.annualOnly && <span className="text-primary font-semibold ml-2">· Annual billing</span>}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-xl transition-all duration-300">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Free</div>
              <div className="text-4xl font-bold text-secondary mb-1 font-display">{pr.free}</div>
              <div className="text-sm text-slate-500 mb-8">Forever. No card required.</div>
              <ul className="space-y-3 mb-8">{['Up to 3 holdings','2 recurring investments','5-year projection','Investment Returns calc','Retirement calculator','Dashboard overview'].map((f,i) => <li key={i} className="flex items-center gap-2.5 text-sm text-slate-600"><Chk />{f}</li>)}</ul>
              <Link to="/signup" onClick={gated} className="block w-full py-3 text-center border-2 border-slate-200 text-slate-700 rounded-full font-semibold hover:bg-slate-50 text-sm transition-colors">Get Started</Link>
            </div>
            {/* Premium */}
            <div className="bg-secondary rounded-3xl p-8 text-white relative overflow-hidden hover:shadow-2xl ring-2 ring-primary/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-8 translate-x-8" />
              <span className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full">Popular</span>
              <div className="relative">
                <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Premium</div>
                <div className="flex items-baseline gap-1 mb-1"><span className="text-4xl font-bold font-display">{pr.annualOnly ? pr.premiumYear : pr.premium}</span><span className="text-white/60 text-sm">{pr.annualOnly ? '/year' : '/month'}</span></div>
                <div className="text-xs text-white/50 mb-8">{pr.annualOnly ? `That's just ${pr.premium}/mo` : `or ${pr.premiumYear}/year — save 18%`}</div>
                <ul className="space-y-3 mb-8">{['Unlimited investments','50-year projection','All tax calculators','fynzo Intelligence AI','FIRE Calculator','Earnings & Lifestyle','Financial Lab','Live market prices','Priority support'].map((f,i) => (<li key={i} className="flex items-center gap-2.5 text-sm text-white/80"><svg className="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>{f}</li>))}</ul>
                <Link to="/signup" onClick={gated} className="block w-full py-3 text-center bg-primary text-white rounded-full font-semibold hover:bg-primary/90 shadow-lg shadow-primary/30 text-sm transition-colors">{pr.annualOnly ? 'Subscribe Now' : 'Start Premium'}</Link>
              </div>
            </div>
            {/* Family Premium */}
            <div className="bg-gradient-to-br from-violet-50 to-amber-50 rounded-3xl border border-violet-200/60 p-8 hover:shadow-xl relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-200/30 rounded-full blur-3xl -translate-y-8 translate-x-8" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3"><span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Family Premium</span></div>
                <div className="flex items-baseline gap-1 mb-1"><span className="text-4xl font-bold text-secondary font-display">{pr.annualOnly ? pr.duoYear : pr.duo}</span><span className="text-slate-500 text-sm">{pr.annualOnly ? '/year' : '/month'}</span></div>
                <div className="text-xs text-slate-500 mb-8">{pr.annualOnly ? 'For 2 people' : `or ${pr.duoYear}/year for 2`}</div>
                {/* Family visual */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-4 mb-6"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-primary/40 flex items-center justify-center text-[10px] text-white font-bold">1</div><div className="w-8 h-8 rounded-full bg-violet-400/40 flex items-center justify-center text-[10px] text-white font-bold">2</div><span className="text-[11px] text-white/50 font-medium">2 users, 1 subscription</span></div></div>
                <ul className="space-y-3 mb-8">{['Everything in Premium','Invite your partner','Joint wealth projection','Combined dashboard','Shared goals'].map((f,i) => (<li key={i} className="flex items-center gap-2.5 text-sm text-slate-600"><svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>{f}</li>))}</ul>
                <Link to="/signup" onClick={gated} className="block w-full py-3 text-center bg-gradient-to-r from-violet-500 to-primary text-white rounded-full font-semibold hover:opacity-90 shadow-lg shadow-violet-500/20 text-sm transition-colors">Start Family Premium</Link>
              </div>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-slate-400">All subscriptions are non-refundable. {pr.annualOnly ? 'Annual billing only.' : 'Monthly or annual. Cancel anytime.'}</p>
        </div>
      </section>

      {/* ══════ BLOG PREVIEW ══════ */}
      <section className="py-24 lg:py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div><p className="text-sm font-bold text-primary tracking-widest uppercase mb-4">From the blog</p><h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-display"><span className="text-secondary">Learn.</span>{' '}<span className="text-primary">Build wealth.</span></h2></div>
            <Link to="/blog" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5">View all posts <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {BLOG_POSTS.slice(0,3).map(bp => (
              <Link key={bp.slug} to={`/blog/${bp.slug}`} className="group bg-[#fafbfc] rounded-2xl border border-slate-100 hover:bg-white hover:border-transparent hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className={`h-40 bg-gradient-to-br ${bp.coverGradient} flex items-center justify-center`}><span className="text-5xl opacity-80 group-hover:scale-110 transition-transform duration-300">{bp.coverEmoji}</span></div>
                <div className="p-6"><span className="text-[10px] font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-full">{bp.category}</span><h3 className="font-bold text-secondary text-base mt-3 mb-2 leading-snug group-hover:text-primary transition-colors">{bp.title}</h3><p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{bp.subtitle}</p><div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400"><span>{bp.readTime}</span><span>·</span><span>{new Date(bp.publishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section className="py-24 lg:py-32 px-6 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 font-display"><span className="text-secondary">Your financial clarity</span>{' '}<span className="text-primary">starts here.</span></h2>
          <p className="text-lg text-slate-500 mb-8 max-w-xl mx-auto">Join thousands who are building wealth with real numbers and AI-powered insights.</p>
          <div className="flex items-center justify-center gap-3 mb-8">{COUNTRIES.map((c2,i) => <Flag key={i} code={c2.code} size="lg" />)}<div className="flex items-center gap-1.5 ml-2"><Flag code="EU" size="lg" /><span className="text-xs text-blue-500 font-bold">soon</span></div></div>
          <Link to="/signup" onClick={gated} className="inline-flex items-center gap-2 px-10 py-4 bg-secondary text-white rounded-full font-bold text-lg hover:bg-secondary/90 transition-all shadow-xl shadow-secondary/15">Create Your Free Account <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg></Link>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-3xl font-bold text-secondary font-display mb-10 text-center">Frequently Asked Questions</h3>
          <div className="space-y-3">
            {[
              {q:'Is myfynzo free?',a:'Yes. The free tier gives you a dashboard, up to 5 investments, tax calculator, and goal tracker — forever. Premium unlocks unlimited investments, AI advisor, FIRE calculator, Financial Lab, and more.'},
              {q:'Which countries are supported?',a:'We currently support multiple countries with localized tax calculators, language support, and region-specific features. More countries are being added — check the Country Support section below.'},
              {q:'Is my data secure?',a:'Yes. We use Firebase with encryption at rest and in transit. GDPR compliant. No Plaid or third-party bank linking. Your data never leaves your account.'},
              {q:'What is fynzo Intelligence?',a:"fynzo Intelligence is our AI financial advisor powered by Anthropic's Claude. It reads your real portfolio, expenses, debts, and goals — then gives personalized, actionable advice."},
              {q:'Can I use it for tax planning?',a:'Yes. We have country-specific tax calculators updated annually, plus DTAA support for cross-border situations. Each supported country has its own optimized tax engine.'},
              {q:'How do I cancel?',a:'Go to Account → Subscription. Cancel anytime. Premium features remain active until the billing period ends. No refunds for the current period.'},
            ].map((faq,i) => (
              <details key={i} className="group rounded-2xl border border-slate-200 bg-[#fafbfc] hover:bg-white transition-colors"><summary className="flex items-center justify-between px-6 py-5 cursor-pointer text-base font-semibold text-secondary hover:text-primary transition-colors list-none">{faq.q}<ChevDown /></summary><div className="px-6 pb-5 text-sm text-slate-500 leading-relaxed">{faq.a}</div></details>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ DISCLOSURES ══════ */}
      <section className="py-12 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Important Disclosures</h4>
          <div className="text-[11px] text-slate-400 leading-relaxed space-y-2">
            <p><strong>Not Financial Advice:</strong> myfynzo provides tools for educational purposes only. Consult qualified professionals before making financial decisions.</p>
            <p><strong>Tax Accuracy:</strong> Calculations based on published tax rules. Actual liability depends on individual circumstances.</p>
            <p><strong>Investment Risk:</strong> All investments carry risk. Projections are estimates, not guarantees.</p>
            <p><strong>Privacy:</strong> GDPR compliant. Firebase encryption. No third-party data sharing.</p>
            <p><strong>Regulatory:</strong> myfynzo is not a registered financial advisor, broker-dealer, or investment advisor.</p>
          </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-14 px-6 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4"><img src="/logo-transparent.png" alt="myfynzo" className="w-12 h-12 object-contain" /><div className="flex flex-col"><span className="text-2xl font-bold text-secondary font-display leading-none">myfynzo</span><span className="text-[10px] font-semibold text-primary tracking-[0.15em] leading-none mt-1">Your Wealth. Reimagined by AI.</span></div></div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-4">AI-powered wealth management for people who take their money seriously.</p>
              <div className="flex gap-2">{COUNTRIES.map((c2,i) => <Flag key={i} code={c2.code} />)}<div className="flex items-center gap-1"><Flag code="EU" /><span className="text-[9px] text-blue-400 font-bold">soon</span></div></div>
            </div>
            {[{t:'Product',ls:[['Features','#features'],['Pricing','#pricing'],['Solutions','#solutions'],['Blog','/blog'],['About','/about']]},{t:'Legal',ls:[['Privacy Policy','/privacy'],['Impressum','/impressum'],['Terms','#'],['GDPR','#']]},{t:'Connect',ls:[['support@myfynzo.com','mailto:support@myfynzo.com'],['Twitter','#'],['LinkedIn','#']]}].map((col,i) => (
              <div key={i}><h4 className="text-sm font-bold text-secondary mb-4">{col.t}</h4><ul className="space-y-2.5">{col.ls.map(([label,href],j) => <li key={j}>{href.startsWith('/') ? <Link to={href} className="text-sm text-slate-400 hover:text-primary transition-colors">{label}</Link> : <a href={href} className="text-sm text-slate-400 hover:text-primary transition-colors">{label}</a>}</li>)}</ul></div>
            ))}
          </div>
          <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs text-slate-400">© 2026 myfynzo · Your Wealth. Reimagined by AI.</p>
            <div className="flex gap-5 text-xs text-slate-400"><Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link><Link to="/impressum" className="hover:text-primary transition-colors">Impressum</Link><a href="mailto:support@myfynzo.com" className="hover:text-primary transition-colors">Contact</a></div>
          </div>
        </div>
      </footer>

      {/* Waitlist Modal */}
      {showWL && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6" onClick={() => setShowWL(false)}>
          <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowWL(false)} className="absolute top-5 right-5 text-slate-300 hover:text-slate-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-5 bg-primary/10 rounded-2xl flex items-center justify-center"><img src="/logo-transparent.png" alt="" className="w-10 h-10 object-contain" /></div>
              <h3 className="text-2xl font-bold text-secondary font-display mb-3">Coming soon to {vc || 'your region'}</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">myfynzo is expanding to more countries. Join our waitlist to get early access when we launch in your region.</p>
              <a href={`mailto:hello@myfynzo.com?subject=Waitlist from ${vc}`} className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary text-white rounded-full font-semibold text-sm hover:bg-primary/90 shadow-lg shadow-primary/15">Join the Waitlist</a>
              <div className="mt-8 flex items-center justify-center gap-2.5 text-xs text-slate-300"><span>Live in</span>{COUNTRIES.map((c2,i) => <span key={i} className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100 text-slate-400 font-medium flex items-center gap-1.5"><Flag code={c2.code} size="sm" />{c2.country}</span>)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
