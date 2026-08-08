// Firebase SDK Initialization & Cloud Firestore Connection
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAGuqoRZ9Gtu4F9ysNakSqN1nPNZuY-qpY",
  authDomain: "foodfly-13955.firebaseapp.com",
  projectId: "foodfly-13955",
  storageBucket: "foodfly-13955.firebasestorage.app",
  messagingSenderId: "401271824394",
  appId: "1:401271824394:web:97b34b31d6c8fa3c933ff3",
  measurementId: "G-8DW26ZCJKQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore Database
export const db = getFirestore(app);

// Analytics support check
export const initAnalytics = async () => {
  if (await isSupported()) {
    return getAnalytics(app);
  }
  return null;
};
