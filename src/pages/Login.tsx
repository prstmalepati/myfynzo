import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendEmailVerification, signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { detectCountry, GeoResult } from '../services/geoLocation';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const justVerified = searchParams.get('verified') === 'true';

  // Detect country on page load
  useEffect(() => {
    detectCountry().then(setGeo).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);

      // Allow login even if unverified — show activation reminder in-app
      // Update emailVerified flag if user verified via link
      if (result.user.emailVerified) {
        try {
          await setDoc(doc(db, 'users', result.user.uid), { emailVerified: true, lastLogin: new Date() }, { merge: true });
        } catch {}
      }

      navigate(redirectTo);
    } catch (err: any) {
      const code = err?.code || '';
      const friendlyErrors: Record<string, string> = {
        'auth/invalid-credential': 'Incorrect email or password. Please try again.',
        'auth/user-not-found': 'No account found with this email. Would you like to create one?',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/user-disabled': 'This account has been disabled. Please contact support.',
        'auth/too-many-requests': 'Too many failed attempts. Please wait a moment and try again.',
        'auth/network-request-failed': 'Connection error. Please check your internet and try again.',
      };
      setError(friendlyErrors[code] || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      // Sign in temporarily to call cloud function
      const result = await signInWithEmailAndPassword(auth, email, password);
      try {
        const fns = getFunctions();
        const sendVerify = httpsCallable(fns, 'sendVerificationEmail');
        await sendVerify({});
      } catch {
        // Fallback to Firebase built-in
        await sendEmailVerification(result.user);
      }
      await signOut(auth);
      setResent(true);
    } catch {
      setError('Could not resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          createdAt: new Date(),
          country: geo?.country || '',
          currency: geo?.currency || 'EUR',
          preferredCurrency: geo?.currency || 'EUR',
          locale: geo?.locale || 'en',
          tier: 'free',
          provider: 'google'
        });
      }
      navigate(redirectTo);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in was cancelled.');
      } else {
        const friendlyErrors: Record<string, string> = {
          'auth/account-exists-with-different-credential': 'An account with this email exists using a different sign-in method.',
          'auth/popup-blocked': 'Pop-up was blocked by your browser. Please allow pop-ups for this site.',
          'auth/network-request-failed': 'Connection error. Please check your internet and try again.',
          'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
        };
        setError(friendlyErrors[err.code] || 'Something went wrong with Google sign-in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12">
          <img src="/logo-transparent.png" alt="myfynzo" className="w-24 h-24 mx-auto mb-8 animate-float" />
          <h1 className="text-5xl font-bold text-white mb-2 font-display">myfynzo</h1>
          <p className="text-sm font-medium text-primary tracking-[0.2em] mb-8">Your Wealth. Reimagined by AI.</p>
          <p className="text-2xl text-white/80 font-display font-bold leading-snug mb-4">
            Your finances.<br />Your outcomes.<br /><span className="text-primary">Your future.</span>
          </p>
          <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
            myfynzo puts you in control — AI-powered insights on your real portfolio, expenses, and goals. Because the best financial decisions start with knowing your real numbers.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md animate-fadeIn">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-12 h-12" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-secondary font-display leading-none">myfynzo</span>
              <span className="text-[10px] font-medium text-primary tracking-[0.15em] mt-1">Your Wealth. Reimagined by AI.</span>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-secondary mb-2 font-display">Welcome back</h2>
          <p className="text-slate-500 mb-8">Sign in to your account to continue</p>

          {/* Email verified success */}
          {justVerified && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Email verified successfully! Sign in to continue.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              {error}
            </div>
          )}

          {/* Unverified email warning */}
          {unverified && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Email not verified</p>
                  <p className="text-xs text-amber-700 mb-3">Please check your inbox and click the verification link before signing in.</p>
                  {resent ? (
                    <p className="text-xs text-green-700 font-semibold">Verification email sent! Check your inbox.</p>
                  ) : (
                    <button onClick={handleResendVerification} disabled={resending}
                      className="text-xs font-semibold text-amber-800 underline hover:text-amber-900 transition-colors">
                      {resending ? 'Sending...' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full mb-5 px-5 py-3 rounded-xl border border-slate-200 bg-white font-medium text-secondary
              hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-sm text-slate-400">or</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-secondary placeholder-slate-400 transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-secondary placeholder-slate-400 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold transition-all text-white shadow-lg shadow-primary/20 ${
                loading ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-semibold hover:underline">Create one</Link>
          </p>
          <div className="mt-3 text-center">
            <Link to="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              ← Back to home
            </Link>
          </div>

          {/* Trust signals */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🔐', text: 'AES-256 encryption' },
                { icon: '🇪🇺', text: 'EU data residency' },
                { icon: '🛡️', text: 'GDPR compliant' },
              ].map((t, i) => (
                <div key={i} className="text-center">
                  <div className="text-base mb-0.5">{t.icon}</div>
                  <div className="text-[10px] text-slate-400 font-medium leading-tight">{t.text}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-300 text-center mt-3">
              Your data is stored in Frankfurt, Germany. We never sell or share your financial data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
