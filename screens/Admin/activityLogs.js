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
import * as FileSystem from "expo-file-system";

const COLUMN_WIDTHS = {
  date: 120,
  time: 100,
  name: 150,
  role: 110,
  action: 120,
  description: 220,
};
const TABLE_WIDTH =
  COLUMN_WIDTHS.date +
  COLUMN_WIDTHS.time +
  COLUMN_WIDTHS.name +
  COLUMN_WIDTHS.role +
  COLUMN_WIDTHS.action +
  COLUMN_WIDTHS.description;

const LOGS_PER_PAGE = 10;
const EXPORT_ENTRIES_PER_PAGE = 50;

const LOG_COLLECTIONS = [
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
  // Make sure navigation prop is here
  const [pressedBtn, setPressedBtn] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Data state
  const [allLogs, setAllLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCache, setUserCache] = useState({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state
  const [nameFilter, setNameFilter] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [dateRangeModalVisible, setDateRangeModalVisible] = useState(false);
  const [selectingStartDate, setSelectingStartDate] = useState(true);

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
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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

  // Apply filters whenever dependencies change
  useEffect(() => {
    applyFilters();
  }, [allLogs, nameFilter, startDate, endDate]);

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
                  "⚠️ Unknown timestamp format for log:",
                  logDoc.id,
                  logData.timestamp
                );
                timestamp = new Date(0); // Use epoch instead of current time
              }

              // Validate the timestamp
              if (isNaN(timestamp.getTime())) {
                console.warn(
                  "⚠️ Invalid timestamp for log:",
                  logDoc.id,
                  "Using epoch"
                );
                timestamp = new Date(0); // Use epoch instead of current time
              }
            } catch (error) {
              console.warn(
                "⚠️ Error converting timestamp for log:",
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

  const applyFilters = () => {
    console.log("🔍 Applying filters...");
    let filtered = [...allLogs];

    // Filter by name
    if (nameFilter.trim()) {
      const searchTerm = nameFilter.toLowerCase();
      filtered = filtered.filter((log) =>
        log.userName.toLowerCase().includes(searchTerm)
      );
      console.log(
        `📝 Filter by name="${nameFilter}": ${filtered.length} results`
      );
    }

    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter((log) => {
        const logDate = log.timestamp;
        const start = startDate
          ? new Date(startDate.setHours(0, 0, 0, 0))
          : null;
        const end = endDate
          ? new Date(endDate.setHours(23, 59, 59, 999))
          : null;

        if (start && end) {
          return logDate >= start && logDate <= end;
        } else if (start) {
          return logDate >= start;
        } else if (end) {
          return logDate <= end;
        }
        return true;
      });
      console.log(`📅 Filter by date range: ${filtered.length} results`);
    }

    setFilteredLogs(filtered);
    setCurrentPage(1); // Reset to first page when filters change
    console.log(`✅ Total filtered logs: ${filtered.length}`);
  };

  const clearFilters = () => {
    setNameFilter("");
    setStartDate(null);
    setEndDate(null);
    console.log("🗑️ Filters cleared");
  };

  const handleGenerateReport = async () => {
    try {
      console.log("📊 Generate Report button pressed");
      console.log(
        `📋 Current filters - Name: "${nameFilter}", Start: ${startDate ? formatDateGMT8(startDate) : "None"}, End: ${endDate ? formatDateGMT8(endDate) : "None"}`
      );

      const logsToExport = filteredLogs;
      console.log(`📤 Exporting ${logsToExport.length} filtered logs`);

      if (logsToExport.length === 0) {
        console.log("⚠️ No logs to export");
        Alert.alert(
          "No Data",
          "No logs to export. Please adjust your filters."
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
          Role: log.role,
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
          `✅ Page ${page + 1} of ${totalPages} prepared (${formattedEntries.length} entries)`
        );
      }

      // Navigate to preview screen with export data
      console.log("🚀 Navigating to GenerateLogReport preview screen");
      navigation.navigate("GenerateLogReport", {
        exportData: exportPages,
        totalLogs: logsToExport.length,
        filters: {
          name: nameFilter || "All",
          startDate: startDate ? formatDateGMT8(startDate) : "None",
          endDate: endDate ? formatDateGMT8(endDate) : "None",
        },
        onExportPDF: async () => {
          await generatePDF(exportPages, {
            name: nameFilter || "All",
            startDate: startDate ? formatDateGMT8(startDate) : "None",
            endDate: endDate ? formatDateGMT8(endDate) : "None",
          });
        },
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
              Filter: Name: ${filters.name} | Date Range: ${filters.startDate} - ${filters.endDate}
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

        // Add rows
        page.entries.forEach((entry) => {
          htmlContent += `
            <tr>
              <td>${entry.No}</td>
              <td>${entry.Date}</td>
              <td>${entry.Time}</td>
              <td>${entry.Name}</td>
              <td>${entry.Role}</td>
              <td>${entry.Action}</td>
              <td>${entry.Description}</td>
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

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const handleDateSelect = (day) => {
    const selected = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    // Normalize to start of day for comparison
    const normalizedSelected = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );
    const today = new Date();
    const normalizedToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    // Validation 1: Prevent future date selection
    if (normalizedSelected > normalizedToday) {
      Alert.alert(
        "Invalid Date",
        "Cannot select a future date. Please select today or an earlier date.",
        [{ text: "OK" }]
      );
      console.log("❌ Future date blocked:", selected);
      return;
    }

    if (dateRangeModalVisible) {
      if (selectingStartDate) {
        setStartDate(selected);
        setSelectingStartDate(false);
        console.log("📅 Start date selected:", selected);
      } else {
        // Validation 2: End date must not be before start date
        if (startDate) {
          const normalizedStart = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate()
          );
          if (normalizedSelected < normalizedStart) {
            Alert.alert(
              "Invalid Date Range",
              "End date cannot be earlier than the start date. Please select a date on or after " +
                formatDateGMT8(startDate) +
                ".",
              [{ text: "OK" }]
            );
            console.log("❌ End date before start date blocked:", selected);
            return;
          }
        }
        setEndDate(selected);
        setDateRangeModalVisible(false);
        setSelectingStartDate(true);
        console.log("📅 End date selected:", selected);
      }
    } else {
      setSelectedDate(selected);
      setCalendarVisible(false);
    }
  };

  const openDateRangeModal = () => {
    setSelectingStartDate(true);
    setDateRangeModalVisible(true);
  };

  const handleQuickSelect = (type) => {
    const today = new Date();
    if (type === "today") {
      setSelectedDate(today);
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (type === "tomorrow") {
      // Tomorrow is a future date - show alert instead
      Alert.alert(
        "Invalid Date",
        "Cannot select a future date. Please select today or an earlier date.",
        [{ text: "OK" }]
      );
      console.log("❌ Quick select 'Tomorrow' blocked (future date)");
    } else if (type === "week") {
      // Next week is a future date - show alert instead
      Alert.alert(
        "Invalid Date",
        "Cannot select a future date. Please select today or an earlier date.",
        [{ text: "OK" }]
      );
      console.log("❌ Quick select 'Next Week' blocked (future date)");
    }
  };

  const renderCalendar = () => {
    const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
    const days = [];
    const today = new Date();
    const normalizedToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const isToday = (day) =>
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear() &&
      day === today.getDate();

    const isSelected = (day) =>
      selectedDate &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear() &&
      day === selectedDate.getDate();

    // Check if date is in the future (disabled)
    const isFutureDate = (day) => {
      const dateToCheck = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day
      );
      return dateToCheck > normalizedToday;
    };

    // Check if date is before start date (disabled when selecting end date)
    const isBeforeStartDate = (day) => {
      if (!dateRangeModalVisible || selectingStartDate || !startDate)
        return false;
      const dateToCheck = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day
      );
      const normalizedStart = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      return dateToCheck < normalizedStart;
    };

    // Check if date is in the selected range
    const isInRange = (day) => {
      if (!dateRangeModalVisible || !startDate || !endDate) return false;
      const dateToCheck = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day
      );
      const normalizedStart = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      const normalizedEnd = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );
      return dateToCheck >= normalizedStart && dateToCheck <= normalizedEnd;
    };

    // Check if date is the start or end date
    const isStartDate = (day) => {
      if (!startDate) return false;
      return (
        currentMonth.getMonth() === startDate.getMonth() &&
        currentMonth.getFullYear() === startDate.getFullYear() &&
        day === startDate.getDate()
      );
    };

    const isEndDate = (day) => {
      if (!endDate) return false;
      return (
        currentMonth.getMonth() === endDate.getMonth() &&
        currentMonth.getFullYear() === endDate.getFullYear() &&
        day === endDate.getDate()
      );
    };

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isFuture = isFutureDate(day);
      const isBeforeStart = isBeforeStartDate(day);
      const isDisabled = isFuture || isBeforeStart;

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday(day) && !isDisabled && styles.calendarToday,
            isSelected(day) && !isDisabled && styles.calendarSelected,
            (isStartDate(day) || isEndDate(day)) && styles.calendarRangeEdge,
            isInRange(day) &&
              !isStartDate(day) &&
              !isEndDate(day) &&
              styles.calendarInRange,
            isDisabled && styles.calendarDayDisabled,
          ]}
          onPress={() => handleDateSelect(day)}
          disabled={isDisabled}
        >
          <Text
            style={[
              styles.calendarDayText,
              (isToday(day) || isSelected(day)) &&
                !isDisabled &&
                styles.calendarTodayText,
              (isStartDate(day) || isEndDate(day)) &&
                styles.calendarRangeEdgeText,
              isDisabled && styles.calendarDayTextDisabled,
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
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
      <Header2 showBackButton={true} />
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
                Generate Log Report
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>Activity Logs</Text>

          {/* Filters */}
          <View style={styles.filtersContainer}>
            {/* Name Filter */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Search by Name:</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="Enter name..."
                placeholderTextColor="#999"
                value={nameFilter}
                onChangeText={setNameFilter}
              />
            </View>

            {/* Date Range Filter */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Date Range:</Text>
              <TouchableOpacity
                style={styles.dateRangeButton}
                onPress={openDateRangeModal}
              >
                <Text style={styles.dateRangeButtonText}>
                  {startDate && endDate
                    ? `${formatDateGMT8(startDate)} - ${formatDateGMT8(endDate)}`
                    : startDate
                      ? `From ${formatDateGMT8(startDate)}`
                      : "Select dates"}
                </Text>
              </TouchableOpacity>
              {(startDate || endDate) && (
                <TouchableOpacity
                  style={styles.clearFilterButton}
                  onPress={clearFilters}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color="#c41e3a"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Loading Indicator */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#133E87" />
              <Text style={styles.loadingText}>Loading logs...</Text>
            </View>
          ) : (
            <>
              {/* Results Info */}
              <View style={styles.resultsInfo}>
                <Text style={styles.resultsText}>
                  Showing {currentLogs.length > 0 ? startIndex + 1 : 0}-
                  {Math.min(endIndex, filteredLogs.length)} of{" "}
                  {filteredLogs.length} logs
                </Text>
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
                        style={[styles.cell, { width: COLUMN_WIDTHS.role }]}
                      >
                        <Text style={styles.headerText}>Role</Text>
                      </View>
                      <View
                        style={[styles.cell, { width: COLUMN_WIDTHS.action }]}
                      >
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
                            style={[styles.cell, { width: COLUMN_WIDTHS.role }]}
                          >
                            <Text style={[styles.cellText, styles.center]}>
                              {log.role}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.cell,
                              { width: COLUMN_WIDTHS.action },
                            ]}
                          >
                            <Text style={[styles.cellText, styles.center]}>
                              {log.action}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.cell,
                              styles.rightCell,
                              { width: COLUMN_WIDTHS.description },
                            ]}
                          >
                            <Text style={[styles.cellText, styles.center]}>
                              {log.description}
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
            </>
          )}
        </ScrollView>
      )}

      {/* Date Range Modal */}
      <Modal
        transparent
        visible={dateRangeModalVisible}
        animationType="fade"
        onRequestClose={() => {
          setDateRangeModalVisible(false);
          setSelectingStartDate(true);
        }}
      >
        <TouchableOpacity
          style={styles.calendarOverlay}
          activeOpacity={1}
          onPress={() => {
            setDateRangeModalVisible(false);
            setSelectingStartDate(true);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarModal}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.calendarArrow}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={24}
                  color="#234187"
                />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={styles.calendarMonthYear}>
                  {monthNames[currentMonth.getMonth()]}{" "}
                  {currentMonth.getFullYear()}
                </Text>
                <Text style={styles.selectingDateLabel}>
                  {selectingStartDate ? "Select Start Date" : "Select End Date"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.calendarArrow}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color="#234187"
                />
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={styles.calendarWeekRow}>
              {dayNames.map((day) => (
                <View key={day} style={styles.calendarDayName}>
                  <Text style={styles.calendarDayNameText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calendarGrid}>{renderCalendar()}</View>

            {/* Selected dates display */}
            <View style={styles.selectedDatesContainer}>
              <Text style={styles.selectedDateText}>
                Start: {startDate ? formatDateGMT8(startDate) : "Not selected"}
              </Text>
              <Text style={styles.selectedDateText}>
                End: {endDate ? formatDateGMT8(endDate) : "Not selected"}
              </Text>
            </View>

            {/* Validation info */}
            <View style={styles.validationInfoContainer}>
              <MaterialCommunityIcons
                name="information"
                size={16}
                color="#666"
              />
              <Text style={styles.validationInfoText}>
                {selectingStartDate
                  ? "Future dates are disabled. Select today or earlier."
                  : startDate
                    ? `End date must be on or after ${formatDateGMT8(startDate)}.`
                    : "Select a start date first."}
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        transparent
        visible={calendarVisible}
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <TouchableOpacity
          style={styles.calendarOverlay}
          activeOpacity={1}
          onPress={() => setCalendarVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarModal}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.calendarArrow}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={24}
                  color="#234187"
                />
              </TouchableOpacity>
              <Text style={styles.calendarMonthYear}>
                {monthNames[currentMonth.getMonth()]}{" "}
                {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.calendarArrow}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color="#234187"
                />
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={styles.calendarWeekRow}>
              {dayNames.map((day) => (
                <View key={day} style={styles.calendarDayName}>
                  <Text style={styles.calendarDayNameText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calendarGrid}>{renderCalendar()}</View>

            {/* Quick select buttons */}
            <View style={styles.calendarQuickRow}>
              <TouchableOpacity
                style={styles.calendarQuickBtn}
                onPress={() => handleQuickSelect("today")}
              >
                <Text style={styles.calendarQuickText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.calendarQuickBtn}
                onPress={() => handleQuickSelect("tomorrow")}
              >
                <Text style={styles.calendarQuickText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.calendarQuickBtn}
                onPress={() => handleQuickSelect("week")}
              >
                <Text style={styles.calendarQuickText}>+1 week</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
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
    borderColor: "#D1D5DB",
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

  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  calendarArrow: {
    padding: 8,
  },
  calendarMonthYear: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  calendarWeekRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  calendarDayName: {
    flex: 1,
    alignItems: "center",
  },
  calendarDayNameText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16, // reduced from 20 to 16
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4, // reduced from 8 to 4 for tighter vertical spacing
  },
  calendarDayText: {
    fontSize: 16,
    color: "#333",
  },
  calendarToday: {
    backgroundColor: "#234187",
    borderRadius: 8,
  },
  calendarTodayText: {
    color: "#fff",
    fontWeight: "700",
  },
  calendarQuickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4, // add small top margin for separation from calendar grid
  },
  calendarQuickBtn: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  calendarQuickText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  calendarSelected: {
    backgroundColor: "#133E87",
    borderRadius: 8,
  },
  filtersContainer: {
    backgroundColor: "#F7F8FA",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    minWidth: 100,
  },
  filterInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#000",
  },
  dateRangeButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateRangeButtonText: {
    fontSize: 14,
    color: "#333",
  },
  clearFilterButton: {
    padding: 8,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  resultsInfo: {
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  noDataRow: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  noDataText: {
    fontSize: 16,
    color: "#999",
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
  selectingDateLabel: {
    fontSize: 12,
    color: "#133E87",
    marginTop: 4,
    fontWeight: "500",
  },
  selectedDatesContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F7F8FA",
    borderRadius: 8,
    gap: 6,
  },
  selectedDateText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  calendarDayDisabled: {
    backgroundColor: "#F9FAFB",
    opacity: 0.5,
  },
  calendarDayTextDisabled: {
    color: "#D1D5DB",
    textDecorationLine: "line-through",
  },
  calendarRangeEdge: {
    backgroundColor: "#133E87",
    borderRadius: 8,
  },
  calendarRangeEdgeText: {
    color: "#fff",
    fontWeight: "700",
  },
  calendarInRange: {
    backgroundColor: "#E0E7FF",
    borderRadius: 0,
  },
  validationInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  validationInfoText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
    fontStyle: "italic",
  },
  bottomSpacing: {
    height: 80,
  },
});
