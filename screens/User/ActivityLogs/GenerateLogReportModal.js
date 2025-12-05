import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import CalendarModal from "../../navigation/CalendarModal";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import { auth, db } from "../../../config/firebaseconfig";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const Icon = Feather;

export default function GenerateLogReportModal({
  visible,
  onClose,
  onGenerate,
  logs = [], // Array of log objects to include in the PDF
}) {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}-${day}-${year}`;
  };

  const formatFullDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
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

  const sanitizeFileName = (name) => {
    // Remove special characters and replace spaces with underscores
    return name.replace(/[^a-zA-Z0-9]/g, "_");
  };

  const filterLogsByDateRange = () => {
    return logs.filter((log) => {
      if (!log.timestamp) return false;

      let logDate;
      if (log.timestamp.toDate && typeof log.timestamp.toDate === "function") {
        logDate = log.timestamp.toDate();
      } else if (typeof log.timestamp === "string") {
        logDate = new Date(log.timestamp);
      } else if (log.timestamp instanceof Date) {
        logDate = log.timestamp;
      } else {
        return false;
      }

      // Set times to start of day for comparison
      const logDateOnly = new Date(
        logDate.getFullYear(),
        logDate.getMonth(),
        logDate.getDate()
      );
      const startDateOnly = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      const endDateOnly = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );

      return logDateOnly >= startDateOnly && logDateOnly <= endDateOnly;
    });
  };

  const formatLogDate = (timestamp) => {
    if (!timestamp) return "N/A";

    let date;
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return "N/A";
    }

    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const month = String(gmt8Date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(gmt8Date.getUTCDate()).padStart(2, "0");
    const year = gmt8Date.getUTCFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatLogTime = (timestamp) => {
    if (!timestamp) return "N/A";

    let date;
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return "N/A";
    }

    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const hours = gmt8Date.getUTCHours();
    const minutes = gmt8Date.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  };

  const getLogoBase64 = async () => {
    try {
      // Use require to get the asset
      const logoUri = Asset.fromModule(require("../../../assets/logo.png")).uri;

      // Download the asset if needed
      const asset = Asset.fromModule(require("../../../assets/logo.png"));
      if (!asset.downloaded) {
        await asset.downloadAsync();
      }

      // Copy to cache and read as base64
      const fileUri = `${FileSystem.cacheDirectory}logo-temp.png`;
      await FileSystem.copyAsync({
        from: asset.localUri,
        to: fileUri,
      });

      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Clean up temp file
      await FileSystem.deleteAsync(fileUri, { idempotent: true });

      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error("Error loading logo:", error);
      // Return a fallback placeholder if logo fails to load
      return "https://via.placeholder.com/150x50/133E87/FFFFFF?text=Internet+of+Tsiken";
    }
  };

  const generateHTMLContent = async (userName) => {
    const filteredLogs = filterLogsByDateRange();

    const tableRows = filteredLogs
      .map(
        (log) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${formatLogDate(log.timestamp)}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${formatLogTime(log.timestamp)}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${
          log.firstName && log.lastName
            ? `${log.firstName} ${log.lastName}`
            : log.firstName || log.userName || log.userEmail || "N/A"
        }</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${log.action || "N/A"}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${log.description || "N/A"}</td>
      </tr>
    `
      )
      .join("");

    // Get company logo as base64
    const companyLogoUrl = await getLogoBase64();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #1a1a1a;
            }
            .header {
              display: flex;
              align-items: center;
              gap: 15px;
              margin-bottom: 30px;
              padding-bottom: 15px;
              border-bottom: 2px solid #133E87;
            }
            .header-logo {
              height: 50px;
              width: auto;
            }
            .header-company-name {
              font-size: 22px;
              font-weight: 700;
              color: #133E87;
              margin: 0;
            }
            h1 {
              color: #133E87;
              font-size: 18px;
              margin-bottom: 10px;
              margin-top: 20px;
            }
            .info {
              margin-bottom: 15px;
              font-size: 12px;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #f8fafc;
              padding: 10px;
              border: 1px solid #e5e7eb;
              font-size: 12px;
              font-weight: 700;
              text-align: left;
            }
            td {
              padding: 8px;
              border: 1px solid #e5e7eb;
              font-size: 11px;
            }
            .footer {
              margin-top: 30px;
              font-size: 10px;
              color: #94a3b8;
              text-align: center;
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
          <h1>Log Report of ${userName} as of ${formatTimestampGMT8()}</h1>
          <div class="info">
            <strong>Date Range:</strong> ${formatFullDate(startDate)} - ${formatFullDate(endDate)}
          </div>
          <div class="info">
            <strong>Total Logs:</strong> ${filteredLogs.length}
          </div>

          <!-- Log Table -->
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 20px;">No logs found for this date range</td></tr>'}
            </tbody>
          </table>

          <!-- Footer -->
          <div class="footer">
            Generated on ${formatTimestampGMT8()} (GMT+8)
          </div>
        </body>
      </html>
    `;
  };

  const handleGenerate = async () => {
    if (endDate < startDate) {
      Alert.alert("Invalid Date Range", "End date must be after start date");
      return;
    }

    setIsGenerating(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "No user logged in");
        setIsGenerating(false);
        return;
      }

      // Fetch user's first name and last name
      let userName = "User";
      let firstName = "";
      let lastName = "";
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          firstName = userData.firstName || "";
          lastName = userData.lastName || "";
          userName =
            firstName && lastName
              ? `${firstName} ${lastName}`
              : firstName ||
                lastName ||
                user.displayName ||
                user.email ||
                "User";
        } else {
          userName = user.displayName || user.email || "User";
        }
      } catch (fetchErr) {
        console.error("Failed to fetch user data:", fetchErr);
        userName = user.displayName || user.email || "User";
      }

      // Generate HTML content
      const htmlContent = await generateHTMLContent(userName);

      // Generate filename with user's name and GMT+8 timestamp
      const timestamp = getFileNameTimestamp();
      const sanitizedFirstName = sanitizeFileName(firstName || "User");
      const sanitizedLastName = sanitizeFileName(lastName || "");
      const namePrefix = sanitizedLastName
        ? `${sanitizedFirstName}_${sanitizedLastName}`
        : sanitizedFirstName;
      const fileName = `LogReport_${namePrefix}_${timestamp}.pdf`;

      // Create PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      console.log("PDF generated at:", uri);

      // Check if sharing is available
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert("Error", "Sharing is not available on this device");
        setIsGenerating(false);
        return;
      }

      // Share/save the PDF
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Save Log Report",
        UTI: "com.adobe.pdf",
      });

      console.log("PDF shared successfully");

      // Show saved popup
      setShowSavedPopup(true);
      setTimeout(() => {
        setShowSavedPopup(false);
      }, 2000);

      // Call the original onGenerate callback
      if (onGenerate) {
        onGenerate({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        });
      }

      setIsGenerating(false);
      handleClose();
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF: " + error.message);
      setIsGenerating(false);
    }
  };

  const handleStartDateSelect = (date) => {
    setStartDate(date);
  };

  const handleEndDateSelect = (date) => {
    setEndDate(date);
  };

  const resetForm = () => {
    setStartDate(new Date());
    setEndDate(new Date());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Log Report</Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <Icon name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Start Date Section */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowStartCalendar(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.inputText}>{formatDate(startDate)}</Text>
                  <Icon name="calendar" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* End Date Section */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowEndCalendar(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.inputText}>{formatDate(endDate)}</Text>
                  <Icon name="calendar" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Generate Button */}
              <Pressable onPress={handleGenerate} disabled={isGenerating}>
                {({ pressed }) => (
                  <View
                    style={[
                      styles.generateButtonInner,
                      pressed && styles.generateButtonPressed,
                      isGenerating && styles.generateButtonDisabled,
                    ]}
                  >
                    {isGenerating ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#ffffff" />
                        <Text style={styles.generateButtonText}>
                          Generating PDF...
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.generateButtonText,
                          pressed && styles.generateButtonTextPressed,
                        ]}
                      >
                        Generate Log Report
                      </Text>
                    )}
                  </View>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Start Date Calendar Modal */}
      <CalendarModal
        visible={showStartCalendar}
        onClose={() => setShowStartCalendar(false)}
        onSelectDate={handleStartDateSelect}
      />

      {/* End Date Calendar Modal */}
      <CalendarModal
        visible={showEndCalendar}
        onClose={() => setShowEndCalendar(false)}
        onSelectDate={handleEndDateSelect}
      />

      {/* Saved Popup Modal */}
      <Modal
        key="savePopupModal"
        visible={showSavedPopup}
        transparent
        animationType="fade"
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Image
              source={require("../../../assets/logo.png")}
              style={{ width: 56, height: 56 }}
            />
            <Text style={styles.popupText}>Generated Successfully!</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    padding: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputText: {
    fontSize: 14,
    color: "#1a1a1a",
    flex: 1,
  },
  generateButtonInner: {
    backgroundColor: "#154b99",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3b82f6",
    marginTop: 8,
  },
  generateButtonPressed: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  generateButtonDisabled: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e5e7eb",
    opacity: 0.6,
  },
  generateButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  generateButtonTextPressed: {
    color: "#ffffff",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  popupBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupBox: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  popupText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
});
