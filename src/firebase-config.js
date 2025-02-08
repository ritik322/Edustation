// src/firebase-config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDgQYbwMC7pEUDGZOQM-i-OSFrVfsoYDDU",
  authDomain: "edustation-4f19f.firebaseapp.com",
  projectId: "edustation-4f19f",
  storageBucket: "edustation-4f19f.firebasestorage.app",
  messagingSenderId: "829468366077",
  appId: "1:829468366077:web:d70863d7dbdee76f04da94",
  measurementId: "G-ZMGYCEHXE7"
};
  
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;