import { Link } from 'react-router-dom';

const PILLARS = [
  {
    icon: '🧠',
    title: 'AI That Knows Your Money',
    desc: 'fynzo Intelligence reads your real portfolio, expenses, debts, and goals — then gives you advice that\'s actually about your money. Not generic tips from the internet.',
    gradient: 'from-primary to-teal-600',
  },
  {
    icon: '🌍',
    title: 'Built for the World',
    desc: 'Country-specific tax calculators, multi-currency support, and localized interfaces. Your country, your rules, your numbers.',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    icon: '📊',
    title: 'Complete Financial Picture',
    desc: 'Investments, monthly plans, expenses, debts, goals, wealth projections, scenario modeling, and FIRE calculations — all connected in one platform.',
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    icon: '🔒',
    title: 'Privacy by Design',
    desc: 'Your financial data belongs to you. EU-hosted infrastructure, encrypted at rest, GDPR compliant. We never sell or share your data. Period.',
    gradient: 'from-emerald-500 to-green-600',
  },
];

const DIFFERENTIATORS = [
  { them: 'Generic budgeting apps', us: 'AI advisor that analyzes your complete financial picture' },
  { them: 'One-country tax tools', us: '4-country tax engines (DE, US, CA, IN) with 2025 rules' },
  { them: 'Portfolio trackers only', us: 'Investments + Expenses + Debts + Goals + Projections — all connected' },
  { them: 'Manual data everywhere', us: 'Auto-fetch between pages — enter once, flows everywhere' },
  { them: 'English-only interfaces', us: 'Multi-language support with culturally relevant defaults' },
  { them: 'Flat monthly tracking', us: 'Decade-long wealth projections with inflation and scenario modeling' },
];

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-12 h-12 object-contain" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-secondary tracking-tight font-display leading-none">myfynzo</span>
              <span className="text-[10px] font-medium text-primary tracking-[0.15em] mt-1">Your Wealth. Reimagined by AI.</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-slate-500 hover:text-secondary transition-colors font-medium">← Home</Link>
            <Link to="/signup" className="px-5 py-2 bg-secondary text-white text-sm font-semibold rounded-lg hover:bg-secondary/90 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-16 pb-20 px-6 bg-gradient-to-br from-secondary via-surface-700 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto relative text-center">
          <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">About myfynzo</p>
          <h1 className="text-3xl lg:text-5xl font-bold text-white font-display tracking-tight leading-tight mb-6">
            One platform for every<br />
            <span className="text-primary">financial decision you'll ever make.</span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
            myfynzo — <em className="text-white/70 not-italic">my finance outcomes</em> — is an AI-powered wealth management platform that brings your entire financial life into one clear, intelligent view. We built it because no tool on the market does this well enough.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-16 lg:py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">The problem</p>
            <h2 className="text-2xl lg:text-3xl font-bold text-secondary font-display tracking-tight mb-6">
              Your financial life is scattered across a dozen tools.
            </h2>
            <div className="space-y-4 text-slate-600 leading-relaxed">
              <p>
                You track investments in one app, expenses in another, debts on a spreadsheet, and tax planning in your head. Each tool shows you one slice of the picture. None of them talk to each other. And none of them understand your specific country's tax rules.
              </p>
              <p>
                The result? You're making financial decisions — some of the most important decisions of your life — based on fragmented, incomplete information. You don't know your real numbers.
              </p>
              <p className="text-secondary font-semibold">
                We built myfynzo to fix this.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Four Pillars */}
      <section className="py-16 lg:py-24 px-6 bg-slate-50/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">What makes us different</p>
            <h2 className="text-2xl lg:text-3xl font-bold text-secondary font-display tracking-tight">
              Four pillars. Zero compromise.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {PILLARS.map((p, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-2xl mb-5 shadow-lg`}>
                  {p.icon}
                </div>
                <h3 className="text-lg font-bold text-secondary font-display mb-2">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's Inside */}
      <section className="py-16 lg:py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">Everything connected</p>
            <h2 className="text-2xl lg:text-3xl font-bold text-secondary font-display tracking-tight">
              Nine modules. One truth.
            </h2>
            <p className="text-slate-500 mt-3 max-w-lg mx-auto">Every piece of your financial life feeds into every other piece. Enter data once — it flows everywhere automatically.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { emoji: '📊', name: 'Dashboard', desc: 'Net worth, allocation, and performance at a glance' },
              { emoji: '🔮', name: 'Wealth Projector', desc: 'See where your wealth is heading — 1 to 50 years out' },
              { emoji: '💼', name: 'Investment Hub', desc: 'Holdings + monthly plans with live market prices' },
              { emoji: '💳', name: 'Debt Manager', desc: 'Avalanche vs snowball — optimize your payoff strategy' },
              { emoji: '🛒', name: 'Lifestyle Basket', desc: '10 categories of real expenses with inflation tracking' },
              { emoji: '🎯', name: 'Goal Tracker', desc: 'Set targets, track progress, stay accountable' },
              { emoji: '🔀', name: 'Scenario Branching', desc: 'Model job changes, relocations, kids, sabbaticals' },
              { emoji: '🧮', name: 'Tax Calculators', desc: 'Country-specific: DE, US, CA, IN — updated for 2025' },
              { emoji: '✨', name: 'fynzo Intelligence AI', desc: 'Personal AI advisor that knows your real numbers' },
            ].map((m, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-2xl">{m.emoji}</span>
                <div>
                  <h4 className="text-sm font-bold text-secondary">{m.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Us vs Them */}
      <section className="py-16 lg:py-24 px-6 bg-gradient-to-br from-secondary to-surface-700">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">Why myfynzo</p>
            <h2 className="text-2xl lg:text-3xl font-bold text-white font-display tracking-tight">
              What others offer vs. what you get.
            </h2>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 px-4 mb-2">
              <span className="text-xs font-semibold text-white/30 uppercase tracking-wide">Typical apps</span>
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">myfynzo</span>
            </div>
            {DIFFERENTIATORS.map((d, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-sm text-white/40">{d.them}</p>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                  <p className="text-sm text-white font-medium">{d.us}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-16 lg:py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">Our philosophy</p>
          <h2 className="text-2xl lg:text-3xl font-bold text-secondary font-display tracking-tight mb-8">
            We believe financial clarity is a right, not a luxury.
          </h2>
          <div className="space-y-6 text-slate-600 leading-relaxed text-left">
            <p>
              Most people don't have a money problem. They have a <strong className="text-secondary">visibility problem</strong>. They earn enough, save reasonably, invest occasionally — but they've never seen all of it in one place. They've never had an AI look at their complete picture and say: <em>"Here's where you stand. Here's what to do next."</em>
            </p>
            <p>
              That's what myfynzo does. We connect every piece of your financial life — investments, expenses, debts, goals, tax obligations, and projections — into a single intelligent platform. We built country-specific tax engines because a tool that doesn't understand your tax reality is lying to you about your wealth.
            </p>
            <p>
              We offer a generous free tier because we believe everyone deserves to see their real numbers. Premium unlocks the AI advisor, advanced projections, and power features — but the foundation is free, forever.
            </p>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="py-16 px-6 bg-slate-50/80">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { number: '9', label: 'Connected modules' },
              { number: '4', label: 'Country tax engines' },
              { number: '3', label: 'Languages supported' },
              { number: '∞', label: 'Wealth projections' },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-3xl lg:text-4xl font-bold text-primary font-display">{s.number}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-2xl lg:text-3xl font-bold text-secondary font-display tracking-tight mb-4">
          Ready to see your real numbers?
        </h2>
        <p className="text-slate-500 max-w-md mx-auto mb-8">
          Start free. No credit card required. See your complete financial picture in under 5 minutes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/signup"
            className="px-7 py-3.5 bg-secondary text-white rounded-xl font-semibold hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/10">
            Create Your Free Account →
          </Link>
          <Link to="/blog"
            className="px-7 py-3.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all">
            Read Our Blog
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-100 bg-white text-center">
        <p className="text-xs text-slate-400">© 2026 myfynzo · Your Wealth. Reimagined by AI.</p>
      </footer>
    </div>
  );
}
