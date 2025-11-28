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
import Icon from "react-native-vector-icons/Feather";
import CalendarModal from "../navigation/CalendarModal";

export default function GenerateReportModal({ visible, onClose, onGenerate, existingBatches = [] }) {
  const BROODER_CAPACITY = 10; // Maximum chicks allowed
  const MAX_DAYS_AGO = 30; // Start date cannot be older than 30 days

  const [batchNumber, setBatchNumber] = useState("");
  const [numberOfChicks, setNumberOfChicks] = useState("");
  const [batchStartDate, setBatchStartDate] = useState(null);
  const [expectedHarvestDays, setExpectedHarvestDays] = useState("");
  const [expectedDate, setExpectedDate] = useState(null);
  const [showHarvestDaysDropdown, setShowHarvestDaysDropdown] = useState(false);
  
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [isValidatePressed, setIsValidatePressed] = useState(false);

  const [errors, setErrors] = useState({
    batchNumber: "",
    numberOfChicks: "",
    batchStartDate: "",
    expectedHarvestDays: "",
  });

  const [warnings, setWarnings] = useState({
    numberOfChicks: "",
    batchStartDate: "",
  });

  const [duplicateBatchError, setDuplicateBatchError] = useState("");

  // Generate array of harvest days from 30 to 60
  const harvestDaysOptions = Array.from({ length: 31 }, (_, i) => 30 + i);

  // Auto-calculate expected date
  useEffect(() => {
    if (batchStartDate && expectedHarvestDays) {
      const days = parseInt(expectedHarvestDays);
      if (days >= 30 && days <= 60) {
        const calculatedDate = new Date(batchStartDate);
        calculatedDate.setDate(calculatedDate.getDate() + days);
        setExpectedDate(calculatedDate);
      }
    }
  }, [batchStartDate, expectedHarvestDays]);

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const checkBatchDuplicate = (batch) => {
    const trimmedBatch = batch.trim().toLowerCase();
    const isDuplicate = existingBatches.some(existingBatch => {
      // Check if input matches the batch exactly, or matches the number part
      const lowerExisting = existingBatch.toLowerCase();
      
      // Check exact match
      if (lowerExisting === trimmedBatch) return true;
      
      // Check if input is just the number (e.g., "3" should match "Batch #3")
      if (lowerExisting === `batch #${trimmedBatch}`) return true;
      if (lowerExisting === `batch#${trimmedBatch}`) return true;
      
      // Extract number from existing batch (e.g., "Batch #3" -> "3")
      const numberMatch = lowerExisting.match(/batch\s*#?(\d+)/);
      if (numberMatch && numberMatch[1] === trimmedBatch) return true;
      
      return false;
    });
    return isDuplicate;
  };

  const checkStartDateAge = (date) => {
    const today = new Date();
    const diffTime = today - date;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > MAX_DAYS_AGO;
  };

  const validateForm = () => {
    const newErrors = {
      batchNumber: "",
      numberOfChicks: "",
      batchStartDate: "",
      expectedHarvestDays: "",
    };

    const newWarnings = {
      numberOfChicks: "",
      batchStartDate: "",
    };

    let isValid = true;
    setDuplicateBatchError("");

    // Validate Batch Number
    if (!batchNumber.trim()) {
      newErrors.batchNumber = "Enter a batch number";
      isValid = false;
    } else if (checkBatchDuplicate(batchNumber)) {
      setDuplicateBatchError("Batch number already in use");
      isValid = false;
    }

    // Validate Number of Chicks
    const chicksNum = parseInt(numberOfChicks);
    if (!numberOfChicks || chicksNum <= 0) {
      newErrors.numberOfChicks = "Enter a valid number of chicks";
      isValid = false;
    } else if (chicksNum > BROODER_CAPACITY) {
      newWarnings.numberOfChicks = "Exceeds brooder capacity";
    }

    // Validate Batch Start Date
    if (!batchStartDate) {
      newErrors.batchStartDate = "Select a start date";
      isValid = false;
    } else if (checkStartDateAge(batchStartDate)) {
      newWarnings.batchStartDate = "Start date is too old. Select a recent date.";
      isValid = false;
    }

    // Validate Expected Harvest Days
    const harvestDays = parseInt(expectedHarvestDays);
    if (!expectedHarvestDays || harvestDays < 30 || harvestDays > 60) {
      newErrors.expectedHarvestDays = "Expected harvest days must be between 30-60";
      isValid = false;
    }

    // No validation for Expected Date - it's auto-calculated

    setErrors(newErrors);
    setWarnings(newWarnings);
    return isValid;
  };

  const handleValidate = () => {
    if (validateForm()) {
      const reportData = {
        batchNumber: batchNumber.trim(),
        numberOfChicks: parseInt(numberOfChicks),
        batchStartDate,
        expectedHarvestDays: parseInt(expectedHarvestDays),
        expectedDate,
      };

      console.log("Report validated:", reportData);
      
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
    setNumberOfChicks("");
    setBatchStartDate(null);
    setExpectedHarvestDays("");
    setExpectedDate(null);
    setErrors({
      batchNumber: "",
      numberOfChicks: "",
      batchStartDate: "",
      expectedHarvestDays: "",
    });
    setWarnings({
      numberOfChicks: "",
      batchStartDate: "",
    });
    setDuplicateBatchError("");
    setShowHarvestDaysDropdown(false);
    setIsValidatePressed(false);
    onClose();
  };

  // Check batch duplicate in real-time as user types
  useEffect(() => {
    if (batchNumber.trim()) {
      if (checkBatchDuplicate(batchNumber)) {
        setDuplicateBatchError("Batch number already in use");
      } else {
        setDuplicateBatchError("");
      }
    } else {
      setDuplicateBatchError("");
    }
  }, [batchNumber, existingBatches]);

  // Also check number of chicks in real-time
  useEffect(() => {
    const chicksNum = parseInt(numberOfChicks);
    if (numberOfChicks && chicksNum > BROODER_CAPACITY) {
      setWarnings({ ...warnings, numberOfChicks: "Exceeds brooder capacity" });
    } else {
      setWarnings({ ...warnings, numberOfChicks: "" });
    }
  }, [numberOfChicks]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
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
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.form}>
              {/* Batch Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Batch Number</Text>
                <TextInput
                  style={[styles.input, errors.batchNumber && styles.inputError]}
                  placeholder="Enter a batch number"
                  placeholderTextColor="#9ca3af"
                  value={batchNumber}
                  onChangeText={(text) => {
                    setBatchNumber(text);
                    setErrors({ ...errors, batchNumber: "" });
                    setDuplicateBatchError("");
                  }}
                />
                {errors.batchNumber ? (
                  <Text style={styles.errorText}>{errors.batchNumber}</Text>
                ) : null}
              </View>

              {/* Number of Chicks */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Number of Chicks</Text>
                <TextInput
                  style={[styles.input, errors.numberOfChicks && styles.inputError]}
                  placeholder={`e.g., ${BROODER_CAPACITY}`}
                  placeholderTextColor="#9ca3af"
                  value={numberOfChicks}
                  onChangeText={(text) => {
                    setNumberOfChicks(text);
                    setErrors({ ...errors, numberOfChicks: "" });
                  }}
                  keyboardType="numeric"
                />
                {errors.numberOfChicks ? (
                  <Text style={styles.errorText}>{errors.numberOfChicks}</Text>
                ) : warnings.numberOfChicks ? (
                  <Text style={styles.errorText}>{warnings.numberOfChicks}</Text>
                ) : null}
              </View>

              {/* Batch Start Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Batch Start Date</Text>
                <TouchableOpacity
                  style={[styles.dateInput, (errors.batchStartDate || warnings.batchStartDate) && styles.inputError]}
                  onPress={() => setShowStartDateCalendar(true)}
                >
                  <Icon name="calendar" size={16} color="#64748b" />
                  <Text style={[styles.dateText, !batchStartDate && styles.placeholderText]}>
                    {batchStartDate ? formatDate(batchStartDate) : "Select a start date"}
                  </Text>
                </TouchableOpacity>
                {errors.batchStartDate ? (
                  <Text style={styles.errorText}>{errors.batchStartDate}</Text>
                ) : warnings.batchStartDate ? (
                  <Text style={styles.errorText}>{warnings.batchStartDate}</Text>
                ) : null}
              </View>

              {/* Expected Harvest Days - Dropdown */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expected Harvest Days (30-60)</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, errors.expectedHarvestDays && styles.inputError]}
                  onPress={() => setShowHarvestDaysDropdown(!showHarvestDaysDropdown)}
                >
                  <Text style={[styles.dropdownText, !expectedHarvestDays && styles.placeholderText]}>
                    {expectedHarvestDays ? `${expectedHarvestDays} days` : "Select harvest days"}
                  </Text>
                  <Icon name="chevron-down" size={16} color="#64748b" />
                </TouchableOpacity>
                
                {showHarvestDaysDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                      {harvestDaysOptions.map((days) => (
                        <TouchableOpacity
                          key={days}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setExpectedHarvestDays(String(days));
                            setShowHarvestDaysDropdown(false);
                            setErrors({ ...errors, expectedHarvestDays: "" });
                          }}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            expectedHarvestDays === String(days) && styles.dropdownItemTextActive
                          ]}>
                            {days} days
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
                
                {errors.expectedHarvestDays ? (
                  <Text style={styles.errorText}>{errors.expectedHarvestDays}</Text>
                ) : null}
              </View>

              {/* Expected Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expected Date</Text>
                <View style={styles.dateInputReadOnly}>
                  <Icon name="calendar" size={16} color="#64748b" />
                  <Text style={styles.dateText}>
                    {expectedDate ? formatDate(expectedDate) : ""}
                  </Text>
                </View>
              </View>

              {/* Duplicate Batch Error - Bottom of form */}
              {duplicateBatchError ? (
                <View style={styles.duplicateErrorContainer}>
                  <Icon name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.duplicateErrorText}>{duplicateBatchError}</Text>
                </View>
              ) : null}

              {/* Validate Button */}
              <TouchableOpacity
                style={[styles.validateButton, isValidatePressed && styles.validateButtonPressed]}
                onPress={handleValidate}
                onPressIn={() => setIsValidatePressed(true)}
                onPressOut={() => setIsValidatePressed(false)}
                activeOpacity={1}
              >
                <Text style={[styles.validateButtonText, isValidatePressed && styles.validateButtonTextPressed]}>
                  Validate
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Calendar Modals */}
          <CalendarModal
            visible={showStartDateCalendar}
            onClose={() => setShowStartDateCalendar(false)}
            onSelectDate={(date) => {
              setBatchStartDate(date);
              setErrors({ ...errors, batchStartDate: "" });
              setWarnings({ ...warnings, batchStartDate: "" });
            }}
          />
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
