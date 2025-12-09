// If you haven't yet installed Firebase, run: // 👉 npm install firebase
import { initializeApp } from "firebase/app";
// Import the functions for persistence
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics, isSupported } from "firebase/analytics"; // For the analytics warning

const firebaseConfig = {
  apiKey: "AIzaSyAOC8S6aOGvfnUzp0Twb-7O727Un9FoUGE",
  authDomain: "internet-of-tsiken-690dd.firebaseapp.com",
  projectId: "internet-of-tsiken-690dd",
  storageBucket: "internet-of-tsiken-690dd.appspot.com",
  messagingSenderId: "296742448098",
  appId: "1:296742448098:web:8163021d84af262c6527bb",
  measurementId: "G-FEWSJPB1Z1",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Initialize Firestore WITHOUT persistence (React Native doesn't support IndexedDB)
// This prevents the "IndexedDB persistence is only available on platforms that support LocalStorage" error
export const db = initializeFirestore(app, {
  // No localCache configuration for React Native - uses in-memory cache by default
});

// Initialize Firebase Storage
export const storage = getStorage(app);

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
