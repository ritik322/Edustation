import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBIGszoih_PyRDW_PipZCey2ugVNVfuL34",
    authDomain: "sem6-73e56.firebaseapp.com",
    projectId: "sem6-73e56",
    storageBucket: "sem6-73e56.firebasestorage.app",
    messagingSenderId: "426520350373",
    appId: "1:426520350373:web:b471134bc7c15a1806874c",
    measurementId: "G-4XVKTCTN3J"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
