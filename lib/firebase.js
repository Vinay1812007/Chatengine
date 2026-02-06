// lib/firebase.js
// Firebase (Auth + Firestore ONLY)
// Realtime Database REMOVED completely

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔐 Environment-based Firebase config (NO databaseURL)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 🛡 Prevent duplicate initialization (VERY IMPORTANT)
const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

// 🔑 Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
