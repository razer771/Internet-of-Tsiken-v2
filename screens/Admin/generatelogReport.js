// Helper: Normalize Firestore Timestamp, ISO string, or Date to Date object
const normalizeTimestamp = (ts) => {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate(); // Firestore Timestamp
  if (typeof ts === "string") return new Date(ts); // ISO string
  if (ts instanceof Date) return ts; // Already Date
  return null;
};

// Helper: Format date to DD-MMM-YYYY in GMT+8
const monthNamesShort = [
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
const formatDateGMT8 = (date) => {
  if (!date) return "N/A";
  const validDate = date instanceof Date ? date : new Date(date);
  if (isNaN(validDate.getTime())) {
    console.warn("⚠️ Invalid date in formatDateGMT8:", date);
    return "N/A";
  }
  const gmt8Date = new Date(validDate.getTime() + 8 * 60 * 60 * 1000);
  const day = String(gmt8Date.getUTCDate()).padStart(2, "0");
  const month = monthNamesShort[gmt8Date.getUTCMonth()];
  const year = gmt8Date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

const formatTimeGMT8 = (date) => {
  if (!date) return "N/A";
  const validDate = date instanceof Date ? date : new Date(date);
  if (isNaN(validDate.getTime())) {
    console.warn("⚠️ Invalid date in formatTimeGMT8:", date);
    return "N/A";
  }
  const gmt8Date = new Date(validDate.getTime() + 8 * 60 * 60 * 1000);
  let hours = gmt8Date.getUTCHours();
  const minutes = String(gmt8Date.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};
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
  Modal,
} from "react-native";
import Header2 from "../navigation/adminHeader";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import {
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig";

const Logo = require("../../assets/logo.png");

export default function GenerateLogReport({ route }) {
  const { exportData, totalLogs, filters, onExportPDF } = route.params || {};
  const navigation = require("@react-navigation/native").useNavigation();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch latest 10 activity logs
  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      const logTypes = [
        "addFeedSchedule_logs",
        "deleteFeedSchedule_logs",
        "addWaterSchedule_logs",
        "deleteWaterSchedule_logs",
        "editFeedSchedule_logs",
        "editWaterSchedule_logs",
        "nightTime_logs",
        "report_logs",
        "session_logs",
        "wateringActivity_logs",
        "activity_logs",
        "addBatch_logs",
      ];

      // Run all queries in parallel
      const snapshots = await Promise.all(
        logTypes.map((type) =>
          getDocs(
            query(
              collection(db, "activity_logs", type, "logs"),
              orderBy("timestamp", "desc"),
              limit(10)
            )
          )
        )
      );

      // Merge results and ensure timestamp, Date, and Time fields
      const allLogs = snapshots.flatMap((snap, idx) =>
        snap.docs.map((doc) => {
          const data = doc.data();
          let timestamp;
          // Safe timestamp conversion
          if (data.timestamp?.toDate) {
            timestamp = data.timestamp.toDate();
          } else if (typeof data.timestamp === "string") {
            timestamp = new Date(data.timestamp);
          } else if (data.timestamp instanceof Date) {
            timestamp = data.timestamp;
          } else {
            console.warn(
              "⚠️ Unknown timestamp format:",
              doc.id,
              data.timestamp
            );
            timestamp = new Date(0);
          }
          if (isNaN(timestamp.getTime())) {
            console.warn("⚠️ Invalid timestamp:", doc.id);
            timestamp = new Date(0);
          }
          return {
            id: doc.id,
            type: logTypes[idx],
            ...data,
            timestamp,
            Date: formatDateGMT8(timestamp),
            Time: formatTimeGMT8(timestamp),
          };
        })
      );

      // Sort globally and keep only 10 latest
      allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const latest10 = allLogs.slice(0, 10);

      setActivityLogs(latest10);
      setTotalPages(1);
      console.log("✅ Latest 10 logs fetched:", latest10);
    } catch (err) {
      console.error("❌ Error fetching logs:", err);
      Alert.alert("Error", "Failed to load logs: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch logs on component mount
  useEffect(() => {
    fetchActivityLogs();
  }, []);

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
    // Debug: log exportData structure
    console.log("ExportData for PDF:", JSON.stringify(exportData, null, 2));
    setExporting(true);
    try {
      // Build HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #133E87;
              padding-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #133E87;
              margin-bottom: 5px;
            }
            .report-title {
              font-size: 20px;
              color: #333;
              margin-bottom: 15px;
            }
            .filter-info {
              font-size: 12px;
              color: #666;
              margin-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #133E87;
              color: white;
              padding: 10px;
              text-align: left;
              font-size: 12px;
              border: 1px solid #ddd;
            }
            td {
              padding: 8px;
              border: 1px solid #ddd;
              font-size: 11px;
              color: #333;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
          </style>
        </head>
        <body>
      `;

      // Add header section
      htmlContent += `
        <div class="header">
          <div class="company-name">Smart Brooder Systems Inc.</div>
          <div class="report-title">Activity Logs Report</div>
          <div class="filter-info">
            Filter Applied: Name: ${filters?.name || "All"}
          </div>
          <div class="filter-info">
            Date Range: ${filters?.startDate || " "} - ${filters?.endDate || " "}
          </div>
          <div class="filter-info">
            Total Logs: ${totalLogs || 0}
          </div>
        </div>
      `;

      // Add table
      htmlContent += `
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">No</th>
              <th style="width: 12%;">Date</th>
              <th style="width: 10%;">Time</th>
              <th style="width: 15%;">Name</th>
              <th style="width: 10%;">Role</th>
              <th style="width: 15%;">Action</th>
              <th style="width: 33%;">Description</th>
            </tr>
          </thead>
          <tbody>
      `;

      // Add all entries from all pages
      let entryNumber = 1;
      exportData.forEach((page) => {
        page.entries.forEach((entry) => {
          // Normalize timestamp before formatting, or use pre-formatted fields
          const ts = normalizeTimestamp(entry.timestamp);
          const dateStr = ts ? formatDateGMT8(ts) : entry.Date || "N/A";
          const timeStr = ts ? formatTimeGMT8(ts) : entry.Time || "N/A";

          htmlContent += `
            <tr>
              <td>${entryNumber}</td>
              <td>${dateStr}</td>
              <td>${timeStr}</td>
              <td>${entry.Name || "N/A"}</td>
              <td>${entry.Role || "N/A"}</td>
              <td>${entry.Action || "N/A"}</td>
              <td>${entry.Description || "N/A"}</td>
            </tr>
          `;
          entryNumber++;
        });
      });

      htmlContent += `
          </tbody>
        </table>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Custom filename
      const formatDateForFilename = (date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
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
        const month = monthNames[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      };

      // Always use today's date for filename
      const today = new Date();
      const filename = `ActivityLogs_${formatDateForFilename(today)}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${filename}`;

      // Move file to permanent location
      await FileSystem.moveAsync({ from: uri, to: newUri });

      // Log report to Firestore with GMT+8 timestamp
      const user = auth.currentUser;
      if (user) {
        // Fetch user details for the log
        let userName = "Unknown User";
        let firstName = "";
        let lastName = "";
        let userRole = "N/A";
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            firstName = userData.firstName || "";
            lastName = userData.lastName || "";
            userName = `${firstName} ${lastName}`.trim() || "Unknown User";
            userRole = userData.role
              ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1)
              : "N/A";
          }
        } catch (err) {
          console.warn("⚠️ Could not fetch user details:", err);
        }

        // Create timestamp (UTC, formatting functions will handle GMT+8 conversion)
        const now = new Date();
        const timestamp = now.toISOString();

        console.log("📝 Saving report to 'report' collection...");
        // Save to "report" collection
        await addDoc(collection(db, "report"), {
          fileName: filename,
          reportName: "Activity Logs Report",
          timestamp: timestamp, // UTC ISO string
          type: "pdf",
          userId: user.uid,
          userName: userName,
          firstName: firstName,
          lastName: lastName,
          role: userRole,
          generatedBy: userName,
          filterApplied: {
            name: filters?.name || "All",
            startDate: filters?.startDate || "None",
            endDate: filters?.endDate || "None",
          },
          totalLogs: totalLogs || 0,
        });
        console.log("✅ Report saved to 'report' collection");

        console.log("📝 Saving activity log to 'report_logs' collection...");
        // Save to "report_logs" collection (for activity logs tracking)
        await addDoc(collection(db, "report_logs"), {
          fileName: filename,
          reportName: "Activity Logs Report",
          timestamp: timestamp, // UTC ISO string
          type: "pdf",
          userId: user.uid,
          userName: userName,
          firstName: firstName,
          lastName: lastName,
          role: userRole,
          action: "Generated a report",
          description: `Generated Activity Logs report`,
        });
        console.log("✅ Activity log saved to 'report_logs' collection");
      }

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Activity Logs Report",
        });
      } else {
        Alert.alert("Success", `PDF saved as ${filename}`, [{ text: "OK" }]);
      }

      // Show success modal
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      Alert.alert("Error", "Failed to export PDF: " + error.message);
    } finally {
      setExporting(false);
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
        {/* Divider */}
        {exportData && exportData.length > 0 && <View style={styles.divider} />}

        {/* Original Export Data Section (if exists) */}
        {exportData && exportData.length > 0 && (
          <>
            {/* Header Section with Logo and Company Info */}
            <View style={styles.headerSection}>
              <TouchableOpacity
                style={styles.backArrow}
                onPress={() => navigation.goBack()}
                accessibilityLabel="Go Back"
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={28}
                  color="#133E87"
                />
              </TouchableOpacity>
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
                  {currentPage.entries.map((entry, index) => {
                    // Normalize timestamp before formatting, or use pre-formatted fields
                    const ts = normalizeTimestamp(entry.timestamp);
                    const dateStr = ts
                      ? formatDateGMT8(ts)
                      : entry.Date || "N/A";
                    const timeStr = ts
                      ? formatTimeGMT8(ts)
                      : entry.Time || "N/A";
                    return (
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
                          <Text style={styles.cellText}>{dateStr}</Text>
                        </View>
                        <View style={[styles.tableCell, styles.cellTime]}>
                          <Text style={styles.cellText}>{timeStr}</Text>
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
                        <View
                          style={[styles.tableCell, styles.cellDescription]}
                        >
                          <Text style={styles.cellText}>
                            {entry.Description}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
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

      {/* Success Modal */}
      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons
              name="check-circle"
              size={60}
              color="#28a745"
              style={styles.modalIcon}
            />
            <Text style={styles.modalTitle}>Success!</Text>
            <Text style={styles.modalMessage}>
              PDF report has been generated and shared successfully.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    position: "absolute",
    left: 10,
    top: 10,
    zIndex: 10,
    padding: 6,
    backgroundColor: "#fff",
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
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
  divider: {
    height: 2,
    backgroundColor: "#E5E7EB",
    marginVertical: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    width: "80%",
    maxWidth: 300,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#133E87",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: "#133E87",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
