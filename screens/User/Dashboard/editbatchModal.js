import React, { useEffect, useState, useRef } from "react";
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
  doc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Update batch in Firestore
 * Updates chicksCount, daysCount, harvestDays and initialChicksCount (if no mortality)
 */
const updateBatchInFirestore = async (batchId, updates, currentBatch) => {
  try {
    const batchDocRef = doc(firestoreDb, "brooderInfo", batchId);

    // Prepare update object
    const updateData = {
      chicksCount: parseInt(updates.chicksCount),
      daysCount: parseInt(updates.daysCount),
      age: parseInt(updates.daysCount), // Store as 'age' for backward compatibility
      harvestDays: parseInt(updates.harvestDays),
      updatedAt: new Date(),
    };

    // When updating chicksCount, also update initialChicksCount if no mortality reported
    if (currentBatch && (currentBatch.mortalityCount || 0) === 0) {
      // Sync initialChicksCount with the new chicksCount value
      updateData.initialChicksCount = parseInt(updates.chicksCount);
    }

    // Update the batch document
    await updateDoc(batchDocRef, updateData);

    console.log(
      "[UpdateBatch] Successfully updated batch:",
      batchId,
      updateData,
    );
    return { success: true, batchId, updates: updateData };
  } catch (error) {
    console.error("[UpdateBatch] Error updating batch:", error);
    throw error;
  }
};

/**
 * Log edit event to activity_logs collection
 * Records batch edit actions for audit trail with change details
 * Stores in: activity_logs/editBatch_logs/events
 */
const logEditEvent = async (
  userId,
  firstName,
  lastName,
  batchId,
  batchNumber,
  changes = undefined,
) => {
  try {
    const eventData = {
      userId: userId,
      batchId: batchId,
      action: `Updated Batch ${batchNumber}`,
      description: `Batch ${batchNumber} information updated`,
      timestamp: serverTimestamp(),
      deviceInfo: Platform.OS,
      firstName: firstName,
      lastName: lastName,
      ...(changes && { changes: changes }), // Include changes array if provided
    };

    // Add document to activity_logs/editBatch_logs/events subcollection
    const docRef = await addDoc(
      collection(firestoreDb, "activity_logs", "editBatch_logs", "events"),
      eventData,
    );

    console.log("[LogEditEvent] Event logged successfully:", docRef.id);
    return { success: true, logId: docRef.id };
  } catch (error) {
    console.error("[LogEditEvent] Error logging event:", error);
    // Don't throw - logging failure shouldn't block batch editing
    return { success: false, error: error.message };
  }
};

/**
 * Get user information from Firestore
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

export default function EditBatchModal({
  visible,
  batchData = null,
  onSaveChanges,
  onBatchUpdated,
  onClose,
}) {
  const [chicksCount, setChicksCount] = useState("");
  const [daysCount, setDaysCount] = useState("");
  const [harvestDays, setHarvestDays] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [chicksError, setChicksError] = useState("");
  const [daysError, setDaysError] = useState("");
  const [harvestError, setHarvestError] = useState("");
  const isInitializedRef = useRef(false);

  // Check if all fields are valid and filled
  const isFormValid =
    chicksCount.trim() !== "" &&
    daysCount.trim() !== "" &&
    harvestDays.trim() !== "" &&
    !chicksError &&
    !daysError &&
    !harvestError &&
    parseInt(chicksCount) > 0 &&
    parseInt(daysCount) > 0 &&
    parseInt(harvestDays) > 0;

  // Initialize form only when modal opens, not when batchData changes
  useEffect(() => {
    if (visible && batchData && !isInitializedRef.current) {
      setChicksCount(String(batchData.chicksCount ?? ""));
      setDaysCount(String(batchData.daysCount ?? ""));
      setHarvestDays(String(batchData.harvestDays ?? ""));
      // Reset errors when modal opens
      setChicksError("");
      setDaysError("");
      setHarvestError("");
      isInitializedRef.current = true;
    }
  }, [visible]);

  // Reset initialization flag when modal closes
  useEffect(() => {
    if (!visible) {
      isInitializedRef.current = false;
    }
  }, [visible]);

  const handleChicksChange = (text) => {
    // Only allow numeric input, max 100
    const numericText = text.replace(/[^0-9]/g, "");
    const numValue = parseInt(numericText);

    if (numericText === "") {
      setChicksCount(numericText);
      setChicksError("");
    } else if (numValue >= 0 && numValue <= 100) {
      setChicksCount(numericText);
      setChicksError("");
    } else {
      setChicksError("Number of chicks cannot exceed 100");
    }
  };

  const handleDaysChange = (text) => {
    // Only allow numeric input, max 365
    const numericText = text.replace(/[^0-9]/g, "");
    const numValue = parseInt(numericText);

    if (numericText === "") {
      setDaysCount(numericText);
      setDaysError("");
    } else if (numValue >= 0 && numValue <= 365) {
      setDaysCount(numericText);
      // Check if days exceeds harvest days (if harvest is set)
      if (harvestDays && parseInt(harvestDays) > 0) {
        if (numValue > parseInt(harvestDays)) {
          setDaysError("Number of days cannot exceed expected harvest days");
        } else {
          setDaysError("");
        }
      } else {
        setDaysError("");
      }
    } else {
      setDaysError("Number of days cannot exceed 365");
    }
  };

  const handleHarvestChange = (text) => {
    // Only allow numeric input, max 365
    const numericText = text.replace(/[^0-9]/g, "");
    const numValue = parseInt(numericText);

    if (numericText === "") {
      setHarvestDays(numericText);
      setHarvestError("");
    } else if (numValue >= 0 && numValue <= 365) {
      setHarvestDays(numericText);
      // Check if harvest days is less than current days (if days is set)
      if (daysCount && parseInt(daysCount) > 0) {
        if (numValue < parseInt(daysCount)) {
          setHarvestError(
            "Expected harvest days cannot be less than current days",
          );
        } else {
          setHarvestError("");
        }
      } else {
        setHarvestError("");
      }
    } else {
      setHarvestError("Expected harvest days cannot exceed 365");
    }
  };

  // ==================== RELOAD BATCH FROM FIRESTORE ====================
  /**
   * After saving changes, fetch fresh batch from Firestore with calculated age
   * and notify parent component via onBatchUpdated callback
   */
  const reloadBrooderFromFirestore = async (batchId) => {
    try {
      console.log("[ReloadBrooder] Fetching fresh batch:", batchId);

      const docRef = doc(firestoreDb, "brooderInfo", batchId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.error("[ReloadBrooder] Batch not found:", batchId);
        return null;
      }

      const data = docSnap.data();

      // Calculate age dynamically
      const calculateAge = (startDate, daysCount) => {
        try {
          if (!startDate || !daysCount) return 0;

          let startDateObj;
          if (startDate?.toDate) {
            startDateObj = startDate.toDate();
          } else if (startDate instanceof Date) {
            startDateObj = startDate;
          } else if (typeof startDate === "string") {
            startDateObj = new Date(startDate);
          } else {
            return parseInt(daysCount) || 0;
          }

          const today = new Date();
          const daysDiff = Math.floor(
            (today - startDateObj) / (1000 * 60 * 60 * 24),
          );
          const calculatedAge = daysDiff + parseInt(daysCount);

          return Math.max(0, calculatedAge);
        } catch (error) {
          console.error("[CalculateAge] Error:", error);
          return parseInt(daysCount) || 0;
        }
      };

      const freshBatch = {
        id: docSnap.id,
        ...data,
        daysCount: calculateAge(data.startDate, data.daysCount),
      };

      console.log("[ReloadBrooder] Fresh batch loaded:", freshBatch);

      // Call parent callback with fresh batch
      if (onBatchUpdated) {
        onBatchUpdated(freshBatch);
      }

      return freshBatch;
    } catch (error) {
      console.error("[ReloadBrooder] Error reloading batch:", error);
      return null;
    }
  };

  const handleSave = () => {
    // Validate that days does not exceed harvest days
    const daysValue = parseInt(daysCount);
    const harvestValue = parseInt(harvestDays);

    if (daysValue > harvestValue) {
      Alert.alert(
        "Invalid Input",
        "Number of days cannot be greater than expected harvest days.\n\nPlease check your entries and try again.",
      );
      setDaysError("Number of days cannot exceed expected harvest days");
      return;
    }

    // Get current user info
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "User not authenticated. Please log in.");
      return;
    }

    // Batch ID should be passed via batchData
    const batchId = batchData?.id;
    if (!batchId) {
      Alert.alert("Error", "Batch ID not found. Unable to save changes.");
      return;
    }

    // Prepare updates
    const updates = {
      chicksCount: chicksCount.trim(),
      daysCount: daysCount.trim(),
      harvestDays: harvestDays.trim(),
    };

    // Store userInfo in a variable
    let userInfo = null;

    // Fetch user info from Firestore
    getUserInfo(currentUser.uid)
      .then((userInfoData) => {
        // Store userInfo for later use
        userInfo = userInfoData;

        // Update batch in Firestore (pass currentBatch so function can check mortalityCount)
        return updateBatchInFirestore(batchId, updates, batchData);
      })
      .then((result) => {
        console.log("[HandleSave] Batch updated in Firestore:", result);

        // Log the edit event with batch number and changes
        const batchNumber =
          batchData?.batchNumber || batchData?.batchNo || "Unknown";

        // Track which fields were changed
        const changes = [];
        if (parseInt(chicksCount) !== batchData?.chicksCount) {
          changes.push(`Chicks: ${batchData?.chicksCount} → ${chicksCount}`);
        }
        if (parseInt(daysCount) !== batchData?.daysCount) {
          changes.push(`Days: ${batchData?.daysCount} → ${daysCount}`);
        }
        if (parseInt(harvestDays) !== batchData?.harvestDays) {
          changes.push(
            `Harvest Days: ${batchData?.harvestDays} → ${harvestDays}`,
          );
        }

        logEditEvent(
          currentUser.uid,
          userInfo.firstname,
          userInfo.lastname,
          batchId,
          batchNumber,
          changes.length > 0 ? changes : undefined,
        );

        // Call the original callback for backward compatibility (AsyncStorage)
        onSaveChanges?.(updates);

        // Reload fresh batch from Firestore and notify parent
        return reloadBrooderFromFirestore(batchId);
      })
      .then(() => {
        // Show success modal
        setShowSuccess(true);

        // Close after 2 seconds
        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 2000);
      })
      .catch((error) => {
        console.error("[HandleSave] Error:", error);
        Alert.alert(
          "Error",
          "Failed to save changes. Please try again.\n" + error.message,
        );
      });
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

          <Text style={styles.sectionTitle}>Edit Batch Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Chicks</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of chicks"
              placeholderTextColor="#9ca3af"
              value={chicksCount}
              onChangeText={handleChicksChange}
              keyboardType="numeric"
            />
            {chicksError ? (
              <Text style={styles.errorText}>{chicksError}</Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Days</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of days"
              placeholderTextColor="#9ca3af"
              value={daysCount}
              onChangeText={handleDaysChange}
              keyboardType="numeric"
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
              value={harvestDays}
              onChangeText={handleHarvestChange}
              keyboardType="numeric"
            />
            {harvestError ? (
              <Text style={styles.errorText}>{harvestError}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              !isFormValid && styles.saveButtonDisabled,
            ]}
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={!isFormValid}
          >
            <Text
              style={[
                styles.saveButtonText,
                !isFormValid && styles.saveButtonTextDisabled,
              ]}
            >
              Save Changes
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
              <Text style={styles.successTitle}>Changes Saved!</Text>
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
