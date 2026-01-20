import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  FlatList,
  Button,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";

// Vector icons (using Expo's vector-icons wrapper which includes react-native-vector-icons)
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import Header2 from "../navigation/adminHeader";
import { db as firestoreDb } from "../../config/firebaseconfig";
import {
  collection,
  getDocs,
  collectionGroup,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import { getAuth } from "firebase/auth";

const { width: windowWidth } = Dimensions.get("window");

/**
 * AdminAnalytics (single-file)
 * - Line chart (guarded dynamic require)
 * - Grouped bar chart (pure RN)
 * - ReportsTab with System Overview, User Engagement, Performance Report
 *
 * To run the line chart you'll need:
 *   expo install react-native-svg
 *   npm install react-native-chart-kit
 *
 * To get the icons below:
 *   - Expo-managed apps: expo install @expo/vector-icons
 *   - Bare React Native apps: npm install react-native-vector-icons
 *     (linking not normally required on RN >= 0.60)
 *
 * The example numbers are demo/static — replace with your real metrics or API calls.
 */

/* Simple table icon built from Views so it always renders and fits the button.
   Props:
   - size: overall square size in px (default 18)
   - color: stroke color (default "#334e68" to match Export CSV text)
*/
function TableIcon({ size = 18, color = "#334e68", style }) {
  const strokeWidth = Math.max(1, Math.round(size * 0.12));
  const innerPadding = Math.max(2, Math.round(size * 0.14));
  const width = size;
  const height = size;

  // positions for the internal grid lines (one vertical and two horizontals -> 3x3 grid)
  const thirdX = (width - innerPadding * 2) / 3;
  const thirdY = (height - innerPadding * 2) / 3;

  return (
    <View style={[{ width, height, position: "relative" }, style]}>
      {/* outer rounded rect */}
      <View
        style={[
          styles.tableIconOuter,
          {
            borderColor: color,
            borderWidth: strokeWidth,
            borderRadius: Math.max(2, Math.round(size * 0.12)),
          },
        ]}
      />
      {/* vertical grid lines */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: innerPadding + thirdX - strokeWidth / 2,
          top: innerPadding,
          bottom: innerPadding,
          width: strokeWidth,
          backgroundColor: color,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: innerPadding + thirdX * 2 - strokeWidth / 2,
          top: innerPadding,
          bottom: innerPadding,
          width: strokeWidth,
          backgroundColor: color,
        }}
      />
      {/* horizontal grid lines */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: innerPadding + thirdY - strokeWidth / 2,
          left: innerPadding,
          right: innerPadding,
          height: strokeWidth,
          backgroundColor: color,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: innerPadding + thirdY * 2 - strokeWidth / 2,
          left: innerPadding,
          right: innerPadding,
          height: strokeWidth,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/* DownloadBadge: clear, high-contrast download icon inside a circular badge.
   Using MaterialCommunityIcons 'download' for crisp rendering.
   Props:
   - size: diameter of circle (default 32)
   - bg: background color (default blue)
   - iconColor: icon color (default white)
*/
function DownloadBadge({
  size = 32,
  bg = "#133E87",
  iconColor = "#fff",
  style,
}) {
  const iconSize = Math.round(size * 0.55);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="download"
        size={iconSize}
        color={iconColor}
      />
    </View>
  );
}

export default function AdminAnalytics({ navigation }) {
  const [LineChartComp, setLineChartComp] = useState(null);
  const [chartError, setChartError] = useState(null);
  const [activePoint, setActivePoint] = useState(null);
  const [activePointPredator, setActivePointPredator] = useState(null);
  const [activePointFeed, setActivePointFeed] = useState(null);
  const [activePointWater, setActivePointWater] = useState(null);
  const [activePointSolar, setActivePointSolar] = useState(null);
  const [pressedBtn, setPressedBtn] = useState(null);
  const [activePieSlice, setActivePieSlice] = useState(null);
  const [activePieSlicePredator, setActivePieSlicePredator] = useState(null);
  const [predatorTimeRange, setPredatorTimeRange] = useState("daily"); // Add state for time range
  const [mortalityData, setMortalityData] = useState([]); // State for mortality records from Firestore
  const [totalChicksCount, setTotalChicksCount] = useState(0); // Total active chicks
  const [totalDeaths, setTotalDeaths] = useState(0); // Total mortality count
  const [mortalityRate, setMortalityRate] = useState(0); // Mortality rate percentage

  // New state variables for Filter Modal
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  // Current target chart for filtering
  const [currentFilterTarget, setCurrentFilterTarget] = useState(null);

  // Filters for each chart
  const [chartFilters, setChartFilters] = useState({});

  // Export mortality modal state
  const [exportMortalityModalVisible, setExportMortalityModalVisible] =
    useState(false);
  const [exportStartDate, setExportStartDate] = useState(null);
  const [exportEndDate, setExportEndDate] = useState(null);
  const [exportSelectedDate, setExportSelectedDate] = useState("");
  const [exportMortalityData, setExportMortalityData] = useState([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Export cause of death modal state
  const [exportCauseModalVisible, setExportCauseModalVisible] = useState(false);
  const [causeExportStartDate, setCauseExportStartDate] = useState(null);
  const [causeExportEndDate, setCauseExportEndDate] = useState(null);
  const [causeExportSelectedDate, setCauseExportSelectedDate] = useState("");
  const [isGeneratingCauseReport, setIsGeneratingCauseReport] = useState(false);

  // Cause of Death state
  const [causeOfDeathData, setCauseOfDeathData] = useState([
    { name: "Predatory Attack", population: 0, color: "#154785" },
    { name: "Overfeeding", population: 0, color: "#FFC107" },
    { name: "Dehydration", population: 0, color: "#F44336" },
    { name: "Other", population: 0, color: "#4CAF50" },
  ]);

  const formatFilterDisplay = (filterData) => {
    if (!filterData) return "";

    // Handle date range object
    if (filterData.startDate && filterData.endDate) {
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

      const startDate = new Date(filterData.startDate);
      const endDate = new Date(filterData.endDate);

      const startMonth = monthNames[startDate.getMonth()];
      const startDay = startDate.getDate();
      const startYear = startDate.getFullYear();

      const endMonth = monthNames[endDate.getMonth()];
      const endDay = endDate.getDate();
      const endYear = endDate.getFullYear();

      // If same year, show: Jan 1 - Jan 15, 2024
      if (startYear === endYear) {
        if (startMonth === endMonth) {
          return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
        }
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
      }

      // Different years: Jan 1, 2023 - Jan 15, 2024
      return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
    }

    // Handle legacy single date string (if any old data exists)
    if (typeof filterData === "string") {
      const date = new Date(filterData);
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
      const day = date.getDate();
      const year = date.getFullYear();
      const monthName = monthNames[date.getMonth()];
      return `${monthName} ${day}, ${year}`;
    }

    return "";
  };

  // Generate date labels based on selected date range - shows all days in range
  const generateDateLabels = (filterData, defaultLabels) => {
    if (!filterData || !filterData.startDate || !filterData.endDate) {
      return defaultLabels;
    }

    const start = new Date(filterData.startDate);
    const end = new Date(filterData.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Handle single day selection (start and end are the same)
    if (diffDays === 0) {
      const month = start.toLocaleDateString("en-US", { month: "short" });
      const day = start.getDate();
      return [`${month} ${day}`];
    }

    // Generate labels for each day in the range (inclusive)
    const labels = [];

    for (let i = 0; i <= diffDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);

      const month = currentDate.toLocaleDateString("en-US", { month: "short" });
      const day = currentDate.getDate();

      labels.push(`${month} ${day}`);
    }

    return labels;
  };

  // Format date as "MMM DD" (e.g., "Jan 20")
  const formatDateAsDayMonth = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return "Unknown";
    }
    const months = [
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
    const day = String(date.getDate()).padStart(2, "0");
    const month = months[date.getMonth()];
    return `${month} ${day}`;
  };

  // Parse date strings in format "January 19, 2026 at 3:33:04 AM UTC+8" or "January 20, 2026, 8:00:00 AM UTC+8"
  const parseCustomDateFormat = (dateStr) => {
    if (!dateStr) return null;

    try {
      // Remove the UTC+X part
      const cleanedStr = dateStr.replace(/\s+UTC[+-]\d+.*$/, "").trim();
      console.log(
        `[ParseDate] Input: "${dateStr}" -> Cleaned: "${cleanedStr}"`,
      );

      // Match pattern: "Month Day, Year at/comma Time AM/PM"
      // Handles both formats:
      // 1. "January 20, 2026 at 12:00:00 AM" (Firestore Timestamp string)
      // 2. "January 20, 2026, 8:00:00 AM" (dateOfDeathFormatted)
      const pattern =
        /(\w+)\s+(\d+),\s+(\d+)\s+(?:at|,)\s*(\d+):(\d+):(\d+)\s+(AM|PM)/i;
      const match = cleanedStr.match(pattern);

      if (!match) {
        console.warn(`[ParseDate] Pattern not matched for: "${cleanedStr}"`);
        // Fallback: try direct parsing
        const fallbackDate = new Date(cleanedStr);
        if (!isNaN(fallbackDate.getTime())) {
          console.log(
            `[ParseDate] Fallback parsing succeeded: ${fallbackDate}`,
          );
          return fallbackDate;
        }
        return null;
      }

      const [, monthName, day, year, hour, minute, second, meridiem] = match;
      console.log(
        `[ParseDate] Extracted: month="${monthName}", day="${day}", year="${year}", time="${hour}:${minute}:${second} ${meridiem}"`,
      );

      // Convert month name to number
      const months = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
      };
      const monthNum = months[monthName.toLowerCase()];

      if (monthNum === undefined) {
        console.error(`[ParseDate] Invalid month name: "${monthName}"`);
        return null;
      }

      // Convert 12-hour to 24-hour format
      let hour24 = parseInt(hour);
      if (meridiem.toUpperCase() === "PM" && hour24 !== 12) {
        hour24 += 12;
      } else if (meridiem.toUpperCase() === "AM" && hour24 === 12) {
        hour24 = 0;
      }

      const parsedDate = new Date(year, monthNum, day, hour24, minute, second);
      console.log(
        `[ParseDate] Successfully parsed to: ${parsedDate} (ISO: ${parsedDate.toISOString()})`,
      );

      return parsedDate;
    } catch (error) {
      console.error(`[ParseDate] Error parsing date: ${error.message}`, error);
      return null;
    }
  };

  // Generate batch labels from B001 to B007
  const generateBatchLabels = (filterData, defaultData) => {
    // For batch charts, we'll keep the batch IDs but could filter by date in the future
    return defaultData;
  };

  /**
   * Fetch brooder info and calculate mortality statistics
   * Gets all documents from /brooderInfo and sums up chicksCount (alive)
   * Gets all documents from /mortality/{BatchId}/records and sums count (deaths)
   * Calculation:
   * - Total Alive = Sum of chicksCount from brooderInfo
   * - Total Deaths = Sum of count from mortality records
   * - Total Chicks (Initial) = Total Alive + Total Deaths
   * - Mortality Rate = (Total Deaths / Total Chicks Initial) × 100
   */
  const fetchBrooderStats = async () => {
    try {
      console.log("[FetchBrooderStats] Fetching brooder info...");

      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);

      let totalAliveChicks = 0; // Sum of chicksCount (alive now)
      let totalDeathCount = 0; // Sum of count from mortality records

      // Step 1: Sum all alive chicks from brooderInfo
      brooderSnapshot.docs.forEach((doc) => {
        const batchData = doc.data();
        const batchId = doc.id;
        const chicksCount = batchData.chicksCount || 0;

        totalAliveChicks += chicksCount;
        console.log(
          `[FetchBrooderStats] Batch ${batchId}: ${chicksCount} chicks alive`,
        );
      });

      console.log(
        `[FetchBrooderStats] Total alive chicks: ${totalAliveChicks}`,
      );

      // Step 2: Sum all deaths from mortality records for all batches
      const batchPromises = brooderSnapshot.docs.map(async (doc) => {
        const batchId = doc.id;

        // Fetch mortality records for this batch
        try {
          const mortalityRecordsRef = collection(
            firestoreDb,
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

          console.log(
            `[FetchBrooderStats] Batch ${batchId}: Deaths accumulated = ${totalDeathCount}`,
          );
        } catch (error) {
          console.error(
            `[FetchBrooderStats] Error fetching mortality for ${batchId}:`,
            error,
          );
        }
      });

      await Promise.all(batchPromises);

      console.log(`[FetchBrooderStats] Total deaths: ${totalDeathCount}`);

      // Step 3: Calculate total initial chicks (alive + dead)
      const totalInitialChicks = totalAliveChicks + totalDeathCount;

      // Step 4: Calculate mortality rate (2 decimal places)
      const rate =
        totalInitialChicks > 0
          ? ((totalDeathCount / totalInitialChicks) * 100).toFixed(2)
          : 0;

      console.log(
        `[FetchBrooderStats] Total Alive Chicks: ${totalAliveChicks}`,
      );
      console.log(`[FetchBrooderStats] Total Deaths: ${totalDeathCount}`);
      console.log(
        `[FetchBrooderStats] Total Initial Chicks: ${totalInitialChicks}`,
      );
      console.log(`[FetchBrooderStats] Mortality Rate: ${rate}%`);

      setTotalChicksCount(totalAliveChicks);
      setTotalDeaths(totalDeathCount);
      setMortalityRate(parseFloat(rate));
    } catch (error) {
      console.error("[FetchBrooderStats] Error:", error);
      setTotalChicksCount(0);
      setTotalDeaths(0);
      setMortalityRate(0);
    }
  };

  /**
   * Fetch mortality records from /mortality/{batchName}/records collection
   * Gets batch names from brooderInfo, then fetches records from mortality subcollections
   * Extracts count and dateOfDeath for aggregation
   */
  const fetchMortalityRecords = async (filterData = null) => {
    try {
      console.log(
        "[FetchMortalityRecords] Starting fetch from mortality collection...",
      );

      const allRecords = [];

      // Step 1: Get all batches from brooderInfo to get batch names/IDs
      console.log(
        "[FetchMortalityRecords] Fetching batch names from brooderInfo...",
      );
      const brooderCollection = collection(firestoreDb, "brooderInfo");
      const brooderDocs = await getDocs(brooderCollection);

      console.log(
        "[FetchMortalityRecords] Found batches in brooderInfo:",
        brooderDocs.docs.length,
      );

      if (brooderDocs.empty) {
        console.warn("[FetchMortalityRecords] No batches found in brooderInfo");
        setMortalityData([]);
        return [];
      }

      // Step 2: For each batch, try to fetch mortality records
      for (const batchDoc of brooderDocs.docs) {
        const docId = batchDoc.id;
        const batchData = batchDoc.data();
        const batchName = batchData.batchName || batchData.batch || docId;

        console.log(
          `[FetchMortalityRecords] Processing batch: docId=${docId}, batchName=${batchName}`,
        );

        // Try to fetch records by batch name (e.g., "Batch 3")
        try {
          console.log(
            `[FetchMortalityRecords] Attempting to fetch from /mortality/${batchName}/records`,
          );
          const recordsCollection = collection(
            firestoreDb,
            "mortality",
            batchName,
            "records",
          );
          const recordDocs = await getDocs(recordsCollection);

          console.log(
            `[FetchMortalityRecords] Found ${recordDocs.docs.length} records in /mortality/${batchName}/records`,
          );

          // Process each record - extract count and dateOfDeath for charting
          recordDocs.forEach((recordDoc) => {
            try {
              const data = recordDoc.data();

              // Convert Firestore Timestamp to JavaScript Date
              let dateOfDeath = data.dateOfDeath;
              console.log(
                `[FetchMortalityRecords] Raw dateOfDeath:`,
                dateOfDeath,
                `Type:`,
                typeof dateOfDeath,
              );

              if (dateOfDeath) {
                // Try toDate() method first (Firestore Timestamp)
                if (typeof dateOfDeath.toDate === "function") {
                  try {
                    dateOfDeath = dateOfDeath.toDate();
                    console.log(
                      `[FetchMortalityRecords] ✓ Converted via toDate(): ${dateOfDeath}`,
                    );
                  } catch (e) {
                    console.error(
                      `[FetchMortalityRecords] toDate() failed:`,
                      e,
                    );
                    // Fall back to seconds property
                    if (dateOfDeath.seconds) {
                      dateOfDeath = new Date(dateOfDeath.seconds * 1000);
                      console.log(
                        `[FetchMortalityRecords] ✓ Converted via seconds: ${dateOfDeath}`,
                      );
                    }
                  }
                }
                // If it has seconds property (Firestore Timestamp structure)
                else if (dateOfDeath.seconds) {
                  dateOfDeath = new Date(dateOfDeath.seconds * 1000);
                  console.log(
                    `[FetchMortalityRecords] ✓ Converted via seconds property: ${dateOfDeath}`,
                  );
                }
                // If it's already a Date object
                else if (dateOfDeath instanceof Date) {
                  console.log(
                    `[FetchMortalityRecords] ✓ Already a Date object: ${dateOfDeath}`,
                  );
                }
                // If it's a string (like "January 19, 2026 at 3:33:04 AM UTC+8")
                else if (typeof dateOfDeath === "string") {
                  dateOfDeath = parseCustomDateFormat(dateOfDeath);
                  if (dateOfDeath) {
                    console.log(
                      `[FetchMortalityRecords] ✓ Converted string to Date using custom parser: ${dateOfDeath}`,
                    );
                  } else {
                    console.warn(
                      `[FetchMortalityRecords] Custom parser failed for: ${data.dateOfDeath}`,
                    );
                  }
                }
                // If it's a number (timestamp in ms)
                else if (typeof dateOfDeath === "number") {
                  dateOfDeath = new Date(dateOfDeath);
                  console.log(
                    `[FetchMortalityRecords] ✓ Converted number to Date: ${dateOfDeath}`,
                  );
                }
              }

              // Fallback to dateOfDeathFormatted if the primary conversion failed
              if (!dateOfDeath || isNaN(dateOfDeath.getTime())) {
                if (
                  data.dateOfDeathFormatted &&
                  typeof data.dateOfDeathFormatted === "string"
                ) {
                  dateOfDeath = parseCustomDateFormat(
                    data.dateOfDeathFormatted,
                  );
                  if (dateOfDeath) {
                    console.log(
                      `[FetchMortalityRecords] ✓ Fallback: Converted dateOfDeathFormatted to Date using custom parser: ${dateOfDeath}`,
                    );
                  } else {
                    console.warn(
                      `[FetchMortalityRecords] Fallback custom parser also failed for: ${data.dateOfDeathFormatted}`,
                    );
                  }
                }
              }

              const count = parseInt(data.count) || 0;

              console.log(`[FetchMortalityRecords] Processing record:`, {
                recordId: recordDoc.id,
                batchName: batchName,
                count: count,
                dateOfDeath: dateOfDeath,
                dateOfDeathType: typeof dateOfDeath,
                causeOfDeath: data.causeOfDeath,
              });

              allRecords.push({
                recordId: recordDoc.id,
                batchId: data.batchId || batchName,
                batchName: batchName,
                count: count,
                dateOfDeath: dateOfDeath,
                causeOfDeath: data.causeOfDeath,
                predatorType: data.predatorType,
                customPredator: data.customPredator,
                daysCount: data.daysCount,
                notes: data.notes,
                reportedBy: data.reportedBy,
                userId: data.userId,
                timestamp: data.timestamp,
              });
            } catch (recordError) {
              console.error(
                `[FetchMortalityRecords] Error processing record ${recordDoc.id}:`,
                recordError,
              );
            }
          });
        } catch (batchError) {
          console.warn(
            `[FetchMortalityRecords] Could not fetch from /mortality/${batchName}/records:`,
            batchError.message,
          );
        }
      }

      console.log("[FetchMortalityRecords] ====== SUMMARY ======");
      console.log(
        "[FetchMortalityRecords] Total records fetched:",
        allRecords.length,
      );
      console.log("[FetchMortalityRecords] Records:", allRecords);

      // Filter by date range if provided
      let filteredRecords = allRecords;
      if (filterData && filterData.startDate && filterData.endDate) {
        const startDate = new Date(filterData.startDate);
        const endDate = new Date(filterData.endDate);

        console.log(
          `[FetchMortalityRecords] Filtering by date range: ${startDate} to ${endDate}`,
        );

        filteredRecords = allRecords.filter((record) => {
          if (!record.dateOfDeath) {
            console.warn(
              "[FetchMortalityRecords] Record has no dateOfDeath, skipping",
            );
            return false;
          }
          const recordDate = new Date(record.dateOfDeath);
          const inRange = recordDate >= startDate && recordDate <= endDate;
          console.log(
            `[FetchMortalityRecords] Record date ${recordDate} in range [${startDate} - ${endDate}]? ${inRange}`,
          );
          return inRange;
        });

        console.log(
          "[FetchMortalityRecords] After date filter:",
          filteredRecords.length,
          "records",
        );
      }

      console.log(
        "[FetchMortalityRecords] ====== FINAL: Setting mortalityData with",
        filteredRecords.length,
        "records ======",
      );
      setMortalityData(filteredRecords);
      return filteredRecords;
    } catch (error) {
      console.error("[FetchMortalityRecords] Fatal error:", error);
      console.error(
        "[FetchMortalityRecords] Error details:",
        error.message,
        error.code,
      );
      setMortalityData([]);
      return [];
    }
  };

  /**
   * Fetch all mortality records for export within a date range
   */
  const fetchMortalityRecordsForExport = async (startDateStr, endDateStr) => {
    try {
      console.log(
        "[FetchMortalityExport] Fetching mortality records for export...",
      );

      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);

      let allRecords = [];

      // Fetch mortality records from each batch
      const batchPromises = brooderSnapshot.docs.map(async (doc) => {
        const batchId = doc.id;

        try {
          const mortalityRecordsRef = collection(
            firestoreDb,
            "mortality",
            batchId,
            "records",
          );
          const recordsSnapshot = await getDocs(mortalityRecordsRef);

          recordsSnapshot.docs.forEach((recordDoc) => {
            const recordData = recordDoc.data();
            let recordDate;

            // Parse dateOfDeath
            if (recordData.dateOfDeath) {
              if (recordData.dateOfDeath.toDate) {
                recordDate = recordData.dateOfDeath.toDate();
              } else if (recordData.dateOfDeath.seconds) {
                recordDate = new Date(recordData.dateOfDeath.seconds * 1000);
              }
            }

            // Filter by date range
            if (
              recordDate &&
              recordDate >= startDate &&
              recordDate <= endDate
            ) {
              allRecords.push({
                id: recordDoc.id,
                ...recordData,
              });
            }
          });
        } catch (error) {
          console.warn(`Error fetching mortality for batch ${batchId}:`, error);
        }
      });

      await Promise.all(batchPromises);

      // Sort by dateOfDeath (descending)
      allRecords.sort((a, b) => {
        const dateA =
          a.dateOfDeath?.toDate?.() ||
          new Date(a.dateOfDeath?.seconds * 1000) ||
          new Date(0);
        const dateB =
          b.dateOfDeath?.toDate?.() ||
          new Date(b.dateOfDeath?.seconds * 1000) ||
          new Date(0);
        return dateB - dateA;
      });

      console.log(`[FetchMortalityExport] Found ${allRecords.length} records`);
      return allRecords;
    } catch (error) {
      console.error("[FetchMortalityExport] Error:", error);
      return [];
    }
  };

  /**
   * Fetch and calculate cause of death statistics filtered by date range
   *
   * Counts occurrences of each cause and calculates percentages
   * Uses chartFilters["cause"] for date range (startDate, endDate)
   * If no filter set, defaults to last 7 days
   */
  const fetchCauseOfDeathStats = async (filterData = null) => {
    try {
      console.log(
        "[FetchCauseOfDeath] Starting fetch with filter:",
        filterData,
      );

      // Determine date range
      let startDate, endDate;

      if (filterData && filterData.startDate && filterData.endDate) {
        // Parse filter date strings (format: YYYY-MM-DD)
        const [startYear, startMonth, startDay] = filterData.startDate
          .split("-")
          .map(Number);
        const [endYear, endMonth, endDay] = filterData.endDate
          .split("-")
          .map(Number);

        startDate = new Date(startYear, startMonth - 1, startDay);
        endDate = new Date(endYear, endMonth - 1, endDay);
        endDate.setHours(23, 59, 59, 999); // Include entire end day
      } else {
        // Default: last 7 days
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6); // -6 to include today as day 7
        startDate.setHours(0, 0, 0, 0);
      }

      console.log(
        "[FetchCauseOfDeath] Date range:",
        startDate.toISOString(),
        "to",
        endDate.toISOString(),
      );

      // Use collectionGroup to query all records across all batches
      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordsSnapshot = await getDocs(recordsRef);
      console.log(
        "[FetchCauseOfDeath] Found total records:",
        recordsSnapshot.docs.length,
      );

      let predatoryAttackCount = 0;
      let overfeedingCount = 0;
      let dehydrationCount = 0;
      let otherCount = 0;
      let totalRecordsProcessed = 0;

      // Process all records from all batches
      for (const recordDoc of recordsSnapshot.docs) {
        const data = recordDoc.data();
        console.log("[FetchCauseOfDeath] Record data:", data);

        const causeOfDeath = data.causeOfDeath || "Other";
        const count = data.count || 1; // Default to 1 if count not specified
        totalRecordsProcessed++;

        // Parse timestamp (date reported) to Date object
        let reportedDate = null;
        if (data.timestamp) {
          try {
            if (data.timestamp.toDate) {
              // Firestore Timestamp object
              reportedDate = data.timestamp.toDate();
            } else if (data.timestamp.seconds) {
              // Firestore Timestamp with seconds property
              reportedDate = new Date(data.timestamp.seconds * 1000);
            } else if (typeof data.timestamp === "string") {
              // ISO string or date string
              const [year, month, day] = data.timestamp.split("-").map(Number);
              reportedDate = new Date(year, month - 1, day);
            } else if (data.timestamp instanceof Date) {
              reportedDate = data.timestamp;
            }
          } catch (dateParseErr) {
            console.warn(
              "[FetchCauseOfDeath] Failed to parse timestamp:",
              data.timestamp,
              dateParseErr,
            );
          }
        }

        // Skip if timestamp is invalid
        if (!reportedDate) {
          console.warn(
            "[FetchCauseOfDeath] Skipping record - invalid timestamp:",
            data.timestamp,
          );
          continue;
        }

        // Convert UTC timestamp to GMT+8 (Philippine time)
        const reportedDateGMT8 = new Date(
          reportedDate.getTime() + 8 * 60 * 60 * 1000,
        );

        // Reset time to midnight for comparison (in GMT+8)
        const recordDate = new Date(
          reportedDateGMT8.getFullYear(),
          reportedDateGMT8.getMonth(),
          reportedDateGMT8.getDate(),
        );

        console.log("[FetchCauseOfDeath] Comparing dates (GMT+8):", {
          recordDate: recordDate.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isInRange: recordDate >= startDate && recordDate <= endDate,
          causeOfDeath,
          count,
        });

        if (recordDate < startDate || recordDate > endDate) {
          console.log(
            "[FetchCauseOfDeath] Record outside date range:",
            recordDate.toISOString(),
          );
          continue;
        }

        // Categorize the cause and add count
        if (causeOfDeath.toLowerCase().includes("predator")) {
          predatoryAttackCount += count;
        } else if (causeOfDeath.toLowerCase().includes("overfeeding")) {
          overfeedingCount += count;
        } else if (causeOfDeath.toLowerCase().includes("dehydration")) {
          dehydrationCount += count;
        } else {
          otherCount += count;
        }
      }

      // Calculate total
      const total =
        predatoryAttackCount + overfeedingCount + dehydrationCount + otherCount;

      console.log("[FetchCauseOfDeath] Processing complete:", {
        totalRecordsProcessed,
        predatoryAttackCount,
        overfeedingCount,
        dehydrationCount,
        otherCount,
        total,
      });

      // Calculate percentages with 1 decimal places
      const updatedData = [
        {
          name: "Predator Attack",
          population:
            total > 0
              ? parseFloat(((predatoryAttackCount / total) * 100).toFixed(1))
              : 0,
          color: "#154785",
          count: predatoryAttackCount,
        },
        {
          name: "Overfeeding",
          population:
            total > 0
              ? parseFloat(((overfeedingCount / total) * 100).toFixed(1))
              : 0,
          color: "#FFC107",
          count: overfeedingCount,
        },
        {
          name: "Dehydration",
          population:
            total > 0
              ? parseFloat(((dehydrationCount / total) * 100).toFixed(1))
              : 0,
          color: "#F44336",
          count: dehydrationCount,
        },
        {
          name: "Other",
          population:
            total > 0 ? parseFloat(((otherCount / total) * 100).toFixed(1)) : 0,
          color: "#4CAF50",
          count: otherCount,
        },
      ];

      setCauseOfDeathData(updatedData);
      console.log(
        "[FetchCauseOfDeath] Updated cause of death data:",
        updatedData,
      );
    } catch (error) {
      console.error("[FetchCauseOfDeath] Error:", error);
      // Set default data on error
      setCauseOfDeathData([
        { name: "Predatory Attack", population: 0, color: "#154785", count: 0 },
        { name: "Overfeeding", population: 0, color: "#FFC107", count: 0 },
        { name: "Dehydration", population: 0, color: "#F44336", count: 0 },
        { name: "Other", population: 0, color: "#4CAF50", count: 0 },
      ]);
    }
  };

  /**
   * Format date for display in GMT+8
   */
  const formatDateForDisplay = (timestamp) => {
    if (!timestamp) return "N/A";

    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return "N/A";
    }

    const months = [
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
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${month} ${day}, ${year} ${hours}:${minutes}`;
  };

  /**
   * Format date without time for report tables
   */
  const formatDateOnly = (timestamp) => {
    if (!timestamp) return "N/A";

    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return "N/A";
    }

    const months = [
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
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${month} ${day}, ${year}`;
  };

  /**
   * Log report generation to audit trail
   */
  const logReportGeneration = async (
    filename,
    reportName,
    action = null,
    description = null,
  ) => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        console.log("No authenticated user found for audit logging");
        return;
      }

      // Get user data from Firestore for additional info like userName
      let userName = currentUser.displayName || "Unknown User";
      let userEmail = currentUser.email || "unknown@example.com";

      try {
        const userDoc = await getDocs(collection(firestoreDb, "users"));
        userDoc.forEach((doc) => {
          if (doc.id === currentUser.uid) {
            userName = doc.data().name || doc.data().displayName || userName;
          }
        });
      } catch (e) {
        console.log("Could not fetch additional user data:", e);
      }

      // Use current UTC timestamp (Firestore will store it as is)
      const now = new Date();

      const auditLog = {
        action: action || "Generated mortality report",
        description: description || "Generated mortality trend report",
        fileName: filename,
        reportName: reportName,
        role: "admin",
        timestamp: now,
        type: "pdf",
        userId: currentUser.uid,
        userName: userName,
        userEmail: userEmail,
      };

      // Add to Firestore
      const logsCollectionRef = collection(
        firestoreDb,
        "activity_logs",
        "report_logs",
        "logs",
      );
      await addDoc(logsCollectionRef, auditLog);

      console.log("Audit log created successfully:", auditLog);
    } catch (error) {
      console.error("Error logging report generation:", error);
      // Don't throw error - audit logging failure shouldn't block report generation
    }
  };

  /**
   * Generate and export mortality report as PDF
   */
  const generateMortalityReportPDF = async () => {
    if (!exportStartDate || !exportEndDate) {
      Alert.alert("Error", "Please select both start and end dates");
      return;
    }

    setIsGeneratingReport(true);
    try {
      const records = await fetchMortalityRecordsForExport(
        exportStartDate,
        exportEndDate,
      );

      if (records.length === 0) {
        Alert.alert(
          "No Data",
          "No mortality records found for the selected date range",
        );
        setIsGeneratingReport(false);
        return;
      }

      // Load logo
      const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
      await logoAsset.downloadAsync();
      const logoBase64 = await FileSystem.readAsStringAsync(
        logoAsset.localUri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      // Create table rows
      let tableRows = "";
      records.forEach((record, index) => {
        const dateOfDeath = formatDateOnly(record.dateOfDeath);
        const dateReported = formatDateOnly(record.timestamp);
        const causeOfDeath = record.causeOfDeath || "N/A";
        const predatorType = record.predatorType || "N/A";
        const customPredator = record.customPredator || "N/A";
        const daysCount = record.daysCount || "N/A";
        const notes = record.notes || "N/A";
        const reportedBy = record.reportedBy || "N/A";
        const count = record.count || 0;
        const batchId = record.batchId || "N/A";

        tableRows += `
          <tr>
            <td>${index + 1}</td>
            <td>${dateOfDeath}</td>
            <td>${dateReported}</td>
            <td>${batchId}</td>
            <td>${count}</td>
            <td>${causeOfDeath}</td>
            <td>${predatorType}</td>
            <td>${customPredator}</td>
            <td>${daysCount}</td>
            <td>${notes}</td>
            <td>${reportedBy}</td>
          </tr>
        `;
      });

      // Generate HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4 landscape;
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
              font-size: 16px;
              color: #333;
              text-align: center;
              margin-bottom: 15px;
              font-weight: bold;
            }
            .filter-info {
              font-size: 12px;
              color: #666;
              margin-bottom: 10px;
              text-align: center;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 10px;
            }
            th {
              background-color: #133E87;
              color: white;
              padding: 8px;
              text-align: left;
              border: 1px solid #ddd;
              font-weight: bold;
            }
            td {
              padding: 6px;
              border: 1px solid #ddd;
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
          <div class="header">
            <div class="header-top">
              <img src="data:image/png;base64,${logoBase64}" class="logo" alt="Logo" />
              <div class="company-name">Internet of Tsiken</div>
            </div>
            <div class="report-title">Mortality Report</div>
            <div class="filter-info">
              Date Range: ${new Date(exportStartDate).toLocaleDateString()} to ${new Date(exportEndDate).toLocaleDateString()}<br>
              Report Generated: ${new Date().toLocaleString()}<br>
              Total Records: ${records.length}
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Date of Death</th>
                <th>Date Reported</th>
                <th>Batch</th>
                <th>Deaths</th>
                <th>Cause</th>
                <th>Predator</th>
                <th>Custom Predator</th>
                <th>Age</th>
                <th>Notes</th>
                <th>Reported By</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Create custom filename with date
      const startDateObj = new Date(exportStartDate);
      const endDateObj = new Date(exportEndDate);
      const formatDate = (date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
        const months = [
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
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      };

      const customFilename = `MortalityReport_${formatDate(exportStartDate)}_to_${formatDate(exportEndDate)}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation to audit trail
      await logReportGeneration(customFilename, "Mortality Report");

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      setExportMortalityModalVisible(false);
    } catch (error) {
      console.error("Error generating report:", error);
      Alert.alert("Error", "Failed to generate report: " + error.message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /**
   * Generate Cause of Death Report PDF
   * Fetches mortality records for the selected date range,
   * aggregates by causeOfDeath, calculates percentages,
   * and generates a comprehensive PDF report.
   */
  const generateCauseOfDeathReportPDF = async () => {
    if (!causeExportStartDate || !causeExportEndDate) {
      Alert.alert("Error", "Please select both start and end dates");
      return;
    }

    setIsGeneratingCauseReport(true);
    try {
      console.log(
        "Starting PDF generation with dates:",
        causeExportStartDate,
        causeExportEndDate,
      );

      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordsSnapshot = await getDocs(recordsRef);

      // Parse dates for filtering - ensure dates are in YYYY-MM-DD format
      let startDateStr = causeExportStartDate;
      let endDateStr = causeExportEndDate;

      // Convert to string if needed
      if (typeof startDateStr !== "string") {
        startDateStr = new Date(startDateStr).toISOString().split("T")[0];
      }
      if (typeof endDateStr !== "string") {
        endDateStr = new Date(endDateStr).toISOString().split("T")[0];
      }

      console.log("Parsed date strings:", startDateStr, endDateStr);

      if (!startDateStr || !endDateStr) {
        throw new Error("Failed to parse dates");
      }

      // Ensure dates are strings
      if (typeof startDateStr !== "string" || typeof endDateStr !== "string") {
        throw new Error("Dates must be strings in YYYY-MM-DD format");
      }

      const [startYear, startMonth, startDay] = startDateStr
        .split("-")
        .map(Number);
      const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);

      // Create date boundaries (user selected dates are in GMT+8)
      let startDate = new Date(startYear, startMonth - 1, startDay);
      startDate.setHours(0, 0, 0, 0);

      let endDate = new Date(endYear, endMonth - 1, endDay);
      endDate.setHours(23, 59, 59, 999);

      // Filter and aggregate records
      let totalDeaths = 0;
      let predatorCount = 0;
      let dehydrationCount = 0;
      let overfeedingCount = 0;
      let otherCount = 0;
      let latestRecord = null;
      let topPredatorType = null;
      let predatorTypes = {};
      const batchSummary = {};

      // First pass: Track the latest record across ALL records (not just filtered ones)
      for (const recordDoc of recordsSnapshot.docs) {
        const data = recordDoc.data();

        // Track latest record by timestamp (when it was recorded, not when death occurred)
        if (!latestRecord) {
          latestRecord = data;
        } else {
          // Compare timestamps
          let currentTimestamp =
            latestRecord.timestamp?.seconds ||
            latestRecord.timestamp?.getTime?.() / 1000 ||
            0;
          let newTimestamp =
            data.timestamp?.seconds || data.timestamp?.getTime?.() / 1000 || 0;

          if (newTimestamp > currentTimestamp) {
            latestRecord = data;
          }
        }
      }

      // Second pass: Filter by date range and aggregate
      for (const recordDoc of recordsSnapshot.docs) {
        const data = recordDoc.data();

        // Parse timestamp (date reported)
        let recordDate = null;
        if (data.timestamp) {
          if (data.timestamp.toDate) {
            recordDate = data.timestamp.toDate();
          } else if (data.timestamp.seconds) {
            recordDate = new Date(data.timestamp.seconds * 1000);
          }
        }

        if (!recordDate) continue;

        // Convert record date to GMT+8 for comparison
        // Add 8 hours to convert from UTC to GMT+8
        const recordDateGMT8 = new Date(
          recordDate.getTime() + 8 * 60 * 60 * 1000,
        );

        // Filter by date range (compare GMT+8 dates)
        if (recordDateGMT8 < startDate || recordDateGMT8 > endDate) continue;

        const count = data.count || 1;
        const causeOfDeath = data.causeOfDeath || "Other";
        const batchId = data.batchId || "Unknown";

        totalDeaths += count;

        // Categorize cause
        if (causeOfDeath.toLowerCase().includes("predator")) {
          predatorCount += count;
          if (data.predatorType) {
            predatorTypes[data.predatorType] =
              (predatorTypes[data.predatorType] || 0) + 1;
          }
        } else if (causeOfDeath.toLowerCase().includes("dehydration")) {
          dehydrationCount += count;
        } else if (causeOfDeath.toLowerCase().includes("overfeeding")) {
          overfeedingCount += count;
        } else {
          otherCount += count;
        }

        // Track batch summary with detailed breakdown
        if (!batchSummary[batchId]) {
          batchSummary[batchId] = {
            totalDeaths: 0,
            dog: 0,
            cat: 0,
            rat: 0,
            snake: 0,
            otherPredator: 0,
            dehydration: 0,
            overfeeding: 0,
            disease: 0,
            otherCause: 0,
          };
        }
        batchSummary[batchId].totalDeaths += count;

        // Categorize and track by batch
        if (causeOfDeath.toLowerCase().includes("predator")) {
          const predatorType = (data.predatorType || "Other").toLowerCase();
          if (predatorType === "dog") {
            batchSummary[batchId].dog += count;
          } else if (predatorType === "cat") {
            batchSummary[batchId].cat += count;
          } else if (predatorType === "rat") {
            batchSummary[batchId].rat += count;
          } else if (predatorType === "snake") {
            batchSummary[batchId].snake += count;
          } else {
            batchSummary[batchId].otherPredator += count;
          }
        } else if (causeOfDeath.toLowerCase().includes("dehydration")) {
          batchSummary[batchId].dehydration += count;
        } else if (causeOfDeath.toLowerCase().includes("overfeeding")) {
          batchSummary[batchId].overfeeding += count;
        } else if (causeOfDeath.toLowerCase().includes("disease")) {
          batchSummary[batchId].disease += count;
        } else {
          batchSummary[batchId].otherCause += count;
        }
      }

      // Find top predator type(s) - show all tied predators
      let topPredatorCount = 0;
      if (Object.keys(predatorTypes).length > 0) {
        // Find the maximum count
        topPredatorCount = Math.max(...Object.values(predatorTypes));
        // Get all predators with the maximum count
        const topPredators = Object.keys(predatorTypes).filter(
          (predator) => predatorTypes[predator] === topPredatorCount,
        );
        // Sort alphabetically and join with commas
        topPredatorType = topPredators.sort().join(", ");
      }

      // Calculate percentages
      const predatorPct =
        totalDeaths > 0 ? ((predatorCount / totalDeaths) * 100).toFixed(2) : 0;
      const dehydrationPct =
        totalDeaths > 0
          ? ((dehydrationCount / totalDeaths) * 100).toFixed(2)
          : 0;
      const overfeedingPct =
        totalDeaths > 0
          ? ((overfeedingCount / totalDeaths) * 100).toFixed(2)
          : 0;
      const otherPct =
        totalDeaths > 0 ? ((otherCount / totalDeaths) * 100).toFixed(2) : 0;

      // Format dates for display - moved here so it's available for no-data check
      const formatDate = (dateStr) => {
        // Handle Firebase timestamps
        if (dateStr && typeof dateStr === "object") {
          if (dateStr.toDate) {
            dateStr = dateStr.toDate().toISOString().split("T")[0];
          } else if (dateStr.seconds) {
            dateStr = new Date(dateStr.seconds * 1000)
              .toISOString()
              .split("T")[0];
          }
        }

        const [year, month, day] = dateStr.split("-");
        const date = new Date(year, month - 1, day);
        const months = [
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
        return `${day}-${months[parseInt(month) - 1]}-${year}`;
      };
      if (totalDeaths === 0) {
        Alert.alert("No Data", "No data for selected date/s");
        setExportCauseModalVisible(false);
        setIsGeneratingCauseReport(false);
        return;
      }

      // Load logo for report
      const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
      await logoAsset.downloadAsync();
      const logoBase64 = await FileSystem.readAsStringAsync(
        logoAsset.localUri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      // Create batch summary rows with detailed breakdown
      let batchRows = "";
      let totalDog = 0,
        totalCat = 0,
        totalRat = 0,
        totalSnake = 0,
        totalOther = 0;
      let totalDehydrationBreakdown = 0,
        totalOverfeedingBreakdown = 0,
        totalDiseaseBreakdown = 0,
        totalOtherCause = 0;

      Object.entries(batchSummary).forEach(([batchId, summary]) => {
        batchRows += `
          <tr>
            <td>${batchId}</td>
            <td>${summary.dog}</td>
            <td>${summary.cat}</td>
            <td>${summary.rat}</td>
            <td>${summary.snake}</td>
            <td>${summary.otherPredator}</td>
            <td>${summary.dehydration}</td>
            <td>${summary.overfeeding}</td>
            <td>${summary.disease}</td>
            <td>${summary.otherCause}</td>
            <td>${summary.totalDeaths}</td>
          </tr>
        `;
        totalDog += summary.dog;
        totalCat += summary.cat;
        totalRat += summary.rat;
        totalSnake += summary.snake;
        totalOther += summary.otherPredator;
        totalDehydrationBreakdown += summary.dehydration;
        totalOverfeedingBreakdown += summary.overfeeding;
        totalDiseaseBreakdown += summary.disease;
        totalOtherCause += summary.otherCause;
      });

      // Add total row
      const grandTotal =
        totalDog +
        totalCat +
        totalRat +
        totalSnake +
        totalOther +
        totalDehydrationBreakdown +
        totalOverfeedingBreakdown +
        totalDiseaseBreakdown +
        totalOtherCause;
      batchRows += `
        <tr style="background-color: #e8e8e8; font-weight: bold;">
          <td>TOTAL</td>
          <td>${totalDog}</td>
          <td>${totalCat}</td>
          <td>${totalRat}</td>
          <td>${totalSnake}</td>
          <td>${totalOther}</td>
          <td>${totalDehydrationBreakdown}</td>
          <td>${totalOverfeedingBreakdown}</td>
          <td>${totalDiseaseBreakdown}</td>
          <td>${totalOtherCause}</td>
          <td>${grandTotal}</td>
        </tr>
      `;

      // Create detailed mortality records rows - sorted by createdAt descending
      let detailedRecordsRows = "";
      const allRecords = [];

      for (const recordDoc of recordsSnapshot.docs) {
        const data = recordDoc.data();

        // Parse dateOfDeath
        let recordDate = null;
        if (data.dateOfDeath) {
          if (data.dateOfDeath.toDate) {
            recordDate = data.dateOfDeath.toDate();
          } else if (data.dateOfDeath.seconds) {
            recordDate = new Date(data.dateOfDeath.seconds * 1000);
          }
        }

        if (!recordDate) continue;

        // Convert record date to GMT+8 for comparison
        const recordDateGMT8 = new Date(
          recordDate.getTime() + 8 * 60 * 60 * 1000,
        );

        // Filter by date range (compare GMT+8 dates)
        if (recordDateGMT8 < startDate || recordDateGMT8 > endDate) continue;

        allRecords.push(data);
      }

      // Sort by createdAt descending
      allRecords.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      // Generate rows for detailed records
      allRecords.forEach((record) => {
        const createdAtDate = record.createdAt?.seconds
          ? (() => {
              const date = new Date(record.createdAt.seconds * 1000);
              const months = [
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
              const day = String(date.getDate()).padStart(2, "0");
              const month = months[date.getMonth()];
              const year = date.getFullYear();
              return `${day}-${month}-${year}`;
            })()
          : "";

        const dateOfDeathDate = record.dateOfDeath?.seconds
          ? (() => {
              const date = new Date(record.dateOfDeath.seconds * 1000);
              const months = [
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
              const day = String(date.getDate()).padStart(2, "0");
              const month = months[date.getMonth()];
              const year = date.getFullYear();
              return `${day}-${month}-${year}`;
            })()
          : "";

        const causeOfDeath = record.causeOfDeath || "";
        const predatorType = record.predatorType || "";
        const customPredator = record.customPredator || "";
        const otherCause =
          !causeOfDeath.toLowerCase().includes("predator") &&
          causeOfDeath !== "Dehydration" &&
          causeOfDeath !== "Overfeeding" &&
          causeOfDeath !== "Disease"
            ? causeOfDeath
            : "";
        const count = record.count || 1;
        const notes = record.notes || "";
        const reportedBy = record.reportedBy || "";
        const daysCount = record.daysCount || "";

        detailedRecordsRows += `
          <tr>
            <td>${createdAtDate}</td>
            <td>${count}</td>
            <td>${causeOfDeath}</td>
            <td>${predatorType}</td>
            <td>${customPredator}</td>
            <td>${daysCount}</td>
            <td>${notes}</td>
            <td>${dateOfDeathDate}</td>
            <td>${reportedBy}</td>
          </tr>
        `;
      });

      const dateRangeDisplay = `${formatDate(startDateStr)} to ${formatDate(endDateStr)}`;

      // Generate HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4 portrait;
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
              font-size: 16px;
              color: #333;
              text-align: center;
              margin-bottom: 15px;
              font-weight: bold;
            }
            .filter-info {
              font-size: 12px;
              color: #666;
              margin-bottom: 15px;
              text-align: center;
            }
            .summary-section {
              margin-bottom: 20px;
              background-color: #f9f9f9;
              padding: 10px;
              border-radius: 5px;
            }
            .summary-title {
              font-size: 14px;
              font-weight: bold;
              color: #133E87;
              margin-bottom: 10px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              font-size: 11px;
            }
            .summary-item {
              padding: 8px;
              background-color: white;
              border-left: 3px solid #133E87;
              border-radius: 3px;
            }
            .summary-label {
              color: #666;
              font-size: 10px;
            }
            .summary-value {
              color: #133E87;
              font-weight: bold;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 11px;
            }
            th {
              background-color: #133E87;
              color: white;
              padding: 8px;
              text-align: left;
              border: 1px solid #ddd;
              font-weight: bold;
            }
            td {
              padding: 6px;
              border: 1px solid #ddd;
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
          <div class="header">
            <div class="header-top">
              <img src="data:image/png;base64,${logoBase64}" class="logo" alt="Logo" />
              <div class="company-name">Internet of Tsiken</div>
            </div>
            <div class="report-title">Cause of Death Analysis Report</div>
            <div class="filter-info">
              Date Range: ${dateRangeDisplay}<br>
              Report Generated: ${new Date().toLocaleString()}<br>
              Total Deaths: ${totalDeaths}
            </div>
          </div>

          <div class="summary-section">
            <div class="summary-title">Mortality Summary</div>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Predatory Attack</div>
                <div class="summary-value">${predatorPct}%</div>
                <div class="summary-label">(${predatorCount} ${predatorCount === 1 ? "death" : "deaths"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Dehydration</div>
                <div class="summary-value">${dehydrationPct}%</div>
                <div class="summary-label">(${dehydrationCount} ${dehydrationCount === 1 ? "death" : "deaths"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Overfeeding</div>
                <div class="summary-value">${overfeedingPct}%</div>
                <div class="summary-label">(${overfeedingCount} ${overfeedingCount === 1 ? "death" : "deaths"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Other</div>
                <div class="summary-value">${otherPct}%</div>
                <div class="summary-label">(${otherCount} ${otherCount === 1 ? "death" : "deaths"})</div>
              </div>
            </div>
          </div>

          <div class="summary-section">
            <div class="summary-title">Predatory Attack </div>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Top Predator Type</div>
                <div class="summary-value">${topPredatorType || "N/A"}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Top Predator Attack Deaths</div>
                <div class="summary-value">${topPredatorCount}</div>
              </div>
            </div>
          </div>
         
          <div class="summary-section">
            <div class="summary-title">Causes of Death</div>
           
          <table>
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Dog</th>
                <th>Cat</th>
                <th>Rat</th>
                <th>Snake</th>
                <th>Other</th>
                <th>Dehydration</th>
                <th>Overfeeding</th>
                <th>Disease</th>
                <th>Other Causes</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${batchRows}
            </tbody>
          </table>

          </div>

          <div style="margin-top: 30px; margin-bottom: 20px; background-color: #f9f9f9; padding: 10px; border-radius: 5px;">
            <div style="font-size: 14px; font-weight: bold; color: #133E87; margin-bottom: 10px;">Detailed Mortality Records</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 11%;">Reported Date</th>
                  <th style="width: 7%;">Death Count</th>
                  <th style="width: 13%;">Death Cause</th>
                  <th style="width: 9%;">Predator Type</th>
                  <th style="width: 12%;">Custom Predator</th>
                  <th style="width: 8%;">Age</th>
                  <th style="width: 12%;">Notes</th>
                  <th style="width: 11%;">Date of Death</th>
                  <th style="width: 14%;">Reported By</th>
                </tr>
              </thead>
              <tbody>
                ${detailedRecordsRows}
              </tbody>
            </table>
          </div>
           </div>
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      const customFilename = `CauseOfDeathReport_${formatDate(startDateStr)}_to_${formatDate(endDateStr)}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation to audit trail
      await logReportGeneration(
        customFilename,
        "Cause of Death Report",
        "Generated death causes",
        "Generated cause of death report",
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      setExportCauseModalVisible(false);
    } catch (error) {
      console.error("Error generating cause of death report:", error);
      try {
        // Load logo for branded error message
        const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
        await logoAsset.downloadAsync();
        const logoBase64 = await FileSystem.readAsStringAsync(
          logoAsset.localUri,
          {
            encoding: FileSystem.EncodingType.Base64,
          },
        );

        // Create branded error page
        const brandedErrorHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #133E87 0%, #1e5ba8 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 450px;
              }
              .logo {
                width: 70px;
                height: 70px;
                border-radius: 50%;
                margin: 0 auto 20px;
              }
              .company-name {
                font-size: 22px;
                font-weight: bold;
                color: #133E87;
                margin-bottom: 25px;
              }
              .error-icon {
                font-size: 60px;
                margin-bottom: 20px;
              }
              .error-title {
                font-size: 24px;
                color: #d32f2f;
                font-weight: bold;
                margin-bottom: 15px;
              }
              .error-message {
                font-size: 14px;
                color: #666;
                line-height: 1.6;
                margin-bottom: 20px;
              }
              .error-details {
                font-size: 12px;
                color: #999;
                background-color: #f5f5f5;
                padding: 12px;
                border-radius: 5px;
                margin-top: 20px;
                text-align: left;
                border-left: 3px solid #d32f2f;
                max-height: 150px;
                overflow-y: auto;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <img src="data:image/png;base64,${logoBase64}" class="logo" alt="Internet of Tsiken" />
              <div class="company-name">Internet of Tsiken</div>
              <div class="error-icon">⚠️</div>
              <div class="error-title">Report Generation Error</div>
              <div class="error-message">
                An error occurred while generating the Cause of Death report. Please try again or contact support.
              </div>
              <div class="error-details">
                <strong>Error Details:</strong><br>
                ${error.message || "Unknown error"}
              </div>
            </div>
          </body>
          </html>
        `;

        // Generate PDF
        const pdf = await Print.printToFileAsync({
          html: brandedErrorHTML,
          base64: false,
        });

        const timestamp = new Date().toISOString().split("T")[0];
        const customFilename = `CauseOfDeathReport_${timestamp}_Error.pdf`;
        const newPath = `${FileSystem.documentDirectory}${customFilename}`;

        // Copy the PDF to a new location with custom name
        await FileSystem.copyAsync({
          from: pdf.uri,
          to: newPath,
        });

        // Share PDF with custom filename
        await Sharing.shareAsync(newPath);
      } catch (fallbackError) {
        console.error("Error creating branded error page:", fallbackError);
        // Fallback to alert if branded error page fails
        Alert.alert("Error", "Failed to generate report: " + error.message);
      }
      setExportCauseModalVisible(false);
    } finally {
      setIsGeneratingCauseReport(false);
    }
  };

  // Generate data points based on the number of labels
  const generateDataPoints = (filterData, defaultData) => {
    if (!filterData || !filterData.startDate || !filterData.endDate) {
      return defaultData;
    }

    const start = new Date(filterData.startDate);
    const end = new Date(filterData.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end

    // Handle single day selection (start and end are the same)
    if (diffDays === 1) {
      return [defaultData[0]];
    }

    // Generate data points based on the number of days
    // For demo purposes, we'll interpolate from the default data
    const dataPoints = [];
    for (let i = 0; i < diffDays; i++) {
      const ratio = i / (diffDays - 1);
      const index = Math.min(
        Math.floor(ratio * (defaultData.length - 1)),
        defaultData.length - 1,
      );
      dataPoints.push(defaultData[index]);
    }

    return dataPoints;
  };

  useEffect(() => {
    try {
      // dynamic require so app doesn't crash when packages missing
      // eslint-disable-next-line global-require
      const { LineChart } = require("react-native-chart-kit");
      // eslint-disable-next-line global-require
      const RN_SVG = require("react-native-svg");

      if (!LineChart)
        throw new Error("react-native-chart-kit LineChart is undefined");
      if (!RN_SVG || !RN_SVG.Svg)
        throw new Error("react-native-svg seems missing or invalid");

      setLineChartComp(() => LineChart);
      setChartError(null);
    } catch (err) {
      console.warn("Chart init error:", err?.message ?? err);
      setChartError(err?.message ?? String(err));
      setLineChartComp(null);
    }
  }, []);

  // Fetch mortality data on component mount
  useEffect(() => {
    console.log(
      "[adminAnalytics] useEffect: Mounting component, setting default 7-day filter",
    );

    // Set default filter to last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // -6 to include today as day 7

    // Format dates as YYYY-MM-DD for consistency
    const formatDateToISO = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const defaultFilter = {
      startDate: formatDateToISO(sevenDaysAgo),
      endDate: formatDateToISO(today),
    };

    console.log("[adminAnalytics] Default 7-day filter set:", defaultFilter);
    setChartFilters((prev) => ({
      ...prev,
      mortality: defaultFilter,
      cause: defaultFilter,
    }));
  }, []);

  // Fetch mortality data when filter changes
  useEffect(() => {
    console.log(
      "[adminAnalytics] useEffect: Filters changed:",
      chartFilters["mortality"],
    );
    fetchMortalityRecords(chartFilters["mortality"]);
  }, [chartFilters["mortality"]]);

  // Fetch brooder stats (total chicks and mortality rate) on mount
  useEffect(() => {
    console.log("[adminAnalytics] useEffect: Fetching brooder stats...");
    fetchBrooderStats();
  }, []);

  // Fetch cause of death stats on mount and when filter changes
  useEffect(() => {
    console.log("[adminAnalytics] useEffect: Fetching cause of death stats...");
    fetchCauseOfDeathStats(chartFilters["cause"]);
  }, [chartFilters["cause"]]);

  // Note: icon values are MaterialCommunityIcons names
  const metrics = [
    {
      id: 1,
      title: "Mortality Rate",
      value: `${mortalityRate}%`,
      subtitle: `${totalChicksCount} chicks active`,
      icon: "account-group",
    },
    {
      id: 2,
      title: "Predators Detected",
      value: 0,
      subtitle: "No threats detected",
      icon: "chart-areaspline",
    },
  ];

  // Mortality chart data - dynamic labels and data based on filter
  const generateMortalityChartData = () => {
    console.log(
      "[GenerateMortalityChartData] Called with mortalityData length:",
      mortalityData?.length,
    );
    console.log("[GenerateMortalityChartData] mortalityData:", mortalityData);

    if (!mortalityData || mortalityData.length === 0) {
      console.log(
        "[GenerateMortalityChartData] No data available, showing default",
      );
      return {
        labels: ["No data"],
        datasets: [
          {
            data: [0],
            color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
          },
        ],
      };
    }

    // Group records by date
    const dateMap = {};

    mortalityData.forEach((record, idx) => {
      try {
        let dateStr = "Unknown";
        let convertedDate = null;

        console.log(
          `[GenerateMortalityChartData] Record ${idx} FULL DATA:`,
          JSON.stringify(record, null, 2),
        );
        console.log(
          `[GenerateMortalityChartData] Record ${idx} dateOfDeath:`,
          record.dateOfDeath,
          `Type:`,
          typeof record.dateOfDeath,
        );
        console.log(
          `[GenerateMortalityChartData] Record ${idx} dateOfDeathFormatted:`,
          record.dateOfDeathFormatted,
        );
        console.log(
          `[GenerateMortalityChartData] Record ${idx} dateOfDeath.toDate:`,
          typeof record.dateOfDeath?.toDate,
        );
        console.log(
          `[GenerateMortalityChartData] Record ${idx} dateOfDeath.seconds:`,
          record.dateOfDeath?.seconds,
        );

        if (record.dateOfDeath) {
          try {
            // Try toDate() first (Firestore Timestamp)
            if (typeof record.dateOfDeath.toDate === "function") {
              convertedDate = record.dateOfDeath.toDate();
              console.log(
                `[GenerateMortalityChartData] Record ${idx}: ✓ Used toDate() method, result:`,
                convertedDate,
              );
            }
            // If it has seconds property (Firestore Timestamp structure)
            else if (record.dateOfDeath.seconds) {
              convertedDate = new Date(record.dateOfDeath.seconds * 1000);
              console.log(
                `[GenerateMortalityChartData] Record ${idx}: ✓ Used seconds property, result:`,
                convertedDate,
              );
            }
            // If it's already a Date object
            else if (record.dateOfDeath instanceof Date) {
              convertedDate = record.dateOfDeath;
              console.log(
                `[GenerateMortalityChartData] Record ${idx}: ✓ Already a Date`,
              );
            }
            // If it's a string like "January 19, 2026 at 3:33:04 AM UTC+8"
            else if (typeof record.dateOfDeath === "string") {
              console.log(
                `[GenerateMortalityChartData] Record ${idx}: String detected, calling parseCustomDateFormat`,
              );
              convertedDate = parseCustomDateFormat(record.dateOfDeath);
              if (convertedDate) {
                console.log(
                  `[GenerateMortalityChartData] Record ${idx}: ✓ Parsed string using custom parser, result:`,
                  convertedDate,
                );
              } else {
                console.warn(
                  `[GenerateMortalityChartData] Record ${idx}: Custom parser FAILED for: ${record.dateOfDeath}`,
                );
              }
            }
            // If it's a number
            else if (typeof record.dateOfDeath === "number") {
              convertedDate = new Date(record.dateOfDeath);
              console.log(
                `[GenerateMortalityChartData] Record ${idx}: ✓ Parsed number`,
              );
            }

            console.log(
              `[GenerateMortalityChartData] Record ${idx}: After conversion, convertedDate:`,
              convertedDate,
              `isValid:`,
              convertedDate && !isNaN(convertedDate.getTime()),
            );

            // Validate the converted date
            if (convertedDate && !isNaN(convertedDate.getTime())) {
              dateStr = formatDateAsDayMonth(convertedDate);
              console.log(
                `[GenerateMortalityChartData] Record ${idx}: ✓✓ Final date string: ${dateStr}`,
              );
            } else {
              console.warn(
                `[GenerateMortalityChartData] Record ${idx}: Date conversion failed, attempting fallback with dateOfDeathFormatted`,
              );
              // Fallback to dateOfDeathFormatted
              if (
                record.dateOfDeathFormatted &&
                typeof record.dateOfDeathFormatted === "string"
              ) {
                console.log(
                  `[GenerateMortalityChartData] Record ${idx}: Fallback - parsing dateOfDeathFormatted: ${record.dateOfDeathFormatted}`,
                );
                convertedDate = parseCustomDateFormat(
                  record.dateOfDeathFormatted,
                );
                if (convertedDate && !isNaN(convertedDate.getTime())) {
                  dateStr = formatDateAsDayMonth(convertedDate);
                  console.log(
                    `[GenerateMortalityChartData] Record ${idx}: ✓✓ Fallback to dateOfDeathFormatted using custom parser: ${dateStr}`,
                  );
                } else {
                  console.error(
                    `[GenerateMortalityChartData] Record ${idx}: Invalid date after fallback conversion`,
                    convertedDate,
                  );
                  dateStr = "Unknown";
                }
              } else {
                console.error(
                  `[GenerateMortalityChartData] Record ${idx}: No dateOfDeathFormatted available`,
                );
                dateStr = "Unknown";
              }
            }
          } catch (conversionError) {
            console.error(
              `[GenerateMortalityChartData] Record ${idx}: Error converting date`,
              conversionError,
            );
            dateStr = "Unknown";
          }
        } else {
          console.warn(
            `[GenerateMortalityChartData] Record ${idx}: No dateOfDeath`,
          );
        }

        if (!dateMap[dateStr]) {
          dateMap[dateStr] = 0;
        }

        const count = parseInt(record.count) || 0;
        dateMap[dateStr] += count;
        console.log(
          `[GenerateMortalityChartData] Date: ${dateStr}, Count: ${count}, Running total: ${dateMap[dateStr]}`,
        );
      } catch (e) {
        console.error(
          `[GenerateMortalityChartData] Error processing record ${idx}:`,
          e,
        );
      }
    });

    console.log("[GenerateMortalityChartData] Final dateMap:", dateMap);

    // If we have a filter with date range, fill in missing dates with 0
    let allDates = Object.keys(dateMap);
    if (
      chartFilters["mortality"]?.startDate &&
      chartFilters["mortality"]?.endDate
    ) {
      const start = new Date(chartFilters["mortality"].startDate);
      const end = new Date(chartFilters["mortality"].endDate);

      // Generate all dates in range
      const filledDateMap = {};
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const formattedDate = formatDateAsDayMonth(new Date(d));
        filledDateMap[formattedDate] = dateMap[formattedDate] || 0;
      }

      allDates = Object.keys(filledDateMap);
      Object.assign(dateMap, filledDateMap);
      console.log(
        "[GenerateMortalityChartData] Filled dateMap with all dates in range:",
        filledDateMap,
      );
    }

    // Sort by date - dates are already in "MMM DD" format from formatDateAsDayMonth
    const sortedDates = allDates.sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      // Both are in "MMM DD" format, so just do string comparison
      return a.localeCompare(b);
    });

    // Dates are already formatted as "20-Jan", use them directly
    const labels = sortedDates;

    const data = sortedDates.map((date) => dateMap[date]);

    console.log("[GenerateMortalityChartData] Final labels:", labels);
    console.log("[GenerateMortalityChartData] Final data:", data);

    return {
      labels: labels.length > 0 ? labels : ["No data"],
      datasets: [
        {
          data: data.length > 0 ? data : [0],
          color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
        },
      ],
    };
  };

  const chartData = (() => {
    console.log(
      "[adminAnalytics] Generating chart data. mortalityData length:",
      mortalityData?.length,
    );
    const data = generateMortalityChartData();
    console.log("[adminAnalytics] Generated chartData:", data);
    return data;
  })();
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

  const showPointTooltipPredator = (point) => {
    setActivePointPredator(point);
    setTimeout(() => setActivePointPredator(null), 2000);
  };

  const showPointTooltipFeed = (point) => {
    setActivePointFeed(point);
    setTimeout(() => setActivePointFeed(null), 2000);
  };

  const showPointTooltipWater = (point) => {
    setActivePointWater(point);
    setTimeout(() => setActivePointWater(null), 2000);
  };

  const showPointTooltipSolar = (point) => {
    setActivePointSolar(point);
    setTimeout(() => setActivePointSolar(null), 2000);
  };

  // Updated Predator chart data with different time ranges - dynamic labels based on filter
  const defaultPredatorDailyLabels = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ];
  const defaultPredatorMonthlyLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
  ];
  const defaultPredatorYearlyLabels = [
    "2019",
    "2020",
    "2021",
    "2022",
    "2023",
    "2024",
    "2025",
  ];

  const defaultPredatorDailyData = [0, 1, 0, 2, 0, 1, 0];
  const defaultPredatorMonthlyData = [3, 5, 2, 8, 4, 6, 7];
  const defaultPredatorYearlyData = [15, 22, 18, 30, 25, 28, 32];

  const predatorChartDataDaily = {
    labels: generateDateLabels(
      chartFilters["predator"],
      defaultPredatorDailyLabels,
    ),
    datasets: [
      {
        data: generateDataPoints(
          chartFilters["predator"],
          defaultPredatorDailyData,
        ),
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };

  const predatorChartDataMonthly = {
    labels: generateDateLabels(
      chartFilters["predator"],
      defaultPredatorMonthlyLabels,
    ),
    datasets: [
      {
        data: generateDataPoints(
          chartFilters["predator"],
          defaultPredatorMonthlyData,
        ),
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };

  const predatorChartDataYearly = {
    labels: generateDateLabels(
      chartFilters["predator"],
      defaultPredatorYearlyLabels,
    ),
    datasets: [
      {
        data: generateDataPoints(
          chartFilters["predator"],
          defaultPredatorYearlyData,
        ),
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };

  // Get current predator chart data based on selected time range
  const getCurrentPredatorData = () => {
    switch (predatorTimeRange) {
      case "monthly":
        return predatorChartDataMonthly;
      case "yearly":
        return predatorChartDataYearly;
      default:
        return predatorChartDataDaily;
    }
  };

  const predatorChartData = getCurrentPredatorData();

  // Chart data for Feed Consumption - dynamic labels and data based on filter
  const defaultFeedLabels = [
    "Day 1",
    "Day 7",
    "Day 14",
    "Day 21",
    "Day 28",
    "Day 35",
    "Day 42",
  ];
  const defaultFeedData = [5, 8, 12, 15, 18, 20, 22];
  const feedChartData = {
    labels: generateDateLabels(chartFilters["feed"], defaultFeedLabels),
    datasets: [
      {
        data: generateDataPoints(chartFilters["feed"], defaultFeedData),
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };

  // Chart data for Water Consumption - dynamic labels and data based on filter
  const defaultWaterLabels = [
    "Day 1",
    "Day 7",
    "Day 14",
    "Day 21",
    "Day 28",
    "Day 35",
    "Day 42",
  ];
  const defaultWaterData = [8, 12, 16, 20, 24, 28, 30];
  const waterChartData = {
    labels: generateDateLabels(chartFilters["water"], defaultWaterLabels),
    datasets: [
      {
        data: generateDataPoints(chartFilters["water"], defaultWaterData),
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };

  // Solar chart data - dynamic labels and data based on filter
  const defaultSolarLabels = [
    "Jan 01",
    "Jan 02",
    "Jan 03",
    "Jan 04",
    "Jan 05",
    "Jan 06",
    "Jan 07",
  ];
  const defaultSolarData = [12.4, 10.8, 13.6, 14.1, 12.9, 11.7, 13.2];
  const solarChartData = {
    labels: generateDateLabels(chartFilters["solar"], defaultSolarLabels),
    datasets: [
      {
        data: generateDataPoints(chartFilters["solar"], defaultSolarData),
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("AdminDashboard")}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#133E87" />
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>

        <View style={styles.metricsGrid}>
          {metrics.map((m) => (
            <MetricCard
              key={m.id}
              icon={m.icon}
              title={m.title}
              value={m.value}
              subtitle={m.subtitle}
            />
          ))}
        </View>

        {/* Mortality Rate Chart */}
        <View style={{ width: "100%", marginTop: 8 }}>
          {/* Section Header */}
          <Text style={styles.mortalitySectionTitle}>MORTALITY RATE</Text>

          {/* Title and buttons row */}
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Mortality Trend</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-mortality" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-mortality")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("mortality");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-mortality" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-mortality" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-mortality")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setExportStartDate(null);
                  setExportEndDate(null);
                  setExportSelectedDate("");
                  setExportMortalityModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-mortality" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["mortality"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["mortality"])}
              </Text>
            )}
            {LineChartComp
              ? (() => {
                  try {
                    return (
                      <View style={{ position: "relative", width: chartWidth }}>
                        <LineChartComp
                          data={chartData}
                          width={chartWidth}
                          height={chartHeight}
                          chartConfig={{
                            backgroundGradientFrom: "#ffffff",
                            backgroundGradientTo: "#ffffff",
                            decimalPlaces: 0,
                            color: (opacity = 1) =>
                              `rgba(21,71,133, ${opacity})`,
                            labelColor: (opacity = 1) =>
                              `rgba(44, 62, 80, ${opacity})`,
                            propsForDots: {
                              r: "4",
                              strokeWidth: "2",
                              stroke: "#154985",
                            },
                          }}
                          bezier
                          style={{ marginTop: 8 }}
                          withVerticalLines={false}
                          withInnerLines={false}
                          withHorizontalLines={false}
                          fromZero
                          onDataPointClick={(data) => {
                            const point = {
                              index: data.index,
                              value: data.value,
                              label: chartData.labels[data.index],
                              x: data.x,
                              y: data.y,
                            };
                            showPointTooltip(point);
                          }}
                        />

                        {activePoint !== null && (
                          <View
                            pointerEvents="none"
                            style={[
                              styles.tooltipWrapper,
                              {
                                left: Math.max(6, activePoint.x - 1),
                                top: 0,
                                height: chartHeight,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.tooltipVerticalLine,
                                {
                                  top: activePoint.y + 4,
                                  height: chartHeight - activePoint.y - 18,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.tooltipBox,
                                {
                                  position: "absolute",
                                  bottom: chartHeight - activePoint.y + 10,
                                  left: -40,
                                },
                              ]}
                            >
                              <Text style={styles.tooltipLabel}>
                                {activePoint.label}
                              </Text>
                              <Text style={styles.tooltipValue}>
                                Deaths: {activePoint.value}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  } catch (err) {
                    console.warn("Chart render error:", err?.message ?? err);
                    return null;
                  }
                })()
              : null}
          </View>
        </View>

        {/* Cause of Death Pie Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Cause of Death</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-cause" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-cause")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("cause");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-cause" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-cause" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-cause")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => setExportCauseModalVisible(true)}
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-cause" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["cause"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["cause"])}
              </Text>
            )}
            {LineChartComp &&
              (() => {
                try {
                  // eslint-disable-next-line global-require
                  const RN_SVG = require("react-native-svg");
                  const Svg = RN_SVG.Svg || RN_SVG.default?.Svg || RN_SVG;
                  const G = RN_SVG.G || RN_SVG.default?.G;
                  const Path = RN_SVG.Path || RN_SVG.default?.Path;

                  const pieData = causeOfDeathData;

                  // Calculate pie slice paths
                  const total = pieData.reduce(
                    (sum, item) => sum + item.population,
                    0,
                  );

                  // Guard: if no data, show loading/empty state
                  if (total === 0) {
                    return (
                      <View style={styles.fallback}>
                        <Text style={styles.fallbackText}>
                          No data on selected date/s
                        </Text>
                      </View>
                    );
                  }

                  const radius = 100;
                  const cx = 110;
                  const cy = 110;

                  let currentAngle = -90; // Start at top
                  const slices = pieData.map((item, index) => {
                    const percentage = item.population / total;
                    const angle = percentage * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    const midAngle = startAngle + angle / 2;

                    // Convert to radians
                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;
                    const midRad = (midAngle * Math.PI) / 180;

                    // Calculate arc points
                    const x1 = cx + radius * Math.cos(startRad);
                    const y1 = cy + radius * Math.sin(startRad);
                    const x2 = cx + radius * Math.cos(endRad);
                    const y2 = cy + radius * Math.sin(endRad);

                    // Calculate tooltip position (60% of radius from center)
                    const tooltipDistance = radius * 0.6;
                    const tooltipX =
                      cx + tooltipDistance * Math.cos(midRad) - 40; // -40 to center tooltip
                    const tooltipY =
                      cy + tooltipDistance * Math.sin(midRad) - 25; // -25 to center tooltip

                    const largeArcFlag = angle > 180 ? 1 : 0;

                    const pathData = [
                      `M ${cx} ${cy}`,
                      `L ${x1} ${y1}`,
                      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                      "Z",
                    ].join(" ");

                    currentAngle = endAngle;

                    return {
                      ...item,
                      path: pathData,
                      index,
                      tooltipX,
                      tooltipY,
                    };
                  });

                  return (
                    <View
                      style={{
                        width: "100%",
                        paddingVertical: 20,
                        paddingHorizontal: 8,
                      }}
                    >
                      {/* Interactive SVG Pie Chart */}
                      <View style={{ alignItems: "center", marginBottom: 20 }}>
                        <View style={{ position: "relative" }}>
                          <Svg width={220} height={220}>
                            <G>
                              {slices.map((slice, index) => (
                                <Path
                                  key={index}
                                  d={slice.path}
                                  fill={
                                    activePieSlice === index
                                      ? slice.color
                                      : slice.color.replace("1)", "0.8)")
                                  }
                                  stroke="#fff"
                                  strokeWidth={2}
                                  onPress={() => {
                                    setActivePieSlice(index);
                                    setTimeout(
                                      () => setActivePieSlice(null),
                                      3000,
                                    );
                                  }}
                                />
                              ))}
                            </G>
                          </Svg>

                          {/* Tooltip */}
                          {activePieSlice !== null && (
                            <View
                              style={{
                                position: "absolute",
                                top: slices[activePieSlice].tooltipY,
                                left: slices[activePieSlice].tooltipX,
                                backgroundColor: "#fff",
                                padding: 10,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: "#ccc",
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 3.84,
                                elevation: 5,
                                zIndex: 1000,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  color: "#0b2336",
                                }}
                              >
                                {pieData[activePieSlice].name}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: "#133E87",
                                  marginTop: 2,
                                }}
                              >
                                {pieData[activePieSlice].population}%
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Custom Legend - Horizontal (only show when there's data) */}
                      {total > 0 && (
                        <View
                          style={{ paddingHorizontal: 8, alignItems: "center" }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              marginBottom: 8,
                              marginLeft: 35,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                width: 165,
                              }}
                            >
                              <View
                                style={{
                                  width: 14,
                                  height: 14,
                                  backgroundColor: pieData[0].color,
                                  marginRight: 6,
                                  borderRadius: 2,
                                }}
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: "#0b2336",
                                  includeFontPadding: false,
                                  flex: 1,
                                }}
                                allowFontScaling={false}
                                numberOfLines={1}
                              >
                                {pieData[0].name} ({pieData[0].population}%)
                              </Text>
                            </View>
                            <View style={{ width: 16 }} />
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                width: 165,
                              }}
                            >
                              <View
                                style={{
                                  width: 14,
                                  height: 14,
                                  backgroundColor: pieData[1].color,
                                  marginRight: 6,
                                  borderRadius: 2,
                                }}
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: "#0b2336",
                                  includeFontPadding: false,
                                  flex: 1,
                                }}
                                allowFontScaling={false}
                                numberOfLines={1}
                              >
                                {pieData[1].name} ({pieData[1].population}%)
                              </Text>
                            </View>
                          </View>
                          <View
                            style={{ flexDirection: "row", marginLeft: 35 }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                width: 165,
                              }}
                            >
                              <View
                                style={{
                                  width: 14,
                                  height: 14,
                                  backgroundColor: pieData[2].color,
                                  marginRight: 6,
                                  borderRadius: 2,
                                }}
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: "#0b2336",
                                  includeFontPadding: false,
                                  flex: 1,
                                }}
                                allowFontScaling={false}
                                numberOfLines={1}
                              >
                                {pieData[2].name} ({pieData[2].population}%)
                              </Text>
                            </View>
                            <View style={{ width: 16 }} />
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                width: 165,
                              }}
                            >
                              <View
                                style={{
                                  width: 14,
                                  height: 14,
                                  backgroundColor: pieData[3].color,
                                  marginRight: 6,
                                  borderRadius: 2,
                                }}
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: "#0b2336",
                                  includeFontPadding: false,
                                  flex: 1,
                                }}
                                allowFontScaling={false}
                                numberOfLines={1}
                              >
                                {pieData[3].name} ({pieData[3].population}%)
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                } catch (err) {
                  console.warn("Pie chart render error:", err?.message ?? err);
                  return (
                    <View style={styles.fallback}>
                      <Text style={styles.fallbackText}>Chart unavailable</Text>
                      <Text style={styles.fallbackTextSmall}>
                        Install react-native-chart-kit and react-native-svg
                      </Text>
                    </View>
                  );
                }
              })()}
          </View>
        </View>

        {/* Mortality per Batch Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Mortality per Batch</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-mortalitybatch" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-mortalitybatch")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("mortalitybatch");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-mortalitybatch" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-mortalitybatch" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-mortalitybatch")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-mortalitybatch" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["mortalitybatch"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["mortalitybatch"])}
              </Text>
            )}
            <MortalityBatchChart height={220} />
          </View>
        </View>

        {/* Predator Attacks Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <Text style={styles.mortalitySectionTitle}>PREDATORS ATTACK</Text>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Frequency of Attacks</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-predator" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-predator")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("predator");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-predator" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-predator" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-predator")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-predator" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["predator"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["predator"])}
              </Text>
            )}
            {LineChartComp && (
              <View style={{ position: "relative", width: chartWidth }}>
                <LineChartComp
                  data={predatorChartData}
                  width={chartWidth}
                  height={chartHeight}
                  chartConfig={{
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: "#154985",
                    },
                  }}
                  bezier
                  style={{ marginTop: 8 }}
                  withVerticalLines={false}
                  withInnerLines={false}
                  withHorizontalLines={false}
                  fromZero
                  onDataPointClick={(data) => {
                    const point = {
                      index: data.index,
                      value: data.value,
                      label: predatorChartData.labels[data.index],
                      x: data.x,
                      y: data.y,
                    };
                    showPointTooltipPredator(point);
                  }}
                />

                {activePointPredator !== null && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tooltipWrapper,
                      {
                        left: Math.max(6, activePointPredator.x - 1),
                        top: 0,
                        height: chartHeight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.tooltipVerticalLine,
                        {
                          top: activePointPredator.y + 4,
                          height: chartHeight - activePointPredator.y - 18,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.tooltipBox,
                        {
                          position: "absolute",
                          bottom: chartHeight - activePointPredator.y + 10,
                          left: -40,
                        },
                      ]}
                    >
                      <Text style={styles.tooltipLabel}>
                        {activePointPredator.label}
                      </Text>
                      <Text style={styles.tooltipValue}>
                        Attacks: {activePointPredator.value}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Attacks per Batch Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Attacks per Batch</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-attacksbatch" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-attacksbatch")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("attacksbatch");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-attacksbatch" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-attacksbatch" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-attacksbatch")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-attacksbatch" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["attacksbatch"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["attacksbatch"])}
              </Text>
            )}
            <AttacksBatchChart height={220} />
          </View>
        </View>

        {/* Predator Types Pie Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Predator Types</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-predatortypes" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-predatortypes")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("predatortypes");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-predatortypes" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-predatortypes" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-predatortypes")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-predatortypes" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["predatortypes"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["predatortypes"])}
              </Text>
            )}
            {LineChartComp &&
              (() => {
                try {
                  // eslint-disable-next-line global-require
                  const RN_SVG = require("react-native-svg");
                  const Svg = RN_SVG.Svg || RN_SVG.default?.Svg || RN_SVG;
                  const G = RN_SVG.G || RN_SVG.default?.G;
                  const Path = RN_SVG.Path || RN_SVG.default?.Path;

                  const predatorTypesData = [
                    {
                      name: "Dog",
                      population: 40,
                      color: "#154785",
                    },
                    {
                      name: "Cat",
                      population: 25,
                      color: "#FFC107",
                    },
                    {
                      name: "Snake",
                      population: 20,
                      color: "#F44336",
                    },
                    {
                      name: "Rat",
                      population: 10,
                      color: "#4CAF50",
                    },
                    {
                      name: "Other",
                      population: 5,
                      color: "#E91E63",
                    },
                  ];

                  // Calculate pie slice paths
                  const total = predatorTypesData.reduce(
                    (sum, item) => sum + item.population,
                    0,
                  );
                  const radius = 100;
                  const cx = 110;
                  const cy = 110;

                  let currentAngle = -90; // Start at top
                  const slices = predatorTypesData.map((item, index) => {
                    const percentage = item.population / total;
                    const angle = percentage * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    const midAngle = startAngle + angle / 2;

                    // Convert to radians
                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;
                    const midRad = (midAngle * Math.PI) / 180;

                    // Calculate arc points
                    const x1 = cx + radius * Math.cos(startRad);
                    const y1 = cy + radius * Math.sin(startRad);
                    const x2 = cx + radius * Math.cos(endRad);
                    const y2 = cy + radius * Math.sin(endRad);

                    // Calculate tooltip position (60% of radius from center)
                    const tooltipDistance = radius * 0.6;
                    const tooltipX =
                      cx + tooltipDistance * Math.cos(midRad) - 40; // -40 to center tooltip
                    const tooltipY =
                      cy + tooltipDistance * Math.sin(midRad) - 25; // -25 to center tooltip

                    const largeArcFlag = angle > 180 ? 1 : 0;

                    const pathData = [
                      `M ${cx} ${cy}`,
                      `L ${x1} ${y1}`,
                      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                      "Z",
                    ].join(" ");

                    currentAngle = endAngle;

                    return {
                      ...item,
                      path: pathData,
                      index,
                      tooltipX,
                      tooltipY,
                    };
                  });

                  return (
                    <View
                      style={{
                        width: "100%",
                        paddingVertical: 20,
                        paddingHorizontal: 8,
                      }}
                    >
                      {/* Interactive SVG Pie Chart */}
                      <View style={{ alignItems: "center", marginBottom: 20 }}>
                        <View style={{ position: "relative" }}>
                          <Svg width={220} height={220}>
                            <G>
                              {slices.map((slice, index) => (
                                <Path
                                  key={index}
                                  d={slice.path}
                                  fill={
                                    activePieSlicePredator === index
                                      ? slice.color
                                      : slice.color.replace("1)", "0.8)")
                                  }
                                  stroke="#fff"
                                  strokeWidth={2}
                                  onPress={() => {
                                    setActivePieSlicePredator(index);
                                    setTimeout(
                                      () => setActivePieSlicePredator(null),
                                      3000,
                                    );
                                  }}
                                />
                              ))}
                            </G>
                          </Svg>

                          {/* Tooltip */}
                          {activePieSlicePredator !== null && (
                            <View
                              style={{
                                position: "absolute",
                                top: slices[activePieSlicePredator].tooltipY,
                                left: slices[activePieSlicePredator].tooltipX,
                                backgroundColor: "#fff",
                                padding: 10,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: "#ccc",
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 3.84,
                                elevation: 5,
                                zIndex: 1000,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  color: "#0b2336",
                                }}
                              >
                                {predatorTypesData[activePieSlicePredator].name}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: "#133E87",
                                  marginTop: 2,
                                }}
                              >
                                {
                                  predatorTypesData[activePieSlicePredator]
                                    .population
                                }
                                %
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Custom Legend - Horizontal */}
                      <View
                        style={{ paddingHorizontal: 4, alignItems: "center" }}
                      >
                        <View style={{ flexDirection: "row", marginBottom: 8 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 100,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: predatorTypesData[0].color,
                                marginRight: 4,
                                borderRadius: 2,
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#0b2336",
                                includeFontPadding: false,
                                flex: 1,
                              }}
                              allowFontScaling={false}
                              numberOfLines={1}
                            >
                              {predatorTypesData[0].name} (
                              {predatorTypesData[0].population}%)
                            </Text>
                          </View>
                          <View style={{ width: 6 }} />
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 100,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: predatorTypesData[1].color,
                                marginRight: 4,
                                borderRadius: 2,
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#0b2336",
                                includeFontPadding: false,
                                flex: 1,
                              }}
                              allowFontScaling={false}
                              numberOfLines={1}
                            >
                              {predatorTypesData[1].name} (
                              {predatorTypesData[1].population}%)
                            </Text>
                          </View>
                          <View style={{ width: 6 }} />
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 100,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: predatorTypesData[2].color,
                                marginRight: 4,
                                borderRadius: 2,
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#0b2336",
                                includeFontPadding: false,
                                flex: 1,
                              }}
                              allowFontScaling={false}
                              numberOfLines={1}
                            >
                              {predatorTypesData[2].name} (
                              {predatorTypesData[2].population}%)
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "flex-start",
                            width: 312,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 100,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: predatorTypesData[3].color,
                                marginRight: 4,
                                borderRadius: 2,
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#0b2336",
                                includeFontPadding: false,
                                flex: 1,
                              }}
                              allowFontScaling={false}
                              numberOfLines={1}
                            >
                              {predatorTypesData[3].name} (
                              {predatorTypesData[3].population}%)
                            </Text>
                          </View>
                          <View style={{ width: 6 }} />
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 100,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: predatorTypesData[4].color,
                                marginRight: 4,
                                borderRadius: 2,
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#0b2336",
                                includeFontPadding: false,
                                flex: 1,
                              }}
                              allowFontScaling={false}
                              numberOfLines={1}
                            >
                              {predatorTypesData[4].name} (
                              {predatorTypesData[4].population}%)
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                } catch (err) {
                  console.warn("Pie chart render error:", err?.message ?? err);
                  return (
                    <View style={styles.fallback}>
                      <Text style={styles.fallbackText}>Chart unavailable</Text>
                      <Text style={styles.fallbackTextSmall}>
                        Install react-native-chart-kit and react-native-svg
                      </Text>
                    </View>
                  );
                }
              })()}
          </View>
        </View>

        {/* Feed Consumption Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <Text style={styles.mortalitySectionTitle}>FEED CONSUMPTION</Text>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Consumption vs Age</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-feed" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-feed")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("feed");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-feed" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-feed" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-feed")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-feed" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["feed"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["feed"])}
              </Text>
            )}
            {LineChartComp && (
              <View style={{ position: "relative", width: chartWidth }}>
                <LineChartComp
                  data={feedChartData}
                  width={chartWidth}
                  height={chartHeight}
                  chartConfig={{
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: "#154985",
                    },
                  }}
                  bezier
                  style={{ marginTop: 8 }}
                  withVerticalLines={false}
                  withInnerLines={false}
                  withHorizontalLines={false}
                  fromZero
                  onDataPointClick={(data) => {
                    const point = {
                      index: data.index,
                      value: data.value,
                      label: feedChartData.labels[data.index],
                      x: data.x,
                      y: data.y,
                    };
                    showPointTooltipFeed(point);
                  }}
                />

                {activePointFeed !== null && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tooltipWrapper,
                      {
                        left: Math.max(6, activePointFeed.x - 1),
                        top: 0,
                        height: chartHeight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.tooltipVerticalLine,
                        {
                          top: activePointFeed.y + 4,
                          height: chartHeight - activePointFeed.y - 18,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.tooltipBox,
                        {
                          position: "absolute",
                          bottom: chartHeight - activePointFeed.y + 10,
                          left: -40,
                        },
                      ]}
                    >
                      <Text style={styles.tooltipLabel}>
                        {activePointFeed.label}
                      </Text>
                      <Text style={styles.tooltipValue}>
                        Activations: {activePointFeed.value}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Total Feed per Batch Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Total Feed per Batch</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-feedbatch" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-feedbatch")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("feedbatch");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-feedbatch" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-feedbatch" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-feedbatch")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-feedbatch" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["feedbatch"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["feedbatch"])}
              </Text>
            )}
            <FeedBatchChart height={220} />
          </View>
        </View>

        {/* Water Consumption Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <Text style={styles.mortalitySectionTitle}>WATER CONSUMPTION</Text>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Water vs Age</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-water" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-water")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("water");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-water" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-water" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-water")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-water" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["water"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["water"])}
              </Text>
            )}
            {LineChartComp && (
              <View style={{ position: "relative", width: chartWidth }}>
                <LineChartComp
                  data={waterChartData}
                  width={chartWidth}
                  height={chartHeight}
                  chartConfig={{
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: "#154985",
                    },
                  }}
                  bezier
                  style={{ marginTop: 8 }}
                  withVerticalLines={false}
                  withInnerLines={false}
                  withHorizontalLines={false}
                  fromZero
                  onDataPointClick={(data) => {
                    const point = {
                      index: data.index,
                      value: data.value,
                      label: waterChartData.labels[data.index],
                      x: data.x,
                      y: data.y,
                    };
                    showPointTooltipWater(point);
                  }}
                />

                {activePointWater !== null && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tooltipWrapper,
                      {
                        left: Math.max(6, activePointWater.x - 1),
                        top: 0,
                        height: chartHeight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.tooltipVerticalLine,
                        {
                          top: activePointWater.y + 4,
                          height: chartHeight - activePointWater.y - 18,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.tooltipBox,
                        {
                          position: "absolute",
                          bottom: chartHeight - activePointWater.y + 10,
                          left: -40,
                        },
                      ]}
                    >
                      <Text style={styles.tooltipLabel}>
                        {activePointWater.label}
                      </Text>
                      <Text style={styles.tooltipValue}>
                        Activations: {activePointWater.value}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Total Water per Batch Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Total Water per Batch</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-waterbatch" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-waterbatch")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("waterbatch");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-waterbatch" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-waterbatch" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-waterbatch")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-waterbatch" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["waterbatch"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["waterbatch"])}
              </Text>
            )}
            <WaterBatchChart height={220} />
          </View>
        </View>

        {/* Solar Power Usage Chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <Text style={styles.mortalitySectionTitle}>SOLAR POWER USAGE</Text>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitleOutside}>Energy Trends</Text>
            <View style={styles.chartButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.chartFilterButton,
                  pressedBtn === "filter-solar" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("filter-solar")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  setCurrentFilterTarget("solar");
                  setFilterModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.chartFilterText,
                    pressedBtn === "filter-solar" && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chartExportButton,
                  pressedBtn === "export-solar" && {
                    backgroundColor: "#133E87",
                    borderColor: "#133E87",
                  },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-solar")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() =>
                  Alert.alert(
                    "Export",
                    "Export functionality to be implemented",
                  )
                }
              >
                <Text
                  style={[
                    styles.chartExportText,
                    pressedBtn === "export-solar" && { color: "#fff" },
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartCard}>
            {chartFilters["solar"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                {formatFilterDisplay(chartFilters["solar"])}
              </Text>
            )}
            {LineChartComp && (
              <View style={{ position: "relative", width: chartWidth }}>
                <LineChartComp
                  data={solarChartData}
                  width={chartWidth}
                  height={chartHeight}
                  chartConfig={{
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: "#154985",
                    },
                  }}
                  bezier
                  style={{ marginTop: 8 }}
                  withVerticalLines={false}
                  withInnerLines={false}
                  withHorizontalLines={false}
                  fromZero
                  onDataPointClick={(data) => {
                    const point = {
                      index: data.index,
                      value: data.value,
                      label: solarChartData.labels[data.index],
                      x: data.x,
                      y: data.y,
                    };
                    showPointTooltipSolar(point);
                  }}
                />

                {activePointSolar !== null && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tooltipWrapper,
                      {
                        left: Math.max(6, activePointSolar.x - 1),
                        top: 0,
                        height: chartHeight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.tooltipVerticalLine,
                        {
                          top: activePointSolar.y + 4,
                          height: chartHeight - activePointSolar.y - 18,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.tooltipBox,
                        {
                          position: "absolute",
                          bottom: chartHeight - activePointSolar.y + 10,
                          left: -40,
                        },
                      ]}
                    >
                      <Text style={styles.tooltipLabel}>
                        {activePointSolar.label}
                      </Text>
                      <Text style={styles.tooltipValue}>
                        Energy: {activePointSolar.value} kWh
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Filter Modal */}
        <Modal
          visible={filterModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {/* Date Range Display */}
              <View style={styles.dateRangeHeader}>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>From</Text>
                  <Text style={styles.dateRangeValue}>
                    {startDate
                      ? new Date(startDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })
                      : "Select date"}
                  </Text>
                </View>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>To</Text>
                  <Text style={styles.dateRangeValue}>
                    {endDate
                      ? new Date(endDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })
                      : "Select date"}
                  </Text>
                </View>
              </View>

              {/* Date Picker */}
              <View style={styles.datePickerContainer}>
                <Calendar
                  onDayPress={(day) => {
                    const selectedDateStr = day.dateString;

                    // Parse date string in local time (not UTC)
                    const [year, month, day_num] = selectedDateStr
                      .split("-")
                      .map(Number);
                    const selectedDate = new Date(year, month - 1, day_num);

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // Validate: Do not allow future dates
                    if (selectedDate > today) {
                      Alert.alert(
                        "Invalid Date",
                        "Future dates are not allowed. Please select today or an earlier date.",
                        [{ text: "OK" }],
                      );
                      return;
                    }

                    if (!startDate || (startDate && endDate)) {
                      // Start new selection
                      setStartDate(selectedDateStr);
                      setEndDate(null);
                    } else if (startDate && !endDate) {
                      // Set end date
                      if (new Date(selectedDateStr) < new Date(startDate)) {
                        // If selected date is before start, swap them
                        setEndDate(startDate);
                        setStartDate(selectedDateStr);
                      } else {
                        setEndDate(selectedDateStr);
                      }
                    }
                  }}
                  markingType={"period"}
                  maxDate={(() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, "0");
                    const day = String(today.getDate()).padStart(2, "0");
                    return `${year}-${month}-${day}`;
                  })()}
                  markedDates={(() => {
                    if (!startDate) return {};

                    if (startDate && !endDate) {
                      return {
                        [startDate]: {
                          startingDay: true,
                          color: "#3B82F6",
                          textColor: "white",
                        },
                      };
                    }

                    if (startDate && endDate) {
                      const marks = {};
                      const start = new Date(startDate);
                      const end = new Date(endDate);

                      // Mark all dates in the range
                      for (
                        let d = new Date(start);
                        d <= end;
                        d.setDate(d.getDate() + 1)
                      ) {
                        const dateStr = d.toISOString().split("T")[0];

                        if (dateStr === startDate) {
                          marks[dateStr] = {
                            startingDay: true,
                            color: "#BFDBFE",
                            textColor: "#000",
                          };
                        } else if (dateStr === endDate) {
                          marks[dateStr] = {
                            endingDay: true,
                            color: "#BFDBFE",
                            textColor: "#000",
                          };
                        } else {
                          marks[dateStr] = {
                            color: "#BFDBFE",
                            textColor: "#000",
                          };
                        }
                      }

                      // Override start and end with circular highlights
                      marks[startDate] = {
                        ...marks[startDate],
                        startingDay: true,
                        color: "#BFDBFE",
                        textColor: "white",
                        marked: true,
                        dotColor: "white",
                        customStyles: {
                          container: {
                            backgroundColor: "#3B82F6",
                            borderRadius: 100,
                          },
                          text: {
                            color: "white",
                            fontWeight: "bold",
                          },
                        },
                      };

                      marks[endDate] = {
                        ...marks[endDate],
                        endingDay: true,
                        color: "#BFDBFE",
                        textColor: "white",
                        marked: true,
                        dotColor: "white",
                        customStyles: {
                          container: {
                            backgroundColor: "#3B82F6",
                            borderRadius: 100,
                          },
                          text: {
                            color: "white",
                            fontWeight: "bold",
                          },
                        },
                      };

                      return marks;
                    }

                    return {};
                  })()}
                  theme={{
                    calendarBackground: "#ffffff",
                    textSectionTitleColor: "#3B82F6",
                    selectedDayBackgroundColor: "#3B82F6",
                    selectedDayTextColor: "#ffffff",
                    todayTextColor: "#3B82F6",
                    dayTextColor: "#2d4150",
                    textDisabledColor: "#d9e1e8",
                    monthTextColor: "#2d4150",
                    indicatorColor: "#3B82F6",
                    textDayFontWeight: "400",
                    textMonthFontWeight: "600",
                    textDayHeaderFontWeight: "500",
                    textDayFontSize: 14,
                    textMonthFontSize: 18,
                    textDayHeaderFontSize: 12,
                    "stylesheet.calendar.header": {
                      week: {
                        marginTop: 5,
                        flexDirection: "row",
                        justifyContent: "space-between",
                      },
                    },
                  }}
                  style={styles.calendar}
                />
              </View>

              {/* Apply and Cancel Buttons */}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.modalCancelButton]}
                  onPress={() => {
                    setStartDate(null);
                    setEndDate(null);
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionButton, styles.modalApplyButton]}
                  onPress={() => {
                    if (currentFilterTarget && startDate && endDate) {
                      // Save filter settings for this chart
                      setChartFilters((prev) => ({
                        ...prev,
                        [currentFilterTarget]: { startDate, endDate },
                      }));

                      // Existing logic for Predator Chart time range state
                      if (currentFilterTarget === "predator") {
                        setPredatorTimeRange("daily");
                      }
                    }
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={styles.modalApplyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Export Mortality Modal */}
        <Modal
          visible={exportMortalityModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setExportMortalityModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Export Mortality Report</Text>

              {/* Date Range Display */}
              <View style={styles.dateRangeHeader}>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>From</Text>
                  <Text style={styles.dateRangeValue}>
                    {exportStartDate
                      ? new Date(exportStartDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })
                      : "Select date"}
                  </Text>
                </View>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>To</Text>
                  <Text style={styles.dateRangeValue}>
                    {exportEndDate
                      ? new Date(exportEndDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })
                      : "Select date"}
                  </Text>
                </View>
              </View>

              {/* Date Picker */}
              <View style={styles.datePickerContainer}>
                <Calendar
                  onDayPress={(day) => {
                    const selectedDateStr = day.dateString;
                    const [year, month, day_num] = selectedDateStr
                      .split("-")
                      .map(Number);
                    const selectedDate = new Date(year, month - 1, day_num);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // Validate: Do not allow future dates
                    if (selectedDate > today) {
                      Alert.alert(
                        "Invalid Date",
                        "Future dates are not allowed. Please select today or an earlier date.",
                        [{ text: "OK" }],
                      );
                      return;
                    }

                    if (
                      !exportStartDate ||
                      (exportStartDate && exportEndDate)
                    ) {
                      // Start new selection
                      setExportStartDate(selectedDateStr);
                      setExportEndDate(null);
                    } else if (exportStartDate && !exportEndDate) {
                      // Calculate the difference in days
                      const start = new Date(exportStartDate);
                      const selected = new Date(selectedDateStr);
                      const diffTime = Math.abs(selected - start);
                      const diffDays = Math.ceil(
                        diffTime / (1000 * 60 * 60 * 24),
                      );

                      // Check if the range exceeds 30 days for export
                      if (diffDays > 29) {
                        Alert.alert(
                          "Invalid Range",
                          "Please select a date range within 30 days.",
                          [{ text: "OK" }],
                        );
                        return;
                      }

                      // Set end date
                      if (
                        new Date(selectedDateStr) < new Date(exportStartDate)
                      ) {
                        setExportEndDate(exportStartDate);
                        setExportStartDate(selectedDateStr);
                      } else {
                        setExportEndDate(selectedDateStr);
                      }
                    }
                  }}
                  markingType={"period"}
                  maxDate={(() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, "0");
                    const day = String(today.getDate()).padStart(2, "0");
                    return `${year}-${month}-${day}`;
                  })()}
                  markedDates={(() => {
                    if (!exportStartDate) return {};

                    if (exportStartDate && !exportEndDate) {
                      return {
                        [exportStartDate]: {
                          startingDay: true,
                          color: "#3B82F6",
                          textColor: "white",
                        },
                      };
                    }

                    if (exportStartDate && exportEndDate) {
                      const marks = {};
                      const start = new Date(exportStartDate);
                      const end = new Date(exportEndDate);

                      for (
                        let d = new Date(start);
                        d <= end;
                        d.setDate(d.getDate() + 1)
                      ) {
                        const dateStr = d.toISOString().split("T")[0];

                        if (dateStr === exportStartDate) {
                          marks[dateStr] = {
                            startingDay: true,
                            color: "#BFDBFE",
                            textColor: "#000",
                          };
                        } else if (dateStr === exportEndDate) {
                          marks[dateStr] = {
                            endingDay: true,
                            color: "#BFDBFE",
                            textColor: "#000",
                          };
                        } else {
                          marks[dateStr] = {
                            color: "#BFDBFE",
                            textColor: "#000",
                          };
                        }
                      }

                      marks[exportStartDate] = {
                        ...marks[exportStartDate],
                        startingDay: true,
                        color: "#BFDBFE",
                        textColor: "white",
                        marked: true,
                        dotColor: "white",
                        customStyles: {
                          container: {
                            backgroundColor: "#3B82F6",
                            borderRadius: 100,
                          },
                          text: {
                            color: "white",
                            fontWeight: "bold",
                          },
                        },
                      };

                      marks[exportEndDate] = {
                        ...marks[exportEndDate],
                        endingDay: true,
                        color: "#BFDBFE",
                        textColor: "white",
                        marked: true,
                        dotColor: "white",
                        customStyles: {
                          container: {
                            backgroundColor: "#3B82F6",
                            borderRadius: 100,
                          },
                          text: {
                            color: "white",
                            fontWeight: "bold",
                          },
                        },
                      };

                      return marks;
                    }

                    return {};
                  })()}
                  theme={{
                    calendarBackground: "#ffffff",
                    textSectionTitleColor: "#3B82F6",
                    selectedDayBackgroundColor: "#3B82F6",
                    selectedDayTextColor: "#ffffff",
                    todayTextColor: "#3B82F6",
                    dayTextColor: "#2d4150",
                    textDisabledColor: "#d9e1e8",
                    monthTextColor: "#2d4150",
                    indicatorColor: "#3B82F6",
                    textDayFontWeight: "400",
                    textMonthFontWeight: "600",
                    textDayHeaderFontWeight: "500",
                    textDayFontSize: 14,
                    textMonthFontSize: 18,
                    textDayHeaderFontSize: 12,
                  }}
                  style={styles.calendar}
                />
              </View>

              {/* Generate and Cancel Buttons */}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.modalCancelButton]}
                  onPress={() => {
                    setExportStartDate(null);
                    setExportEndDate(null);
                    setExportMortalityModalVisible(false);
                  }}
                  disabled={isGeneratingReport}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    styles.modalApplyButton,
                    !exportStartDate || !exportEndDate || isGeneratingReport
                      ? { opacity: 0.5 }
                      : {},
                  ]}
                  onPress={generateMortalityReportPDF}
                  disabled={
                    !exportStartDate || !exportEndDate || isGeneratingReport
                  }
                >
                  {isGeneratingReport ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalApplyButtonText}>Generate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Cause of Death Export Modal */}
        <Modal
          visible={exportCauseModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setExportCauseModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Export Cause of Death Report
              </Text>

              {/* Line 4 omitted */}
              <View style={styles.dateRangeHeader}>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>From</Text>
                  <Text style={styles.dateRangeValue}>
                    {causeExportStartDate
                      ? new Date(causeExportStartDate).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          },
                        )
                      : "Select date"}
                  </Text>
                </View>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>To</Text>
                  <Text style={styles.dateRangeValue}>
                    {causeExportEndDate
                      ? new Date(causeExportEndDate).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          },
                        )
                      : "Select date"}
                  </Text>
                </View>
              </View>

              {/* Line 4 omitted */}
              <View style={styles.datePickerContainer}>
                <Calendar
                  onDayPress={(day) => {
                    let dateStr = day?.dateString;
                    // Fallback: construct dateString from year, month, day if not available
                    if (!dateStr && day?.year && day?.month && day?.day) {
                      const yearStr = day.year;
                      const monthStr = String(day.month).padStart(2, "0");
                      const dayStr = String(day.day).padStart(2, "0");
                      dateStr = `${yearStr}-${monthStr}-${dayStr}`;
                    }
                    if (!dateStr) {
                      console.log("Invalid day object:", day);
                      return;
                    }
                    if (!causeExportStartDate || causeExportEndDate) {
                      setCauseExportStartDate(dateStr);
                      setCauseExportEndDate(null);
                    } else {
                      const start = new Date(causeExportStartDate);
                      const selected = new Date(dateStr);
                      if (selected < start) {
                        setCauseExportStartDate(dateStr);
                      } else {
                        setCauseExportEndDate(dateStr);
                      }
                    }
                  }}
                  markingType={"period"}
                  maxDate={(() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, "0");
                    const day = String(today.getDate()).padStart(2, "0");
                    return `${year}-${month}-${day}`;
                  })()}
                  markedDates={(() => {
                    const marked = {};
                    if (causeExportStartDate) {
                      marked[causeExportStartDate] = {
                        startingDay: true,
                        color: "#3B82F6",
                        textColor: "#fff",
                      };
                    }
                    if (causeExportEndDate) {
                      marked[causeExportEndDate] = {
                        endingDay: true,
                        color: "#3B82F6",
                        textColor: "#fff",
                      };
                    }
                    if (causeExportStartDate && causeExportEndDate) {
                      const start = new Date(causeExportStartDate);
                      const end = new Date(causeExportEndDate);
                      const current = new Date(start);
                      while (current < end) {
                        const dateStr = current.toISOString().split("T")[0];
                        marked[dateStr] = {
                          color: "#3B82F6",
                          textColor: "#fff",
                        };
                        current.setDate(current.getDate() + 1);
                      }
                    }
                    return marked;
                  })()}
                  theme={{
                    calendarBackground: "#ffffff",
                    textSectionTitleColor: "#3B82F6",
                    selectedDayBackgroundColor: "#3B82F6",
                    selectedDayTextColor: "#ffffff",
                    todayTextColor: "#3B82F6",
                    dayTextColor: "#2d4150",
                    textDisabledColor: "#d9e1e8",
                    monthTextColor: "#2d4150",
                    indicatorColor: "#3B82F6",
                    textDayFontWeight: "400",
                    textMonthFontWeight: "600",
                    textDayHeaderFontWeight: "500",
                    textDayFontSize: 14,
                    textMonthFontSize: 18,
                    textDayHeaderFontSize: 12,
                  }}
                  style={styles.calendar}
                />
              </View>

              {/* Line 4 omitted */}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.modalCancelButton]}
                  onPress={() => {
                    setCauseExportStartDate(null);
                    setCauseExportEndDate(null);
                    setExportCauseModalVisible(false);
                  }}
                  disabled={isGeneratingCauseReport}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    styles.modalApplyButton,
                    !causeExportStartDate ||
                    !causeExportEndDate ||
                    isGeneratingCauseReport
                      ? { opacity: 0.5 }
                      : {},
                  ]}
                  onPress={generateCauseOfDeathReportPDF}
                  disabled={
                    !causeExportStartDate ||
                    !causeExportEndDate ||
                    isGeneratingCauseReport
                  }
                >
                  {isGeneratingCauseReport ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalApplyButtonText}>Generate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- GroupedBarChart -------------------- */
/* Side-by-side bars (login first, activity second), centered tooltip above the day column */
function GroupedBarChart({ data = [], height = 180 }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [active, setActive] = useState(null); // { index, centerRelative, top }
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const totalSlots = data.length;

  const yAxisWidth = 34;
  const outerPadding = 12;
  const loginsColor = "#133E87";
  const actionsColor = "#000";

  // nice max for y-axis
  const rawMax = Math.max(...data.map((d) => Math.max(d.actions, d.logins)), 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  let niceMax = Math.ceil(rawMax / magnitude) * magnitude;
  if (niceMax / 2 >= rawMax) niceMax = niceMax / 2;
  const finalMax = niceMax;
  const ticks = 5;

  const onBarPress = (index, val) => {
    if (!layoutWidth) return;
    const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
    const columnWidth = innerWidth / totalSlots;
    const centerRelative = index * columnWidth + columnWidth / 2;
    const barTop = height - (val / finalMax) * height;
    const tooltipTop = Math.max(6, barTop - 60);
    setActive({ index, centerRelative, top: tooltipTop });
    setTimeout(() => setActive(null), 2400);
  };

  return (
    <View
      style={{ width: "100%", paddingHorizontal: outerPadding, paddingTop: 8 }}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ height }} />

      {layoutWidth > 0 && (
        <View
          style={{
            position: "absolute",
            top: 8,
            left: outerPadding,
            right: outerPadding,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* Y axis */}
            <View style={{ width: yAxisWidth, height }}>
              {Array.from({ length: ticks }).map((_, i) => {
                const ratio = i / (ticks - 1);
                const value = Math.round((1 - ratio) * finalMax);
                const topPos = ratio * height - 8;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top: Math.max(0, topPos),
                      left: 0,
                      right: 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#333",
                        textAlign: "right",
                        paddingRight: 6,
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Chart area */}
            <View style={{ flex: 1, height, position: "relative" }}>
              {/* gridlines */}
              {Array.from({ length: ticks }).map((_, i) => {
                const top = (i / (ticks - 1)) * height;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: "#eee",
                    }}
                  />
                );
              })}

              {/* bars */}
              <View
                style={{
                  flexDirection: "row",
                  width: "100%",
                  height,
                  justifyContent: "space-between",
                }}
              >
                {(() => {
                  const innerWidth =
                    layoutWidth - yAxisWidth - outerPadding * 2;
                  const barWidth = Math.min(
                    48,
                    (innerWidth / totalSlots) * 0.7,
                  );
                  const spacing = innerWidth / totalSlots;
                  const minBarHeight = 8;

                  return data.map((d, i) => {
                    const loginsHeight = Math.round(
                      (d.logins / finalMax) * height,
                    );

                    return (
                      <View
                        key={i}
                        style={{ width: spacing, alignItems: "center" }}
                      >
                        <View
                          style={{
                            height,
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          <View
                            style={{
                              width: barWidth,
                              height: loginsHeight,
                              backgroundColor: loginsColor,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                            }}
                          />
                          <View
                            style={{
                              width: barWidth,
                              height: actionsHeight,
                              backgroundColor: actionsColor,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                            }}
                          />
                        </View>

                        {/* label */}
                        <View
                          style={{
                            width: spacing,
                            alignItems: "center",
                            marginTop: 6,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{ fontSize: 12 }}
                          >
                            {d.label}
                          </Text>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>

              {/* tooltip centered */}
              {active !== null && (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height,
                    zIndex: 30,
                    pointerEvents: "none",
                  }}
                >
                  <CenteredTooltip
                    active={active}
                    layoutWidth={layoutWidth}
                    yAxisWidth={44}
                    outerPadding={12}
                    tooltipWidth={tooltipWidth}
                    setTooltipWidth={setTooltipWidth}
                    maxTooltipWidth={200}
                    height={height}
                    data={data}
                    loginsColor={"#154985"}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* Centered tooltip helper */
function CenteredTooltip({
  active,
  layoutWidth,
  yAxisWidth,
  outerPadding,
  tooltipWidth,
  setTooltipWidth,
  maxTooltipWidth,
  height,
  data,
  loginsColor,
}) {
  const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
  const centerRelative = active.centerRelative;

  const desiredLeft = centerRelative - (tooltipWidth || maxTooltipWidth) / 2;
  const minLeft = 6;
  const maxLeft = Math.max(
    6,
    innerWidth - (tooltipWidth || maxTooltipWidth) - 6,
  );
  const leftClamped = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
  const topPos = Math.max(6, active.top - 54);

  return (
    <View
      style={{
        position: "absolute",
        left: yAxisWidth,
        top: topPos,
        width: innerWidth,
      }}
    >
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== tooltipWidth) setTooltipWidth(w);
        }}
        style={{
          position: "absolute",
          left: leftClamped,
          backgroundColor: "#fff",
          paddingVertical: 6,
          paddingHorizontal: 8,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#ccc",
          alignItems: "flex-start",
          maxWidth: maxTooltipWidth,
        }}
      >
        <Text style={{ fontWeight: "700" }}>{data[active.index].label}</Text>
        <Text style={{ marginTop: 6 }}>
          Actions: {data[active.index].actions}
        </Text>
        <Text style={{ color: loginsColor, fontWeight: "700" }}>
          Logins: {data[active.index].logins}
        </Text>
      </View>
    </View>
  );
}

/* -------------------- ReportsTab -------------------- */
/* Shows generated views for System Overview, User Engagement, Performance Report */
function ReportsTab({ barData = [], metrics = [] }) {
  const [selected, setSelected] = useState(null); // null or title
  const [generatedAt, setGeneratedAt] = useState(null);
  const [pressedBtn, setPressedBtn] = useState(null); // <-- Add this state
  const [pressedTab, setPressedTab] = useState(null); // Add this state

  // warm demo values derived from props
  const totalUsers = metrics?.[0]?.value ?? 0;
  const activeUsers = metrics?.[1]?.value ?? 0;
  const totalLogins = barData.reduce((s, r) => s + (r.logins || 0), 0);
  const totalActions = barData.reduce((s, r) => s + (r.actions || 0), 0);

  // Demo values for engagement
  const newUsersDemo = 3;
  const inactiveUsers = Math.max(0, totalUsers - activeUsers - newUsersDemo);
  const avgLoginsPerUser =
    totalUsers > 0 ? (totalLogins / totalUsers).toFixed(1) : "0.0";

  // Performance demo values (you can replace with live metrics)
  const uptime = "99.8%";
  const avgResponseTime = "120ms";
  const peakUsage = "2:00 - 4:00 PM";
  const errorRate = "0.2%";

  const items = [
    {
      id: "system",
      title: "System Overview",
      desc: "Complete system usage and performance metrics",
    },
    {
      id: "engagement",
      title: "User Engagement",
      desc: "User activity and engagement analysis",
    },
    {
      id: "performance",
      title: "Performance Report",
      desc: "System Performance and uptime statistics",
    },
  ];

  const handleGenerate = (title) => {
    setSelected(title);
    setGeneratedAt(new Date());
  };

  const handleExportPdf = () => {
    Alert.alert("Export PDF", "PDF export is not implemented in this demo.");
  };

  const handleExportCsv = () => {
    Alert.alert("Export CSV", "CSV export is not implemented in this demo.");
  };

  const handleGenerateAnother = () => {
    setSelected(null);
    setGeneratedAt(null);
  };

  return (
    <View style={styles.reportsWrapper}>
      <View style={styles.reportsHeader}>
        <View style={{ marginRight: 8 }}>
          {/* Replaced the icon with a clearer DownloadBadge */}
          <DownloadBadge size={36} bg="transparent" iconColor="#000" />
        </View>
        <Text style={[styles.reportsTitle, { color: "#000" }]}>
          Generate Analytics Reports
        </Text>
      </View>

      {/* System Overview */}
      {selected === "System Overview" && (
        <View>
          <View style={styles.reportGeneratedCard}>
            <Text style={styles.reportGeneratedTitle}>
              Report Generated Successfully
            </Text>
            <Text style={styles.reportGeneratedTime}>
              {generatedAt ? generatedAt.toLocaleString() : ""}
            </Text>

            <View style={styles.reportRows}>
              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Total Users:</Text>
                <Text style={styles.reportRowValue}>{String(totalUsers)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Active Users:</Text>
                <Text style={styles.reportRowValue}>{String(activeUsers)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Total Logins:</Text>
                <Text style={styles.reportRowValue}>{String(totalLogins)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Total Actions:</Text>
                <Text style={styles.reportRowValue}>
                  {String(totalActions)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={[
                styles.exportPdfButton,
                {
                  backgroundColor: "#fff",
                  borderColor: "#cbdff5",
                  borderWidth: 1,
                }, // Match exportCsvButton border color
                pressedBtn === "pdf" && {
                  backgroundColor: "#133E87",
                  borderColor: "#133E87",
                },
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("pdf")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportPdf}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={16}
                  color={pressedBtn === "pdf" ? "#fff" : "#000"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.exportPdfText,
                    { color: pressedBtn === "pdf" ? "#fff" : "#000" }, // Black text by default, white when pressed
                  ]}
                >
                  Export PDF
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportCsvButton,
                pressedBtn === "csv" && {
                  backgroundColor: "#133E87",
                  borderColor: "#133E87",
                },
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("csv")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportCsv}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TableIcon
                  size={16}
                  color={pressedBtn === "csv" ? "#fff" : "#000"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.exportCsvText,
                    pressedBtn === "csv" && { color: "#fff" },
                  ]}
                >
                  Export CSV
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.generateAnotherButton,
              {
                borderColor: "#cbdff5",
                borderWidth: 1,
                backgroundColor: "#fff",
              },
              pressedBtn === "generateAnother" && {
                backgroundColor: "#133E87",
                borderColor: "#133E87",
              },
            ]}
            activeOpacity={0.85}
            onPressIn={() => setPressedBtn("generateAnother")}
            onPressOut={() => setPressedBtn(null)}
            onPress={handleGenerateAnother}
          >
            <Text
              style={[
                styles.generateAnotherText,
                { color: "#000" },
                pressedBtn === "generateAnother" && { color: "#fff" },
              ]}
            >
              Generate Another Report
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* User Engagement */}
      {selected === "User Engagement" && (
        <View>
          <View style={styles.reportGeneratedCard}>
            <Text style={styles.reportGeneratedTitle}>
              Report Generated Successfully
            </Text>
            <Text style={styles.reportGeneratedTime}>
              {generatedAt ? generatedAt.toLocaleString() : ""}
            </Text>

            <View style={styles.reportRows}>
              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>New Users:</Text>
                <Text style={styles.reportRowValue}>
                  {String(newUsersDemo)}
                </Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Active Users:</Text>
                <Text style={styles.reportRowValue}>{String(activeUsers)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Inactive Users:</Text>
                <Text style={styles.reportRowValue}>
                  {String(inactiveUsers)}
                </Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Avg Logins Per User:</Text>
                <Text style={styles.reportRowValue}>{avgLoginsPerUser}</Text>
              </View>
            </View>
          </View>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={[
                styles.exportPdfButton,
                {
                  backgroundColor: "#fff",
                  borderColor: "#cbdff5",
                  borderWidth: 1,
                }, // Match exportCsvButton border color
                pressedBtn === "pdf" && {
                  backgroundColor: "#133E87",
                  borderColor: "#133E87",
                },
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("pdf")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportPdf}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={16}
                  color={pressedBtn === "pdf" ? "#fff" : "#000"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.exportPdfText,
                    { color: pressedBtn === "pdf" ? "#fff" : "#000" }, // Black text by default, white when pressed
                  ]}
                >
                  Export PDF
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportCsvButton,
                pressedBtn === "csv" && {
                  backgroundColor: "#133E87",
                  borderColor: "#133E87",
                },
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("csv")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportCsv}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TableIcon
                  size={16}
                  color={pressedBtn === "csv" ? "#fff" : "#000"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.exportCsvText,
                    pressedBtn === "csv" && { color: "#fff" },
                  ]}
                >
                  Export CSV
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.generateAnotherButton,
              {
                borderColor: "#cbdff5",
                borderWidth: 1,
                backgroundColor: "#fff",
              },
              pressedBtn === "generateAnother" && {
                backgroundColor: "#133E87",
                borderColor: "#133E87",
              },
            ]}
            activeOpacity={0.85}
            onPressIn={() => setPressedBtn("generateAnother")}
            onPressOut={() => setPressedBtn(null)}
            onPress={handleGenerateAnother}
          >
            <Text
              style={[
                styles.generateAnotherText,
                { color: "#000" },
                pressedBtn === "generateAnother" && { color: "#fff" },
              ]}
            >
              Generate Another Report
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Show items if nothing selected */}
      {!selected && (
        <View style={styles.reportsList}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.reportItem,
                pressedTab === item.id && {
                  backgroundColor: "#e8f0fe",
                  borderColor: "#133E87",
                },
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedTab(item.id)}
              onPressOut={() => setPressedTab(null)}
              onPress={() => handleGenerate(item.title)}
            >
              <Text style={styles.reportItemTitle}>{item.title}</Text>
              <Text style={styles.reportItemDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/* -------------------- MetricCard -------------------- */
function MetricCard({ icon = "chart-line", title, value, subtitle }) {
  let iconName = icon;
  let extraTitleStyle = {};

  if (title === "Mortality Rate" || title === "Predators Detected") {
    iconName =
      title === "Mortality Rate"
        ? "alert-circle-outline"
        : "shield-alert-outline";
    extraTitleStyle = { marginLeft: -6 };
  }

  const isPredatorsDetected = title === "Predators Detected";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={iconName} size={18} color="#154985" />
        </View>
        {isPredatorsDetected ? (
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.cardTitle, extraTitleStyle]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              Predators
            </Text>
            <Text
              style={[styles.cardTitle, extraTitleStyle]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              Detected
            </Text>
          </View>
        ) : (
          <Text
            style={[styles.cardTitle, { flex: 1 }, extraTitleStyle]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        )}
      </View>
      <Text style={styles.cardValue}>{String(value)}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
  );
}

/* -------------------- MortalityBatchChart -------------------- */
function MortalityBatchChart({ height = 220 }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [activeBar, setActiveBar] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Sample data - Batch IDs and total deaths per batch
  const batchData = [
    { batchId: "B001", deaths: 3 },
    { batchId: "B002", deaths: 0 },
    { batchId: "B003", deaths: 5 },
    { batchId: "B004", deaths: 1 },
    { batchId: "B005", deaths: 2 },
    { batchId: "B006", deaths: 0 },
    { batchId: "B007", deaths: 4 },
  ];

  const yAxisWidth = 34;
  const outerPadding = 12;
  const barColor = "#133E87";
  const labelHeight = 35;

  const rawMax = Math.max(...batchData.map((d) => d.deaths), 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  let niceMax = Math.ceil(rawMax / magnitude) * magnitude;
  if (niceMax / 2 >= rawMax) niceMax = niceMax / 2;
  const finalMax = Math.max(niceMax, 5);
  const ticks = 5;

  const onBarPress = (index, value) => {
    if (!layoutWidth) return;
    const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
    const spacing = innerWidth / batchData.length;
    const centerRelative = index * spacing + spacing / 2;
    const barTop = height - (value / finalMax) * height;
    const tooltipTop = Math.max(6, barTop - 60);
    setActiveBar({ index, centerRelative, top: tooltipTop });
    setTimeout(() => setActiveBar(null), 2400);
  };

  return (
    <View
      style={{
        width: "100%",
        paddingHorizontal: outerPadding,
        paddingTop: 8,
        paddingBottom: labelHeight,
      }}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ height }} />

      {layoutWidth > 0 && (
        <View
          style={{
            position: "absolute",
            top: 8,
            left: outerPadding,
            right: outerPadding,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* Y axis */}
            <View style={{ width: yAxisWidth, height }}>
              {Array.from({ length: ticks }).map((_, i) => {
                const ratio = i / (ticks - 1);
                const value = Math.round((1 - ratio) * finalMax);
                const topPos = ratio * height - 8;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top: Math.max(0, topPos),
                      left: 0,
                      right: 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#333",
                        textAlign: "right",
                        paddingRight: 6,
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Chart area */}
            <View style={{ flex: 1, height, position: "relative" }}>
              {/* gridlines */}
              {Array.from({ length: ticks }).map((_, i) => {
                const top = (i / (ticks - 1)) * height;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: "#eee",
                    }}
                  />
                );
              })}

              {/* bars */}
              <View
                style={{
                  flexDirection: "row",
                  width: "100%",
                  height,
                  justifyContent: "space-between",
                }}
              >
                {(() => {
                  const innerWidth =
                    layoutWidth - yAxisWidth - outerPadding * 2;
                  const barWidth = Math.min(
                    48,
                    (innerWidth / batchData.length) * 0.7,
                  );
                  const spacing = innerWidth / batchData.length;
                  const minBarHeight = 8;

                  return batchData.map((d, i) => {
                    const barHeight =
                      d.deaths === 0
                        ? minBarHeight
                        : Math.max(
                            minBarHeight,
                            Math.round((d.deaths / finalMax) * height),
                          );
                    const isActive = activeBar && activeBar.index === i;

                    return (
                      <View
                        key={i}
                        style={{ width: spacing, alignItems: "center" }}
                      >
                        <View
                          style={{
                            height,
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => onBarPress(i, d.deaths)}
                            style={{
                              width: barWidth,
                              height: barHeight,
                              backgroundColor: isActive ? "#FFD700" : barColor,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                            }}
                          />
                        </View>

                        <View
                          style={{
                            width: spacing,
                            alignItems: "center",
                            marginTop: 8,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{
                              fontSize: 11,
                              color: "#333",
                              fontWeight: "500",
                            }}
                          >
                            {d.batchId}
                          </Text>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>

              {/* tooltip */}
              {activeBar !== null && (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height,
                    zIndex: 30,
                    pointerEvents: "none",
                  }}
                >
                  <MortalityBatchTooltip
                    active={activeBar}
                    layoutWidth={layoutWidth}
                    yAxisWidth={yAxisWidth}
                    outerPadding={outerPadding}
                    tooltipWidth={tooltipWidth}
                    setTooltipWidth={setTooltipWidth}
                    maxTooltipWidth={180}
                    data={batchData}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* Tooltip for Mortality Batch Chart */
function MortalityBatchTooltip({
  active,
  layoutWidth,
  yAxisWidth,
  outerPadding,
  tooltipWidth,
  setTooltipWidth,
  maxTooltipWidth,
  data,
}) {
  const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
  const centerRelative = active.centerRelative;

  const desiredLeft = centerRelative - (tooltipWidth || maxTooltipWidth) / 2;
  const minLeft = 6;
  const maxLeft = Math.max(
    6,
    innerWidth - (tooltipWidth || maxTooltipWidth) - 6,
  );
  const leftClamped = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
  const topPos = Math.max(6, active.top - 54);

  return (
    <View
      style={{
        position: "absolute",
        left: yAxisWidth,
        top: topPos,
        width: innerWidth,
      }}
    >
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== tooltipWidth) setTooltipWidth(w);
        }}
        style={{
          position: "absolute",
          left: leftClamped,
          backgroundColor: "#fff",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#ccc",
          alignItems: "flex-start",
          maxWidth: maxTooltipWidth,
        }}
      >
        <Text style={{ fontWeight: "700", fontSize: 13 }}>
          {data[active.index].batchId}
        </Text>
        <Text
          style={{
            marginTop: 4,
            color: "#154985",
            fontWeight: "700",
            fontSize: 12,
          }}
        >
          Deaths: {data[active.index].deaths}
        </Text>
      </View>
    </View>
  );
}

/* -------------------- AttacksBatchChart -------------------- */
function AttacksBatchChart({ height = 220 }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [activeBar, setActiveBar] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Sample data - Batch IDs and total attacks per batch
  const batchData = [
    { batchId: "B001", attacks: 2 },
    { batchId: "B002", attacks: 1 },
    { batchId: "B003", attacks: 4 },
    { batchId: "B004", attacks: 1 },
    { batchId: "B005", attacks: 3 },
    { batchId: "B006", attacks: 2 },
    { batchId: "B007", attacks: 3 },
  ];

  const yAxisWidth = 34;
  const outerPadding = 12;
  const barColor = "#133E87";
  const labelHeight = 35;

  const rawMax = Math.max(...batchData.map((d) => d.attacks), 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  let niceMax = Math.ceil(rawMax / magnitude) * magnitude;
  if (niceMax / 2 >= rawMax) niceMax = niceMax / 2;
  const finalMax = Math.max(niceMax, 5);
  const ticks = 5;

  const onBarPress = (index, value) => {
    if (!layoutWidth) return;
    const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
    const spacing = innerWidth / batchData.length;
    const centerRelative = index * spacing + spacing / 2;
    const barTop =
      value === 0 ? height - 40 : height - (value / finalMax) * height;
    const tooltipTop = Math.max(6, barTop - 60);
    setActiveBar({ index, centerRelative, top: tooltipTop });
    setTimeout(() => setActiveBar(null), 2400);
  };

  return (
    <View
      style={{
        width: "100%",
        paddingHorizontal: outerPadding,
        paddingTop: 8,
        paddingBottom: labelHeight,
      }}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ height }} />

      {layoutWidth > 0 && (
        <View
          style={{
            position: "absolute",
            top: 8,
            left: outerPadding,
            right: outerPadding,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ width: yAxisWidth, height }}>
              {Array.from({ length: ticks }).map((_, i) => {
                const ratio = i / (ticks - 1);
                const value = Math.round((1 - ratio) * finalMax);
                const topPos = ratio * height - 8;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top: Math.max(0, topPos),
                      left: 0,
                      right: 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#333",
                        textAlign: "right",
                        paddingRight: 6,
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ flex: 1, height, position: "relative" }}>
              {Array.from({ length: ticks }).map((_, i) => {
                const top = (i / (ticks - 1)) * height;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top,
                      height: 1,
                      backgroundColor: "#eee",
                    }}
                  />
                );
              })}

              <View
                style={{
                  flexDirection: "row",
                  height: "100%",
                  alignItems: "flex-end",
                }}
              >
                {(() => {
                  const innerWidth =
                    layoutWidth - yAxisWidth - outerPadding * 2;
                  const spacing = innerWidth / batchData.length;
                  const barWidth = spacing * 0.6;

                  return batchData.map((d, index) => {
                    const barHeight = (d.attacks / finalMax) * height;
                    const isActive = activeBar && activeBar.index === index;
                    return (
                      <View
                        key={index}
                        style={{
                          width: spacing,
                          height: "100%",
                          justifyContent: "flex-end",
                          alignItems: "center",
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => onBarPress(index, d.attacks)}
                          style={{
                            width: barWidth,
                            height: barHeight,
                            backgroundColor: isActive ? "#FFD700" : barColor,
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                          }}
                        />
                        <View
                          style={{
                            position: "absolute",
                            top: height + 8,
                            width: spacing,
                            alignItems: "center",
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{
                              fontSize: 11,
                              color: "#333",
                              fontWeight: "500",
                            }}
                          >
                            {d.batchId}
                          </Text>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>

              {/* tooltip */}
              {activeBar !== null && (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height,
                    zIndex: 30,
                    pointerEvents: "none",
                  }}
                >
                  <AttacksBatchTooltip
                    active={activeBar}
                    layoutWidth={layoutWidth}
                    yAxisWidth={yAxisWidth}
                    outerPadding={outerPadding}
                    tooltipWidth={tooltipWidth}
                    setTooltipWidth={setTooltipWidth}
                    maxTooltipWidth={180}
                    data={batchData}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* Tooltip for Attacks Batch Chart */
function AttacksBatchTooltip({
  active,
  layoutWidth,
  yAxisWidth,
  outerPadding,
  tooltipWidth,
  setTooltipWidth,
  maxTooltipWidth,
  data,
}) {
  const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
  const centerRelative = active.centerRelative;

  const desiredLeft = centerRelative - (tooltipWidth || maxTooltipWidth) / 2;
  const minLeft = 6;
  const maxLeft = Math.max(
    6,
    innerWidth - (tooltipWidth || maxTooltipWidth) - 6,
  );
  const leftClamped = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
  const topPos = Math.max(6, active.top - 54);

  return (
    <View
      style={{
        position: "absolute",
        left: yAxisWidth,
        top: topPos,
        width: innerWidth,
      }}
    >
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== tooltipWidth) setTooltipWidth(w);
        }}
        style={{
          position: "absolute",
          left: leftClamped,
          backgroundColor: "#fff",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#ccc",
          alignItems: "flex-start",
          maxWidth: maxTooltipWidth,
        }}
      >
        <Text style={{ fontWeight: "700", fontSize: 13 }}>
          {data[active.index].batchId}
        </Text>
        <Text
          style={{
            marginTop: 4,
            color: "#133E87",
            fontWeight: "700",
            fontSize: 12,
          }}
        >
          Attacks: {data[active.index].attacks}
        </Text>
      </View>
    </View>
  );
}

/* -------------------- FeedBatchChart -------------------- */
function FeedBatchChart({ height = 220 }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [activeBar, setActiveBar] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Sample data - Batch IDs and feeder activations per batch
  const batchData = [
    { batchId: "B001", activations: 62 },
    { batchId: "B002", activations: 55 },
    { batchId: "B003", activations: 71 },
    { batchId: "B004", activations: 68 },
    { batchId: "B005", activations: 59 },
    { batchId: "B006", activations: 64 },
    { batchId: "B007", activations: 67 },
  ];

  const yAxisWidth = 34;
  const outerPadding = 12;
  const barColor = "#133E87";
  const labelHeight = 35;

  const rawMax = Math.max(...batchData.map((d) => d.activations), 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  let niceMax = Math.ceil(rawMax / magnitude) * magnitude;
  if (niceMax / 2 >= rawMax) niceMax = niceMax / 2;
  const finalMax = Math.max(niceMax, 10);
  const ticks = 5;

  const onBarPress = (index, value) => {
    if (!layoutWidth) return;
    const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
    const spacing = innerWidth / batchData.length;
    const centerRelative = index * spacing + spacing / 2;
    const barTop = height - (value / finalMax) * height;
    const tooltipTop = Math.max(6, barTop - 60);
    setActiveBar({ index, centerRelative, top: tooltipTop });
    setTimeout(() => setActiveBar(null), 2400);
  };

  return (
    <View
      style={{
        width: "100%",
        paddingHorizontal: outerPadding,
        paddingTop: 8,
        paddingBottom: labelHeight,
      }}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ height }} />

      {layoutWidth > 0 && (
        <View
          style={{
            position: "absolute",
            top: 8,
            left: outerPadding,
            right: outerPadding,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* Y axis */}
            <View style={{ width: yAxisWidth, height }}>
              {Array.from({ length: ticks }).map((_, i) => {
                const ratio = i / (ticks - 1);
                const value = Math.round((1 - ratio) * finalMax);
                const topPos = ratio * height - 8;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top: Math.max(0, topPos),
                      left: 0,
                      right: 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#333",
                        textAlign: "right",
                        paddingRight: 6,
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Chart area */}
            <View style={{ flex: 1, height, position: "relative" }}>
              {/* gridlines */}
              {Array.from({ length: ticks }).map((_, i) => {
                const top = (i / (ticks - 1)) * height;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: "#eee",
                    }}
                  />
                );
              })}

              <View
                style={{
                  flexDirection: "row",
                  width: "100%",
                  height,
                  justifyContent: "space-between",
                }}
              >
                {(() => {
                  const innerWidth =
                    layoutWidth - yAxisWidth - outerPadding * 2;
                  const barWidth = Math.min(
                    48,
                    (innerWidth / batchData.length) * 0.7,
                  );
                  const spacing = innerWidth / batchData.length;
                  const minBarHeight = 8;

                  return batchData.map((d, i) => {
                    const barHeight = Math.max(
                      minBarHeight,
                      Math.round((d.activations / finalMax) * height),
                    );
                    const isActive = activeBar && activeBar.index === i;

                    return (
                      <View
                        key={i}
                        style={{ width: spacing, alignItems: "center" }}
                      >
                        <View
                          style={{
                            height,
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => onBarPress(i, d.activations)}
                            style={{
                              width: barWidth,
                              height: barHeight,
                              backgroundColor: isActive ? "#FFD700" : barColor,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                            }}
                          />
                        </View>

                        <View
                          style={{
                            width: spacing,
                            alignItems: "center",
                            marginTop: 8,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{
                              fontSize: 11,
                              color: "#333",
                              fontWeight: "500",
                            }}
                          >
                            {d.batchId}
                          </Text>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>

              {/* tooltip */}
              {activeBar !== null && (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height,
                    zIndex: 30,
                    pointerEvents: "none",
                  }}
                >
                  <FeedBatchTooltip
                    active={activeBar}
                    layoutWidth={layoutWidth}
                    yAxisWidth={yAxisWidth}
                    outerPadding={outerPadding}
                    tooltipWidth={tooltipWidth}
                    setTooltipWidth={setTooltipWidth}
                    maxTooltipWidth={180}
                    data={batchData}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* Tooltip for Feed Batch Chart */
function FeedBatchTooltip({
  active,
  layoutWidth,
  yAxisWidth,
  outerPadding,
  tooltipWidth,
  setTooltipWidth,
  maxTooltipWidth,
  data,
}) {
  const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
  const centerRelative = active.centerRelative;

  const desiredLeft = centerRelative - (tooltipWidth || maxTooltipWidth) / 2;
  const minLeft = 6;
  const maxLeft = Math.max(
    6,
    innerWidth - (tooltipWidth || maxTooltipWidth) - 6,
  );
  const leftClamped = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
  const topPos = Math.max(6, active.top - 54);

  return (
    <View
      style={{
        position: "absolute",
        left: yAxisWidth,
        top: topPos,
        width: innerWidth,
      }}
    >
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== tooltipWidth) setTooltipWidth(w);
        }}
        style={{
          position: "absolute",
          left: leftClamped,
          backgroundColor: "#fff",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#ccc",
          alignItems: "flex-start",
          maxWidth: maxTooltipWidth,
        }}
      >
        <Text style={{ fontWeight: "700", fontSize: 13 }}>
          {data[active.index].batchId}
        </Text>
        <Text
          style={{
            marginTop: 4,
            color: "#133E87",
            fontWeight: "700",
            fontSize: 12,
          }}
        >
          Activations: {data[active.index].activations}
        </Text>
      </View>
    </View>
  );
}

/* -------------------- WaterBatchChart -------------------- */
function WaterBatchChart({ height = 220 }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [activeBar, setActiveBar] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Sample data
  const batchData = [
    { batchId: "B001", consumption: 125 },
    { batchId: "B002", consumption: 98 },
    { batchId: "B003", consumption: 145 },
    { batchId: "B004", consumption: 130 },
    { batchId: "B005", consumption: 112 },
    { batchId: "B006", consumption: 156 },
    { batchId: "B007", consumption: 138 },
  ];

  const yAxisWidth = 34;
  const outerPadding = 12;
  const barColor = "#133E87";

  const rawMax = Math.max(...batchData.map((d) => d.consumption), 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  let niceMax = Math.ceil(rawMax / magnitude) * magnitude;
  if (niceMax / 2 >= rawMax) niceMax = niceMax / 2;
  const finalMax = Math.max(niceMax, 10);
  const ticks = 5;

  const onBarPress = (index, value) => {
    if (!layoutWidth) return;
    const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
    const spacing = innerWidth / batchData.length;
    const centerRelative = index * spacing + spacing / 2;
    const barTop = height - (value / finalMax) * height;
    const tooltipTop = Math.max(6, barTop - 60);
    setActiveBar({ index, centerRelative, top: tooltipTop });
    setTimeout(() => setActiveBar(null), 2400);
  };

  return (
    <View
      style={{
        width: "100%",
        paddingHorizontal: outerPadding,
        paddingTop: 8,
        paddingBottom: 35,
      }}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ height }} />

      {layoutWidth > 0 && (
        <View
          style={{
            position: "absolute",
            top: 8,
            left: outerPadding,
            right: outerPadding,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ width: yAxisWidth, height }}>
              {Array.from({ length: ticks }).map((_, i) => {
                const ratio = i / (ticks - 1);
                const value = Math.round((1 - ratio) * finalMax);
                const topPos = ratio * height - 8;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top: Math.max(0, topPos),
                      left: 0,
                      right: 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#333",
                        textAlign: "right",
                        paddingRight: 6,
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ flex: 1, height, position: "relative" }}>
              {Array.from({ length: ticks }).map((_, i) => {
                const top = (i / (ticks - 1)) * height;
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      top,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: "#eee",
                    }}
                  />
                );
              })}

              <View
                style={{
                  flexDirection: "row",
                  width: "100%",
                  height,
                  justifyContent: "space-between",
                }}
              >
                {(() => {
                  const innerWidth =
                    layoutWidth - yAxisWidth - outerPadding * 2;
                  const spacing = innerWidth / batchData.length;
                  const barWidth = Math.min(
                    48,
                    (innerWidth / batchData.length) * 0.7,
                  );

                  return batchData.map((d, i) => {
                    const barHeight = (d.consumption / finalMax) * height;
                    const isActive = activeBar && activeBar.index === i;
                    return (
                      <View
                        key={i}
                        style={{
                          width: spacing,
                          alignItems: "center",
                          justifyContent: "flex-end",
                          height: "100%",
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => onBarPress(i, d.consumption)}
                          style={{
                            width: barWidth,
                            height: barHeight,
                            backgroundColor: isActive ? "#FFD700" : barColor,
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                          }}
                        />
                      </View>
                    );
                  });
                })()}
              </View>

              <View
                style={{
                  flexDirection: "row",
                  width: "100%",
                  position: "absolute",
                  top: height,
                  left: 0,
                }}
              >
                {(() => {
                  const innerWidth =
                    layoutWidth - yAxisWidth - outerPadding * 2;
                  const spacing = innerWidth / batchData.length;
                  return batchData.map((d, i) => (
                    <View
                      key={i}
                      style={{
                        width: spacing,
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 11,
                          color: "#333",
                          fontWeight: "500",
                        }}
                      >
                        {d.batchId}
                      </Text>
                    </View>
                  ));
                })()}
              </View>

              {activeBar !== null && (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height,
                    zIndex: 30,
                    pointerEvents: "none",
                  }}
                >
                  <WaterBatchTooltip
                    active={activeBar}
                    layoutWidth={layoutWidth}
                    yAxisWidth={yAxisWidth}
                    outerPadding={outerPadding}
                    tooltipWidth={tooltipWidth}
                    setTooltipWidth={setTooltipWidth}
                    maxTooltipWidth={180}
                    data={batchData}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function WaterBatchTooltip({
  active,
  layoutWidth,
  yAxisWidth,
  outerPadding,
  tooltipWidth,
  setTooltipWidth,
  maxTooltipWidth,
  data,
}) {
  const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
  const centerRelative = active.centerRelative;
  const desiredLeft = centerRelative - (tooltipWidth || maxTooltipWidth) / 2;
  const minLeft = 6;
  const maxLeft = Math.max(
    6,
    innerWidth - (tooltipWidth || maxTooltipWidth) - 6,
  );
  const leftClamped = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
  const topPos = Math.max(6, active.top - 54);

  return (
    <View
      style={{
        position: "absolute",
        left: yAxisWidth,
        top: topPos,
        width: innerWidth,
      }}
    >
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== tooltipWidth) setTooltipWidth(w);
        }}
        style={{
          position: "absolute",
          left: leftClamped,
          backgroundColor: "#fff",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#ccc",
          alignItems: "flex-start",
          maxWidth: maxTooltipWidth,
        }}
      >
        <Text style={{ fontWeight: "700", fontSize: 13 }}>
          {data[active.index].batchId}
        </Text>
        <Text
          style={{
            marginTop: 4,
            color: "#133E87",
            fontWeight: "700",
            fontSize: 12,
          }}
        >
          Activations: {data[active.index].consumption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#133E87",
    fontWeight: "600",
  },
  metricsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#e1f0fb",
    padding: 14,
    marginBottom: 12,
    minHeight: 110,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eef6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    color: "#0b2336",
    fontWeight: "600",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  cardValue: {
    fontSize: 34,
    color: "#000",
    fontWeight: "800",
    marginTop: 8,
  },
  cardSubtitle: {
    color: "#2a66a6",
    marginTop: 6,
    fontSize: 14,
  },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#dbeffb",
    padding: 14,
    marginBottom: 18,
    width: "100%",
    alignItems: "center",
  },
  chartHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  chartTitleOutside: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000000",
  },
  mortalitySectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#133E87",
    textAlign: "center",
    alignSelf: "center",
    marginBottom: 35, // match Mortality header spacing
  },
  chartButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  chartFilterButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#133E87",
  },
  chartFilterText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#000",
  },
  chartExportButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#133E87",
  },
  chartExportText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#000",
  },
  fallback: {
    paddingVertical: 18,
    alignItems: "center",
  },
  fallbackText: {
    color: "#b22222",
    fontWeight: "700",
  },
  fallbackTextSmall: {
    color: "#444",
    marginTop: 6,
    textAlign: "center",
  },
  tooltipWrapper: {
    position: "absolute",
    alignItems: "center",
    zIndex: 20,
    elevation: 10,
  },
  tooltipVerticalLine: {
    width: 2,
    backgroundColor: "#333",
    position: "absolute",
  },
  tooltipBox: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 8,
    alignItems: "center",
  },
  tooltipLabel: {
    fontWeight: "700",
  },
  tooltipValue: {
    fontWeight: "700",
    color: "#154985",
  },
  seeMoreContainer: {
    width: "100%",
    alignItems: "flex-end",
    marginTop: 2,
    marginBottom: 4,
  },
  seeMoreButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  seeMoreText: {
    fontSize: 12,
    color: "#000000",
    fontWeight: "400",
    marginTop: -15,
  },
  seeMoreUnderline: {
    height: 1,
    backgroundColor: "#666",
    marginTop: 1,
  },
  reportsWrapper: {
    backgroundColor: "#eef6fb",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  reportsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  reportsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#133E87",
  },
  reportGeneratedCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#dbeffb",
    padding: 16,
    marginBottom: 16,
  },
  reportGeneratedTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0b2336",
  },
  reportGeneratedTime: {
    fontSize: 14,
    color: "#777",
    marginTop: 4,
  },
  reportRows: {
    marginTop: 12,
  },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reportRowLabel: {
    fontSize: 14,
    color: "#333",
  },
  reportRowValue: {
    fontSize: 14,
    color: "#0b2336",
    fontWeight: "500",
  },
  exportButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  exportPdfButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "#133E87",
    backgroundColor: "#eef6fb",
  },
  exportCsvButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "#133E87",
    backgroundColor: "#eef6fb",
  },
  exportPdfText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#133E87",
  },
  exportCsvText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#133E87",
  },
  generateAnotherButton: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "#133E87",
    backgroundColor: "#eef6fb",
    marginTop: 12,
  },
  generateAnotherText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#133E87",
  },
  reportsList: {
    width: "100%",
  },
  reportItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#dbeffb",
    padding: 16,
    marginBottom: 12,
  },
  reportItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0b2336",
  },
  reportItemDesc: {
    fontSize: 14,
    color: "#777",
    marginTop: 4,
  },
  tableIconOuter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  timeRangeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#133E87",
    backgroundColor: "#fff",
  },
  timeRangeButtonActive: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  timeRangeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#133E87",
  },
  timeRangeTextActive: {
    color: "#fff",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#133E87",
  },
  modalCloseButton: {
    padding: 8,
  },
  filterTabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#133E87",
    backgroundColor: "#fff",
  },
  filterTabActive: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#133E87",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  datePickerContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  monthPicker: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 12,
  },
  monthPickerText: {
    fontSize: 16,
    color: "#0b2336",
  },
  yearPicker: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 12,
  },
  yearPickerText: {
    fontSize: 16,
    color: "#0b2336",
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "#133E87",
    backgroundColor: "#eef6fb",
    marginHorizontal: 4,
  },
  modalResetButton: {
    backgroundColor: "#fff",
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#133E87",
  },
  // Date Range Picker Styles
  dateRangeHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  dateRangeItem: {
    alignItems: "center",
  },
  dateRangeLabel: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 4,
    fontWeight: "500",
  },
  dateRangeValue: {
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "600",
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  modalCancelButton: {
    backgroundColor: "#133E87",
  },
  modalApplyButton: {
    backgroundColor: "#133E87",
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalApplyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  calendar: {
    borderRadius: 12,
    elevation: 0,
  },
});
