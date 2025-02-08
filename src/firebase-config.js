// src/firebase-config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDegNXneqHIx9XgE2zAabAQ1mr1VrMP7Ic",
  authDomain: "project-71c88.firebaseapp.com",
  projectId: "project-71c88",
  storageBucket: "project-71c88.appspot.com",
  messagingSenderId: "716798835109",
  appId: "1:716798835109:web:e945ef9dc8d0d0119e104c",
  measurementId: "G-MMMX2050HE"
};
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;