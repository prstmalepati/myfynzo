// =============================================================
// services/dataExport.ts — GDPR Article 20: Data Portability
// =============================================================
// Exports all user data as a downloadable JSON file.

import { db } from '../firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export interface UserDataExport {
  exportDate: string;
  exportVersion: string;
  profile: Record<string, unknown>;
  investments: Record<string, unknown>[];
  monthlyInvestments: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  debts: Record<string, unknown>[];
  lifestyleBasket: Record<string, unknown>[];
  cashSavings: Record<string, unknown>[];
  physicalAssets: Record<string, unknown>[];
  scenarios: Record<string, unknown>[];
  antiPortfolio: Record<string, unknown>[];
  projections: Record<string, unknown> | null;
}

const SUBCOLLECTIONS = [
  'investments',
  'monthlyInvestments',
  'goals',
  'debts',
  'lifestyleBasket',
  'cashSavings',
  'physicalAssets',
  'scenarios',
  'anti_portfolio',
] as const;

export async function exportUserData(uid: string): Promise<UserDataExport> {
  // Load profile
  const profileSnap = await getDoc(doc(db, 'users', uid));
  const profile = profileSnap.exists() ? profileSnap.data() : {};

  // Remove sensitive fields from export
  const { tier, ...safeProfile } = profile;

  // Load all subcollections in parallel
  const collectionPromises = SUBCOLLECTIONS.map(async (name) => {
    try {
      const snap = await getDocs(collection(db, 'users', uid, name));
      return {
        name,
        docs: snap.docs.map(d => ({ id: d.id, ...d.data() })),
      };
    } catch {
      return { name, docs: [] };
    }
  });

  // Load projections
  const projSnap = await getDoc(doc(db, 'users', uid, 'projections', 'wealth')).catch(() => null);

  const results = await Promise.all(collectionPromises);
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const r of results) {
    data[r.name] = r.docs;
  }

  return {
    exportDate: new Date().toISOString(),
    exportVersion: '1.0',
    profile: safeProfile,
    investments: data.investments || [],
    monthlyInvestments: data.monthlyInvestments || [],
    goals: data.goals || [],
    debts: data.debts || [],
    lifestyleBasket: data.lifestyleBasket || [],
    cashSavings: data.cashSavings || [],
    physicalAssets: data.physicalAssets || [],
    scenarios: data.scenarios || [],
    antiPortfolio: data.anti_portfolio || [],
    projections: projSnap?.exists() ? projSnap.data() ?? null : null,
  };
}

/** Download the export as a JSON file */
export function downloadExport(data: UserDataExport, email: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `myfynzo-export-${email.split('@')[0]}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
