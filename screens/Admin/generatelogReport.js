import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import Header2 from "../navigation/adminHeader";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { db } from "../../config/firebaseconfig";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

const Logo = require("../../assets/logo.png");

// Records per page
const RECORDS_PER_PAGE = 10;

export default function GenerateLogReport({ route, navigation }) {
  const { exportData, totalLogs, filters, onExportPDF } = route.params || {};
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsCurrentPage, setLogsCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /**
   * Fetch all activity logs from Firestore
   * Retrieves logs from all sub-collections under activity_logs
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
            });
          });

          console.log(`✅ Fetched ${snapshot.size} logs from ${logType}`);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch ${logType}:`, error.message);
          // Continue with other log types even if one fails
        }
      }

      // Sort logs by timestamp (latest first)
      allLogs.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA; // Descending order
      });

      setActivityLogs(allLogs);
      setTotalPages(Math.ceil(allLogs.length / RECORDS_PER_PAGE));

      console.log(`📊 Total logs fetched: ${allLogs.length}`);
    } catch (error) {
      console.error("❌ Error fetching activity logs:", error);
      Alert.alert("Error", "Failed to load activity logs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format timestamp to "DD-MMM-YYYY" format
   */
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";

    const date = new Date(timestamp);
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
   * Format timestamp to "hh:mm AM/PM" format
   */
  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "N/A";

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;

    return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  };

  /**
   * Get paginated logs for current page
   */
  const getPaginatedLogs = () => {
    const startIndex = (logsCurrentPage - 1) * RECORDS_PER_PAGE;
    const endIndex = startIndex + RECORDS_PER_PAGE;
    return activityLogs.slice(startIndex, endIndex);
  };

  /**
   * Navigate to next page
   */
  const handleLogsNextPage = () => {
    if (logsCurrentPage < totalPages) {
      setLogsCurrentPage(logsCurrentPage + 1);
    }
  };

  /**
   * Navigate to previous page
   */
  const handleLogsPrevPage = () => {
    if (logsCurrentPage > 1) {
      setLogsCurrentPage(logsCurrentPage - 1);
    }
  };

  if (!exportData || exportData.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header2 />
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={80}
            color="#ccc"
          />
          <Text style={styles.emptyText}>No data to preview</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentPage = exportData[currentPageIndex];

  const handleExportPDF = async () => {
    if (onExportPDF) {
      setExporting(true);
      try {
        await onExportPDF();
      } catch (error) {
        console.error("Error exporting PDF:", error);
      } finally {
        setExporting(false);
      }
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < exportData.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Activity Logs Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Activity Logs</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#133E87" />
              <Text style={styles.loadingText}>Loading activity logs...</Text>
            </View>
          ) : activityLogs.length === 0 ? (
            <View style={styles.emptyLogsContainer}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={60}
                color="#ccc"
              />
              <Text style={styles.emptyLogsText}>No logs found</Text>
            </View>
          ) : (
            <>
              {/* Logs Table */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={styles.tableScrollView}
              >
                <View style={styles.logsTableContainer}>
                  {/* Table Header */}
                  <View style={[styles.logsTableRow, styles.logsTableHeader]}>
                    <View style={[styles.logsTableCell, styles.cellDate]}>
                      <Text style={styles.logsHeaderText}>Date</Text>
                    </View>
                    <View style={[styles.logsTableCell, styles.cellTime]}>
                      <Text style={styles.logsHeaderText}>Time</Text>
                    </View>
                    <View style={[styles.logsTableCell, styles.cellUser]}>
                      <Text style={styles.logsHeaderText}>User</Text>
                    </View>
                    <View style={[styles.logsTableCell, styles.cellAction]}>
                      <Text style={styles.logsHeaderText}>Action</Text>
                    </View>
                    <View
                      style={[styles.logsTableCell, styles.cellDescription]}
                    >
                      <Text style={styles.logsHeaderText}>Description</Text>
                    </View>
                  </View>

                  {/* Table Body */}
                  {getPaginatedLogs().map((log, index) => (
                    <View
                      key={log.id}
                      style={[
                        styles.logsTableRow,
                        index % 2 === 0 && styles.logsTableRowEven,
                      ]}
                    >
                      <View style={[styles.logsTableCell, styles.cellDate]}>
                        <Text style={styles.logsCellText}>
                          {formatDate(log.timestamp)}
                        </Text>
                      </View>
                      <View style={[styles.logsTableCell, styles.cellTime]}>
                        <Text style={styles.logsCellText}>
                          {formatTime(log.timestamp)}
                        </Text>
                      </View>
                      <View style={[styles.logsTableCell, styles.cellUser]}>
                        <Text style={styles.logsCellText}>
                          {log.firstName && log.lastName
                            ? `${log.firstName} ${log.lastName}`
                            : log.userName || "N/A"}
                        </Text>
                      </View>
                      <View style={[styles.logsTableCell, styles.cellAction]}>
                        <Text style={styles.logsCellText}>
                          {log.action || "N/A"}
                        </Text>
                      </View>
                      <View
                        style={[styles.logsTableCell, styles.cellDescription]}
                      >
                        <Text style={styles.logsCellText}>
                          {log.description || "N/A"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Pagination Controls */}
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    logsCurrentPage === 1 && styles.paginationButtonDisabled,
                  ]}
                  onPress={handleLogsPrevPage}
                  disabled={logsCurrentPage === 1}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={20}
                    color={logsCurrentPage === 1 ? "#ccc" : "#133E87"}
                  />
                  <Text
                    style={[
                      styles.paginationButtonText,
                      logsCurrentPage === 1 &&
                        styles.paginationButtonTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </TouchableOpacity>

                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}>
                    Page {logsCurrentPage} of {totalPages}
                  </Text>
                  <Text style={styles.paginationSubText}>
                    Showing {getPaginatedLogs().length} of {activityLogs.length}{" "}
                    logs
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    logsCurrentPage === totalPages &&
                      styles.paginationButtonDisabled,
                  ]}
                  onPress={handleLogsNextPage}
                  disabled={logsCurrentPage === totalPages}
                >
                  <Text
                    style={[
                      styles.paginationButtonText,
                      logsCurrentPage === totalPages &&
                        styles.paginationButtonTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={logsCurrentPage === totalPages ? "#ccc" : "#133E87"}
                  />
                </TouchableOpacity>
              </View>

              {/* Bottom Spacing */}
              <View style={styles.bottomSpacing} />
            </>
          )}
        </View>

        {/* Divider */}
        {exportData && exportData.length > 0 && <View style={styles.divider} />}

        {/* Original Export Data Section (if exists) */}
        {exportData && exportData.length > 0 && (
          <>
            {/* Header Section with Logo and Company Info */}
            <View style={styles.headerSection}>
              <Image source={Logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.companyName}>Smart Brooder Systems Inc.</Text>
              <Text style={styles.reportTitle}>Activity Logs Report</Text>
              <View style={styles.filterSummary}>
                <Text style={styles.filterText}>
                  <Text style={styles.filterLabel}>Filter Applied: </Text>
                  Name: {filters?.name || "All"}
                </Text>
                <Text style={styles.filterText}>
                  Date Range: {filters?.startDate || "None"} -{" "}
                  {filters?.endDate || "None"}
                </Text>
                <Text style={styles.filterText}>
                  Total Logs: {totalLogs || 0}
                </Text>
              </View>
            </View>

            {/* Export Button */}
            <TouchableOpacity
              style={[
                styles.exportButton,
                exporting && styles.exportButtonDisabled,
              ]}
              onPress={handleExportPDF}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="file-pdf-box"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.exportButtonText}>Export to PDF</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Page Navigation */}
            {exportData.length > 1 && (
              <View style={styles.pageNavigationTop}>
                <TouchableOpacity
                  style={[
                    styles.pageNavButton,
                    currentPageIndex === 0 && styles.pageNavButtonDisabled,
                  ]}
                  onPress={handlePrevPage}
                  disabled={currentPageIndex === 0}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={20}
                    color={currentPageIndex === 0 ? "#ccc" : "#133E87"}
                  />
                  <Text
                    style={[
                      styles.pageNavButtonText,
                      currentPageIndex === 0 &&
                        styles.pageNavButtonTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageInfo}>
                  Page {currentPageIndex + 1} of {exportData.length}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.pageNavButton,
                    currentPageIndex === exportData.length - 1 &&
                      styles.pageNavButtonDisabled,
                  ]}
                  onPress={handleNextPage}
                  disabled={currentPageIndex === exportData.length - 1}
                >
                  <Text
                    style={[
                      styles.pageNavButtonText,
                      currentPageIndex === exportData.length - 1 &&
                        styles.pageNavButtonTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={
                      currentPageIndex === exportData.length - 1
                        ? "#ccc"
                        : "#133E87"
                    }
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Table Preview */}
            <View style={styles.tableContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  {/* Table Header */}
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <View style={[styles.tableCell, styles.cellNo]}>
                      <Text style={styles.headerText}>No</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellDate]}>
                      <Text style={styles.headerText}>Date</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellTime]}>
                      <Text style={styles.headerText}>Time</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellName]}>
                      <Text style={styles.headerText}>Name</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellRole]}>
                      <Text style={styles.headerText}>Role</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellAction]}>
                      <Text style={styles.headerText}>Action</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellDescription]}>
                      <Text style={styles.headerText}>Description</Text>
                    </View>
                  </View>

                  {/* Table Body */}
                  {currentPage.entries.map((entry, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 && styles.tableRowEven,
                      ]}
                    >
                      <View style={[styles.tableCell, styles.cellNo]}>
                        <Text style={styles.cellText}>{entry.No}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.cellDate]}>
                        <Text style={styles.cellText}>{entry.Date}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.cellTime]}>
                        <Text style={styles.cellText}>{entry.Time}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.cellName]}>
                        <Text style={styles.cellText}>{entry.Name}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.cellRole]}>
                        <Text style={styles.cellText}>{entry.Role}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.cellAction]}>
                        <Text style={styles.cellText}>{entry.Action}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.cellDescription]}>
                        <Text style={styles.cellText}>{entry.Description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Page Info at Bottom */}
            <View style={styles.pageInfoBottom}>
              <Text style={styles.pageInfoText}>
                Showing {currentPage.entriesCount} entries on this page
              </Text>
            </View>
          </>
        )}
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
    padding: 16,
  },
  headerSection: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#133E87",
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
    borderRadius: 50,
  },
  companyName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#133E87",
    marginBottom: 8,
    textAlign: "center",
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  filterSummary: {
    backgroundColor: "#F7F9FB",
    padding: 16,
    borderRadius: 8,
    width: "100%",
    marginTop: 8,
  },
  filterText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  filterLabel: {
    fontWeight: "600",
    color: "#333",
  },
  exportButton: {
    backgroundColor: "#133E87",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
    shadowColor: "#133E87",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportButtonDisabled: {
    backgroundColor: "#8A99A8",
    shadowOpacity: 0,
    elevation: 0,
  },
  exportButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  pageNavigationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  pageNavButton: {
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
  pageNavButtonDisabled: {
    backgroundColor: "#F7F8FA",
    borderColor: "#E5E7EB",
  },
  pageNavButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#133E87",
  },
  pageNavButtonTextDisabled: {
    color: "#ccc",
  },
  pageInfo: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
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
  cellNo: {
    width: 50,
  },
  cellDate: {
    width: 110,
  },
  cellTime: {
    width: 90,
  },
  cellName: {
    width: 150,
  },
  cellRole: {
    width: 100,
  },
  cellAction: {
    width: 140,
  },
  cellDescription: {
    width: 250,
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
  pageInfoBottom: {
    marginTop: 16,
    alignItems: "center",
  },
  pageInfoText: {
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: "#133E87",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Activity Logs Styles
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#133E87",
    marginBottom: 16,
    textAlign: "center",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyLogsContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLogsText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  tableScrollView: {
    marginBottom: 16,
  },
  logsTableContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  logsTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  logsTableHeader: {
    backgroundColor: "#133E87",
  },
  logsTableRowEven: {
    backgroundColor: "#F9FAFB",
  },
  logsTableCell: {
    padding: 12,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  cellUser: {
    width: 180,
  },
  logsHeaderText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  logsCellText: {
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
    marginTop: 8,
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
  divider: {
    height: 2,
    backgroundColor: "#E5E7EB",
    marginVertical: 24,
  },
  bottomSpacing: {
    height: 24,
  },
});
