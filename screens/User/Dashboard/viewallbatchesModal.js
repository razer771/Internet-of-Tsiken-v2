import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";

export default function ViewAllBatchesModal({
  visible,
  batches,
  selectedBatchIndex,
  onSelectBatch,
  onDeleteBatch,
  onEditBatch,
  onClose,
}) {
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState(null);

  // Auto-select the most recent batch if none is selected
  React.useEffect(() => {
    if (visible && batches.length > 0 && (selectedBatchIndex === null || selectedBatchIndex >= batches.length)) {
      // Select the last batch (most recent)
      onSelectBatch(batches.length - 1);
    }
  }, [visible, batches, selectedBatchIndex, onSelectBatch]);

  const handleDeletePress = (index) => {
    setBatchToDelete(index);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = () => {
    if (batchToDelete !== null) {
      onDeleteBatch(batchToDelete);
      setDeleteConfirmVisible(false);
      setBatchToDelete(null);
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
            
            <ScrollView style={styles.batchesContainer}>
              {batches.length === 0 ? (
                <Text style={styles.emptyMessage}>No batches found.</Text>
              ) : (
                batches.map((batch, idx) => {
                  const displayBatchNo = (batch.batchNo !== undefined && batch.batchNo !== null && batch.batchNo !== "") ? String(batch.batchNo) : "";
                  const displayChicks = batch.chicksCount ? String(batch.chicksCount) : "0";
                  const displayDays = batch.daysCount ? String(batch.daysCount) : "0";
                  const displayHarvest = batch.harvestDays ? String(batch.harvestDays) : "0";
                  const startDate = batch.startDate ? new Date(batch.startDate).toLocaleDateString() : "";
                  const isSelected = idx === selectedBatchIndex;

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.batchItem,
                        isSelected && styles.batchItemSelected,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.batchContent}
                        onPress={() => onSelectBatch(idx)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.batchLabel}>
                          Batch No.: <Text style={styles.batchValue}>{displayBatchNo}</Text>
                        </Text>
                        <Text style={styles.batchLabel}>
                          Chicks: <Text style={styles.batchValue}>{displayChicks}</Text>
                        </Text>
                        <Text style={styles.batchLabel}>
                          Days: <Text style={styles.batchValue}>{displayDays}</Text>
                        </Text>
                        <Text style={styles.batchLabel}>
                          Harvest: <Text style={styles.batchValue}>{displayHarvest}</Text>
                        </Text>
                        <Text style={styles.batchLabel}>
                          Start: <Text style={styles.batchValue}>{startDate}</Text>
                        </Text>
                        {isSelected && (
                          <Text style={styles.selectedBadge}>✓ Selected</Text>
                        )}
                      </TouchableOpacity>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeletePress(idx)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.deleteButtonText}>Delete</Text>
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
              Are you sure you want to delete this batch? This action cannot be undone.
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
});