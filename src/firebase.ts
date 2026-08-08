// Firebase SDK Initialization & Cloud Firestore Connection
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your new web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCpa0Bg2gCWZ0IsNZSLx_b1VA7G31dlBJk",
  authDomain: "rave-party-f2990.firebaseapp.com",
  projectId: "rave-party-f2990",
  storageBucket: "rave-party-f2990.firebasestorage.app",
  messagingSenderId: "349275387713",
  appId: "1:349275387713:web:a2ac6b913df9d83b8c53c0",
  measurementId: "G-FSGV5VCMC9"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore Database
export const db = getFirestore(app);

// Initialize Analytics safely
export const initAnalytics = async () => {
  if (await isSupported()) {
    return getAnalytics(app);
  }
  return null;
};
