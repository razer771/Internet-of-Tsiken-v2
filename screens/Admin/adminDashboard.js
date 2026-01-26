import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Header2 from "../navigation/adminHeader";
import Icon from "react-native-vector-icons/Feather";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "../../config/firebaseconfig";

export default function AdminDashboard() {
  const navigation = useNavigation();
  const [pressedBtn, setPressedBtn] = useState(null);
  const [firstName, setFirstName] = useState("Administrator");
  const [mortalityRate, setMortalityRate] = useState(0);
  const [totalChicks, setTotalChicks] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [predatorDetections, setPredatorDetections] = useState(0);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);

  // Prevent duplicate fetches (React StrictMode protection)
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate fetches in React StrictMode (development)
    if (hasFetchedRef.current) {
      console.log("⏭️  Skipping duplicate dashboard fetch (already loaded)");
      return;
    }

    hasFetchedRef.current = true;
    console.log("Admin dashboard loading farm analytics");
    fetchAdminName();
    fetchFarmMetrics();
    fetchPredatorDetections();
    fetchActivityLogs();
  }, []);

  const fetchAdminName = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFirstName(userData.firstName || "Administrator");
        }
      }
    } catch (error) {
      console.error("Error fetching admin name:", error);
    }
  };

  const fetchFarmMetrics = async () => {
    try {
      console.log("Fetching farm metrics from Firestore...");

      // Fetch all users (farmers)
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const total = usersSnapshot.size;
      setTotalUsers(total);
      console.log("Total users:", total);

      // Fetch brooder batches to calculate mortality rate
      let totalAliveChicks = 0; // Sum of chicksCount (alive now)
      let totalDeathCount = 0; // Sum of count from mortality records
      let batchCount = 0;

      // Get all brooder info documents
      const brooderRef = collection(db, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderRef);

      // Step 1: Sum all alive chicks from brooderInfo
      brooderSnapshot.forEach((doc) => {
        const data = doc.data();
        batchCount++;
        const chicksCount = data.chicksCount || 0;
        totalAliveChicks += chicksCount;
      });

      console.log("Total alive chicks:", totalAliveChicks);
      console.log("Total batches:", batchCount);

      // Step 2: Sum all deaths from mortality records for all batches
      const batchPromises = brooderSnapshot.docs.map(async (doc) => {
        const batchId = doc.id;
        try {
          const mortalityRecordsRef = collection(
            db,
            "mortality",
            batchId,
            "records",
          );
          const recordsSnapshot = await getDocs(mortalityRecordsRef);

          recordsSnapshot.docs.forEach((recordDoc) => {
            const recordData = recordDoc.data();
            const count = recordData.count || 0;
            totalDeathCount += count;
          });
        } catch (error) {
          console.warn(`Error fetching mortality for batch ${batchId}:`, error);
        }
      });

      await Promise.all(batchPromises);

      console.log("Total deaths:", totalDeathCount);

      // Step 3: Calculate total initial chicks (alive + dead)
      const totalInitialChicks = totalAliveChicks + totalDeathCount;

      // Step 4: Calculate mortality rate (2 decimal places)
      let mortality = 0;
      if (totalInitialChicks > 0) {
        mortality = parseFloat(
          ((totalDeathCount / totalInitialChicks) * 100).toFixed(2),
        );
        mortality = Math.max(0, mortality); // Ensure non-negative
      }

      setTotalBatches(batchCount);
      setTotalChicks(totalAliveChicks);
      setMortalityRate(mortality);

      console.log("Mortality rate:", mortality + "%");
      console.log("Total initial chicks:", totalInitialChicks);
    } catch (error) {
      console.error("Error fetching farm metrics:", error);
    }
  };

  const fetchPredatorDetections = async () => {
    try {
      console.log("Fetching ALL-TIME predator detections from Firestore...");

      let detectionCount = 0;
      let latestDetection = null;

      // Fetch from /predatorAttacks/{batchId}/attacks/ structure
      try {
        const predatorAttacksRef = collection(db, "predatorAttacks");
        const batchesSnapshot = await getDocs(predatorAttacksRef);

        console.log(
          `Found ${batchesSnapshot.docs.length} batches in predatorAttacks`,
        );

        // Iterate through each batch and fetch its attacks subcollection
        for (const batchDoc of batchesSnapshot.docs) {
          const batchId = batchDoc.id;

          try {
            // Fetch attacks subcollection for this batch
            const attacksRef = collection(
              db,
              "predatorAttacks",
              batchId,
              "attacks",
            );
            const attacksSnapshot = await getDocs(attacksRef);

            console.log(
              `Found ${attacksSnapshot.docs.length} attacks in batch ${batchId}`,
            );

            // Process all attacks (no date filter)
            attacksSnapshot.docs.forEach((doc) => {
              const data = doc.data();
              const attackDatetime = data.attack_datetime;

              detectionCount++;

              // Track the most recent detection
              if (attackDatetime) {
                let attackDate;
                try {
                  if (
                    attackDatetime.toDate &&
                    typeof attackDatetime.toDate === "function"
                  ) {
                    attackDate = attackDatetime.toDate();
                  } else if (attackDatetime.seconds) {
                    attackDate = new Date(attackDatetime.seconds * 1000);
                  } else if (attackDatetime instanceof Date) {
                    attackDate = attackDatetime;
                  } else {
                    attackDate = new Date(attackDatetime);
                  }
                  if (!latestDetection || attackDate > latestDetection) {
                    latestDetection = attackDate;
                  }
                } catch (error) {
                  console.warn("Error processing attack timestamp:", error);
                }
              }
            });
          } catch (error) {
            console.warn(`Error fetching attacks for batch ${batchId}:`, error);
          }
        }
      } catch (e) {
        console.warn("Error fetching predatorAttacks collection:", e);
      }

      setPredatorDetections(detectionCount);
      setLastDetectionTime(latestDetection);

      console.log("Predator detections (ALL TIME):", detectionCount);
      if (latestDetection) {
        console.log("Last detection:", latestDetection.toLocaleString());
      }
    } catch (error) {
      console.error("Error fetching predator detections:", error);
    }
  };

  const getRelativeTime = (timestamp) => {
    try {
      let date;
      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        return "Unknown time";
      }

      const now = new Date();
      const diffMs = now - date;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) {
        return "Just now";
      } else if (diffMinutes < 60) {
        return `${diffMinutes} min${diffMinutes !== 1 ? "s" : ""} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
      } else {
        return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
      }
    } catch (error) {
      console.error("Error computing relative time:", error);
      return "Unknown time";
    }
  };

  const fetchActivityLogs = async () => {
    try {
      console.log("Fetching activity logs from Firestore...");

      const logCollections = [
        "activity_logs/addBatch_logs/events",
        "activity_logs/deleteBatch_logs/events",
        "activity_logs/editBatch_logs/events",
        "activity_logs/feeding/addFeedSchedule_logs",
        "activity_logs/feeding/deleteFeedSchedule_logs",
        "activity_logs/feeding/editFeedSchedule_logs",
        "activity_logs/nightTime_logs/events",
        "activity_logs/report_logs/logs",
        "activity_logs/watering/addWaterSchedule_logs",
        "activity_logs/watering/deleteWaterSchedule_logs",
        "activity_logs/watering/editWaterSchedule_logs",
        "activity_logs/editProfile/passwordChange",
        "activity_logs/editProfile/userprofile",
        "activity_logs/userManagement/createAccount",
        "activity_logs/userManagement/updateAccount",
        "activity_logs/userManagement/disableAccess",
        "activity_logs/userManagement/forcePasswordChange",
        "activity_logs/userManagement/reactivateAccount",
        "activity_logs/mortalityReporting/events",
        "session_logs",
      ];

      const allLogs = [];
      const userCache = {};

      // Fetch logs from each collection
      for (const collectionPath of logCollections) {
        try {
          // Use server-side ordering and limit(10)
          const logsRef = collection(db, collectionPath);
          const logsQuery = query(
            logsRef,
            orderBy("timestamp", "desc"),
            limit(10),
          );
          const logsSnapshot = await getDocs(logsQuery);

          console.log(
            `Fetched ${logsSnapshot.size} logs from ${collectionPath}`,
          );

          // Process each log document
          for (const docSnap of logsSnapshot.docs) {
            const logData = docSnap.data();

            // Fetch user data from users collection, with cache
            let firstName = "Unknown";
            let lastName = "User";

            // Check both userId and adminId fields
            const userId = logData.userId || logData.adminId;

            if (userId) {
              if (userCache[userId]) {
                // Use cached user data
                firstName = userCache[userId].firstName;
                lastName = userCache[userId].lastName;
              } else {
                try {
                  const userRef = doc(db, "users", userId);
                  const userDoc = await getDoc(userRef);

                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    firstName = userData.firstName || "Unknown";
                    lastName = userData.lastName || "User";
                    userCache[userId] = { firstName, lastName };
                  }
                } catch (userError) {
                  console.warn(
                    `Error fetching user ${userId}:`,
                    userError.message,
                  );
                }
              }
            }

            // Create a unified log entry
            allLogs.push({
              id: docSnap.id,
              collection: collectionPath,
              userId: userId || "Unknown",
              firstName: firstName,
              lastName: lastName,
              action: logData.action || logData.type || "action",
              description:
                logData.description ||
                getDefaultDescription(collectionPath, logData),
              timestamp: logData.timestamp,
            });
          }
        } catch (collectionError) {
          console.warn(
            `Error fetching ${collectionPath}:`,
            collectionError.message,
          );
        }
      }

      console.log("Merged logs:", allLogs.length);

      // Merge all logs and sort by timestamp descending (latest first)
      const sortedLogs = allLogs.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });

      // Limit to 10 most recent overall
      const recentLogs = sortedLogs.slice(0, 10);

      console.log("Recent logs (limited to 10):", recentLogs.length);

      setRecentLogs(recentLogs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    }
  };

  const getDefaultDescription = (collectionPath, logData) => {
    switch (collectionPath) {
      case "activity_logs/addBatch_logs/events":
        return "Added new batch";
      case "activity_logs/deleteBatch_logs/events":
        return "Deleted batch";
      case "activity_logs/editBatch_logs/events":
        return "Edited batch";
      case "activity_logs/feeding/addFeedSchedule_logs":
        return "Added feed schedule";
      case "activity_logs/feeding/deleteFeedSchedule_logs":
        return "Deleted feed schedule";
      case "activity_logs/feeding/editFeedSchedule_logs":
        return "Edited feed schedule";
      case "activity_logs/nightTime_logs/events":
        return "Updated night time settings";
      case "activity_logs/report_logs/logs":
        return `Generated ${logData.type || "report"} report`;
      case "activity_logs/watering/addWaterSchedule_logs":
        return "Added water schedule";
      case "activity_logs/watering/deleteWaterSchedule_logs":
        return "Deleted water schedule";
      case "activity_logs/watering/editWaterSchedule_logs":
        return "Edited water schedule";
      case "activity_logs/editProfile/passwordChange":
        return "Changed password";
      case "activity_logs/editProfile/userprofile":
        return "Updated profile";
      case "activity_logs/userManagement/createAccount":
        return "Created user account";
      case "activity_logs/userManagement/updateAccount":
        return "Updated user account";
      case "activity_logs/userManagement/disableAccess":
        return "Disabled user access";
      case "activity_logs/userManagement/forcePasswordChange":
        return "Forced password change";
      case "activity_logs/userManagement/reactivateAccount":
        return "Reactivated user account";
      case "report_logs":
        return `Generated ${logData.type || "report"} report`;
      case "session_logs":
        return logData.action === "login" ? "Logged in" : "Logged out";
      default:
        return "Performed system action";
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>
            Welcome, {firstName || "Administrator"}!
          </Text>
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <View style={styles.metricCircleIcon}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={22}
                  color={mortalityRate > 10 ? "#ef4444" : "#234187"}
                />
              </View>
              <Text style={[styles.metricTitle, { marginLeft: -8 }]}>
                Mortality Rate
              </Text>
            </View>
            <Text
              style={[
                styles.metricValue,
                mortalityRate > 10 && { color: "#ef4444" },
              ]}
            >
              {mortalityRate}%
            </Text>
            <Text style={styles.metricSub}>{totalChicks} chicks active</Text>
          </View>
        </View>

        {/* Predator Detection */}
        <View
          style={[
            styles.reportCard,
            predatorDetections > 0 && {
              borderColor: "#f97316",
              borderWidth: 2,
            },
          ]}
        >
          <View style={styles.reportLeft}>
            <Text style={styles.reportTitle}>Predator Detection</Text>
            <Text
              style={[
                styles.reportValue,
                predatorDetections > 0 && { color: "#f97316" },
              ]}
            >
              {predatorDetections}
            </Text>
            <Text style={styles.reportSub}>
              {predatorDetections === 0
                ? "No threats detected"
                : lastDetectionTime
                  ? `Last detected: ${getRelativeTime(lastDetectionTime)}`
                  : "Last 7 days"}
            </Text>
          </View>
          <View
            style={[
              styles.reportCircleIcon,
              predatorDetections > 0 && { backgroundColor: "#fff7ed" },
            ]}
          >
            <MaterialCommunityIcons
              name="shield-alert"
              size={28}
              color={predatorDetections > 0 ? "#f97316" : "#234187"}
            />
          </View>
        </View>

        {/* --- Admin Actions Section --- */}
        <View style={styles.actionCard}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={28}
              color="#133E87"
              style={styles.actionIcon}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Manage User Accounts</Text>
              <Text style={styles.actionDesc}>
                View, create, update and manage all user accounts in the system.
              </Text>
              <TouchableOpacity
                style={[
                  styles.fullWidthButton,
                  { borderColor: "#234187" },
                  pressedBtn === "userManagement" && {
                    backgroundColor: "#133E87",
                  },
                ]}
                activeOpacity={0.85}
                onPressIn={() => setPressedBtn("userManagement")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => navigation.navigate("UserManagement")} // <-- Navigate to userManagement.js
              >
                <Text
                  style={[
                    styles.fullWidthButtonText,
                    pressedBtn === "userManagement" && { color: "#fff" },
                  ]}
                >
                  Open User Management
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={28}
              color="#133E87"
              style={styles.actionIcon}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>View Activity Logs</Text>
              <Text style={styles.actionDesc}>
                Monitor system activity, view audit logs, and generate activity
                reports.
              </Text>
              <TouchableOpacity
                style={[
                  styles.fullWidthButton,
                  { borderColor: "#234187" },
                  pressedBtn === "activityLogs" && {
                    backgroundColor: "#133E87",
                  },
                ]}
                activeOpacity={0.85}
                onPressIn={() => setPressedBtn("activityLogs")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => navigation.navigate("AdminActivityLogs")}
              >
                <Text
                  style={[
                    styles.fullWidthButtonText,
                    pressedBtn === "activityLogs" && { color: "#fff" },
                  ]}
                >
                  Open Activity Logs
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons
              name="chart-bar"
              size={28}
              color="#133E87"
              style={styles.actionIcon}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>View Analytics</Text>
              <Text style={styles.actionDesc}>
                View comprehensive system analytics and generate detailed
                reports.
              </Text>
              <TouchableOpacity
                style={[
                  styles.fullWidthButton,
                  { borderColor: "#234187" },
                  pressedBtn === "analytics" && { backgroundColor: "#133E87" }, // All buttons turn blue when pressed
                ]}
                activeOpacity={0.85}
                onPressIn={() => setPressedBtn("analytics")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => navigation.navigate("AdminAnalytics")} // Navigate to adminAnalytics.js
              >
                <Text
                  style={[
                    styles.fullWidthButtonText,
                    pressedBtn === "analytics" && { color: "#fff" },
                  ]}
                >
                  Open Analytics
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Recent System Activity */}
        <View style={styles.activityCard}>
          <Text style={styles.activityTitle}>Recent System Activity</Text>
          {recentLogs.length === 0 ? (
            <View style={styles.activityItem}>
              <Text style={styles.activityDesc}>No recent activity</Text>
            </View>
          ) : (
            recentLogs.map((log, index) => (
              <View
                key={`${log.collection}-${log.id}-${index}`}
                style={styles.activityItem}
              >
                <View>
                  <Text style={styles.activityUser}>
                    {log.firstName || "Unknown"} {log.lastName || "User"}
                  </Text>
                  <Text style={styles.activityDesc}>
                    {log.action || "No action"}
                  </Text>
                </View>
                <Text style={styles.activityTime}>
                  {log.timestamp
                    ? getRelativeTime(log.timestamp)
                    : "Unknown time"}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff", // changed from #F7F9FB to white
  },
  container: {
    flexGrow: 1,
    padding: 18,
    backgroundColor: "#fff",
  },
  welcomeCard: {
    backgroundColor: "#E3F2FD", // light blue color
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#90CAF9",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: "#5A6B7B",
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24, // increased space below
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(13,96,156,0.21)",
    alignItems: "flex-start",
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6, // add a small gap between icon and title for both cards
  },
  metricCircleIcon: {
    width: 32, // minimized size
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F6FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#6E95D9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2, // for Android shadow
  },
  metricIcon: {
    marginRight: 8,
    marginBottom: 0, // Remove any bottom margin
  },
  metricTitle: {
    fontSize: 14, // match actionTitle, reportTitle, activityTitle
    fontWeight: "500", // match actionTitle, reportTitle, activityTitle
    color: "#000000", // match actionTitle, reportTitle, activityTitle
    marginBottom: 0,
    marginLeft: -5,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 8, // increased space below value
  },
  metricSub: {
    fontSize: 14,
    color: "#133E87",
  },
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(13,96,156,0.21)",
    marginTop: 4,
    marginBottom: 24, // increased space below
    justifyContent: "space-between",
  },
  reportLeft: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16, // match actionTitle
    fontWeight: "600", // match actionTitle
    color: "#000000", // match actionTitle
    marginBottom: 4, // match actionTitle
  },
  reportValue: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 8, // increased space below value
  },
  reportSub: {
    fontSize: 14,
    color: "#133E87",
  },
  reportCircleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F6FA",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6E95D9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3, // for Android shadow
  },
  actionCard: {
    backgroundColor: "#Ff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24, // increased space between action cards
    borderWidth: 1,
    borderColor: "rgba(13,96,156,0.21)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  actionIcon: {
    marginRight: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 14,
    color: "#5A6B7B",
    lineHeight: 18,
    marginBottom: 8,
  },
  fullWidthButton: {
    width: "100%",
    backgroundColor: "#fff", // White background
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 0,
    borderWidth: 1.5,
    borderColor: "#234187", // Blue border
  },
  fullWidthButtonText: {
    color: "#000", // Black text by default
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(13,96,156,0.21)",
    marginBottom: 32, // increased space below
    marginTop: 4,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  activityTitle: {
    fontSize: 16, // match actionTitle
    fontWeight: "600", // match actionTitle
    color: "#000000", // match actionTitle
    marginBottom: 14,
  },
  activityItem: {
    backgroundColor: "#F2F4F8",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  activityUser: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#000000",
    marginBottom: 2,
  },
  activityDesc: {
    fontSize: 12,
    color: "#444",
  },
  activityTime: {
    fontSize: 12,
    color: "#133E87",
    fontWeight: "500",
    marginLeft: 10,
    minWidth: 90,
    textAlign: "right",
  },
});
