// If you haven't yet installed Firebase, run: // 👉 npm install firebase
import { initializeApp } from "firebase/app";
// Import the functions for persistence
import { 
  initializeAuth, 
  getReactNativePersistence 
} from 'firebase/auth'; 
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalytics, isSupported } from 'firebase/analytics'; // For the analytics warning


// ⚠️ REPLACE WITH YOUR FIREBASE PROJECT CREDENTIALS
// Get these from Firebase Console > Project Settings > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase 
const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Firestore
export const db = getFirestore(app);

// Conditionally initialize Analytics to fix the other warning
let analytics;
(async () => {
  if (await isSupported()) {
    try {
      analytics = getAnalytics(app);
    } catch (e) {
      console.log("Failed to initialize Analytics", e);
    }
  }
})();

export { analytics };
export default app;
