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
  Platform,
  ActivityIndicator,
} from "react-native";

// Vector icons (using Expo's vector-icons wrapper which includes react-native-vector-icons)
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import Header2 from "../navigation/adminHeader";
import BrandedAlertModal from "../navigation/BrandedAlertModal";
import { fetchBatches } from "../User/Dashboard/viewallbatchesModal";
import { db as firestoreDb } from "../../config/firebaseconfig";
import {
  collection,
  getDocs,
  collectionGroup,
  addDoc,
  serverTimestamp,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import { auth } from "../../config/firebaseconfig";

const { width: windowWidth } = Dimensions.get("window");

/**
 * Helper function to load logo asset for reports
 * Copies asset to cacheDirectory first, which fixes APK build issues
 * where assets:// scheme is unsupported
 */
const getLogoBase64 = async () => {
  try {
    const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
    if (!logoAsset.downloaded) {
      await logoAsset.downloadAsync();
    }

    // Copy to cache directory first (workaround for APK asset access)
    const fileName = "logo-report-temp.png";
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.copyAsync({
      from: logoAsset.localUri,
      to: fileUri,
    });

    // Now read the copied file
    const logoBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return logoBase64;
  } catch (error) {
    console.warn("[getLogoBase64] Failed to load logo:", error);
    return ""; // Return empty string if logo fails to load - report will continue without logo
  }
};

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

/**
 * Fetch unique batches from feedingExecutions_logs collection
 * Groups by batchId and returns array of batch objects
 */
const fetchFeedBatches = async () => {
  try {
    const feedLogsRef = collection(firestoreDb, "feedingExecutions_logs");
    const querySnapshot = await getDocs(feedLogsRef);

    const batchMap = new Map();

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.batchId && !batchMap.has(data.batchId)) {
        batchMap.set(data.batchId, {
          id: data.batchId,
          chicksCount: 0,
          daysCount: 0,
        });
      }
    });

    const batches = Array.from(batchMap.values());
    return batches;
  } catch (error) {
    console.error("[fetchFeedBatches] Error fetching batches:", error);
    throw error;
  }
};

/**
 * Fetch batches from brooderInfo collection
 * Returns array of batch objects with all data from brooderInfo
 */
const fetchFeedBatchesFromBrooder = async () => {
  try {
    const brooderInfoRef = collection(firestoreDb, "brooderInfo");
    const querySnapshot = await getDocs(brooderInfoRef);

    const batches = [];
    querySnapshot.forEach((doc) => {
      batches.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(
      "[fetchFeedBatchesFromBrooder] Fetched",
      batches.length,
      "batches from brooderInfo",
    );
    return batches;
  } catch (error) {
    console.error(
      "[fetchFeedBatchesFromBrooder] Error fetching batches from brooderInfo:",
      error,
    );
    throw error;
  }
};

const fetchWaterBatches = async () => {
  try {
    // Fetch all batches from /brooderInfo collection
    const brooderInfoRef = collection(firestoreDb, "brooderInfo");
    const brooderSnapshot = await getDocs(brooderInfoRef);

    const brooderBatches = [];
    brooderSnapshot.forEach((doc) => {
      brooderBatches.push({
        id: doc.id,
        name: doc.id,
        createdAt: doc.data().createdAt,
        ...doc.data(),
      });
    });

    console.log(
      "[fetchWaterBatches] Batches from /brooderInfo:",
      brooderBatches,
    );

    // Sort by createdAt in descending order (latest first)
    brooderBatches.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
      const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

    return brooderBatches;
  } catch (error) {
    console.error("[fetchWaterBatches] Error fetching water batches:", error);
    throw error;
  }
};

// Helper function to format date/time for PDF reports: DD-Mmm-YYYY, HH:MM AM/PM
const formatReportDateTime = (date = new Date()) => {
  // Example: 25-Jan-2026, 10:30 AM
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
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day}-${month}-${year}, ${hours}:${minutes} ${ampm}`;
};

// Standalone function for chart x-axis label intervals
function generateDateLabels(startDate, endDate) {
  const dateLabels = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays <= 7) {
    // Show every date
    for (let i = 0; i < diffDays; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      dateLabels.push(`${current.getMonth() + 1}/${current.getDate()}`);
    }
  } else {
    // Show exactly 6 evenly spaced labels (including start and end)
    const numLabels = 6;
    for (let i = 0; i < numLabels; i++) {
      const dayIndex = Math.round((i * (diffDays - 1)) / (numLabels - 1));
      const current = new Date(start);
      current.setDate(start.getDate() + dayIndex);
      dateLabels.push(`${current.getMonth() + 1}/${current.getDate()}`);
    }
  }
  return dateLabels;
}

// Helper function to generate x-axis label positions based on data length
function generateXAxisLabels(dataLength) {
  if (dataLength <= 8) {
    // Show all positions for 8 days or below
    return Array.from({ length: dataLength }, (_, i) => i);
  } else if (dataLength <= 14) {
    // For 9–14 data points: show [0, mid1, mid2, end] - max 4 labels
    const step = Math.ceil(dataLength / 4);
    const positions = [0];
    for (let i = step; i < dataLength - 1; i += step) {
      positions.push(i);
    }
    positions.push(dataLength - 1);
    return positions;
  } else if (dataLength <= 19) {
    // For 15–19 data points: show exactly 5 labels evenly spaced
    const positions = [];
    const targetLabels = 5;
    const step = (dataLength - 1) / (targetLabels - 1);
    for (let i = 0; i < targetLabels; i++) {
      const position = Math.round(i * step);
      if (!positions.includes(position)) {
        positions.push(position);
      }
    }
    return positions.sort((a, b) => a - b);
  } else {
    // For 20+ days: show exactly 4 labels evenly spaced with last label right-aligned
    const positions = [];
    const targetLabels = 4;
    const step = (dataLength - 1) / (targetLabels - 1);
    for (let i = 0; i < targetLabels; i++) {
      let position;
      if (i === targetLabels - 1) {
        // Ensure last label is aligned to the right (at the end)
        position = dataLength - 1;
      } else {
        position = Math.round(i * step);
      }
      if (!positions.includes(position)) {
        positions.push(position);
      }
    }
    return positions.sort((a, b) => a - b);
  }
}

// Helper function to format date for date ranges: DD-Mmm-YYYY (without time)
const formatDateRange = (dateInput) => {
  if (!dateInput) return "";

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

  let date;

  // Handle string input (YYYY-MM-DD format)
  if (typeof dateInput === "string") {
    date = new Date(dateInput);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

// Fetch and aggregate solar usage data from Firestore with ~7 evenly spaced x-axis labels
async function fetchSolarUsageData(startDate, endDate) {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0); // Set to beginning of start date
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set to end of end date

    // Query solarUsage collection
    const solarRef = collection(firestoreDb, "solarUsage");
    const q = query(
      solarRef,
      where("timestamp", ">=", start),
      where("timestamp", "<=", end),
    );
    const snapshot = await getDocs(q);

    console.log(
      "[fetchSolarUsageData] Found",
      snapshot.docs.length,
      "documents",
    );

    // Aggregate usage by date (sum for same dates)
    const dateMap = {};
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate
        ? data.timestamp.toDate()
        : new Date(data.timestamp);
      const dateKey = `${timestamp.getMonth() + 1}/${timestamp.getDate()}/${timestamp.getFullYear()}`;
      const usage = parseFloat(data.usage) || 0;
      dateMap[dateKey] = (dateMap[dateKey] || 0) + usage;
    });

    console.log("[fetchSolarUsageData] Aggregated data:", dateMap);

    // Convert to arrays sorted by date
    const sortedDates = Object.keys(dateMap).sort((a, b) => {
      const [aM, aD, aY] = a.split("/").map(Number);
      const [bM, bD, bY] = b.split("/").map(Number);
      return new Date(aY, aM - 1, aD) - new Date(bY, bM - 1, bD);
    });

    // Calculate equal positions for ~7 evenly spaced labels across the x-axis
    const totalDays = sortedDates.length;
    const targetLabels = Math.min(7, totalDays); // Don't exceed number of data points

    // Use helper function to get label positions based on data length
    const labelIndices = generateXAxisLabels(totalDays);

    console.log(
      `[fetchSolarUsageData] Total days: ${totalDays}, Label positions:`,
      labelIndices,
    );

    // Generate labels only at calculated positions (equal spacing on x-axis)
    const labels = [];
    const data = [];
    sortedDates.forEach((dateStr, index) => {
      const [month, day] = dateStr.split("/");
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
      const formattedLabel = `${monthNames[parseInt(month) - 1]} ${String(parseInt(day)).padStart(2, "0")}`;

      // Show label at calculated equal positions
      if (labelIndices.includes(index)) {
        labels.push(formattedLabel);
      } else {
        // Empty string for non-label positions (chart lib will skip rendering these labels)
        labels.push("");
      }
      data.push(dateMap[dateStr]);
    });

    console.log(
      "[fetchSolarUsageData] Final labels:",
      labels.filter((l) => l !== ""),
      "Data points:",
      data.length,
    );

    return { labels, data };
  } catch (error) {
    console.error("[fetchSolarUsageData] Error:", error);
    return { labels: [], data: [] };
  }
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
  // Initialize with 7-day default range for solar and cause charts
  const initializeSolarFilter = () => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // Format dates as YYYY-MM-DD strings for cause filter
    const formatDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    return {
      solar: {
        startDate: sevenDaysAgo,
        endDate: today,
      },
      cause: {
        startDate: formatDateString(sevenDaysAgo),
        endDate: formatDateString(today),
      },
    };
  };
  const [chartFilters, setChartFilters] = useState(initializeSolarFilter());

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

  // Export mortality per batch modal state (removed - using filter dates instead)
  const [isGeneratingBatchReport, setIsGeneratingBatchReport] = useState(false);

  // Export attacks per batch modal state
  const [exportAttacksBatchModalVisible, setExportAttacksBatchModalVisible] =
    useState(false);
  const [attacksBatchExportStartDate, setAttacksBatchExportStartDate] =
    useState(null);
  const [attacksBatchExportEndDate, setAttacksBatchExportEndDate] =
    useState(null);
  const [isGeneratingAttacksBatchReport, setIsGeneratingAttacksBatchReport] =
    useState(false);

  // Export feed per batch state
  const [isGeneratingFeedBatchReport, setIsGeneratingFeedBatchReport] =
    useState(false);

  // Export water per batch state
  const [isGeneratingWaterBatchReport, setIsGeneratingWaterBatchReport] =
    useState(false);

  // Feed consumption report generation state
  const [isGeneratingFeedReport, setIsGeneratingFeedReport] = useState(false);

  // Cause of Death state
  const [causeOfDeathData, setCauseOfDeathData] = useState([
    { name: "Predatory Attack", population: 0, color: "#154785" },
    { name: "Overfeeding", population: 0, color: "#FFC107" },
    { name: "Dehydration", population: 0, color: "#F44336" },
    { name: "Other", population: 0, color: "#4CAF50" },
  ]);

  // Mortality per Batch state
  const [mortalityBatchData, setMortalityBatchData] = useState([]);

  // Predator Attacks state
  const [predatorAttacksData, setPredatorAttacksData] = useState([]);
  const [totalPredatorAttacks, setTotalPredatorAttacks] = useState(0);
  const [attacksPerBatchData, setAttacksPerBatchData] = useState([]);

  // Feed per batch state
  const [feedPerBatchData, setFeedPerBatchData] = useState([]);

  // Water per batch state
  const [waterPerBatchData, setWaterPerBatchData] = useState([]);

  // Predator Types state
  const [predatorTypesData, setPredatorTypesData] = useState([
    { name: "Dog", population: 0, color: "#154785" },
    { name: "Cat", population: 0, color: "#FFC107" },
    { name: "Snake", population: 0, color: "#F44336" },
    { name: "Rat", population: 0, color: "#4CAF50" },
    { name: "Other", population: 0, color: "#E91E63" },
  ]);
  const [isLoadingPredatorTypes, setIsLoadingPredatorTypes] = useState(false);
  const [predatorTypesError, setPredatorTypesError] = useState(null);

  // Export predator types modal state
  const [exportPredatorTypesModalVisible, setExportPredatorTypesModalVisible] =
    useState(false);
  const [predatorTypesExportStartDate, setPredatorTypesExportStartDate] =
    useState(null);
  const [predatorTypesExportEndDate, setPredatorTypesExportEndDate] =
    useState(null);
  const [isGeneratingPredatorTypesReport, setIsGeneratingPredatorTypesReport] =
    useState(false);

  // Export predator attacks modal state
  const [exportPredatorModalVisible, setExportPredatorModalVisible] =
    useState(false);
  const [predatorExportStartDate, setPredatorExportStartDate] = useState(null);
  const [predatorExportEndDate, setPredatorExportEndDate] = useState(null);
  const [isGeneratingPredatorReport, setIsGeneratingPredatorReport] =
    useState(false);

  // Batch selection for feed consumption chart
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedFeedBatch, setSelectedFeedBatch] = useState("");
  const [showFeedBatchDropdown, setShowFeedBatchDropdown] = useState(false);
  const [isFetchingBatches, setIsFetchingBatches] = useState(false);
  const [batchFetchError, setBatchFetchError] = useState(null);

  // Batch selection for water consumption chart
  const [selectedWaterBatch, setSelectedWaterBatch] = useState("");
  const [showWaterBatchDropdown, setShowWaterBatchDropdown] = useState(false);
  const [availableWaterBatches, setAvailableWaterBatches] = useState([]);
  const [isFetchingWaterBatches, setIsFetchingWaterBatches] = useState(false);
  const [waterBatchFetchError, setWaterBatchFetchError] = useState(null);

  // Feed consumption logging data
  const [feedConsumptionData, setFeedConsumptionData] = useState([]);
  const [isLoadingFeedConsumption, setIsLoadingFeedConsumption] =
    useState(false);
  const [feedConsumptionError, setFeedConsumptionError] = useState(null);

  // Water consumption logging data (separate from feed)
  const [waterConsumptionData, setWaterConsumptionData] = useState([]);
  const [isLoadingWaterConsumption, setIsLoadingWaterConsumption] =
    useState(false);
  const [waterConsumptionError, setWaterConsumptionError] = useState(null);

  // Branded Alert Modal state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: "info",
    title: "",
    message: "",
  });

  const showAlert = (type, title, message) => {
    setAlertConfig({ type, title, message });
    setAlertVisible(true);
  };

  const formatFilterDisplay = (filterData) => {
    if (!filterData) return "";

    // Handle batch selection
    if (filterData.batchId) {
      return `${filterData.batchId}`;
    }

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

    // Dynamically determine interval based on number of days
    let interval = 1; // Show all days by default (7 days or less)
    if (diffDays > 7 && diffDays <= 14) {
      interval = 2; // Show every 2nd day (8-14 days)
    } else if (diffDays > 14 && diffDays <= 30) {
      interval = 3; // Show every 3rd day (15-30 days)
    } else if (diffDays > 30 && diffDays <= 45) {
      interval = Math.ceil(diffDays / 6); // Show ~6 labels (every 7-8 days for 45 days)
    } else if (diffDays > 45) {
      interval = Math.ceil(diffDays / 5); // Show ~5 labels for larger ranges (60+ days)
    }

    // Generate date objects for all days in range
    const dateObjs = [];
    for (let i = 0; i <= diffDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      dateObjs.push(new Date(currentDate));
    }

    // Sort dateObjs chronologically (should already be sorted, but for safety)
    dateObjs.sort((a, b) => a - b);

    // Build labels array with smart intervals
    const labels = dateObjs.map((dateObj, i) => {
      const month = dateObj.toLocaleDateString("en-US", { month: "short" });
      const day = dateObj.getDate();
      // Show label only at intervals, plus always show the last day
      if (i % interval === 0 || i === diffDays) {
        return `${month} ${day}`;
      } else {
        return "";
      }
    });

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
   * Fetch feed consumption data from feedingExecutions_logs collection
   * Groups data by age and counts the number of documents for each age
   * Returns formatted data for line chart: { age: number, count: number }
   */
  const fetchFeedConsumptionByAge = async (batchId) => {
    setIsLoadingFeedConsumption(true);
    setFeedConsumptionError(null);
    try {
      if (!batchId) {
        setFeedConsumptionData([]);
        setIsLoadingFeedConsumption(false);
        return;
      }

      console.log(
        "[adminAnalytics] Fetching feed consumption for batch:",
        batchId,
      );

      // Query feedingExecutions_logs collection for the selected batch
      const q = query(
        collection(firestoreDb, "feedingExecutions_logs"),
        where("batchId", "==", batchId),
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log(
          "[adminAnalytics] No feeding logs found for batch:",
          batchId,
        );
        setFeedConsumptionData([]);
        setIsLoadingFeedConsumption(false);
        return;
      }

      // Group documents by age and count them
      const ageCountMap = {};

      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();

        // Filter by status === "Success"
        if (data.status !== "Success") {
          return;
        }

        const age = data.age;

        // Handle age as string or number
        const ageValue = typeof age === "string" ? age : String(age);

        if (ageValue) {
          if (!ageCountMap[ageValue]) {
            ageCountMap[ageValue] = 0;
          }
          ageCountMap[ageValue]++;
        }
      });

      // Convert to array and sort by age (as numbers)
      const consumptionData = Object.entries(ageCountMap)
        .map(([age, count]) => ({
          age: parseInt(age, 10) || 0,
          count: count,
          ageLabel: `Day ${age}`,
        }))
        .sort((a, b) => a.age - b.age);

      console.log(
        "[adminAnalytics] Feed consumption data processed:",
        consumptionData.length,
        "age points",
      );
      setFeedConsumptionData(consumptionData);
    } catch (error) {
      console.error("[adminAnalytics] Error fetching feed consumption:", error);
      setFeedConsumptionError(error.message || "Failed to load feed data");
      setFeedConsumptionData([]);
    } finally {
      setIsLoadingFeedConsumption(false);
    }
  };

  /**
   * Fetch water consumption data from wateringExecutions_logs collection
   * Groups data by age and counts the number of documents for each age
   * Returns formatted data for line chart: { age: number, count: number }
   */
  const fetchWaterConsumptionByAge = async (batchId) => {
    try {
      setIsLoadingWaterConsumption(true);
      setWaterConsumptionError("");

      if (!batchId) {
        setWaterConsumptionError("Please select a batch");
        setWaterConsumptionData([]);
        return;
      }

      const waterLogsRef = collection(firestoreDb, "wateringExecutions_logs");
      const q = query(waterLogsRef, where("batchId", "==", batchId));
      const snapshot = await getDocs(q);

      const ageMap = {};
      let recordCount = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.status === "Success" && data.age !== undefined) {
          const age = data.age || "Unknown";
          ageMap[age] = (ageMap[age] || 0) + 1;
          recordCount++;
        }
      });

      // Convert ageMap to array and sort by age
      const consumptionData = Object.keys(ageMap)
        .map((age) => ({
          age: parseInt(age, 10),
          count: ageMap[age],
          ageLabel: `Day ${age}`,
        }))
        .sort((a, b) => a.age - b.age);

      setWaterConsumptionData(consumptionData);
    } catch (error) {
      console.error("[FetchWaterConsumption] Error:", error);
      setWaterConsumptionError(error.message || "Failed to load water data");
      setWaterConsumptionData([]);
    } finally {
      setIsLoadingWaterConsumption(false);
    }
  };

  /**
   * Fetch feed per batch data from feedingExecutions_logs collection
   * Groups documents by batchId and counts total documents per batch
   * Filters by date range if provided
   * Returns array: [{ batchId: "Batch 1", count: 25 }, ...]
   */
  const fetchFeedPerBatchData = async (dateFilter = null) => {
    try {
      console.log(
        "[FetchFeedPerBatch] Starting fetch...",
        dateFilter
          ? `from ${dateFilter.startDate} to ${dateFilter.endDate}`
          : "no filter",
      );

      const feedLogsRef = collection(firestoreDb, "feedingExecutions_logs");
      const feedSnapshot = await getDocs(feedLogsRef);

      const batchFeedMap = {};

      // Parse date range if provided
      let startDateObj = null;
      let endDateObj = null;
      if (dateFilter && dateFilter.startDate && dateFilter.endDate) {
        const [startYear, startMonth, startDay] = dateFilter.startDate
          .split("-")
          .map(Number);
        startDateObj = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);

        const [endYear, endMonth, endDay] = dateFilter.endDate
          .split("-")
          .map(Number);
        endDateObj = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

        console.log(
          `[FetchFeedPerBatch] Filtering between ${startDateObj} and ${endDateObj}`,
        );
      }

      // Iterate through each feed log document
      feedSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const batchId = data.batchId;

        if (!batchId) return; // Skip if no batchId

        // Check date filter if provided
        if (startDateObj && endDateObj) {
          let docDate = null;

          // Convert timestamp to Date
          if (data.timestamp?.toDate) {
            docDate = data.timestamp.toDate();
          } else if (data.timestamp?.seconds) {
            docDate = new Date(data.timestamp.seconds * 1000);
          } else if (data.timestamp) {
            docDate = new Date(data.timestamp);
          } else if (data.createdAt?.toDate) {
            docDate = data.createdAt.toDate();
          }

          // Only count if within date range
          if (docDate && docDate >= startDateObj && docDate <= endDateObj) {
            batchFeedMap[batchId] = (batchFeedMap[batchId] || 0) + 1;
          }
        } else {
          // No filter, count all
          batchFeedMap[batchId] = (batchFeedMap[batchId] || 0) + 1;
        }
      });

      // Convert map to sorted array
      const batchArray = Object.entries(batchFeedMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([batchId, count]) => ({
          batchId,
          activations: count, // Use "activations" to match FeedBatchChart expectations
        }));

      setFeedPerBatchData(batchArray);
      return batchArray;
    } catch (error) {
      console.error("[FetchFeedPerBatch] Error:", error);
      setFeedPerBatchData([]);
      return [];
    }
  };

  /**
   * Fetch total water per batch from wateringExecutions_logs
   * Groups documents by batchId and counts total activations per batch
   * Supports date range filtering
   */
  const fetchWaterPerBatchData = async (dateFilter = null) => {
    try {
      setWaterPerBatchData([]);
      console.log(
        "[FetchWaterPerBatch] Starting fetch with filter:",
        dateFilter,
      );

      // Parse date filter to get start and end dates
      let startDate = null;
      let endDate = null;

      if (dateFilter && dateFilter.startDate && dateFilter.endDate) {
        try {
          startDate = new Date(dateFilter.startDate);
          endDate = new Date(dateFilter.endDate);
          endDate.setHours(23, 59, 59, 999);
          console.log(
            "[FetchWaterPerBatch] Date range:",
            startDate,
            "-",
            endDate,
          );
        } catch (error) {
          console.error("[FetchWaterPerBatch] Date parse error:", error);
        }
      }

      // Query wateringExecutions_logs collection
      const q = query(collection(firestoreDb, "wateringExecutions_logs"));
      const snapshot = await getDocs(q);

      console.log(
        "[FetchWaterPerBatch] Found",
        snapshot.docs.length,
        "total documents",
      );

      // Group by batchId and count documents within date range
      const batchCounts = {};

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const batchId = data.batchId || "Unknown";

        // Only count if status is "Success"
        if (data.status !== "Success") return;

        // Check if document is within date range (if filter provided)
        let isInDateRange = true;
        if (startDate && endDate) {
          const docTimestamp = data.timestamp || data.createdAt;
          let docDate = null;

          if (docTimestamp) {
            if (docTimestamp.toDate) {
              // Firestore Timestamp
              docDate = docTimestamp.toDate();
            } else if (typeof docTimestamp === "string") {
              // String date
              docDate = new Date(docTimestamp);
            } else if (docTimestamp instanceof Date) {
              docDate = docTimestamp;
            }
          }

          if (docDate) {
            isInDateRange = docDate >= startDate && docDate <= endDate;
          }
        }

        if (isInDateRange) {
          batchCounts[batchId] = (batchCounts[batchId] || 0) + 1;
        }
      });

      // Convert to array format and sort by batchId
      const result = Object.entries(batchCounts)
        .map(([batchId, count]) => ({
          batchId: batchId,
          activations: count,
        }))
        .sort((a, b) => a.batchId.localeCompare(b.batchId));

      setWaterPerBatchData(result);
      return result;
    } catch (error) {
      console.error("[FetchWaterPerBatch] Error:", error);
      setWaterPerBatchData([]);
      return [];
    }
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
   * Fetch mortality records directly from /mortality/{batchName}/records using collectionGroup
   * Extracts batchName from the "batchId" field in each record
   * No need to fetch from brooderInfo - mortality collection already has batch info
   */
  const fetchMortalityRecords = async (filterData = null) => {
    try {
      console.log(
        "[FetchMortalityRecords] Starting fetch from mortality collection using collectionGroup...",
      );

      const allRecords = [];

      // Use collectionGroup to query all "records" subcollections directly
      // This eliminates the need to iterate through brooderInfo first
      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordDocs = await getDocs(recordsRef);

      console.log(
        "[FetchMortalityRecords] Found",
        recordDocs.docs.length,
        "total mortality records across all batches",
      );

      if (recordDocs.empty) {
        console.warn("[FetchMortalityRecords] No mortality records found");
        setMortalityData([]);
        return [];
      }

      // Process each record - extract count and dateOfDeath for charting
      recordDocs.forEach((recordDoc) => {
        try {
          const data = recordDoc.data();
          const batchName = data.batchId; // Extract batchName from the batchId field

          console.log(
            `[FetchMortalityRecords] Processing record from batch: ${batchName}`,
          );

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
                console.error(`[FetchMortalityRecords] toDate() failed:`, e);
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
              dateOfDeath = parseCustomDateFormat(data.dateOfDeathFormatted);
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
            batchId: batchName,
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

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);

      // Use collectionGroup to query all records directly from /mortality/{BatchName}/records
      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordsSnapshot = await getDocs(recordsRef);

      let allRecords = [];

      console.log(
        "[FetchMortalityExport] Found",
        recordsSnapshot.docs.length,
        "total mortality records",
      );

      // Process all records and filter by date range
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
        if (recordDate && recordDate >= startDate && recordDate <= endDate) {
          allRecords.push({
            id: recordDoc.id,
            ...recordData,
          });
        }
      });

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
   * Fetch feed consumption records for export from feedingExecutions_logs
   * based on the selected batch. Returns sorted array of feed records grouped by age.
   */
  const fetchFeedRecordsForExport = async (batchId) => {
    try {
      console.log(
        "[FetchFeedExport] Fetching feed records for batch:",
        batchId,
      );

      if (!batchId) {
        showAlert("error", "Error", "Please select a batch from the filter");
        return [];
      }

      const feedLogsRef = collection(firestoreDb, "feedingExecutions_logs");
      const q = query(feedLogsRef, where("batchId", "==", batchId));
      const feedSnapshot = await getDocs(q);

      let allRecords = [];

      console.log(
        "[FetchFeedExport] Found",
        feedSnapshot.docs.length,
        "total feed records for batch",
        batchId,
      );

      // Process all records and filter by status === "Success"
      feedSnapshot.docs.forEach((recordDoc) => {
        const recordData = recordDoc.data();

        // Only include records with status === "Success"
        if (recordData.status === "Success") {
          allRecords.push({
            id: recordDoc.id,
            ...recordData,
          });
        }
      });

      console.log(
        `[FetchFeedExport] Found ${allRecords.length} successful records`,
      );
      return allRecords;
    } catch (error) {
      console.error("[FetchFeedExport] Error:", error);
      showAlert(
        "error",
        "Error",
        "Failed to fetch feed data: " + error.message,
      );
      return [];
    }
  };

  /**
   * Fetch water consumption records for export from wateringExecutions_logs
   * based on the selected batch. Returns sorted array of water records grouped by age.
   */
  const fetchWaterRecordsForExport = async (batchId) => {
    try {
      console.log(
        "[FetchWaterExport] Fetching water records for batch:",
        batchId,
      );

      if (!batchId) {
        showAlert("error", "Error", "Please select a batch from the filter");
        return [];
      }

      const waterLogsRef = collection(firestoreDb, "wateringExecutions_logs");
      const q = query(waterLogsRef, where("batchId", "==", batchId));
      const waterSnapshot = await getDocs(q);

      let allRecords = [];

      console.log(
        "[FetchWaterExport] Found",
        waterSnapshot.docs.length,
        "total water records for batch",
        batchId,
      );

      // Process all records and filter by status === "Success"
      waterSnapshot.docs.forEach((recordDoc) => {
        const recordData = recordDoc.data();

        // Only include records with status === "Success"
        if (recordData.status === "Success") {
          allRecords.push({
            id: recordDoc.id,
            ...recordData,
          });
        }
      });

      console.log(
        `[FetchWaterExport] Found ${allRecords.length} successful records`,
      );
      return allRecords;
    } catch (error) {
      console.error("[FetchWaterExport] Error:", error);
      showAlert(
        "error",
        "Error",
        "Failed to fetch water data: " + error.message,
      );
      return [];
    }
  };

  /**
   * Fetch predator attacks from /predatorAttacks/{Batch 1}/attacks/
   * Extract attack_datetime field, group by date, count attacks per date
   * Returns array of { date: "MMM DD", count: <number> }
   */
  const fetchPredatorAttacksData = async (filterData = null) => {
    try {
      console.log(
        "[FetchPredatorAttacks] Starting fetch with filter:",
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
        // Default: No filter - show last 7 days
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6); // -6 to include today as day 7
        startDate.setHours(0, 0, 0, 0);
      }

      console.log(
        "[FetchPredatorAttacks] Date range:",
        startDate.toISOString(),
        "to",
        endDate.toISOString(),
      );

      // Create all dates in range with count 0
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

      const attacksByDate = {};
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const month = monthNames[currentDate.getMonth()];
        const day = currentDate.getDate();
        const dateKey = `${month} ${day.toString().padStart(2, "0")}`;

        attacksByDate[dateKey] = {
          date: dateKey,
          count: 0,
          rawDate: new Date(currentDate),
        };

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(
        "[FetchPredatorAttacks] Initialized date range:",
        Object.keys(attacksByDate),
      );

      // Fetch all batch documents from /predatorAttacks/
      const predatorAttacksRef = collection(firestoreDb, "predatorAttacks");
      const batchesSnapshot = await getDocs(predatorAttacksRef);

      console.log(
        `[FetchPredatorAttacks] Found ${batchesSnapshot.docs.length} batches in predatorAttacks`,
      );

      let totalAttacksProcessed = 0;

      // Iterate through each batch and fetch its attacks subcollection
      for (const batchDoc of batchesSnapshot.docs) {
        const batchId = batchDoc.id;
        console.log(`[FetchPredatorAttacks] Processing batch: ${batchId}`);

        try {
          // Fetch attacks subcollection for this batch
          const attacksRef = collection(
            firestoreDb,
            "predatorAttacks",
            batchId,
            "attacks",
          );
          const attacksSnapshot = await getDocs(attacksRef);

          console.log(
            `[FetchPredatorAttacks] Found ${attacksSnapshot.docs.length} attack documents in batch ${batchId}`,
          );

          // Process attacks and increment counts for dates in range
          attacksSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const attackDatetime = data.attack_datetime;

            if (!attackDatetime) {
              console.warn(
                `[FetchPredatorAttacks] Document ${doc.id} in batch ${batchId} missing attack_datetime`,
              );
              return;
            }

            // Convert Firestore Timestamp to Date
            let attackDate;
            try {
              if (
                attackDatetime.toDate &&
                typeof attackDatetime.toDate === "function"
              ) {
                attackDate = attackDatetime.toDate();
              } else if (attackDatetime.seconds) {
                attackDate = new Date(attackDatetime.seconds * 1000);
              } else if (attackDatetime instanceof Date) {
                attackDate = attackDatetime;
              } else {
                attackDate = new Date(attackDatetime);
              }

              // Validate that we got a valid date
              if (isNaN(attackDate.getTime())) {
                console.warn(
                  `[FetchPredatorAttacks] Document ${doc.id} in batch ${batchId} has invalid date:`,
                  attackDatetime,
                );
                return;
              }

              // Check if attack date is within filter range
              if (attackDate < startDate || attackDate > endDate) {
                console.log(
                  `[FetchPredatorAttacks] Skipping attack in batch ${batchId} outside date range: ${attackDate}`,
                );
                return;
              }

              const month = monthNames[attackDate.getMonth()];
              const day = attackDate.getDate();

              // Additional validation
              if (!month || isNaN(day)) {
                console.warn(
                  `[FetchPredatorAttacks] Document ${doc.id} in batch ${batchId} produced invalid month/day:`,
                  { month, day, attackDate },
                );
                return;
              }

              const dateKey = `${month} ${day.toString().padStart(2, "0")}`;

              // Increment count for this date (it already exists from initialization)
              if (attacksByDate[dateKey]) {
                attacksByDate[dateKey].count++;
                totalAttacksProcessed++;
                console.log(
                  `[FetchPredatorAttacks] Processed attack in batch ${batchId} on ${dateKey}, total count now: ${attacksByDate[dateKey].count}`,
                );
              }
            } catch (error) {
              console.warn(
                `[FetchPredatorAttacks] Error processing attack_datetime for document ${doc.id} in batch ${batchId}:`,
                error,
              );
            }
          });
        } catch (error) {
          console.warn(
            `[FetchPredatorAttacks] Error fetching attacks for batch ${batchId}:`,
            error,
          );
        }
      }

      console.log(
        `[FetchPredatorAttacks] Total attacks processed across all batches: ${totalAttacksProcessed}`,
      );

      // Convert to array and sort by date
      const attacksArray = Object.values(attacksByDate)
        .sort((a, b) => a.rawDate - b.rawDate)
        .map(({ date, count }) => ({ date, count }));

      console.log(
        "[FetchPredatorAttacks] Final attacks by date:",
        attacksArray,
      );

      setPredatorAttacksData(attacksArray);
      return attacksArray;
    } catch (error) {
      console.error("[FetchPredatorAttacks] Error:", error);
      setPredatorAttacksData([]);
      return [];
    }
  };

  /**
   * Fetch total predator attacks count from all batches
   * Queries all subcollections "attacks" under every batch inside "predatorAttacks"
   * Returns total count of all attack documents across all batches
   */
  const fetchTotalPredatorAttacksCount = async () => {
    try {
      console.log("[FetchTotalPredatorAttacks] Starting count fetch...");

      const predatorAttacksRef = collection(firestoreDb, "predatorAttacks");
      const batchesSnapshot = await getDocs(predatorAttacksRef);

      let totalAttacks = 0;

      console.log(
        `[FetchTotalPredatorAttacks] Found ${batchesSnapshot.docs.length} batches`,
      );

      // Iterate through each batch and fetch its attacks subcollection
      for (const batchDoc of batchesSnapshot.docs) {
        const batchId = batchDoc.id;

        try {
          // Fetch attacks subcollection for this batch
          const attacksRef = collection(
            firestoreDb,
            "predatorAttacks",
            batchId,
            "attacks",
          );
          const attacksSnapshot = await getDocs(attacksRef);

          const batchAttackCount = attacksSnapshot.docs.length;
          totalAttacks += batchAttackCount;

          console.log(
            `[FetchTotalPredatorAttacks] Batch ${batchId}: ${batchAttackCount} attacks`,
          );
        } catch (error) {
          console.warn(
            `[FetchTotalPredatorAttacks] Error fetching attacks for batch ${batchId}:`,
            error,
          );
        }
      }

      console.log(
        `[FetchTotalPredatorAttacks] Total attacks across all batches: ${totalAttacks}`,
      );

      setTotalPredatorAttacks(totalAttacks);
      return totalAttacks;
    } catch (error) {
      console.error("[FetchTotalPredatorAttacks] Error:", error);
      setTotalPredatorAttacks(0);
      return 0;
    }
  };

  /**
   * Fetch attacks per batch from /predatorAttacks/{batchId}/attacks/
   * Queries all batches, counts attacks per batch (filtered by date range if provided)
   * Returns sorted array
   */
  const fetchAttacksPerBatchData = async (dateFilter = null) => {
    try {
      console.log(
        "[FetchAttacksPerBatch] Starting fetch...",
        dateFilter
          ? `from ${dateFilter.startDate} to ${dateFilter.endDate}`
          : "no filter",
      );

      // First, fetch all batches from brooderInfo and initialize map with 0 attacks
      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);

      const batchAttackMap = {};

      // Initialize all batches with 0 attacks
      brooderSnapshot.docs.forEach((brooderDoc) => {
        const batchId = brooderDoc.id;
        batchAttackMap[batchId] = 0;
      });

      console.log(
        "[FetchAttacksPerBatch] Initialized",
        brooderSnapshot.docs.length,
        "batches from brooderInfo",
      );

      const predatorAttacksRef = collection(firestoreDb, "predatorAttacks");
      const batchesSnapshot = await getDocs(predatorAttacksRef);

      console.log(
        `[FetchAttacksPerBatch] Found ${batchesSnapshot.docs.length} batches with attacks`,
      );

      // Parse date range if provided
      let startDateObj = null;
      let endDateObj = null;
      if (dateFilter && dateFilter.startDate && dateFilter.endDate) {
        const [startYear, startMonth, startDay] = dateFilter.startDate
          .split("-")
          .map(Number);
        startDateObj = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);

        const [endYear, endMonth, endDay] = dateFilter.endDate
          .split("-")
          .map(Number);
        endDateObj = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

        console.log(
          `[FetchAttacksPerBatch] Filtering between ${startDateObj} and ${endDateObj}`,
        );
      }

      // Iterate through each batch and fetch its attacks subcollection
      for (const batchDoc of batchesSnapshot.docs) {
        const batchId = batchDoc.id;

        try {
          // Fetch attacks subcollection for this batch
          const attacksRef = collection(
            firestoreDb,
            "predatorAttacks",
            batchId,
            "attacks",
          );
          const attacksSnapshot = await getDocs(attacksRef);

          // Filter attacks by date range if provided
          let attackCount = 0;
          attacksSnapshot.docs.forEach((doc) => {
            if (startDateObj && endDateObj) {
              const data = doc.data();
              let attackDate = null;

              // Convert attack_datetime to Date
              if (data.attack_datetime?.toDate) {
                attackDate = data.attack_datetime.toDate();
              } else if (data.attack_datetime?.seconds) {
                attackDate = new Date(data.attack_datetime.seconds * 1000);
              } else if (data.attack_datetime) {
                attackDate = new Date(data.attack_datetime);
              }

              // Count only if within date range
              if (
                attackDate &&
                attackDate >= startDateObj &&
                attackDate <= endDateObj
              ) {
                attackCount++;
              }
            } else {
              // No filter, count all attacks
              attackCount++;
            }
          });

          batchAttackMap[batchId] = attackCount;

          console.log(
            `[FetchAttacksPerBatch] Batch ${batchId}: ${attackCount} attacks`,
          );
        } catch (error) {
          console.warn(
            `[FetchAttacksPerBatch] Error fetching attacks for batch ${batchId}:`,
            error,
          );
          batchAttackMap[batchId] = 0;
        }
      }

      // Convert map to sorted array
      const batchArray = Object.entries(batchAttackMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([batchId, attacks]) => ({
          batchId,
          attacks,
        }));

      console.log(
        "[FetchAttacksPerBatch] Final batch attack data:",
        batchArray,
      );

      setAttacksPerBatchData(batchArray);
      return batchArray;
    } catch (error) {
      console.error("[FetchAttacksPerBatch] Error:", error);
      setAttacksPerBatchData([]);
      return [];
    }
  };

  /**
   * Fetch and categorize predator types from all attacks
   *
   * Fetches all attack documents from /predatorAttacks/{BatchId}/attacks/
   * Extracts predator_type field and categorizes into: Dog, Cat, Rat, Snake, Other
   * Calculates percentages based on date range filter
   * Default filter: last 7 days
   */
  const fetchPredatorTypesData = async (filterData = null) => {
    try {
      console.log(
        "[FetchPredatorTypes] Starting fetch with filter:",
        filterData,
      );

      setIsLoadingPredatorTypes(true);
      setPredatorTypesError(null);

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
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Default: last 7 days
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6); // -6 to include today as day 7
        startDate.setHours(0, 0, 0, 0);
      }

      console.log(
        "[FetchPredatorTypes] Date range:",
        startDate.toISOString(),
        "to",
        endDate.toISOString(),
      );

      // Initialize predator type counts
      const predatorCounts = {
        dog: 0,
        cat: 0,
        rat: 0,
        snake: 0,
        other: 0,
      };

      // Fetch all batch documents from /predatorAttacks/
      const predatorAttacksRef = collection(firestoreDb, "predatorAttacks");
      const batchesSnapshot = await getDocs(predatorAttacksRef);

      console.log(
        `[FetchPredatorTypes] Found ${batchesSnapshot.docs.length} batches in predatorAttacks`,
      );

      let totalAttacksProcessed = 0;

      // Iterate through each batch and fetch its attacks subcollection
      for (const batchDoc of batchesSnapshot.docs) {
        const batchId = batchDoc.id;
        console.log(`[FetchPredatorTypes] Processing batch: ${batchId}`);

        try {
          // Fetch attacks subcollection for this batch
          const attacksRef = collection(
            firestoreDb,
            "predatorAttacks",
            batchId,
            "attacks",
          );
          const attacksSnapshot = await getDocs(attacksRef);

          console.log(
            `[FetchPredatorTypes] Found ${attacksSnapshot.docs.length} attack documents in batch ${batchId}`,
          );

          // Process attacks and categorize predator types
          attacksSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const attackDatetime = data.attack_datetime;
            const predatorType = data.predator_type;

            if (!attackDatetime) {
              console.warn(
                `[FetchPredatorTypes] Document ${doc.id} in batch ${batchId} missing attack_datetime`,
              );
              return;
            }

            if (!predatorType) {
              console.warn(
                `[FetchPredatorTypes] Document ${doc.id} in batch ${batchId} missing predator_type`,
              );
              return;
            }

            // Convert Firestore Timestamp to Date
            let attackDate;
            try {
              if (
                attackDatetime.toDate &&
                typeof attackDatetime.toDate === "function"
              ) {
                attackDate = attackDatetime.toDate();
              } else if (attackDatetime.seconds) {
                attackDate = new Date(attackDatetime.seconds * 1000);
              } else if (attackDatetime instanceof Date) {
                attackDate = attackDatetime;
              } else {
                attackDate = new Date(attackDatetime);
              }

              // Validate that we got a valid date
              if (isNaN(attackDate.getTime())) {
                console.warn(
                  `[FetchPredatorTypes] Document ${doc.id} in batch ${batchId} has invalid date:`,
                  attackDatetime,
                );
                return;
              }

              // Check if attack date is within filter range
              if (attackDate < startDate || attackDate > endDate) {
                console.log(
                  `[FetchPredatorTypes] Skipping attack in batch ${batchId} outside date range: ${attackDate}`,
                );
                return;
              }

              // Categorize predator type (normalize to lowercase for comparison)
              const predatorTypeNormalized = predatorType.toLowerCase().trim();

              if (predatorTypeNormalized.includes("dog")) {
                predatorCounts.dog++;
              } else if (predatorTypeNormalized.includes("cat")) {
                predatorCounts.cat++;
              } else if (predatorTypeNormalized.includes("rat")) {
                predatorCounts.rat++;
              } else if (predatorTypeNormalized.includes("snake")) {
                predatorCounts.snake++;
              } else {
                predatorCounts.other++;
              }

              totalAttacksProcessed++;
              console.log(
                `[FetchPredatorTypes] Categorized ${predatorType} in batch ${batchId}, total processed: ${totalAttacksProcessed}`,
              );
            } catch (error) {
              console.warn(
                `[FetchPredatorTypes] Error processing attack_datetime for document ${doc.id} in batch ${batchId}:`,
                error,
              );
            }
          });
        } catch (error) {
          console.warn(
            `[FetchPredatorTypes] Error fetching attacks for batch ${batchId}:`,
            error,
          );
        }
      }

      console.log(
        `[FetchPredatorTypes] Total attacks processed across all batches: ${totalAttacksProcessed}`,
      );

      // Calculate total attacks
      const totalAttacks =
        predatorCounts.dog +
        predatorCounts.cat +
        predatorCounts.rat +
        predatorCounts.snake +
        predatorCounts.other;

      console.log("[FetchPredatorTypes] Total attacks:", totalAttacks);
      console.log("[FetchPredatorTypes] Predator counts:", predatorCounts);

      // If no data, show empty state
      if (totalAttacks === 0) {
        console.log(
          "[FetchPredatorTypes] No attacks found in date range, showing empty state",
        );
        setPredatorTypesData([
          { name: "Dog", population: 0, color: "#154785" },
          { name: "Cat", population: 0, color: "#FFC107" },
          { name: "Snake", population: 0, color: "#F44336" },
          { name: "Rat", population: 0, color: "#4CAF50" },
          { name: "Other", population: 0, color: "#E91E63" },
        ]);
        setIsLoadingPredatorTypes(false);
        return [];
      }

      // Calculate percentages
      const dogPct = ((predatorCounts.dog / totalAttacks) * 100).toFixed(1);
      const catPct = ((predatorCounts.cat / totalAttacks) * 100).toFixed(1);
      const snakePct = ((predatorCounts.snake / totalAttacks) * 100).toFixed(1);
      const ratPct = ((predatorCounts.rat / totalAttacks) * 100).toFixed(1);
      const otherPct = ((predatorCounts.other / totalAttacks) * 100).toFixed(1);

      // Build predator types data array
      const updatedPredatorTypesData = [
        {
          name: "Dog",
          population: parseFloat(dogPct),
          count: predatorCounts.dog,
          color: "#154785",
        },
        {
          name: "Cat",
          population: parseFloat(catPct),
          count: predatorCounts.cat,
          color: "#FFC107",
        },
        {
          name: "Snake",
          population: parseFloat(snakePct),
          count: predatorCounts.snake,
          color: "#F44336",
        },
        {
          name: "Rat",
          population: parseFloat(ratPct),
          count: predatorCounts.rat,
          color: "#4CAF50",
        },
        {
          name: "Other",
          population: parseFloat(otherPct),
          count: predatorCounts.other,
          color: "#E91E63",
        },
      ];

      console.log(
        "[FetchPredatorTypes] Final predator types data:",
        updatedPredatorTypesData,
      );

      setPredatorTypesData(updatedPredatorTypesData);
      setIsLoadingPredatorTypes(false);
      return updatedPredatorTypesData;
    } catch (error) {
      console.error("[FetchPredatorTypes] Error:", error);
      setPredatorTypesError(
        error.message || "Failed to fetch predator types data",
      );
      setPredatorTypesData([
        { name: "Dog", population: 0, color: "#154785" },
        { name: "Cat", population: 0, color: "#FFC107" },
        { name: "Snake", population: 0, color: "#F44336" },
        { name: "Rat", population: 0, color: "#4CAF50" },
        { name: "Other", population: 0, color: "#E91E63" },
      ]);
      setIsLoadingPredatorTypes(false);
      return [];
    }
  };

  /**
   * Fetch and calculate mortality per batch statistics filtered by date range
   *
   * Fetches all records from /mortality/{BatchId}/records and sums the count field
   * for each batch within the selected date range (based on createdAt/timestamp field)
   * Returns array of batch data with total deaths per batch
   */
  const fetchMortalityBatchData = async (filterData = null) => {
    try {
      console.log(
        "[FetchMortalityPerBatch] Starting fetch with filter:",
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
        "[FetchMortalityPerBatch] Date range:",
        startDate.toISOString(),
        "to",
        endDate.toISOString(),
      );

      // First, fetch all batches from brooderInfo and initialize map with 0 deaths
      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);

      const batchDeathsMap = {}; // Map to store total deaths per batch

      // Initialize all batches with 0 deaths
      brooderSnapshot.docs.forEach((brooderDoc) => {
        const batchId = brooderDoc.id;
        batchDeathsMap[batchId] = {
          batchId: batchId,
          deaths: 0,
        };
      });

      console.log(
        "[FetchMortalityPerBatch] Initialized",
        brooderSnapshot.docs.length,
        "batches from brooderInfo",
      );

      // Use collectionGroup to query all records directly from /mortality/{BatchName}/records
      // No need to fetch from brooderInfo - extract batchId from record data
      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordsSnapshot = await getDocs(recordsRef);

      console.log(
        "[FetchMortalityPerBatch] Found",
        recordsSnapshot.docs.length,
        "total mortality records",
      );

      // Process all records and aggregate deaths by batch
      recordsSnapshot.docs.forEach((recordDoc) => {
        const recordData = recordDoc.data();
        const batchId = recordData.batchId; // Extract batchId from record data
        const count = recordData.count || 0;

        console.log(
          `[FetchMortalityPerBatch] Processing record from batch: ${batchId}`,
        );

        // Parse timestamp (report date) for date filtering
        let recordDate = null;
        if (recordData.timestamp) {
          if (recordData.timestamp.toDate) {
            recordDate = recordData.timestamp.toDate();
          } else if (recordData.timestamp.seconds) {
            recordDate = new Date(recordData.timestamp.seconds * 1000);
          }
        }

        // Also try using createdAt as fallback
        if (!recordDate && recordData.createdAt) {
          if (recordData.createdAt.toDate) {
            recordDate = recordData.createdAt.toDate();
          } else if (recordData.createdAt.seconds) {
            recordDate = new Date(recordData.createdAt.seconds * 1000);
          }
        }

        // Filter by date range
        if (recordDate) {
          // Convert UTC timestamp to GMT+8 for comparison
          const recordDateGMT8 = new Date(
            recordDate.getTime() + 8 * 60 * 60 * 1000,
          );
          const recordDateOnly = new Date(
            recordDateGMT8.getFullYear(),
            recordDateGMT8.getMonth(),
            recordDateGMT8.getDate(),
          );

          if (recordDateOnly >= startDate && recordDateOnly <= endDate) {
            // Update batch deaths in map (batch was already initialized)
            if (batchDeathsMap[batchId]) {
              batchDeathsMap[batchId].deaths += count;
            }
          }
        }
      });

      console.log("[FetchMortalityPerBatch] Batch deaths map:", batchDeathsMap);

      // Convert map to sorted array
      const batchArray = Object.values(batchDeathsMap).sort((a, b) =>
        a.batchId.localeCompare(b.batchId),
      );

      console.log("[FetchMortalityPerBatch] Final batch data:", batchArray);

      setMortalityBatchData(batchArray);
    } catch (error) {
      console.error("[FetchMortalityPerBatch] Error:", error);
      setMortalityBatchData([]);
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
   * Uses date range from filter if set, otherwise defaults to last 7 days
   */
  const generateMortalityReportPDF = async () => {
    // Get date range from filter or use default (last 7 days)
    let startDateStr, endDateStr;

    console.log(
      "[GenerateMortalityReportPDF] Starting mortality report generation",
    );

    // Helper function to convert date to string format (handles both Date objects and strings)
    const convertDateToString = (date) => {
      console.log(
        "[GenerateMortalityReportPDF] Converting date:",
        date,
        "Type:",
        typeof date,
        "Is Date?",
        date instanceof Date,
      );

      if (!date) {
        console.error(
          "[GenerateMortalityReportPDF] Date is null or undefined!",
        );
        return null;
      }

      // If already a string, return it
      if (typeof date === "string") {
        console.log(
          "[GenerateMortalityReportPDF] Date is already a string:",
          date,
        );
        return date.substring(0, 10); // Extract YYYY-MM-DD
      }

      // If it's a Date object, convert it
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }

      console.error(
        "[GenerateMortalityReportPDF] Unexpected date type:",
        typeof date,
      );
      return null;
    };

    if (
      chartFilters["mortality"]?.startDate &&
      chartFilters["mortality"]?.endDate
    ) {
      startDateStr = convertDateToString(chartFilters["mortality"].startDate);
      endDateStr = convertDateToString(chartFilters["mortality"].endDate);
      console.log(
        "[GenerateMortalityReportPDF] Using filter dates:",
        startDateStr,
        "to",
        endDateStr,
      );
    } else {
      // Default: last 7 days
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      startDateStr = convertDateToString(sevenDaysAgo);
      endDateStr = convertDateToString(today);
      console.log(
        "[GenerateMortalityReportPDF] Using default dates (7 days):",
        startDateStr,
        "to",
        endDateStr,
      );
    }

    if (!startDateStr || !endDateStr) {
      console.error("[GenerateMortalityReportPDF] Failed to convert dates!");
      showAlert("error", "Error", "Failed to process date range");
      setIsGeneratingReport(false);
      return;
    }

    setIsGeneratingReport(true);
    try {
      console.log("[GenerateMortalityReportPDF] Fetching records...");
      const records = await fetchMortalityRecordsForExport(
        startDateStr,
        endDateStr,
      );
      console.log(
        "[GenerateMortalityReportPDF] Fetched",
        records.length,
        "records",
      );

      if (records.length === 0) {
        console.warn(
          "[GenerateMortalityReportPDF] No records found, showing alert",
        );
        showAlert(
          "info",
          "No Data",
          "No mortality records found for the selected date range",
        );
        setIsGeneratingReport(false);
        return;
      }

      // --- SUMMARY CALCULATIONS ---
      // 1. Most common cause of death
      const causeCount = {};
      let maxCause = "N/A";
      let maxCauseCount = 0;
      records.forEach((r) => {
        const cause = (r.causeOfDeath || "Other").trim();
        causeCount[cause] = (causeCount[cause] || 0) + (r.count || 1);
        if (causeCount[cause] > maxCauseCount) {
          maxCause = cause;
          maxCauseCount = causeCount[cause];
        }
      });
      const maxCauseDeathWord = maxCauseCount === 1 ? "death" : "deaths";

      // 2. Date with most deaths
      const dateCountMap = {}; // Maps YYYY-MM-DD to { formatted, count, dateObj }
      let maxDate = "N/A";
      let maxDateCount = 0;

      records.forEach((r) => {
        let dateObj =
          r.dateOfDeath instanceof Date
            ? r.dateOfDeath
            : r.dateOfDeath && r.dateOfDeath.toDate
              ? r.dateOfDeath.toDate()
              : new Date(r.dateOfDeath);

        if (isNaN(dateObj.getTime())) return;

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");
        const isoDate = `${year}-${month}-${day}`;
        const formattedDate = formatDateOnly(r.dateOfDeath);

        if (!dateCountMap[isoDate]) {
          dateCountMap[isoDate] = {
            formatted: formattedDate,
            count: 0,
            dateObj,
          };
        }
        dateCountMap[isoDate].count += r.count || 1;

        if (dateCountMap[isoDate].count > maxDateCount) {
          maxDate = formattedDate;
          maxDateCount = dateCountMap[isoDate].count;
        }
      });

      const maxDateDeathWord = maxDateCount === 1 ? "death" : "deaths";
      const maxWeekdayDeathWord = maxWeekdayCount === 1 ? "death" : "deaths";

      // 3. Generate all dates in the range, including zeros
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const allDatesMap = {};

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const isoDate = `${year}-${month}-${day}`;

        if (dateCountMap[isoDate]) {
          allDatesMap[isoDate] = dateCountMap[isoDate];
        } else {
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
          const formattedDate = `${months[d.getMonth()]} ${d.getDate()}, ${year}`;
          allDatesMap[isoDate] = {
            formatted: formattedDate,
            count: 0,
            dateObj: new Date(d),
          };
        }
      }

      // 4. Generate daily trend with day of week
      const isoDateKeys = Object.keys(allDatesMap).sort();
      const weekdayNamesArray = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      let prevCount = null;
      const dailyTrend = isoDateKeys.map((isoDate) => {
        const { formatted, count, dateObj } = allDatesMap[isoDate];
        let trend = "";
        let percentageChange = "";
        if (prevCount !== null) {
          if (prevCount === 0 && count > 0) {
            // If previous was 0 and current has deaths, mark as new deaths
            trend = "New";
            percentageChange = "";
          } else if (prevCount > 0) {
            // Calculate percentage change normally
            const rawPercentage = ((count - prevCount) / prevCount) * 100;
            if (count > prevCount) {
              trend = "↑";
              percentageChange = Number.isInteger(rawPercentage)
                ? rawPercentage.toString()
                : rawPercentage.toFixed(1);
            } else if (count < prevCount) {
              trend = "↓";
              percentageChange = Number.isInteger(rawPercentage)
                ? rawPercentage.toString()
                : rawPercentage.toFixed(1);
            } else {
              trend = "";
              percentageChange = "0";
            }
          } else {
            // prevCount > 0 is false and not the "new" case
            trend = "";
            percentageChange = "";
          }
        } else {
          trend = "";
          percentageChange = "";
        }
        // Format date with day of week (e.g., Feb 6, 2026 (Friday))
        const dayOfWeek = weekdayNamesArray[dateObj.getDay()];
        const formattedDateWithDay = `${formatted} (${dayOfWeek})`;
        prevCount = count;
        return { date: formattedDateWithDay, count, trend, percentageChange };
      });

      // 4. Day of week with most deaths
      const weekdayCount = {};
      const weekdayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      let maxWeekday = "N/A";
      let maxWeekdayCount = 0;
      records.forEach((r) => {
        let d = r.dateOfDeath;
        let dateObj =
          d instanceof Date ? d : d && d.toDate ? d.toDate() : new Date(d);
        if (isNaN(dateObj.getTime())) return;
        const weekday = weekdayNames[dateObj.getDay()];
        weekdayCount[weekday] = (weekdayCount[weekday] || 0) + (r.count || 1);
        if (weekdayCount[weekday] > maxWeekdayCount) {
          maxWeekday = weekday;
          maxWeekdayCount = weekdayCount[weekday];
        }
      });

      // 5. Age group tally (1-5, 6-10, 11-15, ..., 41-45 days)
      const ageGroupCount = {};
      const ageGroupLabels = [];
      const groupSize = 5;
      // Initialize all age groups from 1-5 to 41-45
      for (let start = 1; start <= 41; start += 5) {
        const end = start + 4;
        const label = `${start}-${end} days`;
        ageGroupCount[label] = 0;
        ageGroupLabels.push(label);
      }
      records.forEach((r) => {
        let age = parseInt(r.daysCount, 10);
        if (isNaN(age) || age < 1) age = 1;
        // Find the appropriate age group
        let groupStart = Math.floor((age - 1) / groupSize) * groupSize + 1;
        let groupEnd = groupStart + groupSize - 1;
        // Cap at 45 days
        if (groupStart > 41) groupStart = 41;
        groupEnd = groupStart + 4;
        const label = `${groupStart}-${groupEnd} days`;
        if (ageGroupCount[label] !== undefined) {
          ageGroupCount[label] += r.count || 1;
        }
      });

      // 6. Precise mortality rate for the range
      // Calculate total deaths from the filtered records (respects date range)
      let totalDeaths = 0;
      records.forEach((r) => {
        totalDeaths += r.count || 1;
      });

      // For mortality rate, use brooderInfo to get initialChicksCount
      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);
      const batchCount = brooderSnapshot.docs.length;
      let mortalityRate = "0.00";

      if (batchCount === 1) {
        // Single batch: use direct initialChicksCount from brooderInfo
        const batchData = brooderSnapshot.docs[0].data();
        const initialChicks = batchData.initialChicksCount || 0;
        mortalityRate =
          initialChicks > 0
            ? ((totalDeaths / initialChicks) * 100).toFixed(2)
            : "0.00";
        console.log(
          `[GenerateMortalityReportPDF] Single batch mortality rate: ${mortalityRate}% (${totalDeaths}/${initialChicks})`,
        );
      } else if (batchCount > 1) {
        // Multiple batches: use combined calculation
        let totalInitialChicks = 0;
        brooderSnapshot.docs.forEach((doc) => {
          const batchData = doc.data();
          totalInitialChicks += batchData.initialChicksCount || 0;
        });
        mortalityRate =
          totalInitialChicks > 0
            ? ((totalDeaths / totalInitialChicks) * 100).toFixed(2)
            : "0.00";
        console.log(
          `[GenerateMortalityReportPDF] Combined mortality rate (${batchCount} batches): ${mortalityRate}% (${totalDeaths}/${totalInitialChicks})`,
        );
      }

      // --- END SUMMARY CALCULATIONS ---

      // Load logo
      console.log("[GenerateMortalityReportPDF] Loading logo asset...");
      const logoBase64 = await getLogoBase64();
      if (logoBase64) {
        console.log("[GenerateMortalityReportPDF] Logo loaded successfully");
      } else {
        console.log(
          "[GenerateMortalityReportPDF] Logo not available, continuing without it",
        );
      }

      // Create table rows - sort records chronologically by dateOfDeath
      console.log("[GenerateMortalityReportPDF] Creating table rows...");
      const sortedRecords = [...records].sort((a, b) => {
        const dateA = new Date(
          a.dateOfDeath instanceof Date
            ? a.dateOfDeath
            : a.dateOfDeath && a.dateOfDeath.toDate
              ? a.dateOfDeath.toDate()
              : new Date(a.dateOfDeath),
        );
        const dateB = new Date(
          b.dateOfDeath instanceof Date
            ? b.dateOfDeath
            : b.dateOfDeath && b.dateOfDeath.toDate
              ? b.dateOfDeath.toDate()
              : new Date(b.dateOfDeath),
        );
        return dateA - dateB;
      });
      let tableRows = "";
      sortedRecords.forEach((record, index) => {
        const dateOfDeath = formatDateOnly(record.dateOfDeath);
        const dateReported = formatDateOnly(record.timestamp);
        const causeOfDeath = record.causeOfDeath || "";
        const predatorType = record.predatorType || "";
        const customPredator = record.customPredator || "";
        const daysCount = record.daysCount || "";
        const notes = record.notes || "";
        const reportedBy = record.reportedBy || "";
        const count = record.count || 0;
        const batchId = record.batchId || "";

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

      // Add total row
      tableRows += `
        <tr style="background-color: #e8e8e8; font-weight: bold;">
          <td colspan="4" style="text-align: center;">TOTAL DEATHS</td>
          <td>${totalDeaths}</td>
          <td colspan="6"></td>
        </tr>
      `;

      // --- SUMMARY HTML BLOCK ---
      let summaryHtml = `
        <div class="mortality-summary" style="margin-bottom: 18px; font-size: 12px;">
          <div style="font-weight:bold; font-size: 14px; margin-bottom: 8px;">Mortality Report Summary</div>
          <ul style="margin-top:0; margin-bottom:10px; padding-left:18px;">
            <li><b>Mortality rate:</b> ${mortalityRate}%</li>
            <li><b>Most common cause of death:</b> ${maxCause} (${maxCauseCount} ${maxCauseDeathWord})</li>
            <li><b>Date with most deaths:</b> ${maxDate} (${maxDateCount} ${maxDateDeathWord})</li>
            <li><b>Day of week with most deaths:</b> ${maxWeekday} (${maxWeekdayCount} ${maxWeekdayDeathWord})</li>
           
          </ul>
          <div style="display: flex; gap: 20px; margin-top: 10px;">
            <div style="width: auto;">
              <div style="margin-bottom: 6px;"><b>Deaths per day </b></div>
              <table style="width: auto; font-size: 8px; border-collapse: collapse; margin-top: 6px;">
                <tr><th style="border: 1px solid #ddd; padding: 3px; background-color: #133E87; color: white; width: 130px">Date</th><th style="border: 1px solid #ddd; padding: 3px; background-color: #133E87; color: white; text-align: center; width: 50px">Deaths</th><th style="border: 1px solid #ddd; padding: 3px; background-color: #133E87; color: white; text-align: center; width: 50px">Trend</th></tr>
                ${dailyTrend
                  .map((d) => {
                    let trendDisplay = "";
                    if (d.trend === "New") {
                      trendDisplay = `<span style="color: #999;">New deaths</span>`;
                    } else if (d.trend === "↑") {
                      trendDisplay = `<span style="color: #F44336;">↑</span> <span style="color: #F44336;">+${d.percentageChange}%</span>`;
                    } else if (d.trend === "↓") {
                      trendDisplay = `<span style="color: #4CAF50;">↓</span> <span style="color: #4CAF50;">${d.percentageChange}%</span>`;
                    } else if (d.percentageChange === "0") {
                      trendDisplay = `<span style="color: #999;">→</span> <span style="color: #999;">0%</span>`;
                    }
                    return `<tr><td style="border: 1px solid #ddd; padding: 3px;">${d.date}</td><td style="border: 1px solid #ddd; padding: 3px; text-align: center;">${d.count}</td><td style="border: 1px solid #ddd; padding: 3px; text-align: center;">${trendDisplay}</td></tr>`;
                  })
                  .join("")}
                <tr style="background-color: #e8e8e8; font-weight: bold;"><td style="border: 1px solid #ddd; padding: 3px;">TOTAL</td><td style="border: 1px solid #ddd; padding: 3px; text-align: center;">${dailyTrend.reduce((sum, d) => sum + d.count, 0)}</td><td style="border: 1px solid #ddd; padding: 3px;"></td></tr>
              </table>
            </div>
            <div style="width: auto;">
              <div style="margin-bottom: 6px;"><b>Age group tally</b></div>
              <table style="width: auto; font-size: 8px; border-collapse: collapse; margin-top: 6px;">
                <tr><th style="border: 1px solid #ddd; padding: 3px; background-color: #133E87; color: white; width: 100px">Age Group</th><th style="border: 1px solid #ddd; padding: 3px; background-color: #133E87; color: white; text-align: center; width: 50px">Count</th></tr>
                ${ageGroupLabels
                  .map(
                    (label) =>
                      `<tr><td style="border: 1px solid #ddd; padding: 3px;">${label}</td><td style="border: 1px solid #ddd; padding: 3px; text-align: center;">${ageGroupCount[label]}</td></tr>`,
                  )
                  .join("")}
                <tr style="background-color: #e8e8e8; font-weight: bold;"><td style="border: 1px solid #ddd; padding: 3px;">TOTAL</td><td style="border: 1px solid #ddd; padding: 3px; text-align: center;">${ageGroupLabels.reduce((sum, label) => sum + ageGroupCount[label], 0)}</td></tr>
              </table>
            </div>
          </div>
        </div>
      `;

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
              Date Range: ${formatDateRange(startDateStr)} to ${formatDateRange(endDateStr)}<br>
              Report Generated: ${formatReportDateTime()}<br>
              Total Records: ${records.length}
            </div>
          </div>
          ${summaryHtml}
          <div style="font-weight:bold; font-size: 14px; margin-bottom: 8px;">Mortality Records</div>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Date of Death</th>
                <th>Date Reported</th>
                <th>Batch ID</th>
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
      console.log("[GenerateMortalityReportPDF] Generating PDF from HTML...");
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      console.log(
        "[GenerateMortalityReportPDF] PDF generated successfully at:",
        pdf.uri,
      );

      // Create custom filename with date
      console.log("[GenerateMortalityReportPDF] Creating custom filename...");
      const formatDate = (date) => {
        let d;
        if (typeof date === "string") {
          // If it's a string like "2026-01-25"
          const [year, month, day] = date.split("-");
          d = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));
        } else {
          d = new Date(date);
        }
        const dayStr = String(d.getDate()).padStart(2, "0");
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
        const monthStr = months[d.getMonth()];
        const year = d.getFullYear();
        return `${dayStr}-${monthStr}-${year}`;
      };

      const customFilename = `MortalityReport_${formatDate(startDateStr)}_to_${formatDate(endDateStr)}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;
      console.log("[GenerateMortalityReportPDF] Copying PDF to:", newPath);

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });
      console.log("[GenerateMortalityReportPDF] PDF copied successfully");

      // Log report generation to audit trail
      console.log("[GenerateMortalityReportPDF] Logging report generation...");
      await logReportGeneration(
        customFilename,
        "Mortality Report",
        "Generate mortality report",
        `Generated and exported mortality report for ${formatDate(startDateStr)} to ${formatDate(endDateStr)}`,
      );
      console.log("[GenerateMortalityReportPDF] Report logged successfully");

      // Share PDF with custom filename
      console.log("[GenerateMortalityReportPDF] Sharing PDF...");
      await Sharing.shareAsync(newPath);
      console.log("[GenerateMortalityReportPDF] PDF shared successfully");

      showAlert(
        "success",
        "Success",
        "Mortality report exported successfully!",
      );
    } catch (error) {
      console.error("Error generating report:", error);
      console.error("Error stack:", error.stack);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /**
   * Generate Feed Consumption Report PDF
   * Fetches feed records from feedingExecutions_logs for the selected batch,
   * groups by age, and generates a comprehensive PDF report.
   */
  const generateFeedConsumptionReportPDF = async () => {
    // Get the selected batch from the filter
    const selectedBatch = chartFilters["feed"]?.batchId;
    if (!selectedBatch) {
      showAlert("error", "Error", "Please select a batch from the filter");
      return;
    }

    setIsGeneratingFeedReport(true);
    try {
      const records = await fetchFeedRecordsForExport(selectedBatch);

      if (records.length === 0) {
        showAlert(
          "info",
          "No Data",
          "No feed records found for the selected batch",
        );
        setIsGeneratingFeedReport(false);
        return;
      }

      // Load logo
      const logoBase64 = await getLogoBase64();

      // Group by age and count consumption, also collect dates
      const ageMap = {};
      const ageDateMap = {};

      records.forEach((record) => {
        const age = record.age || "Unknown";
        if (!ageMap[age]) {
          ageMap[age] = 0;
          // Extract date from timestamp (prefer record.timestamp, fallback to record.createdAt)
          let dateObj = record.timestamp?.toDate
            ? record.timestamp.toDate()
            : record.timestamp
              ? new Date(record.timestamp)
              : record.createdAt
                ? new Date(record.createdAt)
                : null;
          if (dateObj) {
            // Format as "DD-MMM-YYYY"
            const dateStr = dateObj
              .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
              .replace(/ /g, "-");
            ageDateMap[age] = dateStr;
          } else {
            ageDateMap[age] = "";
          }
        }
        ageMap[age]++;
      });

      // Sort ages numerically
      const sortedAges = Object.keys(ageMap)
        .map((age) => {
          const numAge = parseInt(age, 10);
          return { age, numAge: isNaN(numAge) ? Infinity : numAge };
        })
        .sort((a, b) => a.numAge - b.numAge)
        .map((item) => item.age);

      // Calculate key metrics
      const consumptionValues = sortedAges.map((age) => ageMap[age]);
      const totalConsumption = consumptionValues.reduce((a, b) => a + b, 0);
      const avgConsumptionRaw =
        consumptionValues.length > 0
          ? totalConsumption / consumptionValues.length
          : 0;
      // Format avgConsumption: remove decimals if whole number
      const avgConsumption =
        avgConsumptionRaw % 1 === 0
          ? Math.floor(avgConsumptionRaw)
          : avgConsumptionRaw.toFixed(2);
      const maxConsumption = Math.max(...consumptionValues);
      const minConsumption = Math.min(...consumptionValues);

      // Find dates for highest and lowest consumptions
      let maxConsumptionDate = "";
      let minConsumptionDate = "";

      sortedAges.forEach((age) => {
        const consumption = ageMap[age];
        const date = ageDateMap[age] || "";
        if (consumption === maxConsumption && !maxConsumptionDate) {
          maxConsumptionDate = date;
        }
        if (consumption === minConsumption && !minConsumptionDate) {
          minConsumptionDate = date;
        }
      });

      // Create table rows with trend column
      let tableRows = "";

      sortedAges.forEach((age, index) => {
        const consumption = ageMap[age];
        const date = ageDateMap[age] || "";

        // Calculate day-to-day trend
        let trendHtml = "";
        if (index === 0) {
          // First day has no previous day to compare
          trendHtml = '<span style="color: #999;">—</span> ';
        } else {
          const previousConsumption = ageMap[sortedAges[index - 1]];
          const percentageChangeRaw =
            ((consumption - previousConsumption) / previousConsumption) * 100;
          // Format percentage: remove decimals if whole number
          const percentageChange =
            percentageChangeRaw % 1 === 0
              ? Math.floor(percentageChangeRaw)
              : percentageChangeRaw.toFixed(1);

          if (percentageChange > 0) {
            trendHtml = `<span style="color: #4CAF50;">↑</span> <span style="color: #4CAF50;">+${percentageChange}%</span>`;
          } else if (percentageChange < 0) {
            trendHtml = `<span style="color: #F44336;">↓</span> <span style="color: #F44336;">${percentageChange}%</span>`;
          } else {
            trendHtml =
              '<span style="color: #999;">→</span> <span style="color: #999;">0%</span>';
          }
        }

        tableRows += `
          <tr>
            <td>${date}</td>
            <td>Day ${age}</td>
            <td>${consumption}</td>
            <td>${trendHtml}</td>
          </tr>
        `;
      });

      // Add total row
      tableRows += `
        <tr style="background-color: #e8e8e8; font-weight: bold;">
          <td colspan="1" style="text-align: center;">TOTAL</td>
          <td colspan="1"></td>
          <td>${totalConsumption}</td>
          <td></td>
        </tr>
      `;

      // Fetch mortality data for overfeeding
      let totalOverFeedingDeaths = 0;
      let overFeedingMortalityHtml = "";
      try {
        const recordsRef = collectionGroup(firestoreDb, "records");
        const recordsSnapshot = await getDocs(recordsRef);

        let overFeedingRecords = [];
        recordsSnapshot.docs.forEach((recordDoc) => {
          const recordData = recordDoc.data();
          // Filter by batch and cause of death
          if (
            recordData.batchId === selectedBatch &&
            recordData.causeOfDeath === "Overfeeding"
          ) {
            // Parse dateOfDeath
            let dateOfDeath = recordData.dateOfDeath;
            if (dateOfDeath && typeof dateOfDeath.toDate === "function") {
              dateOfDeath = dateOfDeath.toDate();
            } else if (dateOfDeath && dateOfDeath.seconds) {
              dateOfDeath = new Date(dateOfDeath.seconds * 1000);
            } else if (typeof dateOfDeath === "string") {
              dateOfDeath = parseCustomDateFormat(dateOfDeath);
            }

            // Format date as DD-MMM-YYYY (without time)
            const dateOfDeathFormatted =
              dateOfDeath && dateOfDeath instanceof Date
                ? dateOfDeath
                    .toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                    .replace(/ /g, "-")
                : "Unknown";

            overFeedingRecords.push({
              dateOfDeathFormatted: dateOfDeathFormatted,
              daysCount: recordData.daysCount || "Unknown",
              count: recordData.count || 1,
            });
          }
        });

        // Calculate total overfeeding deaths
        totalOverFeedingDeaths = overFeedingRecords.reduce(
          (sum, r) => sum + r.count,
          0,
        );

        // Sort records chronologically by date (earliest first)
        overFeedingRecords.sort((a, b) => {
          // Parse date format "DD-MMM-YYYY"
          const parseDate = (dateStr) => {
            const months = {
              Jan: 0,
              Feb: 1,
              Mar: 2,
              Apr: 3,
              May: 4,
              Jun: 5,
              Jul: 6,
              Aug: 7,
              Sep: 8,
              Oct: 9,
              Nov: 10,
              Dec: 11,
            };
            const parts = dateStr.split("-");
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = months[parts[1]];
              const year = parseInt(parts[2], 10);
              return new Date(year, month, day);
            }
            return new Date(0);
          };
          const dateA = parseDate(a.dateOfDeathFormatted);
          const dateB = parseDate(b.dateOfDeathFormatted);
          return dateA - dateB;
        });

        // Generate mortality summary HTML
        if (overFeedingRecords.length > 0) {
          // Find the highest percentage
          const maxPercentage = Math.max(
            ...overFeedingRecords.map(
              (r) => (r.count / totalOverFeedingDeaths) * 100,
            ),
          );

          let mortalityTableRows = "";
          overFeedingRecords.forEach((record) => {
            const percentageRaw = (record.count / totalOverFeedingDeaths) * 100;
            // Format percentage: remove decimals if whole number
            const percentage =
              percentageRaw % 1 === 0
                ? Math.floor(percentageRaw)
                : percentageRaw.toFixed(1);
            const isHighestPercentage =
              parseFloat(percentage) === parseFloat(maxPercentage.toFixed(1));
            const percentageStyle = isHighestPercentage
              ? 'style="text-align: center; color: #F44336;"'
              : 'style="text-align: center;"';
            mortalityTableRows += `
              <tr>
                <td>Day ${record.daysCount}</td>
                <td style="text-align: center;">${record.count}</td>
                <td ${percentageStyle}>${percentage}%</td>
              </tr>
            `;
          });

          // Add total row
          mortalityTableRows += `
            <tr style="background-color: #e8e8e8; font-weight: bold;">
              <td colspan="1" style="text-align: center;">TOTAL</td>
              <td style="text-align: center;">${totalOverFeedingDeaths}</td>
              <td style="text-align: center;">100%</td>
            </tr>
          `;

          overFeedingMortalityHtml = `
            <div style="margin-top: 20px; width: 75%; margin-left: auto; margin-right: auto;">
              <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;"><br>Overfeeding-Related Mortality</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 25%;">Age at Death</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 25%;">Death Count</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 25%;">Distribution %</th>
                  </tr>
                </thead>
                <tbody>
                  ${mortalityTableRows}
                </tbody>
              </table>
            </div>
          `;
        } else {
          overFeedingMortalityHtml = `
            <div style="margin-top: 20px;">
              <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Overfeeding-Related Mortality Summary</h3>
              <p style="font-size: 11px; color: #666;">No overfeeding-related deaths recorded for this batch.</p>
            </div>
          `;
        }
      } catch (error) {
        console.error("Error fetching mortality data:", error);
        overFeedingMortalityHtml = `
          <div style="margin-top: 20px;">
            <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Overfeeding-Related Mortality Summary</h3>
            <p style="font-size: 11px; color: #666;">Unable to fetch mortality data.</p>
          </div>
        `;
      }

      // Fetch Feeding Activity Records
      let feedingActivityHtml = "";
      try {
        const feedingActivityQuery = query(
          collection(firestoreDb, "feedingExecutions_logs"),
          where("batchId", "==", selectedBatch),
        );
        const feedingActivitySnapshot = await getDocs(feedingActivityQuery);
        const feedingActivityRecords = feedingActivitySnapshot.docs.map(
          (doc) => ({
            id: doc.id,
            ...doc.data(),
          }),
        );

        if (feedingActivityRecords.length > 0) {
          // Sort records by timestamp in ascending order (earliest first)
          feedingActivityRecords.sort((a, b) => {
            const timeA = a.timestamp?.toDate
              ? a.timestamp.toDate().getTime()
              : a.timestamp
                ? new Date(a.timestamp).getTime()
                : 0;
            const timeB = b.timestamp?.toDate
              ? b.timestamp.toDate().getTime()
              : b.timestamp
                ? new Date(b.timestamp).getTime()
                : 0;
            return timeA - timeB;
          });

          let activityTableRows = "";
          feedingActivityRecords.forEach((record) => {
            const timestamp = record.timestamp?.toDate
              ? record.timestamp.toDate()
              : record.timestamp
                ? new Date(record.timestamp)
                : null;

            const dateStr = timestamp
              ? timestamp
                  .toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                  .replace(/ /g, "-")
              : "N/A";

            const timeStr = timestamp
              ? timestamp.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })
              : "N/A";

            const action = record.action || "N/A";
            const status = record.status || "N/A";

            activityTableRows += `
              <tr>
                <td style="text-align: center;">${dateStr}</td>
                <td style="text-align: center;">${timeStr}</td>
                <td style="text-align: center;">${action}</td>
                <td style="text-align: center;">${status}</td>
              </tr>
            `;
          });

          feedingActivityHtml = `
            <div style="margin-top: 20px; page-break-before: always; width: 75%; margin-left: auto; margin-right: auto;">
              <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Feeding Activity</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 22%;">Date</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 22%;">Time</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 28%;">Action</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 22%;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${activityTableRows}
                </tbody>
              </table>
            </div>
          `;
        } else {
          feedingActivityHtml = `
            <div style="margin-top: 20px;">
              <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Feeding Activity</h3>
              <p style="font-size: 11px; color: #666;">No feeding activity records found for this batch.</p>
            </div>
          `;
        }
      } catch (error) {
        console.error("Error fetching feeding activity data:", error);
        feedingActivityHtml = `
          <div style="margin-top: 20px;">
            <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Feeding Activity</h3>
            <p style="font-size: 11px; color: #666;">Unable to fetch feeding activity data.</p>
          </div>
        `;
      }

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
            .summary-title {
              font-size: 14px;
              font-weight: bold;
              color: #133E87;
              margin-bottom: 15px;
              text-align: left;
              margin-left: 12.5%;
            }
            .metrics-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 30px;
              width: 75%;
              margin-left: auto;
              margin-right: auto;
              font-size: 11px;
            }
            .metric-card {
              padding: 12px;
              background-color: white;
              border-left: 5px solid #133E87;
              border-radius: 3px;
              text-align: left;
            }
            .metric-label {
              color: #666;
              font-size: 10px;
              font-weight: normal;
              margin-bottom: 8px;
              line-height: 1.4;
            }
            .metric-value {
              color: #133E87;
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            table {
              width: 75%;
              border-collapse: collapse;
              margin-bottom: 20px;
              margin-left: auto;
              margin-right: auto;
              font-size: 11px;
              table-layout: fixed;
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
              text-align: center;
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
            <div class="report-title">Feed Consumption Report</div>
            <div class="filter-info">
              ${selectedBatch}<br>
              Report Generated: ${formatReportDateTime()}<br>
            
            </div>
          </div>

          <div class="summary-title" style="text-align: left;">Summary</div>

          <div class="metrics-container">
            <div class="metric-card">
              <div class="metric-label">Average Daily Feedings</div>
              <div class="metric-value">${avgConsumption}</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;"></div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Overfeeding Deaths</div>
              <div class="metric-value">${totalOverFeedingDeaths}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Highest Daily Feedings</div>
              <div class="metric-value">${maxConsumption}</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;">${maxConsumptionDate}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Lowest Daily Feedings</div>
              <div class="metric-value">${minConsumption}</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;">${minConsumptionDate}</div>
            </div>
          </div>
          <br> 
          <div class="summary-title" style="text-align: left;">Feeding Records</div>

          <table>
            <thead>
              <tr>
                <th style="width: 17%; text-align: center;">Date</th>
                <th style="width: 15%; text-align: center;">Age</th>
                <th style="width: 25%; text-align: center;">Number of Feedings</th>
                <th style="width: 15%; text-align: center;">Trend</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          ${overFeedingMortalityHtml}

          ${feedingActivityHtml}
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Create custom filename with batch and date
      const customFilename = `FeedConsumptionReport_${selectedBatch}_${new Date().toLocaleDateString().replace(/\//g, "-")}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation to audit trail
      await logReportGeneration(
        customFilename,
        "Feed Consumption Report",
        "Generate feed consumption report",
        `Generated and exported feed consumption report for batch ${selectedBatch} on ${new Date().toLocaleDateString()}`,
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Feed Consumption report exported successfully!",
      );
    } catch (error) {
      console.error("Error generating feed report:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingFeedReport(false);
    }
  };

  /**
   * Generate Water Consumption Report PDF
   * Fetches water records from wateringExecutions_logs for the selected batch,
   * groups by age, and generates a comprehensive PDF report.
   */
  const generateWaterConsumptionReportPDF = async () => {
    // Get the selected batch from the filter
    const selectedBatch = chartFilters["water"]?.batchId;
    if (!selectedBatch) {
      showAlert("error", "Error", "Please select a batch from the filter");
      return;
    }

    setIsGeneratingFeedReport(true);
    try {
      const records = await fetchWaterRecordsForExport(selectedBatch);

      if (records.length === 0) {
        showAlert(
          "info",
          "No Data",
          "No water records found for the selected batch",
        );
        setIsGeneratingFeedReport(false);
        return;
      }

      // Load logo
      const logoBase64 = await getLogoBase64();

      // Group by age and count consumption, also collect dates
      const ageMap = {};
      const ageDateMap = {};

      records.forEach((record) => {
        const age = record.age || "Unknown";
        if (!ageMap[age]) {
          ageMap[age] = 0;
          // Extract date from timestamp (prefer record.timestamp, fallback to record.createdAt)
          let dateObj = record.timestamp?.toDate
            ? record.timestamp.toDate()
            : record.timestamp
              ? new Date(record.timestamp)
              : record.createdAt
                ? new Date(record.createdAt)
                : null;
          if (dateObj) {
            // Format as "DD-MMM-YYYY"
            const dateStr = dateObj
              .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
              .replace(/ /g, "-");
            ageDateMap[age] = dateStr;
          } else {
            ageDateMap[age] = "";
          }
        }
        ageMap[age]++;
      });

      // Sort ages numerically
      const sortedAges = Object.keys(ageMap)
        .map((age) => {
          const numAge = parseInt(age, 10);
          return { age, numAge: isNaN(numAge) ? Infinity : numAge };
        })
        .sort((a, b) => a.numAge - b.numAge)
        .map((item) => item.age);

      // Calculate key metrics
      const consumptionValues = sortedAges.map((age) => ageMap[age]);
      const totalConsumption = consumptionValues.reduce((a, b) => a + b, 0);
      const avgConsumptionRaw =
        consumptionValues.length > 0
          ? totalConsumption / consumptionValues.length
          : 0;
      // Format avgConsumption: remove decimals if whole number
      const avgConsumption =
        avgConsumptionRaw % 1 === 0
          ? Math.floor(avgConsumptionRaw)
          : avgConsumptionRaw.toFixed(2);
      const maxConsumption = Math.max(...consumptionValues);
      const minConsumption = Math.min(...consumptionValues);

      // Find dates for highest and lowest consumptions
      let maxConsumptionDate = "";
      let minConsumptionDate = "";

      sortedAges.forEach((age) => {
        const consumption = ageMap[age];
        const date = ageDateMap[age] || "";
        if (consumption === maxConsumption && !maxConsumptionDate) {
          maxConsumptionDate = date;
        }
        if (consumption === minConsumption && !minConsumptionDate) {
          minConsumptionDate = date;
        }
      });

      // Create table rows with trend column
      let tableRows = "";

      sortedAges.forEach((age, index) => {
        const consumption = ageMap[age];
        const date = ageDateMap[age] || "";

        // Calculate day-to-day trend
        let trendHtml = "";
        if (index === 0) {
          // First day has no previous day to compare
          trendHtml = '<span style="color: #999;">—</span> ';
        } else {
          const previousConsumption = ageMap[sortedAges[index - 1]];
          const percentageChangeRaw =
            ((consumption - previousConsumption) / previousConsumption) * 100;
          // Format percentage: remove decimals if whole number
          const percentageChange =
            percentageChangeRaw % 1 === 0
              ? Math.floor(percentageChangeRaw)
              : percentageChangeRaw.toFixed(1);

          if (percentageChange > 0) {
            trendHtml = `<span style="color: #4CAF50;">↑</span> <span style="color: #4CAF50;">+${percentageChange}%</span>`;
          } else if (percentageChange < 0) {
            trendHtml = `<span style="color: #F44336;">↓</span> <span style="color: #F44336;">${percentageChange}%</span>`;
          } else {
            trendHtml =
              '<span style="color: #999;">→</span> <span style="color: #999;">0%</span>';
          }
        }

        tableRows += `
          <tr>
            <td>${date}</td>
            <td>Day ${age}</td>
            <td>${consumption}</td>
            <td>${trendHtml}</td>
          </tr>
        `;
      });

      // Add total row
      tableRows += `
        <tr style="background-color: #e8e8e8; font-weight: bold;">
          <td colspan="1" style="text-align: center;">TOTAL</td>
          <td colspan="1"></td>
          <td>${totalConsumption}</td>
          <td></td>
        </tr>
      `;

      // Fetch mortality data for dehydration
      let totalDehydrationDeaths = 0;
      let dehydrationMortalityHtml = "";
      try {
        const recordsRef = collectionGroup(firestoreDb, "records");
        const recordsSnapshot = await getDocs(recordsRef);

        let dehydrationRecords = [];
        recordsSnapshot.docs.forEach((recordDoc) => {
          const recordData = recordDoc.data();
          // Filter by batch and cause of death
          if (
            recordData.batchId === selectedBatch &&
            recordData.causeOfDeath === "Dehydration"
          ) {
            // Parse dateOfDeath
            let dateOfDeath = recordData.dateOfDeath;
            if (dateOfDeath && typeof dateOfDeath.toDate === "function") {
              dateOfDeath = dateOfDeath.toDate();
            } else if (dateOfDeath && dateOfDeath.seconds) {
              dateOfDeath = new Date(dateOfDeath.seconds * 1000);
            } else if (typeof dateOfDeath === "string") {
              dateOfDeath = parseCustomDateFormat(dateOfDeath);
            }

            // Format date as DD-MMM-YYYY (without time)
            const dateOfDeathFormatted =
              dateOfDeath && dateOfDeath instanceof Date
                ? dateOfDeath
                    .toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                    .replace(/ /g, "-")
                : "Unknown";

            dehydrationRecords.push({
              dateOfDeathFormatted: dateOfDeathFormatted,
              daysCount: recordData.daysCount || "Unknown",
              count: recordData.count || 1,
            });
          }
        });

        // Calculate total dehydration deaths
        totalDehydrationDeaths = dehydrationRecords.reduce(
          (sum, r) => sum + r.count,
          0,
        );

        // Combine records with same daysCount (Age at Death)
        const combinedRecords = {};
        dehydrationRecords.forEach((record) => {
          const key = record.daysCount;
          if (!combinedRecords[key]) {
            combinedRecords[key] = {
              daysCount: record.daysCount,
              count: 0,
              dateOfDeathFormatted: record.dateOfDeathFormatted,
            };
          }
          combinedRecords[key].count += record.count;
        });

        // Convert back to array and sort numerically by daysCount
        const sortedDehydrationRecords = Object.values(combinedRecords).sort(
          (a, b) => {
            const aNum = parseInt(a.daysCount, 10);
            const bNum = parseInt(b.daysCount, 10);
            return (
              (isNaN(aNum) ? Infinity : aNum) - (isNaN(bNum) ? Infinity : bNum)
            );
          },
        );

        // Generate mortality summary HTML
        if (sortedDehydrationRecords.length > 0) {
          // Find the highest percentage
          const maxPercentage = Math.max(
            ...sortedDehydrationRecords.map(
              (r) => (r.count / totalDehydrationDeaths) * 100,
            ),
          );

          let mortalityTableRows = "";
          sortedDehydrationRecords.forEach((record) => {
            const percentageRaw = (record.count / totalDehydrationDeaths) * 100;
            // Format percentage: remove decimals if whole number
            const percentage =
              percentageRaw % 1 === 0
                ? Math.floor(percentageRaw)
                : percentageRaw.toFixed(1);
            const isHighestPercentage =
              parseFloat(percentage) === parseFloat(maxPercentage.toFixed(1));
            const percentageStyle = isHighestPercentage
              ? 'style="text-align: center; color: #F44336;"'
              : 'style="text-align: center;"';
            mortalityTableRows += `
              <tr>
                <td>Day ${record.daysCount}</td>
                <td style="text-align: center;">${record.count}</td>
                <td ${percentageStyle}>${percentage}%</td>
              </tr>
            `;
          });

          // Add total row
          mortalityTableRows += `
            <tr style="background-color: #e8e8e8; font-weight: bold;">
              <td colspan="1" style="text-align: center;">TOTAL</td>
              <td style="text-align: center;">${totalDehydrationDeaths}</td>
              <td style="text-align: center;">100%</td>
            </tr>
          `;

          dehydrationMortalityHtml = `
            <div style="margin-top: 20px; width: 75%; margin-left: auto; margin-right: auto;">
              <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;"><br>Dehydration-Related Mortality</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 25%;">Age at Death</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 25%;">Death Count</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 25%;">Distribution %</th>
                  </tr>
                </thead>
                <tbody>
                  ${mortalityTableRows}
                </tbody>
              </table>
            </div>
          `;
        } else {
          dehydrationMortalityHtml = `
            <div style="margin-top: 20px;">
              <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Dehydration-Related Mortality Summary</h3>
              <p style="font-size: 11px; color: #666;">No dehydration-related deaths recorded for this batch.</p>
            </div>
          `;
        }
      } catch (error) {
        console.error("Error fetching mortality data:", error);
        dehydrationMortalityHtml = `
          <div style="margin-top: 20px;">
            <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Dehydration-Related Mortality Summary</h3>
            <p style="font-size: 11px; color: #666;">Unable to fetch mortality data.</p>
          </div>
        `;
      }

      // Fetch Watering Activity Records
      let wateringActivityHtml = "";
      try {
        const wateringActivityQuery = query(
          collection(firestoreDb, "wateringExecutions_logs"),
          where("batchId", "==", selectedBatch),
        );
        const wateringActivitySnapshot = await getDocs(wateringActivityQuery);
        const wateringActivityRecords = wateringActivitySnapshot.docs.map(
          (doc) => ({
            id: doc.id,
            ...doc.data(),
          }),
        );

        if (wateringActivityRecords.length > 0) {
          // Sort records by timestamp in ascending order (earliest first)
          wateringActivityRecords.sort((a, b) => {
            const timeA = a.timestamp?.toDate
              ? a.timestamp.toDate().getTime()
              : a.timestamp
                ? new Date(a.timestamp).getTime()
                : 0;
            const timeB = b.timestamp?.toDate
              ? b.timestamp.toDate().getTime()
              : b.timestamp
                ? new Date(b.timestamp).getTime()
                : 0;
            return timeA - timeB;
          });

          let activityTableRows = "";
          wateringActivityRecords.forEach((record) => {
            const timestamp = record.timestamp?.toDate
              ? record.timestamp.toDate()
              : record.timestamp
                ? new Date(record.timestamp)
                : null;

            const dateStr = timestamp
              ? timestamp
                  .toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                  .replace(/ /g, "-")
              : "N/A";

            const timeStr = timestamp
              ? timestamp.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })
              : "N/A";

            const action = record.action || "N/A";
            const mode = record.mode || "N/A";
            const status = record.status || "N/A";

            activityTableRows += `
              <tr>
                <td style="text-align: center;">${dateStr}</td>
                <td style="text-align: center;">${timeStr}</td>
                <td style="text-align: center;">${action}</td>
                <td style="text-align: center;">${mode}</td>
                <td style="text-align: center;">${status}</td>
              </tr>
            `;
          });

          wateringActivityHtml = `
            <div style="margin-top: 20px; page-break-before: always; width: 75%; margin-left: auto; margin-right: auto;">
              <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Watering Activity</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 18%;">Date</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 18%;">Time</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 22%;">Action</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 18%;">Mode</th>
                    <th style="background-color: #133E87; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; width: 18%;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${activityTableRows}
                </tbody>
              </table>
            </div>
          `;
        } else {
          wateringActivityHtml = `
            <div style="margin-top: 20px;">
              <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Watering Activity</h3>
              <p style="font-size: 11px; color: #666;">No watering activity records found for this batch.</p>
            </div>
          `;
        }
      } catch (error) {
        console.error("Error fetching watering activity data:", error);
        wateringActivityHtml = `
          <div style="margin-top: 20px;">
            <h3 style="color: #133E87; font-size: 14px; margin-bottom: 10px;">Watering Activity</h3>
            <p style="font-size: 11px; color: #666;">Unable to fetch watering activity data.</p>
          </div>
        `;
      }

      // Generate HTML with styled tables
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
              margin-bottom: 10px;
              text-align: center;
            }
            .summary-title {
              font-size: 14px;
              font-weight: bold;
              color: #133E87;
              margin-bottom: 15px;
              text-align: left;
              margin-left: 12.5%;
            }
            .metrics-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 30px;
              width: 75%;
              margin-left: auto;
              margin-right: auto;
              font-size: 11px;
            }
            .metric-card {
              padding: 12px;
              background-color: white;
              border-left: 5px solid #133E87;
              border-radius: 3px;
              text-align: left;
            }
            .metric-label {
              color: #666;
              font-size: 10px;
              font-weight: normal;
              margin-bottom: 8px;
              line-height: 1.4;
            }
            .metric-value {
              color: #133E87;
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            table {
              width: 75%;
              border-collapse: collapse;
              margin-bottom: 20px;
              margin-left: auto;
              margin-right: auto;
              font-size: 11px;
              table-layout: fixed;
            }
            th {
              background-color: #133E87;
              color: white;
              padding: 8px;
              text-align: center;
              border: 1px solid #ddd;
              font-weight: bold;
            }
            td {
              padding: 6px;
              border: 1px solid #ddd;
              color: #333;
              text-align: center;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            h3 {
              color: #133E87;
              font-size: 14px;
              margin-bottom: 10px;
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
            <div class="report-title">Water Consumption Report</div>
            <div class="filter-info">
              ${selectedBatch}<br>
              Report Generated: ${formatReportDateTime()}<br>
             
            </div>
          </div>

          <div class="summary-title" style="text-align: left;">Summary</div>

          <div class="metrics-container">
            <div class="metric-card">
              <div class="metric-label">Average Daily Dispensed</div>
              <div class="metric-value">${avgConsumption}</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;"></div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Dehydration Deaths</div>
              <div class="metric-value">${totalDehydrationDeaths}</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;"></div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Highest Daily Dispensed</div>
              <div class="metric-value">${maxConsumption}</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;">${maxConsumptionDate}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Lowest Daily Dispensed</div>
              <div class="metric-value">${minConsumption}</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;">${minConsumptionDate}</div>
            </div>
          </div>
          <br>
          <div class="summary-title" style="text-align: left;">Water Consumption Records</div>

          <table>
            <thead>
              <tr>
                <th style="width: 18%; text-align: center;">Date</th>
                <th style="width: 18%; text-align: center;">Age</th>
                <th style="width: 18%; text-align: center;">Activations</th>
                <th style="width: 18%; text-align: center;">Trend</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          ${dehydrationMortalityHtml}
          ${wateringActivityHtml}
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Create custom filename with batch and date
      const customFilename = `WaterConsumptionReport_${selectedBatch}_${new Date().toLocaleDateString().replace(/\//g, "-")}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation to audit trail
      await logReportGeneration(
        customFilename,
        "Water Consumption Report",
        "Generate water consumption report",
        `Generated and exported water consumption report for batch ${selectedBatch} on ${new Date().toLocaleDateString()}`,
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Water Consumption report exported successfully!",
      );
    } catch (error) {
      console.error("Error generating water report:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingFeedReport(false);
    }
  };

  /**
   * Generate Energy Trends Report PDF
   * Fetches solar usage records from solarUsage collection for the selected date range,
   * aggregates by date, and generates a comprehensive PDF report.
   */
  const generateEnergyTrendsReportPDF = async () => {
    // Get the date range from the filter
    const startDateFilter = chartFilters["solar"]?.startDate;
    const endDateFilter = chartFilters["solar"]?.endDate;

    if (!startDateFilter || !endDateFilter) {
      showAlert("error", "Error", "Please select a date range from the filter");
      return;
    }

    setIsGeneratingFeedReport(true);
    try {
      // Fetch all solar usage records for the date range
      const solarRef = collection(firestoreDb, "solarUsage");
      const startDate = new Date(startDateFilter);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(endDateFilter);
      endDate.setHours(23, 59, 59, 999);

      const q = query(
        solarRef,
        where("timestamp", ">=", startDate),
        where("timestamp", "<=", endDate),
      );
      const snapshot = await getDocs(q);

      if (snapshot.docs.length === 0) {
        showAlert(
          "info",
          "No Data",
          "No energy usage records found for the selected date range",
        );
        setIsGeneratingFeedReport(false);
        return;
      }

      // Aggregate usage by date
      const dateMap = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate
          ? data.timestamp.toDate()
          : new Date(data.timestamp);
        const dateKey = `${timestamp.getMonth() + 1}/${timestamp.getDate()}/${timestamp.getFullYear()}`;
        const usage = parseFloat(data.usage) || 0;
        dateMap[dateKey] = (dateMap[dateKey] || 0) + usage;
      });

      // Sort dates chronologically
      const sortedDates = Object.keys(dateMap).sort((a, b) => {
        const [aM, aD, aY] = a.split("/").map(Number);
        const [bM, bD, bY] = b.split("/").map(Number);
        return new Date(aY, aM - 1, aD) - new Date(bY, bM - 1, bD);
      });

      // Load logo
      const logoBase64 = await getLogoBase64();

      // Generate all dates in the range (including dates with 0 usage)
      const allDates = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const year = currentDate.getFullYear();
        const dateKey = `${month}/${day}/${year}`;
        allDates.push(dateKey);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Create table rows with trend calculations
      let tableRows = "";
      let totalUsage = 0;
      const usageByDate = [];

      allDates.forEach((dateKey) => {
        const usage = dateMap[dateKey] || 0;
        totalUsage += usage;
        const [month, day, year] = dateKey.split("/").map(Number);
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
        const formattedDate = `${String(day).padStart(2, "0")}-${monthNames[month - 1]}-${year}`;
        usageByDate.push({ date: formattedDate, usage: usage });
      });

      // Calculate average usage and extremes
      const usageValues = usageByDate
        .map((item) => item.usage)
        .filter((val) => val > 0);
      const averageUsage =
        usageValues.length > 0
          ? usageValues.reduce((a, b) => a + b, 0) / usageValues.length
          : 0;
      const highestUsage =
        usageValues.length > 0 ? Math.max(...usageValues) : 0;
      const lowestUsage = usageValues.length > 0 ? Math.min(...usageValues) : 0;

      // Find dates for highest and lowest usage
      let highestUsageDate = "";
      let lowestUsageDate = "";
      usageByDate.forEach((item) => {
        if (item.usage === highestUsage && highestUsage > 0) {
          highestUsageDate = item.date;
        }
        if (item.usage === lowestUsage && lowestUsage > 0) {
          lowestUsageDate = item.date;
        }
      });

      // Format metric values with intelligent decimal handling
      const formatMetricValue = (value) => {
        return value % 1 === 0 ? Math.floor(value) : value.toFixed(2);
      };

      // Generate table rows with trends
      usageByDate.forEach((item, index) => {
        let trendHtml = "—";
        if (index > 0) {
          const previousUsage = usageByDate[index - 1].usage;
          if (previousUsage === 0 && item.usage > 0) {
            // If previous was 0 and current has usage, mark as new usage
            trendHtml = '<span style="color: #999;">New usage</span>';
          } else if (previousUsage > 0) {
            // Calculate percentage change normally
            const percentageChangeRaw =
              ((item.usage - previousUsage) / previousUsage) * 100;
            const percentageChange =
              percentageChangeRaw % 1 === 0
                ? Math.floor(percentageChangeRaw)
                : percentageChangeRaw.toFixed(1);
            if (percentageChange > 0) {
              trendHtml = `<span style="color: #F44336;">↑</span> <span style="color: #F44336;">+${percentageChange}%</span>`;
            } else if (percentageChange < 0) {
              trendHtml = `<span style="color: #4CAF50;">↓</span> <span style="color: #4CAF50;">${percentageChange}%</span>`;
            } else {
              trendHtml =
                '<span style="color: #999;">→</span> <span style="color: #999;">0%</span>';
            }
          }
        }

        const displayUsage =
          item.usage % 1 === 0 ? Math.floor(item.usage) : item.usage.toFixed(2);
        tableRows += `
          <tr>
            <td>${item.date}</td>
            <td>${displayUsage}</td>
            <td style="text-align: center;">${trendHtml}</td>
          </tr>
        `;
      });

      // Add total row
      const displayTotalUsage =
        totalUsage % 1 === 0 ? Math.floor(totalUsage) : totalUsage.toFixed(2);
      tableRows += `
        <tr style="background-color: #e8e8e8; font-weight: bold;">
          <td style="text-align: center;">TOTAL</td>
          <td>${displayTotalUsage}</td>
          <td></td>
        </tr>
      `;

      // Format date range for display and filename
      const startDateObj = new Date(startDateFilter);
      const endDateObj = new Date(endDateFilter);
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
      const formatDate = (date) => {
        return `${String(date.getDate()).padStart(2, "0")}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
      };
      const startDateStr = formatDate(startDateObj);
      const endDateStr = formatDate(endDateObj);

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
              margin-bottom: 10px;
              text-align: center;
            }
            .summary-title {
              font-size: 14px;
              font-weight: bold;
              color: #133E87;
              margin-bottom: 15px;
              text-align: left;
              margin-left: 12.5%;
            }
            .metrics-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 30px;
              width: 75%;
              margin-left: auto;
              margin-right: auto;
              font-size: 11px;
            }
            .metric-card {
              padding: 12px;
              background-color: white;
              border-left: 5px solid #133E87;
              border-radius: 3px;
              text-align: left;
            }
            .metric-label {
              color: #666;
              font-size: 10px;
              font-weight: normal;
              margin-bottom: 8px;
              line-height: 1.4;
            }
            .metric-value {
              color: #133E87;
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            table {
              width: 40%;
              border-collapse: collapse;
              margin-bottom: 20px;
              margin-left: auto;
              margin-right: auto;
              font-size: 11px;
              table-layout: fixed;
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
              text-align: center;
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
            <div class="report-title">Energy Trends Report</div>
            <div class="filter-info">
              Date Range: ${startDateStr} to ${endDateStr}<br>
              Report Generated: ${formatReportDateTime()}<br>
              Total Days: ${allDates.length}
            </div>
          </div>

          <div class="summary-title">Summary</div>

          <div class="metrics-container">
            <div class="metric-card">
              <div class="metric-label">Average Usage</div>
              <div class="metric-value">${formatMetricValue(averageUsage)} kWh</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Usage</div>
              <div class="metric-value">${formatMetricValue(totalUsage)} kWh</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Highest Usage</div>
              <div class="metric-value">${formatMetricValue(highestUsage)} kWh</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;">${highestUsageDate}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Lowest Usage</div>
              <div class="metric-value">${formatMetricValue(lowestUsage)} kWh</div>
              <div style="font-size: 9px; color: #666; margin-top: 5px;">${lowestUsageDate}</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 20%; text-align: center;">Date</th>
                <th style="width: 20%; text-align: center;">Usage (kWh)</th>
                <th style="width: 20%; text-align: center;">Trend</th>
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

      // Create custom filename with date range
      const customFilename = `EnergyTrends_${startDateStr}_to_${endDateStr}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Move file to new path with custom name
      await FileSystem.moveAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Energy Trends report exported successfully!",
      );
    } catch (error) {
      console.error("[generateEnergyTrendsReportPDF] Error:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingFeedReport(false);
    }
  };

  /**
   * Generate Mortality Per Batch Report PDF
   * Fetches mortality records for each batch for the selected date range,
   * sums the count for each batch, and generates a PDF report
   */
  const generateMortalityBatchReportPDF = async (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) {
      showAlert("error", "Error", "Please select both start and end dates");
      return;
    }

    setIsGeneratingBatchReport(true);
    try {
      // First, fetch all batches from brooderInfo
      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderInfoSnapshot = await getDocs(brooderInfoRef);

      const batchTableRows = [];
      const batchDeathsMap = {}; // Map to aggregate deaths by batch

      const startDateObj = new Date(startDateStr);
      const endDateObj = new Date(endDateStr);
      endDateObj.setHours(23, 59, 59, 999);

      // Initialize all batches with 0 deaths (includes batches without mortality records)
      brooderInfoSnapshot.docs.forEach((brooderDoc) => {
        const batchId = brooderDoc.id;
        const brooderData = brooderDoc.data();
        batchDeathsMap[batchId] = {
          batchName: batchId,
          totalDeaths: 0,
          recordCount: 0,
          initialChicksCount: brooderData.initialChicksCount || 0,
          chicksCount: brooderData.chicksCount || 0,
        };
      });

      // Use collectionGroup to query all mortality records
      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordsSnapshot = await getDocs(recordsRef);

      // Process all records and aggregate by batch
      recordsSnapshot.docs.forEach((recordDoc) => {
        const recordData = recordDoc.data();
        const batchName = recordData.batchId; // Extract batchId from record data
        const count = recordData.count || 0;

        // Parse timestamp (report date) for date filtering
        let recordDate = null;
        if (recordData.timestamp) {
          if (recordData.timestamp.toDate) {
            recordDate = recordData.timestamp.toDate();
          } else if (recordData.timestamp.seconds) {
            recordDate = new Date(recordData.timestamp.seconds * 1000);
          }
        }

        // Also try using createdAt as fallback
        if (!recordDate && recordData.createdAt) {
          if (recordData.createdAt.toDate) {
            recordDate = recordData.createdAt.toDate();
          } else if (recordData.createdAt.seconds) {
            recordDate = new Date(recordData.createdAt.seconds * 1000);
          }
        }

        // Filter by date range
        if (recordDate) {
          // Convert UTC timestamp to GMT+8 for comparison
          const recordDateGMT8 = new Date(
            recordDate.getTime() + 8 * 60 * 60 * 1000,
          );
          const recordDateOnly = new Date(
            recordDateGMT8.getFullYear(),
            recordDateGMT8.getMonth(),
            recordDateGMT8.getDate(),
          );

          if (recordDateOnly >= startDateObj && recordDateOnly <= endDateObj) {
            // Update batch deaths (only if batch exists from brooderInfo)
            if (batchDeathsMap[batchName]) {
              batchDeathsMap[batchName].totalDeaths += count;
              batchDeathsMap[batchName].recordCount++;
            }
          }
        }
      });

      // Convert map to array (all batches from brooderInfo are already loaded with their data)
      Object.values(batchDeathsMap).forEach((batchData) => {
        batchTableRows.push(batchData);
      });

      // Check if any data exists
      const totalDeaths = batchTableRows.reduce(
        (sum, row) => sum + row.totalDeaths,
        0,
      );
      if (totalDeaths === 0) {
        showAlert(
          "info",
          "No Data",
          "No mortality records found for the selected date range",
        );
        setIsGeneratingBatchReport(false);
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

      // Create table rows HTML with mortality rate and trend
      let tableRowsHtml = "";
      batchTableRows.forEach((row, index) => {
        // Calculate mortality rate
        const mortalityRate =
          row.initialChicksCount > 0
            ? ((row.totalDeaths / row.initialChicksCount) * 100).toFixed(2)
            : 0;

        // Calculate trend compared to previous batch
        let trendHtml = "-";
        if (index > 0) {
          const previousRate =
            batchTableRows[index - 1].initialChicksCount > 0
              ? (batchTableRows[index - 1].totalDeaths /
                  batchTableRows[index - 1].initialChicksCount) *
                100
              : 0;
          const currentRate = parseFloat(mortalityRate);
          const rateDifference = currentRate - previousRate;
          const percentageChange =
            previousRate > 0
              ? ((rateDifference / previousRate) * 100).toFixed(1)
              : rateDifference.toFixed(2);

          if (rateDifference > 0) {
            trendHtml = `<span style="color: #4CAF50;">↑</span> <span style="color: #4CAF50;">+${percentageChange}%</span>`;
          } else if (rateDifference < 0) {
            trendHtml = `<span style="color: #F44336;">↓</span> <span style="color: #F44336;">${percentageChange}%</span>`;
          } else {
            trendHtml = `<span style="color: #999;">→</span> <span style="color: #999;">0%</span>`;
          }
        }

        tableRowsHtml += `
          <tr>
            <td>${row.batchName}</td>
            <td style="text-align: center; width: 100px;">${row.initialChicksCount}</td>
            <td style="text-align: center; width: 100px;">${row.totalDeaths}</td>
            <td style="text-align: center; width: 100px;">${row.chicksCount}</td>
            <td style="text-align: center; width: 100px;">${mortalityRate}%</td>
            <td style="text-align: center; width: 100px;">${trendHtml}</td>
          </tr>
        `;
      });

      // Add total row
      const totalStartingPopulation = batchTableRows.reduce(
        (sum, row) => sum + row.initialChicksCount,
        0,
      );
      const totalAlive = batchTableRows.reduce(
        (sum, row) => sum + row.chicksCount,
        0,
      );
      const overallMortalityRate =
        totalStartingPopulation > 0
          ? ((totalDeaths / totalStartingPopulation) * 100).toFixed(2)
          : 0;

      tableRowsHtml += `
        <tr style="background-color: #dbdde0; color: white; font-weight: bold;">
          <td style="text-align: right; padding: 8px;">Total</td>
          <td style="text-align: center; width: 100px; padding: 8px;">${totalStartingPopulation}</td>
          <td style="text-align: center; width: 100px; padding: 8px;">${totalDeaths}</td>
          <td style="text-align: center; width: 100px; padding: 8px;">${totalAlive}</td>
          <td style="text-align: center; width: 100px; padding: 8px;">${overallMortalityRate}%</td>
          <td style="text-align: center; width: 100px; padding: 8px;">-</td>
        </tr>
      `;

      // Generate HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4;
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
            .table-container {
              display: flex;
              justify-content: center;
              margin-bottom: 20px;
            }
            table {
              width: 750px;
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
            <div class="report-title">Mortality Per Batch Report</div>
            <div class="filter-info">
              Date Range: ${formatDateRange(startDateStr)} to ${formatDateRange(endDateStr)}<br>
              Report Generated: ${formatReportDateTime()}<br>
              Total Deaths: ${totalDeaths}
            </div>
          </div>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 100px;">Batch ID</th>
                  <th style="text-align: center; width: 100px;">Starting Population</th>
                  <th style="text-align: center; width: 100px;">Deaths</th>
                  <th style="text-align: center; width: 100px;">Remaining Population</th>
                  <th style="text-align: center; width: 100px;">Mortality Rate</th>
                  <th style="text-align: center; width: 100px;">Trend</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Create custom filename with date
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

      const customFilename = `MortalityPerBatchReport_${formatDate(startDateStr)}_to_${formatDate(endDateStr)}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation to audit trail
      await logReportGeneration(
        customFilename,
        "Mortality Per Batch Report",
        "Generate mortality per batch report",
        `Generated and exported mortality per batch report for ${formatDateRange(startDateStr)} to ${formatDateRange(endDateStr)}`,
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Mortality Per Batch report exported successfully!",
      );

      // Modal closed automatically - no need to set state
    } catch (error) {
      console.error("Error generating batch report:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingBatchReport(false);
    }
  };

  /**
   * Generate Predator Attacks Report PDF
   * Fetches all predator attacks from all batches for the selected date range
   * Uses filter date range, or defaults to last 7 days if no filter is set
   */
  const generatePredatorAttacksReportPDF = async () => {
    setIsGeneratingPredatorReport(true);
    try {
      console.log("[GeneratePredatorReport] Starting PDF generation...");

      // Get date range from filter or use default (last 7 days)
      let startDate, endDate;

      if (
        chartFilters["predator"]?.startDate &&
        chartFilters["predator"]?.endDate
      ) {
        // Use filter dates
        startDate = new Date(chartFilters["predator"].startDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(chartFilters["predator"].endDate);
        endDate.setHours(23, 59, 59, 999);
        console.log(
          "[GeneratePredatorReport] Using filter dates:",
          startDate,
          "to",
          endDate,
        );
      } else {
        // Default: last 7 days
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6); // -6 to include today as day 7
        startDate.setHours(0, 0, 0, 0);
        console.log(
          "[GeneratePredatorReport] Using default dates (7 days):",
          startDate,
          "to",
          endDate,
        );
      }

      // Fetch all batches from predatorAttacks
      const predatorAttacksRef = collection(firestoreDb, "predatorAttacks");
      const batchesSnapshot = await getDocs(predatorAttacksRef);

      let allAttacks = [];

      // Fetch attacks from each batch
      for (const batchDoc of batchesSnapshot.docs) {
        const batchId = batchDoc.id;
        const attacksRef = collection(
          firestoreDb,
          "predatorAttacks",
          batchId,
          "attacks",
        );
        const attacksSnapshot = await getDocs(attacksRef);

        attacksSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          let attackDate;

          // Convert attack_datetime to Date
          if (data.attack_datetime?.toDate) {
            attackDate = data.attack_datetime.toDate();
          } else if (data.attack_datetime?.seconds) {
            attackDate = new Date(data.attack_datetime.seconds * 1000);
          } else {
            attackDate = new Date(data.attack_datetime);
          }

          // Filter by date range
          if (attackDate >= startDate && attackDate <= endDate) {
            allAttacks.push({
              ...data,
              attackDate,
              batchId,
            });
          }
        });
      }

      // Sort by date chronologically (oldest first)
      allAttacks.sort((a, b) => a.attackDate - b.attackDate);

      console.log(
        `[GeneratePredatorReport] Found ${allAttacks.length} attacks`,
      );

      if (allAttacks.length === 0) {
        showAlert(
          "info",
          "No Data",
          "No predator attacks found in the selected date range.",
        );
        return;
      }

      // Calculate summary statistics
      const attacksByDate = {};
      const attacksByPredator = {};
      const attacksByTimeOfDay = {
        "Early Morning": 0, // 12:00am-5:59am
        Morning: 0, // 6:00am-11:59am
        Afternoon: 0, // 12:00pm-5:59pm
        Night: 0, // 6:00pm-11:59pm
      };
      const attacksByDayOfWeek = {
        Sunday: 0,
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
      };

      allAttacks.forEach((attack) => {
        const dateKey = attack.attackDate.toDateString();
        attacksByDate[dateKey] = (attacksByDate[dateKey] || 0) + 1;

        const predator = attack.predator_type || "Unknown";
        attacksByPredator[predator] = (attacksByPredator[predator] || 0) + 1;

        // Categorize by time of day
        const hour = attack.attackDate.getHours();
        if (hour >= 0 && hour < 6) {
          attacksByTimeOfDay["Early Morning"]++;
        } else if (hour >= 6 && hour < 12) {
          attacksByTimeOfDay["Morning"]++;
        } else if (hour >= 12 && hour < 18) {
          attacksByTimeOfDay["Afternoon"]++;
        } else {
          attacksByTimeOfDay["Night"]++;
        }

        // Categorize by day of week
        const dayOfWeek = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ][attack.attackDate.getDay()];
        attacksByDayOfWeek[dayOfWeek]++;
      });

      const peakDay = Object.keys(attacksByDate).reduce((a, b) =>
        attacksByDate[a] > attacksByDate[b] ? a : b,
      );
      const peakDayFormatted = new Date(peakDay).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const mostFrequentPredator = Object.keys(attacksByPredator).reduce(
        (a, b) => (attacksByPredator[a] > attacksByPredator[b] ? a : b),
      );

      // Find day of week with most attacks
      const peakDayOfWeek = Object.keys(attacksByDayOfWeek).reduce((a, b) =>
        attacksByDayOfWeek[a] > attacksByDayOfWeek[b] ? a : b,
      );

      // Calculate attack rates as percentages
      const earlyMorningRate =
        allAttacks.length > 0
          ? (
              (attacksByTimeOfDay["Early Morning"] / allAttacks.length) *
              100
            ).toFixed(1)
          : "0.0";
      const morningRate =
        allAttacks.length > 0
          ? ((attacksByTimeOfDay["Morning"] / allAttacks.length) * 100).toFixed(
              1,
            )
          : "0.0";
      const afternoonRate =
        allAttacks.length > 0
          ? (
              (attacksByTimeOfDay["Afternoon"] / allAttacks.length) *
              100
            ).toFixed(1)
          : "0.0";
      const nightRate =
        allAttacks.length > 0
          ? ((attacksByTimeOfDay["Night"] / allAttacks.length) * 100).toFixed(1)
          : "0.0";

      // Load logo
      const logoBase64 = await getLogoBase64();

      // Format dates for display
      const formatDateTime = (date) => {
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
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12;
        return {
          date: `${month} ${day}, ${year}`,
          time: `${displayHours}:${minutes} ${ampm}`,
        };
      };

      // Build HTML table
      let tableRows = "";
      allAttacks.forEach((attack, index) => {
        const dateTime = formatDateTime(attack.attackDate);

        tableRows += `
          <tr>
            <td>${index + 1}</td>
            <td>${dateTime.date}<br/><small style="color: #666;">${dateTime.time}</small></td>
            <td>${attack.batchId}</td>
            <td>${attack.predator_type || "Unknown"}</td>
            <td>${attack.action_taken || "None"}</td>
          </tr>
        `;
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page {
                size: A4;
                margin: 0.8in 0.8in 0.8in 0.8in;
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
                margin-bottom: 30px;
              }
              th {
                background-color: #133E87;
                color: white;
                padding: 10px;
                text-align: left;
                font-weight: bold;
              }
              td {
                padding: 8px;
                border-bottom: 1px solid #ddd;
              }
              tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              .summary {
                background-color: #ffffff;
                padding: 15px;
                border-radius: 5px;
                margin-top: 20px;
              }
              .summary h2 {
                color: #133E87;
                margin-top: 0;
                font-size: 18px;
              }
              .summary h3 {
                color: #133E87;
                margin-top: 0;
                font-size: 18px;
              }
              .summary-item {
                margin: 10px 0;
                font-size: 14px;
              }
              .summary-label {
                font-weight: bold;
                color: #133E87;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="header-top">
                <img src="data:image/png;base64,${logoBase64}" class="logo" alt="Logo" />
                <div class="company-name">Internet of Tsiken</div>
              </div>
              <div class="report-title">Frequency of Attacks Report</div>
              <div class="filter-info">
                Date Range: ${formatDateTime(startDate).date} to ${formatDateTime(endDate).date}<br>
                Report Generated: ${formatReportDateTime()}<br>
              
              </div>
            </div>
            <div class="summary">
              <h2>Summary</h2>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                ${(() => {
                  // Create predator type summary cards
                  const predatorStats = ["Dog", "Cat", "Rat", "Snake", "Other"]
                    .map((predator) => {
                      const count = attacksByPredator[predator] || 0;
                      const rawPercentage =
                        allAttacks.length > 0
                          ? (count / allAttacks.length) * 100
                          : 0;
                      const percentage = Number.isInteger(rawPercentage)
                        ? rawPercentage.toString()
                        : rawPercentage.toFixed(2);
                      return {
                        predator,
                        count,
                        percentage: parseFloat(percentage),
                      };
                    })
                    .sort((a, b) => b.percentage - a.percentage);

                  return predatorStats
                    .map(
                      (stat) => `
                    <div style="padding: 8px; background-color: white; border-left: 3px solid #133E87; border-radius: 3px;">
                      <div style="color: #666; font-size: 10px;">${stat.predator}</div>
                      <div style="color: #133E87; font-weight: bold; font-size: 14px;">${stat.percentage}%</div>
                      <div style="color: #666; font-size: 10px;">(${stat.count} ${stat.count === 1 || stat.count === 0 ? "attack" : "attacks"})</div>
                    </div>
                  `,
                    )
                    .join("");
                })()}
              </div>

              <div style="margin-top: 15px; padding-top: 10px;">
                <h3 style="margin-top: 0;">Predator Type Breakdown</h3>
                ${(() => {
                  const predatorData = [
                    "Dog",
                    "Cat",
                    "Rat",
                    "Snake",
                    "Other",
                  ].map((predator) => {
                    const count = attacksByPredator[predator] || 0;
                    const rawPercentage =
                      allAttacks.length > 0
                        ? (count / allAttacks.length) * 100
                        : 0;
                    const percentage = Number.isInteger(rawPercentage)
                      ? rawPercentage.toString()
                      : rawPercentage.toFixed(1);
                    return {
                      predator,
                      count,
                      percentage: parseFloat(percentage),
                    };
                  });
                  const maxPercentage = Math.max(
                    ...predatorData.map((d) => d.percentage),
                  );
                  return `
                    <table style="width: 43%; border-collapse: collapse; font-size: 12px;">
                      <thead>
                        <tr style="background-color: #f0f0f0;">
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Predator Type</th>
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Attack Count</th>
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${predatorData
                          .map((item) => {
                            const isHighest =
                              item.percentage === maxPercentage &&
                              item.percentage > 0;
                            const percentageStyle = isHighest
                              ? 'style="border: 1px solid #ddd; padding: 6px; text-align: center; color: #F44336;"'
                              : 'style="border: 1px solid #ddd; padding: 6px; text-align: center;"';
                            return `<tr><td style="border: 1px solid #ddd; padding: 6px;">${item.predator}</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.count}</td><td ${percentageStyle}>${item.percentage}%</td></tr>`;
                          })
                          .join("")}
                        <tr style="background-color: #f0f0f0; font-weight: bold;"><td style="border: 1px solid #ddd; padding: 6px;">TOTAL</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${allAttacks.length}</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">100%</td></tr>
                      </tbody>
                    </table>
                  `;
                })()}
              </div>

              <div style="margin-top: 15px; padding-top: 10px;">
                <h3 style="margin-top: 0;">Attack Statistics</h3>
                <div style="display: flex; gap: 1px;">
                  <div style="flex: 1;">
                    <h4 style="margin: 0 0 10px 0;">Attacks by Day of Week</h4>
                    <table style="width: 85%; border-collapse: collapse; font-size: 12px;">
                      <thead>
                        <tr style="background-color: #f0f0f0;">
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: left; width: 30%;">Day</th>
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 25%;">Attacks</th>
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 20%;">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${(() => {
                          const dayOfWeekData = Object.keys(
                            attacksByDayOfWeek,
                          ).map((day) => ({
                            day,
                            count: attacksByDayOfWeek[day],
                          }));
                          const maxCount = Math.max(
                            ...dayOfWeekData.map((d) => d.count),
                          );
                          return dayOfWeekData
                            .map((item) => {
                              const rawPercentage =
                                allAttacks.length > 0
                                  ? (item.count / allAttacks.length) * 100
                                  : 0;
                              const percentage = Number.isInteger(rawPercentage)
                                ? rawPercentage.toString()
                                : rawPercentage.toFixed(1);
                              const isHighest =
                                item.count === maxCount && item.count > 0;
                              const percentageStyle = isHighest
                                ? 'style="border: 1px solid #ddd; padding: 6px; text-align: center; color: #F44336;"'
                                : 'style="border: 1px solid #ddd; padding: 6px; text-align: center;"';
                              return `<tr style="border: 1px solid #ddd;"><td style="border: 1px solid #ddd; padding: 6px;">${item.day}</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.count}</td><td ${percentageStyle}>${percentage}%</td></tr>`;
                            })
                            .join("");
                        })()}
                        <tr style="background-color: #f0f0f0; font-weight: bold;"><td style="border: 1px solid #ddd; padding: 6px;">TOTAL</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${allAttacks.length}</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">100%</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div style="flex: 1;">
                    <h4 style="margin: 0 0 10px 0;">Attacks by Time of Day</h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                      <thead>
                        <tr style="background-color: #f0f0f0;">
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Time Period</th>
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Attacks</th>
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">%</th>
                          <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${(() => {
                          const timeOfDayData = [
                            {
                              label: "Early Morning <br>(12:00am - 5:59am)",
                              count: attacksByTimeOfDay["Early Morning"],
                              rate: earlyMorningRate,
                            },
                            {
                              label: "Morning <br>(6:00am - 11:59am)",
                              count: attacksByTimeOfDay["Morning"],
                              rate: morningRate,
                            },
                            {
                              label: "Afternoon <br>(12:00nn - 5:59pm)",
                              count: attacksByTimeOfDay["Afternoon"],
                              rate: afternoonRate,
                            },
                            {
                              label: "Night <br>(6:00pm - 11:59pm)",
                              count: attacksByTimeOfDay["Night"],
                              rate: nightRate,
                            },
                          ];

                          // Find max and min/zero
                          const maxCount = Math.max(
                            ...timeOfDayData.map((d) => d.count),
                          );
                          let minCount = Math.min(
                            ...timeOfDayData.map((d) => d.count),
                          );
                          const hasZero = timeOfDayData.some(
                            (d) => d.count === 0,
                          );
                          const minCountForLow = hasZero ? 0 : minCount;

                          return timeOfDayData
                            .map((item) => {
                              let risk = "";
                              if (
                                item.count === minCountForLow &&
                                item.count === 0
                              ) {
                                risk = "Low";
                              } else if (
                                item.count === minCountForLow &&
                                !hasZero
                              ) {
                                risk = "Low";
                              }
                              if (item.count === maxCount && item.count > 0) {
                                risk = "⚠️ High";
                              }
                              const percentage = Number.isInteger(
                                parseFloat(item.rate),
                              )
                                ? parseInt(item.rate)
                                : item.rate;
                              const riskStyle =
                                risk === "⚠️ High"
                                  ? 'style="border: 1px solid #ddd; padding: 6px; text-align: center; color: #F44336;"'
                                  : 'style="border: 1px solid #ddd; padding: 6px; text-align: center;"';
                              return `<tr style="border: 1px solid #ddd;"><td style="border: 1px solid #ddd; padding: 6px;">${item.label}</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.count}</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${percentage}%</td><td ${riskStyle}>${risk}</td></tr>`;
                            })
                            .join("");
                        })()}
                        <tr style="background-color: #f0f0f0; font-weight: bold;"><td style="border: 1px solid #ddd; padding: 6px;">TOTAL</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${allAttacks.length}</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">100%</td><td style="border: 1px solid #ddd; padding: 6px;"></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div style="margin-top: 15px; padding-top: 10px; page-break-before: always;">
                <h3 style="margin-top: 0;">Predator Incidents Log</h3>
            <table style="font-size: 12px;">
              <thead>
                <tr>
                  <th style="width: 5%;">No</th>
                  <th style="width: 20%;">Date & Time</th>
                  <th style="width: 15%;">Batch ID</th>
                  <th style="width: 20%;">Predator Type</th>
                  <th style="width: 35%;">Action Taken</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
              </div>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      console.log("[GeneratePredatorReport] PDF generated at:", uri);

      // Create custom filename with date range: AttacksFrequencyReport_21Jan2026_25Jan2026.pdf
      const formatDateForFilename = (dateStr) => {
        const date = new Date(dateStr);
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
        return `${day}${month}${year}`;
      };

      const startDateFormatted = formatDateForFilename(startDate.toISOString());
      const endDateFormatted = formatDateForFilename(endDate.toISOString());
      const filename = `FrequencyOfAttacksReport_${startDateFormatted}_to_${endDateFormatted}.pdf`;
      console.log("[GeneratePredatorReport] Custom filename:", filename);

      // Copy PDF to documents directory with custom name
      const customUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.copyAsync({
        from: uri,
        to: customUri,
      });
      console.log("[GeneratePredatorReport] PDF copied to:", customUri);

      // Share the renamed PDF
      await Sharing.shareAsync(customUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Predator Attacks Report",
      });

      showAlert(
        "success",
        "Success",
        "Predator Attacks report exported successfully!",
      );

      showAlert(
        "success",
        "Success",
        "Predator Attacks report exported successfully!",
      );

      // Log the report generation
      try {
        await logReportGeneration(
          filename,
          "Predator Attacks Report",
          "Generated predator report",
          `Frequency of predator attacks report for ${formatDateTime(startDate).date} to ${formatDateTime(endDate).date}`,
        );
        console.log("[GeneratePredatorReport] Report logged successfully");
      } catch (logError) {
        console.warn("[GeneratePredatorReport] Logging warning:", logError);
      }
    } catch (error) {
      console.error("[GeneratePredatorReport] Error:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report. Please try again.",
      );
    } finally {
      setIsGeneratingPredatorReport(false);
    }
  };

  /**
   * Generate Attacks Per Batch Report PDF
   * Fetches all predator attacks from all batches for the selected date range
   * Groups attacks by batch, generates detailed table with attack information
   */
  const generateAttacksPerBatchReportPDF = async () => {
    const dateFilter = chartFilters["attacksbatch"];
    let startDateStr, endDateStr;

    if (dateFilter && dateFilter.startDate && dateFilter.endDate) {
      startDateStr = dateFilter.startDate;
      endDateStr = dateFilter.endDate;
    } else {
      // Default: last 7 days
      const endDate = new Date();
      startDateStr = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      endDateStr = endDate.toISOString().split("T")[0];
    }

    // Validate dates are set
    if (!startDateStr || !endDateStr) {
      showAlert("error", "Error", "Unable to determine date range for export.");
      return;
    }

    setIsGeneratingAttacksBatchReport(true);
    try {
      console.log("[GenerateAttacksPerBatchReport] Starting PDF generation...");
      console.log(
        "[GenerateAttacksPerBatchReport] Date range:",
        startDateStr,
        "to",
        endDateStr,
      );

      const [startYear, startMonth, startDay] = startDateStr
        .split("-")
        .map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);

      const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

      // First, fetch all batches from brooderInfo and initialize map with 0 attacks
      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);

      let allAttacks = [];
      const batchAttackMap = {};
      const batchMortalityMap = {};
      const allTimeAttacksByBatchAndPredator = {};

      // Initialize all batches with 0 attacks and mortality
      brooderSnapshot.docs.forEach((brooderDoc) => {
        const batchId = brooderDoc.id;
        batchAttackMap[batchId] = 0;
        batchMortalityMap[batchId] = 0;
        allTimeAttacksByBatchAndPredator[batchId] = {};
      });

      console.log(
        "[GenerateAttacksPerBatchReport] Initialized",
        brooderSnapshot.docs.length,
        "batches from brooderInfo",
      );

      // Fetch all batches from predatorAttacks
      const predatorAttacksRef = collection(firestoreDb, "predatorAttacks");
      const batchesSnapshot = await getDocs(predatorAttacksRef);

      // Fetch attacks from each batch
      for (const batchDoc of batchesSnapshot.docs) {
        const batchId = batchDoc.id;
        const attacksRef = collection(
          firestoreDb,
          "predatorAttacks",
          batchId,
          "attacks",
        );
        const attacksSnapshot = await getDocs(attacksRef);

        let batchAttackCount = 0;

        attacksSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          let attackDate;

          // Convert attack_datetime to Date
          if (data.attack_datetime?.toDate) {
            attackDate = data.attack_datetime.toDate();
          } else if (data.attack_datetime?.seconds) {
            attackDate = new Date(data.attack_datetime.seconds * 1000);
          } else {
            attackDate = new Date(data.attack_datetime);
          }

          // Track all-time attacks by predator (no filter)
          const predatorType = data.predator_type || "Unknown";
          if (!allTimeAttacksByBatchAndPredator[batchId]) {
            allTimeAttacksByBatchAndPredator[batchId] = {};
          }
          allTimeAttacksByBatchAndPredator[batchId][predatorType] =
            (allTimeAttacksByBatchAndPredator[batchId][predatorType] || 0) + 1;

          // Filter by date range for the main report
          if (attackDate >= startDate && attackDate <= endDate) {
            allAttacks.push({
              ...data,
              attackDate,
              batchId,
            });
            batchAttackCount++;
          }
        });

        if (batchAttackMap.hasOwnProperty(batchId)) {
          batchAttackMap[batchId] = batchAttackCount;
        }
      }

      // Now correlate attacks with mortality records (matching date and predator_type)
      const mortalityRef = collectionGroup(firestoreDb, "records");
      const mortalitySnapshot = await getDocs(mortalityRef);

      mortalitySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const batchId = data.batchId;

        if (!batchMortalityMap.hasOwnProperty(batchId)) {
          batchMortalityMap[batchId] = 0;
        }

        // Find matching attacks (same date and predator_type)
        let recordDate = null;
        if (data.timestamp?.toDate) {
          recordDate = data.timestamp.toDate();
        } else if (data.timestamp?.seconds) {
          recordDate = new Date(data.timestamp.seconds * 1000);
        }

        if (recordDate) {
          const recordDateOnly = new Date(
            recordDate.getFullYear(),
            recordDate.getMonth(),
            recordDate.getDate(),
          );

          // Match with attacks from same date and predator type
          const matchingAttacks = allAttacks.filter((attack) => {
            const attackDateOnly = new Date(
              attack.attackDate.getFullYear(),
              attack.attackDate.getMonth(),
              attack.attackDate.getDate(),
            );
            return (
              attack.batchId === batchId &&
              attackDateOnly.getTime() === recordDateOnly.getTime() &&
              (attack.predator_type || "Unknown") ===
                (data.predatorType || "Unknown")
            );
          });

          // Add mortality count if attacks match
          if (matchingAttacks.length > 0) {
            const mortality = data.count || 1;
            batchMortalityMap[batchId] += mortality;
          }
        }
      });

      // Sort by batch ID
      const sortedBatches = Object.entries(batchAttackMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([batchId, count]) => ({ batchId, count }));

      console.log(
        `[GenerateAttacksPerBatchReport] Found ${sortedBatches.length} batches with ${allAttacks.length} attacks`,
      );

      if (allAttacks.length === 0) {
        showAlert(
          "info",
          "No Data",
          "No predator attacks found in the selected date range.",
        );
        return;
      }

      // Create main table rows with mortality, trend, and timing
      let tableRows = "";
      let totalAttacks = 0;
      let totalMortality = 0;
      let previousAttackCount = 0;

      // Helper function to format percentage (remove .0 for whole numbers)
      const formatPercentage = (value) => {
        const numValue = typeof value === "number" ? value : parseFloat(value);
        if (Number.isInteger(numValue)) {
          return numValue.toString();
        }
        return numValue.toFixed(1);
      };

      sortedBatches.forEach((batch, index) => {
        const attackCount = batch.count;
        const mortalityCount = batchMortalityMap[batch.batchId] || 0;
        let trendSymbol = "";
        let trendColor = "";

        if (
          index > 0 &&
          previousAttackCount > 0 &&
          previousAttackCount !== attackCount
        ) {
          if (attackCount > previousAttackCount) {
            const percentageChange = (
              ((attackCount - previousAttackCount) / previousAttackCount) *
              100
            ).toFixed(1);
            trendSymbol = `↑ +${percentageChange}%`;
            trendColor = "#F44336";
          } else if (attackCount < previousAttackCount) {
            const percentageChange = (
              ((previousAttackCount - attackCount) / previousAttackCount) *
              100
            ).toFixed(1);
            trendSymbol = `↓ ${percentageChange}%`;
            trendColor = "#4CAF50";
          }
        }

        previousAttackCount = attackCount;

        // Calculate timing distribution for this batch
        const batchAttacks = allAttacks.filter(
          (a) => a.batchId === batch.batchId,
        );
        const timeDistribution = {
          "Early Morning": 0,
          Morning: 0,
          Afternoon: 0,
          Night: 0,
        };

        batchAttacks.forEach((attack) => {
          const hour = attack.attackDate.getHours();
          if (hour >= 0 && hour < 6) {
            timeDistribution["Early Morning"]++;
          } else if (hour >= 6 && hour < 12) {
            timeDistribution["Morning"]++;
          } else if (hour >= 12 && hour < 18) {
            timeDistribution["Afternoon"]++;
          } else {
            timeDistribution["Night"]++;
          }
        });

        const peakTime = Object.keys(timeDistribution).reduce((a, b) =>
          timeDistribution[a] > timeDistribution[b] ? a : b,
        );

        tableRows += `
          <tr>
            <td>${batch.batchId}</td>
            <td style="text-align: center;">${attackCount}</td>
            <td style="text-align: center;">${mortalityCount}</td>
            <td style="text-align: center;">${attackCount > 0 ? formatPercentage((mortalityCount / attackCount) * 100) + "%" : "-"}</td>
            <td style="text-align: center; color: ${trendColor || "inherit"};">${trendSymbol || "-"}</td>
            <td style="text-align: center;">${attackCount > 0 ? peakTime : "-"}</td>
          </tr>
        `;
        totalAttacks += attackCount;
        totalMortality += mortalityCount;
      });

      // Add total row
      tableRows += `
        <tr style="background-color: #dbdde0; color: white; font-weight: bold;">
          <td>TOTAL</td>
          <td style="text-align: center;">${totalAttacks}</td>
          <td style="text-align: center;">${totalMortality}</td>
          <td style="text-align: center;">${totalAttacks > 0 ? formatPercentage((totalMortality / totalAttacks) * 100) + "%" : "-"}</td>
          <td style="text-align: center;"></td>
          <td style="text-align: center;"></td>
        </tr>
      `;

      // Build Predator Type Per Batch table (single table with all batches as rows)
      let predatorPerBatchHTML = "";
      let previousBatchTotalPredators = {};
      const predatorTypes = ["Cat", "Dog", "Rat", "Snake", "Other"];

      // Build table header
      predatorPerBatchHTML += `
        <table style="width: 100%; font-size: 11px; margin-bottom: 15px; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="border: 1px solid #ddd; padding: 4px; text-align: left; width: 12.5%;">Batch ID</th>
              ${predatorTypes.map((pt) => `<th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 12.5%;">${pt}</th>`).join("")}
              <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 12.5%;">Total</th>
              <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 12.5%;">Trend</th>
            </tr>
          </thead>
          <tbody>
      `;

      sortedBatches.forEach((batch, index) => {
        const predatorData =
          allTimeAttacksByBatchAndPredator[batch.batchId] || {};
        const totalAttacksPerBatch = Object.values(predatorData).reduce(
          (a, b) => a + b,
          0,
        );
        const previousTotalAttacks = Object.values(
          previousBatchTotalPredators,
        ).reduce((a, b) => a + b, 0);

        // Find max count among predators for this batch
        const maxPredatorCount = Math.max(
          ...predatorTypes.map((pt) => predatorData[pt] || 0),
        );

        // Calculate trend
        let trendSymbol = "";
        let trendColor = "";
        if (
          index > 0 &&
          previousTotalAttacks > 0 &&
          totalAttacksPerBatch !== previousTotalAttacks
        ) {
          if (totalAttacksPerBatch > previousTotalAttacks) {
            const percentageChange = (
              ((totalAttacksPerBatch - previousTotalAttacks) /
                previousTotalAttacks) *
              100
            ).toFixed(1);
            trendSymbol = `↑ +${percentageChange}%`;
            trendColor = "#F44336";
          } else {
            const percentageChange = (
              ((previousTotalAttacks - totalAttacksPerBatch) /
                previousTotalAttacks) *
              100
            ).toFixed(1);
            trendSymbol = `↓ ${percentageChange}%`;
            trendColor = "#4CAF50";
          }
        }

        predatorPerBatchHTML += `
            <tr>
              <td>${batch.batchId}</td>
              ${predatorTypes
                .map((pt) => {
                  const count = predatorData[pt] || 0;
                  const isMax = count === maxPredatorCount && count > 0;
                  return `<td style="text-align: center; ${isMax ? "color: #F44336; font-weight: bold;" : ""}">${count}</td>`;
                })
                .join("")}
              <td style="text-align: center; font-weight: bold;">${totalAttacksPerBatch}</td>
              <td style="text-align: center; color: ${trendColor || "inherit"};">${trendSymbol || "-"}</td>
            </tr>
        `;

        previousBatchTotalPredators = { ...predatorData };
      });

      predatorPerBatchHTML += `
          </tbody>
        </table>
      `;

      // Build All Predators Attack Timing table (single table with all batches)
      let allPredatorsTimingHTML = "";
      let previousBatchTimingTotals = {
        "Early Morning": 0,
        Morning: 0,
        Afternoon: 0,
        Night: 0,
      };

      allPredatorsTimingHTML += `
        <table style="width: 100%; font-size: 11px; margin-bottom: 15px; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="border: 1px solid #ddd; padding: 4px; text-align: left; width: 12%;">Batch ID</th>
              <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 16%;">Early Morning<br>
12:00am - 5:59am</th>
              <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 16%;">Morning<br>
6:00am - 11:59am</th>
              <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 16%;">Afternoon<br>
12:00nn - 5:59pm</th>
              <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 16%;">Night<br>
6:00pm - 11:59pm</th>
              <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 8%;">Total</th>
              <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 8%;">Trend</th>
            </tr>
          </thead>
          <tbody>
      `;

      sortedBatches.forEach((batch, index) => {
        const batchAttacks = allAttacks.filter(
          (a) => a.batchId === batch.batchId,
        );
        const timeDistribution = {
          "Early Morning": 0,
          Morning: 0,
          Afternoon: 0,
          Night: 0,
        };

        batchAttacks.forEach((attack) => {
          const hour = attack.attackDate.getHours();
          if (hour >= 0 && hour < 6) {
            timeDistribution["Early Morning"]++;
          } else if (hour >= 6 && hour < 12) {
            timeDistribution["Morning"]++;
          } else if (hour >= 12 && hour < 18) {
            timeDistribution["Afternoon"]++;
          } else {
            timeDistribution["Night"]++;
          }
        });

        const totalBatchAttacks = batchAttacks.length;
        const previousTotalTiming = Object.values(
          previousBatchTimingTotals,
        ).reduce((a, b) => a + b, 0);

        // Calculate trend
        let trendSymbol = "";
        let trendColor = "";
        if (
          index > 0 &&
          previousTotalTiming > 0 &&
          totalBatchAttacks !== previousTotalTiming
        ) {
          if (totalBatchAttacks > previousTotalTiming) {
            const percentageChange = (
              ((totalBatchAttacks - previousTotalTiming) /
                previousTotalTiming) *
              100
            ).toFixed(1);
            trendSymbol = `↑ +${percentageChange}%`;
            trendColor = "#F44336";
          } else {
            const percentageChange = (
              ((previousTotalTiming - totalBatchAttacks) /
                previousTotalTiming) *
              100
            ).toFixed(1);
            trendSymbol = `↓ ${percentageChange}%`;
            trendColor = "#4CAF50";
          }
        }

        // Find max count among time periods for this batch
        const maxTimeCount = Math.max(...Object.values(timeDistribution));

        allPredatorsTimingHTML += `
            <tr>
              <td>${batch.batchId}</td>
              <td style="text-align: center; ${timeDistribution["Early Morning"] === maxTimeCount && maxTimeCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${timeDistribution["Early Morning"]}</td>
              <td style="text-align: center; ${timeDistribution["Morning"] === maxTimeCount && maxTimeCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${timeDistribution["Morning"]}</td>
              <td style="text-align: center; ${timeDistribution["Afternoon"] === maxTimeCount && maxTimeCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${timeDistribution["Afternoon"]}</td>
              <td style="text-align: center; ${timeDistribution["Night"] === maxTimeCount && maxTimeCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${timeDistribution["Night"]}</td>
              <td style="text-align: center; font-weight: bold;">${totalBatchAttacks}</td>
              <td style="text-align: center; color: ${trendColor || "inherit"};">${trendSymbol || "-"}</td>
            </tr>
        `;

        previousBatchTimingTotals = { ...timeDistribution };
      });

      allPredatorsTimingHTML += `
          </tbody>
        </table>
      `;

      // Build individual predator type timing tables
      let predatorTimingTablesHTML = `<div style="page-break-before: always;"></div>`;

      predatorTypes.forEach((predator) => {
        predatorTimingTablesHTML += `
          <h3 style="font-size: 12px; margin-top: 15px; margin-bottom: 8px; color: #133E87;">${predator} Attack Timing Per Batch</h3>
          <table style="width: 100%; font-size: 11px; margin-bottom: 15px; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="border: 1px solid #ddd; padding: 4px; text-align: left; width: 12%;">Batch ID</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 16%;">Early Morning<br>
12:00am - 5:59am</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 16%;">Morning<br>
6:00am - 11:59am</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 16%;">Afternoon<br>
12:00nn - 5:59pm</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 16%;">Night<br>
6:00pm - 11:59pm</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 8%;">Total</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: center; width: 8%;">Trend</th>
              </tr>
            </thead>
            <tbody>
        `;

        let previousPredatorTimingTotals = {
          "Early Morning": 0,
          Morning: 0,
          Afternoon: 0,
          Night: 0,
        };

        sortedBatches.forEach((batch, index) => {
          const batchAttacks = allAttacks.filter(
            (a) =>
              a.batchId === batch.batchId &&
              (a.predator_type || "Unknown") === predator,
          );
          const timeDistribution = {
            "Early Morning": 0,
            Morning: 0,
            Afternoon: 0,
            Night: 0,
          };

          batchAttacks.forEach((attack) => {
            const hour = attack.attackDate.getHours();
            if (hour >= 0 && hour < 6) {
              timeDistribution["Early Morning"]++;
            } else if (hour >= 6 && hour < 12) {
              timeDistribution["Morning"]++;
            } else if (hour >= 12 && hour < 18) {
              timeDistribution["Afternoon"]++;
            } else {
              timeDistribution["Night"]++;
            }
          });

          const totalBatchAttacks = batchAttacks.length;
          const previousTotalTiming = Object.values(
            previousPredatorTimingTotals,
          ).reduce((a, b) => a + b, 0);

          // Calculate trend
          let trendSymbol = "";
          let trendColor = "";
          if (
            index > 0 &&
            previousTotalTiming > 0 &&
            totalBatchAttacks !== previousTotalTiming
          ) {
            if (totalBatchAttacks > previousTotalTiming) {
              const percentageChange = (
                ((totalBatchAttacks - previousTotalTiming) /
                  previousTotalTiming) *
                100
              ).toFixed(1);
              trendSymbol = `↑ +${percentageChange}%`;
              trendColor = "#F44336";
            } else {
              const percentageChange = (
                ((previousTotalTiming - totalBatchAttacks) /
                  previousTotalTiming) *
                100
              ).toFixed(1);
              trendSymbol = `↓ ${percentageChange}%`;
              trendColor = "#4CAF50";
            }
          }

          // Find max count among time periods for this batch
          const maxTimeCount = Math.max(...Object.values(timeDistribution));

          predatorTimingTablesHTML += `
              <tr>
                <td>${batch.batchId}</td>
                <td style="text-align: center; ${timeDistribution["Early Morning"] === maxTimeCount && maxTimeCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${timeDistribution["Early Morning"]}</td>
                <td style="text-align: center; ${timeDistribution["Morning"] === maxTimeCount && maxTimeCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${timeDistribution["Morning"]}</td>
                <td style="text-align: center; ${timeDistribution["Afternoon"] === maxTimeCount && maxTimeCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${timeDistribution["Afternoon"]}</td>
                <td style="text-align: center; ${timeDistribution["Night"] === maxTimeCount && maxTimeCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${timeDistribution["Night"]}</td>
                <td style="text-align: center; font-weight: bold;">${totalBatchAttacks}</td>
                <td style="text-align: center; color: ${trendColor || "inherit"};">${trendSymbol || "-"}</td>
              </tr>
          `;

          previousPredatorTimingTotals = { ...timeDistribution };
        });

        predatorTimingTablesHTML += `
            </tbody>
          </table>
        `;
      });

      // Load logo
      const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
      await logoAsset.downloadAsync();
      const logoBase64 = await FileSystem.readAsStringAsync(
        logoAsset.localUri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      // Format dates for display
      const formatDisplayDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const [year, month, day] = dateStr.split("-").map(Number);
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
        return `${day}-${months[date.getMonth()]}-${year}`;
      };

      // Generate HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4;
              margin: 0.5in 0.5in 0.5in 0.5in;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              font-size: 12px;
            }
            .header {
              margin-bottom: 15px;
              border-bottom: 2px solid #133E87;
              padding-bottom: 10px;
            }
            .header-top {
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 8px;
            }
            .logo {
              width: 40px;
              height: 40px;
              border-radius: 20px;
              margin-right: 10px;
            }
            .company-name {
              font-size: 20px;
              font-weight: bold;
              color: #133E87;
            }
            .report-title {
              font-size: 14px;
              color: #333;
              text-align: center;
              margin-bottom: 8px;
              font-weight: bold;
            }
            .filter-info {
              font-size: 11px;
              color: #666;
              margin-bottom: 8px;
              text-align: center;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: 11px;
            }
            th {
              background-color: #133E87;
              color: white;
              padding: 6px;
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
            .section-title {
              font-size: 13px;
              font-weight: bold;
              color: #133E87;
              margin-top: 15px;
              margin-bottom: 10px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            h4 {
              margin: 10px 0 5px 0;
              font-size: 12px;
              color: #333;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="data:image/png;base64,${logoBase64}" class="logo" alt="Logo" />
              <div class="company-name">Internet of Tsiken</div>
            </div>
            <div class="report-title">Attacks Per Batch Report</div>
            <div class="filter-info">
              Date Range: ${formatDisplayDate(startDateStr)} to ${formatDisplayDate(endDateStr)}<br>
              Report Generated: ${formatReportDateTime()}<br>
              Total Attacks: ${totalAttacks} | Total Mortality: ${totalMortality}
            </div>
          </div>

          <div class="section-title">Attacks Summary by Batch</div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Batch</th>
                <th style="text-align: center; width: 12%;">Attacks</th>
                <th style="text-align: center; width: 12%;">Mortality</th>
                <th style="text-align: center; width: 22%;">Deaths per Attack %</th>
                <th style="text-align: center; width: 16%;">Trend</th>
                <th style="text-align: center; width: 18%;">Peak Time</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="section-title">Predator Type Per Batch </div>
          ${predatorPerBatchHTML || "<p>No predator data available.</p>"}

          <div class="section-title">All Predators Attack Timing</div>
          ${allPredatorsTimingHTML || "<p>No timing data available.</p>"}

          ${predatorTimingTablesHTML || ""}
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Create custom filename with date
      const formatFileName = (dateStr) => {
        if (!dateStr) return "unknown";
        const [year, month, day] = dateStr.split("-").map(Number);
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
        return `${day}-${months[month - 1]}-${year}`;
      };

      const customFilename = `AttacksPerBatch_${formatFileName(startDateStr)}_to_${formatFileName(endDateStr)}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation
      await logReportGeneration(
        customFilename,
        "Attacks Per Batch Report",
        "Generated attacks per batch report",
        `Attacks per batch report for ${formatDisplayDate(startDateStr)} to ${formatDisplayDate(endDateStr)}`,
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Attacks Per Batch report exported successfully!",
      );
    } catch (error) {
      console.error("[GenerateAttacksPerBatchReport] Error:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingAttacksBatchReport(false);
    }
  };

  /**
   * Generate Feed Per Batch Report PDF
   * Fetches all batches from brooderInfo (includes batches with no feed records)
   * Gets feed activations, average daily feedings, and overfeeding mortality per batch
   */
  const generateFeedPerBatchReportPDF = async () => {
    // Note: This report fetches ALL data regardless of filter
    setIsGeneratingFeedBatchReport(true);
    try {
      console.log("[GenerateFeedPerBatchReport] Starting PDF generation...");

      // Load logo
      const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
      await logoAsset.downloadAsync();
      const logoBase64 = await FileSystem.readAsStringAsync(
        logoAsset.localUri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      // Step 1: Fetch all batches from brooderInfo
      const brooderRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderRef);
      const allBatches = brooderSnapshot.docs.map((doc) => doc.id).sort();

      console.log("[GenerateFeedPerBatchReport] All batches:", allBatches);

      // Step 2: Fetch feed activations from feedingExecutions_logs (no date filter)
      const feedingLogsRef = collection(firestoreDb, "feedingExecutions_logs");
      const feedingSnapshot = await getDocs(feedingLogsRef);

      let batchFeedMap = {};
      let batchAverageFeedingMap = {};

      allBatches.forEach((batchId) => {
        batchFeedMap[batchId] = 0;
        batchAverageFeedingMap[batchId] = 0;
      });

      let totalSuccessActivations = 0;
      let ageCountMap = {}; // For calculating average daily feedings

      // Process each feeding document (all records, no date filtering)
      feedingSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.status !== "Success") return;

        const batchId = data.batchId || "Unknown";

        // Count all successful records regardless of date
        if (batchFeedMap[batchId] !== undefined) {
          batchFeedMap[batchId]++;
        } else {
          batchFeedMap[batchId] = 1;
        }
        totalSuccessActivations++;

        // Count by age for average daily feedings
        const age = data.age || "Unknown";
        if (!ageCountMap[batchId]) {
          ageCountMap[batchId] = {};
        }
        ageCountMap[batchId][age] = (ageCountMap[batchId][age] || 0) + 1;
      });

      // Calculate average daily feedings per batch
      Object.keys(ageCountMap).forEach((batchId) => {
        const ages = Object.keys(ageCountMap[batchId]);
        const totalCount = ages.reduce(
          (sum, age) => sum + ageCountMap[batchId][age],
          0,
        );
        const avgValue = ages.length > 0 ? totalCount / ages.length : 0;
        batchAverageFeedingMap[batchId] =
          avgValue % 1 === 0 ? Math.floor(avgValue) : avgValue.toFixed(2);
      });

      // Step 3: Fetch overfeeding mortality per batch
      let batchOverfeedingDeathsMap = {};
      allBatches.forEach((batchId) => {
        batchOverfeedingDeathsMap[batchId] = 0;
      });

      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordsSnapshot = await getDocs(recordsRef);

      recordsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.causeOfDeath === "Overfeeding" && data.batchId) {
          const batchId = data.batchId;
          if (batchOverfeedingDeathsMap[batchId] !== undefined) {
            batchOverfeedingDeathsMap[batchId] += data.count || 1;
          } else {
            batchOverfeedingDeathsMap[batchId] = data.count || 1;
          }
        }
      });

      console.log("[GenerateFeedPerBatchReport] Batch feed map:", batchFeedMap);

      // Check if there is any data
      if (totalSuccessActivations === 0) {
        showAlert(
          "info",
          "No Data",
          "No successful feed activations found for the selected date range.",
        );
        setIsGeneratingFeedBatchReport(false);
        return;
      }

      // Format dates for display
      const formatDisplayDate = (date) => {
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
        return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
      };

      // Generate table rows
      let tableRowsHtml = "";
      allBatches.forEach((batchId, index) => {
        const activations = batchFeedMap[batchId] || 0;
        const avgFeeding = batchAverageFeedingMap[batchId] || 0;
        const overfeedingDeaths = batchOverfeedingDeathsMap[batchId] || 0;

        // Calculate trend for activations
        let trendHtml = "—";
        if (index > 0) {
          const previousBatchId = allBatches[index - 1];
          const previousActivations = batchFeedMap[previousBatchId] || 0;
          if (previousActivations > 0) {
            const percentageChangeRaw =
              ((activations - previousActivations) / previousActivations) * 100;
            const percentageChange =
              percentageChangeRaw % 1 === 0
                ? Math.floor(percentageChangeRaw)
                : percentageChangeRaw.toFixed(1);
            if (percentageChange > 0) {
              trendHtml = `<span style="color: #4CAF50;">↑</span> <span style="color: #4CAF50;">+${percentageChange}%</span>`;
            } else if (percentageChange < 0) {
              trendHtml = `<span style="color: #F44336;">↓</span> <span style="color: #F44336;">${percentageChange}%</span>`;
            } else {
              trendHtml =
                '<span style="color: #999;">→</span> <span style="color: #999;">0%</span>';
            }
          }
        }

        // Calculate trend for overfeeding deaths
        let deathsTrendHtml = "—";
        if (index > 0) {
          const previousBatchId = allBatches[index - 1];
          const previousDeaths =
            batchOverfeedingDeathsMap[previousBatchId] || 0;
          if (previousDeaths > 0) {
            const percentageChangeRaw =
              ((overfeedingDeaths - previousDeaths) / previousDeaths) * 100;
            const percentageChange =
              percentageChangeRaw % 1 === 0
                ? Math.floor(percentageChangeRaw)
                : percentageChangeRaw.toFixed(1);
            if (percentageChange > 0) {
              deathsTrendHtml = `<span style="color: #F44336;">↑</span> <span style="color: #F44336;">+${percentageChange}%</span>`;
            } else if (percentageChange < 0) {
              deathsTrendHtml = `<span style="color: #4CAF50;">↓</span> <span style="color: #4CAF50;">${percentageChange}%</span>`;
            } else {
              deathsTrendHtml =
                '<span style="color: #999;">→</span> <span style="color: #999;">0%</span>';
            }
          }
        }

        tableRowsHtml += `
          <tr>
            <td>${batchId}</td>
            <td style="text-align: center;">${activations}</td>
            <td style="text-align: center;">${trendHtml}</td>
            <td style="text-align: center;">${avgFeeding}</td>
            <td style="text-align: center;">${overfeedingDeaths}</td>
            <td style="text-align: center;">${deathsTrendHtml}</td>
          </tr>
        `;
      });

      // Add total row
      const totalOverfeedingDeaths = allBatches.reduce(
        (sum, batchId) => sum + (batchOverfeedingDeathsMap[batchId] || 0),
        0,
      );
      const totalAvgFeedingRaw =
        allBatches.reduce(
          (sum, batchId) =>
            sum + parseFloat(batchAverageFeedingMap[batchId] || 0),
          0,
        ) / allBatches.length;
      const totalAvgFeeding =
        totalAvgFeedingRaw % 1 === 0
          ? Math.floor(totalAvgFeedingRaw)
          : totalAvgFeedingRaw.toFixed(2);

      tableRowsHtml += `
        <tr style="background-color: #f0f0f0; font-weight: bold;">
          <td>TOTAL</td>
          <td style="text-align: center;">${totalSuccessActivations}</td>
          <td style="text-align: center;"></td>
          <td style="text-align: center;">${totalAvgFeeding}</td>
          <td style="text-align: center;">${totalOverfeedingDeaths}</td>
          <td style="text-align: center;"></td>
        </tr>
      `;

      // Generate HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4;
              margin: 0.8in 0.8in 0.8in 0.8in;
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
              font-size: 18px;
              font-weight: bold;
              color: #333;
              margin-bottom: 10px;
              text-align: center;
            }
            .filter-info {
              font-size: 12px;
              color: #666;
              line-height: 1.6;
              text-align: center;
            }
            .table-container {
              width: 100%;
              margin-top: 20px;
              display: flex;
              justify-content: center;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background-color: #133E87;
              color: white;
              padding: 8px;
              text-align: center;
              border: 1px solid #333;
              font-weight: bold;
            }
            td {
              padding: 8px;
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
            <div class="report-title">Feed Per Batch Report</div>
            <div class="filter-info">
              All Batches<br>
              Report Generated: ${formatReportDateTime()}
            
            </div>
          </div>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 80px; text-align: left;">Batch ID</th>
                  <th style="width: 110px;">Total Activations</th>
                  <th style="width: 80px;">Trend</th>
                  <th style="width: 120px;">Avg Daily Feedings</th>
                  <th style="width: 110px;">Overfeeding Deaths</th>
                  <th style="width: 110px;">Deaths Trend</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Create custom filename with current date
      const customFilename = `FeedPerBatchReport_${new Date().toLocaleDateString().replace(/\//g, "-")}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation to audit trail
      await logReportGeneration(
        customFilename,
        "Feed Per Batch Report",
        "Generate feed per batch report",
        `Generated and exported feed per batch report with all available data on ${new Date().toLocaleDateString()}`,
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Feed Per Batch report exported successfully!",
      );
    } catch (error) {
      console.error("[GenerateFeedPerBatchReport] Error:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingFeedBatchReport(false);
    }
  };

  /**
   * Generate Water Per Batch Report PDF
   * Fetches water per batch data from wateringExecutions_logs,
   * filters by status "Success", groups by batchId,
   * and generates a professional PDF report with logo and centered table.
   */
  const generateWaterPerBatchReportPDF = async () => {
    // Note: This report fetches ALL data regardless of filter
    setIsGeneratingWaterBatchReport(true);
    try {
      console.log("[GenerateWaterPerBatchReport] Starting PDF generation...");

      // Load logo
      const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
      await logoAsset.downloadAsync();
      const logoBase64 = await FileSystem.readAsStringAsync(
        logoAsset.localUri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      // Step 1: Fetch all batches from brooderInfo
      const brooderRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderRef);
      const allBatches = brooderSnapshot.docs.map((doc) => doc.id).sort();

      console.log("[GenerateWaterPerBatchReport] All batches:", allBatches);

      // Step 2: Fetch water activations from wateringExecutions_logs (no date filter)
      const wateringLogsRef = collection(
        firestoreDb,
        "wateringExecutions_logs",
      );
      const wateringSnapshot = await getDocs(wateringLogsRef);

      let batchWaterMap = {};
      let batchAverageWaterMap = {};

      allBatches.forEach((batchId) => {
        batchWaterMap[batchId] = 0;
        batchAverageWaterMap[batchId] = 0;
      });

      let totalSuccessActivations = 0;
      let ageCountMap = {}; // For calculating average daily water dispensing

      // Process each water document (all records, no date filtering)
      wateringSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.status !== "Success") return;

        const batchId = data.batchId || "Unknown";

        // Count all successful records regardless of date
        if (batchWaterMap[batchId] !== undefined) {
          batchWaterMap[batchId]++;
        } else {
          batchWaterMap[batchId] = 1;
        }
        totalSuccessActivations++;

        // Count by age for average daily water dispensing
        const age = data.age || "Unknown";
        if (!ageCountMap[batchId]) {
          ageCountMap[batchId] = {};
        }
        ageCountMap[batchId][age] = (ageCountMap[batchId][age] || 0) + 1;
      });

      // Calculate average daily water dispensing per batch
      Object.keys(ageCountMap).forEach((batchId) => {
        const ages = Object.keys(ageCountMap[batchId]);
        const totalCount = ages.reduce(
          (sum, age) => sum + ageCountMap[batchId][age],
          0,
        );
        const avgValue = ages.length > 0 ? totalCount / ages.length : 0;
        batchAverageWaterMap[batchId] =
          avgValue % 1 === 0 ? Math.floor(avgValue) : avgValue.toFixed(2);
      });

      // Step 3: Fetch dehydration mortality per batch
      let batchDehydrationDeathsMap = {};
      allBatches.forEach((batchId) => {
        batchDehydrationDeathsMap[batchId] = 0;
      });

      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordsSnapshot = await getDocs(recordsRef);

      recordsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.causeOfDeath === "Dehydration" && data.batchId) {
          const batchId = data.batchId;
          if (batchDehydrationDeathsMap[batchId] !== undefined) {
            batchDehydrationDeathsMap[batchId] += data.count || 1;
          } else {
            batchDehydrationDeathsMap[batchId] = data.count || 1;
          }
        }
      });

      console.log(
        "[GenerateWaterPerBatchReport] Batch water map:",
        batchWaterMap,
      );

      // Check if there is any data
      if (totalSuccessActivations === 0) {
        showAlert(
          "info",
          "No Data",
          "No successful water activations found for the selected date range.",
        );
        setIsGeneratingWaterBatchReport(false);
        return;
      }

      // Format dates for display
      const formatDisplayDate = (date) => {
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
        return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
      };

      // Generate table rows
      let tableRowsHtml = "";
      allBatches.forEach((batchId, index) => {
        const activations = batchWaterMap[batchId] || 0;
        const avgWater = batchAverageWaterMap[batchId] || 0;
        const dehydrationDeaths = batchDehydrationDeathsMap[batchId] || 0;

        // Calculate trend for activations
        let trendHtml = "—";
        if (index > 0) {
          const previousBatchId = allBatches[index - 1];
          const previousActivations = batchWaterMap[previousBatchId] || 0;
          if (previousActivations > 0) {
            const percentageChangeRaw =
              ((activations - previousActivations) / previousActivations) * 100;
            const percentageChange =
              percentageChangeRaw % 1 === 0
                ? Math.floor(percentageChangeRaw)
                : percentageChangeRaw.toFixed(1);
            if (percentageChange > 0) {
              trendHtml = `<span style="color: #4CAF50;">↑</span> <span style="color: #4CAF50;">+${percentageChange}%</span>`;
            } else if (percentageChange < 0) {
              trendHtml = `<span style="color: #F44336;">↓</span> <span style="color: #F44336;">${percentageChange}%</span>`;
            } else {
              trendHtml =
                '<span style="color: #999;">→</span> <span style="color: #999;">0%</span>';
            }
          }
        }

        // Calculate trend for dehydration deaths
        let deathsTrendHtml = "—";
        if (index > 0) {
          const previousBatchId = allBatches[index - 1];
          const previousDeaths =
            batchDehydrationDeathsMap[previousBatchId] || 0;
          if (previousDeaths > 0) {
            const percentageChangeRaw =
              ((dehydrationDeaths - previousDeaths) / previousDeaths) * 100;
            const percentageChange =
              percentageChangeRaw % 1 === 0
                ? Math.floor(percentageChangeRaw)
                : percentageChangeRaw.toFixed(1);
            if (percentageChange > 0) {
              deathsTrendHtml = `<span style="color: #F44336;">↑</span> <span style="color: #F44336;">+${percentageChange}%</span>`;
            } else if (percentageChange < 0) {
              deathsTrendHtml = `<span style="color: #4CAF50;">↓</span> <span style="color: #4CAF50;">${percentageChange}%</span>`;
            } else {
              deathsTrendHtml =
                '<span style="color: #999;">→</span> <span style="color: #999;">0%</span>';
            }
          }
        }

        tableRowsHtml += `
          <tr>
            <td>${batchId}</td>
            <td style="text-align: center;">${activations}</td>
            <td style="text-align: center;">${trendHtml}</td>
            <td style="text-align: center;">${avgWater}</td>
            <td style="text-align: center;">${dehydrationDeaths}</td>
            <td style="text-align: center;">${deathsTrendHtml}</td>
          </tr>
        `;
      });

      // Add total row
      const totalDehydrationDeaths = allBatches.reduce(
        (sum, batchId) => sum + (batchDehydrationDeathsMap[batchId] || 0),
        0,
      );
      const totalAvgWaterRaw =
        allBatches.reduce(
          (sum, batchId) =>
            sum + parseFloat(batchAverageWaterMap[batchId] || 0),
          0,
        ) / allBatches.length;
      const totalAvgWater =
        totalAvgWaterRaw % 1 === 0
          ? Math.floor(totalAvgWaterRaw)
          : totalAvgWaterRaw.toFixed(2);

      tableRowsHtml += `
        <tr style="background-color: #f0f0f0; font-weight: bold;">
          <td>TOTAL</td>
          <td style="text-align: center;">${totalSuccessActivations}</td>
          <td style="text-align: center;"></td>
          <td style="text-align: center;">${totalAvgWater}</td>
          <td style="text-align: center;">${totalDehydrationDeaths}</td>
          <td style="text-align: center;"></td>
        </tr>
      `;

      // Generate HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4;
              margin: 0.8in 0.8in 0.8in 0.8in;
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
              font-size: 18px;
              font-weight: bold;
              color: #333;
              margin-bottom: 10px;
              text-align: center;
            }
            .filter-info {
              font-size: 12px;
              color: #666;
              line-height: 1.6;
              text-align: center;
            }
            .table-container {
              width: 100%;
              margin-top: 20px;
              display: flex;
              justify-content: center;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background-color: #133E87;
              color: white;
              padding: 8px;
              text-align: center;
              border: 1px solid #333;
              font-weight: bold;
            }
            td {
              padding: 8px;
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
            <div class="report-title">Water Per Batch Report</div>
            <div class="filter-info"> All Batches<br>
                        Report Generated: ${formatReportDateTime()}<br>
                       </div>
          </div>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 80px; text-align: left;">Batch ID</th>
                  <th style="width: 110px;">Total Activations</th>
                  <th style="width: 80px;">Trend</th>
                  <th style="width: 120px;">Avg Daily Dispensed</th>
                  <th style="width: 110px;">Dehydration Deaths</th>
                  <th style="width: 110px;">Deaths Trend</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Create custom filename with current date
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

      const today = new Date();
      const customFilename = `WaterPerBatchReport_${formatDate(today)}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation to audit trail
      await logReportGeneration(
        customFilename,
        "Water Per Batch Report",
        "Generate water per batch report",
        `Generated and exported water per batch report with all-time data`,
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Water Per Batch report exported successfully!",
      );
    } catch (error) {
      console.error("[GenerateWaterPerBatchReport] Error:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingWaterBatchReport(false);
    }
  };

  /**
   * Generate Cause of Death Report PDF
   * Fetches mortality records for the selected date range,
   * aggregates by causeOfDeath, calculates percentages,
   * and generates a comprehensive PDF report.
   */
  const generateCauseOfDeathReportPDF = async () => {
    // Set default dates to last 7 days if not selected
    let startDateStr = causeExportStartDate;
    let endDateStr = causeExportEndDate;

    if (!startDateStr || !endDateStr) {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // -6 to include 7 days total

      // Format as YYYY-MM-DD
      const formatDateString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      startDateStr = formatDateString(sevenDaysAgo);
      endDateStr = formatDateString(today);

      setCauseExportStartDate(startDateStr);
      setCauseExportEndDate(endDateStr);
    }

    setIsGeneratingCauseReport(true);
    try {
      console.log(
        "Starting PDF generation with dates:",
        startDateStr,
        endDateStr,
      );

      const recordsRef = collectionGroup(firestoreDb, "records");
      const recordsSnapshot = await getDocs(recordsRef);

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
              (predatorTypes[data.predatorType] || 0) + count;
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
        showAlert(
          "info",
          "No Data",
          "No mortality records found for the selected date range.",
        );
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

      // Fetch all batches from brooderInfo collection and initialize with 0 values
      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);

      // Initialize all batches with 0 values
      brooderSnapshot.docs.forEach((doc) => {
        const batchId = doc.id;
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
      });

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

      // Sort batches alphabetically for consistent ordering
      const sortedBatches = Object.entries(batchSummary).sort(([a], [b]) =>
        a.localeCompare(b),
      );

      // Calculate trend for each batch (percentage change from previous total)
      let previousTotal = 0;
      sortedBatches.forEach(([batchId, summary], index) => {
        let trendDisplay = "";
        let trendColor = "";

        if (index === 0) {
          // First batch has no trend
          trendDisplay = "-";
        } else {
          const currentTotal = summary.totalDeaths;
          if (previousTotal === 0) {
            if (currentTotal > 0) {
              trendDisplay = "↑";
              trendColor = "color: #FF6B6B;";
            } else {
              trendDisplay = "-";
            }
          } else {
            const percentageChange = (
              ((currentTotal - previousTotal) / previousTotal) *
              100
            ).toFixed(1);
            if (currentTotal > previousTotal) {
              trendDisplay = `↑ +${percentageChange}%`;
              trendColor = "color: #FF6B6B;";
            } else if (currentTotal < previousTotal) {
              trendDisplay = `↓ ${percentageChange}%`;
              trendColor = "color: #4CAF50;";
            } else {
              trendDisplay = "→ 0%";
              trendColor = "color: #999;";
            }
          }
        }
        previousTotal = summary.totalDeaths;

        // Find the highest value in this batch (excluding total and trend)
        const batchValues = [
          summary.dog,
          summary.cat,
          summary.rat,
          summary.snake,
          summary.otherPredator,
          summary.dehydration,
          summary.overfeeding,
          summary.disease,
          summary.otherCause,
        ];
        const maxValue = Math.max(...batchValues);

        // Helper function to apply red color if this is the max value
        const getCellStyle = (value) => {
          return value === maxValue && maxValue > 0
            ? 'style="text-align: center; color: #F44336;"'
            : 'style="text-align: center;"';
        };

        batchRows += `
          <tr>
            <td>${batchId}</td>
            <td ${getCellStyle(summary.dog)}>${summary.dog}</td>
            <td ${getCellStyle(summary.cat)}>${summary.cat}</td>
            <td ${getCellStyle(summary.rat)}>${summary.rat}</td>
            <td ${getCellStyle(summary.snake)}>${summary.snake}</td>
            <td ${getCellStyle(summary.otherPredator)}>${summary.otherPredator}</td>
            <td ${getCellStyle(summary.dehydration)}>${summary.dehydration}</td>
            <td ${getCellStyle(summary.overfeeding)}>${summary.overfeeding}</td>
            <td ${getCellStyle(summary.disease)}>${summary.disease}</td>
            <td ${getCellStyle(summary.otherCause)}>${summary.otherCause}</td>
            <td style="text-align: center;">${summary.totalDeaths}</td>
            <td style="text-align: center; ${trendColor}">${trendDisplay}</td>
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
          <td style="text-align: center;">${totalDog}</td>
          <td style="text-align: center;">${totalCat}</td>
          <td style="text-align: center;">${totalRat}</td>
          <td style="text-align: center;">${totalSnake}</td>
          <td style="text-align: center;">${totalOther}</td>
          <td style="text-align: center;">${totalDehydrationBreakdown}</td>
          <td style="text-align: center;">${totalOverfeedingBreakdown}</td>
          <td style="text-align: center;">${totalDiseaseBreakdown}</td>
          <td style="text-align: center;">${totalOtherCause}</td>
          <td style="text-align: center;">${grandTotal}</td>
          <td></td>
        </tr>
      `;

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
            <div class="report-title">Cause of Death Report</div>
            <div class="filter-info">
              Date Range: ${dateRangeDisplay}<br>
              Report Generated: ${formatReportDateTime()}<br>
              Total Deaths: ${totalDeaths}
            </div>
          </div>

          <div class="summary-section">
            <div class="summary-title">Causes of Death Summary</div>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Predatory Attacks</div>
                <div class="summary-value">${predatorPct}%</div>
                <div class="summary-label">(${predatorCount} ${predatorCount === 1 || predatorCount === 0 ? "death" : "deaths"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Dehydration</div>
                <div class="summary-value">${dehydrationPct}%</div>
                <div class="summary-label">(${dehydrationCount} ${dehydrationCount === 1 || dehydrationCount === 0 ? "death" : "deaths"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Overfeeding</div>
                <div class="summary-value">${overfeedingPct}%</div>
                <div class="summary-label">(${overfeedingCount} ${overfeedingCount === 1 || overfeedingCount === 0 ? "death" : "deaths"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Other</div>
                <div class="summary-value">${otherPct}%</div>
                <div class="summary-label">(${otherCount} ${otherCount === 1 || otherCount === 0 ? "death" : "deaths"})</div>
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
            <div class="summary-title">Causes of Death Per Batch</div>
           
          <table>
            <thead>
              <tr>
                <th>Batch ID</th>
                <th style="text-align: center;">Dog</th>
                <th style="text-align: center;">Cat</th>
                <th style="text-align: center;">Rat</th>
                <th style="text-align: center;">Snake</th>
                <th style="text-align: center;">Other</th>
                <th style="text-align: center;">Dehydration</th>
                <th style="text-align: center;">Overfeeding</th>
                <th style="text-align: center;">Disease</th>
                <th style="text-align: center;">Other Causes</th>
                <th style="text-align: center;">Total</th>
                <th style="text-align: center;">Trend</th>
              </tr>
            </thead>
            <tbody>
              ${batchRows}
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
        "Generate cause of death report",
        `Generated cause of death report for ${formatDateRange(causeExportStartDate)} to ${formatDateRange(causeExportEndDate)}`,
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Cause of Death report exported successfully!",
      );
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

        showAlert(
          "success",
          "Success",
          "System Overview report exported successfully!",
        );
      } catch (fallbackError) {
        console.error("Error creating branded error page:", fallbackError);
        // Fallback to alert if branded error page fails
        showAlert(
          "error",
          "Error",
          "Failed to generate report: " + error.message,
        );
      }
      setExportCauseModalVisible(false);
    } finally {
      setIsGeneratingCauseReport(false);
    }
  };

  // Generate Predator Types Report PDF
  const generatePredatorTypesReportPDF = async () => {
    setIsGeneratingPredatorTypesReport(true);
    try {
      // Get date range from chartFilters or use default 7 days
      let startDateStr = null;
      let endDateStr = null;

      if (
        chartFilters["predatortypes"] &&
        chartFilters["predatortypes"].startDate &&
        chartFilters["predatortypes"].endDate
      ) {
        startDateStr = chartFilters["predatortypes"].startDate;
        endDateStr = chartFilters["predatortypes"].endDate;
      } else {
        // Default to last 7 days
        const today = new Date();
        endDateStr = today.toISOString().split("T")[0];
        const sevenDaysAgo = new Date(
          today.getTime() - 7 * 24 * 60 * 60 * 1000,
        );
        startDateStr = sevenDaysAgo.toISOString().split("T")[0];
      }

      // Validate dates
      if (!startDateStr || !endDateStr) {
        showAlert("error", "Error", "Failed to determine date range");
        return;
      }

      console.log(
        "Starting Predator Types PDF generation with dates:",
        startDateStr,
        endDateStr,
      );

      const [startYear, startMonth, startDay] = startDateStr
        .split("-")
        .map(Number);
      const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);

      let startDate = new Date(startYear, startMonth - 1, startDay);
      startDate.setHours(0, 0, 0, 0);

      let endDate = new Date(endYear, endMonth - 1, endDay);
      endDate.setHours(23, 59, 59, 999);

      // Fetch predator attacks data for date range
      const predatorAttacksRef = collection(firestoreDb, "predatorAttacks");
      const batchesSnapshot = await getDocs(predatorAttacksRef);

      let predatorCounts = {
        dog: 0,
        cat: 0,
        rat: 0,
        snake: 0,
        other: 0,
      };
      let totalAttacks = 0;

      // Track batch summaries
      const batchSummary = {};
      let allAttacks = []; // Collect all attacks for mortality correlation

      // Iterate through each batch and fetch attacks
      for (const batchDoc of batchesSnapshot.docs) {
        const batchId = batchDoc.id;

        try {
          const attacksRef = collection(
            firestoreDb,
            "predatorAttacks",
            batchId,
            "attacks",
          );
          const attacksSnapshot = await getDocs(attacksRef);

          // Initialize batch summary
          if (!batchSummary[batchId]) {
            batchSummary[batchId] = {
              dog: 0,
              cat: 0,
              rat: 0,
              snake: 0,
              other: 0,
              total: 0,
            };
          }

          attacksSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const attackDatetime = data.attack_datetime;
            const predatorType = data.predator_type;

            if (!attackDatetime || !predatorType) return;

            // Convert Firestore Timestamp to Date
            let attackDate;
            try {
              if (
                attackDatetime.toDate &&
                typeof attackDatetime.toDate === "function"
              ) {
                attackDate = attackDatetime.toDate();
              } else if (attackDatetime.seconds) {
                attackDate = new Date(attackDatetime.seconds * 1000);
              } else if (attackDatetime instanceof Date) {
                attackDate = attackDatetime;
              } else {
                attackDate = new Date(attackDatetime);
              }

              if (isNaN(attackDate.getTime())) return;

              // Check if within filter range
              if (attackDate < startDate || attackDate > endDate) return;

              // Categorize predator type
              const predatorTypeNormalized = predatorType.toLowerCase().trim();
              let category = "other";

              if (predatorTypeNormalized.includes("dog")) {
                predatorCounts.dog++;
                category = "dog";
              } else if (predatorTypeNormalized.includes("cat")) {
                predatorCounts.cat++;
                category = "cat";
              } else if (predatorTypeNormalized.includes("rat")) {
                predatorCounts.rat++;
                category = "rat";
              } else if (predatorTypeNormalized.includes("snake")) {
                predatorCounts.snake++;
                category = "snake";
              } else {
                predatorCounts.other++;
              }

              // Track in batch summary
              batchSummary[batchId][category]++;
              batchSummary[batchId].total++;

              // Collect all attack data for mortality correlation
              allAttacks.push({
                batchId,
                predatorType: category,
                predatorTypeRaw: predatorType,
                attackDate,
                ...data,
              });

              totalAttacks++;
            } catch (error) {
              console.warn("Error processing attack date:", error);
            }
          });
        } catch (error) {
          console.warn(`Error fetching attacks for batch ${batchId}:`, error);
        }
      }

      // Fetch mortality records and correlate with attacks
      const batchMortalityByPredator = {}; // Track attacks with mortality and death counts
      try {
        const mortalityRef = collectionGroup(firestoreDb, "records");
        const mortalitySnapshot = await getDocs(mortalityRef);

        mortalitySnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const batchId = data.batchId;
          const deathCount = data.count || 1;

          if (!batchId) return;

          let mortalityDate;
          if (data.timestamp?.toDate) {
            mortalityDate = data.timestamp.toDate();
          } else if (data.timestamp?.seconds) {
            mortalityDate = new Date(data.timestamp.seconds * 1000);
          }

          if (!mortalityDate) return;

          const mortalityDateOnly = new Date(
            mortalityDate.getFullYear(),
            mortalityDate.getMonth(),
            mortalityDate.getDate(),
          );

          // Match with attacks from same date and predator type
          const matchingAttacks = allAttacks.filter((attack) => {
            const attackDateOnly = new Date(
              attack.attackDate.getFullYear(),
              attack.attackDate.getMonth(),
              attack.attackDate.getDate(),
            );
            // Normalize both predator types for case-insensitive comparison
            const attackPredatorNormalized = (attack.predator_type || "Unknown")
              .toLowerCase()
              .trim();
            const mortalityPredatorNormalized = (data.predatorType || "Unknown")
              .toLowerCase()
              .trim();

            return (
              attack.batchId === batchId &&
              attackDateOnly.getTime() === mortalityDateOnly.getTime() &&
              attackPredatorNormalized === mortalityPredatorNormalized
            );
          });

          // If attacks match, track mortality data for this batch/predator combo
          if (matchingAttacks.length > 0) {
            // Use normalized predator type for consistent key matching
            const key = `${batchId}_${matchingAttacks[0].predatorType}`;
            if (!batchMortalityByPredator[key]) {
              batchMortalityByPredator[key] = {
                uniqueAttackIds: new Set(),
                deaths: 0,
              };
            }
            // Track unique attack IDs (avoid counting same attack twice)
            matchingAttacks.forEach((attack) => {
              const attackId = `${attack.attackDate.getTime()}_${attack.predatorType}`;
              batchMortalityByPredator[key].uniqueAttackIds.add(attackId);
            });
            batchMortalityByPredator[key].deaths += deathCount;
          }
        });

        // Convert unique attack sets to counts
        Object.keys(batchMortalityByPredator).forEach((key) => {
          const uniqueAttackCount =
            batchMortalityByPredator[key].uniqueAttackIds.size;
          batchMortalityByPredator[key].uniqueAttacks = uniqueAttackCount;
        });
      } catch (error) {
        console.warn("Error fetching mortality records:", error);
      }

      if (totalAttacks === 0) {
        showAlert(
          "info",
          "No Data",
          "No predator attacks found for the selected date range.",
        );
        setExportPredatorTypesModalVisible(false);
        setIsGeneratingPredatorTypesReport(false);
        return;
      }

      // Helper function to format percentages without .00 for whole numbers
      const formatPercentage = (value) => {
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (numValue === 0) return "0";
        const rounded = Math.round(numValue * 100) / 100;
        return Number.isInteger(rounded)
          ? rounded.toString()
          : rounded.toFixed(2);
      };

      // Calculate percentages
      const dogPct =
        totalAttacks > 0
          ? formatPercentage((predatorCounts.dog / totalAttacks) * 100)
          : 0;
      const catPct =
        totalAttacks > 0
          ? formatPercentage((predatorCounts.cat / totalAttacks) * 100)
          : 0;
      const ratPct =
        totalAttacks > 0
          ? formatPercentage((predatorCounts.rat / totalAttacks) * 100)
          : 0;
      const snakePct =
        totalAttacks > 0
          ? formatPercentage((predatorCounts.snake / totalAttacks) * 100)
          : 0;
      const otherPct =
        totalAttacks > 0
          ? formatPercentage((predatorCounts.other / totalAttacks) * 100)
          : 0;

      // Format dates for display
      const formatDate = (dateStr) => {
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

      const dateRangeDisplay = `${formatDate(startDateStr)} to ${formatDate(endDateStr)}`;

      // Format filename
      const startFormatted = formatDate(startDateStr);
      const endFormatted = formatDate(endDateStr);
      const filename = `PredatorTypes_${startFormatted}_to_${endFormatted}`;

      // Load logo
      const logoAsset = Asset.fromModule(require("../../assets/logo.png"));
      await logoAsset.downloadAsync();
      const logoBase64 = await FileSystem.readAsStringAsync(
        logoAsset.localUri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      // Create summary table rows with highlighting for max count and percentage
      const counts = [
        predatorCounts.dog,
        predatorCounts.cat,
        predatorCounts.rat,
        predatorCounts.snake,
        predatorCounts.other,
      ];
      const percentages = [
        parseFloat(dogPct),
        parseFloat(catPct),
        parseFloat(ratPct),
        parseFloat(snakePct),
        parseFloat(otherPct),
      ];
      const maxCount = Math.max(...counts);
      const maxPercentage = Math.max(...percentages);

      const summaryRows = `
        <tr>
          <td>Dog</td>
          <td style="text-align: center; ${predatorCounts.dog === maxCount ? "color: #F44336; font-weight: bold;" : ""}">${predatorCounts.dog}</td>
          <td style="text-align: center; ${parseFloat(dogPct) === maxPercentage ? "color: #F44336; font-weight: bold;" : ""}">${dogPct}%</td>
        </tr>
        <tr>
          <td>Cat</td>
          <td style="text-align: center; ${predatorCounts.cat === maxCount ? "color: #F44336; font-weight: bold;" : ""}">${predatorCounts.cat}</td>
          <td style="text-align: center; ${parseFloat(catPct) === maxPercentage ? "color: #F44336; font-weight: bold;" : ""}">${catPct}%</td>
        </tr>
        <tr>
          <td>Snake</td>
          <td style="text-align: center; ${predatorCounts.snake === maxCount ? "color: #F44336; font-weight: bold;" : ""}">${predatorCounts.snake}</td>
          <td style="text-align: center; ${parseFloat(snakePct) === maxPercentage ? "color: #F44336; font-weight: bold;" : ""}">${snakePct}%</td>
        </tr>
        <tr>
          <td>Rat</td>
          <td style="text-align: center; ${predatorCounts.rat === maxCount ? "color: #F44336; font-weight: bold;" : ""}">${predatorCounts.rat}</td>
          <td style="text-align: center; ${parseFloat(ratPct) === maxPercentage ? "color: #F44336; font-weight: bold;" : ""}">${ratPct}%</td>
        </tr>
        <tr>
          <td>Other</td>
          <td style="text-align: center; ${predatorCounts.other === maxCount ? "color: #F44336; font-weight: bold;" : ""}">${predatorCounts.other}</td>
          <td style="text-align: center; ${parseFloat(otherPct) === maxPercentage ? "color: #F44336; font-weight: bold;" : ""}">${otherPct}%</td>
        </tr>
        <tr style="background-color: #e8e8e8; font-weight: bold;">
          <td>TOTAL</td>
          <td style="text-align: center;">${totalAttacks}</td>
          <td style="text-align: center;">100%</td>
        </tr>
      `;

      // Fetch all batches from brooderInfo to ensure every batch is included
      const brooderInfoRef = collection(firestoreDb, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);
      const allBatchIds = brooderSnapshot.docs.map((doc) => doc.id).sort();

      // Initialize missing batches in batchSummary
      allBatchIds.forEach((batchId) => {
        if (!batchSummary[batchId]) {
          batchSummary[batchId] = {
            dog: 0,
            cat: 0,
            rat: 0,
            snake: 0,
            other: 0,
            total: 0,
          };
        }
      });

      // Create batch summary table rows
      let batchTableRows = "";
      let totalDog = 0,
        totalCat = 0,
        totalRat = 0,
        totalSnake = 0,
        totalOther = 0,
        grandTotal = 0;

      const batchEntries = Object.entries(batchSummary).sort(
        ([batchA], [batchB]) => batchA.localeCompare(batchB),
      );

      batchEntries.forEach(([batchId, summary], index) => {
        // Find max predator count for this batch to highlight in red
        const counts = [
          summary.dog,
          summary.cat,
          summary.rat,
          summary.snake,
          summary.other,
        ];
        const maxCount = Math.max(...counts);

        // Calculate trend
        let trendHtml = "—";
        if (index > 0) {
          const prevBatch = batchEntries[index - 1][1];
          const prevTotal = prevBatch.total;
          if (prevTotal > 0 && summary.total > 0) {
            const percentChange = (
              ((summary.total - prevTotal) / prevTotal) *
              100
            ).toFixed(1);
            if (summary.total > prevTotal) {
              trendHtml = `<span style="color: #F44336;">↑ +${percentChange}%</span>`;
            } else if (summary.total < prevTotal) {
              const downPercent = Math.abs(percentChange);
              trendHtml = `<span style="color: #4CAF50;">↓ -${downPercent}%</span>`;
            } else {
              trendHtml = "→ 0%";
            }
          } else if (prevTotal === 0 && summary.total > 0) {
            trendHtml = `<span style="color: #F44336;">↑ New</span>`;
          } else if (prevTotal > 0 && summary.total === 0) {
            trendHtml = `<span style="color: #4CAF50;">↓ -100%</span>`;
          }
        }

        batchTableRows += `
          <tr>
            <td>${batchId}</td>
            <td style="text-align: center; ${summary.dog === maxCount && maxCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${summary.dog}</td>
            <td style="text-align: center; ${summary.cat === maxCount && maxCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${summary.cat}</td>
            <td style="text-align: center; ${summary.rat === maxCount && maxCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${summary.rat}</td>
            <td style="text-align: center; ${summary.snake === maxCount && maxCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${summary.snake}</td>
            <td style="text-align: center; ${summary.other === maxCount && maxCount > 0 ? "color: #F44336; font-weight: bold;" : ""}">${summary.other}</td>
            <td style="text-align: center;">${summary.total}</td>
            <td style="text-align: center;">${trendHtml}</td>
          </tr>
        `;
        totalDog += summary.dog;
        totalCat += summary.cat;
        totalRat += summary.rat;
        totalSnake += summary.snake;
        totalOther += summary.other;
        grandTotal += summary.total;
      });

      // Add batch total row
      batchTableRows += `
        <tr style="background-color: #e8e8e8; font-weight: bold;">
          <td>TOTAL</td>
          <td style="text-align: center;">${totalDog}</td>
          <td style="text-align: center;">${totalCat}</td>
          <td style="text-align: center;">${totalRat}</td>
          <td style="text-align: center;">${totalSnake}</td>
          <td style="text-align: center;">${totalOther}</td>
          <td style="text-align: center;">${grandTotal}</td>
          <td style="text-align: center;">—</td>
        </tr>
      `;

      // Generate per-batch mortality detail tables
      let batchDetailTablesHtml = "";

      // Initialize batchMortalityByPredator for all batch/predator combinations
      Object.entries(batchSummary).forEach(([batchId, summary]) => {
        ["dog", "cat", "rat", "snake", "other"].forEach((predator) => {
          const key = `${batchId}_${predator}`;
          if (!batchMortalityByPredator[key]) {
            batchMortalityByPredator[key] = {
              uniqueAttacks: 0,
              deaths: 0,
            };
          }
        });
      });

      const predatorTypes = ["dog", "cat", "rat", "snake", "other"];

      Object.entries(batchSummary)
        .sort(([batchA], [batchB]) => batchA.localeCompare(batchB))
        .forEach(([batchId, summary]) => {
          let detailTableRows = "";
          let totalWithMortality = 0,
            totalOnlyAttacks = 0,
            totalCombined = 0,
            totalMortalityDeaths = 0;

          // Calculate all percentages to find the max
          const percentages = [];
          predatorTypes.forEach((predator) => {
            const totalPredatorAttacks = summary[predator] || 0;
            const pct =
              summary.total > 0
                ? (totalPredatorAttacks / summary.total) * 100
                : 0;
            percentages.push(pct);
          });
          const maxPercentage = Math.max(...percentages);

          predatorTypes.forEach((predator, index) => {
            // Count attacks that led to mortality
            const mortalityKey = `${batchId}_${predator}`;
            const mortalityData = batchMortalityByPredator[mortalityKey] || {
              uniqueAttacks: 0,
              deaths: 0,
            };
            const withMortality = mortalityData.uniqueAttacks || 0;
            const deaths = mortalityData.deaths || 0;

            // Only attacks = total attacks for this predator - attacks with mortality
            const totalPredatorAttacks = summary[predator] || 0;
            const onlyAttacks = totalPredatorAttacks - withMortality;
            const percentage =
              summary.total > 0
                ? (totalPredatorAttacks / summary.total) * 100
                : 0;
            const isMaxPercentage =
              Math.abs(percentage - maxPercentage) < 0.01 &&
              totalPredatorAttacks > 0;
            const redStyle = isMaxPercentage
              ? "color: #F44336; font-weight: bold;"
              : "";

            detailTableRows += `
              <tr>
                <td style="text-align: left;">${predator.charAt(0).toUpperCase() + predator.slice(1)}</td>
                <td style="text-align: center;">${withMortality}</td>
                <td style="text-align: center;">${deaths}</td>                
                <td style="text-align: center;">${onlyAttacks}</td>
                <td style="text-align: center;">${totalPredatorAttacks}</td>
                <td style="text-align: center; ${redStyle}">${formatPercentage(percentage)}%</td>
              </tr>
            `;
            totalWithMortality += withMortality;
            totalOnlyAttacks += onlyAttacks;
            totalCombined += totalPredatorAttacks;
            totalMortalityDeaths += deaths;
          });

          // Generate table for all batches (including those with no attacks)
          if (summary.total > 0) {
            detailTableRows += `
              <tr style="background-color: #e8e8e8; font-weight: bold;">
                <td>TOTAL</td>
                <td style="text-align: center;">${totalWithMortality}</td>
                <td style="text-align: center;">${totalOnlyAttacks}</td>
                <td style="text-align: center;">${totalCombined}</td>
                <td style="text-align: center;">${totalMortalityDeaths}</td>
                <td style="text-align: center;">100%</td>
              </tr>
            `;
          } else {
            detailTableRows = `
              <tr>
                <td colspan="6" style="text-align: center; padding: 10px; color: #999;">No attacks recorded</td>
              </tr>
            `;
          }

          batchDetailTablesHtml += `
            <div style="margin-top: 20px; page-break-inside: avoid;">
              <h3 style="color: #133E87; font-size: 13px; margin-bottom: 10px;">${batchId} - Predator Attacks with Mortality Breakdown</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 10px 0;">
                <thead>
                  <tr style="background-color: #f0f0f0;">
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Predator</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Fatal Attacks</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Deaths</th>                      
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Non‑Fatal Attacks</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Total Attacks</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Attack Distribution (%)</th>
                  </tr>
                </thead>
                <tbody>
                  ${detailTableRows}
                </tbody>
              </table>
            </div>
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
              width: auto;
              max-width: 400px;
              border-collapse: collapse;
              margin: left;
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
            <div class="report-title">Predator Types Analysis Report</div>
            <div class="filter-info">
              Date Range: ${dateRangeDisplay}<br>
              Report Generated: ${formatReportDateTime()}<br>
              Total Attacks: ${totalAttacks}
            </div>
          </div>

          <div class="summary-section">
            <div class="summary-title">Predator Types Summary</div>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Dog Attacks</div>
                <div class="summary-value">${dogPct}%</div>
                <div class="summary-label">(${predatorCounts.dog} ${predatorCounts.dog === 0 || predatorCounts.dog === 1 ? "attack" : "attacks"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Cat Attacks</div>
                <div class="summary-value">${catPct}%</div>
                <div class="summary-label">(${predatorCounts.cat} ${predatorCounts.cat === 0 || predatorCounts.cat === 1 ? "attack" : "attacks"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Snake Attacks</div>
                <div class="summary-value">${snakePct}%</div>
                <div class="summary-label">(${predatorCounts.snake} ${predatorCounts.snake === 0 || predatorCounts.snake === 1 ? "attack" : "attacks"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Rat Attacks</div>
                <div class="summary-value">${ratPct}%</div>
                <div class="summary-label">(${predatorCounts.rat} ${predatorCounts.rat === 0 || predatorCounts.rat === 1 ? "attack" : "attacks"})</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Other Predators</div>
                <div class="summary-value">${otherPct}%</div>
                <div class="summary-label">(${predatorCounts.other} ${predatorCounts.other === 0 || predatorCounts.other === 1 ? "attack" : "attacks"})</div>
              </div>
            </div>
          </div>

          <div class="summary-section" style="margin-top: 30px; page-break-inside: avoid;">
            <div class="summary-title">Summary of All Batches</div>
             <table style="width: 125%; margin: 15px 0; table-layout: fixed;">
            <thead>
              <tr>
                <th style="width: 33.33%;">Predator Type</th>
                <th style="width: 33.33%; text-align: center;">Number of Attacks</th>
                <th style="width: 33.33%; text-align: center;">Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${summaryRows}
            </tbody>
          </table>
          </div>

          <div class="summary-section" style="margin-top: 30px; page-break-inside: avoid;">
            <div class="summary-title">Attacks Per Batch</div>
            <table style="width: 150%; border-collapse: collapse; font-size: 12px; margin: 15px 0;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="border: 1px solid #ddd; padding: 8px;">Batch ID</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Dog</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Cat</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Rat</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Snake</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Other</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Total</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Trend</th>
                </tr>
              </thead>
              <tbody>
                ${batchTableRows}
              </tbody>
            </table>
            
     </div>

     ${batchDetailTablesHtml}

   

  
        </body>
        </html>
      `;

      // Generate PDF
      const pdf = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      const customFilename = `${filename}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${customFilename}`;

      // Copy the PDF to a new location with custom name
      await FileSystem.copyAsync({
        from: pdf.uri,
        to: newPath,
      });

      // Log report generation to audit trail
      await logReportGeneration(
        customFilename,
        "Predator Types Report",
        "Generate predator types report",
        `Generated and exported predator types report for ${formatDateRange(startDate)} to ${formatDateRange(endDate)}`,
      );

      // Share PDF with custom filename
      await Sharing.shareAsync(newPath);

      showAlert(
        "success",
        "Success",
        "Predator Types report exported successfully!",
      );
    } catch (error) {
      console.error("Error generating Predator Types report:", error);
      showAlert(
        "error",
        "Error",
        "Failed to generate report: " + error.message,
      );
    } finally {
      setIsGeneratingPredatorTypesReport(false);
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
      "[adminAnalytics] useEffect: Mounting component, setting default filters",
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

    const defaultWaterBatchFilter = {
      startDate: formatDateToISO(sevenDaysAgo),
      endDate: formatDateToISO(today),
    };

    console.log("[adminAnalytics] Default 7-day filter set:", defaultFilter);
    console.log(
      "[adminAnalytics] Default 7-day filter set for water batch:",
      defaultWaterBatchFilter,
    );
    setChartFilters((prev) => ({
      ...prev,
      mortality: defaultFilter,
      cause: defaultFilter,
      mortalitybatch: defaultFilter,
      predator: defaultFilter,
      attacksbatch: defaultFilter,
      predatortypes: defaultFilter,
      feedbatch: defaultFilter,
      waterbatch: defaultWaterBatchFilter,
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
    fetchTotalPredatorAttacksCount();
    fetchAttacksPerBatchData();
  }, []);

  // Fetch cause of death stats on mount and when filter changes
  useEffect(() => {
    console.log("[adminAnalytics] useEffect: Fetching cause of death stats...");
    fetchCauseOfDeathStats(chartFilters["cause"]);
  }, [chartFilters["cause"]]);

  // Fetch mortality per batch stats when filter changes
  useEffect(() => {
    console.log(
      "[adminAnalytics] useEffect: Fetching mortality per batch stats...",
      chartFilters["mortalitybatch"],
    );
    fetchMortalityBatchData(chartFilters["mortalitybatch"]);
  }, [chartFilters["mortalitybatch"]]);

  // Fetch predator attacks data on mount and when filter changes
  useEffect(() => {
    console.log(
      "[adminAnalytics] useEffect: Fetching predator attacks data...",
      chartFilters["predator"],
    );
    fetchPredatorAttacksData(chartFilters["predator"]);
  }, [chartFilters["predator"]]);

  // Fetch predator types data on mount and when filter changes
  useEffect(() => {
    console.log(
      "[adminAnalytics] useEffect: Fetching predator types data...",
      chartFilters["predatortypes"],
    );
    fetchPredatorTypesData(chartFilters["predatortypes"]);
  }, [chartFilters["predatortypes"]]);

  // Fetch attacks per batch data when filter changes
  useEffect(() => {
    console.log(
      "[adminAnalytics] useEffect: Fetching attacks per batch data...",
      chartFilters["attacksbatch"],
    );
    fetchAttacksPerBatchData(chartFilters["attacksbatch"]);
  }, [chartFilters["attacksbatch"]]);

  // Fetch feed per batch data when filter changes
  useEffect(() => {
    console.log(
      "[adminAnalytics] useEffect: Fetching feed per batch data...",
      chartFilters["feedbatch"],
    );
    fetchFeedPerBatchData(chartFilters["feedbatch"]);
  }, [chartFilters["feedbatch"]]);

  // Fetch water per batch data when filter changes
  useEffect(() => {
    console.log(
      "[adminAnalytics] useEffect: Fetching water per batch data...",
      chartFilters["waterbatch"],
    );
    fetchWaterPerBatchData(chartFilters["waterbatch"]);
  }, [chartFilters["waterbatch"]]);

  // Fetch feed batches when component mounts
  useEffect(() => {
    const loadFeedBatches = async () => {
      setIsFetchingBatches(true);
      setBatchFetchError(null);
      try {
        const batches = await fetchFeedBatchesFromBrooder();
        setAvailableBatches(batches);
        console.log("[adminAnalytics] Feed batches loaded:", batches.length);

        // Set the latest batch (based on createdAt) as default for feed
        if (batches.length > 0) {
          // Sort batches by createdAt in descending order (most recent first)
          const sortedBatches = [...batches].sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
            const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
            return new Date(bTime) - new Date(aTime);
          });

          const latestBatch = sortedBatches[0];
          handleFeedBatchSelect(latestBatch.id);
          console.log(
            "[adminAnalytics] Latest batch selected:",
            latestBatch.id,
            "created at:",
            latestBatch.createdAt,
          );
        }
      } catch (error) {
        console.error("[adminAnalytics] Error fetching feed batches:", error);
        setBatchFetchError("Failed to load feed batches");
      } finally {
        setIsFetchingBatches(false);
      }
    };
    loadFeedBatches();
  }, []);

  // Fetch water batches when component mounts
  useEffect(() => {
    const loadWaterBatches = async () => {
      setIsFetchingWaterBatches(true);
      setWaterBatchFetchError(null);
      try {
        const waterBatches = await fetchWaterBatches();
        setAvailableWaterBatches(waterBatches);
        console.log(
          "[adminAnalytics] Water batches loaded:",
          waterBatches.length,
        );
        // Set the latest batch (first one after sorting by createdAt descending) as default for water
        if (waterBatches.length > 0) {
          const latestWaterBatch = waterBatches[0];
          handleWaterBatchSelect(latestWaterBatch.id);
          console.log(
            "[adminAnalytics] Latest water batch selected:",
            latestWaterBatch.id,
          );
        }
      } catch (error) {
        console.error("[adminAnalytics] Error fetching water batches:", error);
        setWaterBatchFetchError("Failed to load water batches");
      } finally {
        setIsFetchingWaterBatches(false);
      }
    };
    loadWaterBatches();
  }, []);

  // Fetch feed consumption data when batch is selected
  useEffect(() => {
    if (chartFilters["feed"] && chartFilters["feed"].batchId) {
      console.log(
        "[adminAnalytics] useEffect: Fetching feed consumption data...",
        chartFilters["feed"].batchId,
      );
      fetchFeedConsumptionByAge(chartFilters["feed"].batchId);
    } else {
      setFeedConsumptionData([]);
      setFeedConsumptionError(null);
    }
  }, [chartFilters["feed"]]);

  // Fetch water consumption data when batch is selected
  useEffect(() => {
    if (chartFilters["water"] && chartFilters["water"].batchId) {
      console.log(
        "[adminAnalytics] useEffect: Fetching water consumption data...",
        chartFilters["water"].batchId,
      );
      fetchWaterConsumptionByAge(chartFilters["water"].batchId);
    } else {
      setWaterConsumptionData([]);
      setWaterConsumptionError(null);
    }
  }, [chartFilters["water"]]);

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
      value: totalPredatorAttacks,
      subtitle:
        totalPredatorAttacks > 0 ? `Threats detected` : "No threats detected",
      icon: "chart-areaspline",
    },
  ];

  // Mortality chart data - dynamic labels and data based on filter
  const generateMortalityChartData = () => {
    if (!mortalityData || mortalityData.length === 0) {
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

        if (record.dateOfDeath) {
          try {
            // Try toDate() first (Firestore Timestamp)
            if (typeof record.dateOfDeath.toDate === "function") {
              convertedDate = record.dateOfDeath.toDate();
            }
            // If it has seconds property (Firestore Timestamp structure)
            else if (record.dateOfDeath.seconds) {
              convertedDate = new Date(record.dateOfDeath.seconds * 1000);
            }
            // If it's already a Date object
            else if (record.dateOfDeath instanceof Date) {
              convertedDate = record.dateOfDeath;
            }
            // If it's a string like "January 19, 2026 at 3:33:04 AM UTC+8"
            else if (typeof record.dateOfDeath === "string") {
              convertedDate = parseCustomDateFormat(record.dateOfDeath);
            }
            // If it's a number
            else if (typeof record.dateOfDeath === "number") {
              convertedDate = new Date(record.dateOfDeath);
            }

            // Validate the converted date
            if (convertedDate && !isNaN(convertedDate.getTime())) {
              dateStr = formatDateAsDayMonth(convertedDate);
            } else {
              // Fallback to dateOfDeathFormatted
              if (
                record.dateOfDeathFormatted &&
                typeof record.dateOfDeathFormatted === "string"
              ) {
                convertedDate = parseCustomDateFormat(
                  record.dateOfDeathFormatted,
                );
                if (convertedDate && !isNaN(convertedDate.getTime())) {
                  dateStr = formatDateAsDayMonth(convertedDate);
                } else {
                  dateStr = "Unknown";
                }
              } else {
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
        // Error processing record
      }
    });

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

    // Sort by date - convert "MMM DD" to Date for true chronological order
    const monthMap = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    function parseMMMDD(str) {
      if (str === "Unknown") return new Date(3000, 0, 1); // push Unknown to end
      const [mon, day] = str.split(" ");
      const month = monthMap[mon];
      const d = parseInt(day, 10);
      // Use year from filter if available, else current year
      let year = new Date().getFullYear();
      if (chartFilters["mortality"]?.startDate) {
        year = new Date(chartFilters["mortality"].startDate).getFullYear();
      }
      // If range crosses years, try to infer correct year (if Feb after Jan, but Jan is at end, use next year)
      return new Date(year, month, d);
    }
    const sortedDates = allDates.slice().sort((a, b) => {
      const da = parseMMMDD(a);
      const db = parseMMMDD(b);
      return da - db;
    });

    // Apply intelligent X-axis label generation to reduce clutter
    const totalDataPoints = sortedDates.length;
    const labelIndices = generateXAxisLabels(totalDataPoints);

    // Create labels with empty strings for non-label positions
    const labels = sortedDates.map((date, index) => {
      return labelIndices.includes(index) ? date : "";
    });

    const data = sortedDates.map((date) => dateMap[date]);

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
    const data = generateMortalityChartData();
    return data;
  })();
  const chartWidth = Math.max(windowWidth - 32, 200);
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

  const handleFeedBatchSelect = (batchId) => {
    setSelectedFeedBatch(batchId);
    setShowFeedBatchDropdown(false);
    setChartFilters((prev) => ({
      ...prev,
      feed: { batchId: batchId },
    }));
    setFilterModalVisible(false);
    console.log("[adminAnalytics] Selected batch for feed chart:", batchId);
  };

  const handleWaterBatchSelect = (batchId) => {
    setSelectedWaterBatch(batchId);
    setShowWaterBatchDropdown(false);
    setChartFilters((prev) => ({
      ...prev,
      water: { batchId: batchId },
    }));
    fetchWaterConsumptionByAge(batchId);
    setFilterModalVisible(false);
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

  // Generate predator chart data from fetched Firestore data
  const generatePredatorChartData = () => {
    if (!predatorAttacksData || predatorAttacksData.length === 0) {
      return {
        labels: ["No Data"],
        datasets: [
          {
            data: [0],
            color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
          },
        ],
      };
    }

    // Extract labels and counts from fetched data
    const allLabels = predatorAttacksData.map((item) => item.date);
    const counts = predatorAttacksData.map((item) => item.count);

    // Apply intelligent X-axis label generation
    const totalDataPoints = allLabels.length;
    const labelIndices = generateXAxisLabels(totalDataPoints);

    // Create labels array with empty strings for non-label positions
    const labels = allLabels.map((label, index) =>
      labelIndices.includes(index) ? label : "",
    );

    return {
      labels,
      datasets: [
        {
          data: counts.length > 0 ? counts : [0],
          color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
        },
      ],
    };
  };

  const predatorChartData = generatePredatorChartData();

  // Build feed chart data - use actual data if available from feedConsumptionData
  const feedChartData = (() => {
    if (
      feedConsumptionData &&
      feedConsumptionData.length > 0 &&
      chartFilters["feed"] &&
      chartFilters["feed"].batchId
    ) {
      // Use actual data from Firestore
      const allLabels = feedConsumptionData.map((item) => `Day ${item.age}`);
      const data = feedConsumptionData.map((item) => item.count);

      // Custom X-axis label logic for feed chart:
      // ≤6 days: Show all days
      // 6+ days: Show 4 labels
      const totalDataPoints = allLabels.length;
      let labelIndices = [];

      if (totalDataPoints <= 6) {
        // Show all labels
        labelIndices = Array.from({ length: totalDataPoints }, (_, i) => i);
      } else {
        // Show 4 labels: first, ~1/3, ~2/3, last
        labelIndices = [
          0,
          Math.floor(totalDataPoints / 3),
          Math.floor((2 * totalDataPoints) / 3),
          totalDataPoints - 1,
        ];
      }

      // Create labels array with empty strings for non-label positions
      const labels = allLabels.map((label, index) =>
        labelIndices.includes(index) ? label : "",
      );

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
          },
        ],
      };
    }
    // Return empty chart when no batch is selected
    return {
      labels: [],
      datasets: [
        {
          data: [],
          color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
        },
      ],
    };
  })();

  // Chart data for Water Consumption - dynamic labels and data based on filter
  // Build water chart data - use actual data if available from waterConsumptionData
  const waterChartData = (() => {
    if (
      waterConsumptionData &&
      waterConsumptionData.length > 0 &&
      chartFilters["water"] &&
      chartFilters["water"].batchId
    ) {
      // Use actual data from Firestore
      const allLabels = waterConsumptionData.map((item) => `Day ${item.age}`);
      const data = waterConsumptionData.map((item) => item.count);

      // Custom X-axis label logic for water chart:
      // ≤6 days: Show all days
      // 6+ days: Show 4 labels
      const totalDataPoints = allLabels.length;
      let labelIndices = [];

      if (totalDataPoints <= 6) {
        // Show all labels
        labelIndices = Array.from({ length: totalDataPoints }, (_, i) => i);
      } else {
        // Show 4 labels: first, ~1/3, ~2/3, last
        labelIndices = [
          0,
          Math.floor(totalDataPoints / 3),
          Math.floor((2 * totalDataPoints) / 3),
          totalDataPoints - 1,
        ];
      }

      // Create labels array with empty strings for non-label positions
      const labels = allLabels.map((label, index) =>
        labelIndices.includes(index) ? label : "",
      );

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
          },
        ],
      };
    }
    // Return empty chart when no batch is selected
    return {
      labels: [],
      datasets: [
        {
          data: [],
          color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
        },
      ],
    };
  })();

  // State for fetched solar data
  const [solarFetchedData, setSolarFetchedData] = useState({
    labels: [],
    data: [],
  });
  const [solarDataLoading, setSolarDataLoading] = useState(true);

  // Get start and end date from filter or use defaults
  let solarStartDate = null;
  let solarEndDate = null;
  if (
    chartFilters["solar"] &&
    chartFilters["solar"].startDate &&
    chartFilters["solar"].endDate
  ) {
    solarStartDate = chartFilters["solar"].startDate;
    solarEndDate = chartFilters["solar"].endDate;
  } else {
    // Fallback: use last 7 days
    const today = new Date();
    solarEndDate = today;
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    solarStartDate = sevenDaysAgo;
  }

  // Fetch solar data when filter changes
  useEffect(() => {
    const loadSolarData = async () => {
      try {
        setSolarDataLoading(true);
        if (solarStartDate && solarEndDate) {
          const result = await fetchSolarUsageData(
            solarStartDate,
            solarEndDate,
          );
          if (result.labels.length > 0 && result.data.length > 0) {
            setSolarFetchedData(result);
          } else {
            setSolarFetchedData({
              labels: [],
              data: [],
            });
          }
        } else {
          setSolarFetchedData({
            labels: [],
            data: [],
          });
        }
      } catch (error) {
        console.error("Error loading solar data:", error);
        setSolarFetchedData({
          labels: [],
          data: [],
        });
      } finally {
        setSolarDataLoading(false);
      }
    };
    loadSolarData();
  }, [chartFilters["solar"]]);

  // Use fetched data
  const solarLabels = solarFetchedData.labels;
  const solarData = solarFetchedData.data;

  const solarChartData = {
    labels: solarLabels,
    datasets: [
      {
        data: solarData,
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BrandedAlertModal
        visible={alertVisible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertVisible(false)}
      />
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
                  isGeneratingReport && { opacity: 0.6 },
                ]}
                activeOpacity={0.8}
                onPressIn={() => setPressedBtn("export-mortality")}
                onPressOut={() => setPressedBtn(null)}
                onPress={() => {
                  console.log(
                    "[Export Button] Export mortality button pressed, isGeneratingReport:",
                    isGeneratingReport,
                  );
                  if (!isGeneratingReport) {
                    console.log(
                      "[Export Button] Calling generateMortalityReportPDF...",
                    );
                    generateMortalityReportPDF().catch((err) => {
                      console.error(
                        "[Export Button] Error calling generateMortalityReportPDF:",
                        err,
                      );
                    });
                  }
                }}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? (
                  <ActivityIndicator color="#133E87" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.chartExportText,
                      pressedBtn === "export-mortality" && { color: "#fff" },
                    ]}
                  >
                    Export
                  </Text>
                )}
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
                onPress={() => {
                  if (
                    chartFilters["cause"]?.startDate &&
                    chartFilters["cause"]?.endDate
                  ) {
                    setCauseExportStartDate(chartFilters["cause"].startDate);
                    setCauseExportEndDate(chartFilters["cause"].endDate);
                  } else {
                    // Use default: previous 7 days
                    const today = new Date();
                    const endDate = new Date(today);
                    endDate.setHours(23, 59, 59, 999);

                    const startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 7);
                    startDate.setHours(0, 0, 0, 0);

                    const startDateStr = startDate.toISOString().split("T")[0];
                    const endDateStr = endDate.toISOString().split("T")[0];

                    setCauseExportStartDate(startDateStr);
                    setCauseExportEndDate(endDateStr);
                  }
                  // Add a small delay to ensure state is updated before calling function
                  setTimeout(() => generateCauseOfDeathReportPDF(), 100);
                }}
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

                  const radius = 100;
                  const cx = 110;
                  const cy = 110;

                  let currentAngle = -90; // Start at top
                  const slices = pieData.map((item, index) => {
                    // When total is 0, show gray empty circle for each item (won't render)
                    let angle = 0;
                    let percentage = 0;

                    if (total > 0) {
                      percentage = item.population / total;
                      angle = percentage * 360;
                    }

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

                    // Special handling for 100% (full circle) - draw as full circle with two semicircles
                    let pathData;
                    if (total === 0) {
                      // Empty circle when no data
                      pathData = [
                        `M ${cx} ${cy - radius}`,
                        `A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}`,
                        `A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}`,
                        "Z",
                      ].join(" ");
                    } else if (Math.abs(angle - 360) < 0.1) {
                      // Draw full circle as two semicircles
                      const topX = cx + radius;
                      const bottomX = cx - radius;
                      const midY = cy;
                      pathData = [
                        `M ${cx} ${cy - radius}`,
                        `A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}`,
                        `A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}`,
                        "Z",
                      ].join(" ");
                    } else {
                      pathData = [
                        `M ${cx} ${cy}`,
                        `L ${x1} ${y1}`,
                        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                        "Z",
                      ].join(" ");
                    }

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
                              {total === 0 ? (
                                // Show gray empty circle when no data
                                <Path
                                  d={[
                                    `M ${cx} ${cy - radius}`,
                                    `A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}`,
                                    `A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}`,
                                    "Z",
                                  ].join(" ")}
                                  fill="#e0e0e0"
                                  stroke="#fff"
                                  strokeWidth={2}
                                />
                              ) : (
                                slices.map((slice, index) => (
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
                                ))
                              )}
                            </G>
                          </Svg>

                          {/* "No deaths recorded" text overlay when no data */}
                          {total === 0 && (
                            <View
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: 220,
                                height: 220,
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: "600",
                                  color: "#999",
                                  textAlign: "center",
                                }}
                              >
                                No deaths recorded
                              </Text>
                            </View>
                          )}

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

                      {/* Custom Legend - Horizontal (always show) */}
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
                              alignItems: "flex-start",
                              width: 170,
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
                              alignItems: "flex-start",
                              width: 170,
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
                        <View style={{ flexDirection: "row", marginLeft: 35 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "flex-start",
                              width: 170,
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
                              alignItems: "flex-start",
                              width: 170,
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
                onPress={() => {
                  // Check if filter has date range set
                  if (
                    chartFilters["mortalitybatch"] &&
                    chartFilters["mortalitybatch"].startDate &&
                    chartFilters["mortalitybatch"].endDate
                  ) {
                    // Use filter dates
                    const filterStartDate =
                      chartFilters["mortalitybatch"].startDate;
                    const filterEndDate =
                      chartFilters["mortalitybatch"].endDate;

                    generateMortalityBatchReportPDF(
                      filterStartDate,
                      filterEndDate,
                    );
                  } else {
                    // Use default previous 7 days
                    const today = new Date();
                    const endDate = new Date(today);
                    endDate.setHours(0, 0, 0, 0);

                    const startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 7);
                    startDate.setHours(0, 0, 0, 0);

                    const startDateStr = startDate.toISOString().split("T")[0];
                    const endDateStr = endDate.toISOString().split("T")[0];

                    generateMortalityBatchReportPDF(startDateStr, endDateStr);
                  }
                }}
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
            <MortalityBatchChart height={220} data={mortalityBatchData} />
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
                onPress={generatePredatorAttacksReportPDF}
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
            {!chartFilters["predator"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                Last 7 Days
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
                onPress={() => {
                  generateAttacksPerBatchReportPDF();
                }}
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
            {!chartFilters["attacksbatch"] && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#133E87",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                Last 7 Days
              </Text>
            )}
            <AttacksBatchChart height={220} data={attacksPerBatchData} />
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
                onPress={generatePredatorTypesReportPDF}
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

            {/* Loading State */}
            {isLoadingPredatorTypes && (
              <View
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 40,
                }}
              >
                <ActivityIndicator size="large" color="#133E87" />
                <Text style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                  Loading predator types...
                </Text>
              </View>
            )}

            {/* Error State */}
            {predatorTypesError && !isLoadingPredatorTypes && (
              <View
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 40,
                  backgroundColor: "#fff3e0",
                  borderRadius: 8,
                  marginHorizontal: 8,
                  paddingHorizontal: 12,
                }}
              >
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={32}
                  color="#ff9800"
                />
                <Text
                  style={{
                    marginTop: 8,
                    color: "#ff6f00",
                    fontSize: 12,
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  {predatorTypesError}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: "#999",
                    fontSize: 10,
                    textAlign: "center",
                  }}
                >
                  Please try adjusting the date filter
                </Text>
              </View>
            )}

            {/* Empty State - Show empty pie chart with all 0% legend */}
            {/* This condition will be handled by the rendering logic below */}

            {/* Chart Rendering - Show pie chart always (even for empty data) */}
            {!isLoadingPredatorTypes &&
              !predatorTypesError &&
              LineChartComp &&
              (() => {
                try {
                  // eslint-disable-next-line global-require
                  const RN_SVG = require("react-native-svg");
                  const Svg = RN_SVG.Svg || RN_SVG.default?.Svg || RN_SVG;
                  const G = RN_SVG.G || RN_SVG.default?.G;
                  const Path = RN_SVG.Path || RN_SVG.default?.Path;

                  // Use dynamic predatorTypesData from state
                  const dataToRender = predatorTypesData;

                  // Calculate pie slice paths
                  const total = dataToRender.reduce(
                    (sum, item) => sum + item.population,
                    0,
                  );
                  const radius = 100;
                  const cx = 110;
                  const cy = 110;

                  let currentAngle = -90; // Start at top
                  const slices = dataToRender.map((item, index) => {
                    // When total is 0, show gray empty circle for each item (won't render)
                    let angle = 0;
                    let percentage = 0;

                    if (total > 0) {
                      percentage = item.population / total;
                      angle = percentage * 360;
                    }

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

                    // Special handling for 100% (full circle) - draw as full circle with two semicircles
                    let pathData;
                    if (total === 0) {
                      // Empty circle when no data
                      pathData = [
                        `M ${cx} ${cy - radius}`,
                        `A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}`,
                        `A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}`,
                        "Z",
                      ].join(" ");
                    } else if (Math.abs(angle - 360) < 0.1) {
                      // Draw full circle as two semicircles
                      const topX = cx + radius;
                      const bottomX = cx - radius;
                      const midY = cy;
                      pathData = [
                        `M ${cx} ${cy - radius}`,
                        `A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}`,
                        `A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}`,
                        "Z",
                      ].join(" ");
                    } else {
                      pathData = [
                        `M ${cx} ${cy}`,
                        `L ${x1} ${y1}`,
                        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                        "Z",
                      ].join(" ");
                    }

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
                              {total === 0 ? (
                                // Show gray empty circle when no data
                                <Path
                                  d={[
                                    `M ${cx} ${cy - radius}`,
                                    `A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}`,
                                    `A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}`,
                                    "Z",
                                  ].join(" ")}
                                  fill="#e0e0e0"
                                  stroke="#fff"
                                  strokeWidth={2}
                                />
                              ) : (
                                slices.map((slice, index) => (
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
                                ))
                              )}
                            </G>
                          </Svg>

                          {/* "No predator activity" text overlay when no data */}
                          {total === 0 && (
                            <View
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: 220,
                                height: 220,
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: "600",
                                  color: "#999",
                                  textAlign: "center",
                                }}
                              >
                                No predator activity
                              </Text>
                            </View>
                          )}

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
                                  dataToRender[activePieSlicePredator]
                                    .population
                                }
                                %
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Custom Legend - Horizontal 3-column layout (always show) */}
                      <View
                        style={{
                          paddingHorizontal: 8,
                          alignItems: "flex-start",
                        }}
                      >
                        {/* Row 1: Dog, Cat, Other */}
                        <View
                          style={{
                            flexDirection: "row",
                            marginBottom: 8,
                            marginLeft: 2,
                          }}
                        >
                          {/* Column 1: Dog */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 110,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: dataToRender[0].color,
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
                              {dataToRender[0].name} (
                              {dataToRender[0].population % 1 === 0
                                ? Math.floor(dataToRender[0].population)
                                : dataToRender[0].population.toFixed(1)}
                              %)
                            </Text>
                          </View>
                          <View style={{ width: 8 }} />
                          {/* Column 2: Cat */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 90,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: dataToRender[1].color,
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
                              {dataToRender[1].name} (
                              {dataToRender[1].population % 1 === 0
                                ? Math.floor(dataToRender[1].population)
                                : dataToRender[1].population.toFixed(1)}
                              %)
                            </Text>
                          </View>
                          <View style={{ width: 8 }} />
                          {/* Column 3: Other */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 110,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: dataToRender[4].color,
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
                              {dataToRender[4].name} (
                              {dataToRender[4].population % 1 === 0
                                ? Math.floor(dataToRender[4].population)
                                : dataToRender[4].population.toFixed(1)}
                              %)
                            </Text>
                          </View>
                        </View>
                        {/* Row 2: Snake, Rat (left-aligned) */}
                        <View
                          style={{
                            flexDirection: "row",
                            marginLeft: 2,
                          }}
                        >
                          {/* Column 1: Snake */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 110,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: dataToRender[2].color,
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
                              {dataToRender[2].name} (
                              {dataToRender[2].population % 1 === 0
                                ? Math.floor(dataToRender[2].population)
                                : dataToRender[2].population.toFixed(1)}
                              %)
                            </Text>
                          </View>
                          <View style={{ width: 8 }} />
                          {/* Column 2: Rat */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: 95,
                            }}
                          >
                            <View
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: dataToRender[3].color,
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
                              {dataToRender[3].name} (
                              {dataToRender[3].population % 1 === 0
                                ? Math.floor(dataToRender[3].population)
                                : dataToRender[3].population.toFixed(1)}
                              %)
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
                onPress={generateFeedConsumptionReportPDF}
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
            {chartFilters["feed"] && chartFilters["feed"].batchId && (
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

            {/* Loading State */}
            {isLoadingFeedConsumption && (
              <View
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 40,
                }}
              >
                <ActivityIndicator size="large" color="#133E87" />
                <Text style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                  Loading consumption data...
                </Text>
              </View>
            )}

            {/* Error State */}
            {feedConsumptionError && !isLoadingFeedConsumption && (
              <View
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 40,
                  backgroundColor: "#fff3e0",
                  borderRadius: 8,
                  marginHorizontal: 8,
                }}
              >
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={32}
                  color="#F57C00"
                />
                <Text
                  style={{
                    marginTop: 12,
                    color: "#E65100",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {feedConsumptionError}
                </Text>
              </View>
            )}

            {/* Empty State */}
            {!isLoadingFeedConsumption &&
              !feedConsumptionError &&
              (!chartFilters["feed"] ||
                !chartFilters["feed"].batchId ||
                feedConsumptionData.length === 0) &&
              LineChartComp && (
                <View style={{ position: "relative", width: chartWidth }}>
                  <LineChartComp
                    data={{
                      labels: [],
                      datasets: [
                        {
                          data: [0],
                          color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
                        },
                      ],
                    }}
                    width={chartWidth}
                    height={chartHeight}
                    chartConfig={{
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
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
                  />
                </View>
              )}

            {/* Chart Display */}
            {!isLoadingFeedConsumption &&
              !feedConsumptionError &&
              feedConsumptionData.length > 0 &&
              LineChartComp && (
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
                          Count: {activePointFeed.value}
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
                onPress={() => generateFeedPerBatchReportPDF()}
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
            <FeedBatchChart height={220} data={feedPerBatchData} />
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
                onPress={() => generateWaterConsumptionReportPDF()}
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
            {chartFilters["water"] && chartFilters["water"].batchId && (
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

            {/* Loading State */}
            {isLoadingWaterConsumption && (
              <View
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 40,
                }}
              >
                <ActivityIndicator size="large" color="#133E87" />
                <Text style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                  Loading water consumption data...
                </Text>
              </View>
            )}

            {/* Error State */}
            {waterConsumptionError && !isLoadingWaterConsumption && (
              <View
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 40,
                  backgroundColor: "#fff3e0",
                  borderRadius: 8,
                  marginHorizontal: 8,
                }}
              >
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={32}
                  color="#F57C00"
                />
                <Text
                  style={{
                    marginTop: 12,
                    color: "#E65100",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {waterConsumptionError}
                </Text>
              </View>
            )}

            {!isLoadingWaterConsumption &&
              !waterConsumptionError &&
              waterConsumptionData.length > 0 &&
              LineChartComp && (
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

            {!isLoadingWaterConsumption &&
              !waterConsumptionError &&
              waterConsumptionData.length === 0 &&
              LineChartComp && (
                <View style={{ position: "relative", width: chartWidth }}>
                  <LineChartComp
                    data={{
                      labels: [],
                      datasets: [
                        {
                          data: [0],
                          color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
                        },
                      ],
                    }}
                    width={chartWidth}
                    height={chartHeight}
                    chartConfig={{
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
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
                  />
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
                onPress={() => generateWaterPerBatchReportPDF()}
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
            {console.log("Water per batch data:", waterPerBatchData)}
            <WaterBatchChart height={220} data={waterPerBatchData} />
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
                onPress={generateEnergyTrendsReportPDF}
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
            {LineChartComp && solarData.length > 0 && (
              <View
                style={{
                  position: "relative",
                  width: chartWidth,
                  overflow: "hidden",
                }}
              >
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

            {LineChartComp && solarData.length === 0 && (
              <View style={{ position: "relative", width: chartWidth }}>
                <LineChartComp
                  data={{
                    labels: [],
                    datasets: [
                      {
                        data: [0],
                        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
                      },
                    ],
                  }}
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
                />
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
              {/* Batch Dropdown for Feed Consumption Chart */}
              {currentFilterTarget === "feed" && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: "#333",
                      }}
                    >
                      Select a Batch
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFilterModalVisible(false)}
                      style={{
                        padding: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 24,
                          color: "#133E87",
                          fontWeight: "bold",
                          lineHeight: 24,
                        }}
                      >
                        ✕
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isFetchingBatches ? (
                    <View style={{ padding: 1, alignItems: "center" }}>
                      <ActivityIndicator size="large" color="#133E87" />
                      <Text
                        style={{
                          marginTop: 8,
                          color: "#666",
                          fontSize: 12,
                        }}
                      >
                        Loading batches...
                      </Text>
                    </View>
                  ) : batchFetchError ? (
                    <View
                      style={{
                        padding: 16,
                        backgroundColor: "#ffebee",
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: "#c62828", fontSize: 12 }}>
                        {batchFetchError}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={{
                          borderWidth: 1,
                          borderColor: "#ddd",
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                        onPress={() =>
                          setShowFeedBatchDropdown(!showFeedBatchDropdown)
                        }
                      >
                        <Text
                          style={{
                            color: selectedFeedBatch ? "#333" : "#999",
                            fontSize: 14,
                          }}
                        >
                          {selectedFeedBatch || "Select a batch"}
                        </Text>
                        <Text style={{ color: "#666" }}>▼</Text>
                      </TouchableOpacity>

                      {showFeedBatchDropdown && (
                        <>
                          <TouchableOpacity
                            activeOpacity={1}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: -5000,
                              zIndex: 1,
                            }}
                            onPress={() => setShowFeedBatchDropdown(false)}
                          />
                          <ScrollView
                            style={{
                              borderWidth: 1,
                              borderColor: "#ddd",
                              borderTopWidth: 0,
                              borderBottomLeftRadius: 8,
                              borderBottomRightRadius: 8,
                              maxHeight: 300,
                              marginTop: -1,
                              zIndex: 2,
                              backgroundColor: "#fff",
                            }}
                            nestedScrollEnabled={true}
                          >
                            {availableBatches.length === 0 ? (
                              <Text
                                style={{
                                  padding: 12,
                                  color: "#999",
                                  fontSize: 12,
                                  textAlign: "center",
                                }}
                              >
                                No batches available
                              </Text>
                            ) : (
                              availableBatches.map((batch) => (
                                <TouchableOpacity
                                  key={batch.id}
                                  style={{
                                    padding: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: "#eee",
                                    backgroundColor:
                                      selectedFeedBatch === batch.id
                                        ? "#e3f2fd"
                                        : "#fff",
                                    zIndex: 3,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minHeight: 44,
                                    width: "100%",
                                  }}
                                  onPress={() =>
                                    handleFeedBatchSelect(batch.id)
                                  }
                                >
                                  <Text style={{ color: "#333", fontSize: 14 }}>
                                    {batch.id}
                                  </Text>
                                </TouchableOpacity>
                              ))
                            )}
                          </ScrollView>
                        </>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* Water Batch Selection */}
              {currentFilterTarget === "water" && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: "#333",
                      }}
                    >
                      Select a Batch
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFilterModalVisible(false)}
                      style={{
                        padding: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 24,
                          color: "#133E87",
                          fontWeight: "bold",
                          lineHeight: 24,
                        }}
                      >
                        ✕
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isFetchingWaterBatches ? (
                    <View style={{ padding: 1, alignItems: "center" }}>
                      <ActivityIndicator size="large" color="#133E87" />
                      <Text
                        style={{
                          marginTop: 8,
                          color: "#666",
                          fontSize: 12,
                        }}
                      >
                        Loading batches...
                      </Text>
                    </View>
                  ) : waterBatchFetchError ? (
                    <View
                      style={{
                        padding: 16,
                        backgroundColor: "#ffebee",
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: "#c62828", fontSize: 12 }}>
                        {waterBatchFetchError}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={{
                          borderWidth: 1,
                          borderColor: "#ddd",
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                        onPress={() =>
                          setShowWaterBatchDropdown(!showWaterBatchDropdown)
                        }
                      >
                        <Text
                          style={{
                            color: selectedWaterBatch ? "#333" : "#999",
                            fontSize: 14,
                          }}
                        >
                          {selectedWaterBatch || "Select a batch"}
                        </Text>
                        <Text style={{ color: "#666" }}>▼</Text>
                      </TouchableOpacity>

                      {showWaterBatchDropdown && (
                        <>
                          <TouchableOpacity
                            activeOpacity={1}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: -5000,
                              zIndex: 1,
                            }}
                            onPress={() => setShowWaterBatchDropdown(false)}
                          />
                          <ScrollView
                            style={{
                              borderWidth: 1,
                              borderColor: "#ddd",
                              borderTopWidth: 0,
                              borderBottomLeftRadius: 8,
                              borderBottomRightRadius: 8,
                              maxHeight: 300,
                              marginTop: -1,
                              zIndex: 2,
                              backgroundColor: "#fff",
                            }}
                            nestedScrollEnabled={true}
                          >
                            {availableWaterBatches.length === 0 ? (
                              <Text
                                style={{
                                  padding: 12,
                                  color: "#999",
                                  fontSize: 12,
                                  textAlign: "center",
                                }}
                              >
                                No batches available
                              </Text>
                            ) : (
                              availableWaterBatches.map((batch) => (
                                <TouchableOpacity
                                  key={batch.id}
                                  style={{
                                    padding: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: "#eee",
                                    backgroundColor:
                                      selectedWaterBatch === batch.id
                                        ? "#e3f2fd"
                                        : "#fff",
                                    zIndex: 3,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minHeight: 44,
                                    width: "100%",
                                  }}
                                  onPress={() =>
                                    handleWaterBatchSelect(batch.id)
                                  }
                                >
                                  <Text style={{ color: "#333", fontSize: 14 }}>
                                    {batch.name}
                                  </Text>
                                </TouchableOpacity>
                              ))
                            )}
                          </ScrollView>
                        </>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* Date Range Display - Only for non-feed/non-water filters */}
              {currentFilterTarget !== "feed" &&
                currentFilterTarget !== "water" && (
                  <>
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
                          const selectedDate = new Date(
                            year,
                            month - 1,
                            day_num,
                          );

                          const today = new Date();
                          today.setHours(0, 0, 0, 0);

                          // Validate: Do not allow future dates
                          if (selectedDate > today) {
                            showAlert(
                              "error",
                              "Invalid Date",
                              "Future dates are not allowed. Please select today or an earlier date.",
                            );
                            return;
                          }

                          if (!startDate || (startDate && endDate)) {
                            // Start new selection
                            setStartDate(selectedDateStr);
                            setEndDate(null);
                          } else if (startDate && !endDate) {
                            // Calculate the difference in days
                            const start = new Date(selectedDateStr);
                            const selected = new Date(startDate);
                            const diffTime = Math.abs(selected - start);
                            const diffDays = Math.ceil(
                              diffTime / (1000 * 60 * 60 * 24),
                            );

                            // Different date range limits based on chart type
                            // All charts: up to 365 days
                            const maxDays = 365;

                            if (diffDays > maxDays - 1) {
                              showAlert(
                                "error",
                                "Invalid Range",
                                `Please select a date range within ${maxDays} days.`,
                              );
                              return;
                            }

                            // Set end date
                            if (
                              new Date(selectedDateStr) < new Date(startDate)
                            ) {
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
                          const month = String(today.getMonth() + 1).padStart(
                            2,
                            "0",
                          );
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
                        style={[
                          styles.modalActionButton,
                          styles.modalCancelButton,
                        ]}
                        onPress={() => {
                          setStartDate(null);
                          setEndDate(null);
                          setFilterModalVisible(false);
                        }}
                      >
                        <Text style={styles.modalCancelButtonText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modalActionButton,
                          styles.modalApplyButton,
                        ]}
                        onPress={() => {
                          if (currentFilterTarget && startDate && endDate) {
                            // Check for Frequency of Attacks chart 7-day limit
                            if (currentFilterTarget === "predator") {
                              const start = new Date(startDate);
                              const end = new Date(endDate);
                              const diffMs = end - start;
                              const diffDays = Math.ceil(
                                diffMs / (1000 * 60 * 60 * 24),
                              );
                            }

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
                  </>
                )}
            </View>
          </View>
        </Modal>

        {/* Export Predator Attacks Modal */}
        <Modal
          visible={exportPredatorModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setExportPredatorModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Export Predator Attacks Report
              </Text>

              {/* Date Range Display */}
              <View style={styles.dateRangeHeader}>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>From</Text>
                  <Text style={styles.dateRangeValue}>
                    {predatorExportStartDate
                      ? new Date(predatorExportStartDate).toLocaleDateString(
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
                    {predatorExportEndDate
                      ? new Date(predatorExportEndDate).toLocaleDateString(
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
                      showAlert(
                        "error",
                        "Invalid Date",
                        "Future dates are not allowed. Please select today or an earlier date.",
                      );
                      return;
                    }

                    if (
                      !predatorExportStartDate ||
                      (predatorExportStartDate && predatorExportEndDate)
                    ) {
                      // Start new selection
                      setPredatorExportStartDate(selectedDateStr);
                      setPredatorExportEndDate(null);
                    } else if (
                      predatorExportStartDate &&
                      !predatorExportEndDate
                    ) {
                      // Calculate the difference in days
                      const start = new Date(predatorExportStartDate);
                      const selected = new Date(selectedDateStr);
                      const diffTime = Math.abs(selected - start);
                      const diffDays = Math.ceil(
                        diffTime / (1000 * 60 * 60 * 24),
                      );

                      // Set end date
                      if (
                        new Date(selectedDateStr) <
                        new Date(predatorExportStartDate)
                      ) {
                        setPredatorExportEndDate(predatorExportStartDate);
                        setPredatorExportStartDate(selectedDateStr);
                      } else {
                        setPredatorExportEndDate(selectedDateStr);
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
                    if (!predatorExportStartDate) return {};

                    const marks = {};
                    const start = new Date(predatorExportStartDate);
                    const end = predatorExportEndDate
                      ? new Date(predatorExportEndDate)
                      : start;

                    for (
                      let d = new Date(start);
                      d <= end;
                      d.setDate(d.getDate() + 1)
                    ) {
                      const dateStr = d.toISOString().split("T")[0];
                      marks[dateStr] = {
                        color: "#DBEAFE",
                        textColor: "black",
                        marked: true,
                      };
                    }

                    marks[predatorExportStartDate] = {
                      ...marks[predatorExportStartDate],
                      startingDay: true,
                      color: "#3B82F6",
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

                    if (predatorExportEndDate) {
                      marks[predatorExportEndDate] = {
                        ...marks[predatorExportEndDate],
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
                    }

                    return marks;
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
                    setPredatorExportStartDate(null);
                    setPredatorExportEndDate(null);
                    setExportPredatorModalVisible(false);
                  }}
                  disabled={isGeneratingPredatorReport}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    styles.modalApplyButton,
                    !predatorExportStartDate ||
                    !predatorExportEndDate ||
                    isGeneratingPredatorReport
                      ? { opacity: 0.5 }
                      : {},
                  ]}
                  onPress={generatePredatorAttacksReportPDF}
                  disabled={
                    !predatorExportStartDate ||
                    !predatorExportEndDate ||
                    isGeneratingPredatorReport
                  }
                >
                  {isGeneratingPredatorReport ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalApplyButtonText}>Generate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Export Predator Types Modal */}
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

  // Calculate y-axis max to ensure data values align with gridlines
  const rawMax = Math.max(...data.map((d) => Math.max(d.actions, d.logins)), 1);

  // Calculate nice maximum for y-axis (prefer round numbers)
  const getNiceMax = (maxValue, numTicks) => {
    // If data is less than 5, use fixed scale of 0-5
    if (maxValue <= 5) {
      return 5;
    }

    const roughStep = maxValue / (numTicks - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalizedStep = roughStep / magnitude;

    // Round to nearest nice number (1, 2, 5, 10)
    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;

    const step = niceStep * magnitude;
    // Calculate finalMax to be a multiple of step that's >= rawMax
    return Math.ceil(maxValue / step) * step;
  };

  const finalMax = getNiceMax(rawMax, 6);
  // Use 6 ticks for small data (0-5), 6 ticks for larger data
  const ticks = 6;

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
                // For small data (rawMax <= 5), show 0-5
                let value;
                if (rawMax <= 5) {
                  value = Math.round((1 - ratio) * finalMax);
                } else {
                  value = Math.round((1 - ratio) * finalMax);
                }
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

                  return data.map((d, i) => {
                    // Calculate exact bar heights based on the data values
                    // No minimum height - let bars be proportional to actual values
                    const loginsHeight =
                      finalMax > 0 ? (d.logins / finalMax) * height : 0;
                    const actionsHeight =
                      finalMax > 0 ? (d.actions / finalMax) * height : 0;

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
                            onPress={() => onBarPress(i, d.logins)}
                            style={{
                              width: barWidth,
                              height: loginsHeight,
                              backgroundColor: loginsColor,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                            }}
                          />
                          <TouchableOpacity
                            onPress={() => onBarPress(i, d.actions)}
                            style={{
                              width: barWidth,
                              height: actionsHeight,
                              backgroundColor: actionsColor,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                              marginTop: 2,
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
    showAlert(
      "info",
      "Export PDF",
      "PDF export is not implemented in this demo.",
    );
  };

  const handleExportCsv = () => {
    showAlert(
      "info",
      "Export CSV",
      "CSV export is not implemented in this demo.",
    );
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
function MortalityBatchChart({ height = 220, data = [] }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [activeBar, setActiveBar] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Use provided data or default to empty array if no data
  const batchData = data && data.length > 0 ? data : [];

  const yAxisWidth = 34;
  const outerPadding = 12;
  const barColor = "#133E87";
  const labelHeight = 35;

  // Handle empty data gracefully
  const rawMax =
    batchData.length > 0 ? Math.max(...batchData.map((d) => d.deaths), 1) : 1;

  // Calculate nice maximum for y-axis
  const getNiceMax = (maxValue, numTicks) => {
    // If data is less than 5, use fixed scale of 1-5
    if (maxValue <= 5) {
      return 5;
    }

    const roughStep = maxValue / (numTicks - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalizedStep = roughStep / magnitude;

    // Round to nearest nice number (1, 2, 5, 10)
    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;

    const step = niceStep * magnitude;
    return Math.ceil(maxValue / step) * step;
  };

  const finalMax = getNiceMax(rawMax, 6);
  // Use 6 ticks for small data (0-5), 6 ticks for larger data
  const ticks = 6;

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
                  const minBarHeight = 2; // Minimum height to make bar visible

                  return batchData.map((d, i) => {
                    // Calculate bar height exact proportionally to value
                    // bar height = (value / finalMax) * total height
                    const barHeight = (d.deaths / finalMax) * height;
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
function AttacksBatchChart({ height = 220, data = [] }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [activeBar, setActiveBar] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Use dynamic data passed as prop, fallback to empty array if not provided
  const batchData = data && data.length > 0 ? data : [];

  const yAxisWidth = 34;
  const outerPadding = 12;
  const barColor = "#133E87";
  const labelHeight = 35;

  // Handle empty data gracefully
  const rawMax =
    batchData.length > 0 ? Math.max(...batchData.map((d) => d.attacks), 1) : 1;

  // Calculate nice maximum for y-axis
  const getNiceMax = (maxValue, numTicks) => {
    // If data is less than 5, use fixed scale of 1-5
    if (maxValue <= 5) {
      return 5;
    }

    const roughStep = maxValue / (numTicks - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalizedStep = roughStep / magnitude;

    // Round to nearest nice number (1, 2, 5, 10)
    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;

    const step = niceStep * magnitude;
    return Math.ceil(maxValue / step) * step;
  };

  const finalMax = getNiceMax(rawMax, 6);
  // Use 6 ticks for small data (0-5), 6 ticks for larger data
  const ticks = 6;

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
                // For small data (rawMax <= 5), show 0-5
                let value;
                if (rawMax <= 5) {
                  value = Math.round((1 - ratio) * finalMax);
                } else {
                  value = Math.round((1 - ratio) * finalMax);
                }
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
                    // Calculate bar height exact proportionally to value
                    // bar height = (value / finalMax) * total height
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
function FeedBatchChart({ height = 220, data = [] }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [activeBar, setActiveBar] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Use only fetched data for the chart
  const batchData = data && data.length > 0 ? data : [];

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
function WaterBatchChart({ height = 220, data = [] }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [activeBar, setActiveBar] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Use only fetched data for the chart
  const batchData = data && data.length > 0 ? data : [];

  const yAxisWidth = 34;
  const outerPadding = 12;
  const barColor = "#133E87";

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
                    const barHeight = (d.activations / finalMax) * height;
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
          Activations: {data[active.index].activations}
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
    paddingTop: 14,
    paddingBottom: 14,
    paddingRight: 14,
    paddingLeft: 14,
    marginBottom: 18,
    width: "100%",
    alignItems: "center",
    overflow: "hidden",
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
