import React, { useEffect, useState, useRef, useCallback } from "react";
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
  ScrollView,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { auth } from "../../../config/firebaseconfig";
import { db as firestoreDb } from "../../../config/firebaseconfig";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import DateTimePicker from "@react-native-community/datetimepicker";

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
        firstName: userData.firstName || "Unknown",
        lastName: userData.lastName || "Unknown",
      };
    } else {
      console.warn("[GetUserInfo] User document not found for:", userId);
      return {
        firstName: "Unknown",
        lastName: "Unknown",
      };
    }
  } catch (error) {
    console.error("[GetUserInfo] Error fetching user info:", error);
    return {
      firstName: "Unknown",
      lastName: "Unknown",
    };
  }
};

/**
 * Get batch details by ID
 */
const getBatchDetails = async (batchId) => {
  try {
    const docRef = doc(firestoreDb, "brooderInfo", batchId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.warn("[GetBatchDetails] Batch not found:", batchId);
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    };
  } catch (error) {
    console.error("[GetBatchDetails] Error:", error);
    return null;
  }
};

/**
 * Format date to timestamp string (no timezone conversion needed for Firestore timestamps)
 * Firebase timestamps are already in UTC, just format them directly
 */
const formatGMT8Timestamp = (date = new Date()) => {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };

  const formatted = date.toLocaleString("en-US", options);
  return `${formatted} UTC+8`;
};

/**
 * Save mortality report to Firestore
 */
const saveMortalityReport = async ({
  batchId,
  dateOfDeath,
  causeOfDeath,
  predatorType,
  customPredator,
  count,
  notes,
  userId,
  firstName,
  lastName,
  daysCount,
}) => {
  try {
    // Create mortality document
    const mortalityData = {
      batchId: batchId,
      dateOfDeath: dateOfDeath,
      dateOfDeathFormatted: formatGMT8Timestamp(dateOfDeath),
      dateReported: new Date(),
      dateReportedFormatted: formatGMT8Timestamp(),
      causeOfDeath: causeOfDeath,
      predatorType: predatorType || null,
      customPredator: customPredator || null,
      count: parseInt(count),
      notes: notes || "",
      userId: userId,
      firstName: firstName,
      lastName: lastName,
      daysCount: daysCount,
      createdAt: serverTimestamp(),
    };

    // Add to analytics/mortality collection
    const docRef = await addDoc(
      collection(firestoreDb, "analytics", "mortality", "reports"),
      mortalityData,
    );

    console.log("[SaveMortalityReport] Successfully saved:", docRef.id);

    // Update batch chicksCount
    const batchDocRef = doc(firestoreDb, "brooderInfo", batchId);
    const batchDoc = await getDoc(batchDocRef);

    if (batchDoc.exists()) {
      const currentChicksCount = batchDoc.data().chicksCount || 0;
      const newChicksCount = Math.max(0, currentChicksCount - parseInt(count));

      await updateDoc(batchDocRef, {
        chicksCount: newChicksCount,
        mortalityCount: (batchDoc.data().mortalityCount || 0) + parseInt(count),
        updatedAt: new Date(),
      });

      console.log(
        "[SaveMortalityReport] Updated batch chicksCount:",
        newChicksCount,
      );
    }

    return { success: true, reportId: docRef.id };
  } catch (error) {
    console.error("[SaveMortalityReport] Error:", error);
    throw error;
  }
};

/**
 * Save simple mortality record to mortality collection
 * Immutable record - cannot be edited or deleted
 * Structure: mortality/{batchId}/records/{auto-generated-id}
 */
const saveSimpleMortalityRecord = async ({
  userId,
  batchId,
  causeOfDeath,
  predatorType,
  customPredator,
  dateOfDeath,
  count,
  daysCount,
  notes,
  firstName,
  lastName,
  deviceInfo,
}) => {
  try {
    const recordData = {
      userId: userId,
      batchId: batchId,
      causeOfDeath: causeOfDeath,
      predatorType: predatorType || null,
      customPredator: customPredator || null,
      dateOfDeath: dateOfDeath,
      dateOfDeathFormatted: formatGMT8Timestamp(dateOfDeath),
      count: parseInt(count),
      daysCount: daysCount,
      notes: notes || "",
      timestamp: serverTimestamp(),
      deviceInfo: deviceInfo,
      reportedBy: `${firstName} ${lastName}`,
      createdAt: serverTimestamp(),
    };

    // Add document to mortality/{batchId}/records subcollection
    const docRef = await addDoc(
      collection(firestoreDb, "mortality", batchId, "records"),
      recordData,
    );

    console.log(
      "[SaveSimpleMortalityRecord] Record saved successfully:",
      docRef.id,
    );
    return { success: true, recordId: docRef.id };
  } catch (error) {
    console.error("[SaveSimpleMortalityRecord] Error:", error);
    throw error;
  }
};

/**
 * Log mortality event to activity logs
 */
const logMortalityEvent = async ({
  userId,
  firstName,
  lastName,
  batchId,
  causeOfDeath,
  predatorType,
  customPredator,
  dateOfDeath,
  count,
  daysCount,
  notes,
}) => {
  try {
    const eventData = {
      userId: userId,
      action: "Mortality reported",
      description: `${count} mortality for ${batchId}`,
      batchId: batchId,
      causeOfDeath: causeOfDeath,
      predatorType: predatorType || null,
      customPredator: customPredator || null,
      dateOfDeath: dateOfDeath,
      dateOfDeathFormatted: formatGMT8Timestamp(dateOfDeath),
      count: parseInt(count),
      daysCount: daysCount,
      notes: notes || "",
      timestamp: serverTimestamp(),
      deviceInfo: Platform.OS,
      firstName: firstName,
      lastName: lastName,
    };

    const docRef = await addDoc(
      collection(firestoreDb, "activity_logs", "mortalityReporting", "events"),
      eventData,
    );

    console.log("[LogMortalityEvent] Event logged successfully:", docRef.id);
    return { success: true, logId: docRef.id };
  } catch (error) {
    console.error("[LogMortalityEvent] Error:", error);
    return { success: false, error: error.message };
  }
};

export default function ReportMortalityModal({
  visible,
  batches = [],
  onClose,
  onSuccess,
  currentCalculatedAge = 0,
}) {
  // console.log("[ReportMortalityModal] Render - visible:", visible);

  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [causeOfDeath, setCauseOfDeath] = useState("");
  const [predatorType, setPredatorType] = useState("");
  const [customCause, setCustomCause] = useState("");
  const [customPredator, setCustomPredator] = useState("");
  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");
  // Initialize with a function to only create Date once
  const [dateOfDeath, setDateOfDeath] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [showCauseDropdown, setShowCauseDropdown] = useState(false);
  const [showPredatorDropdown, setShowPredatorDropdown] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [maxChicksCount, setMaxChicksCount] = useState(0);
  const prevVisibleRef = useRef(false);
  const prevDateRef = useRef(null);

  // Error states
  const [batchError, setBatchError] = useState("");
  const [causeError, setCauseError] = useState("");
  const [predatorError, setPredatorError] = useState("");
  const [countError, setCountError] = useState("");
  const [dateError, setDateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track dateOfDeath changes
  useEffect(() => {
    if (
      prevDateRef.current &&
      prevDateRef.current.getTime() !== dateOfDeath.getTime()
    ) {
      console.log(
        "[ReportMortalityModal] dateOfDeath changed:",
        prevDateRef.current,
        "->",
        dateOfDeath,
      );
    }
    prevDateRef.current = new Date(dateOfDeath);
  }, [dateOfDeath]);

  const causeOptions = [
    "Predator Attack",
    "Dehydration",
    "Overfeeding",
    "Disease",
    "Other",
  ];

  const predatorOptions = ["Dog", "Cat", "Rat", "Snake", "Other"];

  // Create stable date references for DateTimePicker
  const minDateRef = useRef(new Date(2026, 0, 1));
  const maxDateRef = useRef(new Date());
  maxDateRef.current = new Date(); // Update daily but reuse for picker

  // Reset form ONLY when modal transitions from closed to open
  useEffect(() => {
    // Only reset if visible is true AND it wasn't true before (i.e., modal just opened)
    if (visible && !prevVisibleRef.current) {
      console.log("[ReportMortalityModal] Modal opened, resetting form");
      setSelectedBatchId("");
      setCauseOfDeath("");
      setPredatorType("");
      setCustomCause("");
      setCustomPredator("");
      setCount("");
      setNotes("");
      setDateOfDeath(new Date());
      setBatchError("");
      setCauseError("");
      setPredatorError("");
      setCountError("");
      setDateError("");
      setMaxChicksCount(0);
      setIsSubmitting(false);
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  // Update max chicks count when batch is selected
  useEffect(() => {
    if (selectedBatchId) {
      const batch = batches.find((b) => b.id === selectedBatchId);
      if (batch) {
        setMaxChicksCount(batch.chicksCount || 0);
      }
    }
  }, [selectedBatchId, batches]);

  const handleBatchSelect = (batchId) => {
    setSelectedBatchId(batchId);
    setShowBatchDropdown(false);
    setBatchError("");
  };

  const handleCauseSelect = (cause) => {
    setCauseOfDeath(cause);
    setShowCauseDropdown(false);
    setCauseError("");

    // Reset predator and custom cause fields when changing cause
    if (cause !== "Other") {
      setCustomCause("");
    }
    if (cause !== "Predator Attack") {
      setPredatorType("");
      setCustomPredator("");
      setPredatorError("");
    }
  };

  const handlePredatorSelect = (predator) => {
    setPredatorType(predator);
    setShowPredatorDropdown(false);
    setPredatorError("");

    // Reset custom predator if not "Other"
    if (predator !== "Other") {
      setCustomPredator("");
    }
  };

  const handleCountChange = (text) => {
    const numericText = text.replace(/[^0-9]/g, "");
    const numValue = parseInt(numericText);

    if (numericText === "") {
      setCount("");
      setCountError("");
    } else if (numValue > 0 && numValue <= maxChicksCount) {
      setCount(numericText);
      setCountError("");
    } else if (numValue > maxChicksCount) {
      setCount(numericText);
      setCountError(
        `Count cannot exceed ${maxChicksCount} chicks in this batch`,
      );
    } else {
      setCountError("Count must be greater than 0");
    }
  };

  const handleDateChange = useCallback((event, selectedDate) => {
    console.log(
      "[handleDateChange] Event type:",
      event.type,
      "Selected date:",
      selectedDate,
    );

    // Only process if a date was actually selected
    if (!selectedDate) {
      console.log("[handleDateChange] No date selected, closing picker");
      setShowDatePicker(false);
      return;
    }

    // Validate the selected date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDate = new Date(selectedDate);
    checkDate.setHours(0, 0, 0, 0);

    console.log("[handleDateChange] Today:", today, "Check date:", checkDate);

    // Check if year is 2025 or below
    if (checkDate.getFullYear() <= 2025) {
      console.warn("[handleDateChange] Year is 2025 or earlier");
      setDateError("Date of Death must be from 2026 onwards");
      setShowDatePicker(false);
      return;
    }

    // Check if date is in the future
    if (checkDate > today) {
      console.warn("[handleDateChange] Date is in the future");
      setDateError("Date cannot be in the future");
      setShowDatePicker(false);
      return;
    }

    // Date is valid - persist it and close picker
    console.log("[handleDateChange] Date is valid, persisting:", checkDate);
    setDateOfDeath(checkDate);
    setDateError("");
    setShowDatePicker(false);
  }, []);

  const isFormValid = () => {
    // Basic validations
    const baseValid =
      selectedBatchId &&
      causeOfDeath &&
      count &&
      parseInt(count) > 0 &&
      parseInt(count) <= maxChicksCount &&
      !dateError &&
      !batchError &&
      !causeError &&
      !countError;

    // Additional validation for "Other" cause
    if (causeOfDeath === "Other" && !customCause.trim()) {
      return false;
    }

    // Additional validation for "Predator Attack"
    if (causeOfDeath === "Predator Attack") {
      if (!predatorType) {
        return false;
      }
      if (predatorType === "Other" && !customPredator.trim()) {
        return false;
      }
    }

    return baseValid;
  };

  const handleSubmit = async () => {
    // Prevent multiple submissions
    if (isSubmitting) {
      console.log("[HandleSubmit] Submission already in progress");
      return;
    }

    // Validate all fields
    if (!selectedBatchId) {
      setBatchError("Please select a batch");
      return;
    }

    if (!causeOfDeath) {
      setCauseError("Please select a reason for loss");
      return;
    }

    if (causeOfDeath === "Other" && !customCause.trim()) {
      setCauseError("Please specify the reason for loss");
      return;
    }

    if (causeOfDeath === "Predator Attack") {
      if (!predatorType) {
        setPredatorError("Please select predator type");
        return;
      }
      if (predatorType === "Other" && !customPredator.trim()) {
        setPredatorError("Please specify the predator");
        return;
      }
    }

    if (!count || parseInt(count) <= 0) {
      setCountError("Please enter a valid count");
      return;
    }

    if (parseInt(count) > maxChicksCount) {
      setCountError(
        `Count cannot exceed ${maxChicksCount} chicks in this batch`,
      );
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "User not authenticated. Please log in.");
      return;
    }

    // Set submitting state to prevent multiple clicks
    setIsSubmitting(true);

    try {
      // Get user info
      const userInfo = await getUserInfo(currentUser.uid);

      // Get batch details
      const batchDetails = await getBatchDetails(selectedBatchId);
      if (!batchDetails) {
        Alert.alert("Error", "Batch not found. Please try again.");
        return;
      }

      const finalCause = causeOfDeath === "Other" ? customCause : causeOfDeath;
      const finalPredator =
        predatorType === "Other" ? customPredator : predatorType;

      // Use the calculated age (with daily increments) from Home component
      // Fallback to batch's stored daysCount if calculated age is not provided
      const ageAtTimeOfMortality =
        currentCalculatedAge > 0
          ? currentCalculatedAge
          : batchDetails.daysCount || 0;

      // Save mortality report
      await saveMortalityReport({
        batchId: selectedBatchId,
        dateOfDeath: dateOfDeath,
        causeOfDeath: finalCause,
        predatorType: causeOfDeath === "Predator Attack" ? finalPredator : null,
        customPredator: predatorType === "Other" ? customPredator : null,
        count: count,
        notes: notes,
        userId: currentUser.uid,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        daysCount: ageAtTimeOfMortality,
      });

      // Log event
      await logMortalityEvent({
        userId: currentUser.uid,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        batchId: selectedBatchId,
        causeOfDeath: finalCause,
        predatorType: causeOfDeath === "Predator Attack" ? finalPredator : null,
        customPredator: predatorType === "Other" ? customPredator : null,
        dateOfDeath: dateOfDeath,
        count: count,
        daysCount: ageAtTimeOfMortality,
        notes: notes,
      });

      // Save immutable mortality record to mortality collection
      await saveSimpleMortalityRecord({
        userId: currentUser.uid,
        batchId: selectedBatchId,
        causeOfDeath: finalCause,
        predatorType: causeOfDeath === "Predator Attack" ? finalPredator : null,
        customPredator: predatorType === "Other" ? customPredator : null,
        dateOfDeath: dateOfDeath,
        count: count,
        daysCount: ageAtTimeOfMortality,
        notes: notes,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        deviceInfo: Platform.OS,
      });

      // Show success modal
      setShowSuccess(true);

      // Call success callback with batch ID
      if (onSuccess) {
        const batchNumber = selectedBatchId.replace("Batch ", "");
        onSuccess(batchNumber);
      }

      // Close after 2 seconds
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      console.error("[HandleSubmit] Error:", error);
      setIsSubmitting(false);
      Alert.alert(
        "Error",
        "Failed to report mortality. Please try again.\n" + error.message,
      );
    }
  };

  const handleClose = () => {
    setShowBatchDropdown(false);
    setShowCauseDropdown(false);
    setShowPredatorDropdown(false);
    onClose();
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Close Button X */}
            <TouchableOpacity
              key="close-button"
              onPress={handleClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <Text key="title" style={styles.sectionTitle}>
              Report Chicken Loss
            </Text>

            {/* Batch Selection Dropdown */}
            <View key="batch-section" style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Batch *</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowBatchDropdown(!showBatchDropdown)}
              >
                <Text
                  style={[
                    styles.dropdownButtonText,
                    !selectedBatchId && styles.dropdownPlaceholder,
                  ]}
                >
                  {selectedBatchId || "Select a batch"}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
              {showBatchDropdown && (
                <ScrollView
                  style={styles.dropdownList}
                  nestedScrollEnabled={true}
                >
                  {batches.filter(
                    (b) =>
                      !b.deleted &&
                      b.chicksCount > 0 &&
                      b.daysCount < b.harvestDays &&
                      b.status !== "harvest",
                  ).length === 0 ? (
                    <Text key="no-batches" style={styles.dropdownEmptyText}>
                      No batches available
                    </Text>
                  ) : (
                    batches
                      .filter(
                        (b) =>
                          !b.deleted &&
                          b.chicksCount > 0 &&
                          b.daysCount < b.harvestDays &&
                          b.status !== "harvest",
                      )
                      .map((batch) => (
                        <TouchableOpacity
                          key={batch.id}
                          style={styles.dropdownItem}
                          onPress={() => handleBatchSelect(batch.id)}
                        >
                          <Text style={styles.dropdownItemText}>
                            {batch.id}
                          </Text>
                        </TouchableOpacity>
                      ))
                  )}
                </ScrollView>
              )}
              {batchError ? (
                <Text style={styles.errorText}>{batchError}</Text>
              ) : null}
            </View>

            {/* Date of Death */}
            <View key="date-section" style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Loss Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {formatDate(dateOfDeath)}
                </Text>
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={dateOfDeath}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  minimumDate={minDateRef.current}
                  maximumDate={maxDateRef.current}
                />
              )}
              {dateError ? (
                <Text style={styles.errorText}>{dateError}</Text>
              ) : null}
            </View>

            {/* Cause of Death Dropdown */}
            <View key="cause-section" style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Loss *</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCauseDropdown(!showCauseDropdown)}
              >
                <Text
                  style={[
                    styles.dropdownButtonText,
                    !causeOfDeath && styles.dropdownPlaceholder,
                  ]}
                >
                  {causeOfDeath || "Select a reason for loss"}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
              {showCauseDropdown && (
                <ScrollView
                  style={styles.dropdownList}
                  nestedScrollEnabled={true}
                >
                  {causeOptions.map((cause) => (
                    <TouchableOpacity
                      key={cause}
                      style={styles.dropdownItem}
                      onPress={() => handleCauseSelect(cause)}
                    >
                      <Text style={styles.dropdownItemText}>{cause}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {causeError ? (
                <Text style={styles.errorText}>{causeError}</Text>
              ) : null}
            </View>

            {/* Predator Type Dropdown (if Predator Attack selected) */}
            {causeOfDeath === "Predator Attack" && (
              <View key="predator-type-section" style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Predator Type *</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowPredatorDropdown(!showPredatorDropdown)}
                >
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      !predatorType && styles.dropdownPlaceholder,
                    ]}
                  >
                    {predatorType || "Select predator type"}
                  </Text>
                  <Text style={styles.dropdownIcon}>▼</Text>
                </TouchableOpacity>
                {showPredatorDropdown && (
                  <ScrollView
                    style={styles.dropdownList}
                    nestedScrollEnabled={true}
                  >
                    {predatorOptions.map((predator) => (
                      <TouchableOpacity
                        key={predator}
                        style={styles.dropdownItem}
                        onPress={() => handlePredatorSelect(predator)}
                      >
                        <Text style={styles.dropdownItemText}>{predator}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {predatorError ? (
                  <Text style={styles.errorText}>{predatorError}</Text>
                ) : null}
              </View>
            )}

            {/* Custom Predator (if Other selected in predator) */}
            {causeOfDeath === "Predator Attack" && predatorType === "Other" && (
              <View key="custom-predator-input" style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Specify Predator *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter predator type"
                  placeholderTextColor="#9ca3af"
                  value={customPredator}
                  onChangeText={(text) => {
                    setCustomPredator(text);
                    setPredatorError("");
                  }}
                  maxLength={100}
                />
              </View>
            )}

            {/* Custom Cause (if Other selected in cause) */}
            {causeOfDeath === "Other" && (
              <View key="custom-cause-input" style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Specify Cause *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter cause of death"
                  placeholderTextColor="#9ca3af"
                  value={customCause}
                  onChangeText={(text) => {
                    setCustomCause(text);
                    setCauseError("");
                  }}
                  maxLength={100}
                />
              </View>
            )}

            {/* Count */}
            <View key="count-section" style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Number of Chicks Lost *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter number of chicks"
                placeholderTextColor="#9ca3af"
                value={count}
                onChangeText={handleCountChange}
                keyboardType="numeric"
                maxLength={5}
              />
              {countError ? (
                <Text style={styles.errorText}>{countError}</Text>
              ) : null}
            </View>

            {/* Notes (Optional) */}
            <View key="notes-section" style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter additional notes"
                placeholderTextColor="#9ca3af"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid() || isSubmitting) && styles.submitButtonDisabled,
              ]}
              activeOpacity={0.9}
              onPress={handleSubmit}
              disabled={!isFormValid() || isSubmitting}
            >
              <Text
                style={[
                  styles.submitButtonText,
                  (!isFormValid() || isSubmitting) &&
                    styles.submitButtonTextDisabled,
                ]}
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
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
              <Text style={styles.successTitle}>Mortality Reported!</Text>
              <Text style={styles.successMessage}>
                Report submitted for {selectedBatchId}
              </Text>
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
    maxHeight: "85%",
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
    marginBottom: 16,
    color: "#0f172a",
    paddingRight: 40,
  },
  inputGroup: {
    marginBottom: 16,
    zIndex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#000000ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
    backgroundColor: "#fff",
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: "#000000ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownButtonText: {
    fontSize: 14,
    color: "#0f172a",
    flex: 1,
  },
  dropdownPlaceholder: {
    color: "#9ca3af",
  },
  dropdownIcon: {
    fontSize: 10,
    color: "#64748b",
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    marginTop: 4,
    maxHeight: 250,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#0f172a",
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: "#9ca3af",
    padding: 12,
    textAlign: "center",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#000000ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateButtonText: {
    fontSize: 14,
    color: "#0f172a",
  },
  dateIcon: {
    fontSize: 18,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: "#E53935",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderColor: "#C62828",
    borderWidth: 1,
  },
  submitButtonDisabled: {
    backgroundColor: "#9ca3af",
    borderColor: "#9ca3af",
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  submitButtonTextDisabled: {
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
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
});
