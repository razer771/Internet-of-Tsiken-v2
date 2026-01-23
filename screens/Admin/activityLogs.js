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
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../../config/firebaseconfig";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";

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
const EXPORT_ENTRIES_PER_PAGE = 25;

// Month names for date formatting
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

// Nested collection structure for fetching logs
const LOG_COLLECTIONS = [
  {
    parent: "activity_logs",
    subcollections: [
      { name: "addBatch_logs", documentPath: "events" },
      { name: "deleteBatch_logs", documentPath: "events" },
      { name: "editBatch_logs", documentPath: "events" },
      { name: "nightTime_logs", documentPath: "events" },
      { name: "report_logs", documentPath: "logs" },
      { name: "editProfile", documentPath: "passwordChange" },
      { name: "editProfile", documentPath: "userprofile" },
      { name: "mortalityReporting", documentPath: "events" },
      {
        name: "feeding",
        documentPath: [
          "addFeedSchedule_logs",
          "deleteFeedSchedule_logs",
          "editFeedSchedule_logs",
        ],
      },
      {
        name: "watering",
        documentPath: [
          "addWaterSchedule_logs",
          "deleteWaterSchedule_logs",
          "editWaterSchedule_logs",
        ],
      },
      {
        name: "userManagement",
        documentPath: [
          "createAccount",
          "updateAccount",
          "disableAccess",
          "forcePasswordChange",
          "resetPassword",
          "reactivateAccount",
        ],
      },
    ],
  },
  { parent: "report_logs", subcollections: null }, // Top-level collection
  { parent: "session_logs", subcollections: null }, // Top-level collection
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

  // Calendar filter state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Apply sorting - always by Date (newest first)
  useEffect(() => {
    console.log(`🔄 Sorting logs by Date (newest first)`);
    console.log(`📊 Total logs before sorting: ${allLogs.length}`);

    let sorted = [...allLogs];
    sorted.sort((a, b) => {
      const timeA = a.timestamp.getTime();
      const timeB = b.timestamp.getTime();
      return timeB - timeA; // Newest first
    });

    console.log(`✅ Sorted by Date (newest first)`);
    console.log(
      `First 3 dates: ${sorted
        .slice(0, 3)
        .map((log) => formatDateGMT8(log.timestamp))
        .join(", ")}`,
    );
    console.log(`📊 Total logs after sorting: ${sorted.length}`);

    setFilteredLogs(sorted);
    setCurrentPage(1);
  }, [allLogs]);

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

      // Helper function to fetch logs and process them
      const processLog = async (logDoc, collectionPath) => {
        const logData = logDoc.data();

        // Fetch user name and role
        let userName = "Unknown User";
        let userRole = "N/A";

        // For userManagement logs, use adminId instead of userId for the name column
        const isUserManagementLog = collectionPath.includes("userManagement");
        const userIdToFetch = isUserManagementLog
          ? logData.adminId
          : logData.userId;

        if (userIdToFetch) {
          // Check if we have cached user data
          if (userCacheTemp[userIdToFetch]) {
            userName = userCacheTemp[userIdToFetch];
          }
          if (roleCacheTemp[userIdToFetch]) {
            userRole = roleCacheTemp[userIdToFetch];
          }

          // If not cached, fetch from Firestore
          if (!userCacheTemp[userIdToFetch] || !roleCacheTemp[userIdToFetch]) {
            try {
              const userDoc = await getDoc(doc(db, "users", userIdToFetch));
              if (userDoc.exists()) {
                const userData = userDoc.data();

                // Cache user name
                if (!userCacheTemp[userIdToFetch]) {
                  userName =
                    `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
                  userCacheTemp[userIdToFetch] = userName;
                }

                // Cache and capitalize role
                if (!roleCacheTemp[userIdToFetch] && userData.role) {
                  userRole = capitalizeFirstLetter(userData.role);
                  roleCacheTemp[userIdToFetch] = userRole;
                  console.log(
                    `👤 Fetched role for user ${userName}: ${userRole}`,
                  );
                }
              }
            } catch (error) {
              console.error(`❌ Error fetching user ${userIdToFetch}:`, error);
            }
          }
        } else if (isUserManagementLog && logData.adminName) {
          // Fallback: use adminName from the log if adminId is not available
          userName = logData.adminName;
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
              logData.timestamp,
            );
            timestamp = new Date(0);
          }

          // Validate the timestamp
          if (isNaN(timestamp.getTime())) {
            console.warn(
              "⚠️  Invalid timestamp for log:",
              logDoc.id,
              "Using epoch",
            );
            timestamp = new Date(0);
          }
        } catch (error) {
          console.warn(
            "⚠️  Error converting timestamp for log:",
            logDoc.id,
            error,
          );
          timestamp = new Date(0);
        }

        allLogsArray.push({
          id: logDoc.id,
          collectionName: collectionPath,
          timestamp,
          userName,
          role: finalRole,
          action: logData.action || "N/A",
          description: logData.description || "N/A",
          userId: logData.userId,
        });
      };

      // Fetch logs from all collections (top-level and nested)
      for (const config of LOG_COLLECTIONS) {
        try {
          if (config.subcollections === null) {
            // Top-level collection (report_logs, session_logs)
            const logsSnapshot = await getDocs(collection(db, config.parent));
            console.log(
              `✅ Fetched ${logsSnapshot.size} logs from ${config.parent}`,
            );

            for (const logDoc of logsSnapshot.docs) {
              await processLog(logDoc, config.parent);
            }
          } else {
            // Nested collections under activity_logs
            for (const subConfig of config.subcollections) {
              try {
                const subCollectionName = subConfig.name;
                const documentPaths = Array.isArray(subConfig.documentPath)
                  ? subConfig.documentPath
                  : [subConfig.documentPath];

                for (const docPath of documentPaths) {
                  try {
                    const eventsSnapshot = await getDocs(
                      collection(db, config.parent, subCollectionName, docPath),
                    );
                    console.log(
                      `✅ Fetched ${eventsSnapshot.size} logs from ${config.parent}/${subCollectionName}/${docPath}`,
                    );

                    for (const logDoc of eventsSnapshot.docs) {
                      await processLog(
                        logDoc,
                        `${config.parent}/${subCollectionName}/${docPath}`,
                      );
                    }
                  } catch (error) {
                    console.error(
                      `❌ Error fetching from ${config.parent}/${subCollectionName}/${docPath}:`,
                      error,
                    );
                  }
                }
              } catch (error) {
                console.error(
                  `❌ Error processing subcollection ${subConfig.name}:`,
                  error,
                );
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error fetching from ${config.parent}:`, error);
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
    return `${hours}:${minutes} ${ampm}`; // No space between minutes and AM/PM
  };

  const handleGenerateReport = async () => {
    try {
      console.log("📊 Generate Report button pressed");
      console.log(`📤 Exporting ${filteredLogs.length} filtered logs`);

      // Use filteredLogs which is already filtered by date (if selected)
      const logsToExport = filteredLogs;

      if (logsToExport.length === 0) {
        console.log("⚠️ No logs to export");
        Alert.alert("No Data", "No logs to export.");
        return;
      }

      // Calculate pagination
      const totalPages = Math.ceil(
        logsToExport.length / EXPORT_ENTRIES_PER_PAGE,
      );
      console.log(
        `📄 Export will create ${totalPages} page(s) (${EXPORT_ENTRIES_PER_PAGE} entries per page)`,
      );

      // Prepare export data with pagination
      const exportPages = [];
      for (let page = 0; page < totalPages; page++) {
        const startIdx = page * EXPORT_ENTRIES_PER_PAGE;
        const endIdx = Math.min(
          startIdx + EXPORT_ENTRIES_PER_PAGE,
          logsToExport.length,
        );
        const pageEntries = logsToExport.slice(startIdx, endIdx);

        const formattedEntries = pageEntries.map((log, idx) => ({
          No: startIdx + idx + 1,
          Date: formatDateGMT8(log.timestamp),
          Time: formatTimeGMT8(log.timestamp),
          Name: log.userName,
          Action: log.action,
          Description: log.description,
        }));

        exportPages.push({
          pageNumber: page + 1,
          totalPages,
          entries: formattedEntries,
          entriesCount: formattedEntries.length,
        });

        console.log(
          `✅ Page ${page + 1} of ${totalPages} prepared (${formattedEntries.length} entries)`,
        );
      }

      // Generate PDF directly with filtered data
      console.log("🚀 Generating PDF with filtered data...");
      if (selectedDate) {
        console.log(
          `📅 Data filtered by date: ${formatDateGMT8(selectedDate)}`,
        );
      }

      await generatePDF(exportPages, {
        sortBy: "Date (newest first)",
        dateFilter: selectedDate ? formatDateGMT8(selectedDate) : "All dates",
      });
    } catch (error) {
      console.error("❌ Error generating report:", error);
      Alert.alert("Error", "Failed to generate report. Please try again.");
    }
  };

  const generatePDF = async (exportPages, filters) => {
    try {
      console.log("📄 Starting PDF generation...");

      // Load logo as base64
      const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
      await logoAsset.downloadAsync();
      const logoBase64 = await FileSystem.readAsStringAsync(
        logoAsset.localUri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      // Generate HTML content for PDF
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: 8.5in 11in;
              margin: 0.3in 0.5in 0.3in 0.5in;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .header {
              margin-bottom: 20px;
              border-bottom: 2px solid #133E87;
              padding-bottom: 15px;
            }
            .header-top {
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 10px;
            }
            .logo {
              width: 50px;
              height: 50px;
              border-radius: 25px;
              margin-right: 15px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #133E87;
            }
            .report-title {
              font-size: 15px;
              color: #333;
              text-align: center;
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
            <div class="header-top">
              <img src="data:image/png;base64,${logoBase64}" class="logo" alt="Company Logo" />
              <div class="company-name">Internet of Tsiken</div>
            </div>
            <div class="report-title">Activity Logs Report <br>
            Record Date : ${filters.dateFilter} <br>
            Date Generated : ${formatDateGMT8(new Date())} ${formatTimeGMT8(new Date())} </div>
          </div>
        `;

        // Add table
        htmlContent += `
          <table>
            <thead>
              <tr>
                <th style="width: 3%;">No</th>
                <th style="width: 12%;">Date</th>
                <th style="width: 8%;">Time</th>
                <th style="width: 15%;">Name</th>
                <th style="width: 20%;">Action</th>
                <th style="width: 20%;">Description</th>
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
              <td>${entry.Description}</td>
            </tr>
          `;
        });

        htmlContent += `
            </tbody>
          </table>
          ${pageIndex > 0 ? `<div class="page-number">Page ${pageIndex + 1} of ${exportPages.length}</div>` : ""}
        `;

        // Add page break except for last page
        if (pageIndex < exportPages.length - 1) {
          htmlContent += '<div class="page-break"></div>';
        }

        console.log(
          `✅ Page ${pageIndex + 1} of ${exportPages.length} exported`,
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
        width: 612,
        height: 792,
      });
      console.log("✅ PDF generated successfully:", uri);

      // Create a permanent copy in the document directory
      const dateGenerated = formatDateGMT8(new Date()).replace(/\//g, "-");
      const fileName = `ActivityLogs_${dateGenerated}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.copyAsync({
        from: uri,
        to: fileUri,
      });
      console.log("📁 PDF saved to:", fileUri);

      // Log the report generation
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          // Get user details
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          const userData = userDoc.data();
          const userName = userData
            ? `${userData.firstName || ""} ${userData.lastName || ""}`.trim()
            : "Unknown User";
          const userRole = userData?.role || "Admin";

          // Log to activity_logs/report_logs collection
          await addDoc(collection(db, "activity_logs", "report_logs", "logs"), {
            action: "Generated logs report",
            description: "Generated Activity Logs report",
            fileName: fileName,
            reportName: "Activity Logs Report",
            role: userRole,
            timestamp: Timestamp.now(),
            type: "pdf",
            userId: currentUser.uid,
            userName: userName,
          });
          console.log("✅ Report generation logged successfully");
        }
      } catch (logError) {
        console.error("❌ Error logging report generation:", logError);
      }

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Activity Logs Report",
        });
        console.log("📤 PDF shared successfully");
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

  // Apply date filtering
  useEffect(() => {
    console.log(`🔄 Filtering logs by date`);

    let filtered = [...allLogs];

    // Apply date filter if selected
    if (selectedDate) {
      filtered = filtered.filter((log) => {
        const logDate = formatDateGMT8(log.timestamp);
        const selectedDateStr = formatDateGMT8(selectedDate);
        return logDate === selectedDateStr;
      });
      console.log(
        `📅 Filtered ${filtered.length} logs for date: ${formatDateGMT8(selectedDate)}`,
      );
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [allLogs, selectedDate]);

  // Calendar functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
    console.log(`📅 Date selected: ${formatDateGMT8(date)}`);
  };

  const handleClearFilter = () => {
    setSelectedDate(null);
    setShowCalendar(false);
    console.log(`🗑️ Date filter cleared`);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

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
        <ScrollView contentContainerStyle={styles.pageContent}>
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
                Download Report
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>Activity Logs</Text>

          {/* Results Info */}
          <View style={styles.resultsInfo}>
            <Text style={styles.resultsText}>
              Showing {currentLogs.length > 0 ? startIndex + 1 : 0}-
              {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length}{" "}
              logs
            </Text>
          </View>

          {/* Date Filter Button */}
          <View style={styles.dateFilterContainer}>
            <TouchableOpacity
              style={styles.dateFilterButton}
              onPress={() => setShowCalendar(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="calendar-blank"
                size={20}
                color="#000"
              />
              <Text style={styles.dateFilterButtonText}>
                {selectedDate ? formatDateGMT8(selectedDate) : "Date"}
              </Text>
            </TouchableOpacity>

            {selectedDate && (
              <TouchableOpacity
                style={styles.clearDateFilterButton}
                onPress={handleClearFilter}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Calendar Modal */}
          <Modal
            visible={showCalendar}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowCalendar(false)}
          >
            <View style={styles.calendarModalOverlay}>
              <View style={styles.calendarModal}>
                {/* Calendar Header */}
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    onPress={handlePrevMonth}
                    style={styles.calendarNavButton}
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={28}
                      color="#0EA5E9"
                    />
                  </TouchableOpacity>

                  <Text style={styles.calendarHeaderText}>
                    {monthNames[currentMonth.getMonth()]}{" "}
                    {currentMonth.getFullYear()}
                  </Text>

                  <TouchableOpacity
                    onPress={handleNextMonth}
                    style={styles.calendarNavButton}
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={28}
                      color="#0EA5E9"
                    />
                  </TouchableOpacity>
                </View>

                {/* Day Names */}
                <View style={styles.calendarDayNames}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <View key={day} style={styles.calendarDayNameCell}>
                        <Text style={styles.calendarDayNameText}>{day}</Text>
                      </View>
                    ),
                  )}
                </View>

                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                  {getDaysInMonth(currentMonth).map((date, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.calendarDayCell,
                        !date && styles.calendarDayCellEmpty,
                        date &&
                          selectedDate &&
                          date.toDateString() === selectedDate.toDateString() &&
                          styles.calendarDayCellSelected,
                      ]}
                      onPress={() => date && handleDateSelect(date)}
                      disabled={!date}
                      activeOpacity={0.7}
                    >
                      {date && (
                        <Text
                          style={[
                            styles.calendarDayText,
                            selectedDate &&
                              date.toDateString() ===
                                selectedDate.toDateString() &&
                              styles.calendarDayTextSelected,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Calendar Footer */}
                <View style={styles.calendarFooter}>
                  <TouchableOpacity
                    style={styles.calendarClearButton}
                    onPress={handleClearFilter}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.calendarClearButtonText}>
                      Clear Filter
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.calendarCloseButton}
                    onPress={() => setShowCalendar(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.calendarCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

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
                  <View style={[styles.cell, { width: COLUMN_WIDTHS.time }]}>
                    <Text style={styles.headerText}>Time</Text>
                  </View>
                  <View style={[styles.cell, { width: COLUMN_WIDTHS.name }]}>
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
                    currentPage === 1 && styles.paginationButtonTextDisabled,
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
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 16,
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#133E87",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#133E87",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
    marginBottom: 16,
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

  // Date Filter Styles
  dateFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 0,
    marginBottom: 16,
    gap: 8,
  },
  dateFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dateFilterButtonText: {
    fontSize: 15,
    fontWeight: "400",
    color: "#000",
  },
  clearDateFilterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },

  horizontalScroll: { flexShrink: 1 },

  table: {
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
    borderLeftColor: "#E5E7EB",
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
  noDataRow: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  noDataText: {
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

  // Calendar Modal Styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  calendarNavButton: {
    padding: 4,
  },
  calendarHeaderText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  calendarDayNames: {
    flexDirection: "row",
    marginBottom: 10,
  },
  calendarDayNameCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  calendarDayNameText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  calendarDayCellEmpty: {
    backgroundColor: "transparent",
  },
  calendarDayCellSelected: {
    backgroundColor: "#1E40AF",
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 16,
    color: "#000",
  },
  calendarDayTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  calendarFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  calendarClearButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  calendarClearButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  calendarCloseButton: {
    flex: 1,
    backgroundColor: "#1E40AF",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  calendarCloseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
