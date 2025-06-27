// src/firebase-config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
<<<<<<< HEAD
  apiKey: "AIzaSyCjAsjnFxLEl9RRP4AsURx56YfE1Z8o44s",
  authDomain: "pdf-ai-3a1b7.firebaseapp.com",
  projectId: "pdf-ai-3a1b7",
  storageBucket: "pdf-ai-3a1b7.firebasestorage.app",
  messagingSenderId: "397155940567",
  appId: "1:397155940567:web:ede43272a35e2b95a11892",
  measurementId: "G-GL017HVK7G"
};

=======
  apiKey: "AIzaSyDegNXneqHIx9XgE2zAabAQ1mr1VrMP7Ic",
  authDomain: "project-71c88.firebaseapp.com",
  projectId: "project-71c88",
  storageBucket: "project-71c88.appspot.com",
  messagingSenderId: "716798835109",
  appId: "1:716798835109:web:e945ef9dc8d0d0119e104c",
  measurementId: "G-MMMX2050HE"
};
>>>>>>> b6d099355f5caa5e739a921b39eef8cfad6959a4
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;