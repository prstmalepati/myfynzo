// =============================================================
// context/PartnerContext.tsx — Family Premium partner system
// =============================================================
// Primary partner (tier: 'couples') can view linked partner's data.
// Linked partner (tier: 'family_linked') manages own data independently.
//
// Firestore structure:
//   users/{primaryUid}/familyLink: { partnerUid, partnerEmail, partnerName, linkedAt }
//   users/{partnerUid}/familyLink: { primaryUid, primaryEmail, primaryName, linkedAt }
//
// Primary reads partner data from: users/{partnerUid}/investments/...
// No data duplication — direct cross-account reads via Firestore rules.

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { useTier } from '../hooks/useTier';

export type ActiveProfile = 'self' | 'partner' | 'household';

interface FamilyLink {
  partnerUid: string;
  partnerEmail: string;
  partnerName: string;
  linkedAt: Date;
}

interface PartnerContextType {
  activeProfile: ActiveProfile;
  setActiveProfile: (p: ActiveProfile) => void;
  partnerName: string;
  setPartnerName: (name: string) => void;
  partnerDob: string;
  setPartnerDob: (dob: string) => void;
  isFamily: boolean;
  /** Whether this user is the linked (secondary) partner */
  isLinkedPartner: boolean;
  /** UID of the linked partner (for cross-account reads) */
  partnerUid: string | null;
  /** Whether family link is established */
  isLinked: boolean;
  /** Returns Firestore collection path for current view */
  getCollectionPath: (baseName: string) => { uid: string; collection: string };
  /** Load items from a partner collection — returns docs from partner's account */
  loadPartnerDocs: (collectionName: string) => Promise<any[]>;
  /** Family view is read-only */
  isReadOnly: boolean;
  profileLabel: string;
  isPartnerView: boolean;
  isHouseholdView: boolean;
  /** Family link info */
  familyLink: FamilyLink | null;
}

const PartnerContext = createContext<PartnerContextType>({
  activeProfile: 'self',
  setActiveProfile: () => {},
  partnerName: 'Partner',
  setPartnerName: () => {},
  partnerDob: '',
  setPartnerDob: () => {},
  isFamily: false,
  isLinkedPartner: false,
  partnerUid: null,
  isLinked: false,
  getCollectionPath: (b) => ({ uid: '', collection: b }),
  loadPartnerDocs: async () => [],
  isReadOnly: false,
  profileLabel: 'You',
  isPartnerView: false,
  isHouseholdView: false,
  familyLink: null,
});

export function PartnerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isCouples, isLinkedPartner: isTierLinked } = useTier();
  const [activeProfile, setActiveProfile] = useState<ActiveProfile>('self');
  const [partnerName, setPartnerNameState] = useState('Partner');
  const [partnerDob, setPartnerDobState] = useState('');
  const [familyLink, setFamilyLink] = useState<FamilyLink | null>(null);

  const isFamily = isCouples; // Only primary sees toggle
  const isLinkedPartner = isTierLinked;
  const partnerUid = familyLink?.partnerUid || null;
  const isLinked = !!familyLink;

  // Load family link + partner info from Firestore
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) return;
        const d = snap.data();

        // Load partner name/dob (for primary partner)
        if (d.partnerName) setPartnerNameState(d.partnerName);
        if (d.partnerDob) setPartnerDobState(d.partnerDob);

        // Load family link
        if (d.familyLink) {
          setFamilyLink(d.familyLink);
          // If linked and we have partner name from link, use it
          if (d.familyLink.partnerName && !d.partnerName) {
            setPartnerNameState(d.familyLink.partnerName);
          }
        }
      } catch (err) {
        console.error('[PartnerContext] Load error:', err);
      }
    };
    loadData();
  }, [user]);

  // Save partner name
  const setPartnerName = async (name: string) => {
    setPartnerNameState(name);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { partnerName: name, updatedAt: new Date() }, { merge: true });
      } catch (err) {
        console.error('[PartnerContext] Failed to save partner name:', err);
      }
    }
  };

  // Save partner DoB
  const setPartnerDob = async (dob: string) => {
    setPartnerDobState(dob);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { partnerDob: dob, updatedAt: new Date() }, { merge: true });
      } catch (err) {
        console.error('[PartnerContext] Failed to save partner DoB:', err);
      }
    }
  };

  // Reset to self when not on Family Premium
  useEffect(() => {
    if (!isCouples) setActiveProfile('self');
  }, [isCouples]);

  // Get collection path based on active profile
  const getCollectionPath = (baseName: string): { uid: string; collection: string } => {
    if (!user) return { uid: '', collection: baseName };

    if (activeProfile === 'partner' && partnerUid && isCouples) {
      // Read from partner's actual account
      return { uid: partnerUid, collection: baseName };
    }
    // Self or household — use own UID
    return { uid: user.uid, collection: baseName };
  };

  // Load docs from partner's collection (for partner/household views)
  const loadPartnerDocs = async (collectionName: string): Promise<any[]> => {
    if (!user || !partnerUid) return [];
    try {
      const snap = await getDocs(collection(db, 'users', partnerUid, collectionName));
      return snap.docs.map(d => ({ id: `p_${d.id}`, ...d.data(), _isPartner: true }));
    } catch (err) {
      console.error(`[PartnerContext] Failed to load partner ${collectionName}:`, err);
      return [];
    }
  };

  const isReadOnly = (activeProfile === 'partner' || activeProfile === 'household') && isCouples;

  return (
    <PartnerContext.Provider value={{
      activeProfile,
      setActiveProfile,
      partnerName,
      setPartnerName,
      partnerDob,
      setPartnerDob,
      isFamily,
      isLinkedPartner,
      partnerUid,
      isLinked,
      getCollectionPath,
      loadPartnerDocs,
      isReadOnly,
      profileLabel: activeProfile === 'self' ? 'You' : activeProfile === 'partner' ? partnerName : 'Family',
      isPartnerView: activeProfile === 'partner',
      isHouseholdView: activeProfile === 'household',
      familyLink,
    }}>
      {children}
    </PartnerContext.Provider>
  );
}

export function usePartner() {
  return useContext(PartnerContext);
}
