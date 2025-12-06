import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../../../config/firebaseconfig";
import HeaderUpdated from "../../navigation/Header";
import BottomNavigation from "../../navigation/BottomNavigation";
import CalendarModal from "../../navigation/CalendarModal";
import GenerateLogReportModal from "./GenerateLogReportModal";

const Icon = Feather;

// Define column widths
const COLUMN_WIDTHS = {
  date: 100,
  time: 75,
  user: 120,
  action: 150,
  description: 250,
};

const TABLE_WIDTH = Object.values(COLUMN_WIDTHS).reduce(
  (sum, width) => sum + width,
  0
);

export default function ActivityLogs({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState("");

  // Fetch logs from Firestore
  useEffect(() => {
    const fetchActivityLogs = async () => {
      try {
        setLoading(true);
        const currentUser = auth.currentUser;

        if (!currentUser) {
          console.log("No user logged in");
          setLoading(false);
          return;
        }

        const userId = currentUser.uid;

        // Fetch current user profile to get name
        const userDoc = await getDocs(
          query(collection(db, "users"), where("uid", "==", userId))
        );
        let userName = "";
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          userName =
            `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
        }
        setCurrentUserName(userName);

        const collections = [
          "addFeedSchedule_logs",
          "deleteFeedSchedule_logs",
          "editFeedSchedule_logs",
          "nightTime_logs",
          "report_logs",
          "session_logs",
          "wateringActivity_logs",
        ];

        // Fetch logs from all collections
        const allLogsPromises = collections.map(async (collectionName) => {
          const q = query(
            collection(db, collectionName),
            where("userId", "==", userId)
          );
          const querySnapshot = await getDocs(q);

          return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            source: collectionName, // Add source field
          }));
        });

        // Wait for all promises to resolve
        const logsArrays = await Promise.all(allLogsPromises);

        // Flatten and merge all logs
        const mergedLogs = logsArrays.flat();

        // Sort by timestamp (descending) - normalize timestamps first
        const sortedLogs = mergedLogs.sort((a, b) => {
          // Normalize timestamp for log A
          let dateA;
          if (a.timestamp?.toDate && typeof a.timestamp.toDate === "function") {
            dateA = a.timestamp.toDate();
          } else if (typeof a.timestamp === "string") {
            dateA = new Date(a.timestamp);
          } else if (a.timestamp instanceof Date) {
            dateA = a.timestamp;
          } else {
            dateA = a.date || new Date(0);
          }

          // Normalize timestamp for log B
          let dateB;
          if (b.timestamp?.toDate && typeof b.timestamp.toDate === "function") {
            dateB = b.timestamp.toDate();
          } else if (typeof b.timestamp === "string") {
            dateB = new Date(b.timestamp);
          } else if (b.timestamp instanceof Date) {
            dateB = b.timestamp;
          } else {
            dateB = b.date || new Date(0);
          }

          // Sort descending (latest first)
          return dateB - dateA;
        });

        setActivityLogs(sortedLogs);
      } catch (error) {
        console.error("Error fetching activity logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityLogs();
  }, []);

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Convert Firestore timestamp to GMT+8 and format as DD-MMM-YYYY
  const formatToGMT8Date = (timestamp) => {
    if (!timestamp) return "N/A";

    let date;
    // Handle Firestore Timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    }
    // Handle ISO string
    else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    }
    // Handle Date object
    else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return "N/A";
    }

    // Convert to GMT+8 (add 8 hours in milliseconds)
    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);

    const day = String(gmt8Date.getUTCDate()).padStart(2, "0");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[gmt8Date.getUTCMonth()];
    const year = gmt8Date.getUTCFullYear();

    return `${day}-${month}-${year}`;
  };

  // Convert Firestore timestamp to GMT+8 and format as HH:MM AM/PM
  const formatToGMT8Time = (timestamp) => {
    if (!timestamp) return "N/A";

    let date;
    // Handle Firestore Timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    }
    // Handle ISO string
    else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    }
    // Handle Date object
    else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return "N/A";
    }

    // Convert to GMT+8 (add 8 hours in milliseconds)
    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);

    const hours = gmt8Date.getUTCHours();
    const minutes = gmt8Date.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;

    return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  const isSameDate = (timestamp, selectedDate) => {
    if (!selectedDate || !timestamp) return true;

    let date;
    // Handle Firestore Timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    }
    // Handle ISO string
    else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    }
    // Handle Date object
    else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return true;
    }

    // Convert to GMT+8 (add 8 hours in milliseconds)
    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);

    return (
      gmt8Date.getUTCFullYear() === selectedDate.getFullYear() &&
      gmt8Date.getUTCMonth() === selectedDate.getMonth() &&
      gmt8Date.getUTCDate() === selectedDate.getDate()
    );
  };

  const filteredLogs = activityLogs.filter((log) =>
    isSameDate(log.timestamp, selectedDate)
  );

  const handleGenerateReport = () => {
    setShowGenerateModal(true);
  };

  const handleCalendarPress = () => {
    setShowCalendar(true);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleClearDateFilter = () => {
    setSelectedDate(null);
  };

  const handleLogGenerated = (logData) => {
    // Close the modal
    setShowGenerateModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.headerContainer}>
        <Text style={styles.pageTitle}>Activity Logs</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={handleGenerateReport}>
            {({ pressed }) => (
              <View
                style={[
                  styles.generateHeaderButton,
                  pressed && styles.generateHeaderButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.generateHeaderText,
                    pressed && styles.generateHeaderTextPressed,
                  ]}
                >
                  Generate Log Report
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={handleCalendarPress}>
            {({ pressed }) => (
              <View
                style={[
                  styles.calendarButton,
                  pressed && styles.calendarButtonPressed,
                ]}
              >
                <Icon
                  name="calendar"
                  size={18}
                  color={pressed ? "#ffffff" : "#1a1a1a"}
                />
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading activity logs...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* Selected Date Display & Clear Button */}
          {selectedDate && (
            <View style={styles.dateFilterBanner}>
              <View style={styles.dateFilterContent}>
                <Icon name="calendar" size={16} color="#3b82f6" />
                <Text style={styles.dateFilterText}>
                  Showing logs for {formatDate(selectedDate)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClearDateFilter}
                style={styles.clearDateButton}
              >
                <Icon name="x" size={16} color="#64748b" />
                <Text style={styles.clearDateText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tableCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              style={styles.horizontalScroll}
              contentContainerStyle={{ width: TABLE_WIDTH }}
            >
              <View style={[styles.table, { width: TABLE_WIDTH }]}>
                {/* Header */}
                <View style={[styles.row, styles.headerRow]}>
                  <View
                    style={[
                      styles.cell,
                      styles.leftCell,
                      { width: COLUMN_WIDTHS.date },
                    ]}
                  >
                    <Text style={styles.headerText}>Date</Text>
                  </View>
                  <View style={[styles.cell, { width: COLUMN_WIDTHS.time }]}>
                    <Text style={styles.headerText}>Time</Text>
                  </View>
                  <View style={[styles.cell, { width: COLUMN_WIDTHS.user }]}>
                    <Text style={styles.headerText}>User</Text>
                  </View>
                  <View style={[styles.cell, { width: COLUMN_WIDTHS.action }]}>
                    <Text style={styles.headerText}>Action</Text>
                  </View>
                  <View
                    style={[
                      styles.cell,
                      styles.rightCell,
                      { width: COLUMN_WIDTHS.description },
                    ]}
                  >
                    <Text style={styles.headerText}>Description</Text>
                  </View>
                </View>

                {/* Table Rows */}
                {filteredLogs.map((log) => (
                  <View key={log.id} style={styles.row}>
                    <View
                      style={[
                        styles.cell,
                        styles.leftCell,
                        { width: COLUMN_WIDTHS.date },
                      ]}
                    >
                      <Text style={styles.cellText}>
                        {formatToGMT8Date(log.timestamp)}
                      </Text>
                    </View>
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.time }]}>
                      <Text style={styles.cellText}>
                        {formatToGMT8Time(log.timestamp)}
                      </Text>
                    </View>
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.user }]}>
                      <Text style={styles.cellText}>
                        {currentUserName || "N/A"}
                      </Text>
                    </View>
                    <View
                      style={[styles.cell, { width: COLUMN_WIDTHS.action }]}
                    >
                      <Text style={styles.cellText}>{log.action || "N/A"}</Text>
                    </View>
                    <View
                      style={[
                        styles.cell,
                        styles.rightCell,
                        { width: COLUMN_WIDTHS.description },
                      ]}
                    >
                      <Text style={styles.cellText}>
                        {log.description || "N/A"}
                      </Text>
                    </View>
                  </View>
                ))}

                {/* Empty State */}
                {filteredLogs.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No logs found</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Calendar Modal */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelectDate={handleDateSelect}
        minimumDate={new Date(2025, 7, 1)}
        maximumDate={new Date()}
      />

      {/* Generate Log Report Modal */}
      <GenerateLogReportModal
        visible={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleLogGenerated}
        logs={activityLogs}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#f8fafc",
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  generateHeaderButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#154b99",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  generateHeaderButtonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  generateHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  generateHeaderTextPressed: {
    color: "#ffffff",
  },
  calendarButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  calendarButtonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  dateFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  dateFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e40af",
  },
  clearDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearDateText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  tableCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  horizontalScroll: {
    width: "100%",
  },
  table: {
    backgroundColor: "#ffffff",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerRow: {
    backgroundColor: "#f8fafc",
    borderBottomColor: "#e5e7eb",
  },
  cell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  leftCell: {
    borderLeftWidth: 0,
  },
  rightCell: {
    borderRightWidth: 0,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000000",
  },
  cellText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
});
