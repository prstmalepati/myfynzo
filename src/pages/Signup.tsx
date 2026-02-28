import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendEmailVerification, signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { detectCountry, GeoResult } from '../services/geoLocation';
import { SUPPORTED_COUNTRIES } from '../constants/countries';

// Password strength scoring
function getPasswordStrength(pw: string): { score: number; label: string; color: string; tips: string[] } {
  const tips: string[] = [];
  let score = 0;
  if (pw.length >= 8) score++; else tips.push('At least 8 characters');
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++; else tips.push('One uppercase letter');
  if (/[a-z]/.test(pw)) score++; else tips.push('One lowercase letter');
  if (/[0-9]/.test(pw)) score++; else tips.push('One number');
  if (/[^A-Za-z0-9]/.test(pw)) score++; else tips.push('One special character (!@#$...)');
  if (score <= 2) return { score, label: 'Weak', color: 'bg-amber-500', tips };
  if (score <= 4) return { score, label: 'Good', color: 'bg-blue-500', tips };
  return { score, label: 'Strong', color: 'bg-emerald-500', tips };
}

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);

  const pwStrength = useMemo(() => getPasswordStrength(password), [password]);

  // Detect country on page load
  useEffect(() => {
    detectCountry().then(setGeo).catch(() => {});
  }, []);

  const detectedCountry = SUPPORTED_COUNTRIES.find(c =>
    c.code === geo?.countryCode || c.name === geo?.country
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agreedTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (pwStrength.score < 3) {
      setError('Password is too weak. Please add: ' + pwStrength.tips.join(', '));
      return;
    }

    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        displayName: '',
        createdAt: new Date(),
        country: geo?.country || '',
        countryCode: geo?.countryCode || '',
        currency: geo?.currency || 'EUR',
        preferredCurrency: geo?.currency || 'EUR',
        locale: geo?.locale || 'en',
        tier: 'free',
        provider: 'email',
        emailVerified: false,
        agreedTermsAt: new Date(),
        signupIP: '', // Server-side only
        lastLogin: new Date(),
      });

      // Send verification email — Firebase built-in first (always reliable)
      try {
        await sendEmailVerification(result.user);
      } catch (emailErr) {
        console.warn('[Signup] Firebase verification email failed:', emailErr);
      }
      // Also try branded email via Cloud Function (non-blocking)
      try {
        const functions = getFunctions();
        const sendVerify = httpsCallable(functions, 'sendVerificationEmail');
        sendVerify({}).catch(() => {}); // Fire and forget
      } catch {}

      setRegisteredEmail(email);
      setRegistered(true);
      await signOut(auth);
    } catch (err: any) {
      const code = err?.code || '';
      const friendlyErrors: Record<string, string> = {
        'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password is too weak. Use at least 8 characters with mixed character types.',
        'auth/operation-not-allowed': 'Account creation is currently disabled. Please try again later.',
        'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
        'auth/network-request-failed': 'Connection error. Please check your internet and try again.',
      };
      setError(friendlyErrors[code] || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    if (!agreedTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      const isNewUser = !userDoc.exists();

      if (isNewUser) {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          displayName: result.user.displayName || '',
          createdAt: new Date(),
          country: geo?.country || '',
          countryCode: geo?.countryCode || '',
          currency: geo?.currency || 'EUR',
          preferredCurrency: geo?.currency || 'EUR',
          locale: geo?.locale || 'en',
          tier: 'free',
          provider: 'google',
          emailVerified: true,
          agreedTermsAt: new Date(),
          lastLogin: new Date(),
        });
      }

      if (isNewUser) {
        setRegisteredEmail(result.user.email || '');
        setRegistered(true);
        setTimeout(() => navigate(redirectTo), 4000);
      } else {
        navigate(redirectTo);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        const friendlyErrors: Record<string, string> = {
          'auth/account-exists-with-different-credential': 'An account with this email exists using a different sign-in method.',
          'auth/popup-blocked': 'Pop-up was blocked by your browser. Please allow pop-ups for this site.',
          'auth/network-request-failed': 'Connection error. Please check your internet and try again.',
          'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
        };
        setError(friendlyErrors[err.code] || 'Something went wrong with Google sign-up. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Registration Success Screen ──
  if (registered) {
    const isGoogle = registeredEmail && !password;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-white p-6">
        <div className="max-w-md w-full text-center animate-fadeIn">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
            <div className="relative w-24 h-24 bg-gradient-to-br from-primary to-teal-600 rounded-full flex items-center justify-center shadow-xl shadow-primary/20">
              {isGoogle ? (
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              )}
            </div>
          </div>

          {isGoogle ? (
            <>
              <h1 className="text-3xl font-bold text-secondary mb-3 font-display">Welcome to myfynzo!</h1>
              <p className="text-slate-500 mb-2">Your account is set up and ready to go.</p>
              {detectedCountry && (
                <p className="text-sm text-slate-400 mb-4">
                  {detectedCountry.flag} Configured for <strong>{detectedCountry.name}</strong>
                </p>
              )}
              <p className="text-sm text-slate-400 mb-8">Redirecting you to your dashboard...</p>
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-secondary mb-3 font-display">Check your email!</h1>
              <p className="text-slate-500 mb-2">We've sent a verification link to</p>
              <p className="text-lg font-semibold text-secondary mb-6">{registeredEmail}</p>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
                <div className="flex items-start gap-3 text-left">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-secondary mb-1">Check your inbox & spam folder</p>
                    <p className="text-xs text-slate-500">Click the activation link from <strong>support@myfynzo.com</strong> to verify your account. The link expires in 24 hours.</p>
                  </div>
                </div>
              </div>

              {detectedCountry && (
                <p className="text-xs text-slate-400 mb-4">
                  {detectedCountry.flag} Your account is configured for <strong>{detectedCountry.name}</strong> — you can change this later in Settings.
                </p>
              )}

              <Link to="/login"
                className="inline-block px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 mb-4">
                Go to Login
              </Link>
              <div>
                <Link to="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">← Back to home</Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

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
          <p className="text-sm font-medium text-primary tracking-[0.2em] mb-8">Your Wealth. AI-Guided.</p>
          <p className="text-2xl text-white/80 font-display font-bold leading-snug mb-4">
            Own your numbers.<br />Shape your outcomes.<br /><span className="text-primary">Start today.</span>
          </p>
          <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
            Join thousands who've stopped guessing and started planning — with AI that understands your finances as well as you do.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md animate-fadeIn">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-12 h-12" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-secondary font-display leading-none">myfynzo</span>
              <span className="text-[10px] font-medium text-primary tracking-[0.15em] mt-1">Your Wealth. AI-Guided.</span>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-secondary mb-2 font-display">Create your account</h2>
          <p className="text-slate-500 mb-1">Start your wealth management journey</p>

          {/* Detected country */}
          {detectedCountry && (
            <div className="flex items-center gap-1.5 mb-6">
              <span className="text-sm">{detectedCountry.flag}</span>
              <span className="text-xs text-slate-400">Signing up from <strong className="text-slate-600">{detectedCountry.name}</strong></span>
            </div>
          )}
          {!detectedCountry && <div className="mb-6" />}

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">{error}</div>
          )}

          {/* Terms agreement */}
          <label className="flex items-start gap-3 mb-5 cursor-pointer group">
            <input type="checkbox" checked={agreedTerms} onChange={e => setAgreedTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" />
            <span className="text-xs text-slate-500 leading-relaxed">
              I agree to the <a href="/terms" target="_blank" className="text-primary font-semibold hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" className="text-primary font-semibold hover:underline">Privacy Policy</a>. I understand my data is stored securely in the EU.
            </span>
          </label>

          <button
            onClick={handleGoogleSignup} disabled={loading}
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

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-sm text-slate-400">or</span>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-secondary placeholder-slate-400" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-secondary placeholder-slate-400 pr-12" placeholder="Min. 8 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= pwStrength.score ? pwStrength.color : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold ${pwStrength.score <= 2 ? 'text-amber-600' : pwStrength.score <= 4 ? 'text-blue-600' : 'text-emerald-600'}`}>
                      {pwStrength.label}
                    </span>
                    {pwStrength.tips.length > 0 && (
                      <span className="text-[10px] text-slate-400">Add: {pwStrength.tips.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                className={`w-full px-4 py-3 rounded-xl border text-secondary placeholder-slate-400 transition-all ${
                  confirmPassword && confirmPassword !== password ? 'border-amber-300 focus:border-amber-400' : 'border-slate-200'
                }`} placeholder="••••••••" />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[10px] text-amber-600 mt-1">Passwords don't match</p>
              )}
            </div>
            <button type="submit" disabled={loading || !agreedTerms}
              className={`w-full py-3 rounded-xl font-semibold transition-all text-white shadow-lg shadow-primary/20 ${
                loading || !agreedTerms ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
          <div className="mt-3 text-center">
            <Link to="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">← Back to home</Link>
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
