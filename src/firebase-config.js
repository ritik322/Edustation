// src/firebase-config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCjAsjnFxLEl9RRP4AsURx56YfE1Z8o44s",
  authDomain: "pdf-ai-3a1b7.firebaseapp.com",
  projectId: "pdf-ai-3a1b7",
  storageBucket: "pdf-ai-3a1b7.firebasestorage.app",
  messagingSenderId: "397155940567",
  appId: "1:397155940567:web:ede43272a35e2b95a11892",
  measurementId: "G-GL017HVK7G"
};

  

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;