// =============================================================
// services/firestoreHelpers.ts — Shared Firestore utilities
// =============================================================
// Reduces boilerplate for common Firestore patterns used across pages.
// Provides typed collection loading with partner-awareness.

import { db } from '../firebase/config';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

/**
 * Load all documents from a user's subcollection with proper typing.
 */
export async function loadCollection<T>(uid: string, collectionName: string): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db, 'users', uid, collectionName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as T));
  } catch (err) {
    console.error(`[Firestore] Error loading ${collectionName}:`, err);
    return [];
  }
}

/**
 * Load documents from a collection for the current view (self, partner, or household).
 * Handles the partner/household merge logic that's duplicated across many pages.
 */
export async function loadCollectionForView<T>(
  uid: string,
  collectionName: string,
  activeProfile: 'self' | 'partner' | 'household',
  partnerUid: string | null
): Promise<T[]> {
  if (activeProfile === 'household' && partnerUid) {
    const [selfDocs, partnerDocs] = await Promise.all([
      loadCollection<T>(uid, collectionName),
      loadCollection<T>(partnerUid, collectionName).then(docs =>
        docs.map(d => ({ ...d, _isPartner: true, id: `p_${(d as any).id}` }))
      ),
    ]);
    return [...selfDocs, ...partnerDocs];
  }
  if (activeProfile === 'partner' && partnerUid) {
    return loadCollection<T>(partnerUid, collectionName);
  }
  return loadCollection<T>(uid, collectionName);
}

/**
 * Save a document to a user's subcollection (create or update).
 */
export async function saveDocument(
  uid: string,
  collectionName: string,
  data: Record<string, unknown>,
  docId?: string
): Promise<string> {
  if (docId) {
    await updateDoc(doc(db, 'users', uid, collectionName, docId), {
      ...data,
      updatedAt: new Date(),
    });
    return docId;
  }
  const ref = await addDoc(collection(db, 'users', uid, collectionName), {
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return ref.id;
}

/**
 * Delete a document from a user's subcollection.
 */
export async function deleteDocument(uid: string, collectionName: string, docId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, collectionName, docId));
}

/**
 * Get a single document from a user's subcollection.
 */
export async function getDocument<T>(uid: string, path: string): Promise<T | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, ...path.split('/')));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
  } catch {
    return null;
  }
}

/**
 * Set (merge) a document in a user's subcollection.
 */
export async function mergeDocument(uid: string, path: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db, 'users', uid, ...path.split('/')), {
    ...data,
    updatedAt: new Date(),
  }, { merge: true });
}

/**
 * Normalize frequency-based amounts to monthly.
 */
export function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'yearly': return amount / 12;
    case 'quarterly': return amount / 3;
    case 'monthly':
    default: return amount;
  }
}

/**
 * Normalize frequency-based amounts to annual.
 */
export function toAnnual(amount: number, frequency: string): number {
  switch (frequency) {
    case 'yearly': return amount;
    case 'quarterly': return amount * 4;
    case 'monthly':
    default: return amount * 12;
  }
}
