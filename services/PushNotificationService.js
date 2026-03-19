import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../config/firebaseconfig";

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,      // Show notification even when app is open
    shouldPlaySound: true,      // Play sound
    shouldSetBadge: true,       // Show badge count
  }),
});

/**
 * Configure high-priority notification channels for critical predator alerts
 */
async function setupNotificationChannels() {
  if (Platform.OS === "android") {
    // Critical predator alerts channel
    await Notifications.setNotificationChannelAsync("predator-alerts", {
      name: "🚨 Predator Alerts",
      importance: Notifications.AndroidImportance.MAX,  // Highest priority
      vibrationPattern: [0, 500, 200, 500, 200, 500], // Strong vibration pattern
      lightColor: "#FF0000",                           // Red light
      sound: "default",                                // Use system default sound
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,                                // Bypass Do Not Disturb
    });

    // Emergency override channel (for critical situations)
    await Notifications.setNotificationChannelAsync("emergency-alerts", {
      name: "🆘 Emergency Predator Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 500, 1000, 500, 1000], // Very strong vibration
      lightColor: "#FF0000",
      sound: "default",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
}

/**
 * Registers the device for push notifications and returns the Expo push token.
 */
export async function registerForPushNotificationsAsync() {
  let token;

  // Setup notification channels first (Android only)
  await setupNotificationChannels();

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      console.log("🔔 Requesting push notification permissions...");
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowCriticalAlerts: true, // iOS critical alerts (bypass silent mode)
        },
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("❌ Failed to get push notification permissions!");
      console.log("📱 Please enable notifications manually:");
      console.log("   Settings > Apps > Internet of Tsiken > Notifications > Enable all");
      return null;
    }

    console.log("✅ Push notification permissions granted");

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        // Fallback if not using EAS. Just pass empty object or your specific project ID.
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync({
          projectId,
          // Ensure we get a token that supports high-priority notifications
          experienceId: '@charlesfrancis/capstone', // Your Expo username/slug
        })).data;
      }
      console.log("🔑 Push token:", token);

      // Test notification channel (for debugging)
      console.log("🧪 Testing notification setup...");

    } catch (e) {
      console.log("❌ Error getting push token:", e);
    }
  } else {
    console.log("⚠️ Must use physical device for Push Notifications (not simulator)");
  }

  return token;
}

/**
 * Saves the push token to the current user's document in Firestore.
 */
export async function saveUserPushToken(userId, token) {
  if (!userId || !token) return;
  try {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, { pushToken: token }, { merge: true });
    console.log("=================================");
    console.log("YOUR REAL PUSH TOKEN:", token);
    console.log("=================================");
  } catch (error) {
    console.error("Error saving push token to Firestore:", error);
  }
}
