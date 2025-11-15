// If you haven’t yet installed Firebase, run: // 👉 npm install firebase
import { initializeApp } from "firebase/app";
// Import the functions for persistence
import { 
  initializeAuth, 
  getReactNativePersistence 
} from 'firebase/auth'; 
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalytics, isSupported } from 'firebase/analytics'; // For the analytics warning


// ⚠️ PLEASE REPLACE THIS WITH YOUR NEW, REGENERATED KEYS
const firebaseConfig = {
  apiKey: "AIzaSyA_UhQ_KlCsoCmRlda_S2RrUv6QhGo0c_0",
  authDomain: "internet-of-tsiken.firebaseapp.com",
  projectId: "internet-of-tsiken",
  storageBucket: "internet-of-tsiken.firebasestorage.app",
  messagingSenderId: "998028163151",
  appId: "1:998028163151:web:ce0864acced24f37d7d23a",
  measurementId: "G-W7495LQB4J"
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