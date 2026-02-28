import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SidebarLayout from './SidebarLayout';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    // Use real SidebarLayout so sidebar is mounted once — no layout jump
    return (
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
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
