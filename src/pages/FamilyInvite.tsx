import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export default function FamilyInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inviteCode = params.get('code');

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!inviteCode) { setError('No invite code provided'); setLoading(false); return; }
    const loadInvite = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'family_invites', 'codes', inviteCode));
        if (!snap.exists()) { setError('Invite not found or expired'); setLoading(false); return; }
        const data = snap.data();
        if (data.used) { setError('This invite has already been used'); setLoading(false); return; }
        if (data.expiresAt && data.expiresAt.toDate() < new Date()) { setError('This invite has expired'); setLoading(false); return; }
        setInvite(data);
      } catch (err) { setError('Failed to load invite'); console.error(err); }
      finally { setLoading(false); }
    };
    loadInvite();
  }, [inviteCode]);

  const handleAccept = async () => {
    if (!user || !invite || !inviteCode) return;
    if (user.uid === invite.primaryUid) { setError("You can't accept your own invite"); return; }
    setAccepting(true);
    try {
      const now = new Date();

      // Set linked partner's tier and family link
      await setDoc(doc(db, 'users', user.uid), {
        tier: 'family_linked',
        familyLink: {
          primaryUid: invite.primaryUid,
          primaryEmail: invite.primaryEmail,
          primaryName: invite.primaryName,
          linkedAt: now,
        },
        updatedAt: now,
      }, { merge: true });

      // Update primary partner's family link with this partner's info
      await updateDoc(doc(db, 'users', invite.primaryUid), {
        familyLink: {
          partnerUid: user.uid,
          partnerEmail: user.email,
          partnerName: user.displayName || user.email?.split('@')[0] || 'Partner',
          linkedAt: now,
        },
        partnerName: user.displayName || user.email?.split('@')[0] || 'Partner',
        updatedAt: now,
      });

      // Mark invite as used
      await updateDoc(doc(db, 'system', 'family_invites', 'codes', inviteCode), {
        used: true, usedBy: user.uid, usedAt: now,
      });

      setSuccess(true);
    } catch (err: any) {
      console.error('[FamilyInvite] Accept error:', err);
      setError(`Failed to accept invite: ${err?.message || ''}`);
    } finally { setAccepting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading invite...</div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-10 text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-secondary mb-2 font-display">You're linked!</h2>
        <p className="text-sm text-slate-500 mb-6">
          You're now connected to <strong>{invite.primaryName}</strong>'s Family Premium plan. You have full Premium access to all features.
        </p>
        <button onClick={() => navigate('/dashboard')}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-10 text-center max-w-md">
        {error ? (
          <>
            <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-secondary mb-2 font-display">Invite Error</h2>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
            <Link to="/" className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 inline-block">
              Go Home
            </Link>
          </>
        ) : !user ? (
          <>
            <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-violet-400 to-primary rounded-2xl flex items-center justify-center text-3xl">
              👨‍👩‍👧
            </div>
            <h2 className="text-2xl font-bold text-secondary mb-2 font-display">Family Invite</h2>
            <p className="text-sm text-slate-500 mb-2">
              <strong>{invite?.primaryName}</strong> has invited you to join their Family Premium plan on myfynzo.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Sign up or log in to accept this invitation and get full Premium access.
            </p>
            <div className="flex flex-col gap-3">
              <Link to={`/signup?redirect=/family-invite?code=${inviteCode}`}
                className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                Create Account
              </Link>
              <Link to={`/login?redirect=/family-invite?code=${inviteCode}`}
                className="px-8 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all">
                I already have an account
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-violet-400 to-primary rounded-2xl flex items-center justify-center text-3xl">
              👨‍👩‍👧
            </div>
            <h2 className="text-2xl font-bold text-secondary mb-2 font-display">Family Invite</h2>
            <p className="text-sm text-slate-500 mb-6">
              <strong>{invite?.primaryName}</strong> has invited you to join their Family Premium plan. Accept to get full Premium access and manage your own financial data.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
              <div className="text-xs text-slate-400 mb-1">You'll be logged in as</div>
              <div className="text-sm font-semibold text-secondary">{user.displayName || user.email}</div>
              <div className="text-xs text-slate-400 mt-2">Linked to</div>
              <div className="text-sm font-semibold text-secondary">{invite?.primaryName} ({invite?.primaryEmail})</div>
            </div>
            <button onClick={handleAccept} disabled={accepting}
              className={`w-full px-8 py-3 font-semibold rounded-xl transition-all shadow-lg ${
                accepting ? 'bg-slate-300 text-slate-500' : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
              }`}>
              {accepting ? 'Linking...' : 'Accept & Join Family Plan'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
