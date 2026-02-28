import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { clearCountryCache } from '../components/CountryGate';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // Track last login timestamp
      if (u) {
        updateDoc(doc(db, 'users', u.uid), { lastLogin: serverTimestamp() }).catch(() => {});
      }
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      clearCountryCache();
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
    // Always redirect to landing — after signOut so auth state is already cleared
    window.location.replace('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
