import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../config/firebaseconfig";
import { getAuth } from "firebase/auth";

const Icon = Feather;

export default function GenerateReportModal({
  visible,
  onClose,
  onGenerate,
  existingBatches = [],
}) {
  const [batchNumber, setBatchNumber] = useState("");
  const [reportType, setReportType] = useState("");
  const [availableBatches, setAvailableBatches] = useState([]);
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [showReportTypeDropdown, setShowReportTypeDropdown] = useState(false);
  const [isGeneratePressed, setIsGeneratePressed] = useState(false);

  const [errors, setErrors] = useState({
    batchNumber: "",
    reportType: "",
  });

  const [warnings, setWarnings] = useState({});

  const [duplicateBatchError, setDuplicateBatchError] = useState("");

  // Fetch available batches from brooderInfo collection
  useEffect(() => {
    const fetchAvailableBatches = async () => {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const userId = currentUser.uid;
        const q = query(
          collection(db, "brooderInfo"),
          where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(q);

        const batches = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          batches.push({
            id: doc.id,
            batchId: data.batchId,
            batchNumber: data.batchNumber,
          });
        });

        setAvailableBatches(batches);
      } catch (error) {
        console.error("Error fetching batches:", error);
      }
    };

    if (visible) {
      fetchAvailableBatches();
    }
  }, [visible]);

  const validateForm = () => {
    const newErrors = {
      batchNumber: "",
      reportType: "",
    };

    let isValid = true;
    setDuplicateBatchError("");

    // Validate Batch Number
    if (!batchNumber.trim()) {
      newErrors.batchNumber = "Select a batch";
      isValid = false;
    }

    // Validate Report Type
    if (!reportType.trim()) {
      newErrors.reportType = "Select a report type";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleGenerate = () => {
    if (validateForm()) {
      const reportData = {
        batchNumber: batchNumber.trim(),
        reportType: reportType.trim(),
      };

      console.log("Report generated:", reportData);

      // Call parent callback to add report to table
      if (onGenerate) {
        onGenerate(reportData);
      }

      // Close the modal immediately - parent will show success
      handleClose();
    }
  };

  const handleClose = () => {
    setBatchNumber("");
    setReportType("");
    setAvailableBatches([]);
    setErrors({
      batchNumber: "",
      reportType: "",
    });
    setDuplicateBatchError("");
    setShowBatchDropdown(false);
    setShowReportTypeDropdown(false);
    setIsGeneratePressed(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.backButton}>
              <Icon name="chevron-left" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Generate New Report</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Form */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.form}>
              {/* Batch Number - Dropdown */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Batch Number</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownButton,
                    errors.batchNumber && styles.inputError,
                  ]}
                  onPress={() => setShowBatchDropdown(!showBatchDropdown)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !batchNumber && styles.placeholderText,
                    ]}
                  >
                    {batchNumber ? `${batchNumber}` : "Select a batch"}
                  </Text>
                  <Icon name="chevron-down" size={16} color="#64748b" />
                </TouchableOpacity>

                {showBatchDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView
                      style={styles.dropdownScroll}
                      nestedScrollEnabled
                    >
                      {availableBatches.map((batch) => (
                        <TouchableOpacity
                          key={batch.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setBatchNumber(batch.batchNumber);
                            setShowBatchDropdown(false);
                            setErrors({ ...errors, batchNumber: "" });
                            setDuplicateBatchError("");
                          }}
                        >
                          <Text style={[styles.dropdownItemText]}>
                            {batch.batchNumber}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {errors.batchNumber ? (
                  <Text style={styles.errorText}>{errors.batchNumber}</Text>
                ) : null}
              </View>

              {/* Report Type - Dropdown */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Report Type</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownButton,
                    errors.reportType && styles.inputError,
                  ]}
                  onPress={() =>
                    setShowReportTypeDropdown(!showReportTypeDropdown)
                  }
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !reportType && styles.placeholderText,
                    ]}
                  >
                    {reportType || "Select report type"}
                  </Text>
                  <Icon name="chevron-down" size={16} color="#64748b" />
                </TouchableOpacity>

                {showReportTypeDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView
                      style={styles.dropdownScroll}
                      nestedScrollEnabled
                    >
                      {["Daily Report", "Weekly Report", "Batch Summary"].map(
                        (type) => (
                          <TouchableOpacity
                            key={type}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setReportType(type);
                              setShowReportTypeDropdown(false);
                              setErrors({ ...errors, reportType: "" });
                            }}
                          >
                            <Text style={[styles.dropdownItemText]}>
                              {type}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </ScrollView>
                  </View>
                )}

                {errors.reportType ? (
                  <Text style={styles.errorText}>{errors.reportType}</Text>
                ) : null}
              </View>

              {/* Duplicate Batch Error - Bottom of form */}
              {duplicateBatchError ? (
                <View style={styles.duplicateErrorContainer}>
                  <Icon name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.duplicateErrorText}>
                    {duplicateBatchError}
                  </Text>
                </View>
              ) : null}

              {/* Generate Button */}
              <TouchableOpacity
                style={[
                  styles.validateButton,
                  isGeneratePressed && styles.validateButtonPressed,
                ]}
                onPress={handleGenerate}
                onPressIn={() => setIsGeneratePressed(true)}
                onPressOut={() => setIsGeneratePressed(false)}
                activeOpacity={1}
              >
                <Text
                  style={[
                    styles.validateButtonText,
                    isGeneratePressed && styles.validateButtonTextPressed,
                  ]}
                >
                  Generate
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    maxWidth: 500,
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  scrollView: {
    maxHeight: "100%",
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dateInputReadOnly: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  placeholderText: {
    color: "#9ca3af",
    fontWeight: "400",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },
  validateButton: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  validateButtonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  validateButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  validateButtonTextPressed: {
    color: "#ffffff",
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  dropdownList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  dropdownItemTextActive: {
    color: "#3b82f6",
    fontWeight: "700",
  },
  warningText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },
  duplicateErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  duplicateErrorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
    flex: 1,
  },
});
