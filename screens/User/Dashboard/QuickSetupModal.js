import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from "react-native";
import { auth } from "../../../config/firebaseconfig";
import { db as firestoreDb } from "../../../config/firebaseconfig";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Get user information from Firestore
 * Retrieves firstName and lastName from users collection
 * Document ID in users collection matches the userId (uid)
 */
const getUserInfo = async (userId) => {
  try {
    const userDocRef = doc(firestoreDb, "users", userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      return {
        firstname: userData.firstName || "Unknown",
        lastname: userData.lastName || "Unknown",
      };
    } else {
      console.warn("[GetUserInfo] User document not found for:", userId);
      return {
        firstname: "Unknown",
        lastname: "Unknown",
      };
    }
  } catch (error) {
    console.error("[GetUserInfo] Error fetching user info:", error);
    return {
      firstname: "Unknown",
      lastname: "Unknown",
    };
  }
};

/**
 * Get the next auto-incremented batch number
 * Queries existing batches and returns max + 1
 */
const getNextBatchNumber = async () => {
  try {
    const q = query(
      collection(firestoreDb, "brooderInfo"),
      orderBy("batchNumber", "desc"),
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return 1; // First batch starts at 1
    }

    const latestBatch = querySnapshot.docs[0].data();
    const nextNumber = (latestBatch.batchNumber || 0) + 1;
    return nextNumber;
  } catch (error) {
    console.error("[GetNextBatchNumber] Error:", error);
    return 1; // Default to 1 if error
  }
};

/**
 * Format current timestamp in GMT+8
 * Returns format: "December 18, 2025 at 2:33:15 PM UTC+8"
 */
const formatGMT8Timestamp = () => {
  const now = new Date();

  // Convert to GMT+8
  const gmtPlus8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };

  const formatted = gmtPlus8.toLocaleString("en-US", options);
  return `${formatted} UTC+8`;
};

/**
 * Get today's date in GMT+8 timezone as YYYY-MM-DD format
 * Used for tracking last increment date
 */
const getTodayDateGMT8 = () => {
  const now = new Date();
  // Convert local time to UTC, then to GMT+8
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt8Ms = utcMs + 8 * 60 * 60 * 1000;
  const gmt8Date = new Date(gmt8Ms);

  const year = gmt8Date.getFullYear();
  const month = String(gmt8Date.getMonth() + 1).padStart(2, "0");
  const day = String(gmt8Date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Get midnight of today in GMT+8 timezone as a Date object
 * Used for batch startDate to prevent immediate age increment
 * Ensures daysDiff = 0 throughout the entire day, so age = daysCount
 */
const getMidnightTodayGMT8 = () => {
  const now = new Date();
  // Convert current time to UTC, then to GMT+8
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt8Ms = utcMs + 8 * 60 * 60 * 1000;
  const gmt8Date = new Date(gmt8Ms);

  const year = gmt8Date.getFullYear();
  const month = String(gmt8Date.getMonth() + 1).padStart(2, "0");
  const day = String(gmt8Date.getDate()).padStart(2, "0");

  // Create midnight UTC for this date, then adjust for GMT+8 offset
  const midnightUTC = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const offset = 8 * 60 * 60 * 1000; // GMT+8 offset in milliseconds

  // Return the UTC time that represents midnight GMT+8
  return new Date(midnightUTC.getTime() - offset);
};

/**
 * Save new batch to Firestore
 * Auto-increments batch number and creates document
 */
const saveBatch = async ({
  chicksCount,
  daysCount,
  harvestDays,
  userId,
  firstname,
  lastname,
}) => {
  try {
    // Get next batch number
    const batchNumber = await getNextBatchNumber();
    const documentId = `Batch ${batchNumber}`;

    // Create batch data object
    const batchData = {
      batchNumber: batchNumber,
      batchNo: batchNumber.toString(), // Store as string for backward compatibility
      initialChicksCount: parseInt(chicksCount), // Original count - editable only before mortality reported
      chicksCount: parseInt(chicksCount), // Current/live count - reduces when mortality reported
      mortalityCount: 0, // Total chicks died - locks editing when > 0
      daysCount: parseInt(daysCount),
      age: parseInt(daysCount), // Store as 'age' for backward compatibility
      harvestDays: parseInt(harvestDays),
      startDate: getMidnightTodayGMT8(), // Store as Firestore Timestamp (midnight GMT+8 to prevent immediate increment)
      startDateFormatted: formatGMT8Timestamp(), // Store formatted version for reference
      lastIncrementDate: getTodayDateGMT8(), // Set to today to prevent immediate increment
      userId: userId,
      firstname: firstname,
      lastname: lastname,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false, // Soft delete flag
    };

    // Save to Firestore
    await setDoc(doc(firestoreDb, "brooderInfo", documentId), batchData);

    console.log("[SaveBatch] Successfully saved batch:", documentId, batchData);
    return { success: true, batchNumber, documentId, batchData };
  } catch (error) {
    console.error("[SaveBatch] Error saving batch:", error);
    throw error;
  }
};

/**
 * Log event to activity_logs collection
 * Records user actions for audit trail
 * Stores in: activity_logs/addBatch_logs/events
 */
const logSessionEvent = async (userId, firstName, lastName, batchNumber) => {
  try {
    const eventData = {
      userId: userId,
      action: `Added Batch ${batchNumber}`,
      description: `Batch ${batchNumber} added`,
      timestamp: serverTimestamp(),
      deviceInfo: Platform.OS,
      firstName: firstName,
      lastName: lastName,
    };

    // Add document to activity_logs/addBatch_logs/events subcollection
    const docRef = await addDoc(
      collection(firestoreDb, "activity_logs", "addBatch_logs", "events"),
      eventData,
    );

    console.log("[LogSessionEvent] Event logged successfully:", docRef.id);
    return { success: true, logId: docRef.id };
  } catch (error) {
    console.error("[LogSessionEvent] Error logging event:", error);
    // Don't throw - logging failure shouldn't block batch creation
    return { success: false, error: error.message };
  }
};

export default function QuickSetupModal({
  visible,
  onSaveChicksCount,
  onSaveDaysCount,
  onSaveHarvestDays,
  onSaveBatch,
  onClose,
  batches = [], // Pass batches from Home.js
}) {
  // Never show '0' in the textbox, only show placeholder if value is empty or zero
  const sanitizeInput = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === "number" && val === 0) return "";
    if (typeof val === "string" && (val.trim() === "0" || val.trim() === ""))
      return "";
    return String(val);
  };
  const [batchNo, setBatchNo] = useState("");
  const [chicksCount, setChicksCount] = useState("");
  const [daysCount, setDaysCount] = useState("");
  const [harvestDays, setHarvestDays] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [chicksError, setChicksError] = useState("");
  const [daysError, setDaysError] = useState("");
  const [harvestError, setHarvestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Check if all fields are valid and filled
  const isFormValid =
    batchNo.trim() !== "" &&
    chicksCount.trim() !== "" &&
    daysCount.trim() !== "" &&
    harvestDays.trim() !== "" &&
    !chicksError &&
    !daysError &&
    !harvestError &&
    parseInt(chicksCount) > 0 &&
    parseInt(daysCount) > 0 &&
    parseInt(harvestDays) > 0 &&
    parseInt(daysCount) < parseInt(harvestDays);

  useEffect(() => {
    if (visible) {
      // Calculate next batch number from existing batches
      const existingBatchNos = batches
        .map((b) => parseInt(b.batchNo, 10))
        .filter((n) => !isNaN(n));
      const maxBatchNo =
        existingBatchNos.length > 0 ? Math.max(...existingBatchNos) : 0;
      const nextBatchNo = maxBatchNo + 1;

      setBatchNo(nextBatchNo.toString());

      // Reset other fields
      setChicksCount("");
      setDaysCount("");
      setHarvestDays("");
      setChicksError("");
      setDaysError("");
      setHarvestError("");
    }
  }, [visible, batches]);

  // Re-validate days when harvest days changes
  useEffect(() => {
    if (
      daysCount &&
      parseInt(daysCount) > 0 &&
      harvestDays &&
      parseInt(harvestDays) > 0
    ) {
      const daysValue = parseInt(daysCount);
      const harvestValue = parseInt(harvestDays);

      // Re-check the validation
      let errors = [];
      if (daysValue > 45) {
        errors.push("Number of days cannot exceed 45");
      }
      if (daysValue >= harvestValue) {
        errors.push("Age must be less than expected harvest days");
      }
      setDaysError(errors.length > 0 ? errors[0] : "");
    }
  }, [harvestDays]);

  // Re-validate harvest days when days changes
  useEffect(() => {
    if (
      harvestDays &&
      parseInt(harvestDays) > 0 &&
      daysCount &&
      parseInt(daysCount) > 0
    ) {
      const harvestValue = parseInt(harvestDays);
      const daysValue = parseInt(daysCount);

      // Re-check the validation
      let errors = [];
      if (harvestValue > 365) {
        errors.push("Expected harvest days cannot exceed 365");
      }
      if (harvestValue <= daysValue) {
        errors.push("Expected harvest days must be greater than current days");
      }
      setHarvestError(errors.length > 0 ? errors[0] : "");
    }
  }, [daysCount]);

  const handleChicksChange = (text) => {
    // Only allow numeric input, never show '0'
    const numericText = text.replace(/[^0-9]/g, "");
    const numValue = parseInt(numericText);
    if (numericText === "" || numericText === "0") {
      setChicksCount("");
      setChicksError("");
    } else if (numValue > 0) {
      setChicksCount(numericText);
      // Show error if exceeds 100
      if (numValue > 100) {
        setChicksError("Number of chicks cannot exceed 100");
      } else {
        setChicksError("");
      }
    }
  };

  const handleDaysChange = (text) => {
    // Only allow numeric input, never show '0'
    const numericText = text.replace(/[^0-9]/g, "");
    const numValue = parseInt(numericText);
    if (numericText === "" || numericText === "0") {
      setDaysCount("");
      setDaysError("");
    } else if (numValue > 0) {
      setDaysCount(numericText);
      let errors = [];
      // Check if exceeds 45
      if (numValue > 45) {
        errors.push("Number of days cannot exceed 45");
      }
      // Check if days equals or exceeds harvest days (if harvest is set)
      if (harvestDays && parseInt(harvestDays) > 0) {
        if (numValue >= parseInt(harvestDays)) {
          errors.push("Age must be less than expected harvest days");
        }
      }
      setDaysError(errors.length > 0 ? errors[0] : "");
    } else {
      // Handle invalid input
      setDaysError("");
    }
  };

  const handleHarvestChange = (text) => {
    // Only allow numeric input, never show '0'
    const numericText = text.replace(/[^0-9]/g, "");
    const numValue = parseInt(numericText);
    if (numericText === "" || numericText === "0") {
      setHarvestDays("");
      setHarvestError("");
    } else if (numValue > 0) {
      setHarvestDays(numericText);
      let errors = [];
      // Check if exceeds 365
      if (numValue > 365) {
        errors.push("Expected harvest days cannot exceed 365");
      }
      // Check if harvest days is less than or equal to current days (if days is set)
      if (daysCount && parseInt(daysCount) > 0) {
        if (numValue <= parseInt(daysCount)) {
          errors.push(
            "Expected harvest days must be greater than current days",
          );
        }
      }
      setHarvestError(errors.length > 0 ? errors[0] : "");
    } else {
      // Handle invalid input
      setHarvestError("");
    }
  };

  const handleSave = async () => {
    // Prevent multiple clicks
    if (isSaving) return;

    // Validate that days is strictly less than harvest days
    const daysValue = parseInt(daysCount);
    const harvestValue = parseInt(harvestDays);

    if (daysValue >= harvestValue) {
      Alert.alert(
        "Invalid Input",
        "Age must be less than expected harvest days.\n\nPlease check your entries and try again.",
      );
      return;
    }

    // Get current user info
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "User not authenticated. Please log in.");
      return;
    }

    // Set saving state to prevent multiple clicks
    setIsSaving(true);

    try {
      // Store userInfo in a variable so it's accessible in promise chain
      let userInfo = null;

      // Fetch user info from Firestore
      const userInfoData = await getUserInfo(currentUser.uid);
      userInfo = userInfoData;

      // Prepare batch data with Firestore user info
      const batchData = {
        chicksCount: chicksCount.trim(),
        daysCount: daysCount.trim(),
        harvestDays: harvestDays.trim(),
        userId: currentUser.uid,
        firstname: userInfo.firstname,
        lastname: userInfo.lastname,
      };

      // Save to Firestore
      const result = await saveBatch(batchData);
      console.log("[HandleSave] Batch saved to Firestore:", result);

      // Log the event to session_logs
      logSessionEvent(
        currentUser.uid,
        userInfo.firstname,
        userInfo.lastname,
        result.batchNumber,
      );

      // Call the original batch save callback for backward compatibility (AsyncStorage)
      if (onSaveBatch) {
        onSaveBatch({
          batchNo: result.batchNumber.toString(),
          chicksCount: chicksCount.trim(),
          daysCount: daysCount.trim(),
          harvestDays: harvestDays.trim(),
        });
      }

      // Show success modal
      setShowSuccess(true);

      // Reset all fields after save
      setBatchNo("");
      setChicksCount("");
      setChicksError("");
      setDaysCount("");
      setDaysError("");
      setHarvestDays("");
      setHarvestError("");

      // Close after 2 seconds
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error("[HandleSave] Error:", error);
      Alert.alert(
        "Error",
        "Failed to save batch. Please try again.\n" + error.message,
      );
    } finally {
      // Re-enable the save button
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={handleClose}
        activeOpacity={1}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Close Button X */}
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Quick Overview Setup</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Batch ID</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={batchNo ? `Batch ${batchNo}` : ""}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Chicks </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of chicks"
              placeholderTextColor="#9ca3af"
              value={sanitizeInput(chicksCount)}
              onChangeText={handleChicksChange}
              keyboardType="numeric"
              maxLength={5}
            />
            {chicksError ? (
              <Text style={styles.errorText}>{chicksError}</Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age in Days</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current chick age (-45)"
              placeholderTextColor="#9ca3af"
              value={sanitizeInput(daysCount)}
              onChangeText={handleDaysChange}
              keyboardType="numeric"
              maxLength={5}
            />
            {daysError ? (
              <Text style={styles.errorText}>{daysError}</Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Expected Harvest (days)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter harvest days"
              placeholderTextColor="#9ca3af"
              value={sanitizeInput(harvestDays)}
              onChangeText={handleHarvestChange}
              keyboardType="numeric"
              maxLength={5}
            />
            {harvestError ? (
              <Text style={styles.errorText}>{harvestError}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!isFormValid || isSaving) && styles.saveButtonDisabled,
            ]}
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={!isFormValid || isSaving}
          >
            <Text
              style={[
                styles.saveButtonText,
                (!isFormValid || isSaving) && styles.saveButtonTextDisabled,
              ]}
            >
              {isSaving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </Pressable>

        {/* Success Modal */}
        <Modal visible={showSuccess} transparent animationType="fade">
          <View style={styles.successModalOverlay}>
            <View style={styles.successModalCard}>
              <Image
                source={{
                  uri: "https://img.icons8.com/color/96/checked--v1.png",
                }}
                style={styles.successIcon}
              />
              <Text style={styles.successTitle}>Successfully Saved!</Text>
            </View>
          </View>
        </Modal>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "90%",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 20,
    color: "#64748b",
    fontWeight: "400",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#0f172a",
    paddingRight: 40,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#000000ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  readOnlyInput: {
    backgroundColor: "#f1f5f9",
    color: "#64748b",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: "#154b99",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderColor: "#2563eb",
    borderWidth: 1,
  },
  saveButtonDisabled: {
    backgroundColor: "#9ca3af",
    borderColor: "#9ca3af",
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  saveButtonTextDisabled: {
    color: "#e5e7eb",
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModalCard: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
  },
  successIcon: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2E7D32",
  },
});
