import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAOC8S6aOGvfnUzp0Twb-7O727Un9FoUGE",
  authDomain: "internet-of-tsiken-690dd.firebaseapp.com",
  projectId: "internet-of-tsiken-690dd",
  storageBucket: "internet-of-tsiken-690dd.appspot.com",
  messagingSenderId: "296742448098",
  appId: "1:296742448098:web:8163021d84af262c6527bb",
  measurementId: "G-FEWSJPB1Z1",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const db = getFirestore(app);

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
