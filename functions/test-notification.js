const { Expo } = require("expo-server-sdk");

// Replace this with your actual push token from Firestore
const pushToken = "ExponentPushToken[LE-eOKK1HeQa9ERjRcf8aU]";

const expo = new Expo();

async function testNotification() {
  console.log("Testing push notification...");
  console.log("Token:", pushToken);
  console.log("Is valid Expo token:", Expo.isExpoPushToken(pushToken));

  if (!Expo.isExpoPushToken(pushToken)) {
    console.log("ERROR: Invalid push token format!");
    console.log(
      "Token should look like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    );
    return;
  }

  const message = {
    to: pushToken,
    priority: "high",
    channelId: "predator-alerts",
    sound: "default",
    title: "TEST PREDATOR ALERT",
    body: "This is a direct test notification - if you see this, notifications work!",
    badge: 1,
    ttl: 0,
    _contentAvailable: true,
    data: {
      type: "predator_alert",
      predator: "Test",
      timestamp: new Date().toISOString(),
    },
  };

  console.log("\nSending notification...");

  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    console.log("\nResult:", JSON.stringify(tickets, null, 2));

    if (tickets[0].status === "ok") {
      console.log("\nSUCCESS! Notification sent. Check your phone!");
    } else {
      console.log("\nERROR:", tickets[0].message);
    }
  } catch (error) {
    console.error("\nFailed to send:", error.message);
  }
}

testNotification();
