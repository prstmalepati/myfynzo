import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBIXXj5B2bvmwIwbFOQIAgkxJGpwqCDwrY",
  authDomain: "myfynzo.firebaseapp.com",
  projectId: "myfynzo",
  storageBucket: "myfynzo.firebasestorage.app",
  messagingSenderId: "722972966832",
  appId: "1:722972966832:web:f31a649d8d75fee2f32075",
  measurementId: "G-HXZKYF3EEX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
// Use modern cache API instead of deprecated enableIndexedDbPersistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const functions = getFunctions(app);

export default app;