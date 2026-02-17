import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  collection,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db as firestoreDb } from "../../../config/firebaseconfig";
import { auth } from "../../../config/firebaseconfig";
import { Alert, Platform } from "react-native";

/**
 * Calculate brooder age dynamically
 * Formula: (today - startDate in days) + daysCount
 * @param {Date|Timestamp|string} startDate - Batch start date (multiple formats supported)
 * @param {number} daysCount - Initial age when batch was created
 * @returns {number} Calculated age in days
 */
export const calculateAge = (startDate, daysCount) => {
  try {
    if (!startDate || !daysCount) return 0;

    let startDateObj;

    // Handle Firestore Timestamp
    if (startDate?.toDate) {
      startDateObj = startDate.toDate();
    }
    // Handle Date object
    else if (startDate instanceof Date) {
      startDateObj = startDate;
    }
    // Handle ISO string
    else if (typeof startDate === "string") {
      startDateObj = new Date(startDate);
    } else {
      return parseInt(daysCount) || 0;
    }

    const today = new Date();
    const daysDiff = Math.floor((today - startDateObj) / (1000 * 60 * 60 * 24));
    const calculatedAge = daysDiff + parseInt(daysCount);

    return Math.max(0, calculatedAge); // Prevent negative ages
  } catch (error) {
    console.error("[CalculateAge] Error calculating age:", error);
    return parseInt(daysCount) || 0;
  }
};

/**
 * Delete a batch document from Firestore "brooderInfo" collection
 * @param {string} batchId - The document ID of the batch to delete
 * @returns {Promise<void>}
 * @throws {Error} If Firestore delete fails
 */
export const deleteBatch = async (batchId) => {
  try {
    console.log("[DeleteBatch] Deleting batch:", batchId);

    if (!batchId) {
      throw new Error("Batch ID is required for deletion");
    }

    const batchDocRef = doc(firestoreDb, "brooderInfo", batchId);
    await deleteDoc(batchDocRef);

    console.log("[DeleteBatch] Batch successfully deleted:", batchId);
  } catch (error) {
    console.error("[DeleteBatch] Error deleting batch:", error);
    throw error;
  }
};

/**
 * Log delete event to activity_logs collection
 * Records batch deletion actions for audit trail
 * Stores in: activity_logs/deleteBatch_logs/events
 */
const logDeleteEvent = async (
  userId,
  firstName,
  lastName,
  batchId,
  batchNumber,
) => {
  try {
    const eventData = {
      userId: userId,
      batchId: batchId,
      action: "Batch deleted",
      description: `Batch ${batchNumber} deleted`,
      timestamp: serverTimestamp(),
      deviceInfo: Platform.OS,
      firstName: firstName,
      lastName: lastName,
    };

    // Add document to activity_logs/deleteBatch_logs/events subcollection
    const docRef = await addDoc(
      collection(firestoreDb, "activity_logs", "deleteBatch_logs", "events"),
      eventData,
    );

    console.log("[LogDeleteEvent] Event logged successfully:", docRef.id);
    return { success: true, logId: docRef.id };
  } catch (error) {
    console.error("[LogDeleteEvent] Error logging event:", error);
    // Don't throw - logging failure shouldn't block batch deletion
    return { success: false, error: error.message };
  }
};

/**
 * Get user information from Firestore
 */
const getUserInfo = async (userId) => {
  try {
    const { getDoc } = require("firebase/firestore");
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
 * Fetch all batch documents from Firestore "brooderInfo" collection with dynamic age calculation
 *
 * Maps Firestore document fields to expected format:
 * - batchNo → batchNumber
 * - chicksCount → chicksCount
 * - startDate + daysCount → calculated daysCount (dynamic age)
 * - harvestDays → harvestDays
 * - startDate → startDate
 * - id → id (document ID for reference)
 *
 * @returns {Promise<Array>} Array of batch objects with keys:
 *          { id, batchNumber, chicksCount, daysCount, harvestDays, startDate }
 * @throws {Error} If Firestore query fails
 */
export const fetchBatches = async () => {
  try {
    console.log("[FetchBatches] Starting to fetch batches from Firestore...");

    // Query brooderInfo collection ordered by startDate descending
    const q = query(
      collection(firestoreDb, "brooderInfo"),
      orderBy("startDate", "desc"),
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("[FetchBatches] No batches found in Firestore");
      return [];
    }

    // Map Firestore documents to batch array with dynamic age calculation
    const batchesArray = querySnapshot.docs
      .map((doc) => {
        const data = doc.data();

        // Skip deleted batches
        if (data.deleted) {
          return null;
        }

        // Auto-calculate daysCount using dynamic age calculation
        const calculatedDaysCount = calculateAge(
          data.startDate,
          data.daysCount,
        );

        return {
          id: doc.id,
          batchNumber: data.batchNo || data.batchNumber || "-",
          chicksCount: data.chicksCount || 0,
          daysCount: calculatedDaysCount, // Dynamically calculated age
          age: calculatedDaysCount, // Also provide as 'age' for compatibility
          originalDaysCount: data.daysCount, // Store original value from Firestore
          harvestDays: data.harvestDays || 0,
          startDate: data.startDate,
          // Keep original data for reference
          ...data,
        };
      })
      .filter((batch) => batch !== null); // Remove deleted batches

    console.log("[FetchBatches] Total batches fetched:", batchesArray.length);
    return batchesArray;
  } catch (error) {
    console.error(
      "[FetchBatches] Error fetching batches from Firestore:",
      error,
    );
    throw error;
  }
};

export default function ViewAllBatchesModal({
  visible,
  batches,
  selectedBatchIndex,
  preSelectedBatchId = null,
  onSelectBatch,
  onDeleteBatch,
  onEditBatch,
  onClose,
}) {
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [showDeleteError, setShowDeleteError] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [recalculatedBatches, setRecalculatedBatches] = useState(batches);
  const [highlightedBatchId, setHighlightedBatchId] =
    useState(preSelectedBatchId);
  const scrollViewRef = React.useRef(null);

  // Recalculate ages only when modal becomes visible
  // This ensures we get fresh calculation from original daysCount in Firestore data
  React.useEffect(() => {
    if (visible && batches.length > 0) {
      // Only recalculate if batches contain originalDaysCount (not already calculated)
      // Otherwise use batches as-is to avoid double calculation
      const updatedBatches = batches.map((batch) => {
        // If batch has originalDaysCount, it means it was freshly fetched from Firestore
        // In that case, recalculate to account for time elapsed since fetch
        if (batch.originalDaysCount !== undefined && batch.startDate) {
          const calculatedDays = calculateAge(
            batch.startDate,
            batch.originalDaysCount,
          );

          return {
            ...batch,
            daysCount: calculatedDays,
            age: calculatedDays,
          };
        }
        // Otherwise, return batch as-is (already calculated correctly)
        return batch;
      });
      setRecalculatedBatches(updatedBatches);
    } else {
      setRecalculatedBatches(batches);
    }
    // Update highlighted batch ID when modal opens with new preSelectedBatchId
    if (visible) {
      setHighlightedBatchId(preSelectedBatchId);
    }
  }, [visible, batches, preSelectedBatchId]);

  // Scroll to the selected batch when modal opens or selection changes
  React.useEffect(() => {
    if (
      visible &&
      selectedBatchIndex !== null &&
      selectedBatchIndex >= 0 &&
      selectedBatchIndex < recalculatedBatches.length &&
      scrollViewRef.current
    ) {
      // Scroll to the selected batch
      // Estimate: each batch item is approximately 100 pixels tall
      const yOffset = selectedBatchIndex * 100;
      scrollViewRef.current.scrollTo({
        y: yOffset,
        animated: true,
      });
      console.log(
        "[ViewAllBatches] Scrolled to selected batch index:",
        selectedBatchIndex,
      );
    }
  }, [visible, selectedBatchIndex, recalculatedBatches.length]);

  const handleDeletePress = (index) => {
    setBatchToDelete(index);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (batchToDelete !== null) {
      try {
        // Get the batch ID from the recalculatedBatches array
        const batchId = recalculatedBatches[batchToDelete]?.id;
        const batchNumber =
          recalculatedBatches[batchToDelete]?.batchNumber ||
          recalculatedBatches[batchToDelete]?.batchNo ||
          "Unknown";

        if (!batchId) {
          setDeleteErrorMessage("Unable to identify batch for deletion");
          setShowDeleteError(true);
          return;
        }

        // Delete from Firestore first
        await deleteBatch(batchId);

        // Log the deletion event
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userInfo = await getUserInfo(currentUser.uid);
          logDeleteEvent(
            currentUser.uid,
            userInfo.firstname,
            userInfo.lastname,
            batchId,
            batchNumber,
          );
        }

        // Update local state after successful deletion
        onDeleteBatch(batchToDelete);
        setDeleteConfirmVisible(false);
        setBatchToDelete(null);

        // Show success modal and auto-close after 2 seconds
        setShowDeleteSuccess(true);
        setTimeout(() => {
          setShowDeleteSuccess(false);
        }, 2000);
      } catch (error) {
        console.error("[HandleConfirmDelete] Error:", error);
        setDeleteErrorMessage(
          error.message || "Failed to delete batch. Please try again.",
        );
        setShowDeleteError(true);
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmVisible(false);
    setBatchToDelete(null);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>All Batches</Text>

            <ScrollView ref={scrollViewRef} style={styles.batchesContainer}>
              {recalculatedBatches.length === 0 ? (
                <Text style={styles.emptyMessage}>No batches found.</Text>
              ) : (
                recalculatedBatches.map((batch, idx) => {
                  // Map batch fields - support both old and new field names
                  const displayBatchNo =
                    batch.batchNumber !== undefined &&
                    batch.batchNumber !== null &&
                    batch.batchNumber !== ""
                      ? String(batch.batchNumber)
                      : batch.batchNo !== undefined &&
                          batch.batchNo !== null &&
                          batch.batchNo !== ""
                        ? String(batch.batchNo)
                        : "";

                  const displayChicks = batch.chicksCount
                    ? String(batch.chicksCount)
                    : "0";

                  // Support both daysCount and age fields
                  const displayDays = batch.daysCount
                    ? String(batch.daysCount)
                    : batch.age
                      ? String(batch.age)
                      : "0";

                  const displayHarvest = batch.harvestDays
                    ? String(batch.harvestDays)
                    : "0";

                  // Handle both Firestore Timestamp and Date objects
                  let startDate = "";
                  if (batch.startDate) {
                    try {
                      if (batch.startDate.toDate) {
                        // Firestore Timestamp object
                        startDate = batch.startDate
                          .toDate()
                          .toLocaleDateString();
                      } else if (typeof batch.startDate === "string") {
                        // ISO string
                        startDate = new Date(
                          batch.startDate,
                        ).toLocaleDateString();
                      } else if (batch.startDate instanceof Date) {
                        // Date object
                        startDate = batch.startDate.toLocaleDateString();
                      }
                    } catch (e) {
                      console.warn("[ViewAllBatches] Error parsing date:", e);
                      startDate = "";
                    }
                  }

                  const isSelected = idx === selectedBatchIndex;
                  const isHighlighted = batch.id === highlightedBatchId;

                  // Calculate if batch is active (has chicks AND hasn't reached harvest)
                  const chicksNum = parseInt(displayChicks, 10) || 0;
                  const daysNum = parseInt(displayDays, 10) || 0;
                  const harvestNum = parseInt(displayHarvest, 10) || 0;
                  const isActiveBatch = chicksNum > 0 && daysNum < harvestNum;

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.batchItem,
                        isSelected && styles.batchItemSelected,
                        isHighlighted && styles.batchItemHighlighted,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.batchContent}
                        onPress={() => onSelectBatch(idx)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.batchLabel}>
                          Batch No.:{" "}
                          <Text style={styles.batchValue}>
                            {displayBatchNo}
                          </Text>
                        </Text>
                        <Text style={styles.batchLabel}>
                          Chicks:{" "}
                          <Text style={styles.batchValue}>{displayChicks}</Text>
                        </Text>
                        <Text style={styles.batchLabel}>
                          Days:{" "}
                          <Text style={styles.batchValue}>{displayDays}</Text>
                        </Text>
                        <Text style={styles.batchLabel}>
                          Harvest:{" "}
                          <Text style={styles.batchValue}>
                            {displayHarvest}
                          </Text>
                        </Text>
                        <Text style={styles.batchLabel}>
                          Start:{" "}
                          <Text style={styles.batchValue}>{startDate}</Text>
                        </Text>
                        {isSelected && (
                          <Text style={styles.selectedBadge}>✓ Selected</Text>
                        )}
                        {isHighlighted && !isSelected && (
                          <Text style={styles.activeBatchBadge}>
                            🐣 Currently Active
                          </Text>
                        )}
                      </TouchableOpacity>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[
                            styles.deleteButton,
                            !isActiveBatch && styles.deleteButtonDisabled,
                          ]}
                          onPress={() =>
                            isActiveBatch && handleDeletePress(idx)
                          }
                          disabled={!isActiveBatch}
                          activeOpacity={isActiveBatch ? 0.7 : 1}
                        >
                          <Text
                            style={[
                              styles.deleteButtonText,
                              !isActiveBatch && styles.deleteButtonTextDisabled,
                            ]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.9}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.confirmModalCard}>
            <Text style={styles.confirmTitle}>Delete Batch</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete this batch? This action cannot be
              undone.
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={handleConfirmDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Success Modal */}
      <Modal visible={showDeleteSuccess} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.successModalCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Deleted Successfully</Text>
            <Text style={styles.successMessage}>
              Batch has been removed from your records.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Delete Error Modal */}
      <Modal visible={showDeleteError} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.errorModalCard}>
            <Text style={styles.errorIcon}>✕</Text>
            <Text style={styles.errorTitle}>Deletion Failed</Text>
            <Text style={styles.errorMessage}>{deleteErrorMessage}</Text>

            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => setShowDeleteError(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.errorButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
    textAlign: "center",
  },
  batchesContainer: {
    maxHeight: 450,
    marginBottom: 16,
    flexGrow: 0,
  },
  emptyMessage: {
    textAlign: "center",
    color: "#666",
    marginTop: 24,
    fontSize: 15,
  },
  batchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginBottom: 8,
  },
  batchItemSelected: {
    backgroundColor: "#e0e7ff",
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  batchItemHighlighted: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  batchContent: {
    flex: 1,
  },
  batchLabel: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  batchValue: {
    fontWeight: "700",
    color: "#1e293b",
  },
  selectedBadge: {
    color: "#2563eb",
    fontWeight: "bold",
    marginTop: 6,
    fontSize: 13,
  },
  activeBatchBadge: {
    color: "#f59e0b",
    fontWeight: "bold",
    marginTop: 6,
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: "column",
    gap: 8,
    marginLeft: 12,
  },
  deleteButton: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  deleteButtonDisabled: {
    backgroundColor: "#d1d5db",
    opacity: 0.6,
  },
  deleteButtonTextDisabled: {
    color: "#6b7280",
  },
  closeButton: {
    backgroundColor: "#154b99",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Confirmation Modal Styles
  confirmModalCard: {
    width: "85%",
    maxWidth: 350,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#1e293b",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmDeleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Success Modal Styles
  successModalCard: {
    width: "85%",
    maxWidth: 320,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  successIcon: {
    fontSize: 48,
    color: "#10b981",
    marginBottom: 12,
    fontWeight: "bold",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  // Error Modal Styles
  errorModalCard: {
    width: "85%",
    maxWidth: 350,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  errorIcon: {
    fontSize: 48,
    color: "#ef4444",
    marginBottom: 12,
    fontWeight: "bold",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  errorButton: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
