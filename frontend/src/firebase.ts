import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// 真實的 Firebase 專案配置 (lunch-order-system-af806)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBsmoABWfttnWnwMI2TV53_LMPchmuKB84',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'lunch-order-system-af806.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'lunch-order-system-af806',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'lunch-order-system-af806.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '847905518519',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:847905518519:web:8e2ce77203203d5dc8ee32',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-east1');
export const auth = getAuth(app);

// 若在本地開發環境且指定使用模擬器
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
