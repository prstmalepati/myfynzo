import { Link } from 'react-router-dom';
import { useTier } from '../hooks/useTier';
import SidebarLayout from './SidebarLayout';

export default function PremiumRoute({ children, feature }: { children: React.ReactNode; feature?: string }) {
  const { isFree, loading } = useTier();

  if (loading) return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="h-7 w-48 bg-slate-200/60 rounded-lg mb-6 animate-pulse" />
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-100/80 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-slate-100/60 rounded-2xl animate-pulse" />
      </div>
    </SidebarLayout>
  );

  if (isFree) {
    return (
      <SidebarLayout>
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-10 text-center mt-12">
            <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-secondary mb-2 font-display">Premium Feature</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              {feature || 'This feature'} is available on the Premium plan. Join the waitlist to be notified when Premium launches.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/account"
                className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                View Plans & Join Waitlist
              </Link>
              <Link to="/dashboard"
                className="px-6 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return <>{children}</>;
}
