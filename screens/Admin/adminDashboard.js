import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import Header2 from "../navigation/adminHeader";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../config/firebaseconfig";

const { width: windowWidth } = Dimensions.get("window");

export default function AdminDashboard() {
  const navigation = useNavigation();
  const [pressedBtn, setPressedBtn] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersThisMonth, setUsersThisMonth] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0);
  const [activePercentage, setActivePercentage] = useState(0);
  const [reportsThisWeek, setReportsThisWeek] = useState(0);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    console.log("Create Account card removed from dashboard");
    fetchUserMetrics();
    fetchReportMetrics();
    fetchActivityLogs();
  }, []);

  const fetchUserMetrics = async () => {
    try {
      console.log("Fetching user metrics from Firestore...");

      // Fetch all users
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const total = usersSnapshot.size;
      setTotalUsers(total);
      console.log("Total users:", total);

      // Calculate users created this month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      console.log(
        "Filtering users created since:",
        firstDayOfMonth.toISOString()
      );

      let monthCount = 0;
      let activeCount = 0;

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();

        // Count users created this month
        if (userData.createdAt) {
          // Handle Firestore Timestamp
          let createdDate;
          if (userData.createdAt.toDate) {
            // Firestore Timestamp object
            createdDate = userData.createdAt.toDate();
          } else if (userData.createdAt.seconds) {
            // Firestore Timestamp in serialized format
            createdDate = new Date(userData.createdAt.seconds * 1000);
          } else if (userData.createdAt instanceof Date) {
            // Already a Date object
            createdDate = userData.createdAt;
          }

          if (createdDate && createdDate >= firstDayOfMonth) {
            monthCount++;
          }
        }

        // Count active sessions
        // Check if user has isActiveSession field or recent lastLogin (within last 30 minutes)
        if (userData.isActiveSession === true) {
          activeCount++;
        } else if (userData.lastLogin) {
          let lastLoginDate;
          if (userData.lastLogin.toDate) {
            lastLoginDate = userData.lastLogin.toDate();
          } else if (userData.lastLogin.seconds) {
            lastLoginDate = new Date(userData.lastLogin.seconds * 1000);
          } else if (userData.lastLogin instanceof Date) {
            lastLoginDate = userData.lastLogin;
          }

          // Consider active if logged in within last 30 minutes
          const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
          if (lastLoginDate && lastLoginDate >= thirtyMinutesAgo) {
            activeCount++;
          }
        }
      });

      setUsersThisMonth(monthCount);
      console.log("Users created this month:", monthCount);

      setActiveSessions(activeCount);
      console.log("Active users:", activeCount);

      // Calculate percentage of active sessions
      const percentage =
        total > 0 ? Math.round((activeCount / total) * 100) : 0;
      setActivePercentage(percentage);
      console.log("Percentage online:", percentage + "%");
    } catch (error) {
      console.error("Error fetching user metrics:", error);
    }
  };

  const fetchReportMetrics = async () => {
    try {
      console.log("Fetching report metrics from Firestore...");

      // Fetch all report logs
      const reportsRef = collection(db, "report_logs");
      const reportsSnapshot = await getDocs(reportsRef);

      // Calculate reports generated this week
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days since last Monday
      const firstDayOfWeek = new Date(now);
      firstDayOfWeek.setDate(now.getDate() - daysToMonday);
      firstDayOfWeek.setHours(0, 0, 0, 0);

      console.log(
        "Filtering reports generated since:",
        firstDayOfWeek.toISOString()
      );

      let weekCount = 0;

      reportsSnapshot.forEach((doc) => {
        const reportData = doc.data();
        if (reportData.timestamp) {
          let reportDate;
          if (reportData.timestamp.toDate) {
            reportDate = reportData.timestamp.toDate();
          } else if (reportData.timestamp.seconds) {
            reportDate = new Date(reportData.timestamp.seconds * 1000);
          } else if (reportData.timestamp instanceof Date) {
            reportDate = reportData.timestamp;
          }

          if (reportDate && reportDate >= firstDayOfWeek) {
            weekCount++;
          }
        }
      });

      setReportsThisWeek(weekCount);
      console.log("Reports generated this week:", weekCount);
    } catch (error) {
      console.error("Error fetching report metrics:", error);
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
        return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
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
        "addFeedSchedule_logs",
        "deleteFeedSchedule_logs",
        "editFeedSchedule_logs",
        "nightTime_logs",
        "report_logs",
        "session_logs",
        "wateringActivity_logs",
      ];

      const allLogs = [];

      // Fetch logs from each collection
      for (const collectionName of logCollections) {
        try {
          const logsRef = collection(db, collectionName);
          const logsSnapshot = await getDocs(logsRef);

          console.log(
            `Fetched ${logsSnapshot.size} logs from ${collectionName}`
          );

          // Process each log document
          for (const docSnap of logsSnapshot.docs) {
            const logData = docSnap.data();

            // Fetch user data from users collection
            let firstName = "Unknown";
            let lastName = "User";

            if (logData.userId) {
              try {
                const userRef = doc(db, "users", logData.userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  firstName = userData.firstName || "Unknown";
                  lastName = userData.lastName || "User";
                }
              } catch (userError) {
                console.warn(
                  `Error fetching user ${logData.userId}:`,
                  userError.message
                );
              }
            }

            // Create a unified log entry
            allLogs.push({
              id: docSnap.id,
              collection: collectionName,
              userId: logData.userId || "Unknown",
              firstName: firstName,
              lastName: lastName,
              action: logData.action || logData.type || "action",
              description:
                logData.description ||
                getDefaultDescription(collectionName, logData),
              timestamp: logData.timestamp,
            });
          }
        } catch (collectionError) {
          console.warn(
            `Error fetching ${collectionName}:`,
            collectionError.message
          );
        }
      }

      console.log("Merged logs:", allLogs.length);

      // Sort by timestamp descending (latest first)
      const sortedLogs = allLogs.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });

      console.log("Sorted logs:", sortedLogs.length);

      // Limit to 10 most recent
      const recentLogs = sortedLogs.slice(0, 10);

      console.log("Recent logs (limited to 10):", recentLogs.length);

      setRecentLogs(recentLogs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    }
  };

  const getDefaultDescription = (collectionName, logData) => {
    switch (collectionName) {
      case "addFeedSchedule_logs":
        return "Added feed schedule";
      case "deleteFeedSchedule_logs":
        return "Deleted feed schedule";
      case "editFeedSchedule_logs":
        return "Edited feed schedule";
      case "nightTime_logs":
        return "Updated night time settings";
      case "report_logs":
        return `Generated ${logData.type || "report"} report`;
      case "session_logs":
        return logData.action === "login" ? "Logged in" : "Logged out";
      case "wateringActivity_logs":
        return "Performed watering activity";
      default:
        return "Performed system action";
    }
  };

  // Analytics state
  const [range, setRange] = useState("Last 7 Days");
  const [LineChartComp, setLineChartComp] = useState(null);
  const [chartError, setChartError] = useState(null);
  const [activePoint, setActivePoint] = useState(null);

  useEffect(() => {
    try {
      const { LineChart } = require("react-native-chart-kit");
      const RN_SVG = require("react-native-svg");

      if (!LineChart) throw new Error("react-native-chart-kit LineChart is undefined");
      if (!RN_SVG || !RN_SVG.Svg) throw new Error("react-native-svg seems missing or invalid");

      setLineChartComp(() => LineChart);
      setChartError(null);
    } catch (err) {
      console.warn("Chart init error:", err?.message ?? err);
      setChartError(err?.message ?? String(err));
      setLineChartComp(null);
    }
  }, []);

  const metrics = [];

  const chartData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        data: [10, 12, 18, 20, 22, 25],
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };
  const chartWidth = Math.max(windowWidth - 48, 200);
  const chartHeight = 220;

  const barData = [
    { label: "Mon", actions: 128, logins: 45 },
    { label: "Tue", actions: 152, logins: 52 },
    { label: "Wed", actions: 134, logins: 48 },
    { label: "Thu", actions: 160, logins: 55 },
    { label: "Fri", actions: 148, logins: 50 },
    { label: "Sat", actions: 95, logins: 35 },
    { label: "Sun", actions: 82, logins: 30 },
  ];

  const barChartHeight = 220;

  const showPointTooltip = (point) => {
    setActivePoint(point);
    setTimeout(() => setActivePoint(null), 2000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 showBackButton={false} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card */}
        <View
          style={[
            styles.welcomeCard,
            {
              backgroundColor: "transparent",
              overflow: "hidden",
            },
          ]}
        >
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              zIndex: 0,
              borderRadius: 16,
              // Simulate the gradient background using a linear gradient library if available
              // If not, fallback to a solid color similar to the gradient
              backgroundColor: "#EBF2F8",
            }}
          />
          <Text style={styles.welcomeTitle}>Welcome, Administrator</Text>
          <Text style={styles.welcomeSubtitle}>
            Manage users, view system activity,{"\n"}
            and generate comprehensive analytics reports.
          </Text>
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { marginRight: 12 }]}>
            <View style={styles.metricHeader}>
              <View style={styles.metricCircleIcon}>
                <MaterialCommunityIcons
                  name="account-group-outline"
                  size={22}
                  color="#234187"
                />
              </View>
              <Text style={[styles.metricTitle, { marginLeft: -8 }]}>
                Total Users
              </Text>
            </View>
            <Text style={styles.metricValue}>{totalUsers}</Text>
            <Text style={styles.metricSub}>+{usersThisMonth} this month</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricCircleIcon, { marginRight: 6 }]}>
                <MaterialCommunityIcons
                  name="chart-timeline-variant"
                  size={22}
                  color="#234187"
                />
              </View>
              <Text
                style={[styles.metricTitle, { marginLeft: -8, lineHeight: 18 }]}
                numberOfLines={2}
              >
                Active Sessions
              </Text>
            </View>
            <Text style={styles.metricValue}>{activeSessions}</Text>
            <Text style={styles.metricSub}>{activePercentage}% online</Text>
          </View>
        </View>

        {/* Reports Generated */}
        <View style={styles.reportCard}>
          <View style={styles.reportLeft}>
            <Text style={styles.reportTitle}>Reports Generated</Text>
            <Text style={styles.reportValue}>{reportsThisWeek}</Text>
            <Text style={styles.reportSub}>This week</Text>
          </View>
          <View style={styles.reportCircleIcon}>
            <MaterialCommunityIcons
              name="presentation"
              size={28}
              color="#234187"
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
                onPress={() => navigation.navigate("UserManagement")}
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
            recentLogs.map((log) => (
              <View
                key={`${log.collection}-${log.id}`}
                style={styles.activityItem}
              >
                <View>
                  <Text style={styles.activityUser}>
                    {log.firstName} {log.lastName}
                  </Text>
                  <Text style={styles.activityDesc}>{log.description}</Text>
                </View>
                <Text style={styles.activityTime}>
                  {getRelativeTime(log.timestamp)}
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
    backgroundColor: "#fff",
  },
  container: {
    flexGrow: 1,
    padding: 18,
    backgroundColor: "#fff",
  },
  welcomeCard: {
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: 20,
    paddingLeft: 10,
    marginBottom: 0,
    marginTop: 8,
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
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 0,
    borderWidth: 1.5,
    borderColor: "#234187",
  },
  fullWidthButtonText: {
    color: "#000",
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
  pickerLabel: { fontSize: 16, color: "#0b2336" },

  rangeButton: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#a9c0d8",
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#fff",
  },
  rangeText: { color: "#16324a", fontSize: 15, marginRight: 8 },

  metricsGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 18 },

  card: {
    width: "48%", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.2, borderColor: "#e1f0fb",
    padding: 14, marginBottom: 12, minHeight: 110, justifyContent: "space-between",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#eef6ff", alignItems: "center", justifyContent: "center", marginRight: 10 },
  cardTitle: { fontSize: 16, color: "#0b2336", fontWeight: "600", flexShrink: 1 },
  cardValue: { fontSize: 34, color: "#000", fontWeight: "800", marginTop: 8 },
  cardSubtitle: { color: "#2a66a6", marginTop: 6, fontSize: 14 },

  chartCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.2, borderColor: "#dbeffb", padding: 14, marginBottom: 18, width: "100%" },
  chartTitle: { fontSize: 18, fontWeight: "800", color: "#0b2336" },

  fallback: { paddingVertical: 18, alignItems: "center" },
  fallbackText: { color: "#b22222", fontWeight: "700" },
  fallbackTextSmall: { color: "#444", marginTop: 6, textAlign: "center" },
  instructions: { marginTop: 10, color: "#333", textAlign: "center", fontSize: 12, paddingHorizontal: 12 },

  tooltipWrapper: { position: "absolute", alignItems: "center", zIndex: 20, elevation: 10 },
  tooltipVerticalLine: { width: 2, backgroundColor: "#333", position: "absolute" },
  tooltipBox: { backgroundColor: "#fff", padding: 8, borderRadius: 6, borderWidth: 1, borderColor: "#ccc", marginBottom: 8, alignItems: "center" },
  tooltipLabel: { fontWeight: "700" },
  tooltipValue: { fontWeight: "700", color: "#154985" },

  dropdownOptionText: { fontSize: 16, color: "#16324a" },
  option: { padding: 12 },

  reportsWrapper: { backgroundColor: "#eef6fb", borderRadius: 12, borderWidth: 1, borderColor: "#d6eaf8", padding: 16 },
  reportsHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  reportsTitle: { fontSize: 18, fontWeight: "800", color: "#133E87", marginLeft: -7 },

  reportsList: { marginTop: 6 },
  reportItem: { backgroundColor: "#fff", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: "#d9eaf6" },
  reportItemTitle: { color: "#133E87", fontWeight: "700", marginBottom: 6 },
  reportItemDesc: { color: "#556b82", fontSize: 13 },

  reportGeneratedCard: { backgroundColor: "#f3f8fc", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#d6eaf8" },
  reportGeneratedTitle: { color: "#0b3b6a", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  reportGeneratedTime: { color: "#556b82", marginBottom: 10 },

  reportRows: { marginTop: 6 },
  reportRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  reportRowLabel: { color: "#334e68" },
  reportRowValue: { color: "#000", fontWeight: "700" },

  exportButtonsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 12 },
  exportPdfButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#cbdff5",
  },
  exportPdfText: {
    color: "#000",
    fontWeight: "700",
  },
});
