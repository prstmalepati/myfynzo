// =============================================================
// hooks/useEmailVerification.ts
// =============================================================
// Handles email verification banner state + resend logic,
// extracted from Dashboard.tsx to reduce its complexity.

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, auth as firebaseAuth } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

export function useEmailVerification() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified ?? false);

  const isEmailUser = user?.providerData?.some(p => p.providerId === 'password');

  // Refresh emailVerified status on load (catches verification done in another tab)
  useEffect(() => {
    if (user && isEmailUser && !user.emailVerified) {
      user.reload().then(() => {
        if (user.emailVerified) {
          setEmailVerified(true);
          setDoc(doc(db, 'users', user.uid), { emailVerified: true }, { merge: true }).catch(() => {});
        }
      }).catch(() => {});
    } else if (user?.emailVerified) {
      setEmailVerified(true);
    }
  }, [user]);

  const needsVerification = isEmailUser && !emailVerified && !dismissed;

  const resend = async () => {
    setResending(true);
    try {
      const fns = getFunctions();
      const sendVerify = httpsCallable(fns, 'sendVerificationEmail');
      await sendVerify({});
      setSent(true);
    } catch {
      // Fallback to Firebase built-in
      try {
        if (firebaseAuth.currentUser) {
          await sendEmailVerification(firebaseAuth.currentUser);
          setSent(true);
        }
      } catch {}
    }
    setResending(false);
  };

  return {
    needsVerification,
    resending,
    sent,
    dismiss: () => setDismissed(true),
    resend,
  };
}
