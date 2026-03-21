import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../config/firebaseconfig";

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if this is a high-priority predator alert
    const data = notification.request.content.data;
    const isPredatorAlert =
      data?.type === "predator_alert" || data?.priority === "emergency";

    return {
      shouldShowAlert: true, // Always show notification banner
      shouldPlaySound: true, // Always play sound
      shouldSetBadge: true, // Update badge count
      priority: isPredatorAlert
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

/**
 * Configure high-priority notification channels for critical predator alerts
 * This must be called BEFORE any notifications arrive on Android
 */
async function setupNotificationChannels() {
  if (Platform.OS === "android") {
    try {
      // Delete old channels first to ensure fresh configuration
      const existingChannels =
        await Notifications.getNotificationChannelsAsync();
      console.log(
        "Existing notification channels:",
        existingChannels.map((c) => c.id),
      );

      // Critical predator alerts channel - MUST match channelId sent from server
      await Notifications.setNotificationChannelAsync("predator-alerts", {
        name: "Predator Alerts",
        description:
          "Critical alerts when predators are detected near your chickens",
        importance: Notifications.AndroidImportance.MAX, // Highest priority - shows as heads-up
        vibrationPattern: [0, 500, 200, 500, 200, 500], // Attention-grabbing pattern
        lightColor: "#FF0000", // Red LED
        sound: "default",
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true, // Bypass Do Not Disturb
      });
      console.log("Created/updated 'predator-alerts' channel");

      // Emergency override channel (for critical situations)
      await Notifications.setNotificationChannelAsync("emergency-alerts", {
        name: "Emergency Predator Alerts",
        description: "Urgent emergency alerts that bypass all settings",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
        lightColor: "#FF0000",
        sound: "default",
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
      console.log("Created/updated 'emergency-alerts' channel");

      // Default fallback channel
      await Notifications.setNotificationChannelAsync("default", {
        name: "General Notifications",
        description: "General app notifications",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
      console.log("Created/updated 'default' channel");

      // Verify channels were created
      const channels = await Notifications.getNotificationChannelsAsync();
      console.log(
        "Active notification channels:",
        channels.map((c) => `${c.id} (importance: ${c.importance})`),
      );
    } catch (error) {
      console.error("Error setting up notification channels:", error);
    }
  }
}

/**
 * Registers the device for push notifications and returns the Expo push token.
 */
export async function registerForPushNotificationsAsync() {
  let token;

  // Setup notification channels first (Android only) - CRITICAL: must happen before notifications arrive
  await setupNotificationChannels();

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    console.log("Current notification permission status:", existingStatus);

    if (existingStatus !== "granted") {
      console.log("Requesting push notification permissions...");
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
      console.log("Failed to get push notification permissions!");
      console.log("Please enable notifications manually:");
      console.log(
        "   Settings > Apps > Internet of Tsiken > Notifications > Enable all",
      );
      console.log(
        "   Also check: Settings > Apps > Internet of Tsiken > Notifications > Predator Alerts > Allow pop on screen",
      );
      return null;
    }

    console.log("Push notification permissions granted");

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        // Fallback if not using EAS
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
        token = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data;
      }
      console.log("Push token obtained:", token);

      // Verify notification settings on Android
      if (Platform.OS === "android") {
        const channels = await Notifications.getNotificationChannelsAsync();
        const predatorChannel = channels.find(
          (c) => c.id === "predator-alerts",
        );
        if (predatorChannel) {
          console.log("Predator alerts channel status:");
          console.log(
            "  - Importance:",
            predatorChannel.importance,
            "(should be 5 for MAX)",
          );
          console.log("  - Sound enabled:", !!predatorChannel.sound);
          console.log("  - Vibration enabled:", predatorChannel.enableVibrate);
          console.log("  - Bypass DnD:", predatorChannel.bypassDnd);

          if (predatorChannel.importance < 4) {
            console.warn(
              "WARNING: Predator alerts channel importance is too low!",
            );
            console.warn(
              "User may have manually lowered it in system settings.",
            );
            console.warn(
              "Go to: Settings > Apps > Internet of Tsiken > Notifications > Predator Alerts",
            );
          }
        } else {
          console.error("ERROR: predator-alerts channel not found!");
        }
      }
    } catch (e) {
      console.log("Error getting push token:", e);
    }
  } else {
    console.log(
      "Must use physical device for Push Notifications (not simulator)",
    );
  }

  return token;
}

/**
 * Verifies that notification channels are properly configured (call this for debugging)
 */
export async function verifyNotificationSetup() {
  if (Platform.OS !== "android") {
    console.log("Channel verification only needed on Android");
    return { ok: true };
  }

  const channels = await Notifications.getNotificationChannelsAsync();
  const predatorChannel = channels.find((c) => c.id === "predator-alerts");

  const issues = [];

  if (!predatorChannel) {
    issues.push("predator-alerts channel does not exist");
  } else {
    if (predatorChannel.importance < 5) {
      issues.push(
        `Channel importance is ${predatorChannel.importance}, should be 5 (MAX) for pop-ups`,
      );
    }
    if (!predatorChannel.sound) {
      issues.push("Sound is disabled for predator-alerts channel");
    }
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    issues.push("Notification permissions not granted");
  }

  if (issues.length > 0) {
    console.warn("Notification setup issues found:");
    issues.forEach((issue) => console.warn("  -", issue));
    return { ok: false, issues };
  }

  console.log("Notification setup verified - all OK");
  return { ok: true };
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
