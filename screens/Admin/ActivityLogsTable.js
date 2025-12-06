import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { db } from "../../config/firebaseconfig";
import { collection, getDocs } from "firebase/firestore";

// Records per page
const RECORDS_PER_PAGE = 10;

export default function ActivityLogsTable({ navigation }) {
  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /**
   * Fetch all activity logs from Firestore
   * IMPORTANT: Uses the saved Firestore timestamp field, not fetch time
   */
  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      const allLogs = [];

      // Define all log sub-collection types
      const logTypes = [
        "addFeedSchedule_logs",
        "editFeedSchedule_logs",
        "deleteFeedSchedule_logs",
        "addWaterSchedule_logs",
        "editWaterSchedule_logs",
        "deleteWaterSchedule_logs",
        "wateringActivity_logs",
        "nightTime_logs",
        "report_logs",
        "session_logs",
      ];

      // Fetch logs from each sub-collection
      for (const logType of logTypes) {
        try {
          const logsRef = collection(db, "activity_logs", logType, "logs");
          const snapshot = await getDocs(logsRef);

          snapshot.forEach((doc) => {
            const data = doc.data();
            allLogs.push({
              id: doc.id,
              type: logType,
              ...data,
              // CRITICAL: Use the saved Firestore timestamp field
              // This is the time when the record was saved to the database
              savedTimestamp: data.timestamp, // This is the saved field from Firestore
            });
          });

          console.log(`✅ Fetched ${snapshot.size} logs from ${logType}`);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch ${logType}:`, error.message);
          // Continue with other log types even if one fails
        }
      }

      // Sort logs by SAVED timestamp (latest first - descending order)
      // This ensures we're sorting by when the record was created in Firestore,
      // not when we fetched it
      allLogs.sort((a, b) => {
        const timeA = a.savedTimestamp
          ? new Date(a.savedTimestamp).getTime()
          : 0;
        const timeB = b.savedTimestamp
          ? new Date(b.savedTimestamp).getTime()
          : 0;
        return timeB - timeA; // Descending order (latest first)
      });

      setActivityLogs(allLogs);
      setTotalPages(Math.ceil(allLogs.length / RECORDS_PER_PAGE));

      console.log(
        `📊 Total logs fetched: ${allLogs.length} (sorted by saved timestamp)`
      );
    } catch (error) {
      console.error("❌ Error fetching activity logs:", error);
      Alert.alert("Error", "Failed to load activity logs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format SAVED timestamp to "DD-MMM-YYYY" format
   * Uses the timestamp field that was saved to Firestore
   */
  const formatDate = (savedTimestamp) => {
    if (!savedTimestamp) return "N/A";

    const date = new Date(savedTimestamp);
    if (isNaN(date.getTime())) return "N/A";

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

  /**
   * Format SAVED timestamp to "hh:mm AM/PM" format with space
   * Uses the timestamp field that was saved to Firestore
   */
  const formatTime = (savedTimestamp) => {
    if (!savedTimestamp) return "N/A";

    const date = new Date(savedTimestamp);
    if (isNaN(date.getTime())) return "N/A";

    // Convert to GMT+8
    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const hours = gmt8Date.getUTCHours();
    const minutes = gmt8Date.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;

    return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  };

  /**
   * Get paginated logs for current page
   */
  const getPaginatedLogs = () => {
    const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
    const endIndex = startIndex + RECORDS_PER_PAGE;
    return activityLogs.slice(startIndex, endIndex);
  };

  /**
   * Navigate to next page
   */
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  /**
   * Navigate to previous page
   */
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#133E87"
            />
          </TouchableOpacity>
          <Text style={styles.title}>Activity Logs</Text>
          <TouchableOpacity
            onPress={fetchActivityLogs}
            style={styles.refreshButton}
          >
            <MaterialCommunityIcons name="refresh" size={24} color="#133E87" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#133E87" />
            <Text style={styles.loadingText}>Loading activity logs...</Text>
          </View>
        ) : activityLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={80}
              color="#ccc"
            />
            <Text style={styles.emptyText}>No logs found</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchActivityLogs}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Table with Frozen Header */}
            <View style={styles.tableWrapper}>
              {/* Frozen Header Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                style={styles.frozenHeaderScroll}
              >
                <View style={styles.tableHeaderContainer}>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <View style={[styles.tableCell, styles.cellDate]}>
                      <Text style={styles.headerText}>Date</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellTime]}>
                      <Text style={styles.headerText}>Time</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellUser]}>
                      <Text style={styles.headerText}>User</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellAction]}>
                      <Text style={styles.headerText}>Action</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellDescription]}>
                      <Text style={styles.headerText}>Description</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Scrollable Table Body */}
              <ScrollView
                style={styles.tableBodyScroll}
                showsVerticalScrollIndicator={true}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={styles.tableBodyContainer}>
                    {getPaginatedLogs().map((log, index) => (
                      <View
                        key={log.id}
                        style={[
                          styles.tableRow,
                          index % 2 === 0 && styles.tableRowEven,
                        ]}
                      >
                        <View style={[styles.tableCell, styles.cellDate]}>
                          <Text style={styles.cellText}>
                            {formatDate(log.savedTimestamp)}
                          </Text>
                        </View>
                        <View style={[styles.tableCell, styles.cellTime]}>
                          <Text style={styles.cellText}>
                            {formatTime(log.savedTimestamp)}
                          </Text>
                        </View>
                        <View style={[styles.tableCell, styles.cellUser]}>
                          <Text style={styles.cellText}>
                            {log.firstName && log.lastName
                              ? `${log.firstName} ${log.lastName}`
                              : log.userName || "N/A"}
                          </Text>
                        </View>
                        <View style={[styles.tableCell, styles.cellAction]}>
                          <Text style={styles.cellText}>
                            {log.action || "N/A"}
                          </Text>
                        </View>
                        <View
                          style={[styles.tableCell, styles.cellDescription]}
                        >
                          <Text style={styles.cellText}>
                            {log.description || "N/A"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </ScrollView>
            </View>

            {/* Pagination Controls */}
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={handlePrevPage}
                disabled={currentPage === 1}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={20}
                  color={currentPage === 1 ? "#ccc" : "#133E87"}
                />
                <Text
                  style={[
                    styles.paginationButtonText,
                    currentPage === 1 && styles.paginationButtonTextDisabled,
                  ]}
                >
                  Previous
                </Text>
              </TouchableOpacity>

              <View style={styles.paginationInfo}>
                <Text style={styles.paginationText}>
                  Page {currentPage} of {totalPages}
                </Text>
                <Text style={styles.paginationSubText}>
                  Showing {getPaginatedLogs().length} of {activityLogs.length}{" "}
                  logs
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === totalPages && styles.paginationButtonDisabled,
                ]}
                onPress={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    currentPage === totalPages &&
                      styles.paginationButtonTextDisabled,
                  ]}
                >
                  Next
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={currentPage === totalPages ? "#ccc" : "#133E87"}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#133E87",
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#133E87",
    flex: 1,
    textAlign: "center",
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#133E87",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  tableWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  frozenHeaderScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tableHeaderContainer: {
    backgroundColor: "#133E87",
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableBodyContainer: {
    backgroundColor: "#fff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableHeader: {
    backgroundColor: "#133E87",
  },
  tableRowEven: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    padding: 12,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  cellDate: {
    width: 120,
  },
  cellTime: {
    width: 100,
  },
  cellUser: {
    width: 180,
  },
  cellAction: {
    width: 200,
  },
  cellDescription: {
    width: 300,
  },
  headerText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  cellText: {
    color: "#333",
    fontSize: 13,
    textAlign: "center",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  paginationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  paginationButtonDisabled: {
    backgroundColor: "#F7F8FA",
    borderColor: "#E5E7EB",
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#133E87",
  },
  paginationButtonTextDisabled: {
    color: "#ccc",
  },
  paginationInfo: {
    alignItems: "center",
  },
  paginationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  paginationSubText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});
