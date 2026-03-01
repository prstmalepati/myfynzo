import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { LocaleProvider } from './context/LocaleContext';
import { UserProfileProvider } from './context/UserProfileContext';
import { PartnerProvider } from './context/PartnerContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import PremiumRoute from './components/PremiumRoute';
import { CountryGate } from './components/CountryGate';
import { PageErrorBoundary } from './components/ErrorBoundary';
import FynzoPulse from './components/FynzoPulse';
import CookieConsent from './components/CookieConsent';
import OfflineBanner from './components/OfflineBanner';

// ─── Eager-loaded pages (critical path) ─────────────────────────
import LandingPageExtended from './pages/LandingPageExtended';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';

// ─── Lazy-loaded pages ──────────────────────────────────────────
const Investments = lazy(() => import('./pages/Investments'));
const WealthProjection = lazy(() => import('./pages/WealthProjection'));
const Calculators = lazy(() => import('./pages/Calculators'));
const Account = lazy(() => import('./pages/Account'));

// ─── Lazy-loaded pages (less frequent) ──────────────────────────
const IncomeDebts = lazy(() => import('./pages/IncomeDebts'));
const LifestyleBasket = lazy(() => import('./pages/LifestyleBasket'));
const AntiPortfolio = lazy(() => import('./pages/AntiPortfolio'));
const ScenarioBranching = lazy(() => import('./pages/ScenarioBranching'));
const GoalTracker = lazy(() => import('./pages/GoalTracker'));
const FinancialLab = lazy(() => import('./pages/FinancialLab'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));
const SecurityPrivacy = lazy(() => import('./pages/SecurityPrivacy'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const About = lazy(() => import('./pages/About'));
const FamilyInvite = lazy(() => import('./pages/FamilyInvite'));
// Legal pages
const Impressum = lazy(() => import('./pages/Impressum'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

// ─── Loading spinner for lazy routes ────────────────────────────
// Only shows content area skeleton — sidebar is already mounted by SidebarLayout
function PageLoader() {
  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* Sidebar placeholder — matches SidebarLayout width to prevent layout shift */}
      <div className="hidden lg:block w-[260px] flex-shrink-0" />
      {/* Content skeleton */}
      <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="h-7 w-48 bg-slate-200/60 rounded-lg mb-6 animate-pulse" />
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-100/80 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-slate-100/60 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <PageErrorBoundary section="App">
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <LocaleProvider>
            <CurrencyProvider>
              <UserProfileProvider>
              <PartnerProvider>
                <BrowserRouter>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Public Routes — available everywhere */}
                      <Route path="/" element={<LandingPageExtended />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/family-invite" element={<FamilyInvite />} />
                      <Route path="/impressum" element={<Impressum />} />
                      <Route path="/privacy" element={<PrivacyPolicy />} />

                      {/* Country-gated — India & Germany only */}
                      <Route path="/login" element={<CountryGate mode="signup"><Login /></CountryGate>} />
                      <Route path="/signup" element={<CountryGate mode="signup"><Signup /></CountryGate>} />
                      <Route path="/blog" element={<CountryGate mode="page"><Blog /></CountryGate>} />
                      <Route path="/blog/:slug" element={<CountryGate mode="page"><BlogPost /></CountryGate>} />

                      {/* Protected Routes — requires auth + country access */}
                      <Route path="/dashboard" element={<CountryGate mode="page"><ProtectedRoute><Dashboard /></ProtectedRoute></CountryGate>} />
                      <Route path="/wealth-projection" element={<CountryGate mode="page"><ProtectedRoute><WealthProjection /></ProtectedRoute></CountryGate>} />
                      <Route path="/investments" element={<CountryGate mode="page"><ProtectedRoute><Investments /></ProtectedRoute></CountryGate>} />
                      <Route path="/debts" element={<Navigate to="/income-debts" replace />} />
                      <Route path="/income-debts" element={<CountryGate mode="page"><ProtectedRoute><PremiumRoute feature="Income & Debts"><IncomeDebts /></PremiumRoute></ProtectedRoute></CountryGate>} />
                      <Route path="/lifestyle-basket" element={<CountryGate mode="page"><ProtectedRoute><PremiumRoute feature="Lifestyle Basket"><LifestyleBasket /></PremiumRoute></ProtectedRoute></CountryGate>} />
                      {/* Redirects for old URLs */}
                      <Route path="/earnings-lifestyle" element={<Navigate to="/income-debts" replace />} />
                      <Route path="/income" element={<Navigate to="/income-debts" replace />} />
                      <Route path="/anti-portfolio" element={<Navigate to="/financial-lab" replace />} />
                      <Route path="/scenario-branching" element={<Navigate to="/financial-lab" replace />} />
                      <Route path="/goal-tracker" element={<Navigate to="/goals" replace />} />
                      <Route path="/goals" element={<CountryGate mode="page"><ProtectedRoute><PremiumRoute feature="Goals"><GoalTracker /></PremiumRoute></ProtectedRoute></CountryGate>} />
                      <Route path="/financial-lab" element={<CountryGate mode="page"><ProtectedRoute><PremiumRoute feature="Financial Lab"><FinancialLab /></PremiumRoute></ProtectedRoute></CountryGate>} />
                      <Route path="/calculators" element={<CountryGate mode="page"><ProtectedRoute><Calculators /></ProtectedRoute></CountryGate>} />
                      <Route path="/settings" element={<CountryGate mode="page"><ProtectedRoute><Settings /></ProtectedRoute></CountryGate>} />
                      <Route path="/account" element={<CountryGate mode="page"><ProtectedRoute><Account /></ProtectedRoute></CountryGate>} />
                      <Route path="/security" element={<CountryGate mode="page"><ProtectedRoute><SecurityPrivacy /></ProtectedRoute></CountryGate>} />
                      <Route path="/admin" element={<CountryGate mode="page"><ProtectedRoute><Admin /></ProtectedRoute></CountryGate>} />

                      {/* Catch all */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                  <FynzoPulse />
                  <CookieConsent />
                  <OfflineBanner />
                </BrowserRouter>
              </PartnerProvider>
              </UserProfileProvider>
            </CurrencyProvider>
          </LocaleProvider>
        </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </PageErrorBoundary>
  );
}
