import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../config/firebaseconfig";

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers the device for push notifications and returns the Expo push token.
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("predator-alerts", {
      name: "Predator Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return null;
    }
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        // Fallback if not using EAS. Just pass empty object or your specific project ID.
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
      console.log("Push token:", token);
    } catch (e) {
      console.log("Error getting push token:", e);
    }
  } else {
    console.log("Must use physical device for Push Notifications");
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
