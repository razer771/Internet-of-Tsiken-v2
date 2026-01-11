import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import Header2 from "../navigation/adminHeader";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebaseconfig";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

const COLUMN_WIDTHS = {
  date: 150,
  time: 120,
  name: 200,
  action: 200,
};
const TABLE_WIDTH =
  COLUMN_WIDTHS.date +
  COLUMN_WIDTHS.time +
  COLUMN_WIDTHS.name +
  COLUMN_WIDTHS.action;

const LOGS_PER_PAGE = 10;
const EXPORT_ENTRIES_PER_PAGE = 50;

// Month names for date formatting
const monthNamesShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const LOG_COLLECTIONS = [
  "activity_logs", // Unified activity logs collection
  "addFeedSchedule_logs",
  "addWaterSchedule_logs",
  "deleteFeedSchedule_logs",
  "deleteWaterSchedule_logs",
  "editFeedSchedule_logs",
  "editWaterSchedule_logs",
  "nightTime_logs",
  "report_logs",
  "session_logs",
  "wateringActivity_logs",
];

export default function ActivityLogs({ navigation }) {
  const [pressedBtn, setPressedBtn] = useState(null);

  // Data state
  const [allLogs, setAllLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCache, setUserCache] = useState({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Sort state - make sure these are the ONLY sort state declarations
  const [sortBy, setSortBy] = useState("Date");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortOptions = ["Date", "Name", "Action"];

  // Apply sorting - SINGLE useEffect
  useEffect(() => {
    console.log(`🔄 Sorting logs by: ${sortBy}`);
    console.log(`📊 Total logs before sorting: ${allLogs.length}`);
    
    let sorted = [...allLogs];

    // Apply sorting
    switch (sortBy) {
      case "Date":
        sorted.sort((a, b) => {
          const timeA = a.timestamp.getTime();
          const timeB = b.timestamp.getTime();
          return timeB - timeA; // Newest first
        });
        console.log(`✅ Sorted by Date (newest first)`);
        console.log(`First 3 dates: ${sorted.slice(0, 3).map(log => formatDateGMT8(log.timestamp)).join(', ')}`);
        break;
      case "Name":
        sorted.sort((a, b) => {
          const nameA = a.userName.toLowerCase();
          const nameB = b.userName.toLowerCase();
          return nameA.localeCompare(nameB); // A-Z
        });
        console.log(`✅ Sorted by Name (A-Z)`);
        console.log(`First 3 names: ${sorted.slice(0, 3).map(log => log.userName).join(', ')}`);
        break;
      case "Action":
        sorted.sort((a, b) => {
          const actionA = a.action.toLowerCase();
          const actionB = b.action.toLowerCase();
          return actionA.localeCompare(actionB); // A-Z
        });
        console.log(`✅ Sorted by Action (A-Z)`);
        console.log(`First 3 actions: ${sorted.slice(0, 3).map(log => log.action).join(', ')}`);
        break;
      default:
        console.log(`⚠️ Unknown sort option: ${sortBy}`);
        break;
    }

    console.log(`📊 Total logs after sorting: ${sorted.length}`);
    setFilteredLogs(sorted);
    setCurrentPage(1); // Reset to first page when sorting changes
  }, [allLogs, sortBy]);

  // Prevent duplicate fetches (React StrictMode protection)
  const hasFetchedRef = useRef(false);

  // Fetch all logs from Firestore
  useEffect(() => {
    // Prevent duplicate fetches in React StrictMode (development)
    if (hasFetchedRef.current) {
      console.log("⏭️  Skipping duplicate fetch (already loaded)");
      return;
    }

    hasFetchedRef.current = true;
    fetchAllLogs();
  }, []);

  const fetchAllLogs = async () => {
    try {
      setLoading(true);
      console.log("📥 Fetching logs from multiple collections...");

      const allLogsArray = [];
      const userCacheTemp = {};
      const roleCacheTemp = {};

      // Helper function to capitalize first letter
      const capitalizeFirstLetter = (str) => {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      };

      // Fetch logs from all collections
      for (const collectionName of LOG_COLLECTIONS) {
        try {
          const logsSnapshot = await getDocs(collection(db, collectionName));
          console.log(
            `✅ Fetched ${logsSnapshot.size} logs from ${collectionName}`
          );

          for (const logDoc of logsSnapshot.docs) {
            const logData = logDoc.data();

            // Fetch user name and role if userId exists
            let userName = "Unknown User";
            let userRole = "N/A";

            if (logData.userId) {
              // Check if we have cached user data
              if (userCacheTemp[logData.userId]) {
                userName = userCacheTemp[logData.userId];
              }
              if (roleCacheTemp[logData.userId]) {
                userRole = roleCacheTemp[logData.userId];
              }

              // If not cached, fetch from Firestore
              if (
                !userCacheTemp[logData.userId] ||
                !roleCacheTemp[logData.userId]
              ) {
                try {
                  const userDoc = await getDoc(
                    doc(db, "users", logData.userId)
                  );
                  if (userDoc.exists()) {
                    const userData = userDoc.data();

                    // Cache user name
                    if (!userCacheTemp[logData.userId]) {
                      userName =
                        `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
                      userCacheTemp[logData.userId] = userName;
                    }

                    // Cache and capitalize role
                    if (!roleCacheTemp[logData.userId] && userData.role) {
                      userRole = capitalizeFirstLetter(userData.role);
                      roleCacheTemp[logData.userId] = userRole;
                      console.log(
                        `👤 Fetched role for user ${userName}: ${userRole}`
                      );
                    }
                  }
                } catch (error) {
                  console.error(
                    `❌ Error fetching user ${logData.userId}:`,
                    error
                  );
                }
              }
            }

            // Use log's role if it exists and is not "N/A", otherwise use fetched role
            const finalRole =
              logData.role && logData.role !== "N/A"
                ? capitalizeFirstLetter(logData.role)
                : userRole;

            // Safely convert timestamp - handle both Firestore Timestamp and ISO string
            let timestamp;
            try {
              if (logData.timestamp?.toDate) {
                // Firestore Timestamp object
                timestamp = logData.timestamp.toDate();
              } else if (typeof logData.timestamp === "string") {
                // ISO string format
                timestamp = new Date(logData.timestamp);
              } else if (logData.timestamp instanceof Date) {
                // Already a Date object
                timestamp = logData.timestamp;
              } else {
                console.warn(
                  "⚠️  Unknown timestamp format for log:",
                  logDoc.id,
                  logData.timestamp
                );
                timestamp = new Date(0); // Use epoch instead of current time
              }

              // Validate the timestamp
              if (isNaN(timestamp.getTime())) {
                console.warn(
                  "⚠️  Invalid timestamp for log:",
                  logDoc.id,
                  "Using epoch"
                );
                timestamp = new Date(0); // Use epoch instead of current time
              }
            } catch (error) {
              console.warn(
                "⚠️  Error converting timestamp for log:",
                logDoc.id,
                error
              );
              timestamp = new Date(0); // Use epoch instead of current time
            }

            allLogsArray.push({
              id: logDoc.id,
              collectionName,
              timestamp,
              userName,
              role: finalRole,
              action: logData.action || "N/A",
              description: logData.description || "N/A",
              userId: logData.userId,
            });
          }
        } catch (error) {
          console.error(`❌ Error fetching from ${collectionName}:`, error);
        }
      }

      // Sort by timestamp descending (newest first)
      allLogsArray.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`✅ Fetched total of ${allLogsArray.length} logs`);
      setAllLogs(allLogsArray);
      setUserCache(userCacheTemp);
      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching logs:", error);
      setLoading(false);
    }
  };

  const formatDateGMT8 = (date) => {
    if (!date) return "N/A";
    // Ensure date is a valid Date object
    const validDate = date instanceof Date ? date : new Date(date);
    // Check if date is valid
    if (isNaN(validDate.getTime())) {
      console.warn("⚠️ Invalid date in formatDateGMT8:", date);
      return "N/A";
    }
    // Convert to GMT+8
    const gmt8Date = new Date(validDate.getTime() + 8 * 60 * 60 * 1000);
    const day = String(gmt8Date.getUTCDate()).padStart(2, "0");
    const month = monthNamesShort[gmt8Date.getUTCMonth()];
    const year = gmt8Date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatTimeGMT8 = (date) => {
    if (!date) return "N/A";
    // Ensure date is a valid Date object
    const validDate = date instanceof Date ? date : new Date(date);
    // Check if date is valid
    if (isNaN(validDate.getTime())) {
      console.warn("⚠️ Invalid date in formatTimeGMT8:", date);
      return "N/A";
    }
    // Convert to GMT+8
    const gmt8Date = new Date(validDate.getTime() + 8 * 60 * 60 * 1000);
    let hours = gmt8Date.getUTCHours();
    const minutes = String(gmt8Date.getUTCMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes}${ampm}`; // No space between minutes and AM/PM
  };

  const handleGenerateReport = async () => {
    try {
      console.log("📊 Generate Report button pressed");
      console.log(`📤 Exporting ${filteredLogs.length} filtered logs`);

      const logsToExport = filteredLogs;

      if (logsToExport.length === 0) {
        console.log("⚠️ No logs to export");
        Alert.alert(
          "No Data",
          "No logs to export."
        );
        return;
      }

      // Calculate pagination
      const totalPages = Math.ceil(
        logsToExport.length / EXPORT_ENTRIES_PER_PAGE
      );
      console.log(
        `📄 Export will create ${totalPages} page(s) (${EXPORT_ENTRIES_PER_PAGE} entries per page)`
      );

      // Prepare export data with pagination
      const exportPages = [];
      for (let page = 0; page < totalPages; page++) {
        const startIdx = page * EXPORT_ENTRIES_PER_PAGE;
        const endIdx = Math.min(
          startIdx + EXPORT_ENTRIES_PER_PAGE,
          logsToExport.length
        );
        const pageEntries = logsToExport.slice(startIdx, endIdx);

        const formattedEntries = pageEntries.map((log, idx) => ({
          No: startIdx + idx + 1,
          Date: formatDateGMT8(log.timestamp),
          Time: formatTimeGMT8(log.timestamp),
          Name: log.userName,
          Action: log.action,
        }));

        exportPages.push({
          pageNumber: page + 1,
          totalPages,
          entries: formattedEntries,
          entriesCount: formattedEntries.length,
        });

        console.log(
          `✅ Page ${page + 1} of ${totalPages} prepared (${formattedEntries.length} entries)`
        );
      }

<<<<<<< HEAD
      // Generate PDF directly instead of navigating
      console.log("📄 Generating PDF report...");
      await generatePDF(exportPages, {
        name: nameFilter || "All",
        startDate: startDate ? formatDateGMT8(startDate) : "None",
        endDate: endDate ? formatDateGMT8(endDate) : "None",
=======
      // Navigate to preview screen with export data
      console.log("🚀 Navigating to GenerateLogReport preview screen");
      navigation.navigate("GenerateLogReport", {
        exportData: exportPages,
        totalLogs: logsToExport.length,
        filters: {
          name: "All",
          sortBy: sortBy,
        },
        onExportPDF: async () => {
          await generatePDF(exportPages, {
            sortBy: sortBy,
          });
        },
>>>>>>> jeromeees
      });
    } catch (error) {
      console.error("❌ Error generating report:", error);
      Alert.alert("Error", "Failed to generate report. Please try again.");
    }
  };

  const generatePDF = async (exportPages, filters) => {
    try {
      console.log("📄 Starting PDF generation...");

      // Generate HTML content for PDF
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
            .page-break {
              page-break-after: always;
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
            .page-number {
              text-align: center;
              font-size: 10px;
              color: #666;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
      `;

      // Add pages
      exportPages.forEach((page, pageIndex) => {
        // Add header for each page
        htmlContent += `
          <div class="header">
            <div class="company-name">Smart Brooder Systems Inc.</div>
            <div class="report-title">Activity Logs Report</div>
            <div class="filter-info">
              Sorted by: ${filters.sortBy}
            </div>
          </div>
        `;

        // Add table
        htmlContent += `
          <table>
            <thead>
              <tr>
                <th style="width: 8%;">No</th>
                <th style="width: 20%;">Date</th>
                <th style="width: 15%;">Time</th>
                <th style="width: 30%;">Name</th>
                <th style="width: 27%;">Action</th>
              </tr>
            </thead>
            <tbody>
        `;

        // Add rows
        page.entries.forEach((entry) => {
          htmlContent += `
            <tr>
              <td>${entry.No}</td>
              <td>${entry.Date}</td>
              <td>${entry.Time}</td>
              <td>${entry.Name}</td>
              <td>${entry.Action}</td>
            </tr>
          `;
        });

        htmlContent += `
            </tbody>
          </table>
          <div class="page-number">Page ${page.pageNumber} of ${page.totalPages}</div>
        `;

        // Add page break except for last page
        if (pageIndex < exportPages.length - 1) {
          htmlContent += '<div class="page-break"></div>';
        }

        console.log(
          `✅ Page ${page.pageNumber} of ${page.totalPages} exported`
        );
      });

      htmlContent += `
        </body>
        </html>
      `;

      // Generate PDF using expo-print
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      console.log("✅ PDF generated successfully:", uri);

      // Create a permanent copy in the document directory
      const fileName = `ActivityLogs_${new Date().getTime()}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.copyAsync({
        from: uri,
        to: fileUri,
      });
      console.log("📁 PDF saved to:", fileUri);

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Activity Logs Report",
        });
        console.log("📤 PDF shared successfully");
        Alert.alert("Success", "PDF generated and ready to share!", [
          { text: "OK" },
        ]);
      } else {
        Alert.alert("Success", `PDF saved to: ${fileUri}`, [{ text: "OK" }]);
      }
    } catch (error) {
      console.error("❌ Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
  const startIndex = (currentPage - 1) * LOGS_PER_PAGE;
  const endIndex = startIndex + LOGS_PER_PAGE;
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      console.log(`➡️ Page ${currentPage + 1} of ${totalPages}`);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      console.log(`⬅️ Page ${currentPage - 1} of ${totalPages}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />
      
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#133E87" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#234187" />
          <Text style={styles.loadingText}>Loading activity logs...</Text>
        </View>
      ) : (
<<<<<<< HEAD
        <ScrollView contentContainerStyle={styles.pageContent}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate("AdminDashboard")}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#133E87" />
            <Text style={styles.backButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>

=======
        <ScrollView 
          contentContainerStyle={styles.pageContent}
          onScrollBeginDrag={() => {
            console.log('📜 Scrolling - closing sort dropdown');
            setSortDropdownOpen(false);
          }}
        >
>>>>>>> jeromeees
          {/* Buttons Row */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                pressedBtn === "generate" && {
                  backgroundColor: "#133E87",
                  borderColor: "#133E87",
                },
              ]}
              activeOpacity={0.8}
              onPressIn={() => setPressedBtn("generate")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleGenerateReport}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  pressedBtn === "generate" && { color: "#fff" },
                ]}
              >
<<<<<<< HEAD
                Download
=======
                Download Report
>>>>>>> jeromeees
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>Activity Logs</Text>

          {/* Results Info */}
          <View style={styles.resultsInfo}>
            <Text style={styles.resultsText}>
              Showing {currentLogs.length > 0 ? startIndex + 1 : 0}-
              {Math.min(endIndex, filteredLogs.length)} of{" "}
              {filteredLogs.length} logs
            </Text>
          </View>

          {/* Sort By Dropdown */}
          <View style={styles.sortContainer}>
            <View style={styles.sortDropdownWrapper}>
              <TouchableOpacity
                style={styles.sortButton}
                onPress={() => {
                  console.log(`🔘 Sort button clicked. Current state: ${sortDropdownOpen ? 'open' : 'closed'}`);
                  setSortDropdownOpen(!sortDropdownOpen);
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="sort"
                  size={18}
                  color="#000"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.sortButtonText}>Sort by: {sortBy}</Text>
                <MaterialCommunityIcons
                  name={sortDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#000"
                />
              </TouchableOpacity>

              {sortDropdownOpen && (
                <View style={styles.sortDropdown}>
                  {sortOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.sortDropdownItem,
                        sortBy === option && styles.sortDropdownItemActive,
                      ]}
                      onPress={() => {
                        console.log(`✅ Sort option selected: ${option}`);
                        console.log(`📝 Previous sortBy: ${sortBy}`);
                        setSortBy(option);
                        console.log(`📝 New sortBy will be: ${option}`);
                        setSortDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.sortDropdownItemText,
                          sortBy === option && styles.sortDropdownItemTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                      {sortBy === option && (
                        <MaterialCommunityIcons
                          name="check"
                          size={18}
                          color="#000"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Table */}
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
                  <View
                    style={[styles.cell, { width: COLUMN_WIDTHS.time }]}
                  >
                    <Text style={styles.headerText}>Time</Text>
                  </View>
                  <View
                    style={[styles.cell, { width: COLUMN_WIDTHS.name }]}
                  >
                    <Text style={styles.headerText}>Name</Text>
                  </View>
                  <View
                    style={[
                      styles.cell,
                      styles.rightCell,
                      { width: COLUMN_WIDTHS.action },
                    ]}
                  >
                    <Text style={styles.headerText}>Action</Text>
                  </View>
                </View>

                {/* Body */}
                {currentLogs.length > 0 ? (
                  currentLogs.map((log, idx) => (
                    <View
                      key={`${log.collectionName}-${log.id}`}
                      style={[styles.row, idx % 2 === 1 && styles.altRow]}
                    >
                      <View
                        style={[
                          styles.cell,
                          styles.leftCell,
                          { width: COLUMN_WIDTHS.date },
                        ]}
                      >
                        <Text style={[styles.cellText, styles.center]}>
                          {formatDateGMT8(log.timestamp)}
                        </Text>
                      </View>
                      <View
                        style={[styles.cell, { width: COLUMN_WIDTHS.time }]}
                      >
                        <Text style={[styles.cellText, styles.center]}>
                          {formatTimeGMT8(log.timestamp)}
                        </Text>
                      </View>
                      <View
                        style={[styles.cell, { width: COLUMN_WIDTHS.name }]}
                      >
                        <Text style={[styles.cellText, styles.center]}>
                          {log.userName}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.cell,
                          styles.rightCell,
                          { width: COLUMN_WIDTHS.action },
                        ]}
                      >
                        <Text style={[styles.cellText, styles.center]}>
                          {log.action}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.noDataRow}>
                    <Text style={styles.noDataText}>No logs found</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>

          {/* Pagination */}
          {filteredLogs.length > LOGS_PER_PAGE && (
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
                  size={24}
                  color={currentPage === 1 ? "#ccc" : "#133E87"}
                />
                <Text
                  style={[
                    styles.paginationButtonText,
                    currentPage === 1 &&
                      styles.paginationButtonTextDisabled,
                  ]}
                >
                  Previous
                </Text>
              </TouchableOpacity>

              <Text style={styles.paginationInfo}>
                Page {currentPage} of {totalPages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === totalPages &&
                    styles.paginationButtonDisabled,
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
                  size={24}
                  color={currentPage === totalPages ? "#ccc" : "#133E87"}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom spacing to prevent overlap with device buttons */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}

      {/* Close dropdown when tapping outside */}
      {sortDropdownOpen && (
        <TouchableOpacity
          style={styles.fullscreenDismiss}
          activeOpacity={1}
          onPress={() => setSortDropdownOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  
  // Back Button Styles
  backButtonContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#133E87",
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#666",
  },
  pageContent: { paddingVertical: 16, paddingHorizontal: 12 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: "#133E87",
    fontWeight: "500",
    marginLeft: 8,
  },
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 16,
    marginTop: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
    marginBottom: 16,
  },
  dateFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EBF5FF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateFilterText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#234187",
  },
  clearDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearDateText: {
    fontSize: 13,
    color: "#64748b",
  },
  actionButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#234187",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
  },
  iconButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },

  horizontalScroll: { maxHeight: 600 },

  table: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerRow: {
    backgroundColor: "#F7F8FA",
  },
  altRow: {
    backgroundColor: "#FAFBFC",
  },

  cell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    justifyContent: "center",
  },
  leftCell: {
    borderLeftWidth: 0,
  },
  rightCell: {},

  headerText: {
    color: "#000",
    fontWeight: "700",
    textAlign: "center",
  },
  cellText: {
    color: "#000",
    fontSize: 14,
  },
  center: { textAlign: "center" },
  emptyRow: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#666",
    fontStyle: "italic",
  },

  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 12,
  },
  paginationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  bottomSpacing: {
    height: 80,
  },
  resultsInfo: {
    marginBottom: 16,
    alignItems: "center",
  },
  resultsText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },

  // Sort Styles
  sortContainer: {
    paddingHorizontal: 0,
    marginBottom: 16,
    marginLeft: 12,
  },
  sortDropdownWrapper: {
    position: "relative",
    alignSelf: "flex-start",
    zIndex: 1000,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#000",
  },
  sortDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E3E8EF",
    minWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
  },
  sortDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sortDropdownItemActive: {
    backgroundColor: "#fff",
  },
  sortDropdownItemText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#000",
  },
  sortDropdownItemTextActive: {
    fontWeight: "400",
    color: "#000",
  },
  fullscreenDismiss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
});
