import React, { useState } from "react";
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
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../config/firebaseconfig";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import * as XLSX from "xlsx";
import CalendarModal from "../../navigation/CalendarModal";
import GenerateReportModal from "./GenerateReportModal";
import ExportModal from "./ExportModal";
import SuccessModal from "../../navigation/SuccessModal";

const Icon = Feather;

export default function Reports({ navigation }) {
  const [selectedType, setSelectedType] = useState("All");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showOnlyBatch, setShowOnlyBatch] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedReportForExport, setSelectedReportForExport] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(null); // null means show all dates
  const [reportDate, setReportDate] = useState(new Date()); // for generating new reports
  const [isExporting, setIsExporting] = useState(false);

  const [allReports, setAllReports] = useState([
    {
      id: 1,
      type: "Batch",
      date: new Date("2025-10-18"),
      displayName: "Batch #3",
    },
    {
      id: 2,
      type: "Summary",
      date: new Date("2025-10-18"),
      displayName: "Daily Summary",
    },
    {
      id: 3,
      type: "Batch",
      date: new Date("2025-10-17"),
      displayName: "Batch #2",
    },
    {
      id: 4,
      type: "Summary",
      date: new Date("2025-10-17"),
      displayName: "Daily Summary",
    },
    {
      id: 5,
      type: "Batch",
      date: new Date("2025-10-16"),
      displayName: "Batch #1",
    },
    {
      id: 6,
      type: "Summary",
      date: new Date("2025-10-16"),
      displayName: "Daily Summary",
    },
    {
      id: 7,
      type: "Report",
      date: new Date("2025-10-15"),
      displayName: "Weekly Report",
    },
  ]);

  // Extract ALL unique batch numbers from reports for duplicate checking
  const existingBatchNumbers = allReports
    .filter((report) => report.type === "Batch")
    .map((report) => report.displayName);

  const typeOptions = ["All", "Report", "Summary"];

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isSameDate = (date1, date2) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Filter reports based on Batch button, Type dropdown, and selected calendar date
  const filteredReports = allReports.filter((report) => {
    // Date filter - if a date is selected, only show reports from that date
    if (selectedDate && !isSameDate(report.date, selectedDate)) {
      return false;
    }

    // If Batch button is active, only show Batch reports (ignore Type filter)
    if (showOnlyBatch) {
      return report.type === "Batch";
    }

    // Otherwise, filter by Type dropdown
    if (selectedType === "All") {
      return true; // Show all reports
    }

    return report.type === selectedType; // Show only matching type
  });

  const handleViewReport = (report) => {
    console.log("View report:", report);
    navigation.navigate("ViewReport", { report });
  };

  const handleExport = (report) => {
    console.log("Export report:", report);
    setSelectedReportForExport(report);
    setShowExportModal(true);
  };

  const getLogoBase64 = async () => {
    try {
      const logoUri = Asset.fromModule(require("../../../assets/logo.png")).uri;
      const asset = Asset.fromModule(require("../../../assets/logo.png"));
      if (!asset.downloaded) {
        await asset.downloadAsync();
      }
      const fileUri = `${FileSystem.cacheDirectory}logo-temp.png`;
      await FileSystem.copyAsync({
        from: asset.localUri,
        to: fileUri,
      });
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error("Error loading logo:", error);
      return "https://via.placeholder.com/150x50/133E87/FFFFFF?text=Internet+of+Tsiken";
    }
  };

  const formatTimestampGMT8 = () => {
    const now = new Date();
    const gmt8Date = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const month = String(gmt8Date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(gmt8Date.getUTCDate()).padStart(2, "0");
    const year = gmt8Date.getUTCFullYear();
    const hours = gmt8Date.getUTCHours();
    const minutes = gmt8Date.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${month}/${day}/${year} ${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  };

  const getFileNameTimestamp = () => {
    const now = new Date();
    const gmt8Date = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = gmt8Date.getUTCFullYear();
    const month = String(gmt8Date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(gmt8Date.getUTCDate()).padStart(2, "0");
    const hours = String(gmt8Date.getUTCHours()).padStart(2, "0");
    const minutes = String(gmt8Date.getUTCMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}_${hours}-${minutes}`;
  };

  const fetchSensorData = async () => {
    try {
      const sensorTypes = [
        "temperature",
        "waterLevel",
        "energy",
        "humidity",
        "feedLevel",
      ];
      const sensorData = {};

      for (const sensorType of sensorTypes) {
        try {
          const docRef = doc(db, "sensorAverages", sensorType);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            sensorData[sensorType] = docSnap.data();
          } else {
            console.log(`No data found for ${sensorType}`);
            sensorData[sensorType] = null;
          }
        } catch (error) {
          console.warn(
            `Error fetching ${sensorType}, using N/A:`,
            error.message
          );
          sensorData[sensorType] = null;
        }
      }

      return sensorData;
    } catch (error) {
      console.error("Error fetching sensor data:", error);
      // Return empty data structure instead of throwing
      return {
        temperature: null,
        waterLevel: null,
        energy: null,
        humidity: null,
        feedLevel: null,
      };
    }
  };

  const generateHTMLContent = async (userName, sensorData, report) => {
    const companyLogoUrl = await getLogoBase64();

    const statistics = {
      minimum: sensorData.temperature?.minValue
        ? `${sensorData.temperature.minValue.toFixed(1)}°C`
        : "N/A",
      maximum: sensorData.temperature?.maxValue
        ? `${sensorData.temperature.maxValue.toFixed(1)}°C`
        : "N/A",
      average: sensorData.temperature?.average
        ? `${sensorData.temperature.average.toFixed(1)}°C`
        : "N/A",
    };

    const waterUsage = {
      currentLevel: sensorData.waterLevel?.average
        ? `${sensorData.waterLevel.average.toFixed(0)}%`
        : "N/A",
      dailyConsumption: sensorData.waterLevel?.average
        ? `${(100 - sensorData.waterLevel.average).toFixed(1)} L`
        : "N/A",
      weeklyTotal: sensorData.waterLevel?.totalReadings
        ? `${((100 - sensorData.waterLevel.average) * 7).toFixed(1)} L`
        : "N/A",
    };

    const energySummary = {
      solarGenerated: sensorData.energy?.average
        ? `${sensorData.energy.average.toFixed(1)} kWh`
        : "N/A",
      mainPowerUsed: sensorData.energy?.minValue
        ? `${sensorData.energy.minValue.toFixed(1)} kWh`
        : "N/A",
      solarEfficiency: sensorData.energy?.average
        ? `${Math.min(100, sensorData.energy.average).toFixed(0)}%`
        : "N/A",
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              margin: 15mm;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 10px;
              color: #1a1a1a;
              margin: 0;
            }
            .header {
              display: flex;
              align-items: center;
              gap: 15px;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #133E87;
            }
            .header-logo {
              height: 40px;
              width: auto;
            }
            .header-company-name {
              font-size: 18px;
              font-weight: 700;
              color: #133E87;
              margin: 0;
            }
            h1 {
              color: #133E87;
              font-size: 14px;
              margin-bottom: 4px;
              margin-top: 8px;
            }
            .info {
              margin-bottom: 6px;
              font-size: 9px;
              color: #64748b;
            }
            .section {
              margin-top: 10px;
              margin-bottom: 8px;
            }
            .section-title {
              font-size: 11px;
              font-weight: 700;
              color: #133E87;
              margin-bottom: 6px;
              padding-bottom: 4px;
              border-bottom: 1px solid #e5e7eb;
            }
            .stat-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              border-bottom: 1px solid #f1f5f9;
            }
            .stat-row:last-child {
              border-bottom: none;
            }
            .stat-label {
              font-size: 9px;
              font-weight: 500;
              color: #64748b;
            }
            .stat-value {
              font-size: 9px;
              font-weight: 700;
              color: #1a1a1a;
            }
            .two-column {
              display: flex;
              gap: 15px;
              margin-top: 10px;
            }
            .column {
              flex: 1;
            }
            .footer {
              margin-top: 12px;
              font-size: 7px;
              color: #94a3b8;
              text-align: center;
              padding-top: 8px;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 2px 0;
            }
          </style>
        </head>
        <body>
          <!-- Company Header -->
          <div class="header">
            <img src="${companyLogoUrl}" alt="Company Logo" class="header-logo" />
            <h2 class="header-company-name">Internet of Tsiken</h2>
          </div>

          <!-- Report Title -->
          <h1>Sensor Report - ${report?.displayName || "Report"}</h1>
          <div class="info">
            <strong>Generated by:</strong> ${userName} | <strong>Date:</strong> ${formatTimestampGMT8()}
          </div>

          <!-- First Row: Temperature, Water, Energy in columns -->
          <div class="two-column">
            <div class="column">
              <!-- Temperature Statistics Section -->
              <div class="section">
                <div class="section-title">Temperature Statistics</div>
                <div class="stat-row">
                  <span class="stat-label">Minimum</span>
                  <span class="stat-value">${statistics.minimum}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Maximum</span>
                  <span class="stat-value">${statistics.maximum}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Average</span>
                  <span class="stat-value">${statistics.average}</span>
                </div>
                ${
                  sensorData.temperature?.totalReadings
                    ? `
                <div class="stat-row">
                  <span class="stat-label">Readings</span>
                  <span class="stat-value">${sensorData.temperature.totalReadings}</span>
                </div>
                `
                    : ""
                }
              </div>

              <!-- Water Usage Section -->
              <div class="section">
                <div class="section-title">Water Usage</div>
                <div class="stat-row">
                  <span class="stat-label">Current Level</span>
                  <span class="stat-value">${waterUsage.currentLevel}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Daily Consumption</span>
                  <span class="stat-value">${waterUsage.dailyConsumption}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Weekly Total</span>
                  <span class="stat-value">${waterUsage.weeklyTotal}</span>
                </div>
                ${
                  sensorData.waterLevel?.totalReadings
                    ? `
                <div class="stat-row">
                  <span class="stat-label">Readings</span>
                  <span class="stat-value">${sensorData.waterLevel.totalReadings}</span>
                </div>
                `
                    : ""
                }
              </div>
            </div>

            <div class="column">
              <!-- Energy Summary Section -->
              <div class="section">
                <div class="section-title">Energy Summary</div>
                <div class="stat-row">
                  <span class="stat-label">Solar Generated</span>
                  <span class="stat-value">${energySummary.solarGenerated}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Main Power Used</span>
                  <span class="stat-value">${energySummary.mainPowerUsed}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Solar Efficiency</span>
                  <span class="stat-value">${energySummary.solarEfficiency}</span>
                </div>
                ${
                  sensorData.energy?.totalReadings
                    ? `
                <div class="stat-row">
                  <span class="stat-label">Readings</span>
                  <span class="stat-value">${sensorData.energy.totalReadings}</span>
                </div>
                `
                    : ""
                }
              </div>

              ${
                sensorData.humidity
                  ? `
              <!-- Humidity Section -->
              <div class="section">
                <div class="section-title">Humidity Data</div>
                <div class="stat-row">
                  <span class="stat-label">Average</span>
                  <span class="stat-value">${sensorData.humidity.average ? `${sensorData.humidity.average.toFixed(1)}%` : "N/A"}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Minimum</span>
                  <span class="stat-value">${sensorData.humidity.minValue ? `${sensorData.humidity.minValue.toFixed(1)}%` : "N/A"}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Maximum</span>
                  <span class="stat-value">${sensorData.humidity.maxValue ? `${sensorData.humidity.maxValue.toFixed(1)}%` : "N/A"}</span>
                </div>
              </div>
              `
                  : ""
              }

              ${
                sensorData.feedLevel
                  ? `
              <!-- Feed Level Section -->
              <div class="section">
                <div class="section-title">Feed Level Data</div>
                <div class="stat-row">
                  <span class="stat-label">Average</span>
                  <span class="stat-value">${sensorData.feedLevel.average ? `${sensorData.feedLevel.average.toFixed(1)}%` : "N/A"}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Minimum</span>
                  <span class="stat-value">${sensorData.feedLevel.minValue ? `${sensorData.feedLevel.minValue.toFixed(1)}%` : "N/A"}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Maximum</span>
                  <span class="stat-value">${sensorData.feedLevel.maxValue ? `${sensorData.feedLevel.maxValue.toFixed(1)}%` : "N/A"}</span>
                </div>
              </div>
              `
                  : ""
              }
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>This report was automatically generated by Internet of Tsiken System</p>
            <p>© ${new Date().getFullYear()} Internet of Tsiken. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleExportType = async (type) => {
    if (type === "PDF") {
      await handleExportPDF();
    } else if (type === "Excel") {
      await handleExportExcel();
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      setShowExportModal(false);

      // Fetch sensor data from Firestore
      const sensorData = await fetchSensorData();

      // Check if any sensor data exists
      const hasSensorData = Object.values(sensorData).some(
        (data) => data !== null
      );
      if (!hasSensorData) {
        Alert.alert(
          "No Data Available",
          "Unable to connect to database or no sensor data found. The report will show 'N/A' for all values.\n\nDo you want to continue?",
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setIsExporting(false),
            },
            {
              text: "Continue",
              onPress: async () => {
                await generateAndSharePDF(sensorData);
              },
            },
          ]
        );
        return;
      }

      await generateAndSharePDF(sensorData);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      Alert.alert(
        "Export Error",
        "Failed to export PDF. Please check your internet connection and try again.\n\nError: " +
          error.message
      );
      setIsExporting(false);
    }
  };

  const generateAndSharePDF = async (sensorData) => {
    try {
      // Get current user info
      const currentUser = auth.currentUser;
      let userName = "User";

      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userName =
              userData.firstName && userData.lastName
                ? `${userData.firstName} ${userData.lastName}`
                : userData.firstName || currentUser.email || "User";
          }
        } catch (error) {
          console.warn(
            "Could not fetch user data, using default:",
            error.message
          );
        }
      }

      // Generate HTML content
      const htmlContent = await generateHTMLContent(
        userName,
        sensorData,
        selectedReportForExport
      );

      // Create PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Generate filename
      const reportName = selectedReportForExport?.displayName || "Report";
      const sanitizedName = reportName.replace(/[^a-zA-Z0-9]/g, "_");
      const timestamp = getFileNameTimestamp();
      const fileName = `Sensor_Report_${sanitizedName}_${timestamp}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${fileName}`;

      // Move file to permanent location
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri);
        setSuccessMessage("Report successfully exported.");
        setShowSuccessModal(true);
      } else {
        Alert.alert("Success", "PDF saved successfully!");
      }

      // Log report export to Firestore (non-blocking)
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          await addDoc(collection(db, "report_logs"), {
            userId: currentUser.uid,
            type: "pdf",
            timestamp: serverTimestamp(),
            reportName: selectedReportForExport?.displayName || "Sensor Report",
            fileName: fileName,
          });
          console.log("📝 Report export logged (PDF)");
        }
      } catch (logError) {
        console.log(
          "⚠️ Failed to log PDF export (non-critical):",
          logError.message
        );
      }

      setIsExporting(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      setShowExportModal(false);

      // Fetch sensor data from Firestore
      const sensorData = await fetchSensorData();

      // Check if any sensor data exists
      const hasSensorData = Object.values(sensorData).some(
        (data) => data !== null
      );
      if (!hasSensorData) {
        Alert.alert(
          "No Data Available",
          "Unable to connect to database or no sensor data found. The report will show 'N/A' for all values.\n\nDo you want to continue?",
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setIsExporting(false),
            },
            {
              text: "Continue",
              onPress: async () => {
                await generateAndShareExcel(sensorData);
              },
            },
          ]
        );
        return;
      }

      await generateAndShareExcel(sensorData);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      Alert.alert(
        "Export Error",
        "Failed to export Excel file. Please check your internet connection and try again.\n\nError: " +
          error.message
      );
      setIsExporting(false);
    }
  };

  const generateAndShareExcel = async (sensorData) => {
    try {
      // Prepare data for Excel
      const excelData = [];

      // Add header row
      excelData.push([
        "Sensor Type",
        "Average",
        "Min Value",
        "Max Value",
        "Total Readings",
        "Updated At",
      ]);

      // Define sensor types and their display names
      const sensorTypes = [
        { key: "temperature", name: "Temperature", unit: "°C" },
        { key: "waterLevel", name: "Water Level", unit: "%" },
        { key: "energy", name: "Energy", unit: "kWh" },
        { key: "feedLevel", name: "Feed Level", unit: "%" },
      ];

      // Add data rows
      sensorTypes.forEach(({ key, name, unit }) => {
        const data = sensorData[key];

        if (data) {
          const average = data.average
            ? `${data.average.toFixed(1)} ${unit}`
            : "N/A";
          const minValue = data.minValue
            ? `${data.minValue.toFixed(1)} ${unit}`
            : "N/A";
          const maxValue = data.maxValue
            ? `${data.maxValue.toFixed(1)} ${unit}`
            : "N/A";
          const totalReadings = data.totalReadings || "N/A";
          const updatedAt = data.updatedAt
            ? new Date(data.updatedAt.seconds * 1000).toLocaleString()
            : "N/A";

          excelData.push([
            name,
            average,
            minValue,
            maxValue,
            totalReadings,
            updatedAt,
          ]);
        } else {
          excelData.push([name, "N/A", "N/A", "N/A", "N/A", "N/A"]);
        }
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths for better readability
      worksheet["!cols"] = [
        { wch: 15 }, // Sensor Type
        { wch: 15 }, // Average
        { wch: 15 }, // Min Value
        { wch: 15 }, // Max Value
        { wch: 15 }, // Total Readings
        { wch: 20 }, // Updated At
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sensor Report");

      // Generate Excel file as base64
      const excelBase64 = XLSX.write(workbook, {
        type: "base64",
        bookType: "xlsx",
      });

      // Generate filename
      const reportName = selectedReportForExport?.displayName || "Report";
      const sanitizedName = reportName.replace(/[^a-zA-Z0-9]/g, "_");
      const timestamp = getFileNameTimestamp();
      const fileName = `Sensor_Report_${sanitizedName}_${timestamp}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Write the file
      await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share the Excel file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
        setSuccessMessage("Report successfully exported.");
        setShowSuccessModal(true);
      } else {
        Alert.alert("Success", "Excel file saved successfully!");
      }

      // Log report export to Firestore (non-blocking)
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          await addDoc(collection(db, "report_logs"), {
            userId: currentUser.uid,
            type: "excel",
            timestamp: serverTimestamp(),
            reportName: selectedReportForExport?.displayName || "Sensor Report",
            fileName: fileName,
          });
          console.log("📝 Report export logged (Excel)");
        }
      } catch (logError) {
        console.log(
          "⚠️ Failed to log Excel export (non-critical):",
          logError.message
        );
      }

      setIsExporting(false);
    } catch (error) {
      console.error("Error generating Excel:", error);
      Alert.alert("Error", "Failed to generate Excel file. Please try again.");
      setIsExporting(false);
    }
  };

  const handleCalendarPress = () => {
    setShowCalendar(true);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setReportDate(date);
    console.log("Filtering reports for date:", formatDate(date));
  };

  const handleClearDateFilter = () => {
    setSelectedDate(null);
  };

  const handleGenerateReport = () => {
    setShowGenerateModal(true);
  };

  const handleReportGenerated = (reportData) => {
    console.log("New report generated:", reportData);

    // Format batch number
    let formattedBatchNumber = reportData.batchNumber.trim();

    if (/^\d+$/.test(formattedBatchNumber)) {
      formattedBatchNumber = `Batch #${formattedBatchNumber}`;
    } else if (/^batch\s+\d+$/i.test(formattedBatchNumber)) {
      const num = formattedBatchNumber.match(/\d+/)[0];
      formattedBatchNumber = `Batch #${num}`;
    } else if (/^batch#\d+$/i.test(formattedBatchNumber)) {
      const num = formattedBatchNumber.match(/\d+/)[0];
      formattedBatchNumber = `Batch #${num}`;
    }

    const newReport = {
      id: allReports.length + 1,
      type: "Batch",
      date: reportData.batchStartDate,
      displayName: formattedBatchNumber,
      numberOfChicks: reportData.numberOfChicks,
      expectedHarvestDays: reportData.expectedHarvestDays,
      expectedDate: reportData.expectedDate,
    };

    setAllReports([newReport, ...allReports]);
    console.log("Report added to table:", newReport);

    // Show success modal
    setSuccessMessage("Report successfully generated");
    setShowSuccessModal(true);
  };

  const handleSuccessComplete = () => {
    setShowSuccessModal(false);
    setSuccessMessage("");
    setSelectedReportForExport(null);
  };

  const handleBatchToggle = () => {
    setShowOnlyBatch(!showOnlyBatch);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Reports</Text>

        <View style={styles.filtersContainer}>
          {/* Batch Button - Toggle to show only batch reports */}
          <TouchableOpacity
            style={[
              styles.batchButton,
              showOnlyBatch && styles.batchButtonActive,
            ]}
            onPress={handleBatchToggle}
            activeOpacity={1}
          >
            <Text
              style={[
                styles.batchButtonText,
                showOnlyBatch && styles.batchButtonTextActive,
              ]}
            >
              Batch
            </Text>
          </TouchableOpacity>

          {/* Type Dropdown Button */}
          <View style={styles.typeButtonWrapper}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                showTypeDropdown && styles.typeButtonActive,
              ]}
              onPress={() => setShowTypeDropdown(!showTypeDropdown)}
              activeOpacity={1}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  showTypeDropdown && styles.typeButtonTextActive,
                ]}
              >
                Type
              </Text>
              <Icon
                name="chevron-down"
                size={14}
                color={showTypeDropdown ? "#ffffff" : "#1a1a1a"}
              />
            </TouchableOpacity>

            {/* Type Dropdown Menu */}
            {showTypeDropdown && (
              <View style={styles.dropdown}>
                {typeOptions.map((type, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dropdownOption,
                      index === typeOptions.length - 1 &&
                        styles.dropdownOptionLast,
                    ]}
                    onPress={() => {
                      setSelectedType(type);
                      setShowTypeDropdown(false);
                      setShowOnlyBatch(false); // Disable batch filter when selecting type
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        selectedType === type &&
                          styles.dropdownOptionTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Calendar Button */}
          <TouchableOpacity
            style={[
              styles.calendarButton,
              selectedDate && styles.calendarButtonActive,
            ]}
            onPress={handleCalendarPress}
          >
            <Icon
              name="calendar"
              size={18}
              color={selectedDate ? "#ffffff" : "#1a1a1a"}
            />
          </TouchableOpacity>
        </View>
      </View>

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
                Showing reports for {formatDate(selectedDate)}
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

        {/* Generate New Report Button */}
        <Pressable onPress={handleGenerateReport}>
          {({ pressed }) => (
            <View
              style={[
                styles.generateButton,
                pressed && styles.generateButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.generateButtonText,
                  pressed && styles.generateButtonTextPressed,
                ]}
              >
                Generate New Report
              </Text>
            </View>
          )}
        </Pressable>

        {/* Table Container */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.col1]}>
              Report Type
            </Text>
            <Text style={[styles.tableHeaderText, styles.col2]}>
              Date Generated
            </Text>
            <Text style={[styles.tableHeaderText, styles.col3]}>Actions</Text>
          </View>

          {/* Table Rows */}
          {filteredReports.map((report) => (
            <View key={report.id} style={styles.tableRow}>
              <Text style={[styles.tableCellText, styles.col1]}>
                {report.displayName}
              </Text>
              <Text style={[styles.tableCellText, styles.col2]}>
                {formatDate(report.date)}
              </Text>
              <View style={[styles.actionsCell, styles.col3]}>
                <Pressable onPress={() => handleViewReport(report)}>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.viewButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.viewButtonText,
                          pressed && styles.buttonTextPressed,
                        ]}
                      >
                        View Report
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => handleExport(report)}
                  disabled={isExporting}
                >
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.exportButton,
                        pressed && styles.buttonPressed,
                        isExporting && styles.buttonDisabled,
                      ]}
                    >
                      {isExporting &&
                      selectedReportForExport?.id === report.id ? (
                        <ActivityIndicator size="small" color="#3b82f6" />
                      ) : (
                        <Text
                          style={[
                            styles.exportButtonText,
                            pressed && styles.buttonTextPressed,
                          ]}
                        >
                          Export
                        </Text>
                      )}
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          ))}

          {/* Empty State */}
          {filteredReports.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No reports found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Calendar Modal */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelectDate={handleDateSelect}
      />

      {/* Generate Report Modal */}
      <GenerateReportModal
        visible={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleReportGenerated}
        existingBatches={existingBatchNumbers}
      />

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportType}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        message={successMessage}
        onComplete={handleSuccessComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#f8fafc",
    zIndex: 10,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  filtersContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  batchButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  batchButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  batchButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  batchButtonTextActive: {
    color: "#ffffff",
  },
  typeButtonWrapper: {
    position: "relative",
    zIndex: 1000,
  },
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
  },
  typeButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  typeButtonTextActive: {
    color: "#ffffff",
  },
  dropdown: {
    position: "absolute",
    top: 38,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minWidth: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  dropdownOptionTextActive: {
    color: "#3b82f6",
    fontWeight: "700",
  },
  calendarButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  calendarButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  generateButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  generateButtonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  generateButtonTextPressed: {
    color: "#ffffff",
  },
  tableContainer: {
    marginHorizontal: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000000",
  },
  col1: {
    flex: 2.5,
  },
  col2: {
    flex: 2.5,
  },
  col3: {
    flex: 3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
  },
  tableCellText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  actionsCell: {
    flexDirection: "column",
    gap: 8,
  },
  viewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    alignItems: "center",
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  exportButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    alignItems: "center",
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  buttonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  buttonTextPressed: {
    color: "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.5,
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
  dateFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
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
});
