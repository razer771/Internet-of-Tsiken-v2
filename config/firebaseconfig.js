// If you haven’t yet installed Firebase, run: // 👉 npm install firebase
import { initializeApp } from "firebase/app";
// Import the functions for persistence
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics, isSupported } from "firebase/analytics"; // For the analytics warning

const firebaseConfig = {
  apiKey: "AIzaSyBa6PE0nqkrFAqDm6AT2nIrZmv6qIfgiFM",
  authDomain: "internet-of-tsiken-f0ad4.firebaseapp.com",
  projectId: "internet-of-tsiken-f0ad4",
  storageBucket: "internet-of-tsiken-f0ad4.firebasestorage.app",
  messagingSenderId: "403239833979",
  appId: "1:403239833979:web:7b8656be94583bc45aedde",
  measurementId: "G-LD936L51CP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Initialize Firestore with offline persistence support
// Using AsyncStorage for React Native offline persistence
export const db = initializeFirestore(app, {
  localCache: {
    kind: "persistent",
    tabManager: {
      kind: "shared",
    },
  },
});

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
