import React, { useState, useEffect } from "react";
import { auth, db } from "../../../config/firebaseconfig";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
// ----------- GROUPED BAR CHART COMPONENT -----------
// SingleBarChart: simplified version for feeding tab (single bar per group)
function GroupedBarChart({
  actions = [],
  labels = [],
  barColors = ["#000"],
  maxValue = null,
  style = {},
  onBarPress = () => {},
  activeIndex = null,
  setActiveIndex = () => {},
  tooltipFormatter = null,
}) {
  // actions: array of numbers (main data)
  // labels: array of x-axis labels
  // barColors: [color1]
  // maxValue: y-axis max (optional)
  // style: container style
  // onBarPress: function(index, group) called when bar pressed
  // activeIndex: {group, index} or null
  // setActiveIndex: function
  // tooltipFormatter: function(group, index, value)
  const chartHeight = 180;
  const yMax = maxValue !== null ? maxValue : Math.max(...actions, 1);
  const yTicks = [
    yMax,
    Math.round((yMax * 3) / 4),
    Math.round(yMax / 2),
    Math.round(yMax / 4),
    0,
  ];

  const [containerWidth, setContainerWidth] = React.useState(null);
  // paddingLeft for y-axis, marginLeft for bars
  const yAxisWidth = 35;
  const barsMarginLeft = 10;
  // Calculate dynamic barWidth and groupSpacing
  let barWidth = 28;
  let groupSpace = 24;
  if (containerWidth) {
    // total available width for bars area
    const barsAreaWidth = containerWidth - yAxisWidth - barsMarginLeft;
    // We want: groupCount * barWidth + (groupCount-1)*groupSpace = barsAreaWidth
    // Let's set a minimum barWidth and minimum groupSpace
    const groupCount = labels.length;
    const minBarWidth = 18;
    const minGroupSpace = 8;
    // Try to maximize barWidth, but not below minBarWidth
    // If only 1 group, no groupSpace needed
    if (groupCount > 1) {
      // Solve: groupCount*barWidth + (groupCount-1)*groupSpace = barsAreaWidth
      // Try to keep barWidth:groupSpace ratio similar to default, but adapt
      // Prefer a barWidth:groupSpace ratio of about 1:0.85 (28:24)
      const ratio = 24 / 28;
      // Let barWidth + groupSpace = X, barWidth = X/(1+ratio), groupSpace = X*ratio/(1+ratio)
      // But easier: Try barWidth = max(minBarWidth, (barsAreaWidth - (groupCount-1)*minGroupSpace)/groupCount)
      let testBarWidth =
        (barsAreaWidth - (groupCount - 1) * minGroupSpace) / groupCount;
      if (testBarWidth < minBarWidth) {
        // fallback: minimum bar width, reduce groupSpace even more if needed
        barWidth = minBarWidth;
        groupSpace = Math.max(
          minGroupSpace,
          (barsAreaWidth - groupCount * minBarWidth) / (groupCount - 1)
        );
      } else {
        barWidth = testBarWidth;
        groupSpace = minGroupSpace;
      }
    } else {
      // Only one bar, fill most of width
      barWidth = barsAreaWidth * 0.6;
      groupSpace = 0;
    }
  }

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-end",
          height: chartHeight + 30,
          paddingLeft: yAxisWidth,
          position: "relative",
        },
        style,
      ]}
      onLayout={(e) => {
        setContainerWidth(e.nativeEvent.layout.width);
      }}
    >
      {/* Y-Axis Labels */}
      <View
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          top: 0,
          justifyContent: "space-between",
          paddingLeft: 5,
          height: chartHeight,
          zIndex: 1,
        }}
      >
        {yTicks.map((tick, i) => (
          <Text key={i} style={{ fontSize: 10, color: "#333" }}>
            {tick}
          </Text>
        ))}
      </View>
      {/* Bars */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: chartHeight,
          justifyContent: "center",
        }}
      >
        {labels.map((label, idx) => {
          const actionVal = actions[idx] ?? 0;
          const actionHeight = (actionVal / yMax) * chartHeight;
          return (
            <View
              key={idx}
              style={{
                alignItems: "center",
                marginLeft: idx === 0 ? 0 : groupSpace,
                marginRight: 0,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setActiveIndex({ group: 0, index: idx });
                  onBarPress(idx, 0);
                  setTimeout(() => setActiveIndex(null), 1000);
                }}
                style={{ alignItems: "center", justifyContent: "flex-end" }}
              >
                <View
                  style={{
                    width: barWidth,
                    height: actionHeight,
                    backgroundColor:
                      actionVal === yMax ? "#676767" : barColors[0],
                    borderRadius: 6,
                  }}
                />
                {activeIndex &&
                  activeIndex.group === 0 &&
                  activeIndex.index === idx && (
                    <View
                      style={[
                        {
                          position: "absolute",
                          bottom: actionHeight + 8,
                          left: (() => {
                            if (!containerWidth) return 0;
                            const tooltipWidth = 100; // match your tooltip minWidth
                            // barWidth is calculated above
                            if (idx === labels.length - 1) {
                              return -tooltipWidth + barWidth; // shift left so it fits
                            } else if (idx === labels.length - 2) {
                              return -tooltipWidth / 2 + barWidth / 2; // minor adjustment
                            }
                            return 0;
                          })(),
                          right: 0,
                          backgroundColor: "#fff",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#ccc",
                          minWidth: 90,
                          alignItems: "center",
                          padding: 8,
                          zIndex: 10,
                          elevation: 5,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: "#333",
                        }}
                      >
                        {tooltipFormatter
                          ? tooltipFormatter(0, idx, actionVal)
                          : `${label} amount: ${actionVal}`}
                      </Text>
                    </View>
                  )}
              </TouchableOpacity>
              {/* X label */}
              <Text style={{ fontSize: 12, color: "#333", marginTop: 8 }}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function Analytics() {
  const [selectedTab, setSelectedTab] = useState("Feeding");

  // Dropdown states for Batch and Date Range
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState("All Batches");

  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("Last 7 Days");

  // Batch data from Firestore
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchError, setBatchError] = useState("");

  const cardWidth = Dimensions.get("window").width - 32;

  const tableData = [
    {
      id: "Batch-2025-001",
      days: 30,
      avg: "31.8°C",
      hum: "65%",
      success: "98.5%",
    },
    {
      id: "Batch-2025-002",
      days: 25,
      avg: "31.5°C",
      hum: "62%",
      success: "99.2%",
    },
    {
      id: "Batch-2025-003",
      days: 15,
      avg: "32.1°C",
      hum: "68%",
      success: "97.8%",
    },
  ];

  // Fetch batches from Firestore
  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    setBatchLoading(true);
    setBatchError("");
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in");
        setBatchLoading(false);
        return;
      }

      const brooderInfoRef = collection(db, "brooderInfo");
      const brooderSnapshot = await getDocs(brooderInfoRef);

      const fetchedBatches = [];
      brooderSnapshot.forEach((doc) => {
        const data = doc.data();
        // All batches are visible to any logged-in user (no userId filter)

        // Use batchNumber or document ID as identifier
        const batchId = data.batchNumber || data.batchId || doc.id;
        const batchLabel =
          typeof batchId === "number" ? `Batch ${batchId}` : batchId;

        fetchedBatches.push({
          id: doc.id,
          label: batchLabel,
          ...data,
        });
      });

      // Sort batches by batchNumber if available
      fetchedBatches.sort((a, b) => {
        const numA = a.batchNumber || 0;
        const numB = b.batchNumber || 0;
        return numA - numB;
      });

      console.log("Fetched batches from Firestore:", fetchedBatches);
      setBatches(fetchedBatches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      setBatchError("Failed to load batches");
    } finally {
      setBatchLoading(false);
    }
  };

  // Feeding data - now fetched from Firestore
  const [feedingData, setFeedingData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [feedingLoading, setFeedingLoading] = useState(true);
  const [feedingError, setFeedingError] = useState("");
  const [totalFeedUsed, setTotalFeedUsed] = useState(0);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [activeFeedIndex, setActiveFeedIndex] = useState(null);

  // Fetch feeding data from Firestore
  useEffect(() => {
    fetchFeedingData();
  }, [selectedDateRange, selectedBatch]);

  const fetchFeedingData = async () => {
    setFeedingLoading(true);
    setFeedingError("");
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in");
        setFeedingError("No user logged in");
        setFeedingLoading(false);
        return;
      }

      console.log("Fetching feeding data for user:", user.uid);
      console.log("Selected batch:", selectedBatch);
      console.log("Selected date range:", selectedDateRange);

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      if (selectedDateRange === "Last 7 Days") {
        startDate.setDate(now.getDate() - 7);
      } else if (selectedDateRange === "Last 30 Days") {
        startDate.setDate(now.getDate() - 30);
      } else if (selectedDateRange === "This Month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      console.log("Date range:", {
        startDate: startDate.toISOString(),
        now: now.toISOString(),
      });

      // Fetch from feedingExecutions_logs collection
      const feedExecutionsRef = collection(db, "feedingExecutions_logs");
      const feedsSnapshot = await getDocs(feedExecutionsRef);

      console.log(
        "Total documents in feedingExecutions_logs:",
        feedsSnapshot.size
      );

      // Initialize counts for each day of week
      const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
      let total = 0;

      feedsSnapshot.forEach((doc) => {
        const data = doc.data();

        // Log sample documents
        if (total < 3) {
          console.log("Sample document:", { id: doc.id, data });
        }

        // Filter by status === "success"
        if (data.status !== "success") {
          console.log("Skipping doc - status not success:", data.status);
          return;
        }

        // Filter by batch if not "All Batches"
        if (selectedBatch !== "All Batches" && data.batchId) {
          if (data.batchId !== selectedBatch) {
            console.log(
              "Skipping doc - batch mismatch:",
              data.batchId,
              "vs",
              selectedBatch
            );
            return;
          }
        }

        // Parse timestamp (try executedAt first, fall back to timestamp)
        // Handle both Firestore Timestamp objects and string dates
        let docDate;
        if (data.executedAt) {
          docDate = data.executedAt.toDate
            ? data.executedAt.toDate()
            : new Date(data.executedAt);
        } else if (data.timestamp) {
          docDate = data.timestamp.toDate
            ? data.timestamp.toDate()
            : new Date(data.timestamp);
        } else {
          console.log("Skipping doc - no timestamp found");
          return;
        }

        // Filter by date range
        if (docDate < startDate || docDate > now) {
          console.log(
            "Skipping doc - outside date range:",
            docDate.toISOString()
          );
          return;
        }

        // Get day of week (0 = Sunday, so we need to adjust for Mon-Sun)
        const dayOfWeek = docDate.getDay();
        // Convert: Sunday(0)->6, Monday(1)->0, Tuesday(2)->1, etc.
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        console.log("Counting document:", {
          date: docDate.toISOString(),
          day: days[adjustedDay],
          dayOfWeek,
        });
        dayCounts[adjustedDay]++;
        total++;
      });

      console.log("Final feeding data:", dayCounts, "Total:", total);

      if (total === 0) {
        console.warn("No feeding data found matching criteria");
      }

      setFeedingData(dayCounts);
      setTotalFeedUsed(total);
    } catch (error) {
      console.error("Error fetching feeding data:", error);
      setFeedingError(`Error: ${error.message}`);
    } finally {
      setFeedingLoading(false);
    }
  };

  // Water data - now fetched from Firestore
  const [waterLevels, setWaterLevels] = useState([0, 0, 0, 0, 0]);
  const [waterTimes, setWaterTimes] = useState([
    "00:00",
    "04:00",
    "08:00",
    "12:00",
    "20:00",
  ]);
  const [waterLoading, setWaterLoading] = useState(true);
  const [waterStats, setWaterStats] = useState({
    currentLevel: 0,
    dailyConsumption: 0,
    weeklyTotal: 0,
  });
  const [activeWaterIndex, setActiveWaterIndex] = useState(null);

  // Fetch water data from Firestore
  useEffect(() => {
    fetchWaterData();
  }, [selectedDateRange, selectedBatch]);

  const fetchWaterData = async () => {
    setWaterLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in");
        setWaterLoading(false);
        return;
      }

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      if (selectedDateRange === "Last 7 Days") {
        startDate.setDate(now.getDate() - 7);
      } else if (selectedDateRange === "Last 30 Days") {
        startDate.setDate(now.getDate() - 30);
      } else if (selectedDateRange === "This Month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      console.log("Fetching water data from waterLevel_logs collection");
      console.log("Selected batch:", selectedBatch);
      console.log("Date range:", {
        startDate: startDate.toISOString(),
        now: now.toISOString(),
      });

      // Fetch from waterLevel_logs collection
      const waterLogsRef = collection(db, "waterLevel_logs");
      const waterSnapshot = await getDocs(waterLogsRef);

      console.log("Total documents in waterLevel_logs:", waterSnapshot.size);

      // Group data by time slots
      const timeSlots = {
        "00:00": [],
        "04:00": [],
        "08:00": [],
        "12:00": [],
        "20:00": [],
      };

      let totalConsumption = 0;
      let latestLevel = 0;
      let allLevels = [];

      waterSnapshot.forEach((doc) => {
        const data = doc.data();

        // Log sample documents
        if (allLevels.length < 3) {
          console.log("Sample water document:", { id: doc.id, data });
        }

        // Filter by batch if not "All Batches"
        if (selectedBatch !== "All Batches" && data.batchId) {
          if (data.batchId !== selectedBatch) {
            console.log(
              "Skipping doc - batch mismatch:",
              data.batchId,
              "vs",
              selectedBatch
            );
            return;
          }
        }

        // Parse timestamp
        let docDate;
        if (data.timestamp) {
          docDate = data.timestamp.toDate
            ? data.timestamp.toDate()
            : new Date(data.timestamp);
        } else {
          console.log("Skipping doc - no timestamp found");
          return;
        }

        // Filter by date range
        if (docDate < startDate || docDate > now) {
          console.log(
            "Skipping doc - outside date range:",
            docDate.toISOString()
          );
          return;
        }

        // Parse water level (convert string to number if needed)
        const level = parseInt(data.waterLevel) || 0;
        allLevels.push(level);

        // Get hour and assign to nearest time slot
        const hour = docDate.getHours();
        let slot = "00:00";
        if (hour >= 2 && hour < 6) slot = "04:00";
        else if (hour >= 6 && hour < 10) slot = "08:00";
        else if (hour >= 10 && hour < 16) slot = "12:00";
        else if (hour >= 16 && hour < 22) slot = "20:00";
        else slot = "00:00";

        timeSlots[slot].push(level);

        // Track latest level
        if (docDate > new Date(latestLevel)) {
          latestLevel = level;
        }
      });

      // Calculate average for each time slot
      const levels = Object.keys(timeSlots).map((slot) => {
        const values = timeSlots[slot];
        if (values.length === 0) return 0;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return Math.round(avg);
      });

      // Calculate water usage statistics
      const maxLevel = Math.max(...allLevels, 0);
      const minLevel = allLevels.length > 0 ? Math.min(...allLevels) : 0;
      const waterUsed = maxLevel - minLevel; // Water consumed in this period
      const dailyAvgUsage =
        allLevels.length > 0 ? (waterUsed / 7).toFixed(1) : 0;

      console.log(
        "Water levels collected:",
        allLevels.length,
        "Total:",
        levels
      );
      console.log("Water usage stats:", {
        waterUsed,
        dailyAvgUsage,
        maxLevel,
        minLevel,
      });

      setWaterLevels(levels);
      setWaterStats({
        currentLevel: latestLevel,
        dailyConsumption: Math.round(dailyAvgUsage),
        weeklyTotal: waterUsed,
      });
    } catch (error) {
      console.error("Error fetching water data:", error);
    } finally {
      setWaterLoading(false);
    }
  };

  // Energy data - now fetched from Firestore
  const [energyData, setEnergyData] = useState([0, 0, 0, 0, 0]);
  const [energyTimes, setEnergyTimes] = useState([
    "00:00",
    "04:00",
    "08:00",
    "12:00",
    "20:00",
  ]);
  const [energyLoading, setEnergyLoading] = useState(true);
  const [energySummary, setEnergySummary] = useState({
    solarOutput: 0,
    mainPowerUsed: 0,
    efficiency: 0,
  });
  const [activeEnergyIndex, setActiveEnergyIndex] = useState(null);
  const maxEnergy = Math.max(...energyData, 1);

  // Fetch energy data from Firestore
  useEffect(() => {
    fetchEnergyData();
  }, [selectedDateRange, selectedBatch]);

  const fetchEnergyData = async () => {
    setEnergyLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in");
        setEnergyLoading(false);
        return;
      }

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      if (selectedDateRange === "Last 7 Days") {
        startDate.setDate(now.getDate() - 7);
      } else if (selectedDateRange === "Last 30 Days") {
        startDate.setDate(now.getDate() - 30);
      } else if (selectedDateRange === "This Month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      console.log("Fetching energy data from energyLogs collection");
      console.log("Selected batch:", selectedBatch);
      console.log("Date range:", {
        startDate: startDate.toISOString(),
        now: now.toISOString(),
      });

      // Fetch from energyLogs collection
      const energyLogsRef = collection(db, "energyLogs");
      const energySnapshot = await getDocs(energyLogsRef);

      console.log("Total documents in energyLogs:", energySnapshot.size);

      // Group data by time slots
      const timeSlots = {
        "00:00": [],
        "04:00": [],
        "08:00": [],
        "12:00": [],
        "20:00": [],
      };

      let totalSolarOutput = 0;
      let totalMainPowerUsed = 0;
      let documentCount = 0;

      energySnapshot.forEach((doc) => {
        const data = doc.data();

        // Log sample documents
        if (documentCount < 3) {
          console.log("Sample energy document:", { id: doc.id, data });
        }

        // Filter by batch if not "All Batches"
        if (selectedBatch !== "All Batches" && data.batchId) {
          if (data.batchId !== selectedBatch) {
            console.log(
              "Skipping doc - batch mismatch:",
              data.batchId,
              "vs",
              selectedBatch
            );
            return;
          }
        }

        // Parse timestamp
        let docDate;
        if (data.timestamp) {
          docDate = data.timestamp.toDate
            ? data.timestamp.toDate()
            : new Date(data.timestamp);
        } else {
          console.log("Skipping doc - no timestamp found");
          return;
        }

        // Filter by date range
        if (docDate < startDate || docDate > now) {
          console.log(
            "Skipping doc - outside date range:",
            docDate.toISOString()
          );
          return;
        }

        // Parse energy values (convert to number if needed)
        const solarOutput = parseFloat(data.solarOutput) || 0;
        const mainPowerUsed = parseFloat(data.mainPowerUsed) || 0;

        totalSolarOutput += solarOutput;
        totalMainPowerUsed += mainPowerUsed;
        documentCount++;

        // Get hour and assign to nearest time slot
        const hour = docDate.getHours();
        let slot = "00:00";
        if (hour >= 2 && hour < 6) slot = "04:00";
        else if (hour >= 6 && hour < 10) slot = "08:00";
        else if (hour >= 10 && hour < 16) slot = "12:00";
        else if (hour >= 16 && hour < 22) slot = "20:00";
        else slot = "00:00";

        // Store solar output for chart (using solar as primary metric)
        timeSlots[slot].push(solarOutput);
      });

      // Calculate average solar output for each time slot
      const chartData = Object.keys(timeSlots).map((slot) => {
        const values = timeSlots[slot];
        if (values.length === 0) return 0;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return Math.round(avg * 10) / 10; // Round to 1 decimal place
      });

      // Calculate efficiency
      const totalEnergy = totalSolarOutput + totalMainPowerUsed;
      const efficiency =
        totalEnergy > 0
          ? ((totalSolarOutput / totalEnergy) * 100).toFixed(1)
          : 0;

      console.log("Energy data collected:", documentCount, "documents");
      console.log("Energy summary:", {
        totalSolarOutput,
        totalMainPowerUsed,
        efficiency,
      });

      setEnergyData(chartData);
      setEnergySummary({
        solarOutput: Math.round(totalSolarOutput * 10) / 10,
        mainPowerUsed: Math.round(totalMainPowerUsed * 10) / 10,
        efficiency: efficiency,
      });
    } catch (error) {
      console.error("Error fetching energy data:", error);
    } finally {
      setEnergyLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Select Section */}
      <View style={[styles.card, { width: cardWidth }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={20} color="#333" />
          <Text style={styles.sectionTitle}>Select Batch / Date Range</Text>
        </View>

        <Text style={styles.label}>Batch</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowBatchDropdown(!showBatchDropdown)}
        >
          <Text style={styles.dropdownText}>{selectedBatch}</Text>
          <Ionicons
            name={showBatchDropdown ? "chevron-up" : "chevron-down"}
            size={18}
            color="#666"
          />
        </TouchableOpacity>

        {showBatchDropdown && (
          <View style={styles.dropdownOptions}>
            {/* All Batches default option */}
            <TouchableOpacity
              onPress={() => {
                setSelectedBatch("All Batches");
                setShowBatchDropdown(false);
              }}
            >
              <Text style={styles.dropdownOptionText}>All Batches</Text>
            </TouchableOpacity>

            {/* Loading state */}
            {batchLoading && (
              <View style={{ padding: 12, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#133E87" />
                <Text style={{ marginTop: 4, color: "#666", fontSize: 14 }}>
                  Loading batches...
                </Text>
              </View>
            )}

            {/* Error state */}
            {!batchLoading && batchError && (
              <Text style={{ padding: 12, color: "#D32F2F", fontSize: 14 }}>
                {batchError}
              </Text>
            )}

            {/* No batches found */}
            {!batchLoading && !batchError && batches.length === 0 && (
              <Text style={{ padding: 12, color: "#666", fontSize: 14 }}>
                No batches found
              </Text>
            )}

            {/* Dynamic batch options */}
            {!batchLoading &&
              !batchError &&
              batches.map((batch) => (
                <TouchableOpacity
                  key={batch.id}
                  onPress={() => {
                    setSelectedBatch(batch.label);
                    setShowBatchDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{batch.label}</Text>
                </TouchableOpacity>
              ))}
          </View>
        )}

        <Text style={styles.label}>Date Range</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowDateDropdown(!showDateDropdown)}
        >
          <Text style={styles.dropdownText}>{selectedDateRange}</Text>
          <Ionicons
            name={showDateDropdown ? "chevron-up" : "chevron-down"}
            size={18}
            color="#666"
          />
        </TouchableOpacity>

        {showDateDropdown && (
          <View style={styles.dropdownOptions}>
            <TouchableOpacity
              onPress={() => {
                setSelectedDateRange("Last 7 Days");
                setShowDateDropdown(false);
              }}
            >
              <Text style={styles.dropdownOptionText}>Last 7 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setSelectedDateRange("Last 30 Days");
                setShowDateDropdown(false);
              }}
            >
              <Text style={styles.dropdownOptionText}>Last 30 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setSelectedDateRange("This Month");
                setShowDateDropdown(false);
              }}
            >
              <Text style={styles.dropdownOptionText}>This Month</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {["Feeding", "Water", "Energy"].map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tabButton, selectedTab === tab && styles.activeTab]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab && { color: "#fff", fontWeight: "700" },
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ---------------- FEEDING TAB ---------------- */}
      {selectedTab === "Feeding" && (
        <>
          {/* Feeding Bar Chart (Single Bar) */}
          <View style={[styles.card, { width: cardWidth }]}>
            <Text style={styles.chartTitle}>Feeding Frequency Chart</Text>
            {feedingError && (
              <View
                style={{
                  padding: 12,
                  backgroundColor: "#ffebee",
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{ color: "#D32F2F", fontSize: 14, fontWeight: "600" }}
                >
                  Error: {feedingError}
                </Text>
              </View>
            )}
            {feedingLoading ? (
              <View
                style={{
                  height: 180,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color="#133E87" />
                <Text style={{ marginTop: 10, color: "#666" }}>
                  Loading data...
                </Text>
              </View>
            ) : (
              <GroupedBarChart
                actions={feedingData}
                labels={days}
                barColors={["#000"]}
                maxValue={Math.max(...feedingData, 1) + 2}
                style={{
                  marginTop: 10,
                  marginBottom: 10,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                activeIndex={activeFeedIndex}
                setActiveIndex={setActiveFeedIndex}
                tooltipFormatter={(group, idx, val) =>
                  `${days[idx]}: ${val} feeds`
                }
              />
            )}
          </View>
          {/* Weekly Summary (Updated Section) */}
          <View style={[styles.weeklyCard, { width: cardWidth }]}>
            <Text style={styles.weeklyTitle}>Weekly Summary</Text>
            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Total Feed Schedules</Text>
              <Text style={styles.weeklyValue}>{totalFeedUsed}</Text>
            </View>
            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Daily Average</Text>
              <Text style={styles.weeklyValue}>
                {(totalFeedUsed / 7).toFixed(1)}
              </Text>
            </View>
            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Most Active Day</Text>
              <Text style={styles.weeklyValue}>
                {feedingData.every((v) => v === 0)
                  ? "N/A"
                  : days[feedingData.indexOf(Math.max(...feedingData))]}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ---------------- WATER TAB ---------------- */}
      {selectedTab === "Water" && (
        <>
          {/* Water Level Chart */}
          <View style={[styles.card, { width: cardWidth }]}>
            <Text style={styles.chartTitle}>Water Level Chart</Text>

            {waterLoading ? (
              <View
                style={{
                  height: 180,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color="#133E87" />
                <Text style={{ marginTop: 10, color: "#666" }}>
                  Loading data...
                </Text>
              </View>
            ) : (
              <View style={styles.waterChartContainer}>
                {/* Y-Axis Labels */}
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    top: 0,
                    justifyContent: "space-between",
                    paddingLeft: 5,
                    height: "100%",
                  }}
                >
                  <Text style={{ fontSize: 10, color: "#333" }}>100</Text>
                  <Text style={{ fontSize: 10, color: "#333" }}>75</Text>
                  <Text style={{ fontSize: 10, color: "#333" }}>50</Text>
                  <Text style={{ fontSize: 10, color: "#333" }}>25</Text>
                  <Text style={{ fontSize: 10, color: "#333" }}>0</Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    marginLeft: 30,
                  }}
                >
                  {waterTimes.map((time, index) => (
                    <View key={index} style={styles.waterPointWrapper}>
                      {(activeWaterIndex === index ||
                        waterLevels[index] === Math.max(...waterLevels)) && (
                        <View
                          style={[
                            styles.waterVerticalLine,
                            { bottom: 0, height: waterLevels[index] * 1.8 },
                          ]}
                        />
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setActiveWaterIndex(index);
                          setTimeout(() => setActiveWaterIndex(null), 1000);
                        }}
                        activeOpacity={0.8}
                        style={[
                          styles.waterDot,
                          { bottom: waterLevels[index] * 1.8 },
                        ]}
                      />
                      {/* Tooltip above dot */}
                      {activeWaterIndex === index && (
                        <View
                          style={[
                            styles.feedTooltip,
                            {
                              position: "absolute",
                              bottom: waterLevels[index] * 1.8 + 18,
                              left: "50%",
                              transform: [{ translateX: -50 }],
                              minWidth: 90,
                              zIndex: 10,
                            },
                          ]}
                        >
                          <Text style={styles.tooltipText}>
                            {waterTimes[index]}
                          </Text>
                          <Text style={styles.tooltipText}>
                            Level: {waterLevels[index]}
                          </Text>
                        </View>
                      )}
                      {/* Spacer to push label below baseline */}
                      <View style={{ height: 180 }} />
                      <Text style={styles.waterTimeLabel}>{time}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Water Usage Summary */}
          <View style={[styles.waterCard, { width: cardWidth }]}>
            <Text style={styles.weeklyTitle}>Water Usage</Text>

            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Current Level</Text>
              <Text style={styles.weeklyValue}>{waterStats.currentLevel}%</Text>
            </View>

            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Total Activities</Text>
              <Text style={styles.weeklyValue}>
                {waterStats.dailyConsumption}
              </Text>
            </View>

            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Peak Time</Text>
              <Text style={styles.weeklyValue}>
                {waterLevels.every((v) => v === 0)
                  ? "N/A"
                  : waterTimes[waterLevels.indexOf(Math.max(...waterLevels))]}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ---------------- ENERGY TAB ---------------- */}
      {selectedTab === "Energy" && (
        <>
          {/* Energy Chart */}
          <View style={[styles.card, { width: cardWidth }]}>
            <Text style={styles.chartTitle}>Energy Output Chart</Text>

            {energyLoading ? (
              <View
                style={{
                  height: 180,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color="#133E87" />
                <Text style={{ marginTop: 10, color: "#666" }}>
                  Loading data...
                </Text>
              </View>
            ) : (
              <View style={styles.energyChartContainer}>
                {/* Y-Axis Labels */}
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    top: 0,
                    justifyContent: "space-between",
                    paddingLeft: 5,
                    height: "100%",
                  }}
                >
                  <Text style={{ fontSize: 10, color: "#333" }}>80</Text>
                  <Text style={{ fontSize: 10, color: "#333" }}>60</Text>
                  <Text style={{ fontSize: 10, color: "#333" }}>40</Text>
                  <Text style={{ fontSize: 10, color: "#333" }}>20</Text>
                  <Text style={{ fontSize: 10, color: "#333" }}>0</Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    marginLeft: 30,
                  }}
                >
                  {energyTimes.map((time, index) => (
                    <View key={index} style={styles.energyPointWrapper}>
                      {/* Show vertical line if this is the active dot, or if this value is the max energy */}
                      {(activeEnergyIndex === index ||
                        energyData[index] === maxEnergy) && (
                        <View
                          style={[
                            styles.energyVerticalLine,
                            { bottom: 0, height: energyData[index] * 1.8 },
                          ]}
                        />
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setActiveEnergyIndex(index);
                          setTimeout(() => setActiveEnergyIndex(null), 1000);
                        }}
                        activeOpacity={0.8}
                        style={[
                          styles.energyDot,
                          { bottom: energyData[index] * 1.8 },
                        ]}
                      />
                      {/* Tooltip above dot (optional, matching Water) */}
                      {activeEnergyIndex === index && (
                        <View
                          style={[
                            styles.feedTooltip,
                            {
                              position: "absolute",
                              bottom: energyData[index] * 1.8 + 18,
                              left: "50%",
                              transform: [{ translateX: -50 }],
                              minWidth: 90,
                              zIndex: 10,
                            },
                          ]}
                        >
                          <Text style={styles.tooltipText}>
                            {energyTimes[index]}
                          </Text>
                          <Text style={styles.tooltipText}>
                            Output: {energyData[index]} kWh
                          </Text>
                        </View>
                      )}
                      <View style={{ height: 180 }} />
                      <Text style={styles.energyTimeLabel}>{time}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Energy Summary */}
          <View style={[styles.waterCard, { width: cardWidth }]}>
            <Text style={styles.weeklyTitle}>Energy Summary</Text>

            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Solar Output</Text>
              <Text style={styles.weeklyValue}>
                {energySummary.solarOutput} kWh
              </Text>
            </View>

            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Main Power Used</Text>
              <Text style={styles.weeklyValue}>
                {energySummary.mainPowerUsed} kWh
              </Text>
            </View>

            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>Efficiency</Text>
              <Text style={styles.weeklyValue}>
                {energySummary.efficiency}%
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  scrollContent: { padding: 16, paddingBottom: 120 },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0D609C",
    marginBottom: 16,
    alignSelf: "center",
  },

  summaryCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0D609C",
    marginBottom: 16,
    alignSelf: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionTitle: { marginLeft: 8, fontSize: 17, fontWeight: "700" },

  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#666",
    marginBottom: 4,
  },

  dropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#0D609C",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  dropdownText: { fontSize: 14, color: "#444" },

  statsRow: { flexDirection: "row", justifyContent: "space-between" },

  statsCard: {
    flex: 1,
    backgroundColor: "#F8FCFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0D609C",
    marginRight: 8,
    marginBottom: 18,
  },

  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  statsLabel: { marginLeft: 6, fontSize: 14, color: "#333" },

  statsValue: { fontSize: 28, fontWeight: "700", marginBottom: 4 },

  statsSub: { fontSize: 13, color: "#133E87" },

  statsSubGray: { fontSize: 13, color: "#133E87" },

  tabContainer: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: "#eaeaea",
    borderRadius: 12,
    marginBottom: 16,
  },

  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#eaeaea",
  },

  activeTab: { backgroundColor: "#133E87" },

  tabText: { fontSize: 14, color: "#333" },

  /* FEEDING CHART */
  feedChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 180, // slightly reduced to fit bars nicely
    paddingLeft: 30, // space for y-axis labels
    paddingRight: 10,
    position: "relative",
  },

  feedBarWrapper: {
    alignItems: "center",
    justifyContent: "flex-end",
  },

  feedBar: {
    width: 25,
    backgroundColor: "#000",
    borderRadius: 6,
  },

  feedLabel: {
    marginTop: 6,
    fontSize: 12,
    color: "#333",
  },

  feedTooltip: {
    position: "absolute",
    backgroundColor: "#fff",
    padding: 12,
    minWidth: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 5,
  },

  /* TEMP CHART */
  chartTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },

  /* WEEKLY SUMMARY (NEW) */
  weeklyCard: {
    backgroundColor: "#F8FCFF",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0D609C",
    marginBottom: 32,
    alignSelf: "center",
  },

  weeklyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 18,
  },

  weeklyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  weeklyLabel: {
    fontSize: 16,
    color: "#555",
    fontWeight: "600",
  },

  weeklyValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  /* TABLE */
  tableCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0D609C",
    marginBottom: 16,
    alignSelf: "center",
  },

  tableTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 28,
  },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    marginBottom: 6,
  },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  // Table columns alignment for header and rows
  col1Header: { flex: 2, fontWeight: "700", textAlign: "left" },
  col1Link: { flex: 2, color: "#0D47A1", fontWeight: "700", textAlign: "left" },
  col2Header: { flex: 1, fontWeight: "700", textAlign: "center" },
  col2Row: { flex: 1, textAlign: "center" },
  col3Header: { flex: 1.3, fontWeight: "700", textAlign: "center" },
  col3Row: { flex: 1.3, textAlign: "center" },
  col4Header: { flex: 1.4, fontWeight: "700", textAlign: "center" },
  col4Row: { flex: 1.1, textAlign: "center" },
  col5Header: {
    flex: 1.2,
    fontWeight: "700",
    textAlign: "right",
    color: "green",
  },
  col5Row: { flex: 1.2, textAlign: "right", fontWeight: "700", color: "green" },

  /* WATER CHART */
  waterChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 180,
    paddingHorizontal: 20,
    position: "relative",
  },

  waterPointWrapper: {
    alignItems: "center",
    position: "relative",
  },

  waterDot: {
    width: 10,
    height: 10,
    backgroundColor: "#000",
    borderRadius: 5,
    position: "absolute",
  },

  waterTimeLabel: {
    marginTop: 8,
    fontSize: 10,
    color: "#333",
    marginBottom: -12,
  },

  waterVerticalLine: {
    width: 2,
    backgroundColor: "#333",
    position: "absolute",
  },

  waterTooltip: {
    position: "absolute",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    top: 80,
    left: 70,
    zIndex: 10,
  },

  tooltipText: {
    fontSize: 16, // increased font size
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
  },

  waterCard: {
    backgroundColor: "#F8FCFF",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0D609C",
    marginBottom: 16,
    alignSelf: "center",
  },

  /* ENERGY CHART */
  energyChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 180,
    paddingHorizontal: 20,
    position: "relative",
  },

  energyPointWrapper: {
    alignItems: "center",
    position: "relative",
  },

  energyDot: {
    width: 10,
    height: 10,
    backgroundColor: "#000",
    borderRadius: 5,
    position: "absolute",
  },

  energyTimeLabel: {
    marginTop: 8,
    fontSize: 10,
    color: "#333",
    marginBottom: -12,
  },

  energyVerticalLine: {
    width: 2,
    backgroundColor: "#333",
    position: "absolute",
  },

  energyTooltip: {
    position: "absolute",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    top: 80,
    left: 70,
    zIndex: 10,
  },
  dropdownOptions: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#0D609C",
    borderRadius: 10,
    marginBottom: 10,
    paddingVertical: 6,
  },
  dropdownOptionText: {
    padding: 12,
    fontSize: 14,
    color: "#333",
  },
});
