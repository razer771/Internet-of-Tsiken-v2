import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import Header2 from "../navigation/adminHeader";
import Icon from "react-native-vector-icons/Feather";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native"; // Add this import

export default function AdminDashboard() {
  const navigation = useNavigation(); // Add this line
  const [pressedBtn, setPressedBtn] = useState(null);

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
                <MaterialCommunityIcons name="account-group-outline" size={22} color="#234187" />
              </View>
              <Text style={[styles.metricTitle, { marginLeft: -8 }]}>Total Users</Text>
            </View>
            <Text style={styles.metricValue}>24</Text>
            <Text style={styles.metricSub}>+3 this month</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricCircleIcon, { marginRight: 6 }]}>
                <MaterialCommunityIcons name="chart-timeline-variant" size={22} color="#234187" />
              </View>
              <Text
                style={[styles.metricTitle, { transform: [{ translateX: -12 }] }]} // Shift text more to the left
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Active Sessions
              </Text>
            </View>
            <Text style={styles.metricValue}>18</Text>
            <Text style={styles.metricSub}>75% online</Text>
          </View>
        </View>

        {/* Reports Generated */}
        <View style={styles.reportCard}>
          <View style={styles.reportLeft}>
            <Text style={styles.reportTitle}>Reports Generated</Text>
            <Text style={styles.reportValue}>142</Text>
            <Text style={styles.reportSub}>This week</Text>
          </View>
          <View style={styles.reportCircleIcon}>
            <MaterialCommunityIcons name="presentation" size={28} color="#234187" />
          </View>
        </View>

        {/* --- Admin Actions Section --- */}
        <View style={styles.actionCard}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="account-group-outline" size={28} color="#133E87" style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Manage User Accounts</Text>
              <Text style={styles.actionDesc}>
                View, create, update and manage all user accounts in the system.
              </Text>
              <TouchableOpacity
                style={[
                  styles.fullWidthButton,
                  { borderColor: "#234187" },
                  pressedBtn === "userManagement" && { backgroundColor: "#133E87" }
                ]}
                activeOpacity={0.85}
                onPressIn={() => setPressedBtn("userManagement")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => navigation.navigate("UserManagement")} // <-- Navigate to userManagement.js
              >
                <Text style={[
                  styles.fullWidthButtonText,
                  pressedBtn === "userManagement" && { color: "#fff" }
                ]}>
                  Open User Management
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="account-plus-outline" size={28} color="#133E87" style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Create Account</Text>
              <Text style={styles.actionDesc}>
                Create a new user account with role and permissions
              </Text>
              <TouchableOpacity
                style={[
                  styles.fullWidthButton,
                  { borderColor: "#234187" },
                  pressedBtn === "createAccount" && { backgroundColor: "#133E87" }
                ]}
                activeOpacity={0.85}
                onPressIn={() => setPressedBtn("createAccount")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => navigation.navigate("CreateAccount")} // Added navigation
              >
                <Text style={[
                  styles.fullWidthButtonText,
                  pressedBtn === "createAccount" && { color: "#fff" }
                ]}>
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="file-document-outline" size={28} color="#133E87" style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>View Activity Logs</Text>
              <Text style={styles.actionDesc}>
                Monitor system activity, view audit logs, and generate activity reports.
              </Text>
              <TouchableOpacity
                style={[
                  styles.fullWidthButton,
                  { borderColor: "#234187" },
                  pressedBtn === "activityLogs" && { backgroundColor: "#133E87" }
                ]}
                activeOpacity={0.85}
                onPressIn={() => setPressedBtn("activityLogs")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => navigation.navigate("ActivityLogs")} // <-- navigate to ActivityLogs
              >
                <Text style={[
                  styles.fullWidthButtonText,
                  pressedBtn === "activityLogs" && { color: "#fff" }
                ]}>
                  Open Activity Logs
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="chart-bar" size={28} color="#133E87" style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>View Analytics</Text>
              <Text style={styles.actionDesc}>
                View comprehensive system analytics and generate detailed reports.
              </Text>
              <TouchableOpacity
                style={[
                  styles.fullWidthButton,
                  { borderColor: "#234187" },
                  pressedBtn === "analytics" && { backgroundColor: "#133E87" } // All buttons turn blue when pressed
                ]}
                activeOpacity={0.85}
                onPressIn={() => setPressedBtn("analytics")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => navigation.navigate("AdminAnalytics")} // Navigate to adminAnalytics.js
              >
                <Text style={[
                  styles.fullWidthButtonText,
                  pressedBtn === "analytics" && { color: "#fff" }
                ]}>
                  Open Analytics
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Recent System Activity */}
        <View style={styles.activityCard}>
          <Text style={styles.activityTitle}>Recent System Activity</Text>
          <View style={styles.activityItem}>
            <View>
              <Text style={styles.activityUser}>Juan Dela Cruz</Text>
              <Text style={styles.activityDesc}>Created new user account</Text>
            </View>
            <Text style={styles.activityTime}>5 minutes ago</Text>
          </View>
          <View style={styles.activityItem}>
            <View>
              <Text style={styles.activityUser}>Maria Santos</Text>
              <Text style={styles.activityDesc}>Updated user permissions</Text>
            </View>
            <Text style={styles.activityTime}>15 minutes ago</Text>
          </View>
          <View style={styles.activityItem}>
            <View>
              <Text style={styles.activityUser}>John</Text>
              <Text style={styles.activityDesc}>Generated weekly report</Text>
            </View>
            <Text style={styles.activityTime}>1 hour ago</Text>
          </View>
          <View style={styles.activityItem}>
            <View>
              <Text style={styles.activityUser}>Ana Garcia</Text>
              <Text style={styles.activityDesc}>Forced password change for user</Text>
            </View>
            <Text style={styles.activityTime}>1 hour ago</Text>
          </View>
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
    backgroundColor: "#EBF2F8", // fallback color
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    position: "relative",
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
    fontSize: 16,         // match actionTitle, reportTitle, activityTitle
    fontWeight: "600",    // match actionTitle, reportTitle, activityTitle
    color: "#000000",        // match actionTitle, reportTitle, activityTitle
    marginBottom: 0,
    marginLeft: -5
  },
  metricValue: {
    fontSize: 34,
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
    fontSize: 16,           // match actionTitle
    fontWeight: "600",      // match actionTitle
    color: "#000000",          // match actionTitle
    marginBottom: 4,        // match actionTitle
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
    fontSize: 16,           // match actionTitle
    fontWeight: "600",      // match actionTitle
    color: "#000000",          // match actionTitle
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